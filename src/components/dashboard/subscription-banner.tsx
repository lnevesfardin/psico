import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Aviso fixo no topo do painel quando a assinatura não está em dia. A trava
 * de verdade é a RLS (ver assinatura_ativa() no schema.sql) — isto existe
 * porque, sem o aviso, a pessoa preencheria uma ficha inteira e tomaria um
 * erro seco de permissão do Postgres, sem entender que é cobrança.
 */
export function SubscriptionBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:text-amber-200">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Assinatura inativa.</strong> Você continua
            vendo e exportando seus prontuários e pacientes, mas não consegue criar nem
            editar nada até reativar o plano.
          </span>
        </p>
        <Link
          href="/dashboard/perfil"
          className="shrink-0 self-start rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 sm:self-auto"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
}
