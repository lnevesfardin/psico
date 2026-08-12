const STEPS = ["Criar conta", "Confirmar e-mail", "Finalizar cadastro"] as const;

/** Indicador de progresso do cadastro (criar conta → confirmar e-mail →
 *  finalizar cadastro), igual para psicólogo e cliente — só o conteúdo do
 *  passo 3 muda por papel (ver onboarding-psicologo.tsx / onboarding-cliente.tsx). */
export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
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
