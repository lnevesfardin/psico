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
  Tags,
  Brain,
  Users,
  MapPin,
  Plus,
  Trash2,
  Video,
  Building2,
  Layers,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import type { Profile } from "@/lib/profile-data";
import { useDisponibilidade } from "@/context/disponibilidade-context";
import {
  weekdayShort,
  weekdayLabels,
  type ModalidadeSelecao,
} from "@/lib/disponibilidade-data";
import { TimeSelect } from "@/components/ui/time-select";
import { CidadeSelect } from "@/components/ui/cidade-select";
import { brStates } from "@/lib/br-states";
import {
  especialidadesOptions,
  abordagensOptions,
  faixasEtariasOptions,
} from "@/lib/psico-options";

const modalidadeSelecaoOptions: {
  value: ModalidadeSelecao;
  label: string;
  icon: typeof MapPin;
}[] = [
  { value: "presencial", label: "Presencial", icon: MapPin },
  { value: "online", label: "Online", icon: Video },
  { value: "ambos", label: "Ambos", icon: Layers },
];

export default function PerfilPage() {
  const { profile, updateProfile } = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [photoMode, setPhotoMode] = useState<"url" | "upload">("url");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { blocks, addBlocks, removeBlock } = useDisponibilidade();
  const [builderDias, setBuilderDias] = useState<number[]>([]);
  const [builderStart, setBuilderStart] = useState("09:00");
  const [builderEnd, setBuilderEnd] = useState("20:00");
  const [builderModalidade, setBuilderModalidade] =
    useState<ModalidadeSelecao>("online");
  const [addingBlock, setAddingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const form = draft ?? profile;

  function toggleBuilderDia(day: number) {
    setBuilderDias((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  async function handleAddBlock() {
    setBlockError(null);
    if (builderDias.length === 0) {
      setBlockError("Escolha pelo menos um dia da semana.");
      return;
    }
    if (builderEnd <= builderStart) {
      setBlockError("O horário final precisa ser depois do inicial.");
      return;
    }
    setAddingBlock(true);
    try {
      if (builderModalidade === "ambos") {
        await addBlocks(builderDias, builderStart, builderEnd, "presencial");
        await addBlocks(builderDias, builderStart, builderEnd, "online");
      } else {
        await addBlocks(builderDias, builderStart, builderEnd, builderModalidade);
      }
      setBuilderDias([]);
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : "Erro ao adicionar horário.");
    } finally {
      setAddingBlock(false);
    }
  }

  async function handleRemoveBlock(id: string) {
    setRemovingIds((prev) => new Set(prev).add(id));
    try {
      await removeBlock(id);
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : "Erro ao remover horário.");
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  // Forma funcional (e não { ...form }): duas chamadas seguidas de set() no
  // mesmo handler — como trocar a UF e limpar a cidade — precisam se
  // acumular, senão a segunda descarta a primeira por partir de um "form"
  // capturado no render anterior.
  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((prev) => ({ ...(prev ?? profile), [key]: value }));
    setSaved(false);
  }

  function toggleListItem(
    key: "especialidades" | "abordagens" | "faixasEtarias",
    value: string
  ) {
    const current = form[key];
    set(
      key,
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
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
              placeholder="Ex: Luiz Eduardo"
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

        {/* CRP, UF e cidade */}
        <div className="grid grid-cols-2 gap-4 sm:max-w-md sm:grid-cols-3">
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
              onChange={(e) => {
                set("uf", e.target.value);
                set("cidade", "");
              }}
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
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-zinc-400" />
              Cidade
            </span>
            <CidadeSelect
              uf={form.uf}
              value={form.cidade}
              onChange={(value) => set("cidade", value)}
              required
            />
          </label>
        </div>

        {/* Especialidades / demandas atendidas */}
        <div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Tags className="h-4 w-4 text-zinc-400" />
            Especialidades / Demandas atendidas
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {especialidadesOptions.map((option) => {
              const active = form.especialidades.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleListItem("especialidades", option)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Abordagem clínica */}
        <div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Brain className="h-4 w-4 text-zinc-400" />
            Abordagem clínica
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {abordagensOptions.map((option) => {
              const active = form.abordagens.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleListItem("abordagens", option)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Faixa etária atendida */}
        <div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Users className="h-4 w-4 text-zinc-400" />
            Faixa etária atendida
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {faixasEtariasOptions.map((option) => {
              const active = form.faixasEtarias.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleListItem("faixasEtarias", option)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
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

        {/* Consultório físico */}
        <div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <span className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Building2 className="h-4 w-4 text-zinc-400" />
              Atendo presencialmente em um consultório
            </span>
            <input
              type="checkbox"
              checked={form.temConsultorio}
              onChange={(e) => set("temConsultorio", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
          </label>

          {form.temConsultorio && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Rua
                  <input
                    type="text"
                    required
                    value={form.consultorioRua}
                    onChange={(e) => set("consultorioRua", e.target.value)}
                    placeholder="Rua Exemplo"
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Número
                  <input
                    type="text"
                    required
                    value={form.consultorioNumero}
                    onChange={(e) => set("consultorioNumero", e.target.value)}
                    placeholder="123"
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Bairro
                <input
                  type="text"
                  required
                  value={form.consultorioBairro}
                  onChange={(e) => set("consultorioBairro", e.target.value)}
                  placeholder="Centro"
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Estado
                  <select
                    required
                    value={form.consultorioUf}
                    onChange={(e) => {
                      set("consultorioUf", e.target.value);
                      set("consultorioCidade", "");
                    }}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value="" disabled>
                      UF
                    </option>
                    {brStates.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Cidade
                  <CidadeSelect
                    uf={form.consultorioUf}
                    value={form.consultorioCidade}
                    onChange={(value) => set("consultorioCidade", value)}
                    required
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Link do Google Maps{" "}
                <span className="font-normal text-zinc-400">(opcional)</span>
                <input
                  type="url"
                  value={form.consultorioMapsUrl}
                  onChange={(e) => set("consultorioMapsUrl", e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
              <p className="text-xs text-zinc-400">
                Cole o link de compartilhamento do Google Maps do seu
                consultório, pra pacientes acharem o local com facilidade.
              </p>
            </div>
          )}
        </div>

        {/* Sala de videochamada */}
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="flex items-center gap-1.5">
            <Video className="h-4 w-4 text-zinc-400" />
            Link da sala de videochamada{" "}
            <span className="font-normal text-zinc-400">
              (para atendimentos online)
            </span>
          </span>
          <input
            type="url"
            value={form.salaOnlineUrl}
            onChange={(e) => set("salaOnlineUrl", e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <p className="mt-1.5 text-xs font-normal text-zinc-400">
            Sua sala fixa do Google Meet, Zoom ou similar. Ela é enviada no
            lembrete que o paciente recebe 1 hora antes das consultas online —
            e nunca aparece no seu perfil público.
          </p>
        </label>

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

      <div className="mt-6 space-y-5 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
            <CalendarClock className="h-4 w-4 text-zinc-400" />
            Disponibilidade para Agendamento
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Adicione blocos de horário por dia da semana e modalidade — dá pra
            ter dias e horários diferentes pra presencial e online.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-zinc-200 p-4 dark:border-zinc-700">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Dias da semana
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekdayShort.map((label, day) => {
              const active = builderDias.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleBuilderDia(day)}
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

          <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-xs">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Início
              <TimeSelect value={builderStart} onChange={setBuilderStart} required />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Término
              <TimeSelect value={builderEnd} onChange={setBuilderEnd} required />
            </label>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Modalidade
            </label>
            <div className="mt-2 inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
              {modalidadeSelecaoOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBuilderModalidade(value)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    builderModalidade === value
                      ? "bg-brand-600 text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {blockError && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
              {blockError}
            </p>
          )}

          <button
            type="button"
            onClick={handleAddBlock}
            disabled={addingBlock}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {addingBlock ? "Adicionando..." : "Adicionar horário"}
          </button>
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Horários cadastrados
          </h3>
          {blocks.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">
              Nenhum horário cadastrado ainda.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {blocks.map((block) => (
                <li
                  key={block.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3.5 py-2.5 text-sm dark:bg-zinc-950/50"
                >
                  <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">
                      {weekdayLabels[block.diaSemana]}
                    </span>
                    <span className="text-zinc-400">·</span>
                    {block.startTime}–{block.endTime}
                    <span className="text-zinc-400">·</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {block.modalidade === "presencial" ? (
                        <MapPin className="h-3 w-3" />
                      ) : (
                        <Video className="h-3 w-3" />
                      )}
                      {block.modalidade === "presencial" ? "Presencial" : "Online"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlock(block.id)}
                    disabled={removingIds.has(block.id)}
                    aria-label="Remover horário"
                    className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
