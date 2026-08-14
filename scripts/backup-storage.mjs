/**
 * Baixa os arquivos do Storage (bucket materiais-paciente) para
 * backups/storage/. Complementa scripts/backup.mjs, que salva só o banco —
 * os materiais enviados aos pacientes são arquivos, não linhas de tabela.
 *
 * Uso:
 *   node scripts/backup-storage.mjs
 *
 * Exige no .env.local os mesmos valores reais do backup do banco
 * (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const BUCKET = "materiais-paciente";

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

/**
 * O list() do Storage só enxerga um nível por vez, então a varredura é
 * recursiva. Um item sem "id" é pasta; com "id" é arquivo.
 */
async function listarRecursivo(supabase, prefixo = "") {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefixo, { limit: 1000 });
  if (error) throw new Error(`list(${prefixo || "/"}): ${error.message}`);

  const arquivos = [];
  for (const item of data) {
    const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
    if (item.id) {
      arquivos.push(caminho);
    } else {
      arquivos.push(...(await listarRecursivo(supabase, caminho)));
    }
  }
  return arquivos;
}

async function main() {
  const env = carregarEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave || url.includes("placeholder") || chave.includes("placeholder")) {
    throw new Error(
      "Coloque a URL e a secret key REAIS no .env.local antes de rodar."
    );
  }
  if (chave.startsWith("sb_publishable_")) {
    throw new Error(
      "A chave configurada é a publishable, não a secreta — o download viria vazio."
    );
  }

  const supabase = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Varrendo o bucket ${BUCKET}...`);
  const arquivos = await listarRecursivo(supabase);

  if (arquivos.length === 0) {
    console.log("Nenhum arquivo no bucket — nada a baixar.");
    return;
  }

  const destinoBase = join("backups", "storage");
  for (const caminho of arquivos) {
    process.stdout.write(`  ${caminho}... `);
    const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
    if (error) throw new Error(`${caminho}: ${error.message}`);

    const destino = join(destinoBase, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, Buffer.from(await data.arrayBuffer()));
    console.log("ok");
  }

  console.log(
    `\nPronto: ${arquivos.length} arquivo(s) em ${destinoBase}\n\n` +
      "Guarde junto com o backup do banco, FORA do computador. São materiais\n" +
      "de paciente — mesmo cuidado de sigilo."
  );
}

main().catch((err) => {
  console.error(`\nFalhou: ${err.message}`);
  process.exit(1);
});
