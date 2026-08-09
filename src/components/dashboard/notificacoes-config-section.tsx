"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  getConfiguracaoNotificacoes,
  getOrgId,
  getPrazoCancelamentoHoras,
  updateConfiguracaoNotificacoes,
  updatePrazoCancelamentoHoras,
  type ConfiguracaoNotificacoes,
} from "@/lib/organizacao-client";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-brand-600" : "bg-zinc-200 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function NotificacoesConfigSection() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfiguracaoNotificacoes | null>(null);
  const [prazoCancelamento, setPrazoCancelamento] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      getOrgId(supabase, user.id),
      getConfiguracaoNotificacoes(supabase),
      getPrazoCancelamentoHoras(supabase),
    ])
      .then(([id, cfg, prazo]) => {
        setOrgId(id);
        setConfig(cfg);
        setPrazoCancelamento(prazo);
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSave() {
    if (!orgId || !config) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await Promise.all([
        updateConfiguracaoNotificacoes(supabase, orgId, config),
        updatePrazoCancelamentoHoras(supabase, orgId, prazoCancelamento),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return null;
  }

  return (
    <div className="mt-8 rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <BellRing className="h-4 w-4" />
        Lembretes de consulta
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Enviar lembretes automáticos
          </span>
          <Toggle
            checked={config.ativo}
            onChange={(v) => setConfig({ ...config, ativo: v })}
          />
        </div>

        {config.ativo && (
          <>
            <div className="flex items-center justify-between pl-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Lembrete 1 hora antes
              </span>
              <Toggle
                checked={config.lembrete1hAtivo}
                onChange={(v) => setConfig({ ...config, lembrete1hAtivo: v })}
              />
            </div>
            <div className="flex items-center justify-between pl-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Lembrete 24 horas antes
              </span>
              <Toggle
                checked={config.lembrete24hAtivo}
                onChange={(v) => setConfig({ ...config, lembrete24hAtivo: v })}
              />
            </div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Complemento na mensagem (opcional)
              <input
                type="text"
                value={config.mensagemExtra}
                onChange={(e) => setConfig({ ...config, mensagemExtra: e.target.value })}
                placeholder="Ex.: chegue com 10 minutos de antecedência."
                maxLength={140}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <span className="mt-1 block text-xs text-zinc-400 dark:text-zinc-600">
                Só um complemento curto — a mensagem em si é sempre neutra
                (data, hora e local), nunca conteúdo clínico, porque pode ser
                lida por terceiros.
              </span>
            </label>
          </>
        )}

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Prazo mínimo para o paciente cancelar pelo portal
          <select
            value={prazoCancelamento}
            onChange={(e) => setPrazoCancelamento(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value={0}>Sem prazo mínimo</option>
            <option value={2}>2 horas antes</option>
            <option value={6}>6 horas antes</option>
            <option value={12}>12 horas antes</option>
            <option value={24}>24 horas antes</option>
            <option value={48}>48 horas antes</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
