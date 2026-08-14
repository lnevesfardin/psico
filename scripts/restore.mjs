/**
 * Restaura um backup gerado por scripts/backup.mjs.
 *
 * ORDEM CORRETA de um restore completo:
 *   1. Criar um projeto Supabase novo (ou limpar o existente).
 *   2. Rodar o schema.sql inteiro no SQL Editor — este script NÃO cria
 *      tabela nenhuma, só repõe os dados.
 *   3. node scripts/restore.mjs backups/backup-....json
 *
 * Uso normal (e recomendado): restaurar num projeto de TESTE, pra conferir
 * que o backup presta. Backup que nunca foi restaurado não é backup.
 *
 * Limitação conhecida: senhas não são restauráveis (a API de admin do
 * Supabase não expõe nem aceita o hash). Os usuários voltam a existir com o
 * mesmo id/e-mail, mas precisam usar "esqueci minha senha" pra entrar.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

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
    env[limpa.slice(0, igual).trim()] = limpa
      .slice(igual + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

const LOTE = 500;

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    throw new Error("Informe o arquivo: node scripts/restore.mjs backups/backup-....json");
  }

  const backup = JSON.parse(readFileSync(arquivo, "utf8"));
  const env = carregarEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no .env.local."
    );
  }

  // Confirmação explícita: este script ESCREVE no banco apontado pelo
  // .env.local. Rodar sem querer contra produção sobrescreveria dado real de
  // paciente, então exigir a confirmação vale o incômodo.
  console.log(`Backup:  ${arquivo} (gerado em ${backup.gerado_em})`);
  console.log(`Destino: ${url}`);
  console.log("\nEste script vai ESCREVER nesse banco.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await rl.question('Digite "restaurar" para confirmar: ');
  rl.close();
  if (resposta.trim().toLowerCase() !== "restaurar") {
    console.log("Cancelado.");
    return;
  }

  const supabase = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Usuários primeiro: todo o resto depende deles por chave estrangeira.
  process.stdout.write("  auth.users... ");
  let usuariosOk = 0;
  for (const u of backup.usuarios ?? []) {
    const { error } = await supabase.auth.admin.createUser({
      // Preserva o id: é ele que aparece como psicologo_id/cliente_id em
      // todas as outras tabelas — gerar id novo quebraria todos os vínculos.
      id: u.id,
      email: u.email,
      user_metadata: u.user_metadata,
      email_confirm: true,
    });
    // "already registered" é esperado ao restaurar por cima de um banco que
    // já tem parte dos usuários — não é falha.
    if (error && !/already|exists|registered/i.test(error.message)) {
      throw new Error(`auth.users (${u.email}): ${error.message}`);
    }
    usuariosOk++;
  }
  console.log(`${usuariosOk} usuário(s)`);

  // 2. Tabelas, na ordem em que foram salvas (respeita chave estrangeira).
  for (const [tabela, linhas] of Object.entries(backup.tabelas)) {
    if (linhas.length === 0) {
      console.log(`  ${tabela}... vazia`);
      continue;
    }
    process.stdout.write(`  ${tabela}... `);
    for (let i = 0; i < linhas.length; i += LOTE) {
      const { error } = await supabase
        .from(tabela)
        .upsert(linhas.slice(i, i + LOTE));
      if (error) throw new Error(`${tabela}: ${error.message}`);
    }
    console.log(`${linhas.length} linha(s)`);
  }

  console.log(
    "\nRestore concluído.\n\n" +
      "Lembretes:\n" +
      "- Senhas NÃO são restauráveis: cada usuário precisa usar 'esqueci minha senha'.\n" +
      "- Arquivos do Storage (materiais-paciente) não entram aqui, restaure à parte.\n" +
      "- Confira no app se pacientes, agenda e prontuários aparecem certos."
  );
}

main().catch((err) => {
  console.error(`\nFalhou: ${err.message}`);
  process.exit(1);
});
