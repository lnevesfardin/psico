@AGENTS.md

# Soma Beta

Plataforma web para consultórios e clínicas de psicologia: agendamento de consultas, gestão de pacientes e prontuários eletrônicos (dados clínicos sensíveis).

## Stack

- Next.js (App Router) — ver `node_modules/next/dist/docs/` antes de usar APIs, pois esta versão pode ter mudanças em relação ao que você já conhece.
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- ESLint (`eslint-config-next`, core-web-vitals + typescript)

## Estrutura

- `src/app/` — rotas, layouts e páginas (App Router).
- Componentes de UI compartilhados devem ficar em `src/components/`.
- Lógica de domínio (agendamento, prontuário, pacientes) separada de componentes de apresentação.

## Convenções de código

- TypeScript em modo strict; não usar `any` — tipar dados de pacientes, sessões e agendamentos explicitamente.
- Server Components por padrão; usar `"use client"` apenas onde houver interatividade (formulários, calendário, etc.).
- Server Actions ou route handlers para mutações; nunca acessar dados sensíveis diretamente de Client Components.
- Nomes de arquivos e componentes em inglês; textos de UI em português (pt-BR), já que o público é clínico/paciente brasileiro.
- Formulários com validação (ex.: Zod) tanto no cliente quanto no servidor.
- Sem comentários explicando o óbvio; comentar apenas decisões não triviais (ex.: regras de negócio de agendamento, exceções de LGPD).

## Dados sensíveis e LGPD

Este projeto lida com dados de saúde (prontuários), que são dados sensíveis sob a LGPD. Ao implementar features:

- Nunca logar conteúdo de prontuário, CPF ou dados de saúde em console/logs.
- Toda leitura/escrita de prontuário deve ser autenticada e autorizada (verificar que o profissional tem vínculo com o paciente).
- Preferir minimização de dados: só buscar/exibir os campos necessários para a tela atual.
- Variáveis de ambiente e segredos (chaves de API, strings de conexão) nunca commitados; usar `.env.local`.

## Qualidade

- Rodar `npm run lint` antes de considerar uma tarefa concluída.
- Preferir tipos derivados do schema do banco/validação em vez de duplicar interfaces manualmente.
- Testar fluxos críticos (agendamento, criação/edição de prontuário) manualmente no navegador quando alterados.
