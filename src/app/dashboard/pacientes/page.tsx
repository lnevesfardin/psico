"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { createPatient, listPatients } from "@/lib/patients-client";
import { PatientFormModal } from "@/components/patient-form-modal";
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
        <PatientFormModal
          title="Novo Paciente"
          submitLabel="Salvar Paciente"
          onClose={() => setModalOpen(false)}
          onSave={(input) => createPatient(createClient(), user.id, input)}
          onSaved={handleCreated}
        />
      )}
    </div>
  );
}
