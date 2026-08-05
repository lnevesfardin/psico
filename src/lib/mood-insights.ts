import { todayIso } from "@/lib/format";
import { MOOD_TAGS, type MoodCheckin, type MoodLevel, type MoodTag } from "@/lib/mood-client";

// Estatística pura sobre os check-ins já carregados — sem chamada a
// Supabase, sem LLM. Limiares deliberadamente conservadores: com poucos
// dados um "padrão" é só ruído, e mostrar isso como se fosse confiável
// mina a confiança na ferramenta inteira.
const MIN_TOTAL_CHECKINS = 14;
const MIN_PER_WEEKDAY = 3;
const WEEKDAY_GAP_THRESHOLD = 0.6; // em escala 1-5
const MIN_TAG_SAMPLES = 5;
const TAG_DELTA_THRESHOLD = 0.75;
const MAX_TAG_INSIGHTS = 3;

const WEEKDAY_NAMES = [
  "domingos",
  "segundas-feiras",
  "terças-feiras",
  "quartas-feiras",
  "quintas-feiras",
  "sextas-feiras",
  "sábados",
];

const TAG_LABELS: Record<MoodTag, string> = Object.fromEntries(
  MOOD_TAGS.map((t) => [t.value, t.label])
) as Record<MoodTag, string>;

// yyyy-mm-dd é sempre parseado como data local (nunca new Date(iso), que
// cai em UTC e pode mudar o dia da semana perto da meia-noite) — mesmo
// cuidado de formatDateShort em src/lib/format.ts.
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export type Insight = { kind: "weekday" | "tag"; text: string };

export function buildInsights(checkins: MoodCheckin[]): Insight[] {
  if (checkins.length < MIN_TOTAL_CHECKINS) return [];

  const insights: Insight[] = [];
  const overallAvg = average(checkins.map((c) => c.mood));

  const byWeekday = new Map<number, MoodLevel[]>();
  for (const c of checkins) {
    const weekday = parseLocalDate(c.date).getDay();
    const list = byWeekday.get(weekday) ?? [];
    list.push(c.mood);
    byWeekday.set(weekday, list);
  }

  let hardest: { weekday: number; avg: number } | null = null;
  let easiest: { weekday: number; avg: number } | null = null;
  for (const [weekday, moods] of byWeekday) {
    if (moods.length < MIN_PER_WEEKDAY) continue;
    const avg = average(moods);
    if (!hardest || avg < hardest.avg) hardest = { weekday, avg };
    if (!easiest || avg > easiest.avg) easiest = { weekday, avg };
  }

  if (hardest && overallAvg - hardest.avg >= WEEKDAY_GAP_THRESHOLD) {
    insights.push({
      kind: "weekday",
      text: `Notamos que suas ${WEEKDAY_NAMES[hardest.weekday]} costumam ser mais difíceis. Que tal reservar um tempo pra descansar nesses dias?`,
    });
  }
  if (
    easiest &&
    easiest.weekday !== hardest?.weekday &&
    easiest.avg - overallAvg >= WEEKDAY_GAP_THRESHOLD
  ) {
    insights.push({
      kind: "weekday",
      text: `Suas ${WEEKDAY_NAMES[easiest.weekday]} costumam ser seus melhores dias.`,
    });
  }

  const tagDeltas = MOOD_TAGS.map(({ value: tag }) => {
    const withTag = checkins.filter((c) => c.tags.includes(tag)).map((c) => c.mood);
    const withoutTag = checkins.filter((c) => !c.tags.includes(tag)).map((c) => c.mood);
    if (withTag.length < MIN_TAG_SAMPLES || withoutTag.length < MIN_TAG_SAMPLES) return null;
    const delta = average(withTag) - average(withoutTag);
    return { tag, delta };
  }).filter((v): v is { tag: MoodTag; delta: number } => v !== null && Math.abs(v.delta) >= TAG_DELTA_THRESHOLD);

  tagDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  for (const { tag, delta } of tagDeltas.slice(0, MAX_TAG_INSIGHTS)) {
    const direction = delta > 0 ? "tende a ser melhor" : "tende a ser pior";
    insights.push({
      kind: "tag",
      text: `Nos dias em que você marca "${TAG_LABELS[tag]}", seu humor ${direction}.`,
    });
  }

  return insights;
}

export function checkinsNeededForInsights(checkins: MoodCheckin[]): number {
  return Math.max(0, MIN_TOTAL_CHECKINS - checkins.length);
}

export type LowMoodStreak = { streakDays: number; startDate: string; endDate: string };

const ALERT_STREAK_DAYS = 3;
const ALERT_MOOD: MoodLevel = 1;
// Só alerta se o check-in mais recente do streak for de hoje ou ontem —
// um streak de meses atrás (já resolvido) não deveria ficar preso na tela
// pra sempre. É um sinal de atenção atual, não um registro histórico.
const FRESHNESS_DAYS = 1;

export function detectLowMoodStreak(checkins: MoodCheckin[]): LowMoodStreak | null {
  if (checkins.length === 0) return null;

  const byDate = new Map(checkins.map((c) => [c.date, c.mood]));
  const mostRecentDate = checkins.reduce((max, c) => (c.date > max ? c.date : max), checkins[0].date);

  const daysSinceMostRecent = Math.round(
    (parseLocalDate(todayIso()).getTime() - parseLocalDate(mostRecentDate).getTime()) / 86_400_000
  );
  if (daysSinceMostRecent > FRESHNESS_DAYS) return null;

  let streak = 0;
  const cursor = parseLocalDate(mostRecentDate);
  while (byDate.get(toIso(cursor)) === ALERT_MOOD) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  if (streak < ALERT_STREAK_DAYS) return null;

  const startCursor = parseLocalDate(mostRecentDate);
  startCursor.setDate(startCursor.getDate() - (streak - 1));
  return { streakDays: streak, startDate: toIso(startCursor), endDate: mostRecentDate };
}
