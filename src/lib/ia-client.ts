// Wrappers finos pros route handlers de src/app/api/gemini/* — nenhuma
// chave de API aqui, é só fetch pra rota que roda no servidor (ver
// src/lib/ia/guards.ts pras travas de verdade). Todo erro de negócio (IA
// desligada na org, paciente sem consentimento etc.) chega como
// `{ error: string }` no corpo com status 4xx — reempacotado aqui como
// Error pra UI mostrar direto.

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? "Não foi possível completar a solicitação.");
  }
  return data as T;
}

export async function gerarRascunhoEvolucao(input: {
  patientId: string;
  anotacoes: string;
  formato: "dap" | "soap";
}): Promise<Record<string, string>> {
  const { campos } = await postJson<{ campos: Record<string, string> }>(
    "/api/gemini/rascunho-evolucao",
    input
  );
  return campos;
}

export async function gerarResumoPreSessao(patientId: string): Promise<string> {
  const { resumo } = await postJson<{ resumo: string }>("/api/gemini/resumo-pre-sessao", {
    patientId,
  });
  return resumo;
}

export async function identificarTemasRecorrentes(patientId: string): Promise<string[]> {
  const { temas } = await postJson<{ temas: string[] }>("/api/gemini/temas-recorrentes", {
    patientId,
  });
  return temas;
}

export type TipoAssistenteAdministrativo = "remarcacao" | "orientacao" | "tarefa_casa";

export async function gerarTextoAdministrativo(input: {
  patientId: string;
  tipo: TipoAssistenteAdministrativo;
  contexto: string;
}): Promise<string> {
  const { texto } = await postJson<{ texto: string }>("/api/gemini/assistente-administrativo", input);
  return texto;
}
