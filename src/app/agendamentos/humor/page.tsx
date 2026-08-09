"use client";

import { useEffect, useState } from "react";
import { Share2, ShieldOff } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  listMoodCheckins,
  upsertTodayCheckin,
  type MoodCheckin,
  type MoodLevel,
  type MoodTag,
} from "@/lib/mood-client";
import {
  listMoodSharing,
  stopSharingMood,
  type MoodSharing,
} from "@/lib/mood-sharing-client";
import { todayIso } from "@/lib/format";
import { MoodSelector } from "@/components/mood/mood-selector";
import { MoodSupportCard } from "@/components/mood/mood-support-card";
import { PositiveReflectionCard } from "@/components/mood/positive-reflection-card";
import { TagEnergyPicker } from "@/components/mood/tag-energy-picker";
import { MoodChart } from "@/components/mood/mood-chart";
import { MoodInsightsPanel } from "@/components/mood/mood-insights-panel";
import { RotinaDoDia } from "@/components/mood/rotina-do-dia";

export default function HumorPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<MoodCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [energy, setEnergy] = useState<MoodLevel>(3);
  const [anxiety, setAnxiety] = useState<MoodLevel | null>(null);
  const [sleepHours, setSleepHours] = useState("");
  const [tags, setTags] = useState<MoodTag[]>([]);
  const [positiveNote, setPositiveNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<MoodSharing[]>([]);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listMoodCheckins(supabase, user.id)
      .then((entries) => {
        setHistory(entries);
        const today = entries.find((e) => e.date === todayIso());
        if (today) {
          setMood(today.mood);
          setEnergy(today.energy);
          setAnxiety(today.anxiety);
          setSleepHours(today.sleepHours != null ? String(today.sleepHours) : "");
          setTags(today.tags);
          setPositiveNote(today.positiveNote);
        }
      })
      .finally(() => setLoading(false));
    listMoodSharing(supabase).then(setSharing).catch(() => {});
  }, [user]);

  async function handleStopSharing(item: MoodSharing) {
    const confirmed = window.confirm(
      `Parar de compartilhar seu check-in de humor com ${item.psicologoNome}? Ele(a) será avisado(a) e deixará de ver seus registros de humor.`
    );
    if (!confirmed) return;
    setStoppingId(item.pacienteId);
    setShareError(null);
    try {
      const supabase = createClient();
      await stopSharingMood(supabase, item.pacienteId);
      setSharing((prev) => prev.filter((s) => s.pacienteId !== item.pacienteId));
    } catch (err) {
      setShareError(
        err instanceof Error ? err.message : "Não foi possível parar de compartilhar."
      );
    } finally {
      setStoppingId(null);
    }
  }

  async function handleSave() {
    if (!user || !mood) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const sleepHoursNumber = sleepHours.trim() ? Number(sleepHours.replace(",", ".")) : null;
      const entry = await upsertTodayCheckin(supabase, user.id, {
        mood,
        energy,
        anxiety,
        sleepHours: sleepHoursNumber != null && Number.isFinite(sleepHoursNumber) ? sleepHoursNumber : null,
        tags,
        positiveNote,
      });
      setHistory((prev) => [entry, ...prev.filter((e) => e.date !== entry.date)]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Não foi possível salvar seu check-in. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Como você está hoje?
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Um check-in rápido pra acompanhar seu bem-estar ao longo do tempo.
      </p>

      <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {sharing.length > 0 ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
              <Share2 className="h-4 w-4" />
              Compartilhando seu humor
            </div>
            <div className="mt-3 space-y-2">
              {sharing.map((item) => (
                <div
                  key={item.pacienteId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 px-3 py-2 dark:bg-brand-950/40"
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {item.psicologoNome}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStopSharing(item)}
                    disabled={stoppingId === item.pacienteId}
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-rose-600 transition-colors hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:text-rose-300"
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    {stoppingId === item.pacienteId
                      ? "Parando..."
                      : "Parar de compartilhar"}
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <ShieldOff className="h-4 w-4 shrink-0" />
            Seu humor não está sendo compartilhado com nenhum psicólogo no
            momento.
          </div>
        )}
        {shareError && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {shareError}
          </div>
        )}
      </div>

      {user && (
        <div className="mt-4">
          <RotinaDoDia clienteId={user.id} />
        </div>
      )}

      <div className="mt-6">
        <MoodSelector value={mood} onChange={setMood} />
      </div>

      {mood !== null && mood <= 2 && (
        <div className="mt-4">
          <MoodSupportCard severe={mood === 1} />
        </div>
      )}
      {mood !== null && mood >= 4 && (
        <div className="mt-4">
          <PositiveReflectionCard value={positiveNote} onChange={setPositiveNote} />
        </div>
      )}

      {mood !== null && (
        <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <TagEnergyPicker
            tags={tags}
            onTagsChange={setTags}
            energy={energy}
            onEnergyChange={setEnergy}
          />

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ansiedade
              </span>
              <div className="mt-1.5 flex gap-1">
                {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAnxiety(level)}
                    aria-label={`Ansiedade ${level}`}
                    className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-colors ${
                      anxiety === level
                        ? "bg-brand-600 text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Horas de sono
              <input
                type="text"
                inputMode="decimal"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="7,5"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : saved ? "Check-in salvo!" : "Salvar check-in"}
          </button>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Seu histórico
        </h2>
        <div className="mt-3">
          <MoodChart checkins={history} />
        </div>
        <div className="mt-4">
          <MoodInsightsPanel checkins={history} />
        </div>
      </div>
    </div>
  );
}
