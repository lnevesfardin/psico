"use client";

import { useState } from "react";
import { Plus, Trash2, User, Users, X } from "lucide-react";
import {
  COMPLEXIDADE_LABELS,
  type Complexidade,
  type Patient,
  type TipoFicha,
} from "@/lib/dashboard-data";
import type { NewPatientInput, ParticipanteInput } from "@/lib/patients-client";

const TIPOS: { value: TipoFicha; label: string; icon: typeof User; hint: string }[] = [
  { value: "individuo", label: "Indivíduo", icon: User, hint: "Uma pessoa." },
  { value: "casal", label: "Casal", icon: Users, hint: "Duas pessoas, uma ficha." },
  { value: "grupo", label: "Grupo", icon: Users, hint: "Várias pessoas, uma ficha." },
];

const COMPLEXIDADES: Complexidade[] = ["baixa", "media", "alta"];

const EMPTY_VALUES: NewPatientInput = {
  tipo: "individuo",
  complexidade: null,
  participantes: [],
  name: "",
  cpf: "",
  phone: "",
  email: "",
  birthDate: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  hasInsurance: false,
  insuranceName: "",
  firstAppointmentDate: "",
  escolaridade: "",
  comoConheceu: "",
  observacoes: "",
};

export function PatientFormModal({
  title,
  submitLabel,
  initialValues,
  onClose,
  onSave,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initialValues?: NewPatientInput;
  onClose: () => void;
  onSave: (input: NewPatientInput) => Promise<Patient>;
  onSaved: (patient: Patient) => void;
}) {
  const base = initialValues ?? EMPTY_VALUES;
  const [tipo, setTipo] = useState<TipoFicha>(base.tipo);
  const [complexidade, setComplexidade] = useState<Complexidade | null>(
    base.complexidade
  );
  const [participantes, setParticipantes] = useState<ParticipanteInput[]>(
    base.participantes.length > 0
      ? base.participantes
      : [
          { nome: "", telefone: "", email: "" },
          { nome: "", telefone: "", email: "" },
        ]
  );
  const [name, setName] = useState(base.name);
  const [cpf, setCpf] = useState(base.cpf);
  const [phone, setPhone] = useState(base.phone);
  const [email, setEmail] = useState(base.email);
  const [birthDate, setBirthDate] = useState(base.birthDate);
  const [emergencyContactName, setEmergencyContactName] = useState(
    base.emergencyContactName
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    base.emergencyContactPhone
  );
  const [hasInsurance, setHasInsurance] = useState(base.hasInsurance);
  const [insuranceName, setInsuranceName] = useState(base.insuranceName);
  const [firstAppointmentDate, setFirstAppointmentDate] = useState(
    base.firstAppointmentDate
  );
  const [escolaridade, setEscolaridade] = useState(base.escolaridade);
  const [comoConheceu, setComoConheceu] = useState(base.comoConheceu);
  const [observacoes, setObservacoes] = useState(base.observacoes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const patient = await onSave({
        tipo,
        complexidade,
        participantes,
        name,
        cpf,
        phone,
        email,
        birthDate,
        emergencyContactName,
        emergencyContactPhone,
        hasInsurance,
        insuranceName,
        firstAppointmentDate,
        escolaridade,
        comoConheceu,
        observacoes,
      });
      onSaved(patient);
    } catch (err) {
      // error.message do PostgREST é a mensagem genérica do Postgres (nome
      // de coluna/constraint), não os valores da linha — os valores ficam em
      // error.details, que nunca é lido aqui. Seguro mostrar: ajuda a
      // diagnosticar problema de schema (ex.: coluna nova não aplicada) sem
      // vazar CPF/dado de paciente.
      if (err instanceof Error && err.message.includes("duplicate")) {
        setError("Já existe um paciente com esse CPF.");
      } else {
        setError(
          `Não foi possível salvar o paciente.${
            err instanceof Error ? ` (${err.message})` : ""
          }`
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de atendimento
            </span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {TIPOS.map(({ value, label, icon: Icon, hint }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTipo(value)}
                  title={hint}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors ${
                    tipo === value
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {tipo === "individuo" ? "Nome completo" : "Nome da ficha"}
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                tipo === "casal"
                  ? "Ex.: Ana e João"
                  : tipo === "grupo"
                    ? "Ex.: Grupo de adolescentes - terças"
                    : undefined
              }
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

          {tipo !== "individuo" && (
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Participantes
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setParticipantes((prev) => [
                      ...prev,
                      { nome: "", telefone: "", email: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Contatos de cada pessoa. A evolução, os documentos e o
                financeiro continuam sendo da ficha inteira.
              </p>
              <div className="mt-3 space-y-2">
                {participantes.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={p.nome}
                        onChange={(e) =>
                          setParticipantes((prev) =>
                            prev.map((item, idx) =>
                              idx === i ? { ...item, nome: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Nome"
                        className="col-span-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                      <input
                        type="tel"
                        value={p.telefone}
                        onChange={(e) =>
                          setParticipantes((prev) =>
                            prev.map((item, idx) =>
                              idx === i
                                ? { ...item, telefone: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="Telefone"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                      <input
                        type="email"
                        value={p.email}
                        onChange={(e) =>
                          setParticipantes((prev) =>
                            prev.map((item, idx) =>
                              idx === i ? { ...item, email: e.target.value } : item
                            )
                          )
                        }
                        placeholder="E-mail"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setParticipantes((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      aria-label="Remover participante"
                      className="mt-1 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {participantes.length === 0 && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-600">
                    Nenhum participante. Use &quot;Adicionar&quot; acima.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Complexidade
            </span>
            <div className="mt-1.5 flex gap-2">
              {COMPLEXIDADES.map((nivel) => (
                <button
                  key={nivel}
                  type="button"
                  // Clicar no nível já marcado desmarca: sem isso não haveria
                  // como voltar a "não classificada" depois do primeiro clique.
                  onClick={() =>
                    setComplexidade((atual) => (atual === nivel ? null : nivel))
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    complexidade === nivel
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {COMPLEXIDADE_LABELS[nivel]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
              Sua avaliação, só para organizar sua lista. Clique de novo para
              deixar sem classificação.
            </p>
          </div>

          {/* CPF e nascimento só valem para indivíduo: numa ficha de casal ou
              grupo eles não têm dono definido. O campo que sobra ocupa a
              linha toda, em vez de ficar meia-largura sozinho. */}
          <div className="grid grid-cols-2 gap-4">
            {tipo === "individuo" && (
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                CPF
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
            )}
            <label
              className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 ${
                tipo === "individuo" ? "" : "col-span-2"
              }`}
            >
              {tipo === "individuo" ? "Telefone" : "Telefone principal"}
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label
              className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 ${
                tipo === "individuo" ? "" : "col-span-2"
              }`}
            >
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            {tipo === "individuo" && (
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nascimento
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Contato de emergência
              <input
                type="text"
                placeholder="Nome (parentesco)"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Telefone de emergência
              <input
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Data da primeira consulta
            <input
              type="date"
              value={firstAppointmentDate}
              onChange={(e) => setFirstAppointmentDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Possui plano de saúde?
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={hasInsurance}
                onClick={() => setHasInsurance((v) => !v)}
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  hasInsurance ? "bg-brand-600" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    hasInsurance ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {hasInsurance && (
              <input
                type="text"
                placeholder="Nome do convênio"
                value={insuranceName}
                onChange={(e) => setInsuranceName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            )}
          </div>

          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              Dados Adicionais
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Escolaridade
                <input
                  type="text"
                  placeholder="Ensino superior completo"
                  value={escolaridade}
                  onChange={(e) => setEscolaridade(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Por onde conheceu o profissional
                <input
                  type="text"
                  placeholder="Indicação, Instagram..."
                  value={comoConheceu}
                  onChange={(e) => setComoConheceu(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Observações, medicamentos, tratamentos e outros dados adicionais
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
      </form>
    </div>
  );
}
