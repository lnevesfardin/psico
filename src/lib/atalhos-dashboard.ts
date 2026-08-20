import {
  CalendarDays,
  ChartColumn,
  FileSignature,
  Link2,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Atalhos que o psicólogo pode deixar na tela de Início.
 *
 * Arquivo de uso exclusivo do cliente: guarda o componente do ícone direto
 * (e não uma chave, como jogos.ts precisa fazer), porque nada aqui atravessa
 * a fronteira servidor → cliente, onde função não é serializável.
 */

export type AtalhoId =
  | "nova-ficha"
  | "pacientes"
  | "agenda"
  | "atividade"
  | "link"
  | "financeiro"
  | "relatorios"
  | "documentos"
  | "perfil";

export type Atalho = {
  id: AtalhoId;
  titulo: string;
  descricao: string;
  href: string;
  icone: LucideIcon;
};

export const ATALHOS_DISPONIVEIS: Atalho[] = [
  {
    id: "nova-ficha",
    titulo: "Nova ficha",
    descricao: "Cadastrar paciente",
    href: "/dashboard/pacientes",
    icone: UserPlus,
  },
  {
    id: "pacientes",
    titulo: "Pacientes",
    descricao: "Fichas e prontuários",
    href: "/dashboard/pacientes",
    icone: Users,
  },
  {
    id: "agenda",
    titulo: "Agenda",
    descricao: "Ver e marcar consultas",
    href: "/dashboard/agenda",
    icone: CalendarDays,
  },
  {
    id: "atividade",
    titulo: "Enviar atividade",
    descricao: "Espaço Interativo",
    href: "/dashboard/espaco-interativo",
    icone: Sparkles,
  },
  {
    id: "link",
    titulo: "Meu link",
    descricao: "Compartilhar agenda",
    href: "/dashboard/link",
    icone: Link2,
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    descricao: "Recebimentos e recibos",
    href: "/dashboard/financeiro",
    icone: Wallet,
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    descricao: "Faturamento e presença",
    href: "/dashboard/relatorios",
    icone: ChartColumn,
  },
  {
    id: "documentos",
    titulo: "Documentos",
    descricao: "Modelos e emissão",
    href: "/dashboard/documentos",
    icone: FileSignature,
  },
  {
    id: "perfil",
    titulo: "Meu perfil",
    descricao: "Dados, logo e horários",
    href: "/dashboard/perfil",
    icone: UserCog,
  },
];

/** Referência estável: usada como snapshot do servidor (ver getSnapshot). */
const PADRAO: AtalhoId[] = ["nova-ficha", "atividade", "link"];

const CHAVE = "atalhos-inicio";

export function atalhoPorId(id: AtalhoId): Atalho | undefined {
  return ATALHOS_DISPONIVEIS.find((a) => a.id === id);
}

// Cache do valor já convertido. useSyncExternalStore exige que getSnapshot
// devolva a MESMA referência enquanto nada mudar — devolver um array novo a
// cada chamada colocaria o React em laço infinito de renderização.
let brutoEmCache: string | null = null;
let listaEmCache: AtalhoId[] = PADRAO;

function converter(bruto: string | null): AtalhoId[] {
  if (!bruto) return PADRAO;
  try {
    const lidos = JSON.parse(bruto);
    if (!Array.isArray(lidos)) return PADRAO;
    // Filtra ids desconhecidos: atalho removido do catálogo numa versão nova
    // não pode quebrar a tela de quem tinha ele salvo.
    return lidos.filter((id): id is AtalhoId => Boolean(atalhoPorId(id)));
  } catch {
    return PADRAO;
  }
}

export function lerAtalhos(): AtalhoId[] {
  const bruto = localStorage.getItem(CHAVE);
  if (bruto !== brutoEmCache) {
    brutoEmCache = bruto;
    listaEmCache = converter(bruto);
  }
  return listaEmCache;
}

/** Snapshot do servidor: sempre o padrão, que não depende do navegador. */
export function atalhosPadrao(): AtalhoId[] {
  return PADRAO;
}

export function salvarAtalhos(ids: AtalhoId[]): void {
  localStorage.setItem(CHAVE, JSON.stringify(ids));
  window.dispatchEvent(new Event("atalhoschange"));
}

export function subscribeAtalhos(callback: () => void) {
  window.addEventListener("atalhoschange", callback);
  return () => window.removeEventListener("atalhoschange", callback);
}
