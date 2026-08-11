import type { NextConfig } from "next";

// Origem do Supabase, extraída da própria env var em vez de fixar o ref do
// projeto no código — funciona em qualquer ambiente (local/preview/prod)
// sem precisar manter isso em sincronia manualmente.
function supabaseOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
}

function buildCsp(): string {
  const connectSrc = ["'self'", supabaseOrigin()].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    // O App Router injeta scripts inline pro streaming/hidratação do RSC, e
    // src/app/layout.tsx tem um <script> inline que aplica o tema salvo
    // antes da primeira pintura (evita flash de tema errado). Sem
    // 'unsafe-inline' o site inteiro para de hidratar. Mesmo assim, isto
    // continua bloqueando <script src> de qualquer domínio externo — a
    // principal via de um XSS injetado tentar carregar payload de fora.
    "script-src 'self' 'unsafe-inline'",
    // React renderiza style={{...}} como atributo style="" no HTML (usado
    // em barra de progresso, medidor de força de senha, gráfico de humor,
    // hábitos) — precisa de 'unsafe-inline' aqui pelo mesmo motivo.
    "style-src 'self' 'unsafe-inline'",
    // 'https:' (não só o host do Supabase): o psicólogo pode colar uma URL
    // de foto de perfil externa (src/app/dashboard/perfil/page.tsx) —
    // restringir a um host só quebraria essa opção. 'data:' cobre a foto
    // enviada por upload, salva como base64 inline no banco.
    "img-src 'self' data: https:",
    // next/font baixa e serve a fonte localmente no build (self-hosted) —
    // nunca busca em fonts.googleapis.com em runtime.
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    // Só em produção: o dev server (Turbopack) usa WebSocket pro hot reload
    // de um jeito que não dá pra validar sem testar num navegador de
    // verdade, e travar isso errado quebraria o ambiente de
    // desenvolvimento sem nenhum ganho de segurança (CSP só importa pra
    // quem realmente usa o site, nunca em localhost).
    if (process.env.NODE_ENV !== "production") return [];

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // microphone: a transcrição de sessão grava áudio pelo
            // navegador (getUserMedia) — sem isso a feature quebra.
            // screen-wake-lock: mantém a tela acesa durante a gravação.
            value:
              "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), screen-wake-lock=(self)",
          },
          {
            key: "Strict-Transport-Security",
            // 1 ano, sem "preload": submeter à lista de preload do
            // navegador é uma decisão separada e não muito reversível —
            // fica pra quando o domínio final estiver definido.
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Content-Security-Policy", value: buildCsp() },
        ],
      },
    ];
  },
};

export default nextConfig;
