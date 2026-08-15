/**
 * Um update/delete barrado pela RLS não é erro para o PostgREST: a resposta
 * volta com sucesso e zero linhas afetadas. Sem conferir isso, a tela marca a
 * ação como concluída e o dado reaparece no próximo carregamento — o pior
 * tipo de falha aqui, porque o psicólogo acredita que apagou/alterou algo do
 * prontuário e não apagou.
 *
 * Hoje isso acontece de verdade, não só em teoria: desde que as policies de
 * escrita passaram a exigir assinatura_ativa() (ver schema.sql), toda edição
 * feita com o plano inativo cai exatamente nesse caminho.
 *
 * Uso: encadeie .select(...) no update/delete e passe o data pra cá.
 *
 * Não serve para operação em lote onde zero linhas é resultado legítimo
 * (ex.: "marcar todos como lidos" sem nenhum não-lido) — só para escrita com
 * alvo único, em que zero linhas significa necessariamente que não funcionou.
 */
export function exigirLinhaAfetada(
  linhas: unknown[] | null,
  oQue: string
): void {
  if (linhas && linhas.length > 0) return;
  throw new Error(
    `${oQue} não foi salvo no banco de dados. Se sua assinatura estiver ` +
      `inativa, reative o plano; caso contrário, confirme se o schema.sql ` +
      `mais recente foi executado no SQL Editor do Supabase.`
  );
}
