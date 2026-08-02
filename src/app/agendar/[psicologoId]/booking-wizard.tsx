"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  MapPin,
  Video,
  Clock,
  User,
  MessageSquareText,
  ShieldAlert,
  Users,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateTimeSlots } from "@/lib/disponibilidade-data";
import type { ModalidadeAtendimento } from "@/lib/dashboard-data";
import { formatCurrency, formatDateLabel, nextDays, todayIso } from "@/lib/format";

export type PerfilPublico = {
  id: string;
  nome: string;
  titulo: string;
  crp: string;
  uf: string;
  cidade: string;
  foto_url: string | null;
  bio: string | null;
  valor_consulta: number;
  especialidades: string[];
  abordagens: string[];
  faixas_etarias: string[];
  tem_consultorio: boolean;
  consultorio_endereco: string;
  consultorio_maps_url: string;
};

export type DisponibilidadePublica = {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  modalidade: ModalidadeAtendimento;
};

type SlotOcupado = { data: string; horario: string; status: string };

const sexoOptions = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
const estadoCivilOptions = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
];
const escolaridadeOptions = [
  "Ensino fundamental",
  "Ensino médio",
  "Superior incompleto",
  "Superior completo",
  "Pós-graduação",
  "Mestrado",
  "Doutorado",
];

const modalidadeInfo: Record<
  ModalidadeAtendimento,
  { label: string; description: string; icon: typeof MapPin }
> = {
  presencial: {
    label: "Presencial",
    description: "Atendimento no consultório",
    icon: MapPin,
  },
  online: {
    label: "Online",
    description: "Atendimento por videochamada",
    icon: Video,
  },
};

const emptyForm = {
  nomeCompleto: "",
  idade: "",
  sexo: sexoOptions[0],
  profissao: "",
  telefone: "",
  email: "",
  endereco: "",
  estadoCivil: estadoCivilOptions[0],
  escolaridade: escolaridadeOptions[0],
  motivo: "",
};

type Step = "tipo" | "horario" | "dados" | "resumo" | "sucesso";

const stepOrder: Exclude<Step, "sucesso">[] = ["tipo", "horario", "dados", "resumo"];

export function BookingWizard({
  psicologoId,
  perfil,
  disponibilidades,
}: {
  psicologoId: string;
  perfil: PerfilPublico;
  disponibilidades: DisponibilidadePublica[];
}) {
  const [step, setStep] = useState<Step>("tipo");
  const [modalidade, setModalidade] = useState<ModalidadeAtendimento | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ocupados, setOcupados] = useState<SlotOcupado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("consultas_publico")
      .select("data, horario, status")
      .eq("psicologo_id", psicologoId)
      .gte("data", todayIso())
      .then(({ data }) => {
        if (data) setOcupados(data as SlotOcupado[]);
      });
  }, [psicologoId]);

  // Se quem está agendando já tem conta no Psi Rob, pré-preenche nome e
  // WhatsApp com o perfil dela e vincula a consulta à conta (ver RPC) pra
  // aparecer em "Meus Agendamentos" sem precisar digitar tudo de novo.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const loggedUser = data.user;
      if (!loggedUser) return;
      setLoggedInUserId(loggedUser.id);
      supabase
        .from("profiles")
        .select("name, whatsapp")
        .eq("id", loggedUser.id)
        .single()
        .then(({ data: profile }) => {
          if (!profile) return;
          setForm((prev) => ({
            ...prev,
            nomeCompleto: prev.nomeCompleto || profile.name || "",
            telefone: prev.telefone || profile.whatsapp || "",
          }));
        });
    });
  }, []);

  // Só oferece os tiles de modalidade que o psicólogo realmente cadastrou
  // disponibilidade — evita deixar escolher "Presencial" e não achar
  // nenhum dia/horário na etapa seguinte.
  const modalidadesOfertadas = useMemo(
    () =>
      (["presencial", "online"] as const).filter((m) =>
        disponibilidades.some((d) => d.modalidade === m)
      ),
    [disponibilidades]
  );

  const blocosDaModalidade = useMemo(
    () => disponibilidades.filter((d) => d.modalidade === modalidade),
    [disponibilidades, modalidade]
  );

  const availableDates = useMemo(() => {
    if (!modalidade) return [];
    const dias = new Set(blocosDaModalidade.map((b) => b.dia_semana));
    return nextDays(14).filter((iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return dias.has(new Date(y, m - 1, d).getDay());
    });
  }, [blocosDaModalidade, modalidade]);

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  // União dos blocos do dia da semana selecionado (pode haver mais de um
  // bloco pra mesma modalidade no mesmo dia, ex.: manhã e noite separadas).
  const timeSlots = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const slots = new Set<string>();
    for (const bloco of blocosDaModalidade) {
      if (bloco.dia_semana !== dow) continue;
      for (const slot of generateTimeSlots(
        bloco.horario_inicio.slice(0, 5),
        bloco.horario_fim.slice(0, 5)
      )) {
        slots.add(slot);
      }
    }
    return Array.from(slots).sort();
  }, [blocosDaModalidade, selectedDate]);

  const availableTimes = useMemo(() => {
    return timeSlots.filter((time) => {
      if (selectedDate === todayIso() && time <= currentTime) return false;
      return !ocupados.some(
        (o) =>
          o.data === selectedDate &&
          o.horario.slice(0, 5) === time &&
          o.status !== "desmarcada"
      );
    });
  }, [ocupados, selectedDate, currentTime, timeSlots]);

  function selectDate(iso: string) {
    setSelectedDate(iso);
    setSelectedTime(null);
  }

  function selectModalidade(value: ModalidadeAtendimento) {
    setModalidade(value);
    setStep("horario");
  }

  function set<K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("resumo");
  }

  async function handleConfirm() {
    if (!selectedTime || !modalidade) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("criar_agendamento_publico", {
      p_psicologo_id: psicologoId,
      p_paciente_nome: form.nomeCompleto,
      p_data: selectedDate,
      p_horario: selectedTime,
      p_modalidade: modalidade,
      p_idade: Number(form.idade),
      p_sexo: form.sexo,
      p_profissao: form.profissao,
      p_telefone: form.telefone,
      p_email: form.email,
      p_endereco: form.endereco,
      p_estado_civil: form.estadoCivil,
      p_escolaridade: form.escolaridade,
      p_motivo: form.motivo,
    });

    setSubmitting(false);
    if (error) {
      setError(
        error.message.includes("indisponível")
          ? "Esse horário acabou de ser preenchido. Escolha outro."
          : "Não foi possível concluir o agendamento. Tente novamente."
      );
      setStep("horario");
      setSelectedTime(null);
      return;
    }
    setStep("sucesso");
  }

  function handleReset() {
    setForm(emptyForm);
    setModalidade(null);
    setSelectedTime(null);
    setError(null);
    setStep("tipo");
  }

  const stepIndex = step === "sucesso" ? stepOrder.length : stepOrder.indexOf(step);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-5 w-5 dark:invert" />
            Psi Rob
          </Link>
          <Link
            href="/agendar"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {perfil.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto_url} alt={perfil.nome} className="h-full w-full object-cover" />
            ) : (
              perfil.nome
                .split(" ")
                .filter((w) => !["Dr.", "Dra."].includes(w))
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {perfil.nome} · {perfil.titulo}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {perfil.crp} · {formatCurrency(perfil.valor_consulta)} / sessão
            </p>
            {(perfil.cidade || perfil.uf) && (
              <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[perfil.cidade, perfil.uf].filter(Boolean).join(" - ")}
              </p>
            )}
            {perfil.faixas_etarias.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Atende: {perfil.faixas_etarias.join(", ")}
              </p>
            )}
            {(perfil.abordagens.length > 0 || perfil.especialidades.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...perfil.abordagens, ...perfil.especialidades].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Confira se este CRP é válido antes de agendar — busque por
            &quot;{perfil.crp}&quot; no{" "}
            <a
              href="https://cadastro.cfp.org.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
            >
              site oficial do CFP
            </a>
            .
          </p>
        </div>

        {error && step !== "sucesso" && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        {step !== "sucesso" && (
          <div className="mt-6 flex items-center gap-2">
            {stepOrder.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= stepIndex ? "bg-brand-600" : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              />
            ))}
          </div>
        )}

        {step === "tipo" && (
          <div className="mt-8">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Tipo de atendimento
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Escolha como prefere ser atendido(a).
            </p>
            {modalidadesOfertadas.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                Este psicólogo ainda não configurou horários de agendamento
                online.
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {modalidadesOfertadas.map((value) => {
                  const { label, description, icon: Icon } = modalidadeInfo[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectModalidade(value)}
                      className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-brand-950/40"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{label}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === "horario" && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setStep("tipo")}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Trocar tipo de atendimento
            </button>

            <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Escolha o dia e horário
            </h1>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {availableDates.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDate(iso)}
                  className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    selectedDate === iso
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  {formatDateLabel(iso).split(",")[0].slice(0, 3)}
                  <br />
                  {iso.slice(8, 10)}
                </button>
              ))}
              {availableDates.length === 0 && (
                <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                  Nenhum dia disponível para agendamento no momento.
                </p>
              )}
            </div>

            {availableDates.length > 0 && (
              <>
                <p className="mt-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {formatDateLabel(selectedDate)}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availableTimes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        selectedTime === time
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                  {availableTimes.length === 0 && (
                    <p className="col-span-full rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                      Nenhum horário disponível neste dia.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!selectedTime}
                  onClick={() => setStep("dados")}
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}

        {step === "dados" && selectedTime && (
          <form onSubmit={handleReviewSubmit} className="mt-8">
            <button
              type="button"
              onClick={() => setStep("horario")}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Trocar horário
            </button>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <CalendarDays className="h-4 w-4" />
              {formatDateLabel(selectedDate)} às {selectedTime}
            </div>

            <h2 className="mt-6 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Seus dados
            </h2>

            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nome completo
                <input
                  type="text"
                  required
                  value={form.nomeCompleto}
                  onChange={(e) => set("nomeCompleto", e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Idade
                  <input
                    type="number"
                    min={0}
                    max={120}
                    required
                    value={form.idade}
                    onChange={(e) => set("idade", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Sexo
                  <select
                    value={form.sexo}
                    onChange={(e) => set("sexo", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    {sexoOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Profissão
                <input
                  type="text"
                  required
                  value={form.profissao}
                  onChange={(e) => set("profissao", e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Número de telefone / WhatsApp
                <input
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={(e) => set("telefone", e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                E-mail
                <input
                  type="email"
                  placeholder="voce@exemplo.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Endereço
                <input
                  type="text"
                  required
                  value={form.endereco}
                  onChange={(e) => set("endereco", e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Estado civil
                  <select
                    value={form.estadoCivil}
                    onChange={(e) => set("estadoCivil", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    {estadoCivilOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Escolaridade
                  <select
                    value={form.escolaridade}
                    onChange={(e) => set("escolaridade", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    {escolaridadeOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Motivo / Observações{" "}
                <span className="font-normal text-zinc-400">(opcional)</span>
                <textarea
                  rows={3}
                  value={form.motivo}
                  onChange={(e) => set("motivo", e.target.value)}
                  placeholder="Conte um pouco sobre o que te motivou a buscar atendimento..."
                  className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Revisar agendamento
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {step === "resumo" && selectedTime && modalidade && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setStep("dados")}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Editar dados
            </button>

            <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Confira seu agendamento
            </h1>

            <div className="mt-5 space-y-4 rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start gap-3">
                {modalidade === "presencial" ? (
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                ) : (
                  <Video className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {modalidade === "presencial" ? "Presencial" : "Online"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Tipo de atendimento
                  </p>
                  {modalidade === "presencial" &&
                    perfil.tem_consultorio &&
                    perfil.consultorio_endereco && (
                      <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <p>{perfil.consultorio_endereco}</p>
                        {perfil.consultorio_maps_url && (
                          <a
                            href={perfil.consultorio_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Ver no Google Maps
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {formatDateLabel(selectedDate)} às {selectedTime}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Data e horário
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {form.nomeCompleto}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {form.telefone}
                  </p>
                </div>
              </div>

              {form.motivo && (
                <div className="flex items-start gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {form.motivo}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Motivo / Observações
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Confirmar Agendamento"}
            </button>
          </div>
        )}

        {step === "sucesso" && modalidade && (
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="mt-5 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Solicitação enviada!
            </h1>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Seu atendimento {modalidade === "presencial" ? "presencial" : "online"}{" "}
              para {formatDateLabel(selectedDate)} às {selectedTime} foi
              reservado como pendente. {perfil.nome} vai confirmar em breve
              pelo WhatsApp.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Fazer novo agendamento
              </button>
              <Link
                href={loggedInUserId ? "/agendamentos" : "/"}
                className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                {loggedInUserId ? "Ver Meus Agendamentos" : "Voltar ao site"}
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
