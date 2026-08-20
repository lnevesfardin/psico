"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { listPatients } from "@/lib/patients-client";
import {
  addListaEspera,
  listListaEspera,
  removeListaEspera,
  updateStatusListaEspera,
  type EntradaListaEspera,
} from "@/lib/lista-espera-client";
import type { Patient } from "@/lib/dashboard-data";
import { formatDateShort, toWhatsappLink } from "@/lib/format";

/**
 * Lista que o psicólogo mantém manualmente pra saber quem quer uma vaga
 * quando a agenda está cheia. De propósito não tenta casar automaticamente
 * com o horário que abriu numa consulta desmarcada — quem decide quem
 * chamar, e quando, continua sendo o psicólogo; a lista só organiza a fila.
 */
export function ListaEsperaPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [entradas, setEntradas] = useState<EntradaListaEspera[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarAtendidos, setMostrarAtendidos] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([listListaEspera(supabase, user.id), listPatients(supabase, user.id)])
      .then(([lista, pac]) => {
        setEntradas(lista);
        setPatients(pac);
      })
      .catch(() => setError("Não foi possível carregar a lista de espera."))
      .finally(() => setCarregando(false));
  }, [user]);

  function marcarPendente(id: string, pendente: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pendente) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelecionarPaciente(id: string) {
    setPatientId(id);
    const patient = patients.find((p) => p.id === id);
    if (patient) {
      setNome(patient.name);
      setTelefone(patient.phone);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nome.trim()) return;
    setSalvando(true);
    setError(null);
    try {
      const supabase = createClient();
      const nova = await addListaEspera(supabase, user.id, {
        patientId: patientId || null,
        nome: nome.trim(),
        telefone,
        observacao: observacao.trim(),
      });
      setEntradas((prev) => [...prev, nova]);
      setPatientId("");
      setNome("");
      setTelefone("");
      setObservacao("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível adicionar."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function handleAtendido(id: string) {
    marcarPendente(id, true);
    try {
      const supabase = createClient();
      await updateStatusListaEspera(supabase, id, "atendido");
      setEntradas((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "atendido" } : e))
      );
    } catch {
      setError("Não foi possível atualizar essa entrada.");
    } finally {
      marcarPendente(id, false);
    }
  }

  async function handleRemover(id: string) {
    marcarPendente(id, true);
    try {
      const supabase = createClient();
      await removeListaEspera(supabase, id);
      setEntradas((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("Não foi possível remover essa entrada.");
      marcarPendente(id, false);
    }
  }

  const aguardando = entradas.filter((e) => e.status === "aguardando");
  const atendidos = entradas.filter((e) => e.status === "atendido");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            <Clock className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            Lista de Espera
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Quem está esperando uma vaga abrir. Avise por fora (telefone,
          WhatsApp) e marque como atendido quando encaixar.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <form
          onSubmit={handleAdd}
          className="mt-4 space-y-3 rounded-xl border border-dashed border-zinc-200 p-4 dark:border-zinc-700"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Paciente (opcional)
              <select
                value={patientId}
                onChange={(e) => handleSelecionarPaciente(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">— Sem ficha —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nome
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Telefone (opcional)
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Observação (opcional)
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: prefere manhãs de terça"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={salvando || !nome.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar à lista
          </button>
        </form>

        <div className="mt-5">
          {carregando ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </p>
          ) : aguardando.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              <UserRoundPlus className="mx-auto mb-2 h-5 w-5" />
              Ninguém esperando vaga no momento.
            </p>
          ) : (
            <ul className="space-y-2">
              {aguardando.map((entrada) => (
                <LinhaEntrada
                  key={entrada.id}
                  entrada={entrada}
                  pendente={pendingIds.has(entrada.id)}
                  onAtendido={() => handleAtendido(entrada.id)}
                  onRemover={() => handleRemover(entrada.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {atendidos.length > 0 && (
          <div className="mt-5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setMostrarAtendidos((v) => !v)}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              {mostrarAtendidos ? "Ocultar" : "Ver"} atendidos (
              {atendidos.length})
            </button>
            {mostrarAtendidos && (
              <ul className="mt-3 space-y-2">
                {atendidos.map((entrada) => (
                  <LinhaEntrada
                    key={entrada.id}
                    entrada={entrada}
                    pendente={pendingIds.has(entrada.id)}
                    onRemover={() => handleRemover(entrada.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LinhaEntrada({
  entrada,
  pendente,
  onAtendido,
  onRemover,
}: {
  entrada: EntradaListaEspera;
  pendente: boolean;
  onAtendido?: () => void;
  onRemover: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            entrada.status === "atendido"
              ? "text-zinc-400 line-through dark:text-zinc-600"
              : "text-zinc-900 dark:text-white"
          }`}
        >
          {entrada.nome}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
          Desde {formatDateShort(entrada.createdAt)}
          {entrada.observacao && ` · ${entrada.observacao}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {entrada.telefone && entrada.status === "aguardando" && (
          <a
            href={toWhatsappLink(entrada.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            title="Chamar no WhatsApp"
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        {onAtendido && (
          <button
            type="button"
            onClick={onAtendido}
            disabled={pendente}
            title="Marcar como atendido"
            className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-950/40"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemover}
          disabled={pendente}
          title="Remover da lista"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
