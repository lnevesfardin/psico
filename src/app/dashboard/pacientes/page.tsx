"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, FileText, Plus, BarChart3, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { createPatient, listPatients } from "@/lib/patients-client";
import { PatientFormModal } from "@/components/patient-form-modal";
import { ComplexidadeBar } from "@/components/dashboard/complexidade-bar";
import { PatientsReportModal } from "@/components/dashboard/patients-report-modal";
import { formatDateShort } from "@/lib/format";
import type { Patient, TipoFicha } from "@/lib/dashboard-data";

const ABAS: { value: TipoFicha; label: string }[] = [
  { value: "individuo", label: "Indivíduos" },
  { value: "casal", label: "Casais" },
  { value: "grupo", label: "Grupos" },
];

type Ordenacao = "nome" | "ultima-sessao" | "complexidade";

// Alta primeiro: a lista ordenada por complexidade existe para achar quem
// exige mais atenção, não para listar do mais leve ao mais pesado.
const PESO_COMPLEXIDADE = { alta: 0, media: 1, baixa: 2 } as const;

export default function PacientesPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [aba, setAba] = useState<TipoFicha>("individuo");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("nome");
  const [modalOpen, setModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listPatients(supabase, user.id)
      .then(setPatients)
      .finally(() => setLoading(false));
  }, [user]);

  const contagem = useMemo(() => {
    const mapa = { individuo: 0, casal: 0, grupo: 0 } as Record<TipoFicha, number>;
    for (const p of patients) mapa[p.tipo] += 1;
    return mapa;
  }, [patients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lista = patients.filter(
      (p) => p.tipo === aba && (!q || p.name.toLowerCase().includes(q))
    );

    return [...lista].sort((a, b) => {
      if (ordenacao === "nome") return a.name.localeCompare(b.name);
      if (ordenacao === "ultima-sessao") {
        // Quem nunca teve sessão vai para o fim, não para o topo.
        if (!a.ultimaSessaoEm) return b.ultimaSessaoEm ? 1 : 0;
        if (!b.ultimaSessaoEm) return -1;
        return b.ultimaSessaoEm.localeCompare(a.ultimaSessaoEm);
      }
      const pa = a.complexidade ? PESO_COMPLEXIDADE[a.complexidade] : 3;
      const pb = b.complexidade ? PESO_COMPLEXIDADE[b.complexidade] : 3;
      return pa - pb || a.name.localeCompare(b.name);
    });
  }, [patients, query, aba, ordenacao]);

  function handleCreated(patient: Patient) {
    setPatients((prev) => [...prev, patient]);
    setAba(patient.tipo);
    setModalOpen(false);
  }

  const rotuloAba = ABAS.find((t) => t.value === aba)!.label.toLowerCase();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Pacientes &amp; Prontuários
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {loading ? "Carregando..." : `${patients.length} fichas cadastradas.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <BarChart3 className="h-4 w-4" />
            Relatório
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Nova ficha
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {ABAS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setAba(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              aba === value
                ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-600">
              {contagem[value]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-full border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          Ordenar por
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            <option value="nome">Nome</option>
            <option value="ultima-sessao">Última sessão</option>
            <option value="complexidade">Complexidade</option>
          </select>
        </label>
      </div>

      <div className="mt-6 space-y-2">
        {filtered.map((patient) => (
          <Link
            key={patient.id}
            href={`/dashboard/pacientes/${patient.id}`}
            className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              {patient.tipo === "individuo" ? (
                patient.name
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
              ) : (
                <Users className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-white">
                {patient.name}
              </p>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {patient.ultimaSessaoEm
                  ? `Última sessão em ${formatDateShort(patient.ultimaSessaoEm)}`
                  : "Sem sessão registrada"}
              </p>
            </div>
            <div className="hidden shrink-0 sm:block">
              <ComplexidadeBar nivel={patient.complexidade} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-600">
              <FileText className="h-4 w-4" />
              {patient.totalSessoes}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-700" />
          </Link>
        ))}

        {!loading && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            {query
              ? `Nenhuma ficha encontrada para "${query}".`
              : `Nenhuma ficha de ${rotuloAba} ainda. Clique em "Nova ficha" para criar.`}
          </p>
        )}
      </div>

      {modalOpen && user && (
        <PatientFormModal
          title="Nova ficha"
          submitLabel="Salvar ficha"
          onClose={() => setModalOpen(false)}
          onSave={(input) => createPatient(createClient(), user.id, input)}
          onSaved={handleCreated}
        />
      )}

      {reportOpen && (
        <PatientsReportModal
          patients={patients}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
