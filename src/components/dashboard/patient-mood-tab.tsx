"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Link2, Unlink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { linkPatientToClient, unlinkPatientFromClient } from "@/lib/patients-client";
import { listMoodCheckins, type MoodCheckin } from "@/lib/mood-client";
import { detectLowMoodStreak } from "@/lib/mood-insights";
import { MoodChart } from "@/components/mood/mood-chart";
import { MoodInsightsPanel } from "@/components/mood/mood-insights-panel";
import { formatDateShort } from "@/lib/format";
import type { Patient } from "@/lib/dashboard-data";

export function PatientMoodTab({
  patient,
  onLinked,
  onUnlinked,
}: {
  patient: Patient;
  onLinked: (clienteUserId: string) => void;
  onUnlinked: () => void;
}) {
  const [email, setEmail] = useState(patient.email);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (!patient.clienteUserId) return;
    const supabase = createClient();
    listMoodCheckins(supabase, patient.clienteUserId)
      .then(setCheckins)
      .finally(() => setLoading(false));
  }, [patient.clienteUserId]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLinking(true);
    setLinkError(null);
    try {
      const supabase = createClient();
      const result = await linkPatientToClient(supabase, patient.id, email);
      setClienteNome(result.clienteNome);
      onLinked(result.clienteUserId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setLinkError(
        msg.includes("Não encontramos") || msg.includes("já está vinculada")
          ? msg
          : "Não foi possível vincular. Tente novamente."
      );
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    const confirmed = window.confirm(
      "Desvincular esta conta de cliente? Você deixará de ver o humor deste paciente até vincular de novo."
    );
    if (!confirmed) return;
    setUnlinking(true);
    try {
      const supabase = createClient();
      await unlinkPatientFromClient(supabase, patient.id);
      setCheckins([]);
      setClienteNome(null);
      onUnlinked();
    } finally {
      setUnlinking(false);
    }
  }

  if (!patient.clienteUserId) {
    return (
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <Link2 className="h-4 w-4" />
          Vincular conta do cliente
        </div>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Vincule este paciente à conta que ele usa pra fazer login no site
          pra acompanhar o check-in de humor dele aqui.
        </p>
        <form onSubmit={handleLink} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={linking}
            className="shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {linking ? "Vinculando..." : "Vincular conta"}
          </button>
        </form>
        {linkError && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {linkError}
          </div>
        )}
      </div>
    );
  }

  const streak = detectLowMoodStreak(checkins);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <span className="text-zinc-600 dark:text-zinc-400">
          Vinculado a{" "}
          <strong className="text-zinc-900 dark:text-white">
            {clienteNome ?? "uma conta de cliente"}
          </strong>
        </span>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={unlinking}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-rose-600 disabled:cursor-not-allowed dark:hover:text-rose-400"
        >
          <Unlink className="h-3.5 w-3.5" />
          {unlinking ? "Desvinculando..." : "Desvincular"}
        </button>
      </div>

      {streak && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="text-sm text-rose-800 dark:text-rose-200">
            Este paciente registrou humor &quot;Muito Ruim&quot; por{" "}
            {streak.streakDays} dias seguidos ({formatDateShort(streak.startDate)}{" "}
            a {formatDateShort(streak.endDate)}).
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
      ) : (
        <>
          <MoodChart checkins={checkins} />
          <MoodInsightsPanel checkins={checkins} />
        </>
      )}
    </div>
  );
}
