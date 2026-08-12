const STEPS = ["Criar conta", "Finalizar cadastro"] as const;

/** Indicador de progresso do cadastro (criar conta → finalizar cadastro),
 *  igual para psicólogo e cliente — só o conteúdo do passo 2 muda por papel
 *  (ver onboarding-psicologo.tsx / onboarding-cliente.tsx). Sem passo de
 *  confirmar e-mail: com "Confirm email" desligado no Supabase, a conta já
 *  nasce com sessão; se estiver ligado, a pessoa confirma pelo link do
 *  e-mail (ver auth-form.tsx / convite-signup.tsx), sem precisar de uma
 *  tela própria aqui. */
export function StepIndicator({ current }: { current: 1 | 2 }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
        Passo {current} de {STEPS.length} · {STEPS[current - 1]}
      </p>
      <div className="mt-2 flex gap-1.5">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i + 1 <= current
                ? "bg-brand-600"
                : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
