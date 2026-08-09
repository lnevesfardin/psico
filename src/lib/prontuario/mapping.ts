import type { Adendo, FormatoEvolucao, SessionNote, StatusEvolucao } from "@/lib/dashboard-data";

// Compartilhado entre src/lib/patients-client.ts (tipos/consumo no client) e
// os route handlers de src/app/api/prontuario/* (mesma forma de linha,
// convertida dos dois lados) — evita duas cópias divergentes do mapeamento
// coluna-a-campo.

export type SessaoRow = {
  id: string;
  conteudo: string;
  data_hora: string;
  origem: SessionNote["origem"];
  formato: FormatoEvolucao;
  status: StatusEvolucao;
  assinado_em: string | null;
  agendamento_id: string | null;
  gerado_por_ia: boolean;
};

export const SESSAO_COLUMNS =
  "id, conteudo, data_hora, origem, formato, status, assinado_em, agendamento_id, gerado_por_ia";

export function rowToSessionNote(row: SessaoRow, adendos: Adendo[] = []): SessionNote {
  return {
    id: row.id,
    content: row.conteudo,
    dateTime: row.data_hora,
    origem: row.origem ?? "manual",
    formato: row.formato ?? "livre",
    status: row.status ?? "rascunho",
    assinadoEm: row.assinado_em,
    agendamentoId: row.agendamento_id,
    geradoPorIa: row.gerado_por_ia ?? false,
    adendos,
  };
}

export type AdendoRow = {
  id: string;
  evolucao_id: string;
  texto: string;
  motivo: string | null;
  created_at: string;
};

export function rowToAdendo(row: AdendoRow): Adendo {
  return {
    id: row.id,
    evolucaoId: row.evolucao_id,
    texto: row.texto,
    motivo: row.motivo,
    createdAt: row.created_at,
  };
}
