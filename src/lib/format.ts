export function formatDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDateShort(iso: string): string {
  // Timestamp completo (data_hora de sessão, created_at) precisa virar hora
  // local antes de virar data: uma sessão das 21h no Brasil é o dia seguinte
  // em UTC. Antes desta guarda, o split("-") transformava "2026-08-17T12:00Z"
  // em dia NaN e a tela mostrava "Invalid Date" sem erro nenhum no console.
  if (iso.includes("T")) return new Date(iso).toLocaleDateString("pt-BR");

  // Data pura ("yyyy-mm-dd", ex.: nascimento) é montada campo a campo de
  // propósito: new Date("2026-08-17") seria lida como UTC e voltaria um dia
  // para quem está a oeste de Greenwich.
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("pt-BR");
  const timePart = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} às ${timePart}`;
}

/** "6 de agosto de 2026" — usado no fecho de documentos gerados (atestado, declaração etc.). */
export function formatDateExtenso(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Datas de consulta são sempre horário de Brasília (consultas.data é um
// `date` sem fuso). toISOString() devolve UTC, então entre 21h e meia-noite
// ele já apontava para o dia seguinte — a "Agenda de Hoje" mostrava o dia
// errado e o formulário de nova consulta nascia com a data trocada.
// "en-CA" é usado só porque formata como yyyy-mm-dd.
const FUSO_BR = "America/Sao_Paulo";

function isoNoFusoBr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR }).format(date);
}

export function todayIso(): string {
  return isoNoFusoBr(new Date());
}

// "HH:mm" de agora em Brasília. getHours() do navegador não serve pra
// comparar com horário de consulta: quem abre o link de outro fuso (Manaus,
// Acre, ou fora do país) veria a lista de horários livres deslocada — em
// Manaus, -1h, sobrariam slots que já passaram em Brasília.
export function nowTimeBr(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function nextDays(count: number): string[] {
  const days: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(isoNoFusoBr(d));
  }
  return days;
}

export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// "06/123456": 2 dígitos da região + até 6 do registro — cobre o formato
// usual do CRP; quem tiver um número fora desse padrão ainda consegue
// digitar a barra na mão, o input não é só dígitos.
export function maskCrp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function formatEndereco(partes: {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}): string {
  const linha1 = [partes.rua, partes.numero].filter(Boolean).join(", ");
  const linha2 = [partes.bairro, [partes.cidade, partes.uf].filter(Boolean).join(" - ")]
    .filter(Boolean)
    .join(", ");
  return [linha1, linha2].filter(Boolean).join(" - ");
}

export function toWhatsappLink(phone: string, message?: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length <= 11) digits = `55${digits}`;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${query}`;
}
