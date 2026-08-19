"use client";

import {
  Anchor,
  ArrowLeftRight,
  Backpack,
  Ban,
  Bed,
  Bug,
  CircleQuestionMark,
  Cloud,
  CloudRain,
  CloudSun,
  Dog,
  DoorOpen,
  Ear,
  FaceAngry,
  FaceExpressionless,
  FaceGrinning,
  FaceNeutral,
  FaceSlightlyFrowning,
  FaceSlightlySmiling,
  Flame,
  Footprints,
  Gift,
  Ghost,
  HandHelping,
  Heart,
  HeartCrack,
  House,
  Mountain,
  MessageCircle,
  Pencil,
  Repeat,
  Smartphone,
  Thermometer,
  Users,
  VenetianMask,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import type { IconeOpcao } from "@/lib/jogos";

/**
 * Ícones das opções dos jogos.
 *
 * Mora aqui, e não em jogos.ts, porque aquele arquivo é lido por um Server
 * Component (/jogo/[slug]) que repassa o jogo inteiro para um Client
 * Component — e componente React não atravessa essa fronteira (não é
 * serializável). Por isso o catálogo guarda só a chave, e a tradução para
 * ícone acontece no cliente, aqui.
 *
 * Nota de versão: nesta versão do lucide os ícones de rosto foram renomeados
 * (Smile → FaceSlightlySmiling, Frown → FaceSlightlyFrowning, Angry →
 * FaceAngry). Os nomes antigos ainda existem como apelido, mas usar o atual
 * evita depender de compatibilidade que pode sair.
 */
const ICONES: Record<IconeOpcao, LucideIcon> = {
  // Emoções
  alegre: FaceGrinning,
  triste: FaceSlightlyFrowning,
  raiva: FaceAngry,
  medo: Ghost,
  calmo: FaceSlightlySmiling,
  confuso: CircleQuestionMark,
  neutro: FaceNeutral,
  tenso: FaceExpressionless,
  vergonha: VenetianMask,
  culpa: HeartCrack,

  // Tamanho / intensidade
  pequeno: Bug,
  medio: Dog,
  gigante: Mountain,

  // Lugares e momentos
  escola: Backpack,
  dormir: Bed,
  casa: House,
  sozinho: DoorOpen,
  sempre: Repeat,
  familia: Users,
  internet: Smartphone,
  espelho: CircleQuestionMark,

  // Clima (como estou agora)
  sol: CloudSun,
  nublado: Cloud,
  chuva: CloudRain,

  // Comunicação e conflito
  calar: VolumeX,
  explodir: Flame,
  ironia: FaceExpressionless,
  afastar: Footprints,
  conversar: MessageCircle,
  desculpar: HandHelping,
  justificar: Pencil,
  evitar: Cloud,
  compensar: Gift,
  ouvir: Ear,
  calma: Thermometer,
  dizer: Heart,
  ceder: ArrowLeftRight,
  firmeza: Anchor,
  bloquear: Ban,
};

export function IconeDaOpcao({
  nome,
  className,
}: {
  nome: IconeOpcao;
  className?: string;
}) {
  const Icone = ICONES[nome];
  if (!Icone) return null;
  return <Icone className={className} />;
}
