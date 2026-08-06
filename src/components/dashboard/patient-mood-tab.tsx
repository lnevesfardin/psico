"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Link2, Unlink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { unlinkPatientFromClient } from "@/lib/patients-client";
import { gerarConvitePaciente } from "@/lib/convites-client";
import { listMoodCheckins, type MoodCheckin } from "@/lib/mood-client";
import { detectLowMoodStreak } from "@/lib/mood-insights";
import { MoodChart } from "@/components/mood/mood-chart";
import { MoodInsightsPanel } from "@/components/mood/mood-insights-panel";
import { PatientHabitsSection } from "@/components/dashboard/patient-habits-section";
import { PatientDiarySection } from "@/components/dashboard/patient-diary-section";
import { formatDateShort } from "@/lib/format";
import type { Patient } from "@/lib/dashboard-data";

export function PatientMoodTab({
  patient,
  onUnlinked,
}: {
  patient: Patient;
  onUnlinked: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [conviteUrl, setConviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  async function handleGerarConvite() {
    setLinking(true);
    setLinkError(null);
    try {
      const supabase = createClient();
      const token = await gerarConvitePaciente(supabase, patient.id);
      setConviteUrl(`${window.location.origin}/convite/${token}`);
    } catch (err) {
      // Mensagem crua quando não for uma das conhecidas da RPC: sem isso não
      // dá pra diagnosticar pela tela (ex.: schema.sql ainda não reexecutado
      // no Supabase, então a função nem existe).
      const msg = err instanceof Error ? err.message : "";
      setLinkError(msg || "Não foi possível gerar o link. Tente novamente.");
    } finally {
      setLinking(false);
    }
  }

  async function handleCopy() {
    if (!conviteUrl) return;
    try {
      await navigator.clipboard.writeText(conviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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
      onUnlinked();
    } finally {
      setUnlinking(false);
    }
  }

  if (!patient.clienteUserId) {
    return (
      <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <Link2 className="h-4 w-4" />
          Convidar {patient.name.split(" ")[0]} a criar uma conta
        </div>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Envie este link para o paciente criar a conta dele. Com ela, ele
          acompanha os próprios agendamentos e registra como está se sentindo —
          e o check-in de humor aparece aqui pra você.
        </p>

        {conviteUrl ? (
          <div className="mt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                readOnly
                value={conviteUrl}
                className="w-full flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              O link vale para uma única conta e deixa de funcionar assim que o
              paciente terminar o cadastro.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGerarConvite}
            disabled={linking}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {linking ? "Gerando..." : "Gerar link de convite"}
          </button>
        )}

        {linkError && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {linkError}
          </div>
        )}
      </div>

      {/* Configurável antes de o paciente ter conta: assim, quando ele
          entrar pelo convite, já encontra a rotina montada. */}
      <PatientHabitsSection pacienteId={patient.id} clienteUserId={null} />
      </div>
    );
  }

  const streak = detectLowMoodStreak(checkins);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <span className="text-zinc-600 dark:text-zinc-400">
          Este paciente já tem{" "}
          <strong className="text-zinc-900 dark:text-white">conta própria</strong>{" "}
          e está compartilhando o humor
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

      <PatientHabitsSection
        pacienteId={patient.id}
        clienteUserId={patient.clienteUserId}
      />
      <PatientDiarySection clienteUserId={patient.clienteUserId} />
    </div>
  );
}
