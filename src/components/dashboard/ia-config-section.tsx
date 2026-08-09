"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { getIaAtiva, getOrgId, updateIaAtiva } from "@/lib/organizacao-client";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

// Interruptor geral — desligar aqui bloqueia toda chamada de IA da
// organização inteira (chat assistente, extração de lançamento, transcrição
// de sessão e os 4 recursos do módulo clínico), verificado no servidor em
// cada route handler (ver src/lib/ia/guards.ts), não só escondido na UI.
export function IaConfigSection() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([getOrgId(supabase, user.id), getIaAtiva(supabase)])
      .then(([id, ia]) => {
        setOrgId(id);
        setAtiva(ia);
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleToggle(v: boolean) {
    if (!orgId) return;
    const anterior = ativa;
    setAtiva(v);
    setSaving(true);
    try {
      const supabase = createClient();
      await updateIaAtiva(supabase, orgId, v);
    } catch {
      setAtiva(anterior);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mt-8 rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <Sparkles className="h-4 w-4" />
        Inteligência artificial
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Usar recursos de IA nesta organização
          </p>
          <p className="mt-1 max-w-md text-xs text-zinc-400 dark:text-zinc-600">
            Desligar aqui bloqueia todos os recursos de IA — assistente de chat,
            transcrição de sessão, rascunho de evolução, resumo pré-sessão,
            temas recorrentes e assistente administrativo — para todos os
            psicólogos desta organização.
            {saving && " Salvando..."}
          </p>
        </div>
        <Toggle checked={ativa} onChange={handleToggle} />
      </div>

      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
        Mesmo com a IA ligada, cada recurso clínico só funciona para
        pacientes que aceitaram o consentimento de processamento por IA pelo
        próprio portal — toda saída nasce como rascunho, nunca assina nada
        sozinha.
      </p>
    </div>
  );
}
