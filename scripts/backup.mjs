/**
 * Backup dos DADOS do banco para um arquivo JSON.
 *
 * Por que não pg_dump/supabase db dump: os dois exigem Docker ou o cliente
 * do PostgreSQL instalado, que não existem nesta máquina. Este script usa só
 * o Node e a lib do Supabase que o projeto já depende.
 *
 * Por que só os dados basta: o schema inteiro (tabelas, RLS, funções,
 * triggers) já está versionado no git em schema.sql. Restaurar = criar um
 * projeto Supabase novo, rodar schema.sql, e rodar scripts/restore.mjs.
 *
 * NÃO cobre os arquivos do Storage (bucket materiais-paciente) — ver o
 * aviso impresso no fim da execução.
 *
 * Uso:
 *   node scripts/backup.mjs
 *
 * Exige, no .env.local, os valores REAIS do projeto de produção:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 * (service role porque o backup precisa ler tudo, ignorando RLS.)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Lê o .env.local na mão: este script roda fora do Next, que é quem
// normalmente carrega esse arquivo.
function carregarEnvLocal() {
  let conteudo;
  try {
    conteudo = readFileSync(".env.local", "utf8");
  } catch {
    throw new Error("Arquivo .env.local não encontrado na raiz do projeto.");
  }
  const env = {};
  for (const linha of conteudo.split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual === -1) continue;
    // Tira aspas de valores tipo BREVO_FROM_NAME="Psico".
    env[limpa.slice(0, igual).trim()] = limpa
      .slice(igual + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

// Ordem importa no restore (chave estrangeira): quem é referenciado vem
// antes de quem referencia. rate_limit_eventos fica de fora de propósito —
// é cache de anti-abuso, se perder não faz falta nenhuma.
const TABELAS = [
  "profiles",
  "perfis",
  "assinaturas",
  "disponibilidades",
  "pacientes",
  "recorrencias",
  "consultas",
  "sessoes_prontuario",
  "lancamentos_financeiros",
  "notificacoes",
  "checkins_humor",
  "habitos_paciente",
  "registros_habito",
  "diario_paciente",
  "materiais_paciente",
  "convites_paciente",
  "convites_escala",
  "respostas_escala",
  "modelos_documentos",
  "documentos_emitidos",
  "avisos_psicologo",
  "acessos_prontuario",
  "app_secrets",
];

const PAGINA = 1000;

/**
 * Papel declarado no payload de uma chave em formato JWT (o formato antigo
 * do Supabase, em que anon e service_role só se distinguem por este campo).
 * Devolve null pro formato novo (sb_secret_/sb_publishable_), que não é JWT.
 */
function papelDoJwt(chave) {
  const partes = chave.split(".");
  if (partes.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

async function baixarTabela(supabase, tabela) {
  const linhas = [];
  // Pagina de propósito: a API do Supabase corta em 1000 linhas por
  // requisição, e um backup que silenciosamente para na linha 1000 é pior
  // que não ter backup nenhum.
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < PAGINA) break;
  }
  return linhas;
}

// Os usuários do Auth (auth.users) não são uma tabela normal — só dá pra
// ler pela API de admin. Sem eles o backup seria inútil num desastre de
// verdade: profiles/perfis/pacientes todos têm chave estrangeira pra
// auth.users, então restaurar sem recriar os usuários antes falharia em
// tudo. A SENHA não vem nesta API (nem existe forma de restaurá-la) — quem
// for restaurado precisa usar "esqueci minha senha" pra entrar de novo.
async function baixarUsuarios(supabase) {
  const usuarios = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: PAGINA,
    });
    if (error) throw new Error(`auth.users: ${error.message}`);
    usuarios.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email,
        // user_metadata guarda nome/telefone/role escolhidos no cadastro
        // (ver handle_new_user no schema.sql) — sem isso o trigger de
        // recriação do profile não teria de onde tirar esses valores.
        user_metadata: u.user_metadata,
        created_at: u.created_at,
      }))
    );
    if (data.users.length < PAGINA) break;
  }
  return usuarios;
}

async function main() {
  const env = carregarEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no .env.local."
    );
  }
  if (url.includes("placeholder") || chave.includes("placeholder")) {
    throw new Error(
      "O .env.local ainda está com valores de exemplo (placeholder).\n" +
        "Coloque a URL e a service role key REAIS do projeto de produção\n" +
        "(Supabase > Settings > API) antes de rodar o backup."
    );
  }
  // Chave pública no lugar da secreta é o erro mais fácil de cometer (ficam
  // lado a lado no painel) e o mais perigoso: ela respeita RLS, então o
  // backup rodaria "com sucesso" e viria vazio, sem nenhum erro aparente.
  //
  // Dois formatos convivem hoje: o novo (sb_publishable_ / sb_secret_) e o
  // antigo, em que anon e service_role são AMBOS JWT começando com "eyJ" —
  // por isso o formato antigo precisa ser desempacotado pra saber o papel,
  // em vez de olhar só o prefixo.
  const publicaNova = chave.startsWith("sb_publishable_");
  const publicaLegada =
    chave.startsWith("eyJ") && papelDoJwt(chave) !== "service_role";
  if (publicaNova || publicaLegada) {
    throw new Error(
      "A chave configurada em SUPABASE_SERVICE_ROLE_KEY não é a secreta.\n" +
        "Ela respeita RLS, então o backup viria vazio sem dar erro.\n\n" +
        'Use Supabase > Settings > API > "Secret keys" (sb_secret_...),\n' +
        "clicando no olho pra revelar antes de copiar."
    );
  }

  const supabase = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const backup = { gerado_em: new Date().toISOString(), tabelas: {} };
  let total = 0;

  process.stdout.write("  auth.users... ");
  backup.usuarios = await baixarUsuarios(supabase);
  total += backup.usuarios.length;
  console.log(`${backup.usuarios.length} usuário(s)`);

  for (const tabela of TABELAS) {
    process.stdout.write(`  ${tabela}... `);
    const linhas = await baixarTabela(supabase, tabela);
    backup.tabelas[tabela] = linhas;
    total += linhas.length;
    console.log(`${linhas.length} linha(s)`);
  }

  mkdirSync("backups", { recursive: true });
  const nome = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const caminho = join("backups", nome);
  writeFileSync(caminho, JSON.stringify(backup, null, 2), "utf8");

  console.log(`\nPronto: ${caminho} (${total} linha(s) no total)`);

  // Rede de segurança final: um banco em produção com usuário real nunca
  // volta vazio. Se voltou, algo está errado (chave sem permissão, projeto
  // errado na URL) — e um arquivo vazio guardado como "backup" é pior que
  // não ter backup, porque passa uma sensação falsa de segurança.
  if (backup.usuarios.length === 0 || total === 0) {
    console.log(
      "\n*** ATENÇÃO: o backup saiu VAZIO. ***\n" +
        "Confira se a URL aponta pro projeto certo e se a chave é mesmo a\n" +
        "secreta. NÃO trate este arquivo como um backup válido."
    );
    return;
  }
  console.log(
    "\nATENÇÃO: isto salva os DADOS, não os arquivos do Storage.\n" +
      "Os materiais enviados aos pacientes (bucket materiais-paciente) precisam\n" +
      "ser baixados à parte, pelo painel do Supabase (Storage > materiais-paciente).\n" +
      "\nGuarde este arquivo FORA do computador (Drive, HD externo). Ele contém\n" +
      "prontuário e dado pessoal de paciente — trate como documento sigiloso."
  );
}

main().catch((err) => {
  console.error(`\nFalhou: ${err.message}`);
  process.exit(1);
});
