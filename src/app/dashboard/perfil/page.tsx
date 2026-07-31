"use client";

import { useState } from "react";
import {
  Camera,
  Link2,
  CircleDollarSign,
  MessageCircle,
  Check,
  IdCard,
  CalendarClock,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import type { Profile } from "@/lib/profile-data";
import { useWorkingHours } from "@/context/working-hours-context";
import { weekdayShort, type WorkingHours } from "@/lib/working-hours-data";
import { TimeSelect } from "@/components/ui/time-select";
import { brStates } from "@/lib/br-states";

export default function PerfilPage() {
  const { profile, updateProfile } = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [photoMode, setPhotoMode] = useState<"url" | "upload">("url");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { workingHours, updateWorkingHours } = useWorkingHours();
  const [hoursDraft, setHoursDraft] = useState<WorkingHours | null>(null);
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  const form = draft ?? profile;
  const hoursForm = hoursDraft ?? workingHours;

  function toggleDay(day: number) {
    const days = hoursForm.days.includes(day)
      ? hoursForm.days.filter((d) => d !== day)
      : [...hoursForm.days, day].sort();
    setHoursDraft({ ...hoursForm, days });
    setHoursSaved(false);
  }

  function setHoursField<K extends keyof WorkingHours>(
    key: K,
    value: WorkingHours[K]
  ) {
    setHoursDraft({ ...hoursForm, [key]: value });
    setHoursSaved(false);
  }

  async function handleHoursSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHoursError(null);
    try {
      await updateWorkingHours(hoursForm);
      setHoursDraft(null);
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2500);
    } catch (err) {
      setHoursError(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft({ ...form, [key]: value });
    setSaved(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("photoUrl", reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateProfile(form);
      setDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meu Perfil
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Essas informações aparecem na sua Agenda, nos Prontuários e na página
        pública do Psi Rob.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-6 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Foto de perfil */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Foto de Perfil
          </label>
          <div className="mt-2 flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xl font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.photoUrl}
                  alt={form.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                form.name
                  .split(" ")
                  .filter((w) => !["Dr.", "Dra."].includes(w))
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
              )}
            </div>
            <div className="flex-1">
              <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                {(["url", "upload"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPhotoMode(mode)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      photoMode === mode
                        ? "bg-brand-600 text-white"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {mode === "url" ? "URL da foto" : "Fazer upload"}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                {photoMode === "url" ? (
                  <input
                    type="url"
                    value={form.photoUrl}
                    onChange={(e) => set("photoUrl", e.target.value)}
                    placeholder="https://exemplo.com/minha-foto.jpg"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400">
                    <Camera className="h-4 w-4" />
                    Escolher arquivo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Nome e título */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nome Completo
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              placeholder="Dr. Luiz Eduardo"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Título
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
              placeholder="Psicólogo Clínico"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
        </div>

        {/* CRP e UF */}
        <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <IdCard className="h-4 w-4 text-zinc-400" />
              Número do CRP
            </span>
            <input
              type="text"
              value={form.crp}
              onChange={(e) => set("crp", e.target.value)}
              required
              placeholder="06/123456"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            UF
            <select
              value={form.uf}
              onChange={(e) => set("uf", e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              {brStates.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Biografia */}
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Biografia / Apresentação
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={4}
            placeholder="Conte um pouco sobre sua abordagem e experiência..."
            className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>

        {/* Valor e contato */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <CircleDollarSign className="h-4 w-4 text-zinc-400" />
              Valor da Consulta (R$)
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-zinc-400" />
              WhatsApp / Contato
            </span>
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              required
              placeholder="(11) 99999-9999"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-zinc-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <Link2 className="h-4 w-4 shrink-0" />
            Essas alterações refletem automaticamente na Agenda, nos
            Prontuários e no site.
          </p>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </form>

      <form
        onSubmit={handleHoursSubmit}
        className="mt-6 space-y-5 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
            <CalendarClock className="h-4 w-4 text-zinc-400" />
            Disponibilidade para Agendamento Online
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Escolha os dias e o horário em que pacientes podem marcar consultas
            pelo seu link público.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Dias da semana
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekdayShort.map((label, day) => {
              const active = hoursForm.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Início
            <TimeSelect
              value={hoursForm.startTime}
              onChange={(value) => setHoursField("startTime", value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Término
            <TimeSelect
              value={hoursForm.endTime}
              onChange={(value) => setHoursField("endTime", value)}
              required
            />
          </label>
        </div>

        {hoursError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {hoursError}
          </div>
        )}

        <div className="flex items-center justify-end border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {hoursSaved ? <Check className="h-4 w-4" /> : null}
            {hoursSaved ? "Salvo!" : "Salvar disponibilidade"}
          </button>
        </div>
      </form>
    </div>
  );
}
