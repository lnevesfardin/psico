"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, MessageCircle, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchMeuPsicologoContato,
  type MeuPsicologoContato,
} from "@/lib/psicologo-contato-client";
import { toWhatsappLink } from "@/lib/format";
import { BreathingExercise } from "@/components/mood/breathing-exercise";

export function MoodSupportCard({ severe }: { severe: boolean }) {
  const [contato, setContato] = useState<MeuPsicologoContato>(null);

  useEffect(() => {
    const supabase = createClient();
    fetchMeuPsicologoContato(supabase)
      .then(setContato)
      .catch(() => setContato(null));
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-950 dark:bg-amber-950/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <HeartHandshake className="h-4 w-4" />
          Sentimos muito que seu dia esteja sendo {severe ? "tão difícil" : "difícil"}
        </div>
        <p className="mt-1.5 text-sm text-amber-900 dark:text-amber-200">
          Que tal pausar um minuto? Preparamos alguns recursos rápidos que
          podem ajudar agora.
        </p>
      </div>

      <BreathingExercise />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {contato && (
          <a
            href={toWhatsappLink(
              contato.whatsapp,
              `Olá, ${contato.nome}. Registrei um dia difícil no Psico e gostaria de conversar.`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com {contato.nome}
          </a>
        )}
        <a
          href="tel:188"
          className={`flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 ${
            contato ? "" : "sm:col-span-2"
          }`}
        >
          <Phone className="h-4 w-4" />
          CVV: ligue 188 (24h, gratuito)
        </a>
      </div>
    </div>
  );
}
