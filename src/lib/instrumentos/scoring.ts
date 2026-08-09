// Motor de pontuação dos instrumentos psicométricos. Puramente funcional e
// data-driven a partir do que já vem em `instrumentos.itens`/`instrumentos.faixas`
// (ver seed em schema.sql) — nada aqui é específico de PHQ-9/GAD-7/etc. por
// hardcode, exceto a regra do WHO-5 (soma bruta × 4), documentada abaixo.
// Compartilhado entre a página pública de resposta (/escala/[token]) e o
// lado do psicólogo (envio + exibição de resultado).

export type OpcaoResposta = { valor: number; label: string };

export type PerguntaInstrumento = {
  numero: number;
  texto: string;
  /** Só presente em instrumentos com múltiplas subescalas (ex.: DASS-21). */
  subescala?: string;
  /** Item de risco clínico (ex.: ideação suicida no PHQ-9) — resposta > 0 acende alerta. */
  alerta?: boolean;
};

export type ItensInstrumento = {
  instrucoes: string;
  opcoes: OpcaoResposta[];
  perguntas: PerguntaInstrumento[];
};

export type FaixaEscore = { min: number; max: number; rotulo: string };

/** Array simples (PHQ-9/GAD-7/WHO-5) ou um conjunto por subescala (DASS-21). */
export type FaixasInstrumento = FaixaEscore[] | Record<string, FaixaEscore[]>;

export type Instrumento = {
  id: string;
  sigla: string;
  nome: string;
  itens: ItensInstrumento;
  faixas: FaixasInstrumento;
  licenca: "livre" | "restrito_manual";
  fonte: string;
};

export type ResultadoSubescala = { escore: number; faixa: string };

export type ResultadoEscore = {
  /** Escore principal — pra DASS-21 é a soma das 3 subescalas, só de referência pro gráfico. */
  escore: number;
  /** Rótulo da faixa principal — vazio quando o instrumento só faz sentido por subescala (DASS-21). */
  faixa: string;
  /** Preenchido só em instrumentos com subescala (ex.: depressao/ansiedade/estresse do DASS-21). */
  detalhado: Record<string, ResultadoSubescala> | null;
  /** Resposta > 0 em algum item marcado "alerta" (ex.: item 9 do PHQ-9, ideação suicida). */
  alerta: boolean;
};

function faixaParaEscore(faixas: FaixaEscore[], escore: number): string {
  return faixas.find((f) => escore >= f.min && escore <= f.max)?.rotulo ?? "";
}

type InstrumentoParaCalculo = Pick<Instrumento, "sigla" | "itens" | "faixas">;

export function respostasCompletas(
  instrumento: InstrumentoParaCalculo,
  respostas: Record<number, number>
): boolean {
  return instrumento.itens.perguntas.every((p) => respostas[p.numero] !== undefined);
}

export function calcularEscore(
  instrumento: InstrumentoParaCalculo,
  respostas: Record<number, number>
): ResultadoEscore {
  const { perguntas } = instrumento.itens;
  const subescalas = Array.from(
    new Set(perguntas.map((p) => p.subescala).filter((s): s is string => !!s))
  );

  if (subescalas.length > 0) {
    const faixasPorSub = instrumento.faixas as Record<string, FaixaEscore[]>;
    const detalhado: Record<string, ResultadoSubescala> = {};
    let total = 0;
    for (const sub of subescalas) {
      // DASS-21: cada subescala tem 7 dos 21 itens; o escore final delas é a
      // soma × 2, pra ficar comparável às normas do DASS-42 original.
      const soma =
        perguntas
          .filter((p) => p.subescala === sub)
          .reduce((acc, p) => acc + (respostas[p.numero] ?? 0), 0) * 2;
      detalhado[sub] = { escore: soma, faixa: faixaParaEscore(faixasPorSub[sub] ?? [], soma) };
      total += soma;
    }
    return { escore: total, faixa: "", detalhado, alerta: false };
  }

  const somaBruta = perguntas.reduce((acc, p) => acc + (respostas[p.numero] ?? 0), 0);
  // WHO-5: escore bruto vai de 0-25, mas o índice oficial é reportado em 0-100.
  const escore = instrumento.sigla === "WHO-5" ? somaBruta * 4 : somaBruta;
  const alerta = perguntas.some((p) => p.alerta && (respostas[p.numero] ?? 0) > 0);

  return {
    escore,
    faixa: faixaParaEscore(instrumento.faixas as FaixaEscore[], escore),
    detalhado: null,
    alerta,
  };
}
