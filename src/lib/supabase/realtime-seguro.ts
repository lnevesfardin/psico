import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * .subscribe() do Realtime abre um WebSocket na hora, de forma síncrona —
 * dentro de um useEffect, sem try/catch nenhum. Em navegador embutido
 * restrito (confirmado com o navegador do WhatsApp, ao investigar um
 * paciente preso na tela "Algo deu errado nesta tela" logo no primeiro
 * acesso) essa chamada lança "SecurityError: The operation is insecure" /
 * "WebSocket not available" direto — o erro escapa do efeito e derruba a
 * página inteira, mesmo a página funcionando perfeitamente sem tempo real
 * (os dados iniciais sempre vêm de uma consulta HTTP normal, à parte).
 *
 * Por isso toda inscrição em canal do Realtime deste projeto passa por
 * aqui: se abrir o WebSocket falhar, a tela perde só a atualização ao vivo
 * — nunca a tela inteira.
 */
export function inscreverComSeguranca(
  criarInscricao: () => RealtimeChannel
): RealtimeChannel | null {
  try {
    return criarInscricao();
  } catch {
    return null;
  }
}

/** Remove o canal só se ele chegou a ser criado (ver inscreverComSeguranca). */
export function encerrarInscricao(
  supabase: { removeChannel: (channel: RealtimeChannel) => unknown },
  channel: RealtimeChannel | null
): void {
  if (channel) supabase.removeChannel(channel);
}
