"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Loader2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { useProfile } from "@/context/profile-context";
import { useAppointments } from "@/context/appointments-context";
import { listPatients } from "@/lib/patients-client";
import { listLancamentos, type Lancamento } from "@/lib/financeiro-client";
import { AtalhosInicio } from "@/components/dashboard/atalhos-inicio";
import { formatCurrency, formatDateLabel, todayIso } from "@/lib/format";
import type { Appointment, Patient } from "@/lib/dashboard-data";

/** Saudação pelo horário — é a primeira coisa que ele lê no dia. */
function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Só o primeiro nome, sem o "Dr."/"Dra." que deixaria a saudação formal demais. */
function primeiroNome(nome: string): string {
  return (
    nome
      .split(" ")
      .find((parte) => !["Dr.", "Dra."].includes(parte)) ?? ""
  );
}

export default function InicioPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { appointments, loading: carregandoAgenda } = useAppointments();

  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoAtalhos, setEditandoAtalhos] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      listPatients(supabase, user.id),
      listLancamentos(supabase, user.id),
    ])
      .then(([p, l]) => {
        setPacientes(p);
        setLancamentos(l);
      })
      // Um painel de resumo que não carrega não pode virar tela de erro: os
      // cartões que faltarem aparecem zerados, e o resto do dia segue.
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [user]);

  const hoje = todayIso();
  const agora = new Date().toTimeString().slice(0, 5);

  const resumo = useMemo(() => {
    const consultas = appointments.filter((a) => a.kind !== "bloqueio");

    const deHoje = consultas
      .filter((a) => a.date === hoje && a.status !== "desmarcada")
      .sort((a, b) => a.time.localeCompare(b.time));

    // "Próxima" olha o futuro inteiro, não só hoje: às 19h de sexta o que
    // importa é a primeira consulta de segunda, não um vazio.
    const futuras = consultas
      .filter(
        (a) =>
          a.status !== "desmarcada" &&
          (a.date > hoje || (a.date === hoje && a.time >= agora))
      )
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const aguardando = consultas.filter(
      (a) => a.status === "pendente" && a.date >= hoje
    );

    const mes = hoje.slice(0, 7);
    // Só receita: despesa (aluguel, material...) não é "recebido" nem "a
    // receber" — misturar as duas contaria gasto como se fosse faturamento.
    const doMes = lancamentos.filter(
      (l) => l.tipo === "receita" && l.data.startsWith(mes)
    );
    const recebido = doMes
      .filter((l) => l.status === "pago")
      .reduce((soma, l) => soma + l.valor, 0);
    const aReceber = doMes
      .filter((l) => l.status !== "pago")
      .reduce((soma, l) => soma + l.valor, 0);

    return {
      deHoje,
      proxima: futuras[0] ?? null,
      aguardando,
      recebido,
      aReceber,
    };
  }, [appointments, lancamentos, hoje, agora]);

  const ocupado = carregandoAgenda || carregando;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <header>
        <h1 className="font-serif-title text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {saudacao()}
          {primeiroNome(profile.name) && `, ${primeiroNome(profile.name)}`}
        </h1>
        <p className="font-serif-title mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">
          {formatDateLabel(hoje)}
        </p>
      </header>

      {ocupado ? (
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando seu resumo...
        </p>
      ) : (
        <>
          {/* Cada número aparece em um lugar só: a contagem do dia mora no
              cabeçalho da agenda, o dinheiro mora no cartão de financeiro e
              o total de pacientes no cartão de pacientes. Repetir "recebido
              no mês" em dois cartões, como estava, só ocupava espaço e fazia
              a tela parecer maior do que a informação que ela tem. */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-zinc-100 bg-white p-5 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                    <CalendarClock className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    Sua agenda de hoje
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {resumo.deHoje.length === 0
                      ? "Nada marcado"
                      : `${resumo.deHoje.length} ${resumo.deHoje.length === 1 ? "consulta" : "consultas"}`}
                    {resumo.aguardando.length > 0 && (
                      <>
                        {" · "}
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {resumo.aguardando.length} a confirmar
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <Link
                  href="/dashboard/agenda"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Ver agenda
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {resumo.deHoje.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                  Nenhuma consulta marcada para hoje.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {resumo.deHoje.map((consulta) => (
                    <LinhaConsulta
                      key={consulta.id}
                      consulta={consulta}
                      passou={consulta.time < agora}
                    />
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-4">
              <section className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Próxima consulta
                </h2>
                {resumo.proxima ? (
                  <div className="mt-3">
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {resumo.proxima.patientName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {resumo.proxima.date === hoje
                        ? `Hoje às ${resumo.proxima.time}`
                        : `${formatDateLabel(resumo.proxima.date)} às ${resumo.proxima.time}`}
                    </p>
                    {resumo.proxima.patientId && (
                      <Link
                        href={`/dashboard/pacientes/${resumo.proxima.patientId}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Abrir prontuário
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-600">
                    Nada agendado por enquanto.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Financeiro do mês
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Recebido</dt>
                    <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(resumo.recebido)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">A receber</dt>
                    <dd className="font-semibold text-amber-600 dark:text-amber-400">
                      {formatCurrency(resumo.aReceber)}
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/dashboard/financeiro"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Ver financeiro
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>

              <Link
                href="/dashboard/pacientes"
                className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-5 transition-colors hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-900"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Users className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-lg font-bold text-zinc-900 dark:text-white">
                    {pacientes.length}
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {pacientes.length === 1
                      ? "ficha cadastrada"
                      : "fichas cadastradas"}
                  </span>
                </span>
              </Link>
            </div>
          </div>

          <AtalhosInicio
            editando={editandoAtalhos}
            onEditandoChange={setEditandoAtalhos}
          />
        </>
      )}
    </div>
  );
}

function LinhaConsulta({
  consulta,
  passou,
}: {
  consulta: Appointment;
  passou: boolean;
}) {
  const conteudo = (
    <>
      <span
        className={`w-14 shrink-0 text-sm font-bold tabular-nums ${
          passou
            ? "text-zinc-300 dark:text-zinc-700"
            : "text-brand-600 dark:text-brand-400"
        }`}
      >
        {consulta.time}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {consulta.patientName}
      </span>
      {consulta.status === "pendente" && (
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          A confirmar
        </span>
      )}
    </>
  );

  return (
    <li>
      {consulta.patientId ? (
        <Link
          href={`/dashboard/pacientes/${consulta.patientId}`}
          className="flex items-center gap-3 rounded-xl border border-zinc-100 px-3 py-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-zinc-800 dark:hover:border-brand-900 dark:hover:bg-brand-950/20"
        >
          {conteudo}
        </Link>
      ) : (
        // Consulta do link público sem ficha vinculada ainda: não há
        // prontuário para abrir, então a linha não vira link.
        <div className="flex items-center gap-3 rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
          {conteudo}
        </div>
      )}
    </li>
  );
}

