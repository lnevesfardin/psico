"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Check, Link2, ExternalLink, ClipboardList } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";
import { ESCALAS_DISPONIVEIS, ESCALA_TRAUMA_INDISPONIVEL } from "@/lib/escalas";
import { RespostasEscalaList } from "@/components/dashboard/respostas-escala-list";
import { createClient } from "@/lib/supabase/client";
import { listPatients } from "@/lib/patients-client";
import { gerarConviteEscala } from "@/lib/respostas-escala-client";
import type { Patient } from "@/lib/dashboard-data";

function noopSubscribe() {
  return () => {};
}

function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

function LinkBox({
  id,
  titulo,
  descricao,
  link,
  icon: Icon,
  copiedId,
  onCopy,
}: {
  id: string;
  titulo: string;
  descricao: string;
  link: string;
  icon: typeof Link2;
  copiedId: string | null;
  onCopy: (id: string, link: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400">
        <Icon className="h-4 w-4" />
        {titulo}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{descricao}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          readOnly
          value={link}
          className="w-full flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        />
        <button
          type="button"
          onClick={() => onCopy(id, link)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          {copiedId === id ? (
            <>
              <Check className="h-4 w-4" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copiar link
            </>
          )}
        </button>
      </div>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
      >
        Visualizar página
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export default function MeuLinkPage() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const origin = useOrigin();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [escalaSlug, setEscalaSlug] = useState("");
  const [destino, setDestino] = useState<"generico" | "paciente">("generico");
  const [pacienteId, setPacienteId] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const base = `${origin}/agendar/${user?.id ?? ""}`;
  const escalaBase = `${origin}/escala/${user?.id ?? ""}`;

  // Identifica a combinação paciente+escala atualmente selecionada. O token
  // vem do banco (gerar_convite_escala) e é guardado junto da chave que o
  // originou: assim, trocar a seleção descarta o link anterior por derivação,
  // sem precisar limpar estado dentro do efeito.
  const conviteKey =
    destino === "paciente" && pacienteId && escalaSlug
      ? `${pacienteId}:${escalaSlug}`
      : "";
  const [convite, setConvite] = useState<{
    key: string;
    token: string | null;
    erro: boolean;
  } | null>(null);
  const conviteAtual = convite?.key === conviteKey ? convite : null;
  const token = conviteAtual?.token ?? null;
  const erroToken = conviteAtual?.erro ?? false;
  const gerando = Boolean(conviteKey) && conviteAtual === null;

  useEffect(() => {
    if (!user) return;
    listPatients(createClient(), user.id).then(setPatients);
  }, [user]);

  useEffect(() => {
    if (!conviteKey) return;
    let cancelado = false;
    const [pid, slug] = conviteKey.split(":");
    gerarConviteEscala(
      createClient(),
      pid,
      slug as (typeof ESCALAS_DISPONIVEIS)[number]["slug"]
    )
      .then((t) => {
        if (!cancelado) setConvite({ key: conviteKey, token: t, erro: false });
      })
      .catch(() => {
        if (!cancelado) setConvite({ key: conviteKey, token: null, erro: true });
      });
    return () => {
      cancelado = true;
    };
  }, [conviteKey]);

  async function handleCopy(id: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  const escalaEscolhida = ESCALAS_DISPONIVEIS.find((e) => e.slug === escalaSlug);
  const vinculado = destino === "paciente";
  const escalaLink = !escalaEscolhida
    ? ""
    : vinculado
      ? token
        ? `${escalaBase}/${escalaEscolhida.slug}?c=${token}`
        : ""
      : `${escalaBase}/${escalaEscolhida.slug}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meu Link de Agendamento
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Compartilhe para que pacientes agendem consultas com {profile.name}{" "}
        diretamente na sua agenda — sem precisar criar conta.
      </p>

      <div className="mt-6 space-y-4">
        <LinkBox
          id="geral"
          icon={Link2}
          titulo="Link geral"
          descricao="O paciente escolhe entre presencial e online, conforme a sua disponibilidade."
          link={base}
          copiedId={copiedId}
          onCopy={handleCopy}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Para dar acesso à conta de um paciente (acompanhar consultas e registrar
        humor), abra a ficha dele em Pacientes &amp; Prontuários e gere o link de
        convite na aba Humor.
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
          Link de Escala de Rastreio
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Escolha uma escala e gere um link para o paciente responder sozinho,
          sem precisar de conta. São instrumentos de triagem, não de
          diagnóstico — as respostas ficam disponíveis abaixo, na sua conta.
        </p>

        <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Para quem é o link
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            {(
              [
                {
                  valor: "generico" as const,
                  titulo: "Qualquer pessoa",
                  descricao: "Quem responder digita o nome à mão.",
                },
                {
                  valor: "paciente" as const,
                  titulo: "Paciente cadastrado",
                  descricao: "A resposta entra na ficha dele.",
                },
              ]
            ).map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setDestino(opcao.valor)}
                className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
                  destino === opcao.valor
                    ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/40"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                  {opcao.titulo}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                  {opcao.descricao}
                </span>
              </button>
            ))}
          </div>

          {vinculado && (
            <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Paciente
              <select
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Selecione um paciente...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Escala
            <select
              value={escalaSlug}
              onChange={(e) => setEscalaSlug(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Selecione uma escala...</option>
              {ESCALAS_DISPONIVEIS.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.nome}
                </option>
              ))}
              <option disabled>
                {ESCALA_TRAUMA_INDISPONIVEL.nome} (indisponível)
              </option>
            </select>
          </label>
          {escalaSlug === "" && (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
              {ESCALA_TRAUMA_INDISPONIVEL.motivo}
            </p>
          )}

          {escalaEscolhida && (
            <div className="mt-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {escalaEscolhida.descricaoCurta}
              </p>

              {erroToken && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                  Não foi possível gerar o link para este paciente. Confirme se
                  o schema.sql mais recente foi executado no SQL Editor do
                  Supabase.
                </div>
              )}

              {vinculado && !pacienteId && !erroToken && (
                <p className="mt-3 rounded-lg border border-dashed border-zinc-200 px-4 py-2.5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  Selecione um paciente acima para gerar o link.
                </p>
              )}

              {gerando && (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Gerando link...
                </p>
              )}

              {escalaLink && (
                <>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      readOnly
                      value={escalaLink}
                      className="w-full flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(`escala-${escalaEscolhida.slug}`, escalaLink)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      {copiedId === `escala-${escalaEscolhida.slug}` ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar link
                        </>
                      )}
                    </button>
                  </div>
                  {vinculado && (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Link exclusivo deste paciente — a resposta aparece na
                      ficha dele, na aba Rastreio. Envie só para ele.
                    </p>
                  )}
                  <a
                    href={escalaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  >
                    Visualizar página
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {user && (
        <div className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            <ClipboardList className="h-5 w-5" />
            Respostas recebidas
          </h2>
          <div className="mt-4">
            <RespostasEscalaList psicologoId={user.id} />
          </div>
        </div>
      )}
    </div>
  );
}
