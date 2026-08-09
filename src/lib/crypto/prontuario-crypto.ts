import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Criptografia de aplicação para o conteúdo de evolução clínica (sigiloso
// por natureza — Res. CFP 01/2009/06/2019), server-only.
//
// Por que não pgsodium/Vault: pgsodium está em ciclo de depreciação
// ("Supabase does not recommend the usage of pgsodium as it will be
// deprecated" — docs.supabase.com/guides/database/extensions/pgsodium) e o
// Supabase não recomenda mais nem pgsodium nem Transparent Column
// Encryption por complexidade operacional/risco de má configuração. O
// substituto indicado, Supabase Vault, é para SEGREDOS da aplicação (chave
// de API, token) — não para dado de usuário/paciente, e mesmo que fosse
// usado a chave continuaria dentro do próprio Postgres (protege contra
// vazamento do dump, não contra quem tem acesso de admin ao banco). Como
// pedido explicitamente ("chave fora do Supabase"), a cifra/decifra
// acontece só aqui, no servidor Next.js, com a chave vindo de uma env var
// do próprio servidor (Vercel), nunca do Supabase — RLS continua sendo a
// primeira barreira (decide QUEM pode chamar estas rotas), a criptografia é
// a segunda (protege o CONTEÚDO mesmo se alguém tiver acesso direto ao
// Postgres, um dump ou a service role key).
//
// AES-256-GCM: autenticado (detecta adulteração do ciphertext, não só
// confidencialidade), IV aleatório de 12 bytes por valor (nunca reusar IV
// com a mesma chave). Formato armazenado: "encv1:<iv>:<authTag>:<ciphertext>",
// tudo em base64 — cabe na coluna "text" existente, sem migração de schema.
const PREFIXO = "encv1:";
const ALGORITMO = "aes-256-gcm";
const IV_BYTES = 12;

function chave(): Buffer {
  const raw = process.env.PRONTUARIO_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PRONTUARIO_ENCRYPTION_KEY não configurada no ambiente do servidor — conteúdo de evolução não pode ser gravado sem a chave de criptografia."
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("PRONTUARIO_ENCRYPTION_KEY inválida: precisa decodificar (base64) para exatamente 32 bytes.");
  }
  return buf;
}

export function encryptProntuario(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, chave(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIXO}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

// Passa despercebido qualquer valor sem o prefixo — cobre linhas gravadas
// antes desta camada existir (nenhuma esperada em produção ainda, ver
// pré-requisito "ambiente de staging antes do primeiro paciente real", mas
// não custa não quebrar leitura de dado pré-existente).
export function decryptProntuario(stored: string): string {
  if (!stored.startsWith(PREFIXO)) return stored;
  const partes = stored.slice(PREFIXO.length).split(":");
  if (partes.length !== 3) {
    throw new Error("Conteúdo de evolução corrompido: formato de criptografia inesperado.");
  }
  const [ivB64, authTagB64, ciphertextB64] = partes;
  const decipher = createDecipheriv(ALGORITMO, chave(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
