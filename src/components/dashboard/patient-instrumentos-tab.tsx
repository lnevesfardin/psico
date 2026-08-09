"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAplicacao,
  enviarInstrumento,
  listAplicacoesByPatient,
  listInstrumentos,
  registrarEscoreManual,
  type AplicacaoInstrumento,
} from "@/lib/instrumentos-client";
import { listPlanos, type Plano } from "@/lib/planos-terapeuticos-client";
import { calcularEscore, type Instrumento } from "@/lib/instrumentos/scoring";
import {
  InstrumentoEvolucaoChart,
  SERIE_CORES,
  type Marcador,
  type Serie,
  type SeriePonto,
} from "@/components/dashboard/instrumento-evolucao-chart";
import { formatDateShort, formatDateTime } from "@/lib/format";

const FAIXA_MAX_PADRAO: Record<string, number> = {
  "PHQ-9": 27,
  "GAD-7": 21,
  "WHO-5": 100,
  "DASS-21": 42,
};

export function PatientInstrumentosTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [aplicacoes, setAplicacoes] = useState<AplicacaoInstrumento[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [instrumentoId, setInstrumentoId] = useState("");
  const [expiraEmDias, setExpiraEmDias] = useState("7");
  const [escoreManual, setEscoreManual] = useState("");
  const [faixaManual, setFaixaManual] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      listInstrumentos(supabase),
      listAplicacoesByPatient(supabase, patientId),
      listPlanos(supabase, patientId),
    ])
      .then(([i, a, p]) => {
        setInstrumentos(i);
        setAplicacoes(a);
        setPlanos(p);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  const instrumentoSelecionado = instrumentos.find((i) => i.id === instrumentoId) ?? null;
  const instrumentoPorId = useMemo(
    () => new Map(instrumentos.map((i) => [i.id, i])),
    [instrumentos]
  );

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !instrumentoSelecionado) return;
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      if (instrumentoSelecionado.licenca === "livre") {
        const aplicacao = await enviarInstrumento(supabase, user.id, {
          patientId,
          instrumentoId: instrumentoSelecionado.id,
          expiraEmDias: expiraEmDias ? Number(expiraEmDias) : null,
        });
        setAplicacoes((prev) => [aplicacao, ...prev]);
        setLinkGerado(`${window.location.origin}/escala/${aplicacao.tokenPublico}`);
      } else {
        const escore = Number(escoreManual);
        if (Number.isNaN(escore) || !faixaManual.trim()) {
          throw new Error("Informe o escore e a faixa/classificação.");
        }
        const aplicacao = await registrarEscoreManual(supabase, user.id, {
          patientId,
          instrumentoId: instrumentoSelecionado.id,
          escore,
          faixa: faixaManual.trim(),
        });
        setAplicacoes((prev) => [aplicacao, ...prev]);
        setFormOpen(false);
        setEscoreManual("");
        setFaixaManual("");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar a escala.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Apagar esta aplicação? Não pode ser desfeito.");
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      await deleteAplicacao(supabase, id);
      setAplicacoes((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopy(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  function fecharForm() {
    setFormOpen(false);
    setInstrumentoId("");
    setLinkGerado(null);
    setErro(null);
  }

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  // Um gráfico por instrumento respondido — escores de PHQ-9 e WHO-5, por
  // exemplo, não são comparáveis na mesma escala.
  const gruposRespondidos = new Map<string, AplicacaoInstrumento[]>();
  for (const a of aplicacoes) {
    if (!a.respondidoEm) continue;
    const lista = gruposRespondidos.get(a.instrumentoId) ?? [];
    lista.push(a);
    gruposRespondidos.set(a.instrumentoId, lista);
  }

  const marcadores: Marcador[] = [];
  const planosOrdenados = [...planos].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  if (planosOrdenados.length > 0) {
    marcadores.push({ date: planosOrdenados[0].createdAt.slice(0, 10), label: "Início do plano" });
  }
  for (const p of planos) {
    if (p.revisarEm) marcadores.push({ date: p.revisarEm, label: "Revisão" });
  }

  return (
    <div className="mt-6 space-y-6">
      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nova escala
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {linkGerado ? (
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                Link gerado — envie para o paciente responder:
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950/50">
                <code className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                  {linkGerado}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(linkGerado)}
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Copiar link"
                >
                  {copiado ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={fecharForm}
                className="mt-4 w-full rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Concluir
              </button>
            </div>
          ) : (
            <form onSubmit={handleEnviar} className="space-y-3">
              {erro && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                  {erro}
                </div>
              )}
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Instrumento
                <select
                  required
                  value={instrumentoId}
                  onChange={(e) => setInstrumentoId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {instrumentos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sigla} — {i.nome}
                    </option>
                  ))}
                </select>
              </label>

              {instrumentoSelecionado?.licenca === "livre" && (
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Link expira em (dias, opcional)
                  <input
                    type="number"
                    min={1}
                    value={expiraEmDias}
                    onChange={(e) => setExpiraEmDias(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </label>
              )}

              {instrumentoSelecionado?.licenca === "restrito_manual" && (
                <>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Este instrumento é de uso restrito — o app não reproduz os itens. Aplique-o
                    fora do sistema e registre só o resultado abaixo.
                  </p>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Escore
                    <input
                      type="number"
                      required
                      value={escoreManual}
                      onChange={(e) => setEscoreManual(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Faixa / classificação
                    <input
                      type="text"
                      required
                      value={faixaManual}
                      onChange={(e) => setFaixaManual(e.target.value)}
                      placeholder="Ex.: Depressão moderada"
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </label>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={fecharForm}
                  className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !instrumentoSelecionado}
                  className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Salvando..."
                    : instrumentoSelecionado?.licenca === "restrito_manual"
                      ? "Registrar"
                      : "Gerar link"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {Array.from(gruposRespondidos.entries()).map(([instId, lista]) => {
        const instrumento = instrumentoPorId.get(instId);
        if (!instrumento) return null;
        const temSubescalas = lista.some((a) => a.resultadoDetalhado);
        const series: Serie[] = temSubescalas
          ? Object.keys(SERIE_CORES).map((key) => ({
              key,
              label: key.charAt(0).toUpperCase() + key.slice(1),
              ...SERIE_CORES[key],
            }))
          : [
              {
                key: "escore",
                label: instrumento.sigla,
                strokeClass: "stroke-brand-500 dark:stroke-brand-400",
                fillClass: "fill-brand-600 dark:fill-brand-400",
              },
            ];
        const pontosPorSerie: Record<string, SeriePonto[]> = {};
        for (const s of series) {
          pontosPorSerie[s.key] = lista
            .filter((a) => a.respondidoEm)
            .map((a) => {
              const escore = temSubescalas ? (a.resultadoDetalhado?.[s.key]?.escore ?? 0) : (a.escore ?? 0);
              const faixa = temSubescalas ? (a.resultadoDetalhado?.[s.key]?.faixa ?? "") : (a.faixa ?? "");
              return { date: a.respondidoEm!.slice(0, 10), escore, faixa };
            });
        }
        return (
          <div key={instId}>
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
              Evolução — {instrumento.nome}
            </h3>
            <InstrumentoEvolucaoChart
              series={series}
              pontosPorSerie={pontosPorSerie}
              marcadores={marcadores}
              escoreMax={FAIXA_MAX_PADRAO[instrumento.sigla] ?? 100}
            />
          </div>
        );
      })}

      <div className="space-y-2">
        {aplicacoes.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            Nenhuma escala enviada ainda.
          </p>
        )}
        {aplicacoes.map((a) => {
          const instrumento = instrumentoPorId.get(a.instrumentoId);
          const alerta =
            instrumento && a.respostas
              ? calcularEscore(instrumento, a.respostas).alerta
              : false;
          const expirada = a.expiraEm ? new Date(a.expiraEm) < new Date() : false;
          const link = a.tokenPublico ? `${typeof window !== "undefined" ? window.location.origin : ""}/escala/${a.tokenPublico}` : null;

          return (
            <div
              key={a.id}
              className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
                    {a.instrumentoSigla} — {a.instrumentoNome}
                    {alerta && (
                      <span
                        title="Resposta de atenção em item de risco"
                        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Atenção
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                    Enviada em {formatDateTime(a.enviadoEm)}
                  </p>
                  {a.respondidoEm ? (
                    <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      Respondida em {formatDateShort(a.respondidoEm)} — escore{" "}
                      <strong>{a.escore}</strong> ({a.faixa})
                    </p>
                  ) : expirada ? (
                    <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-600">Link expirado</p>
                  ) : link ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Aguardando resposta
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(link)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        <Copy className="h-3 w-3" />
                        Copiar link
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  aria-label="Apagar aplicação"
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
