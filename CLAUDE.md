# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Soma Beta (Psi Rob)

Plataforma web para consultórios e clínicas de psicologia: agendamento de consultas, gestão de pacientes, prontuário eletrônico, check-in de humor/hábitos e materiais de apoio (dados clínicos sensíveis).

## Stack

- Next.js (App Router) — ver `node_modules/next/dist/docs/` antes de usar APIs, pois esta versão pode ter mudanças em relação ao que você já conhece.
- React 19, TypeScript (strict)
- Tailwind CSS v4 (config via `@theme inline` em `src/app/globals.css`, sem `tailwind.config.js`)
- Supabase (Postgres + Auth + Storage) como backend único
- ESLint (`eslint-config-next`, core-web-vitals + typescript)

## Comandos

```bash
npm run dev      # dev server (Turbopack)
npm run build    # build de produção — roda o typecheck completo do Next.js
npm run lint     # eslint
npm run start    # serve o build de produção
```

Não existe suíte de testes automatizados neste projeto. Verificação de qualidade é: `npm run lint` limpo + `npm run build` limpo (o build pega erros de tipo que `tsc --noEmit` isolado não pega, por causa da checagem de rotas do Next) + teste manual no navegador dos fluxos alterados. Para build/dev local sem Supabase real, um `.env.local` com valores placeholder em `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` é suficiente para compilar (as chamadas ao Supabase falham em runtime, mas isso não bloqueia lint/build).

## Arquitetura

### Banco de dados é a fonte de verdade e não é aplicado automaticamente

`schema.sql` na raiz define o schema inteiro (tabelas, RLS, policies, funções, triggers, bucket de storage) e **precisa ser copiado e rodado manualmente no SQL Editor do Supabase** sempre que mudar — não há migrations nem CLI do Supabase configurada. Por isso todo o arquivo é escrito para ser idempotente e seguro de re-rodar do zero: `create table if not exists`, `alter table ... add column if not exists`, e todo `create policy`/`create or replace function` é precedido de `drop policy if exists`/fica com `create or replace`. Ao editar o schema, sempre siga esse padrão e lembre o usuário de re-rodar o arquivo no Supabase.

Tabelas principais: `profiles` (conta genérica, todo usuário), `perfis` (perfil profissional do psicólogo), `pacientes` (cadastro feito pelo psicólogo), `disponibilidades`, `consultas`, `sessoes_prontuario`, `lancamentos_financeiros`, `checkins_humor`, `habitos_paciente`/`registros_habito`, `diario_paciente`, `materiais_paciente`, `convites_paciente`, `avisos_psicologo`, `notificacoes` (fila de lembretes), `app_secrets`.

### RLS é o único mecanismo de autorização — não existem Server Actions

Mutações acontecem direto do Client Component via `supabase-js` (ver `src/lib/*-client.ts`), nunca por Server Action ou route handler. A segurança é 100% imposta por Row Level Security no Postgres. Isso implica um gotcha recorrente: **uma policy que faz subquery em outra tabela protegida por RLS roda com a permissão de quem chamou, não do dono da tabela**. Ex.: `pacientes` só tem `select` para o psicólogo dono; qualquer policy em outra tabela que tentasse `exists (select 1 from pacientes where cliente_user_id = auth.uid())` para autorizar o *cliente* sempre voltaria vazia, mesmo sendo o dado do próprio cliente — porque o cliente nunca teve `select` em `pacientes` (ela carrega anotação clínica que não é pra ele ler). A correção é uma função `security definer` que devolve só o necessário (geralmente um boolean), nunca a linha inteira — ver `eh_meu_paciente()`, `meu_psicologo_contato()`, `convite_info()` em `schema.sql` como padrão a seguir sempre que uma policy precisar "espiar" outra tabela.

Três clientes Supabase, cada um para um contexto:
- `src/lib/supabase/client.ts` — browser, Client Components, respeita RLS normalmente.
- `src/lib/supabase/server.ts` — Server Components e Route Handlers, cookie-based (via `@supabase/ssr`), respeita RLS como o usuário logado.
- `src/lib/supabase/admin.ts` — service role key, **só pode ser importado em código server-only** (route handlers/cron), ignora RLS por completo. Usado pelo despachante de notificações, que precisa ler dados de todos os psicólogos sem usuário logado no contexto.

### Dois papéis, roteamento e onboarding

`profiles.role` é `'client' | 'psychologist' | null` e é travado por trigger (`block_role_change`) depois de definido — nunca muda. `src/lib/auth/role.ts` centraliza `fetchUserRole`/`dashboardPathForRole`. `proxy.ts` (middleware) protege `/dashboard`, `/agendamentos`, `/onboarding`, `/login`, `/cadastro`; os layouts de `src/app/dashboard/` e `src/app/agendamentos/` fazem a segunda checagem de role e redirecionam pro painel certo.

**Conta de cliente/paciente não é auto-serviço.** `/cadastro` só cria conta de psicólogo. A conta de paciente só nasce por convite: o psicólogo gera um link em `convites_paciente` a partir da ficha do paciente (`gerar_convite_paciente`), e quem abre `/convite/[token]` cria a conta já vinculada àquela ficha (`aceitar_convite_paciente`, que também adota as consultas antigas feitas sem login). Login social (Google) sem role definida vira psicólogo automaticamente em `src/app/auth/callback/route.ts`.

Agendamento de consulta em si **não exige login**: `/agendar/[psicologoId]` é uma página pública por psicólogo (o "Meu Link de Agendamento" do painel, com variantes `?modalidade=online|presencial`), onde qualquer visitante preenche um mini-cadastro e agenda direto via a RPC `criar_agendamento_publico`.

### Notificações: dois canais diferentes

- **Imediatas** (cancelamento de consulta, humor não compartilhado, etc.): enviadas na hora por um route handler que chama a Brevo (`src/lib/notificacoes/email.ts` + `templates.ts`), sem passar por fila.
- **Lembrete de 1h antes da consulta**: outbox pattern via tabela `notificacoes`, enfileirado e despachado por `POST /api/notificacoes/dispatch`, chamado por `pg_cron` (protegido por `CRON_SECRET`, comparado com `timingSafeEqual`). Também existe um canal de webhook genérico (`src/lib/notificacoes/webhook.ts`) para integrações externas (Zapier/n8n/WhatsApp).
- **Avisos in-app**: sino de notificações no dashboard do psicólogo (`notification-bell.tsx` + `avisos_psicologo`), para eventos como "paciente parou de compartilhar humor".

### Armazenamento de arquivos

Único bucket do Supabase Storage (`materiais-paciente`), **privado** — leitura só por signed URL com expiração (`src/lib/materiais-client.ts`). O caminho de cada objeto começa com o `paciente_id` (`{paciente_id}/{arquivo}`), e é isso que as policies de `storage.objects` usam para decidir acesso — mesmo gotcha de RLS-sobre-RLS acima se aplica lá.

### Funcionalidades de IA (Gemini)

`src/app/api/gemini/route.ts` roda o assistente de chat, com prompt de sistema segregado por role (psicólogo vs. cliente veem funcionalidades diferentes, e cada um só recebe o prompt do que existe na própria área). `extrair-lancamento/route.ts` faz extração estruturada (JSON schema) de um lançamento financeiro a partir de texto livre. `transcrever-sessao/route.ts` transcreve trechos de áudio da sessão gravados no navegador — a gravação é feita manualmente via Web Audio API em vez de `MediaRecorder` porque o formato nativo do Chrome (`audio/webm`) não está entre os aceitos pelo Gemini (ver `src/lib/audio/session-recorder.ts`).

### Datas e fuso horário

O app inteiro assume horário de Brasília (sem horário de verão desde 2019, offset fixo `-03:00`). Datas "de hoje" (`checkins_humor.data`, `registros_habito.data`) são sempre calculadas no cliente via `todayIso()` (`src/lib/format.ts`) e enviadas explicitamente — nunca `current_date`/`now()` do servidor, que é UTC e erra a data perto da meia-noite.

## Convenções de código

- TypeScript em modo strict; não usar `any` — tipar dados de pacientes, sessões e agendamentos explicitamente.
- Server Components por padrão; `"use client"` só onde há interatividade.
- Nomes de arquivos e componentes em inglês; textos de UI em português (pt-BR), já que o público é clínico/paciente brasileiro.
- Sem comentários explicando o óbvio; comentar apenas decisões não triviais (regras de negócio, gotchas de RLS/timezone, exceções de LGPD).
- Componentes de UI reutilizáveis genéricos ficam em `src/components/ui/` (segue convenção estilo shadcn: `cn()` em `src/lib/utils.ts` via `clsx` + `tailwind-merge`); lógica de domínio (agendamento, prontuário, pacientes) fica separada em `src/lib/*-client.ts`, um arquivo por domínio.
- `originkit-main/` na raiz é um plugin de terceiro solto, não é código da aplicação — já ignorado por ESLint e excluído do `tsconfig.json`.

## Dados sensíveis e LGPD

- Nunca logar conteúdo de prontuário, CPF, diário ou outro dado de saúde em console/logs.
- Toda leitura/escrita de dado clínico deve ser autorizada via RLS (verificar vínculo profissional↔paciente ou paciente↔própria conta) — nunca confiar em filtro feito só no client.
- Preferir minimização de dados: só buscar/exibir os campos necessários para a tela atual; funções `security definer` que expõem dado de outra pessoa devolvem o mínimo (ex.: `convite_info` devolve só o primeiro nome do paciente, não o nome completo).
- Variáveis de ambiente e segredos nunca commitados; usar `.env.local` (ver `.env.example` para a lista completa e o que cada um faz).

## Qualidade

- Rodar `npm run lint` e `npm run build` antes de considerar uma tarefa concluída.
- Preferir tipos derivados do schema do banco em vez de duplicar interfaces manualmente.
- Testar fluxos críticos (agendamento, criação/edição de prontuário, RLS de dado sensível) manualmente no navegador quando alterados — não há suíte automatizada que pegue regressão nesses fluxos.
