import { Clock3, ShieldCheck } from "lucide-react";
import type { CrpStatus } from "@/lib/profile-data";

export function CrpStatusBadge({ status }: { status: CrpStatus }) {
  const verificado = status === "verificado";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        verificado
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      }`}
    >
      {verificado ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <Clock3 className="h-3.5 w-3.5" />
      )}
      {verificado ? "CRP Verificado" : "CRP em análise"}
    </span>
  );
}
