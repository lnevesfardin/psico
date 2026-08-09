"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Printer, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { listLancamentos } from "@/lib/financeiro-client";
import { emitirRecibo, listRecibos } from "@/lib/recibos-client";
import type { Patient, Recibo } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort, todayIso } from "@/lib/format";

export function RecibosTab({ patients }: { patients: Patient[] }) {
  const { user } = useAuth();
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loteOpen, setLoteOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listRecibos(supabase, user.id)
      .then(setRecibos)
      .finally(() => setLoading(false));
  }, [user]);

  function nomeDoPaciente(patientId: string) {
    return patients.find((p) => p.id === patientId)?.name ?? "—";
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Emitir recibo
        </button>
        <button
          type="button"
          onClick={() => setLoteOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Users className="h-4 w-4" />
          Emitir em lote (mês)
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {loading && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            Carregando...
          </p>
        )}
        {!loading && recibos.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            Nenhum recibo emitido ainda.
          </p>
        )}
        {recibos.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/financeiro/recibos/${r.id}`}
            className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-white">
                Recibo nº {r.numero} · {nomeDoPaciente(r.patientId)}
              </p>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {formatDateShort(r.competenciaInicio)} a {formatDateShort(r.competenciaFim)} ·{" "}
                {r.quantidadeSessoes} sessão(ões)
              </p>
            </div>
            <p className="shrink-0 font-semibold text-zinc-900 dark:text-white">
              {formatCurrency(r.valorTotal)}
            </p>
            <Printer className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-700" />
          </Link>
        ))}
      </div>

      {modalOpen && (
        <NovoReciboModal
          patients={patients}
          onClose={() => setModalOpen(false)}
          onEmitted={(r) => {
            setRecibos((prev) => [r, ...prev]);
            setModalOpen(false);
          }}
        />
      )}

      {loteOpen && user && (
        <EmitirEmLoteModal
          psicologoId={user.id}
          patients={patients}
          onClose={() => setLoteOpen(false)}
          onEmitted={(novos) => {
            setRecibos((prev) => [...novos, ...prev]);
            setLoteOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NovoReciboModal({
  patients,
  onClose,
  onEmitted,
}: {
  patients: Patient[];
  onClose: () => void;
  onEmitted: (recibo: Recibo) => void;
}) {
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [competenciaInicio, setCompetenciaInicio] = useState(todayIso().slice(0, 8) + "01");
  const [competenciaFim, setCompetenciaFim] = useState(todayIso());
  const [valorTotal, setValorTotal] = useState("");
  const [quantidadeSessoes, setQuantidadeSessoes] = useState("1");
  const [pagadorNome, setPagadorNome] = useState("");
  const [pagadorCpf, setPagadorCpf] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePatientChange(id: string) {
    setPatientId(id);
    const patient = patients.find((p) => p.id === id);
    if (patient) {
      // Pagador pode ser o responsável legal (paciente menor de idade).
      setPagadorNome(patient.responsavel.nome || patient.nomeSocial || patient.name);
      setPagadorCpf(patient.responsavel.cpf || patient.cpf);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const valor = Number(valorTotal.replace(",", "."));
    const sessoes = Number(quantidadeSessoes);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!pagadorNome.trim() || !pagadorCpf.trim()) {
      setError("Nome e CPF do pagador são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const recibo = await emitirRecibo(supabase, {
        patientId,
        competenciaInicio,
        competenciaFim,
        valorTotal: valor,
        quantidadeSessoes: sessoes,
        pagadorNome: pagadorNome.trim(),
        pagadorCpf: pagadorCpf.trim(),
      });
      onEmitted(recibo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível emitir o recibo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Emitir recibo</h3>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Paciente
            <select
              value={patientId}
              onChange={(e) => handlePatientChange(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Competência início
              <input
                type="date"
                required
                value={competenciaInicio}
                onChange={(e) => setCompetenciaInicio(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Competência fim
              <input
                type="date"
                required
                value={competenciaFim}
                onChange={(e) => setCompetenciaFim(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Valor total (R$)
              <input
                type="text"
                inputMode="decimal"
                required
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="600,00"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Qtd. sessões
              <input
                type="number"
                min={1}
                required
                value={quantidadeSessoes}
                onChange={(e) => setQuantidadeSessoes(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nome do pagador
            <input
              type="text"
              required
              value={pagadorNome}
              onChange={(e) => setPagadorNome(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            CPF do pagador
            <input
              type="text"
              required
              value={pagadorCpf}
              onChange={(e) => setPagadorCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Emitindo..." : "Emitir"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EmitirEmLoteModal({
  psicologoId,
  patients,
  onClose,
  onEmitted,
}: {
  psicologoId: string;
  patients: Patient[];
  onClose: () => void;
  onEmitted: (recibos: Recibo[]) => void;
}) {
  const [mes, setMes] = useState(todayIso().slice(0, 7)); // yyyy-mm
  const [processing, setProcessing] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function handleEmitir() {
    setProcessing(true);
    setResultado(null);
    try {
      const supabase = createClient();
      const inicio = `${mes}-01`;
      const ultimoDia = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
      const fim = `${mes}-${String(ultimoDia).padStart(2, "0")}`;

      const lancamentos = await listLancamentos(supabase, psicologoId, {
        tipo: "receita",
        status: "pago",
        periodoInicio: inicio,
        periodoFim: fim,
      });

      const porPaciente = new Map<string, { total: number; sessoes: number }>();
      for (const l of lancamentos) {
        if (!l.patientId) continue;
        const atual = porPaciente.get(l.patientId) ?? { total: 0, sessoes: 0 };
        atual.total += l.valor;
        atual.sessoes += 1;
        porPaciente.set(l.patientId, atual);
      }

      const emitidos: Recibo[] = [];
      for (const [patientId, dados] of porPaciente) {
        const patient = patients.find((p) => p.id === patientId);
        if (!patient) continue;
        const pagadorNome = patient.responsavel.nome || patient.nomeSocial || patient.name;
        const pagadorCpf = patient.responsavel.cpf || patient.cpf;
        if (!pagadorCpf) continue; // recibo exige CPF — pula paciente sem CPF cadastrado
        const recibo = await emitirRecibo(supabase, {
          patientId,
          competenciaInicio: inicio,
          competenciaFim: fim,
          valorTotal: dados.total,
          quantidadeSessoes: dados.sessoes,
          pagadorNome,
          pagadorCpf,
        });
        emitidos.push(recibo);
      }

      setResultado(
        emitidos.length > 0
          ? `${emitidos.length} recibo(s) emitido(s).`
          : "Nenhum recebimento pago nesse mês para emitir recibo."
      );
      if (emitidos.length > 0) onEmitted(emitidos);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Emitir em lote</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Um recibo por paciente, somando os recebimentos pagos no mês.
          Pacientes sem CPF cadastrado são pulados.
        </p>

        <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Mês de competência
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>

        {resultado && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{resultado}</p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleEmitir}
            disabled={processing}
            className="flex-1 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? "Emitindo..." : "Emitir recibos"}
          </button>
        </div>
      </div>
    </div>
  );
}
