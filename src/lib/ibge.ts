// API pública do IBGE (sem chave, sem custo) — usada só pra montar o select
// em cascata de cidade a partir do estado no endereço do consultório.
// Documentação: https://servicodados.ibge.gov.br/api/docs/localidades

type MunicipioIbge = { nome: string };

export async function fetchMunicipios(uf: string): Promise<string[]> {
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  );
  if (!res.ok) throw new Error("Não foi possível carregar as cidades.");
  const data = (await res.json()) as MunicipioIbge[];
  return data.map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
