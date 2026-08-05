"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Patient } from "@/lib/dashboard-data";
import type { NewPatientInput } from "@/lib/patients-client";

const EMPTY_VALUES: NewPatientInput = {
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
      setError(
        err instanceof Error && err.message.includes("duplicate")
          ? "Já existe um paciente com esse CPF."
          : "Não foi possível salvar o paciente."
      );
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
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nome completo
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
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
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Telefone
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
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nascimento
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
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
