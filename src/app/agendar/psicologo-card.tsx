"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, MapPin, User, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export type PsicologoResumo = {
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
};

function Avatar({
  psicologo,
  className,
}: {
  psicologo: PsicologoResumo;
  className: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 ${className}`}
    >
      {psicologo.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={psicologo.foto_url}
          alt={psicologo.nome}
          className="h-full w-full object-cover"
        />
      ) : (
        <User className="h-1/2 w-1/2" />
      )}
    </div>
  );
}

function Badges({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function PsicologoCard({ psicologo }: { psicologo: PsicologoResumo }) {
  const [open, setOpen] = useState(false);
  const badgesResumo = [...psicologo.abordagens, ...psicologo.especialidades].slice(
    0,
    3
  );
  const regiao = [psicologo.cidade, psicologo.uf].filter(Boolean).join(" - ");
  const onClose = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <Avatar psicologo={psicologo} className="h-12 w-12 text-sm font-semibold" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                {psicologo.nome}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {psicologo.titulo} · {psicologo.crp}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400">
              {formatCurrency(psicologo.valor_consulta)}
            </span>
          </div>

          {regiao && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {regiao}
            </p>
          )}

          {badgesResumo.length > 0 && (
            <div className="mt-2">
              <Badges items={badgesResumo} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-brand-400"
            >
              Ver perfil completo
            </button>
            <Link
              href={`/agendar/${psicologo.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Agendar
            </Link>
          </div>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Perfil de ${psicologo.nome}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar
                  psicologo={psicologo}
                  className="h-16 w-16 text-lg font-semibold"
                />
                <div className="min-w-0">
                  <p className="text-base font-semibold text-zinc-900 dark:text-white">
                    {psicologo.nome}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {psicologo.titulo} · {psicologo.crp}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              {regiao && (
                <p className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />
                  {regiao}
                </p>
              )}
              <p className="shrink-0 text-base font-semibold text-brand-600 dark:text-brand-400">
                {formatCurrency(psicologo.valor_consulta)} / sessão
              </p>
            </div>

            {psicologo.bio && (
              <p className="mt-4 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">
                {psicologo.bio}
              </p>
            )}

            {psicologo.faixas_etarias.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Faixa etária atendida
                </p>
                <div className="mt-1.5">
                  <Badges items={psicologo.faixas_etarias} />
                </div>
              </div>
            )}

            {psicologo.abordagens.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Abordagem clínica
                </p>
                <div className="mt-1.5">
                  <Badges items={psicologo.abordagens} />
                </div>
              </div>
            )}

            {psicologo.especialidades.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Especialidades / Demandas atendidas
                </p>
                <div className="mt-1.5">
                  <Badges items={psicologo.especialidades} />
                </div>
              </div>
            )}

            <Link
              href={`/agendar/${psicologo.id}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <CalendarCheck className="h-4 w-4" />
              Agendar consulta
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
