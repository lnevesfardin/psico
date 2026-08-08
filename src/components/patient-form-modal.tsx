"use client";

import { useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Patient } from "@/lib/dashboard-data";
import { isMinor, type NewPatientInput } from "@/lib/patients-client";

const EMPTY_VALUES: NewPatientInput = {
  name: "",
  nomeSocial: "",
  cpf: "",
  phone: "",
  email: "",
  birthDate: "",
  genero: "",
  endereco: null,
  emergencyContactName: "",
  emergencyContactPhone: "",
  responsavelNome: "",
  responsavelCpf: "",
  responsavelParentesco: "",
  hasInsurance: false,
  insuranceName: "",
  firstAppointmentDate: "",
  escolaridade: "",
  comoConheceu: "",
  queixaInicial: "",
  encaminhadoPor: "",
  valorSessao: null,
  frequenciaPadrao: "",
  observacoes: "",
};

const INPUT_CLASS =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";
const LABEL_CLASS = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

type Step = "identificacao" | "contato" | "responsavel" | "clinico" | "financeiro";

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
  const [values, setValues] = useState<NewPatientInput>(base);
  const [cep, setCep] = useState(base.endereco?.cep ?? "");
  const [rua, setRua] = useState(base.endereco?.rua ?? "");
  const [numero, setNumero] = useState(base.endereco?.numero ?? "");
  const [bairro, setBairro] = useState(base.endereco?.bairro ?? "");
  const [cidade, setCidade] = useState(base.endereco?.cidade ?? "");
  const [uf, setUf] = useState(base.endereco?.uf ?? "");
  const [valorSessaoText, setValorSessaoText] = useState(
    base.valorSessao != null ? String(base.valorSessao) : ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minor = isMinor(values.birthDate);

  const steps = useMemo<Step[]>(() => {
    const base: Step[] = ["identificacao", "contato"];
    if (minor) base.push("responsavel");
    return [...base, "clinico", "financeiro"];
  }, [minor]);
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex === steps.length - 1;

  function update<K extends keyof NewPatientInput>(key: K, value: NewPatientInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function stepIsValid(): boolean {
    if (step === "identificacao") return values.name.trim().length > 0;
    if (step === "responsavel") {
      return values.responsavelNome.trim().length > 0;
    }
    return true;
  }

  function goNext() {
    if (!stepIsValid()) {
      setError(
        step === "responsavel"
          ? "Nome do responsável legal é obrigatório para paciente menor de idade."
          : "Preencha o nome do paciente."
      );
      return;
    }
    setError(null);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLastStep) {
      goNext();
      return;
    }
    if (!stepIsValid()) return;

    setSaving(true);
    setError(null);
    try {
      const endereco =
        cep || rua || numero || bairro || cidade || uf
          ? { cep, rua, numero, bairro, cidade, uf }
          : null;
      const valorSessao = valorSessaoText.trim()
        ? Number(valorSessaoText.replace(",", "."))
        : null;

      const patient = await onSave({
        ...values,
        endereco,
        valorSessao: valorSessao != null && !Number.isNaN(valorSessao) ? valorSessao : null,
      });
      onSaved(patient);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("duplicate")
          ? "Já existe um paciente com esse CPF."
          : "Não foi possível salvar o paciente."
      );
    } finally {
      setSaving(false);
    }
  }

  const STEP_LABEL: Record<Step, string> = {
    identificacao: "Identificação",
    contato: "Contato",
    responsavel: "Responsável legal",
    clinico: "Dados clínicos iniciais",
    financeiro: "Financeiro",
  };

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

        <div className="mt-3 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                i <= stepIndex ? "bg-brand-600" : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
          Etapa {stepIndex + 1} de {steps.length} · {STEP_LABEL[step]}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {step === "identificacao" && (
            <>
              <label className={LABEL_CLASS}>
                Nome completo
                <input
                  type="text"
                  required
                  value={values.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <label className={LABEL_CLASS}>
                Nome social (se diferente do nome civil)
                <input
                  type="text"
                  value={values.nomeSocial}
                  onChange={(e) => update("nomeSocial", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={LABEL_CLASS}>
                  CPF
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={values.cpf}
                    onChange={(e) => update("cpf", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Nascimento
                  <input
                    type="date"
                    value={values.birthDate}
                    onChange={(e) => update("birthDate", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
              {minor && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Paciente menor de idade — os dados do responsável legal vão
                  ser obrigatórios numa próxima etapa.
                </p>
              )}
              <label className={LABEL_CLASS}>
                Gênero
                <input
                  type="text"
                  value={values.genero}
                  onChange={(e) => update("genero", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
            </>
          )}

          {step === "contato" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className={LABEL_CLASS}>
                  Telefone
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={values.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Email
                  <input
                    type="email"
                    value={values.email}
                    onChange={(e) => update("email", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Endereço (opcional)
                </p>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <label className={LABEL_CLASS}>
                    CEP
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className={LABEL_CLASS}>
                    Número
                    <input
                      type="text"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>
                <label className={`${LABEL_CLASS} mt-4`}>
                  Rua
                  <input
                    type="text"
                    value={rua}
                    onChange={(e) => setRua(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <label className={`${LABEL_CLASS} col-span-1`}>
                    Bairro
                    <input
                      type="text"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className={`${LABEL_CLASS} col-span-1`}>
                    Cidade
                    <input
                      type="text"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className={`${LABEL_CLASS} col-span-1`}>
                    UF
                    <input
                      type="text"
                      maxLength={2}
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase())}
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <label className={LABEL_CLASS}>
                  Contato de emergência
                  <input
                    type="text"
                    placeholder="Nome (parentesco)"
                    value={values.emergencyContactName}
                    onChange={(e) => update("emergencyContactName", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Telefone de emergência
                  <input
                    type="tel"
                    value={values.emergencyContactPhone}
                    onChange={(e) => update("emergencyContactPhone", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            </>
          )}

          {step === "responsavel" && (
            <>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Obrigatório porque o paciente é menor de idade.
              </p>
              <label className={LABEL_CLASS}>
                Nome do responsável legal
                <input
                  type="text"
                  required
                  value={values.responsavelNome}
                  onChange={(e) => update("responsavelNome", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={LABEL_CLASS}>
                  CPF do responsável
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={values.responsavelCpf}
                    onChange={(e) => update("responsavelCpf", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Parentesco
                  <input
                    type="text"
                    placeholder="Mãe, pai, tutor..."
                    value={values.responsavelParentesco}
                    onChange={(e) => update("responsavelParentesco", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            </>
          )}

          {step === "clinico" && (
            <>
              <label className={LABEL_CLASS}>
                Queixa inicial
                <textarea
                  value={values.queixaInicial}
                  onChange={(e) => update("queixaInicial", e.target.value)}
                  rows={2}
                  className={`${INPUT_CLASS} resize-none`}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={LABEL_CLASS}>
                  Encaminhado por
                  <input
                    type="text"
                    value={values.encaminhadoPor}
                    onChange={(e) => update("encaminhadoPor", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Escolaridade
                  <input
                    type="text"
                    placeholder="Ensino superior completo"
                    value={values.escolaridade}
                    onChange={(e) => update("escolaridade", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
              <label className={LABEL_CLASS}>
                Por onde conheceu o profissional
                <input
                  type="text"
                  placeholder="Indicação, Instagram..."
                  value={values.comoConheceu}
                  onChange={(e) => update("comoConheceu", e.target.value)}
                  className={INPUT_CLASS}
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
                    aria-checked={values.hasInsurance}
                    onClick={() => update("hasInsurance", !values.hasInsurance)}
                    className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      values.hasInsurance ? "bg-brand-600" : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        values.hasInsurance ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {values.hasInsurance && (
                  <input
                    type="text"
                    placeholder="Nome do convênio"
                    value={values.insuranceName}
                    onChange={(e) => update("insuranceName", e.target.value)}
                    className={`${INPUT_CLASS} mt-2`}
                  />
                )}
              </div>

              <label className={LABEL_CLASS}>
                Observações, medicamentos, tratamentos e outros dados adicionais
                <textarea
                  value={values.observacoes}
                  onChange={(e) => update("observacoes", e.target.value)}
                  rows={3}
                  className={`${INPUT_CLASS} resize-none`}
                />
              </label>
            </>
          )}

          {step === "financeiro" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className={LABEL_CLASS}>
                  Valor da sessão (R$)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="200,00"
                    value={valorSessaoText}
                    onChange={(e) => setValorSessaoText(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Frequência padrão
                  <select
                    value={values.frequenciaPadrao}
                    onChange={(e) => update("frequenciaPadrao", e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">—</option>
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </label>
              </div>
              <label className={LABEL_CLASS}>
                Data da primeira consulta
                <input
                  type="date"
                  value={values.firstAppointmentDate}
                  onChange={(e) => update("firstAppointmentDate", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Salvando..."
              : isLastStep
                ? submitLabel
                : (
                  <>
                    Avançar
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
          </button>
        </div>
      </form>
    </div>
  );
}
