"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  Loader2,
  Mic,
  MonitorSpeaker,
  Sparkles,
  Square,
  Undo2,
  X,
} from "lucide-react";
import {
  startSessionRecorder,
  type SessionRecorder,
} from "@/lib/audio/session-recorder";

/**
 * ~2,9 MB por trecho em WAV 16 kHz mono — abaixo do limite de corpo de
 * requisição da Vercel (~4,5 MB), com folga para o overhead do multipart.
 */
const SEGMENT_SECONDS = 90;

type Phase = "idle" | "recording" | "finishing" | "review";

type Segment = { status: "pending" | "ok" | "erro"; texto: string };

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function transcreverTrecho(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", wav, "trecho.wav");
  const res = await fetch("/api/gemini/transcrever-sessao", {
    method: "POST",
    body: form,
  });
  const data = (await res.json().catch(() => null)) as {
    texto?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? "Falha ao transcrever o trecho.");
  }
  return (data?.texto ?? "").trim();
}

async function resumirSessao(texto: string): Promise<string> {
  const res = await fetch("/api/gemini/resumir-sessao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  const data = (await res.json().catch(() => null)) as {
    resumo?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? "Falha ao gerar o rascunho.");
  }
  const resumo = (data?.resumo ?? "").trim();
  if (!resumo || resumo === "[transcrição insuficiente para gerar um resumo]") {
    throw new Error(
      "A transcrição não tem conteúdo suficiente para gerar um rascunho."
    );
  }
  return resumo;
}

export function SessionTranscriptionModal({
  patientName,
  onClose,
  onSave,
}: {
  patientName: string;
  onClose: () => void;
  onSave: (input: {
    texto: string;
    duracaoSegundos: number;
    consentimentoEm: string;
    origem: "transcricao" | "resumo_ia";
  }) => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [consentimento, setConsentimento] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [texto, setTexto] = useState("");
  const [versao, setVersao] = useState<"transcricao" | "resumo">("transcricao");
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<SessionRecorder | null>(null);
  const consentimentoEmRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Transcrição original, congelada assim que a gravação termina — é o que
  // "Ver transcrição original" restaura, mesmo depois de gerar (ou editar)
  // um rascunho de evolução, pra gerar o resumo nunca ser destrutivo.
  const transcricaoOriginalRef = useRef("");
  // Fila serializada: os trechos são transcritos na ordem em que foram
  // gravados, um de cada vez, para o texto final não sair embaralhado.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const segmentsRef = useRef<Segment[]>([]);

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Se a aba for fechada no meio da gravação, ao menos solta o microfone.
  useEffect(() => {
    return () => {
      recorderRef.current?.stop().catch(() => {});
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  function enqueueSegment(wav: Blob) {
    const index = segmentsRef.current.length;
    segmentsRef.current = [
      ...segmentsRef.current,
      { status: "pending", texto: "" },
    ];
    setSegments(segmentsRef.current);

    queueRef.current = queueRef.current.then(async () => {
      let resultado: Segment;
      try {
        resultado = { status: "ok", texto: await transcreverTrecho(wav) };
      } catch {
        resultado = { status: "erro", texto: "[trecho não transcrito]" };
      }
      segmentsRef.current = segmentsRef.current.map((s, i) =>
        i === index ? resultado : s
      );
      setSegments(segmentsRef.current);
    });
  }

  async function handleStart() {
    setError(null);
    try {
      consentimentoEmRef.current = new Date().toISOString();
      recorderRef.current = await startSessionRecorder({
        segmentSeconds: SEGMENT_SECONDS,
        onSegment: (wav) => enqueueSegment(wav),
      });
      // Impede a tela de apagar durante o atendimento: em vários aparelhos
      // o processamento de áudio é suspenso junto com a tela.
      try {
        wakeLockRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Sem wake lock (navegador sem suporte ou bateria baixa) a gravação
        // continua normalmente — por isso o aviso pedindo o aparelho na tomada.
      }
      setPhase("recording");
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Permissão de microfone negada. Autorize o microfone no navegador para gravar."
          : "Não foi possível acessar o microfone deste dispositivo."
      );
    }
  }

  async function handleStop() {
    setPhase("finishing");
    try {
      await recorderRef.current?.stop();
      recorderRef.current = null;
      await wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      await queueRef.current;
    } catch {
      setError("Houve uma falha ao finalizar a gravação.");
    }

    const partes = segmentsRef.current
      .map((s) => s.texto.trim())
      .filter((t) => t && t !== "[sem fala audível]");
    const juntas = partes.join("\n\n");
    transcricaoOriginalRef.current = juntas;
    setTexto(juntas);
    setVersao("transcricao");
    setPhase("review");
  }

  async function handleGerarResumo() {
    const base = texto.trim();
    if (!base) return;
    setError(null);
    setGerandoResumo(true);
    try {
      const resumo = await resumirSessao(base);
      setTexto(resumo);
      setVersao("resumo");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível gerar o rascunho."
      );
    } finally {
      setGerandoResumo(false);
    }
  }

  function handleVoltarTranscricao() {
    setTexto(transcricaoOriginalRef.current);
    setVersao("transcricao");
  }

  async function handleSave() {
    const conteudo = texto.trim();
    if (!conteudo) {
      setError("A transcrição está vazia.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        texto: conteudo,
        duracaoSegundos: elapsed,
        consentimentoEm: consentimentoEmRef.current ?? new Date().toISOString(),
        origem: versao === "resumo" ? "resumo_ia" : "transcricao",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar."
      );
      setSaving(false);
    }
  }

  const transcritos = segments.filter((s) => s.status !== "pending").length;
  const comErro = segments.some((s) => s.status === "erro");
  const podeFechar = phase === "idle" || phase === "review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={podeFechar ? onClose : undefined}
        aria-hidden
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            <MonitorSpeaker className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            Transcrição de sessão
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={!podeFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {(phase === "idle" || phase === "recording") && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
            <BatteryCharging className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Garanta que o dispositivo esteja <strong>carregado</strong> e{" "}
              <strong>próximo aos falantes</strong> para captar o áudio de forma
              clara e limpa.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        {phase === "idle" && (
          <>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              Transcreva toda a sua sessão com{" "}
              <strong className="text-zinc-900 dark:text-white">
                {patientName}
              </strong>{" "}
              durante o atendimento. O áudio é usado apenas para gerar o texto e{" "}
              <strong>não fica armazenado</strong> — só a transcrição, depois de
              você revisar e salvar.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              />
              <span>
                Confirmo que {patientName} foi informado(a) e{" "}
                <strong>consentiu com a gravação</strong> desta sessão. A data e
                hora desta confirmação ficam registradas no prontuário.
              </span>
            </label>

            <button
              type="button"
              onClick={handleStart}
              disabled={!consentimento}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mic className="h-4 w-4" />
              Iniciar gravação
            </button>
          </>
        )}

        {(phase === "recording" || phase === "finishing") && (
          <>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <span className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
                </span>
                {phase === "recording" ? "A GRAVAR" : "FINALIZANDO"}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                {formatTimer(elapsed)}
              </span>
            </div>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {segments.length === 0
                ? "O primeiro trecho é transcrito após cerca de 1 minuto e meio."
                : `${transcritos} de ${segments.length} trecho(s) transcrito(s).`}
            </p>

            {phase === "recording" ? (
              <button
                type="button"
                onClick={handleStop}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
              >
                <Square className="h-4 w-4" />
                Parar e transcrever
              </button>
            ) : (
              <p className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transcrevendo os últimos trechos...
              </p>
            )}
          </>
        )}

        {phase === "review" && (
          <>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {versao === "resumo"
                ? "Revise o rascunho de evolução antes de salvar — texto gerado automaticamente pode conter erros ou imprecisões."
                : "Revise a transcrição antes de salvar — texto gerado automaticamente pode conter erros."}{" "}
              Duração: {formatTimer(elapsed)}.
            </p>

            {comErro && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Alguns trechos não puderam ser transcritos e estão marcados como
                [trecho não transcrito].
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleGerarResumo}
                disabled={gerandoResumo || !texto.trim()}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {gerandoResumo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {gerandoResumo
                  ? "Gerando rascunho..."
                  : "Gerar rascunho de evolução com IA"}
              </button>

              {versao === "resumo" && (
                <button
                  type="button"
                  onClick={handleVoltarTranscricao}
                  className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Ver transcrição original
                </button>
              )}
            </div>

            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={12}
              placeholder="Nenhuma fala foi captada nesta gravação."
              className="mt-2 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !texto.trim()}
                className="flex-1 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar no prontuário"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
