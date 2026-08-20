"use client";

import { DASHBOARD_PATH } from "@/lib/auth/role";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleDollarSign,
  MessageCircle,
  IdCard,
  MapPin,
  Tags,
  Brain,
  Users,
  CalendarClock,
  Building2,
  Plus,
  Trash2,
  Video,
  Layers,
  ArrowRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import {
  DisponibilidadeProvider,
  useDisponibilidade,
} from "@/context/disponibilidade-context";
import type { Profile } from "@/lib/profile-data";
import {
  weekdayShort,
  weekdayLabels,
  type ModalidadeSelecao,
} from "@/lib/disponibilidade-data";
import { TimeSelect } from "@/components/ui/time-select";
import { CidadeSelect } from "@/components/ui/cidade-select";
import { brStates } from "@/lib/br-states";
import { maskCrp } from "@/lib/format";
import {
  especialidadesOptions,
  abordagensOptions,
  faixasEtariasOptions,
} from "@/lib/psico-options";
import { StepIndicator } from "@/components/auth/step-indicator";

const modalidadeSelecaoOptions: {
  value: ModalidadeSelecao;
  label: string;
  icon: typeof MapPin;
}[] = [
  { value: "presencial", label: "Presencial", icon: MapPin },
  { value: "online", label: "Online", icon: Video },
  { value: "ambos", label: "Ambos", icon: Layers },
];

export function OnboardingPsicologo() {
  return (
    <ProfileProvider>
      <DisponibilidadeProvider>
        <OnboardingContent />
      </DisponibilidadeProvider>
    </ProfileProvider>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const { blocks, loading: blocksLoading, addBlocks, removeBlock } =
    useDisponibilidade();

  const [draft, setDraft] = useState<Profile | null>(null);
  const form = draft ?? profile;

  const [builderDias, setBuilderDias] = useState<number[]>([]);
  const [builderStart, setBuilderStart] = useState("09:00");
  const [builderEnd, setBuilderEnd] = useState("20:00");
  const [builderModalidade, setBuilderModalidade] =
    useState<ModalidadeSelecao>("online");
  const [addingBlock, setAddingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // Forma funcional (e não { ...form }): duas chamadas seguidas de set() no
  // mesmo handler — como trocar a UF e limpar a cidade — precisam se
  // acumular, senão a segunda descarta a primeira por partir de um "form"
  // capturado no render anterior.
  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((prev) => ({ ...(prev ?? profile), [key]: value }));
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

  const profileComplete =
    form.name.trim() !== "" &&
    form.title.trim() !== "" &&
    form.crp.trim() !== "" &&
    form.uf.trim() !== "" &&
    form.whatsapp.trim() !== "" &&
    form.price > 0 &&
    (!form.temConsultorio ||
      (form.consultorioRua.trim() !== "" &&
        form.consultorioNumero.trim() !== "" &&
        form.consultorioBairro.trim() !== "" &&
        form.consultorioCidade.trim() !== "" &&
        form.consultorioUf.trim() !== ""));
  const hasDisponibilidade = blocks.length > 0;
  const canFinish = profileComplete && hasDisponibilidade;

  async function handleFinish() {
    setFinishError(null);
    if (!canFinish) {
      setFinishError(
        !profileComplete
          ? "Preencha os campos obrigatórios do perfil antes de continuar."
          : "Adicione pelo menos um horário de disponibilidade antes de continuar."
      );
      return;
    }
    setFinishing(true);
    try {
      await updateProfile(form);
      router.push(DASHBOARD_PATH);
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : "Erro ao salvar.");
      setFinishing(false);
    }
  }

  if (profileLoading || blocksLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
          Psico
        </div>
        <div className="mt-6">
          <StepIndicator current={3} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Complete seu perfil para começar
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Isso só acontece uma vez. Preencha seus dados e a disponibilidade
          antes de acessar o painel — é o que aparece pros pacientes quando
          eles forem escolher você.
        </p>

        <div className="mt-6 space-y-6 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
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

          <div className="grid grid-cols-2 gap-4 sm:max-w-md sm:grid-cols-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <IdCard className="h-4 w-4 text-zinc-400" />
                Número do CRP
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={form.crp}
                onChange={(e) => set("crp", maskCrp(e.target.value))}
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

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Biografia / Apresentação
            <textarea
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              rows={3}
              placeholder="Conte um pouco sobre sua abordagem e experiência..."
              className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

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
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="sala-online-url"
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                <Video className="h-4 w-4 text-zinc-400" />
                Link da sala de videochamada{" "}
                <span className="font-normal text-zinc-400">
                  (para atendimentos online)
                </span>
              </label>
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300"
              >
                <ExternalLink className="h-3 w-3" />
                Criar sala no Meet
              </a>
            </div>
            <input
              id="sala-online-url"
              type="url"
              value={form.salaOnlineUrl}
              onChange={(e) => set("salaOnlineUrl", e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <p className="mt-1.5 text-xs font-normal text-zinc-400">
              Sua sala fixa do Meet, Zoom ou similar. É enviada no lembrete de
              1 hora antes das consultas online e nunca aparece no seu perfil
              público. Clique em &ldquo;Criar sala no Meet&rdquo; para gerar
              um link novo e cole aqui.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
              <CalendarClock className="h-4 w-4 text-zinc-400" />
              Disponibilidade para Agendamento
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Obrigatório: adicione pelo menos um horário. Dá pra ter dias e
              modalidades diferentes (ex.: terça e quinta 9h–20h só online,
              sábado 8h–12h só presencial).
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

        {finishError && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {finishError}
          </div>
        )}

        <button
          type="button"
          onClick={handleFinish}
          disabled={finishing}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {finishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {finishing ? "Salvando..." : "Concluir e ir para o painel"}
        </button>
      </div>
    </div>
  );
}
