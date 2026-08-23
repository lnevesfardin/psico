import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt =
  "Psico — prontuário eletrônico, agenda e financeiro para consultórios de psicologia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Embutida como data URI: o gerador (Satori) não resolve caminho relativo de
// /public em tempo de requisição, só URL remota ou data URI — e antes nem
// precisava disso, porque a marca virava um quadrado desenhado (ver embaixo).
const logoBase64 = readFileSync(join(process.cwd(), "public/logo.png")).toString(
  "base64"
);

/**
 * Imagem de compartilhamento (WhatsApp, Instagram, LinkedIn), gerada em build
 * em vez de um PNG no /public: assim o texto acompanha o site sem ninguém
 * precisar reabrir editor de imagem. Sem fonte customizada de propósito —
 * carregar .ttf aqui só encareceria o build por uma diferença que a miniatura
 * não mostra.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#0d1117",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, #5c714355 0%, transparent 55%)",
          padding: "80px 90px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- gerador
              de imagem (Satori), não uma página; next/image não se aplica. */}
          <img
            src={`data:image/png;base64,${logoBase64}`}
            width={44}
            height={44}
            alt=""
            style={{ objectFit: "contain" }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, color: "#b3c39a" }}>
            {SITE_NAME}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#ffffff",
            maxWidth: 900,
          }}
        >
          Gestão de consultório de psicologia sem complicação
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 30,
            lineHeight: 1.4,
            color: "#a1a1aa",
            maxWidth: 860,
          }}
        >
          Prontuário eletrônico, agenda online, pacientes e financeiro em um só
          sistema.
        </div>
      </div>
    ),
    size
  );
}
