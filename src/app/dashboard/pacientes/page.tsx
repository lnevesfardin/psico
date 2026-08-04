"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, FileText, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { createPatient, listPatients } from "@/lib/patients-client";
import type { Patient } from "@/lib/dashboard-data";

export default function PacientesPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listPatients(supabase, user.id)
      .then(setPatients)
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, query]);

  function handleCreated(patient: Patient) {
    setPatients((prev) => [...prev, patient].sort((a, b) => a.name.localeCompare(b.name)));
    setModalOpen(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Pacientes & Prontuários
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {loading ? "Carregando..." : `${patients.length} pacientes cadastrados.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Novo Paciente
        </button>
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar paciente por nome..."
          className="w-full rounded-full border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      <div className="mt-6 space-y-2">
        {filtered.map((patient) => (
          <Link
            key={patient.id}
            href={`/dashboard/pacientes/${patient.id}`}
            className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              {patient.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-white">
                {patient.name}
              </p>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {patient.phone || "—"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-600">
              <FileText className="h-4 w-4" />
              {patient.sessions.length}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-700" />
          </Link>
        ))}

        {!loading && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            {patients.length === 0
              ? "Nenhum paciente cadastrado ainda. Clique em \"Novo Paciente\" para começar."
              : `Nenhum paciente encontrado para "${query}".`}
          </p>
        )}
      </div>

      {modalOpen && user && (
        <NewPatientModal
          psicologoId={user.id}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function NewPatientModal({
  psicologoId,
  onClose,
  onCreated,
}: {
  psicologoId: string;
  onClose: () => void;
  onCreated: (patient: Patient) => void;
}) {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insuranceName, setInsuranceName] = useState("");
  const [firstAppointmentDate, setFirstAppointmentDate] = useState("");
  const [escolaridade, setEscolaridade] = useState("");
  const [comoConheceu, setComoConheceu] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const patient = await createPatient(supabase, psicologoId, {
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
      onCreated(patient);
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
            Novo Paciente
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
          {saving ? "Salvando..." : "Salvar Paciente"}
        </button>
      </form>
    </div>
  );
}
