-- Schema do Psi Rob (multi-tenant): cada psicólogo é um usuário do Supabase
-- Auth (auth.users) e só enxerga/edita as próprias linhas via Row Level
-- Security. Execute no SQL Editor do Supabase de um projeto novo.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================
-- organizations — unidade que assina o plano (consultório/clínica). Um
-- psicólogo autônomo é uma org com 1 usuário; uma clínica é uma org com N
-- psicólogos + secretária/admin. Toda tabela operacional carrega org_id
-- (ver seção de RLS mais abaixo) — sem isso, abrir a plataforma pra mais de
-- um psicólogo por clínica exigiria reescrever o schema inteiro depois.
-- =========================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  created_at timestamptz not null default now()
);

-- Fase 3: prazo mínimo (em horas) pro paciente cancelar pelo portal. 0 =
-- sem restrição (comportamento que já existia antes desta coluna existir).
alter table organizations add column if not exists prazo_cancelamento_horas int not null default 0;

-- Fase 5 (módulo de IA): interruptor geral por organização. Todo route
-- handler de IA (rascunho de evolução, resumo pré-sessão, temas recorrentes,
-- assistente administrativo) consulta esta coluna antes de chamar o modelo —
-- desligar aqui desliga a IA por completo pra organização inteira, sem
-- depender de nenhuma outra trava. Default true: as funcionalidades de IA já
-- existiam antes desta coluna (chat/extração de lançamento/transcrição) e
-- não devem parar de funcionar silenciosamente pra quem já usa.
alter table organizations add column if not exists ia_ativa boolean not null default true;

-- =========================================================
-- profiles — identidade genérica de QUALQUER usuário (psicólogo, secretária,
-- admin de clínica ou paciente). Separada de "perfis", que continua sendo só
-- o perfil de negócio do psicólogo (bio, CRP, valor, disponibilidade etc.) —
-- só quem tem role='psicologo' ganha linha em "perfis".
-- =========================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  -- nullable de propósito: deixa espaço para um futuro seletor de papel
  -- pós-OAuth sem precisar de nova migração (ver comentário no trigger).
  role text check (role in ('psicologo', 'secretaria', 'admin_clinica', 'paciente') or role is null),
  name text not null default '',
  -- campos do perfil de cliente (nunca usados por psicólogos, que têm
  -- perfil de negócio próprio em "perfis")
  cpf text,
  bio text,
  whatsapp text,
  created_at timestamptz not null default now()
);

-- alter table (não só create) para que bancos já provisionados antes desta
-- mudança recebam as novas colunas ao reexecutar este arquivo no SQL Editor.
alter table profiles add column if not exists cpf text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists whatsapp text;
-- org_id fica nullable no profile: pra paciente, só se resolve depois do
-- signup (ao aceitar o convite, ver aceitar_convite_paciente mais abaixo) —
-- não dá pra saber a org de quem ainda não tem paciente vinculado.
alter table profiles add column if not exists org_id uuid references organizations(id);

-- Renomeia os papéis do modelo antigo (2 valores) pro novo (4 valores) antes
-- de trocar a constraint — idempotente: some a segunda vez que este arquivo
-- rodar, porque não sobra linha com o valor antigo. Precisa derrubar o
-- trigger de bloqueio antes: em bancos que já rodaram uma versão anterior
-- deste arquivo, profiles_block_role_change já existe e barraria esta
-- própria renomeação (old.role='psychologist' -> new.role='psicologo' é,
-- pra ele, uma troca de role). É recriado mais abaixo, então o bloqueio
-- fica ausente só durante este trecho.
drop policy if exists "usuario_ve_proprio_profile" on profiles;
drop policy if exists "usuario_edita_proprio_profile" on profiles;
drop trigger if exists profiles_block_role_change on profiles;
alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'psicologo' where role = 'psychologist';
update profiles set role = 'paciente' where role = 'client';
alter table profiles add constraint profiles_role_check
  check (role in ('psicologo', 'secretaria', 'admin_clinica', 'paciente') or role is null);

alter table profiles enable row level security;

create policy "usuario_ve_proprio_profile" on profiles
  for select using (auth.uid() = id);
create policy "usuario_edita_proprio_profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- A policy de update acima permite ao próprio usuário editar seu profile,
-- mas "role" decide se ele acessa /dashboard ou /agendamentos — sem este
-- trigger, um cliente autenticado poderia chamar
-- supabase.from('profiles').update({ role: 'psicologo' }) direto pelo
-- client e burlar o controle de acesso. Uma vez definido, role é travado.
create or replace function block_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.role is not null and new.role is distinct from old.role then
    raise exception 'role não pode ser alterado depois de definido';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_block_role_change
  before update on profiles
  for each row execute function block_role_change();

-- =========================================================
-- auth_org_id() / auth_role() — helpers security definer usados por TODAS
-- as policies de isolamento por organização abaixo. security definer aqui é
-- só pra ler a própria linha de "profiles" sem depender da policy de select
-- (que já é auth.uid() = id, então não haveria ciclo, mas mantém o mesmo
-- padrão usado em todas as outras funções deste arquivo que "espiam" outra
-- tabela: nunca devolvem mais que o mínimo necessário).
-- =========================================================
create or replace function auth_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function auth_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid()
$$;

grant execute on function auth_org_id() to authenticated;
grant execute on function auth_role() to authenticated;

-- RLS de "organizations" — ficou faltando quando a tabela foi criada lá em
-- cima (antes de auth_org_id existir). Sem isso, o grant padrão do Supabase
-- pra "authenticated"/"anon" deixaria qualquer usuário logado ler ou
-- renomear a organização de qualquer clínica, não só a própria. Só leitura
-- da própria org: escrita é exclusivamente pelas funções abaixo
-- (criar_organizacao_para_psicologo e o backfill), sempre security definer.
alter table organizations enable row level security;

drop policy if exists "membro_ve_propria_organizacao" on organizations;
create policy "membro_ve_propria_organizacao" on organizations
  for select using (id = auth_org_id());

-- Fase 3: psicólogo/admin_clinica editam configurações da própria org
-- (hoje só nome e prazo_cancelamento_horas — nunca criar/apagar org por
-- aqui, isso continua exclusivo das funções security definer).
drop policy if exists "psicologo_admin_edita_propria_organizacao" on organizations;
create policy "psicologo_admin_edita_propria_organizacao" on organizations
  for update using (
    id = auth_org_id() and auth_role() in ('psicologo', 'admin_clinica')
  ) with check (
    id = auth_org_id() and auth_role() in ('psicologo', 'admin_clinica')
  );

-- =========================================================
-- Preenchimento automático de org_id — a maior parte das tabelas é
-- inserida direto do Client Component via supabase-js (ver src/lib/*-client.ts),
-- sem passar por RPC nenhuma. Em vez de tocar em cada um desses arquivos só
-- pra acrescentar org_id no payload, um trigger BEFORE INSERT preenche
-- sozinho quando a coluna vier null — RPCs que já mandam org_id explícito
-- (criar_agendamento_publico, aceitar_convite_paciente etc.) não são
-- afetadas, o "if new.org_id is null" é um no-op pra elas.
-- =========================================================
create or replace function set_org_id_from_caller()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then
    new.org_id := auth_org_id();
  end if;
  return new;
end;
$$;

-- Para tabelas penduradas em "pacientes" (sem coluna de dono própria): a org
-- é a do paciente, não a de quem chamou (embora hoje sejam sempre a mesma,
-- já que só o psicólogo dono insere aqui).
create or replace function set_org_id_from_paciente()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from pacientes where id = new.paciente_id;
  end if;
  return new;
end;
$$;

-- Para "notificacoes": escrita é só do despachante (service role), que não
-- tem auth.uid()/JWT — auth_org_id() devolveria null. A org vem da consulta.
create or replace function set_org_id_from_consulta()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from consultas where id = new.consulta_id;
  end if;
  return new;
end;
$$;

-- =========================================================
-- criar_organizacao_para_psicologo — cria a org de um psicólogo novo (1
-- org = 1 usuário autônomo, pode crescer depois com convite de equipe) e já
-- vincula profiles.org_id. Chamada de dois lugares: de dentro de
-- handle_new_user() (cadastro por e-mail/senha, mais abaixo) e da RPC
-- escolher_papel_psicologo() (primeiro login via Google, ver mais abaixo).
-- =========================================================
create or replace function criar_organizacao_para_psicologo(p_user_id uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  insert into organizations (nome)
  values (coalesce(nullif(trim(p_nome), ''), 'Meu Consultório'))
  returning id into v_org_id;

  update profiles set org_id = v_org_id where id = p_user_id;

  insert into configuracao_notificacoes (org_id) values (v_org_id);

  return v_org_id;
end;
$$;

-- =========================================================
-- escolher_papel_psicologo — primeiro login via Google não carrega role no
-- metadata (o provedor não deixa customizar isso antes do redirect), então
-- /auth/callback chamava aqui dois updates manuais (profiles.role e upsert
-- em perfis) direto do client. Isso não criava organização nenhuma — vira
-- uma RPC só, atômica, no mesmo padrão de porta-de-escrita-controlada já
-- usado em gerar_convite_paciente/aceitar_convite_paciente.
-- =========================================================
create or replace function escolher_papel_psicologo(p_nome text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_org_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid() and role is not null) then
    raise exception 'role já definida';
  end if;

  select coalesce(nullif(trim(p_nome), ''), name) into v_nome
  from profiles where id = auth.uid();

  update profiles
  set role = 'psicologo', name = coalesce(v_nome, name)
  where id = auth.uid();

  v_org_id := criar_organizacao_para_psicologo(auth.uid(), v_nome);

  insert into perfis (id, nome, org_id)
  values (auth.uid(), coalesce(v_nome, ''), v_org_id)
  on conflict (id) do nothing;
end;
$$;

grant execute on function escolher_papel_psicologo(text) to authenticated;

-- =========================================================
-- perfis (1 linha por psicólogo; inclui disponibilidade)
-- =========================================================
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  titulo text not null default '',
  crp text not null default '',
  uf text not null default '',
  foto_url text,
  bio text,
  valor_consulta numeric(10, 2) not null default 0,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- alter table (não só create) para que bancos já provisionados antes desta
-- coluna existir a recebam ao reexecutar este arquivo no SQL Editor.
alter table perfis add column if not exists uf text not null default '';

-- Campos de busca/filtragem do diretório público (/agendar): demandas
-- atendidas, abordagem(ns) clínica(s), faixas etárias atendidas e cidade
-- (região = uf + cidade). Arrays porque um psicólogo tipicamente atende mais
-- de uma especialidade/abordagem/faixa etária.
alter table perfis add column if not exists especialidades text[] not null default '{}';
alter table perfis add column if not exists abordagens text[] not null default '{}';
alter table perfis add column if not exists faixas_etarias text[] not null default '{}';
alter table perfis add column if not exists cidade text not null default '';

create index if not exists perfis_especialidades_idx on perfis using gin (especialidades);
create index if not exists perfis_abordagens_idx on perfis using gin (abordagens);
create index if not exists perfis_faixas_etarias_idx on perfis using gin (faixas_etarias);

-- Disponibilidade deixou de ser um único par de horário aplicado a todos os
-- dias marcados (dias_disponiveis/horario_inicio/horario_fim) e passou a ser
-- granular (ver tabela "disponibilidades" abaixo): um psicólogo pode atender
-- terça e quinta 9h-20h só online, e sábado 8h-12h só presencial, por
-- exemplo. As 3 colunas antigas não são mais lidas por nenhuma tela.
-- CASCADE: a view perfis_publico (recriada mais abaixo, sem essas colunas)
-- depende delas — sem cascade o drop falha com "2BP01 cannot drop column
-- ... because other objects depend on it".
alter table perfis drop column if exists dias_disponiveis cascade;
alter table perfis drop column if exists horario_inicio cascade;
alter table perfis drop column if exists horario_fim cascade;

-- Endereço do consultório é opcional: só psicólogos que atendem
-- presencialmente preenchem, pra aparecer o link do Google Maps na página
-- pública de agendamento. Campos separados (em vez de um texto livre único)
-- pra dar pra montar o endereço formatado e alimentar o select em cascata
-- de cidade a partir do estado (ver src/lib/ibge.ts).
alter table perfis add column if not exists tem_consultorio boolean not null default false;
alter table perfis drop column if exists consultorio_endereco cascade;

-- Sala fixa de videochamada do psicólogo (Meet/Zoom/Whereby), enviada nos
-- lembretes das consultas online. NUNCA entra em perfis_publico: se fosse
-- exposta, qualquer visitante poderia pegar o link e invadir sessões. Só o
-- despachante de notificações (service role) lê esta coluna.
alter table perfis add column if not exists sala_online_url text not null default '';
alter table perfis add column if not exists consultorio_rua text not null default '';
alter table perfis add column if not exists consultorio_numero text not null default '';
alter table perfis add column if not exists consultorio_bairro text not null default '';
alter table perfis add column if not exists consultorio_cidade text not null default '';
alter table perfis add column if not exists consultorio_uf text not null default '';
alter table perfis add column if not exists consultorio_maps_url text not null default '';
alter table perfis add column if not exists org_id uuid references organizations(id);

create or replace trigger perfis_set_updated_at
  before update on perfis
  for each row execute function set_updated_at();

-- =========================================================
-- disponibilidades (blocos de horário do psicólogo para agendamento online)
-- Um psicólogo tem N linhas: cada uma é um dia da semana + intervalo de
-- horário + modalidade (presencial OU online, nunca as duas na mesma linha
-- — pra atender nas duas modalidades no mesmo dia/horário, cadastra-se dois
-- blocos). Substitui perfis.dias_disponiveis/horario_inicio/horario_fim.
-- =========================================================
create table if not exists disponibilidades (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0=domingo ... 6=sábado
  horario_inicio time not null,
  horario_fim time not null,
  modalidade text not null check (modalidade in ('presencial', 'online')),
  created_at timestamptz not null default now(),
  check (horario_fim > horario_inicio)
);

alter table disponibilidades add column if not exists org_id uuid references organizations(id);

create index if not exists disponibilidades_psicologo_id_idx
  on disponibilidades (psicologo_id);

-- =========================================================
-- pacientes
-- =========================================================
create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  -- CPF e telefone só bloqueiam pelo not null; a UI não exige nenhum campo
  -- além do nome (cadastro rápido, dados complementados depois).
  cpf text,
  telefone text,
  email text,
  data_nascimento date,
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  tem_plano_saude boolean not null default false,
  plano_saude_nome text,
  data_primeira_consulta date,
  escolaridade text,
  como_conheceu text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psicologo_id, cpf)
);

-- alter table (não só create) para que bancos já provisionados antes desta
-- mudança deixem de exigir cpf/telefone ao reexecutar este arquivo.
alter table pacientes alter column cpf drop not null;
alter table pacientes alter column telefone drop not null;
alter table pacientes add column if not exists tem_plano_saude boolean not null default false;
alter table pacientes add column if not exists plano_saude_nome text;
alter table pacientes add column if not exists data_primeira_consulta date;
alter table pacientes add column if not exists escolaridade text;
alter table pacientes add column if not exists como_conheceu text;
alter table pacientes add column if not exists observacoes text;
-- Vínculo opcional com a conta de login do cliente (auth.users), usado pra
-- mostrar o check-in de humor (ver seção "checkins_humor" no fim do
-- arquivo) na ficha do paciente. "pacientes" (cadastro feito pelo
-- psicólogo) e a conta de cliente que agenda em /agendamentos são registros
-- independentes por padrão — este vínculo é feito manualmente pelo
-- psicólogo (ele gera um convite na ficha do paciente e envia o link; ver
-- convites_paciente mais abaixo), nunca automático.
alter table pacientes add column if not exists cliente_user_id uuid references auth.users(id) on delete set null;
alter table pacientes add column if not exists org_id uuid references organizations(id);

-- Fase 1 (Entrega A): ficha completa do paciente + suporte a menor de
-- idade/interdito (responsavel_* fica obrigatório na UI quando
-- data_nascimento indicar menor — não é uma constraint de banco porque a
-- idade muda com o tempo e travar isso em SQL exigiria um trigger recalculando
-- a cada leitura) + arquivamento (ver política de retenção abaixo).
alter table pacientes add column if not exists nome_social text;
alter table pacientes add column if not exists genero text;
alter table pacientes add column if not exists endereco jsonb;
alter table pacientes add column if not exists responsavel_nome text;
alter table pacientes add column if not exists responsavel_cpf text;
alter table pacientes add column if not exists responsavel_parentesco text;
alter table pacientes add column if not exists queixa_inicial text;
alter table pacientes add column if not exists encaminhado_por text;
alter table pacientes add column if not exists valor_sessao numeric(10, 2);
alter table pacientes add column if not exists frequencia_padrao text;
alter table pacientes add column if not exists status text not null default 'ativo';
alter table pacientes add column if not exists arquivado_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pacientes_status_check'
  ) then
    alter table pacientes add constraint pacientes_status_check
      check (status in ('ativo', 'pausado', 'alta', 'desistencia'));
  end if;
end $$;

create index if not exists pacientes_psicologo_id_idx on pacientes (psicologo_id);
create index if not exists pacientes_nome_idx on pacientes using gin (nome gin_trgm_ops);
create index if not exists pacientes_cliente_user_id_idx
  on pacientes (cliente_user_id) where cliente_user_id is not null;
-- Evita vincular a mesma conta de cliente a dois pacientes do mesmo
-- psicólogo por engano (ficaria ambíguo qual ficha mostra o humor de quem).
create unique index if not exists pacientes_psicologo_cliente_unique
  on pacientes (psicologo_id, cliente_user_id) where cliente_user_id is not null;

create or replace trigger pacientes_set_updated_at
  before update on pacientes
  for each row execute function set_updated_at();

-- =========================================================
-- sessoes_prontuario (evolução / anotações sigilosas)
-- =========================================================
create table if not exists sessoes_prontuario (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  conteudo text not null,
  data_hora timestamptz not null default now(),
  -- 'transcricao' = texto gerado pela transcrição automática do áudio da
  -- sessão (revisado e salvo pelo psicólogo); 'manual' = digitado por ele.
  -- Distinguir importa: texto de IA pode conter erro de transcrição e não
  -- deve ser lido como se fosse a redação do profissional.
  origem text not null default 'manual'
    check (origem in ('manual', 'transcricao')),
  -- Momento em que o psicólogo declarou ter o consentimento do paciente para
  -- gravar (LGPD art. 11 — dado sensível de saúde exige consentimento
  -- específico). Só preenchido em origem='transcricao'; é a trilha de
  -- auditoria de que houve autorização antes de gravar.
  consentimento_em timestamptz,
  duracao_segundos int,
  created_at timestamptz not null default now()
);

-- alter table (não só create) para bancos provisionados antes desta mudança.
alter table sessoes_prontuario add column if not exists origem text not null default 'manual';
alter table sessoes_prontuario add column if not exists consentimento_em timestamptz;
alter table sessoes_prontuario add column if not exists duracao_segundos int;
alter table sessoes_prontuario add column if not exists org_id uuid references organizations(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessoes_prontuario_origem_check'
  ) then
    alter table sessoes_prontuario add constraint sessoes_prontuario_origem_check
      check (origem in ('manual', 'transcricao'));
  end if;
end $$;

-- =========================================================
-- Fase 1 (Entrega C): formato/assinatura da evolução.
-- "conteudo" continua text (não jsonb como no doc de especificação) — trocar
-- pra jsonb exigiria migrar toda anotação já escrita em produção; os
-- formatos DAP/SOAP/BIRP são montados na UI como texto com seções (## Dados,
-- ## Avaliação, ## Plano etc.) e gravados nessa mesma coluna.
-- =========================================================
alter table sessoes_prontuario add column if not exists formato text not null default 'livre';
alter table sessoes_prontuario add column if not exists status text not null default 'rascunho';
alter table sessoes_prontuario add column if not exists assinado_em timestamptz;
-- SHA-256 do conteúdo no momento da assinatura (hex), calculado no cliente
-- via Web Crypto — não prova nada sozinho (o cliente que assina é o mesmo
-- que gravou), mas destrava detectar qualquer alteração posterior ao
-- conteúdo gravado, incluindo uma eventual edição direta no banco.
alter table sessoes_prontuario add column if not exists hash_conteudo text;
-- Vínculo opcional com a consulta que originou esta evolução — permite
-- calcular "sessões realizadas sem evolução registrada" com precisão (por
-- consulta, não só por contagem). Nullable: nem toda evolução nasce de uma
-- consulta específica marcada como realizada (ex.: nota avulsa).
alter table sessoes_prontuario add column if not exists agendamento_id uuid references consultas(id) on delete set null;

-- Fase 5 (módulo de IA): marca uma evolução cujo texto nasceu de um rascunho
-- gerado por IA (estruturação DAP/SOAP a partir de anotações livres — ver
-- api/gemini/rascunho-evolucao). Independente de "origem" (que distingue
-- manual de transcrição de áudio): uma evolução pode nascer de transcrição E
-- ainda assim não ter sido estruturada por IA, ou nascer manual e ter sido
-- só reorganizada por IA — os dois eixos são ortogonais. Nunca marca sozinha
-- a evolução como assinada: toda saída de IA nasce em status='rascunho'
-- (default da coluna), a assinatura continua exclusivamente manual.
alter table sessoes_prontuario add column if not exists gerado_por_ia boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessoes_prontuario_formato_check'
  ) then
    alter table sessoes_prontuario add constraint sessoes_prontuario_formato_check
      check (formato in ('dap', 'soap', 'birp', 'livre'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'sessoes_prontuario_status_check'
  ) then
    alter table sessoes_prontuario add constraint sessoes_prontuario_status_check
      check (status in ('rascunho', 'assinada'));
  end if;
end $$;

create unique index if not exists sessoes_prontuario_agendamento_id_idx
  on sessoes_prontuario (agendamento_id) where agendamento_id is not null;

-- Trava de imutabilidade: depois de assinada, a evolução não pode ser
-- editada nem apagada (Res. CFP 01/2009 e 06/2019) — correção só via
-- adendo datado (ver adendos_evolucao mais abaixo). Bloqueia pra QUALQUER
-- role, inclusive o próprio autor — é o que faz a assinatura significar algo
-- de verdade em fiscalização/processo, não só uma checkbox de UI.
create or replace function bloqueia_edicao_assinada()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'assinada' then
    raise exception 'Evolução assinada não pode ser alterada. Use um adendo.';
  end if;
  return new;
end;
$$;

create or replace trigger sessoes_prontuario_imutavel
  before update or delete on sessoes_prontuario
  for each row execute function bloqueia_edicao_assinada();

create index if not exists sessoes_prontuario_paciente_id_idx
  on sessoes_prontuario (paciente_id, data_hora desc);

-- =========================================================
-- consultas (agenda + agendamentos públicos)
-- =========================================================
-- recorrencias (Fase 1 Entrega B) — a "regra" de uma consulta que se repete
-- toda semana ou a cada duas semanas. As ocorrências em si continuam sendo
-- linhas normais em "consultas" (geradas em lote na criação e sob demanda
-- depois, ver gerar_ocorrencias_recorrencia abaixo) — a recorrência nunca é
-- lida diretamente pela agenda, só serve pra saber "essas consultas vêm
-- daqui" (consultas.recorrencia_id) e pra gerar as próximas ocorrências.
-- =========================================================
create table if not exists recorrencias (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),
  horario time not null,
  modalidade text check (modalidade in ('presencial', 'online')),
  -- 1 = semanal, 2 = quinzenal. Restrito a esses dois porque é só o que a
  -- tela oferece (mesmo padrão de frequencia_padrao em pacientes).
  intervalo_semanas int not null default 1 check (intervalo_semanas in (1, 2)),
  inicio date not null,
  fim date,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists recorrencias_psicologo_id_idx on recorrencias (psicologo_id);

-- =========================================================
create table if not exists consultas (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid references pacientes(id) on delete set null,
  recorrencia_id uuid references recorrencias(id) on delete set null,
  -- preenchido automaticamente (auth.uid() dentro do RPC abaixo) quando quem
  -- agenda pelo link público está logado como cliente — permite listar o
  -- agendamento em "Meus Agendamentos" sem exigir login pra agendar.
  cliente_id uuid references auth.users(id) on delete set null,
  paciente_nome text not null,
  data date not null,
  horario time not null,
  status text not null default 'confirmada'
    check (status in ('pendente', 'confirmada', 'realizada', 'desmarcada')),
  tipo text not null default 'consulta'
    check (tipo in ('consulta', 'bloqueio')),
  origem text not null default 'manual'
    check (origem in ('publico', 'manual')),
  modalidade text check (modalidade in ('presencial', 'online')),
  -- dados coletados no agendamento público (nulos quando origem = 'manual')
  idade int,
  sexo text,
  profissao text,
  telefone text,
  email text,
  endereco text,
  estado_civil text,
  escolaridade text,
  motivo text,
  -- Preenchido só quando o cliente cancela pela própria conta (função
  -- cancelar_consulta_cliente abaixo) — nunca quando o psicólogo muda o
  -- status manualmente, o que permite ao psicólogo distinguir as duas
  -- situações na agenda.
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- alter table (não só create) para que bancos já provisionados antes desta
-- mudança recebam as novas colunas ao reexecutar este arquivo no SQL Editor.
alter table consultas add column if not exists email text;
alter table consultas add column if not exists cliente_id uuid references auth.users(id) on delete set null;
alter table consultas add column if not exists motivo_cancelamento text;
alter table consultas add column if not exists org_id uuid references organizations(id);
alter table consultas add column if not exists recorrencia_id uuid references recorrencias(id) on delete set null;

-- "falta" (não compareceu) — Entrega B do spec; até aqui só existia
-- pendente/confirmada/realizada/desmarcada.
alter table consultas drop constraint if exists consultas_status_check;
alter table consultas add constraint consultas_status_check
  check (status in ('pendente', 'confirmada', 'realizada', 'falta', 'desmarcada'));

create index if not exists consultas_cliente_id_idx
  on consultas (cliente_id, data desc);

-- Financeiro é 100% desvinculado da agenda: todo lançamento é manual, feito
-- pelo psicólogo em lancamentos_financeiros (ver abaixo). valor/status_pagamento
-- chegaram a existir em consultas numa versão anterior deste schema — removidos
-- para que agendar uma consulta nunca crie/altere nada em Financeiro.
drop trigger if exists consultas_set_valor on consultas;
drop function if exists set_consulta_valor();
alter table consultas drop column if exists valor;
alter table consultas drop column if exists status_pagamento;

create index if not exists consultas_psicologo_data_idx
  on consultas (psicologo_id, data, horario);

-- Impede double-booking mesmo sob concorrência (dois agendamentos públicos
-- simultâneos para o mesmo horário): o segundo insert falha na constraint.
create unique index if not exists consultas_slot_unique
  on consultas (psicologo_id, data, horario)
  where status in ('pendente', 'confirmada');

create or replace trigger consultas_set_updated_at
  before update on consultas
  for each row execute function set_updated_at();

-- =========================================================
-- pacotes_sessao (Fase 2) — pacote de sessões pré-pagas de um paciente.
-- "sessoes_usadas" incrementa quando o psicólogo escolhe "consumir sessão
-- do pacote" no atalho da Agenda (ver 3.4 mais abaixo) em vez de lançar uma
-- cobrança avulsa — nunca automático, mesmo motivo de lancamentos_financeiros.
-- =========================================================
create table if not exists pacotes_sessao (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  quantidade_sessoes int not null check (quantidade_sessoes > 0),
  sessoes_usadas int not null default 0 check (sessoes_usadas >= 0),
  valor_total numeric(10, 2) not null,
  validade date,
  created_at timestamptz not null default now()
);

create index if not exists pacotes_sessao_paciente_id_idx
  on pacotes_sessao (paciente_id);

-- =========================================================
-- lancamentos_financeiros — único lugar de onde o Financeiro lê dados.
-- Toda entrada é criada manualmente pelo psicólogo (botão "Novo
-- Lançamento" ou o atalho "Lançar cobrança" que aparece na Agenda depois de
-- marcar uma consulta como realizada, ver 3.4 mais abaixo) — agendar/editar
-- uma consulta NUNCA grava nada aqui sozinho, de propósito (ver comentário
-- em consultas mais acima: já existiu um trigger fazendo isso e foi
-- removido). tipo distingue receita de despesa; despesa não tem paciente.
-- =========================================================
create table if not exists lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid references pacientes(id) on delete cascade,
  -- snapshot do nome (mesmo padrão de consultas.paciente_nome): evita joins
  -- e preserva o registro histórico legível caso o paciente seja renomeado.
  -- null em despesa (aluguel, supervisão etc. não têm paciente).
  paciente_nome text,
  valor numeric(10, 2) not null,
  status_pagamento text not null default 'pendente'
    check (status_pagamento in ('pago', 'pendente')),
  data date not null default current_date,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table lancamentos_financeiros add column if not exists org_id uuid references organizations(id);

-- Fase 2: receita vs despesa, categoria, vencimento/pagamento separados de
-- "data" (que era ambígua — hoje só marcava "a data do lançamento"),
-- ligação opcional com a consulta/pacote que originou a cobrança (evita
-- lançar duas vezes a mesma sessão pelo atalho da Agenda).
alter table lancamentos_financeiros alter column paciente_id drop not null;
alter table lancamentos_financeiros alter column paciente_nome drop not null;
alter table lancamentos_financeiros add column if not exists tipo text not null default 'receita';
alter table lancamentos_financeiros add column if not exists categoria text not null default 'sessao';
alter table lancamentos_financeiros add column if not exists vencimento date;
update lancamentos_financeiros set vencimento = data where vencimento is null;
alter table lancamentos_financeiros alter column vencimento set not null;
alter table lancamentos_financeiros alter column vencimento set default current_date;
alter table lancamentos_financeiros add column if not exists pago_em date;
alter table lancamentos_financeiros add column if not exists forma_pagamento text;
alter table lancamentos_financeiros add column if not exists agendamento_id uuid references consultas(id) on delete set null;
alter table lancamentos_financeiros add column if not exists pacote_id uuid references pacotes_sessao(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lancamentos_financeiros_tipo_check'
  ) then
    alter table lancamentos_financeiros add constraint lancamentos_financeiros_tipo_check
      check (tipo in ('receita', 'despesa'));
  end if;
end $$;

alter table lancamentos_financeiros drop constraint if exists lancamentos_financeiros_status_pagamento_check;
alter table lancamentos_financeiros add constraint lancamentos_financeiros_status_pagamento_check
  check (status_pagamento in ('pago', 'pendente', 'cancelado'));

-- Despesa não tem paciente; receita sempre tem (garante que a coluna
-- nullable acima não vire "esqueci de preencher" em receita).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lancamentos_financeiros_paciente_por_tipo_check'
  ) then
    alter table lancamentos_financeiros add constraint lancamentos_financeiros_paciente_por_tipo_check
      check (tipo = 'despesa' or paciente_id is not null);
  end if;
end $$;

-- Idempotência do atalho "Lançar cobrança" da Agenda: no máximo um
-- lançamento por consulta.
create unique index if not exists lancamentos_financeiros_agendamento_id_idx
  on lancamentos_financeiros (agendamento_id) where agendamento_id is not null;

create index if not exists lancamentos_financeiros_psicologo_data_idx
  on lancamentos_financeiros (psicologo_id, data desc);

create or replace trigger lancamentos_financeiros_set_updated_at
  before update on lancamentos_financeiros
  for each row execute function set_updated_at();

-- =========================================================
-- notificacoes — fila (outbox) de lembretes de consulta.
-- Uma linha por (consulta × destinatário × canal): uma consulta online
-- confirmada com e-mail e webhook ligados gera 4 linhas (paciente/psicólogo
-- × e-mail/webhook). Quem cria e envia é o endpoint
-- /api/notificacoes/dispatch, chamado pelo pg_cron (ver no fim do arquivo).
--
-- LGPD: "payload" guarda só dado de agendamento (nome, data, hora,
-- modalidade, local/link). Nunca prontuário, motivo da consulta ou CPF.
-- =========================================================
create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id) on delete cascade,
  tipo text not null check (tipo in ('lembrete_1h')),
  destinatario text not null check (destinatario in ('paciente', 'psicologo')),
  canal text not null check (canal in ('email', 'webhook')),
  destino text not null, -- endereço de e-mail ou URL do webhook
  payload jsonb not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'erro', 'cancelado')),
  tentativas int not null default 0,
  erro text,
  agendado_para timestamptz not null, -- início da consulta menos a antecedência do tipo
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  -- Garantia de idempotência: mesmo se o cron rodar duas vezes em paralelo,
  -- o mesmo lembrete nunca é enfileirado (nem enviado) duas vezes.
  unique (consulta_id, tipo, destinatario, canal)
);

alter table notificacoes add column if not exists org_id uuid references organizations(id);

-- Fase 3: lembrete de 24h antes, além do de 1h que já existia.
alter table notificacoes drop constraint if exists notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('lembrete_1h', 'lembrete_24h'));

create index if not exists notificacoes_pendentes_idx
  on notificacoes (agendado_para)
  where status = 'pendente';

-- =========================================================
-- configuracao_notificacoes (Fase 3) — uma linha por organização. Liga/
-- desliga cada tipo de lembrete e permite um complemento curto na
-- mensagem, mas NUNCA substituição total do template — trocar o texto
-- inteiro deixaria um psicólogo escrever sem querer "sua sessão de
-- terapia" ou algo clínico num lembrete que pode ser lido por terceiros
-- (o requisito de neutralidade da mensagem é o motivo desta restrição
-- deliberada). org_id é chave primária: sempre existe exatamente uma
-- linha por org, criada junto com a organização (ver
-- criar_organizacao_para_psicologo).
-- =========================================================
create table if not exists configuracao_notificacoes (
  org_id uuid primary key references organizations(id) on delete cascade,
  ativo boolean not null default true,
  lembrete_1h_ativo boolean not null default true,
  lembrete_24h_ativo boolean not null default false,
  mensagem_extra text,
  updated_at timestamptz not null default now()
);

create or replace trigger configuracao_notificacoes_set_updated_at
  before update on configuracao_notificacoes
  for each row execute function set_updated_at();

alter table configuracao_notificacoes enable row level security;

drop policy if exists "psicologo_admin_ve_config_notificacoes" on configuracao_notificacoes;
create policy "psicologo_admin_ve_config_notificacoes" on configuracao_notificacoes
  for select using (org_id = auth_org_id() and auth_role() in ('psicologo', 'admin_clinica'));
drop policy if exists "psicologo_admin_edita_config_notificacoes" on configuracao_notificacoes;
create policy "psicologo_admin_edita_config_notificacoes" on configuracao_notificacoes
  for update using (org_id = auth_org_id() and auth_role() in ('psicologo', 'admin_clinica'))
  with check (org_id = auth_org_id() and auth_role() in ('psicologo', 'admin_clinica'));
-- Sem policy de insert: a linha nasce sozinha em
-- criar_organizacao_para_psicologo, nunca direto do client.

-- Backfill pras organizações que já existiam antes desta tabela.
insert into configuracao_notificacoes (org_id)
select o.id from organizations o
where not exists (select 1 from configuracao_notificacoes c where c.org_id = o.id);

-- =========================================================
-- app_secrets — URL da aplicação e segredo usados pelo pg_cron para chamar
-- o endpoint de despacho. Fica no banco (e não no arquivo) porque este
-- schema.sql vai para o git; os valores são inseridos à mão no SQL Editor.
-- =========================================================
create table if not exists app_secrets (
  chave text primary key,
  valor text not null
);

-- =========================================================
-- Backfill de org_id — cobre bancos que já tinham dado antes desta migração
-- (psicólogos e pacientes existentes não nasceram com org_id). Cada bloco é
-- guardado por "where org_id is null", então roda uma vez e vira no-op nas
-- próximas execuções deste arquivo; seguro de deixar permanente aqui.
-- =========================================================

-- 1) Uma organização nova por psicólogo existente sem org ainda.
do $$
declare
  r record;
  v_org_id uuid;
begin
  for r in
    select p.id, coalesce(nullif(pf.nome, ''), p.name, 'Meu Consultório') as nome
    from profiles p
    left join perfis pf on pf.id = p.id
    where p.role = 'psicologo' and p.org_id is null
  loop
    insert into organizations (nome) values (r.nome) returning id into v_org_id;
    update profiles set org_id = v_org_id where id = r.id;
  end loop;
end $$;

-- 2) Paciente: org do psicólogo do vínculo mais antigo (pacientes.cliente_user_id).
-- Decisão de produto: um paciente pertence a uma única organização.
update profiles p
set org_id = sub.org_id
from (
  select distinct on (pac.cliente_user_id) pac.cliente_user_id as cliente_id, prof.org_id
  from pacientes pac
  join profiles prof on prof.id = pac.psicologo_id
  where pac.cliente_user_id is not null
  order by pac.cliente_user_id, pac.created_at asc
) sub
where p.id = sub.cliente_id and p.role = 'paciente' and p.org_id is null;

-- 3) org_id nas tabelas operacionais, a partir do dono (profiles ou pacientes).
update perfis pf set org_id = p.org_id from profiles p where pf.id = p.id and pf.org_id is null;
update disponibilidades d set org_id = p.org_id from profiles p where d.psicologo_id = p.id and d.org_id is null;
update pacientes pac set org_id = p.org_id from profiles p where pac.psicologo_id = p.id and pac.org_id is null;
update sessoes_prontuario s set org_id = pac.org_id from pacientes pac where s.paciente_id = pac.id and s.org_id is null;
update consultas c set org_id = p.org_id from profiles p where c.psicologo_id = p.id and c.org_id is null;
update lancamentos_financeiros l set org_id = p.org_id from profiles p where l.psicologo_id = p.id and l.org_id is null;
update notificacoes n set org_id = c.org_id from consultas c where n.consulta_id = c.id and n.org_id is null;

-- Trava org_id como obrigatório nas tabelas operacionais depois do backfill
-- acima (idempotente: reexecutar "set not null" numa coluna que já é not
-- null não dá erro).
alter table perfis alter column org_id set not null;
alter table disponibilidades alter column org_id set not null;
alter table pacientes alter column org_id set not null;
alter table sessoes_prontuario alter column org_id set not null;
alter table consultas alter column org_id set not null;
alter table lancamentos_financeiros alter column org_id set not null;
alter table notificacoes alter column org_id set not null;

-- =========================================================
-- Row Level Security
-- =========================================================
alter table perfis enable row level security;
alter table disponibilidades enable row level security;
alter table recorrencias enable row level security;
alter table pacientes enable row level security;
alter table sessoes_prontuario enable row level security;
alter table consultas enable row level security;
alter table lancamentos_financeiros enable row level security;
alter table pacotes_sessao enable row level security;
alter table notificacoes enable row level security;
-- app_secrets fica com RLS ligada e SEM NENHUMA POLICY de propósito: assim
-- nem a anon key (que vai pro bundle JS) nem um usuário logado conseguem ler
-- o segredo do cron. Só postgres (o próprio pg_cron) e a service_role key.
alter table app_secrets enable row level security;

-- "perfis" e "disponibilidades" continuam restritas ao próprio psicólogo:
-- abrir a agenda/perfil de negócio pra secretaria/admin_clinica mexerem é
-- feature de uma fase futura (não há UI pra isso ainda). Só ganham o filtro
-- de org como camada extra.
drop policy if exists "psicologo_ve_proprio_perfil" on perfis;
create policy "psicologo_ve_proprio_perfil" on perfis
  for select using (org_id = auth_org_id() and auth.uid() = id);
drop policy if exists "psicologo_cria_proprio_perfil" on perfis;
create policy "psicologo_cria_proprio_perfil" on perfis
  for insert with check (auth.uid() = id);
drop policy if exists "psicologo_edita_proprio_perfil" on perfis;
create policy "psicologo_edita_proprio_perfil" on perfis
  for update using (org_id = auth_org_id() and auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "psicologo_ve_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_ve_proprias_disponibilidades" on disponibilidades
  for select using (org_id = auth_org_id() and auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_cria_proprias_disponibilidades" on disponibilidades
  for insert with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_edita_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_edita_proprias_disponibilidades" on disponibilidades
  for update using (org_id = auth_org_id() and auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_apaga_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_apaga_proprias_disponibilidades" on disponibilidades
  for delete using (org_id = auth_org_id() and auth.uid() = psicologo_id);

drop policy if exists "psicologo_ve_proprias_recorrencias" on recorrencias;
create policy "psicologo_ve_proprias_recorrencias" on recorrencias
  for select using (org_id = auth_org_id() and auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprias_recorrencias" on recorrencias;
create policy "psicologo_cria_proprias_recorrencias" on recorrencias
  for insert with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_edita_proprias_recorrencias" on recorrencias;
create policy "psicologo_edita_proprias_recorrencias" on recorrencias
  for update using (org_id = auth_org_id() and auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_apaga_proprias_recorrencias" on recorrencias;
create policy "psicologo_apaga_proprias_recorrencias" on recorrencias
  for delete using (org_id = auth_org_id() and auth.uid() = psicologo_id);

-- "pacientes": secretaria/admin_clinica veem/gerenciam todos os pacientes da
-- org (dado cadastral, não clínico); psicólogo só os próprios. Uma única
-- policy combinada por operação — usar duas policies "permissive" separadas
-- (org isola + psicólogo vê só os seus) não funcionaria: no Postgres elas se
-- combinam com OR, e a primeira sozinha já liberaria a org inteira pra
-- qualquer papel.
drop policy if exists "psicologo_ve_proprios_pacientes" on pacientes;
drop policy if exists "acesso_pacientes_select" on pacientes;
create policy "acesso_pacientes_select" on pacientes
  for select using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_cria_proprios_pacientes" on pacientes;
drop policy if exists "acesso_pacientes_insert" on pacientes;
create policy "acesso_pacientes_insert" on pacientes
  for insert with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_edita_proprios_pacientes" on pacientes;
drop policy if exists "acesso_pacientes_update" on pacientes;
create policy "acesso_pacientes_update" on pacientes
  for update using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  ) with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
-- Retenção obrigatória (Res. CFP 01/2009 e 06/2019): prontuário/paciente
-- nunca é apagado por capricho, só arquivado (ver pacientes.arquivado_em).
-- Sem policy de DELETE nenhuma pra ninguém — bloqueia a remoção física no
-- banco, não só na UI.
drop policy if exists "psicologo_apaga_proprios_pacientes" on pacientes;
drop policy if exists "acesso_pacientes_delete" on pacientes;

-- "sessoes_prontuario" (evolução): sigilo é regra de banco. Só o psicólogo
-- autor — nunca secretaria, nunca admin_clinica, mesmo sendo da mesma org.
drop policy if exists "psicologo_ve_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_ve_proprias_sessoes" on sessoes_prontuario
  for select using (
    org_id = auth_org_id()
    and auth_role() = 'psicologo'
    and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_cria_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_cria_proprias_sessoes" on sessoes_prontuario
  for insert with check (
    org_id = auth_org_id()
    and auth_role() = 'psicologo'
    and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_apaga_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_apaga_proprias_sessoes" on sessoes_prontuario
  for delete using (
    org_id = auth_org_id()
    and auth_role() = 'psicologo'
    and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );
-- UPDATE não existia até aqui (só criar/apagar) — passa a existir pro
-- autosave do rascunho e pro botão "Assinar" (que é, ele mesmo, um update).
-- A policy permite a linha inteira; quem trava edição pós-assinatura é o
-- trigger sessoes_prontuario_imutavel acima, não a RLS.
drop policy if exists "psicologo_edita_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_edita_proprias_sessoes" on sessoes_prontuario
  for update using (
    org_id = auth_org_id()
    and auth_role() = 'psicologo'
    and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- adendos_evolucao — correção de uma evolução já assinada. Nunca edita a
-- linha original (o trigger de imutabilidade bloquearia mesmo que
-- tentasse); é sempre um registro novo, datado, anexado.
-- =========================================================
create table if not exists adendos_evolucao (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  evolucao_id uuid not null references sessoes_prontuario(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  texto text not null,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists adendos_evolucao_evolucao_id_idx
  on adendos_evolucao (evolucao_id, created_at);

alter table adendos_evolucao enable row level security;

drop policy if exists "psicologo_ve_proprios_adendos" on adendos_evolucao;
create policy "psicologo_ve_proprios_adendos" on adendos_evolucao
  for select using (
    org_id = auth_org_id()
    and exists (
      select 1 from sessoes_prontuario s
      join pacientes p on p.id = s.paciente_id
      where s.id = adendos_evolucao.evolucao_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_cria_proprios_adendos" on adendos_evolucao;
create policy "psicologo_cria_proprios_adendos" on adendos_evolucao
  for insert with check (
    autor_id = auth.uid()
    and exists (
      select 1 from sessoes_prontuario s
      join pacientes p on p.id = s.paciente_id
      where s.id = adendos_evolucao.evolucao_id and p.psicologo_id = auth.uid()
    )
  );
-- Sem policy de update/delete: adendo também é permanente, mesmo motivo da
-- evolução original.

-- "consultas" (agenda): mesmo padrão de "pacientes" — secretaria/admin veem
-- a agenda inteira da org, psicólogo só a própria.
drop policy if exists "psicologo_ve_proprias_consultas" on consultas;
drop policy if exists "acesso_consultas_select" on consultas;
create policy "acesso_consultas_select" on consultas
  for select using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_cria_proprias_consultas" on consultas;
drop policy if exists "acesso_consultas_insert" on consultas;
create policy "acesso_consultas_insert" on consultas
  for insert with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_edita_proprias_consultas" on consultas;
drop policy if exists "acesso_consultas_update" on consultas;
create policy "acesso_consultas_update" on consultas
  for update using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  ) with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_apaga_proprias_consultas" on consultas;
drop policy if exists "acesso_consultas_delete" on consultas;
create policy "acesso_consultas_delete" on consultas
  for delete using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
-- Sem policy de INSERT para "anon": agendamentos públicos passam pela função
-- criar_agendamento_publico() (security definer) abaixo, nunca por insert cru
-- na tabela — isso evita que a anon key (que vai pro bundle JS) seja usada
-- pra forjar status='confirmada' ou floodar a agenda de qualquer psicologo_id.

-- Cliente vê os próprios agendamentos (feitos enquanto logado, via link
-- público) em "Meus Agendamentos" — só leitura, cliente nunca edita/apaga
-- uma consulta diretamente, isso é decisão do psicólogo.
drop policy if exists "cliente_ve_proprios_agendamentos" on consultas;
create policy "cliente_ve_proprios_agendamentos" on consultas
  for select using (auth.uid() = cliente_id);

-- "lancamentos_financeiros": mesmo padrão de "pacientes"/"consultas".
drop policy if exists "psicologo_ve_proprios_lancamentos" on lancamentos_financeiros;
drop policy if exists "acesso_lancamentos_select" on lancamentos_financeiros;
create policy "acesso_lancamentos_select" on lancamentos_financeiros
  for select using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_cria_proprios_lancamentos" on lancamentos_financeiros;
drop policy if exists "acesso_lancamentos_insert" on lancamentos_financeiros;
create policy "acesso_lancamentos_insert" on lancamentos_financeiros
  for insert with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_edita_proprios_lancamentos" on lancamentos_financeiros;
drop policy if exists "acesso_lancamentos_update" on lancamentos_financeiros;
create policy "acesso_lancamentos_update" on lancamentos_financeiros
  for update using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  ) with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "psicologo_apaga_proprios_lancamentos" on lancamentos_financeiros;
drop policy if exists "acesso_lancamentos_delete" on lancamentos_financeiros;
create policy "acesso_lancamentos_delete" on lancamentos_financeiros
  for delete using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );

-- "pacotes_sessao": mesmo padrão de "lancamentos_financeiros".
drop policy if exists "acesso_pacotes_select" on pacotes_sessao;
create policy "acesso_pacotes_select" on pacotes_sessao
  for select using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "acesso_pacotes_insert" on pacotes_sessao;
create policy "acesso_pacotes_insert" on pacotes_sessao
  for insert with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "acesso_pacotes_update" on pacotes_sessao;
create policy "acesso_pacotes_update" on pacotes_sessao
  for update using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  ) with check (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
drop policy if exists "acesso_pacotes_delete" on pacotes_sessao;
create policy "acesso_pacotes_delete" on pacotes_sessao
  for delete using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );

-- Psicólogo enxerga (só leitura) os lembretes das próprias consultas, para
-- poder conferir o que foi enviado. Escrita é exclusiva do despachante, que
-- usa a service_role key e portanto ignora RLS.
drop policy if exists "psicologo_ve_proprias_notificacoes" on notificacoes;
create policy "psicologo_ve_proprias_notificacoes" on notificacoes
  for select using (
    org_id = auth_org_id()
    and exists (
      select 1 from consultas c
      where c.id = notificacoes.consulta_id and c.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- Acesso público a "perfis"/"disponibilidades"/"consultas" (usado pela
-- página /agendar/[psicologoId] e por telas autenticadas de paciente que
-- não têm RLS em "perfis", ver meu_psicologo_contato) — funções security
-- definer, não views.
--
-- Isto ERA implementado como 3 views ("perfis_publico" etc.) rodando com o
-- privilégio de quem as criou pra contornar a RLS de propósito, só devolvendo
-- colunas seguras. Funciona, mas o Security Advisor do Supabase acusa
-- "Security Definer View" como CRITICAL pra qualquer view nessa situação —
-- é a mesma mecânica (bypass de RLS por dono), só que numa view por padrão
-- é um bypass IMPLÍCITO e não documentado no próprio objeto (por isso o
-- Postgres 15+ criou security_invoker=true como opt-out), enquanto numa
-- função security definer o bypass é EXPLÍCITO na própria assinatura — é
-- o padrão que o resto deste arquivo já usa sempre que uma policy precisa
-- "espiar" outra tabela (convite_info, escala_info, eh_meu_paciente etc.),
-- e não aciona aquele lint. Trocar pra security_invoker=true nas views
-- NÃO seria a correção certa aqui: quebraria a página pública inteira, já
-- que anon não tem (e não deve ter) nenhuma policy de RLS em "perfis" —
-- security_invoker faria a view herdar exatamente essa ausência de acesso.
--
-- Ganho extra da troca: as views antigas não tinham filtro nenhum (um
-- SELECT sem WHERE em perfis_publico devolvia o perfil de TODOS os
-- psicólogos da plataforma pra quem consultasse a API REST direto, não só
-- quem passa pela tela). As funções abaixo exigem o(s) id(s) do psicólogo
-- como parâmetro — só devolvem o que o chamador já pediu meio de nome,
-- igual ao padrão de link único usado em convite/escala.
--
-- drop view if exists: remove os objetos antigos de bancos que já rodaram
-- uma versão anterior deste arquivo (idempotente).
-- =========================================================
drop view if exists perfis_publico cascade;
drop view if exists disponibilidades_publico cascade;
drop view if exists consultas_publico cascade;

-- Aceita uma lista de ids (não só um) porque client-appointments-client.ts
-- resolve o nome/foto de vários psicólogos de uma vez (histórico de
-- agendamentos do cliente pode ter mais de um profissional).
create or replace function perfis_publico(p_ids uuid[])
returns table (
  id uuid,
  nome text,
  titulo text,
  crp text,
  uf text,
  cidade text,
  foto_url text,
  bio text,
  valor_consulta numeric,
  especialidades text[],
  abordagens text[],
  faixas_etarias text[],
  tem_consultorio boolean,
  consultorio_rua text,
  consultorio_numero text,
  consultorio_bairro text,
  consultorio_cidade text,
  consultorio_uf text,
  consultorio_maps_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    id, nome, titulo, crp, uf, cidade, foto_url, bio, valor_consulta,
    especialidades, abordagens, faixas_etarias, tem_consultorio,
    consultorio_rua, consultorio_numero, consultorio_bairro,
    consultorio_cidade, consultorio_uf, consultorio_maps_url
  from perfis
  where id = any(p_ids);
$$;

grant execute on function perfis_publico(uuid[]) to anon, authenticated;

create or replace function disponibilidades_publico(p_psicologo_id uuid)
returns table (
  id uuid,
  dia_semana int,
  horario_inicio time,
  horario_fim time,
  modalidade text
)
language sql
security definer
set search_path = public
stable
as $$
  select id, dia_semana, horario_inicio, horario_fim, modalidade
  from disponibilidades
  where psicologo_id = p_psicologo_id;
$$;

grant execute on function disponibilidades_publico(uuid) to anon, authenticated;

-- p_data_inicio: mesmo corte que o client já fazia com .gte("data",
-- todayIso()) — só interessa saber ocupação de hoje em diante.
create or replace function consultas_publico(p_psicologo_id uuid, p_data_inicio date)
returns table (
  data date,
  horario time,
  status text
)
language sql
security definer
set search_path = public
stable
as $$
  select data, horario, status
  from consultas
  where psicologo_id = p_psicologo_id and data >= p_data_inicio;
$$;

grant execute on function consultas_publico(uuid, date) to anon, authenticated;

-- =========================================================
-- Agendamento público (RPC) — único caminho de escrita para visitantes
-- anônimos. Força status/origem no servidor e valida o horário antes de
-- inserir (o índice único acima é a garantia final contra corrida).
-- =========================================================
-- Assinatura antiga (sem p_email) precisa ser derrubada explicitamente: como
-- o Postgres identifica funções pela lista de parâmetros, "create or replace"
-- com um parâmetro a mais cria uma SEGUNDA função em vez de substituir esta.
drop function if exists criar_agendamento_publico(
  uuid, text, date, time, text, int, text, text, text, text, text, text, text
);

create or replace function criar_agendamento_publico(
  p_psicologo_id uuid,
  p_paciente_nome text,
  p_data date,
  p_horario time,
  p_modalidade text,
  p_idade int,
  p_sexo text,
  p_profissao text,
  p_telefone text,
  p_email text,
  p_endereco text,
  p_estado_civil text,
  p_escolaridade text,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_org_id uuid;
begin
  select org_id into v_org_id from perfis where id = p_psicologo_id;
  if v_org_id is null then
    raise exception 'Psicólogo não encontrado';
  end if;

  if exists (
    select 1 from consultas
    where psicologo_id = p_psicologo_id
      and data = p_data
      and horario = p_horario
      and status in ('pendente', 'confirmada')
  ) then
    raise exception 'Horário indisponível';
  end if;

  insert into consultas (
    org_id, psicologo_id, cliente_id, paciente_nome, data, horario, status, tipo, origem,
    modalidade, idade, sexo, profissao, telefone, email, endereco, estado_civil,
    escolaridade, motivo
  ) values (
    -- auth.uid() reflete o JWT de quem chamou o RPC, mesmo sendo security
    -- definer — null se o visitante agendou deslogado (fluxo continua
    -- funcionando igual, só não aparece em "Meus Agendamentos" de ninguém).
    v_org_id, p_psicologo_id, auth.uid(), p_paciente_nome, p_data, p_horario, 'pendente', 'consulta', 'publico',
    p_modalidade, p_idade, p_sexo, p_profissao, p_telefone, p_email, p_endereco, p_estado_civil,
    p_escolaridade, p_motivo
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function criar_agendamento_publico(
  uuid, text, date, time, text, int, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- =========================================================
-- Provisionamento automático: dispara quando o e-mail é confirmado (não no
-- signup em si) — cobre tanto "confirmação de e-mail desativada no
-- projeto" (email_confirmed_at já vem preenchido no INSERT) quanto
-- "confirmação obrigatória" (linha é criada com email_confirmed_at nulo e
-- só é atualizada depois, quando o link do e-mail é clicado).
--
-- Sempre cria a linha em "profiles"; só cria em "perfis" quando o papel já
-- vier resolvido como "psychologist". Login via Google não tem como
-- carregar metadata de role antes do redirect do provedor — nesse caso
-- role fica null de propósito (nunca "psychologist" por padrão), e
-- /auth/callback manda a pessoa pra /auth/escolher-perfil antes de
-- liberar o painel. Uma vez escolhido, block_role_change() trava o valor.
-- =========================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_org_id uuid;
begin
  -- Corpo só roda quando o e-mail acabou de ser confirmado. Checar TG_OP
  -- primeiro garante curto-circuito antes de tocar em "old" no caminho de
  -- INSERT (onde OLD não existe).
  if not (
    (TG_OP = 'INSERT' and new.email_confirmed_at is not null)
    or (TG_OP = 'UPDATE' and old.email_confirmed_at is null and new.email_confirmed_at is not null)
  ) then
    return new;
  end if;

  -- null quando não veio do formulário de cadastro (ex.: primeiro login via
  -- Google) — profiles.role aceita null de propósito para esse caso.
  v_role := new.raw_user_meta_data ->> 'role';

  insert into profiles (id, email, role, name, whatsapp)
  values (
    new.id,
    new.email,
    v_role,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'telefone'
  )
  on conflict (id) do nothing;

  if v_role = 'psicologo' then
    v_org_id := criar_organizacao_para_psicologo(new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));

    insert into perfis (id, nome, crp, uf, whatsapp, org_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      coalesce(new.raw_user_meta_data ->> 'crp', ''),
      coalesce(new.raw_user_meta_data ->> 'uf', ''),
      new.raw_user_meta_data ->> 'telefone',
      v_org_id
    )
    on conflict (id) do nothing;
  end if;

  return new;
exception
  -- Este trigger roda na mesma transação do GoTrue: se ele lançar exceção,
  -- a confirmação de e-mail/login da pessoa quebra junto. Preferível
  -- avisar e deixar a autenticação seguir do que travar o usuário.
  when others then
    raise warning 'handle_new_user falhou para %: %', new.id, sqlerrm;
    return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert or update of email_confirmed_at on auth.users
  for each row execute function handle_new_user();

-- =========================================================
-- Checagem de e-mail já cadastrado, usada na tela de login para diferenciar
-- "conta não existe" de "senha errada" (por padrão o Supabase Auth devolve
-- o mesmo erro genérico pros dois casos, de propósito, pra evitar
-- enumeração de contas). Decisão consciente do produto: expor só um
-- booleano (nunca nome, papel ou qualquer outro dado) — o cadastro já
-- revela a mesma informação hoje via "Já existe uma conta com esse email".
-- =========================================================
create or replace function email_existe(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where lower(email) = lower(p_email)
  );
$$;

grant execute on function email_existe(text) to anon, authenticated;

-- =========================================================
-- Realtime: necessário para a Agenda e o Financeiro do dashboard reagirem a
-- mudanças (agendamentos públicos, lançamentos manuais) sem recarregar.
-- "alter publication ... add table" não aceita "if not exists", por isso o
-- DO block checa antes — reexecutar este arquivo sem isso falharia com
-- "relation is already member of publication".
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'consultas'
  ) then
    alter publication supabase_realtime add table consultas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lancamentos_financeiros'
  ) then
    alter publication supabase_realtime add table lancamentos_financeiros;
  end if;
end $$;

-- =========================================================
-- Lembretes de consulta (1h antes) — agendamento
--
-- pg_cron chama, a cada 10 minutos, o endpoint /api/notificacoes/dispatch
-- da aplicação, que enfileira e envia os lembretes. O cron da Vercel não
-- serve aqui: no plano grátis ele só roda 1x por dia.
--
-- ANTES DE FUNCIONAR, rode uma vez (com os seus valores reais — não commite):
--   insert into app_secrets (chave, valor) values
--     ('app_url', 'https://SEU-APP.vercel.app'),
--     ('cron_secret', 'UM-SEGREDO-LONGO-E-ALEATORIO')
--   on conflict (chave) do update set valor = excluded.valor;
-- O mesmo valor de cron_secret precisa estar na env var CRON_SECRET da Vercel.
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function disparar_lembretes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select valor into v_url from app_secrets where chave = 'app_url';
  select valor into v_secret from app_secrets where chave = 'cron_secret';

  -- Sem configuração ainda: não faz nada em vez de estourar erro a cada 10
  -- minutos no log do banco.
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/api/notificacoes/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- unschedule antes de agendar: "cron.schedule" com o mesmo nome atualiza o
-- job, mas o unschedule explícito deixa o arquivo reexecutável sem depender
-- desse detalhe de versão do pg_cron.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'lembretes-consulta') then
    perform cron.unschedule('lembretes-consulta');
  end if;
end $$;

select cron.schedule(
  'lembretes-consulta',
  '*/10 * * * *',
  $$select disparar_lembretes()$$
);

-- =========================================================
-- checkins_humor — check-in diário de humor do cliente. Dado de saúde
-- sensível (LGPD), mesmo tratamento de "sessoes_prontuario": nunca
-- logado/exposto além do necessário, RLS restringe leitura ao próprio
-- cliente e ao(s) psicólogo(s) com paciente vinculado a essa conta.
-- =========================================================
create table if not exists checkins_humor (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references auth.users(id) on delete cascade,
  -- Sempre calculada no cliente via todayIso() (fuso America/Sao_Paulo) e
  -- enviada explicitamente — nunca current_date do servidor (que é UTC).
  -- Mesmo motivo do comentário sobre consultas.data em src/lib/format.ts.
  data date not null,
  humor smallint not null check (humor between 1 and 5), -- 1=Muito Ruim .. 5=Ótimo
  energia smallint not null check (energia between 1 and 5),
  tags text[] not null default '{}'
    check (tags <@ array['sono','trabalho','alimentacao','exercicio','relacionamentos','saude']::text[]),
  reflexao_positiva text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um check-in por dia por cliente: reabrir a tela no mesmo dia atualiza
  -- (upsert) em vez de duplicar — é o que mantém "3 dias seguidos" e a
  -- média por dia da semana simples de calcular.
  unique (cliente_id, data)
);

-- org_id fica nullable e fora do filtro das policies abaixo de propósito:
-- é o cliente quem grava aqui, e profiles.org_id de um paciente só se
-- resolve no aceite do convite (ver aceitar_convite_paciente) — comparar
-- checkins_humor.org_id = auth_org_id() numa janela em que ainda esteja
-- null bloquearia um check-in legítimo. A coluna existe só pra
-- consistência do schema (toda tabela carrega org_id); quem decide acesso
-- continua sendo cliente_id/o vínculo em "pacientes", como já era.
alter table checkins_humor add column if not exists org_id uuid references organizations(id);
update checkins_humor ch set org_id = p.org_id from profiles p where ch.cliente_id = p.id and ch.org_id is null;

-- Fase 3: campos extras do diário de humor pedidos no portal do paciente.
-- Nullable — check-ins antigos não têm esses dados, e o paciente pode
-- continuar preenchendo só humor/energia se quiser.
alter table checkins_humor add column if not exists ansiedade smallint;
alter table checkins_humor add column if not exists sono_horas numeric(3, 1);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkins_humor_ansiedade_check'
  ) then
    alter table checkins_humor add constraint checkins_humor_ansiedade_check
      check (ansiedade is null or ansiedade between 1 and 5);
  end if;
end $$;

create index if not exists checkins_humor_cliente_data_idx
  on checkins_humor (cliente_id, data desc);

create or replace trigger checkins_humor_set_updated_at
  before update on checkins_humor
  for each row execute function set_updated_at();

alter table checkins_humor enable row level security;

drop policy if exists "cliente_ve_proprios_checkins" on checkins_humor;
create policy "cliente_ve_proprios_checkins" on checkins_humor
  for select using (auth.uid() = cliente_id);
drop policy if exists "cliente_cria_proprios_checkins" on checkins_humor;
create policy "cliente_cria_proprios_checkins" on checkins_humor
  for insert with check (auth.uid() = cliente_id);
drop policy if exists "cliente_edita_proprios_checkins" on checkins_humor;
create policy "cliente_edita_proprios_checkins" on checkins_humor
  for update using (auth.uid() = cliente_id) with check (auth.uid() = cliente_id);

-- Mesmo padrão de "psicologo_ve_proprias_sessoes", só que o join é por
-- cliente_user_id (vínculo manual) em vez de paciente_id direto. Só
-- SELECT — o psicólogo nunca cria/edita humor do paciente.
drop policy if exists "psicologo_ve_humor_pacientes_vinculados" on checkins_humor;
create policy "psicologo_ve_humor_pacientes_vinculados" on checkins_humor
  for select using (
    exists (
      select 1 from pacientes p
      where p.cliente_user_id = checkins_humor.cliente_id
        and p.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- convites_paciente — conta de cliente deixou de ser auto-serviço: ninguém
-- se cadastra como paciente sozinho (o /cadastro é só de psicólogo). O
-- psicólogo gera um convite por paciente na ficha dele e envia o link; só
-- quem tem o token vira cliente, e a conta já nasce amarrada àquela ficha.
--
-- O token é aleatório (não o id do paciente) porque a página do convite é
-- pública: com o id na URL daria pra enumerar pacientes, e "fulano é
-- paciente do psicólogo X" é dado sensível de saúde (LGPD).
-- =========================================================
create table if not exists convites_paciente (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  token text not null unique,
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  aceito_por uuid references auth.users(id) on delete set null
);

alter table convites_paciente add column if not exists org_id uuid references organizations(id);
update convites_paciente cv set org_id = pac.org_id from pacientes pac where cv.paciente_id = pac.id and cv.org_id is null;
alter table convites_paciente alter column org_id set not null;

create index if not exists convites_paciente_paciente_idx
  on convites_paciente (paciente_id);

alter table convites_paciente enable row level security;

-- Só o dono do paciente enxerga/gera convites. O acesso público ao token
-- não passa por policy: vai pelas funções security definer abaixo, que
-- devolvem só o mínimo necessário para montar a tela do convite.
drop policy if exists "psicologo_ve_proprios_convites" on convites_paciente;
create policy "psicologo_ve_proprios_convites" on convites_paciente
  for select using (
    org_id = auth_org_id()
    and exists (
      select 1 from pacientes p
      where p.id = convites_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- gerar_convite_paciente — cria (ou reaproveita) o convite pendente de um
-- paciente e devolve o token. Reaproveitar evita encher a tabela de tokens
-- válidos toda vez que o psicólogo reabre a tela pra copiar o link.
-- =========================================================
create or replace function gerar_convite_paciente(p_paciente_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from pacientes
    where id = p_paciente_id and psicologo_id = auth.uid()
  ) then
    raise exception 'Paciente não encontrado';
  end if;

  if exists (
    select 1 from pacientes
    where id = p_paciente_id and cliente_user_id is not null
  ) then
    raise exception 'Este paciente já tem uma conta vinculada.';
  end if;

  select token into v_token
  from convites_paciente
  where paciente_id = p_paciente_id and aceito_em is null
  limit 1;

  if v_token is null then
    v_token := encode(gen_random_bytes(24), 'hex');
    insert into convites_paciente (paciente_id, token, org_id)
    values (p_paciente_id, v_token, (select org_id from pacientes where id = p_paciente_id));
  end if;

  return v_token;
end;
$$;

grant execute on function gerar_convite_paciente(uuid) to authenticated;

-- =========================================================
-- convite_info — dados mínimos pra montar a página pública do convite.
-- Devolve só o primeiro nome do paciente: se o link vazar, "Maria" expõe
-- muito menos do que o nome completo + o vínculo com o psicólogo.
-- =========================================================
create or replace function convite_info(p_token text)
returns table (paciente_primeiro_nome text, psicologo_nome text, ja_aceito boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    split_part(p.nome, ' ', 1),
    pf.nome,
    c.aceito_em is not null
  from convites_paciente c
  join pacientes p on p.id = c.paciente_id
  join perfis pf on pf.id = p.psicologo_id
  where c.token = p_token;
$$;

-- anon (quem abre o link sem estar logado) precisa ler para a página existir.
grant execute on function convite_info(text) to anon, authenticated;

-- =========================================================
-- aceitar_convite_paciente — chamado depois que a conta do cliente já
-- existe e está logada: amarra a conta à ficha e traz o histórico de
-- consultas que a pessoa marcou antes de ter conta (cliente_id ficava nulo
-- nesses agendamentos, feitos pelo link público sem login) — sem isso
-- "Meus Agendamentos" nasceria vazio pra quem já era paciente.
-- =========================================================
create or replace function aceitar_convite_paciente(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
  v_org_id uuid;
begin
  select paciente_id into v_paciente_id
  from convites_paciente
  where token = p_token and aceito_em is null;

  if v_paciente_id is null then
    raise exception 'Convite inválido ou já utilizado.';
  end if;

  select org_id into v_org_id from pacientes where id = v_paciente_id;

  update pacientes
  set cliente_user_id = auth.uid()
  where id = v_paciente_id;

  update consultas
  set cliente_id = auth.uid()
  where paciente_id = v_paciente_id and cliente_id is null;

  update convites_paciente
  set aceito_em = now(), aceito_por = auth.uid()
  where token = p_token;

  -- Decisão de produto: um paciente pertence a uma única organização (a do
  -- psicólogo que o convidou). Só seta na primeira aceitação (perfil de
  -- paciente nasce sem org_id, ver comentário em profiles.org_id acima).
  update profiles
  set org_id = v_org_id
  where id = auth.uid() and org_id is null;
end;
$$;

grant execute on function aceitar_convite_paciente(text) to authenticated;

-- =========================================================
-- vincular_paciente_cliente REMOVIDA: vincular por e-mail pressupunha que o
-- paciente já tivesse conta, e conta de cliente agora só nasce por convite
-- (ver convites_paciente acima), que já faz o vínculo no mesmo passo.
-- Manter a função viva deixaria um caminho security definer capaz de amarrar
-- QUALQUER conta de cliente a um paciente sabendo só o e-mail. O drop remove
-- a função dos bancos que rodaram uma versão anterior deste arquivo.
-- =========================================================
drop function if exists vincular_paciente_cliente(uuid, text);

-- =========================================================
-- avisos_psicologo — inbox simples de avisos in-app pro psicólogo (ex.:
-- cliente parou de compartilhar o humor). In-app em vez de e-mail: o
-- psicólogo só fica sabendo ao abrir o painel, sem expor o assunto pra
-- caixa de entrada de terceiros. Só parar_compartilhar_humor insere
-- (security definer, ver abaixo) — de propósito não há policy de INSERT
-- pra "authenticated", senão qualquer psicólogo autenticado poderia forjar
-- um aviso pra outro.
-- =========================================================
create table if not exists avisos_psicologo (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  mensagem text not null,
  lido boolean not null default false,
  created_at timestamptz not null default now()
);

alter table avisos_psicologo add column if not exists org_id uuid references organizations(id);
update avisos_psicologo a set org_id = p.org_id from profiles p where a.psicologo_id = p.id and a.org_id is null;
alter table avisos_psicologo alter column org_id set not null;

create index if not exists avisos_psicologo_psicologo_id_idx
  on avisos_psicologo (psicologo_id, created_at desc);

alter table avisos_psicologo enable row level security;

drop policy if exists "psicologo_ve_proprios_avisos" on avisos_psicologo;
create policy "psicologo_ve_proprios_avisos" on avisos_psicologo
  for select using (org_id = auth_org_id() and auth.uid() = psicologo_id);

drop policy if exists "psicologo_marca_proprios_avisos" on avisos_psicologo;
create policy "psicologo_marca_proprios_avisos" on avisos_psicologo
  for update using (org_id = auth_org_id() and auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);

-- =========================================================
-- meus_compartilhamentos_humor / parar_compartilhar_humor — o vínculo
-- pacientes.cliente_user_id (preenchido ao aceitar o convite) é o que
-- decide quem enxerga o check-in de humor do cliente, mas até aqui só o
-- psicólogo via/desfazia esse vínculo — o cliente não tinha como saber com
-- quem seu humor estava sendo compartilhado, nem como parar sozinho.
-- security definer pelo mesmo motivo de sempre: cliente não tem (e não deve
-- ter) policy de SELECT em "pacientes" — a tabela carrega anotações do
-- psicólogo (observacoes) que não são pra o paciente ler; estas funções só
-- devolvem os campos estritamente necessários pra essa tela.
-- =========================================================
create or replace function meus_compartilhamentos_humor()
returns table (paciente_id uuid, psicologo_id uuid, psicologo_nome text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.psicologo_id, pf.nome
  from pacientes p
  join perfis pf on pf.id = p.psicologo_id
  where p.cliente_user_id = auth.uid()
  order by pf.nome;
$$;

grant execute on function meus_compartilhamentos_humor() to authenticated;

-- Desfaz o vínculo e registra um aviso in-app pro psicólogo (ver
-- avisos_psicologo acima) — chamada direto do cliente, sem rota
-- intermediária, porque não depende mais de segredo de e-mail nenhum.
-- drop explícito: a versão anterior devolvia table(...), e "create or
-- replace" não deixa mudar o tipo de retorno de uma função existente.
drop function if exists parar_compartilhar_humor(uuid);
create or replace function parar_compartilhar_humor(p_paciente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_psicologo_id uuid;
  v_paciente_nome text;
  v_org_id uuid;
begin
  select psicologo_id, nome, org_id into v_psicologo_id, v_paciente_nome, v_org_id
  from pacientes
  where id = p_paciente_id and cliente_user_id = auth.uid();

  if v_psicologo_id is null then
    raise exception 'Vínculo não encontrado.';
  end if;

  update pacientes set cliente_user_id = null where id = p_paciente_id;

  insert into avisos_psicologo (psicologo_id, mensagem, org_id)
  values (
    v_psicologo_id,
    v_paciente_nome || ' parou de compartilhar o check-in de humor com você.',
    v_org_id
  );
end;
$$;

grant execute on function parar_compartilhar_humor(uuid) to authenticated;

-- =========================================================
-- meu_psicologo_contato — telefone/nome do psicólogo da consulta mais
-- recente do cliente logado, usado só pelo botão de emergência do check-in
-- de humor (abrir WhatsApp). security definer pelo mesmo motivo de sempre:
-- a RLS de "perfis" é auth.uid() = id, e mesmo sem RLS um select * vazaria
-- sala_online_url, que nunca deve sair do despachante de notificações.
-- =========================================================
create or replace function meu_psicologo_contato()
returns table (psicologo_id uuid, nome text, whatsapp text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nome, p.whatsapp
  from perfis p
  where p.id = (
    select c.psicologo_id
    from consultas c
    where c.cliente_id = auth.uid()
      and c.tipo = 'consulta'
      and c.status <> 'desmarcada'
    order by c.data desc, c.horario desc
    limit 1
  );
$$;

grant execute on function meu_psicologo_contato() to authenticated;

-- =========================================================
-- confirmar_consulta_e_criar_paciente — ao confirmar uma consulta vinda do
-- agendamento público (origem='publico') de alguém que ainda não é
-- paciente cadastrado (paciente_id null), cria automaticamente o cadastro
-- em "pacientes" usando os dados que a própria pessoa já preencheu no
-- agendamento (nome, telefone, email, escolaridade) em vez do psicólogo
-- ter que digitar tudo de novo manualmente. security definer só pra manter
-- a operação atômica (status + criação/vínculo do paciente numa única
-- chamada) — a autorização real é o "psicologo_id = auth.uid()" abaixo.
-- =========================================================
-- drop antes do create or replace: muda o tipo de retorno em relação à
-- primeira versão desta função (ganhou a coluna "criado"), e o Postgres
-- recusa "create or replace" quando o retorno muda de shape.
drop function if exists confirmar_consulta_e_criar_paciente(uuid);

create or replace function confirmar_consulta_e_criar_paciente(p_consulta_id uuid)
returns table (paciente_id uuid, criado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v consultas%rowtype;
  v_paciente_id uuid;
  v_observacoes text;
  v_criado boolean := false;
begin
  select * into v from consultas
  where id = p_consulta_id and psicologo_id = auth.uid();
  if not found then
    raise exception 'Consulta não encontrada';
  end if;

  update consultas set status = 'confirmada' where id = p_consulta_id;

  -- Bloqueios de agenda (tipo='bloqueio') e consultas que já têm um
  -- paciente vinculado não geram/alteram cadastro nenhum.
  if v.tipo <> 'consulta' or v.paciente_id is not null then
    return query select v.paciente_id, false;
    return;
  end if;

  -- A pessoa pode já ter um paciente vinculado à própria conta de cliente
  -- (ex.: segundo agendamento dela, ou vínculo manual feito antes pelo
  -- psicólogo) — reaproveita em vez de duplicar o cadastro.
  if v.cliente_id is not null then
    select id into v_paciente_id
    from pacientes
    where psicologo_id = v.psicologo_id and cliente_user_id = v.cliente_id
    limit 1;
  end if;

  if v_paciente_id is null then
    -- Nem todo dado coletado no agendamento público tem coluna própria em
    -- "pacientes" (idade, sexo, profissão, estado civil, endereço) — em vez
    -- de descartar, junta como texto livre em "observacoes" pra não perder
    -- a informação que a pessoa já forneceu.
    v_observacoes := nullif(concat_ws(', ',
      case when v.idade is not null then v.idade || ' anos' end,
      v.sexo,
      v.profissao,
      v.estado_civil
    ), '');
    if v.endereco is not null then
      v_observacoes := concat_ws(E'\n', v_observacoes, v.endereco);
    end if;
    if v.motivo is not null then
      v_observacoes := concat_ws(E'\n', v_observacoes, 'Motivo do agendamento: ' || v.motivo);
    end if;

    insert into pacientes (
      org_id, psicologo_id, nome, telefone, email, escolaridade,
      cliente_user_id, data_primeira_consulta, observacoes
    ) values (
      v.org_id, v.psicologo_id, v.paciente_nome, v.telefone, v.email, v.escolaridade,
      v.cliente_id, v.data, v_observacoes
    )
    returning id into v_paciente_id;
    v_criado := true;
  end if;

  update consultas set paciente_id = v_paciente_id where id = p_consulta_id;

  return query select v_paciente_id, v_criado;
end;
$$;

grant execute on function confirmar_consulta_e_criar_paciente(uuid) to authenticated;

-- =========================================================
-- cancelar_consulta_cliente — cliente cancela um agendamento próprio
-- (pendente ou confirmado) e é obrigado a registrar o motivo. Cliente nunca
-- teve policy de UPDATE em "consultas" (só SELECT, ver
-- cliente_ve_proprios_agendamentos acima) de propósito — em vez de abrir uma
-- policy genérica, esta função valida a dona (cliente_id = auth.uid()) e a
-- transição de status permitida, e é a única porta de entrada pra esse caso.
-- Devolve o e-mail/nome do psicólogo pra quem chamou notificá-lo por e-mail
-- logo em seguida (rota /api/notificacoes/cancelamento), sem precisar de uma
-- segunda função só pra isso.
-- =========================================================
create or replace function cancelar_consulta_cliente(
  p_consulta_id uuid,
  p_motivo text
)
returns table (
  psicologo_email text,
  psicologo_nome text,
  paciente_nome text,
  data date,
  horario time
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v consultas%rowtype;
  v_motivo text := nullif(trim(p_motivo), '');
  v_prazo_horas int;
begin
  if v_motivo is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into v from consultas
  where id = p_consulta_id and cliente_id = auth.uid();
  if not found then
    raise exception 'Agendamento não encontrado.';
  end if;

  if v.status not in ('pendente', 'confirmada') then
    raise exception 'Este agendamento não pode mais ser cancelado.';
  end if;

  -- Prazo mínimo configurável por organização (0 = sem restrição, padrão
  -- atual preservado). Ver organizations.prazo_cancelamento_horas.
  select o.prazo_cancelamento_horas into v_prazo_horas
  from organizations o where o.id = v.org_id;

  if v_prazo_horas > 0 and (v.data + v.horario)::timestamp - (v_prazo_horas || ' hours')::interval < now() then
    raise exception 'Esse agendamento só pode ser cancelado com pelo menos % horas de antecedência.', v_prazo_horas;
  end if;

  update consultas
  set status = 'desmarcada', motivo_cancelamento = v_motivo
  where id = p_consulta_id;

  return query
  select pr.email, pr.name, v.paciente_nome, v.data, v.horario
  from profiles pr
  where pr.id = v.psicologo_id;
end;
$$;

grant execute on function cancelar_consulta_cliente(uuid, text) to authenticated;

-- =========================================================
-- confirmar_consulta_cliente — o paciente confirma presença numa consulta
-- pendente. Mesmo motivo de cancelar_consulta_cliente: cliente não tem
-- policy de UPDATE em "consultas", então isso passa por security definer.
-- =========================================================
create or replace function confirmar_consulta_cliente(p_consulta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update consultas
  set status = 'confirmada'
  where id = p_consulta_id and cliente_id = auth.uid() and status = 'pendente';

  if not found then
    raise exception 'Agendamento não encontrado ou já não está mais pendente.';
  end if;
end;
$$;

grant execute on function confirmar_consulta_cliente(uuid) to authenticated;

-- =========================================================
-- materiais_paciente — biblioteca pessoal: PDFs, áudios de meditação,
-- formulários e leituras que o psicólogo envia para UM paciente
-- específico. O arquivo em si vai para o bucket privado abaixo; esta
-- tabela guarda só os metadados e o caminho.
-- =========================================================
create table if not exists materiais_paciente (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  titulo text not null,
  descricao text,
  -- Caminho dentro do bucket, sempre no formato {paciente_id}/{arquivo}.
  -- As policies de storage.objects abaixo dependem desse formato: a primeira
  -- pasta do caminho é o que amarra o arquivo ao paciente.
  storage_path text not null unique,
  nome_arquivo text not null,
  tipo_mime text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);

alter table materiais_paciente add column if not exists org_id uuid references organizations(id);
update materiais_paciente m set org_id = pac.org_id from pacientes pac where m.paciente_id = pac.id and m.org_id is null;
alter table materiais_paciente alter column org_id set not null;

create index if not exists materiais_paciente_paciente_idx
  on materiais_paciente (paciente_id, created_at desc);

alter table materiais_paciente enable row level security;

drop policy if exists "psicologo_gerencia_materiais" on materiais_paciente;
create policy "psicologo_gerencia_materiais" on materiais_paciente
  for all using (
    exists (
      select 1 from pacientes p
      where p.id = materiais_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from pacientes p
      where p.id = materiais_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );

-- eh_meu_paciente — "este paciente_id pertence ao cliente logado?", sem
-- expor a linha de "pacientes" pra ele. Existe porque uma policy comum
-- (exists (select ... from pacientes where cliente_user_id = auth.uid()))
-- roda a subquery COM as permissões de quem chamou: o cliente nunca teve (e
-- não pode ter) SELECT em "pacientes" — a tabela carrega anotação clínica
-- (observacoes) que não é pra ele ler — então essa subquery sempre voltava
-- vazia mesmo pro próprio registro dele, e toda policy "cliente_le_*" que
-- dependia disso falhava silenciosamente. security definer contorna isso:
-- a função enxerga a linha (dono da função tem acesso), mas só devolve
-- true/false, nunca os dados.
-- Parâmetro é text (não uuid) de propósito: recebe direto o pedaço de
-- caminho do storage (storage.foldername), que não pode ser convertido pra
-- uuid sem risco de explodir em qualquer arquivo solto com nome fora do
-- padrão. Compara como texto, igual às policies de storage do psicólogo.
create or replace function eh_meu_paciente(p_paciente_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from pacientes
    where id::text = p_paciente_id and cliente_user_id = auth.uid()
  );
$$;

grant execute on function eh_meu_paciente(text) to authenticated;

-- Paciente só lê o que foi enviado para a ficha dele (e só se tiver conta
-- vinculada, ver convites_paciente).
drop policy if exists "cliente_le_proprios_materiais" on materiais_paciente;
create policy "cliente_le_proprios_materiais" on materiais_paciente
  for select using (eh_meu_paciente(materiais_paciente.paciente_id::text));

-- Bucket PRIVADO: material clínico nunca pode ficar em URL pública
-- adivinhável. A leitura acontece por URL assinada, que expira.
insert into storage.buckets (id, name, public)
values ('materiais-paciente', 'materiais-paciente', false)
on conflict (id) do nothing;

-- Policies do storage: a primeira pasta do caminho é o paciente_id, então
-- dá pra decidir acesso sem consultar materiais_paciente. Compara como texto
-- (p.id::text) de propósito — cast do nome da pasta para uuid explodiria em
-- qualquer arquivo solto com nome fora do padrão.
drop policy if exists "psicologo_gerencia_materiais_storage" on storage.objects;
create policy "psicologo_gerencia_materiais_storage" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'materiais-paciente'
    and exists (
      select 1 from pacientes p
      where p.id::text = (storage.foldername(name))[1]
        and p.psicologo_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'materiais-paciente'
    and exists (
      select 1 from pacientes p
      where p.id::text = (storage.foldername(name))[1]
        and p.psicologo_id = auth.uid()
    )
  );

drop policy if exists "cliente_le_materiais_storage" on storage.objects;
create policy "cliente_le_materiais_storage" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materiais-paciente'
    -- Mesmo motivo de eh_meu_paciente acima: o cliente não tem SELECT em
    -- "pacientes", então a checagem tem que passar pela função em vez de
    -- uma subquery direta na tabela.
    and eh_meu_paciente((storage.foldername(name))[1])
  );

-- =========================================================
-- habitos_paciente — quais hábitos ESTE paciente acompanha. É o psicólogo
-- que liga/desliga: marcar "tomou a medicação" para quem não usa medicação
-- vira ruído e falso não-aderiu no gráfico dele.
-- =========================================================
create table if not exists habitos_paciente (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  chave text not null check (chave in (
    'sono', 'medicacao', 'exercicio', 'alimentacao',
    'agua', 'meditacao', 'social', 'sem_alcool'
  )),
  created_at timestamptz not null default now(),
  unique (paciente_id, chave)
);

alter table habitos_paciente add column if not exists org_id uuid references organizations(id);
update habitos_paciente h set org_id = pac.org_id from pacientes pac where h.paciente_id = pac.id and h.org_id is null;
alter table habitos_paciente alter column org_id set not null;

alter table habitos_paciente enable row level security;

drop policy if exists "psicologo_gerencia_habitos" on habitos_paciente;
create policy "psicologo_gerencia_habitos" on habitos_paciente
  for all using (
    exists (
      select 1 from pacientes p
      where p.id = habitos_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from pacientes p
      where p.id = habitos_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );

-- Paciente precisa ler para saber quais caixinhas aparecem pra ele. Mesmo
-- motivo de eh_meu_paciente (ver materiais_paciente acima): uma subquery
-- direta em "pacientes" aqui sempre voltaria vazia, porque o cliente não
-- tem SELECT nessa tabela.
drop policy if exists "cliente_le_proprios_habitos" on habitos_paciente;
create policy "cliente_le_proprios_habitos" on habitos_paciente
  for select using (eh_meu_paciente(habitos_paciente.paciente_id::text));

-- =========================================================
-- registros_habito — o tique diário do paciente. Tabela própria (e não
-- colunas em checkins_humor) porque checkins_humor.humor é NOT NULL: marcar
-- só a rotina, sem registrar humor no dia, não caberia lá.
-- =========================================================
create table if not exists registros_habito (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references auth.users(id) on delete cascade,
  -- Mesma regra de checkins_humor.data: calculada no cliente (Brasília),
  -- nunca current_date do servidor (UTC).
  data date not null,
  chave text not null,
  feito boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (cliente_id, data, chave)
);

-- org_id nullable, mesmo motivo de checkins_humor.org_id acima.
alter table registros_habito add column if not exists org_id uuid references organizations(id);
update registros_habito r set org_id = p.org_id from profiles p where r.cliente_id = p.id and r.org_id is null;

create index if not exists registros_habito_cliente_data_idx
  on registros_habito (cliente_id, data desc);

create or replace trigger registros_habito_set_updated_at
  before update on registros_habito
  for each row execute function set_updated_at();

alter table registros_habito enable row level security;

drop policy if exists "cliente_gerencia_proprios_habitos" on registros_habito;
create policy "cliente_gerencia_proprios_habitos" on registros_habito
  for all using (auth.uid() = cliente_id) with check (auth.uid() = cliente_id);

-- Psicólogo só lê (nunca marca no lugar do paciente), e só de paciente
-- vinculado — mesmo padrão de psicologo_ve_humor_pacientes_vinculados.
drop policy if exists "psicologo_ve_habitos_pacientes" on registros_habito;
create policy "psicologo_ve_habitos_pacientes" on registros_habito
  for select using (
    exists (
      select 1 from pacientes p
      where p.cliente_user_id = registros_habito.cliente_id
        and p.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- diario_paciente — anotações livres do paciente. Cada entrada nasce
-- PRIVADA e só aparece para o psicólogo se a pessoa marcar como
-- compartilhada; a policy de leitura do psicólogo exige
-- visibilidade = compartilhada, então entrada privada é invisível para ele
-- no banco, não só na tela.
-- =========================================================
create table if not exists diario_paciente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references auth.users(id) on delete cascade,
  conteudo text not null,
  visibilidade text not null default 'privada'
    check (visibilidade in ('privada', 'compartilhada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- org_id nullable, mesmo motivo de checkins_humor.org_id acima.
alter table diario_paciente add column if not exists org_id uuid references organizations(id);
update diario_paciente di set org_id = p.org_id from profiles p where di.cliente_id = p.id and di.org_id is null;

create index if not exists diario_paciente_cliente_idx
  on diario_paciente (cliente_id, created_at desc);

create or replace trigger diario_paciente_set_updated_at
  before update on diario_paciente
  for each row execute function set_updated_at();

alter table diario_paciente enable row level security;

drop policy if exists "cliente_gerencia_proprio_diario" on diario_paciente;
create policy "cliente_gerencia_proprio_diario" on diario_paciente
  for all using (auth.uid() = cliente_id) with check (auth.uid() = cliente_id);

drop policy if exists "psicologo_le_diario_compartilhado" on diario_paciente;
create policy "psicologo_le_diario_compartilhado" on diario_paciente
  for select using (
    visibilidade = 'compartilhada'
    and exists (
      select 1 from pacientes p
      where p.cliente_user_id = diario_paciente.cliente_id
        and p.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- consentimentos (Fase 3) — aceite de termos pelo paciente no portal
-- (contrato de prestação de serviço, LGPD, processamento por IA). Guarda o
-- TEXTO INTEGRAL aceito (não só a versão) porque o texto padrão pode mudar
-- no futuro — sem isso, não daria pra provar o que a pessoa realmente leu
-- e aceitou numa fiscalização. hash é redundante com o texto guardado de
-- propósito: é o que permite detectar uma alteração posterior sem
-- reprocessar o texto inteiro. Nunca UPDATE/DELETE — revogar é uma linha
-- nova com revogado_em, não apagar a antiga.
-- =========================================================
create table if not exists consentimentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  tipo text not null check (tipo in ('contrato_tdic', 'lgpd', 'gravacao_sessao', 'processamento_ia')),
  versao_texto text not null,
  texto_integral text not null,
  hash_texto text not null,
  aceito boolean not null default true,
  aceito_em timestamptz not null default now(),
  ip inet,
  revogado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists consentimentos_paciente_id_idx on consentimentos (paciente_id, tipo);

alter table consentimentos enable row level security;

-- Mesmo motivo de materiais_paciente/habitos_paciente: cliente não tem
-- SELECT em "pacientes", então precisa passar por eh_meu_paciente().
drop policy if exists "cliente_ve_proprios_consentimentos" on consentimentos;
create policy "cliente_ve_proprios_consentimentos" on consentimentos
  for select using (eh_meu_paciente(consentimentos.paciente_id::text));
drop policy if exists "psicologo_ve_consentimentos_pacientes" on consentimentos;
create policy "psicologo_ve_consentimentos_pacientes" on consentimentos
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = consentimentos.paciente_id and p.psicologo_id = auth.uid()
    )
  );
-- Sem policy de insert direta: só via aceitar_consentimento() abaixo (grava
-- IP/hash de forma consistente, e evita que o cliente forje aceito_em ou
-- aceite em nome de outro paciente).

-- Registra o aceite. IP fica null quando chamado direto do client (RPC via
-- supabase-js não tem acesso ao IP do visitante) — a rota
-- /api/consentimentos/aceitar preenche o IP de verdade porque roda num
-- route handler, com acesso ao cabeçalho da requisição.
create or replace function aceitar_consentimento(
  p_tipo text,
  p_versao_texto text,
  p_texto_integral text,
  p_hash_texto text,
  p_ip inet default null
)
returns consentimentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
  v_org_id uuid;
  v_row consentimentos;
begin
  select id, org_id into v_paciente_id, v_org_id
  from pacientes where cliente_user_id = auth.uid()
  limit 1;

  if v_paciente_id is null then
    raise exception 'Nenhuma ficha de paciente vinculada a esta conta.';
  end if;

  insert into consentimentos (
    org_id, paciente_id, tipo, versao_texto, texto_integral, hash_texto, ip
  ) values (
    v_org_id, v_paciente_id, p_tipo, p_versao_texto, p_texto_integral, p_hash_texto, p_ip
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function aceitar_consentimento(text, text, text, text, inet) to authenticated;

-- Consentimento de gravação de sessão (Res. CFP 13/2022): diferente dos
-- outros tipos, o paciente normalmente concorda VERBALMENTE no início do
-- atendimento, não logado no próprio portal — quem está com a mão no app
-- naquele momento é o psicólogo (ver session-transcription-modal.tsx). Por
-- isso esta função é chamada pelo psicólogo, atestando em nome do paciente
-- (fica registrado como tal — "aceito por" não é o mesmo texto de
-- aceitar_consentimento, que é sempre o próprio titular). Continua exigindo
-- que o paciente já tenha ficha com este psicólogo como dono.
create or replace function registrar_consentimento_gravacao(
  p_paciente_id uuid,
  p_versao_texto text,
  p_texto_integral text,
  p_hash_texto text,
  p_ip inet default null
)
returns consentimentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_row consentimentos;
begin
  select org_id into v_org_id
  from pacientes where id = p_paciente_id and psicologo_id = auth.uid();

  if v_org_id is null then
    raise exception 'Paciente não encontrado.';
  end if;

  insert into consentimentos (
    org_id, paciente_id, tipo, versao_texto, texto_integral, hash_texto, ip
  ) values (
    v_org_id, p_paciente_id, 'gravacao_sessao', p_versao_texto, p_texto_integral, p_hash_texto, p_ip
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function registrar_consentimento_gravacao(uuid, text, text, text, inet) to authenticated;

-- =========================================================
-- tarefas_paciente (Fase 3) — tarefa de casa que o psicólogo atribui a um
-- paciente; o paciente responde/marca como concluída no portal.
-- =========================================================
create table if not exists tarefas_paciente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  titulo text not null,
  instrucoes text,
  prazo date,
  concluida_em timestamptz,
  resposta_paciente text,
  created_at timestamptz not null default now()
);

create index if not exists tarefas_paciente_paciente_id_idx on tarefas_paciente (paciente_id, created_at desc);

alter table tarefas_paciente enable row level security;

drop policy if exists "psicologo_gerencia_tarefas" on tarefas_paciente;
create policy "psicologo_gerencia_tarefas" on tarefas_paciente
  for all using (
    org_id = auth_org_id() and psicologo_id = auth.uid()
  ) with check (
    org_id = auth_org_id() and psicologo_id = auth.uid()
  );

-- Paciente só lê e só grava resposta/conclusão — nunca título/instruções
-- (essas são do psicólogo). A policy de update aqui é ampla (RLS não
-- distingue coluna), então o controle de "só resposta/conclusão" fica por
-- conta da UI; nada sensível vaza mudando outras colunas de qualquer forma.
drop policy if exists "cliente_ve_proprias_tarefas" on tarefas_paciente;
create policy "cliente_ve_proprias_tarefas" on tarefas_paciente
  for select using (eh_meu_paciente(tarefas_paciente.paciente_id::text));
drop policy if exists "cliente_responde_proprias_tarefas" on tarefas_paciente;
create policy "cliente_responde_proprias_tarefas" on tarefas_paciente
  for update using (eh_meu_paciente(tarefas_paciente.paciente_id::text));

-- =========================================================
-- planos_terapeuticos / objetivos_terapeuticos (Fase 4) — hipótese,
-- objetivo geral e objetivos específicos com indicador de progresso.
-- Nunca visível ao paciente (mesmo sigilo de sessoes_prontuario: é
-- raciocínio clínico do psicólogo, não dado que o paciente deva ler
-- diretamente — diferente de tarefas_paciente, que É pensada pra ele ler).
-- =========================================================
create table if not exists planos_terapeuticos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  abordagem text,
  hipotese_diagnostica text,
  objetivo_geral text,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'pausado')),
  revisar_em date,
  -- Guarda o "revisar_em" pro qual já foi gerado um aviso in-app (ver
  -- verificar_revisoes_pendentes abaixo), pra não repetir o mesmo aviso a
  -- cada login depois que a data já venceu.
  revisao_avisada_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planos_terapeuticos_paciente_id_idx on planos_terapeuticos (paciente_id);

create or replace trigger planos_terapeuticos_set_updated_at
  before update on planos_terapeuticos
  for each row execute function set_updated_at();

alter table planos_terapeuticos enable row level security;

-- Retenção obrigatória (Res. CFP 01/2009 e 06/2019, mesma regra de
-- "pacientes"): a hipótese diagnóstica e o raciocínio clínico registrados
-- aqui não podem ser apagados fisicamente do banco, só pausados/concluídos
-- (status). Por isso "psicologo_gerencia_planos" (for all, que incluía
-- DELETE) virou 3 policies separadas sem nenhuma de delete — dropar o nome
-- antigo evita que ele fique combinando por OR com as novas.
drop policy if exists "psicologo_gerencia_planos" on planos_terapeuticos;
drop policy if exists "psicologo_ve_planos" on planos_terapeuticos;
create policy "psicologo_ve_planos" on planos_terapeuticos
  for select using (org_id = auth_org_id() and psicologo_id = auth.uid());
drop policy if exists "psicologo_cria_planos" on planos_terapeuticos;
create policy "psicologo_cria_planos" on planos_terapeuticos
  for insert with check (org_id = auth_org_id() and psicologo_id = auth.uid());
drop policy if exists "psicologo_edita_planos" on planos_terapeuticos;
create policy "psicologo_edita_planos" on planos_terapeuticos
  for update using (
    org_id = auth_org_id() and psicologo_id = auth.uid()
  ) with check (
    org_id = auth_org_id() and psicologo_id = auth.uid()
  );

create table if not exists objetivos_terapeuticos (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos_terapeuticos(id) on delete cascade,
  descricao text not null,
  indicador text,
  ordem int not null default 0,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido')),
  concluido_em date,
  created_at timestamptz not null default now()
);

create index if not exists objetivos_terapeuticos_plano_id_idx on objetivos_terapeuticos (plano_id, ordem);

alter table objetivos_terapeuticos enable row level security;

-- Sem org_id direto (a tabela é pequena e sempre acessada via plano_id) —
-- a policy junta com planos_terapeuticos, que já garante psicólogo dono.
-- Mesma retenção do plano: sem policy de delete (um objetivo indesejado se
-- marca "concluído", não desaparece do histórico do que foi planejado).
drop policy if exists "psicologo_gerencia_objetivos" on objetivos_terapeuticos;
drop policy if exists "psicologo_ve_objetivos" on objetivos_terapeuticos;
create policy "psicologo_ve_objetivos" on objetivos_terapeuticos
  for select using (
    exists (
      select 1 from planos_terapeuticos p
      where p.id = objetivos_terapeuticos.plano_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_cria_objetivos" on objetivos_terapeuticos;
create policy "psicologo_cria_objetivos" on objetivos_terapeuticos
  for insert with check (
    exists (
      select 1 from planos_terapeuticos p
      where p.id = objetivos_terapeuticos.plano_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_edita_objetivos" on objetivos_terapeuticos;
create policy "psicologo_edita_objetivos" on objetivos_terapeuticos
  for update using (
    exists (
      select 1 from planos_terapeuticos p
      where p.id = objetivos_terapeuticos.plano_id and p.psicologo_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from planos_terapeuticos p
      where p.id = objetivos_terapeuticos.plano_id and p.psicologo_id = auth.uid()
    )
  );

-- Tarefa de casa pode nascer vinculada a um objetivo específico do plano
-- (opcional — nem toda tarefa precisa de um objetivo formal por trás).
alter table tarefas_paciente add column if not exists objetivo_id uuid references objetivos_terapeuticos(id) on delete set null;

-- =========================================================
-- verificar_revisoes_pendentes — lembrete automático de revisão do plano
-- terapêutico (item 6 da Fase 4). Em vez de um novo job de cron (o único
-- que existe hoje, api/notificacoes/dispatch, é pra lembrete de consulta por
-- e-mail/webhook — revisão de plano não é isso, é só um aviso in-app pro
-- próprio psicólogo), essa função roda "de passagem" toda vez que o
-- psicólogo abre o painel (chamada pelo NotificationBell antes de listar os
-- avisos — ver notification-bell.tsx), o que já cobre o caso de uso real:
-- ele fica sabendo a próxima vez que entra no sistema, sem exigir configurar
-- um cron novo no Supabase. p_hoje vem do cliente (todayIso()) pelo mesmo
-- motivo de sempre no projeto: current_date do servidor é UTC e erra a data
-- perto da meia-noite em Brasília.
-- =========================================================
create or replace function verificar_revisoes_pendentes(p_hoje date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  for v in
    select pt.id, pt.revisar_em, pt.org_id, pac.nome as paciente_nome
    from planos_terapeuticos pt
    join pacientes pac on pac.id = pt.paciente_id
    where pt.psicologo_id = auth.uid()
      and pt.status = 'ativo'
      and pt.revisar_em is not null
      and pt.revisar_em <= p_hoje
      and (pt.revisao_avisada_em is null or pt.revisao_avisada_em <> pt.revisar_em)
  loop
    insert into avisos_psicologo (psicologo_id, mensagem, org_id)
    values (
      auth.uid(),
      'O plano terapêutico de ' || v.paciente_nome || ' está com revisão prevista para ' ||
        to_char(v.revisar_em, 'DD/MM/YYYY') || '.',
      v.org_id
    );

    update planos_terapeuticos set revisao_avisada_em = v.revisar_em where id = v.id;
  end loop;
end;
$$;

grant execute on function verificar_revisoes_pendentes(date) to authenticated;

-- =========================================================
-- instrumentos (Fase 4) — catálogo de escalas psicométricas. Tabela
-- GLOBAL (sem org_id): o instrumento em si (PHQ-9, GAD-7...) é o mesmo
-- pra qualquer clínica, só a aplicação (ver aplicacoes_instrumento) é por
-- paciente/org. Leitura pública de propósito — a página de resposta
-- (/escala/[token]) é anônima e precisa ler os itens sem estar logada.
--
-- "licenca": 'livre' = itens completos vêm daqui e a UI reproduz o
-- questionário. 'restrito_manual' = a licença do instrumento não permite
-- reproduzir os itens na plataforma — "itens"/"faixas" ficam vazios de
-- propósito, e o psicólogo só registra o escore final manualmente (ver
-- aplicacoes_instrumento.origem).
-- =========================================================
create table if not exists instrumentos (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text not null,
  itens jsonb not null default '[]',
  faixas jsonb not null default '[]',
  licenca text not null check (licenca in ('livre', 'restrito_manual')),
  fonte text
);

alter table instrumentos enable row level security;

drop policy if exists "qualquer_um_ve_instrumentos" on instrumentos;
create policy "qualquer_um_ve_instrumentos" on instrumentos
  for select using (true);
-- Sem policy de insert/update/delete pra "authenticated"/"anon": o catálogo
-- é mantido só por este arquivo (seed abaixo), nunca editado pelo app.

-- =========================================================
-- Seed — só os 4 instrumentos de uso livre (domínio público, sem exigir
-- licenciamento pra reproduzir os itens): PHQ-9 e GAD-7 (Spitzer/Kroenke/
-- Williams, Pfizer — uso livre pra profissionais de saúde), WHO-5 (OMS,
-- domínio público) e DASS-21 (Lovibond & Lovibond, uso livre não-comercial,
-- versão em português amplamente validada no Brasil). Instrumentos
-- proprietários (ex.: BDI-II, escalas da Pearson/WPS) NÃO entram aqui —
-- ver comentário na tabela "instrumentos" sobre o caminho licenca =
-- 'restrito_manual' pra esses casos.
--
-- PHQ-9: item 9 (ideação suicida) marcado com "alerta": true — a UI
-- destaca resposta > 0 nesse item pro psicólogo, é o item de risco clínico
-- do instrumento.
-- =========================================================
insert into instrumentos (sigla, nome, itens, faixas, licenca, fonte) values
(
  'PHQ-9',
  'Patient Health Questionnaire-9 (rastreio de depressão)',
  '{
    "instrucoes": "Nas últimas 2 semanas, com que frequência você foi incomodado(a) por qualquer um dos problemas a seguir?",
    "opcoes": [
      {"valor": 0, "label": "Nenhuma vez"},
      {"valor": 1, "label": "Vários dias"},
      {"valor": 2, "label": "Mais da metade dos dias"},
      {"valor": 3, "label": "Quase todos os dias"}
    ],
    "perguntas": [
      {"numero": 1, "texto": "Pouco interesse ou prazer em fazer as coisas"},
      {"numero": 2, "texto": "Se sentir para baixo, deprimido(a) ou sem perspectiva"},
      {"numero": 3, "texto": "Dificuldade para pegar no sono ou continuar dormindo, ou dormir demais"},
      {"numero": 4, "texto": "Se sentir cansado(a) ou com pouca energia"},
      {"numero": 5, "texto": "Falta de apetite ou comer demais"},
      {"numero": 6, "texto": "Se sentir mal consigo mesmo(a) — ou achar que é um fracasso ou que decepcionou sua família ou você mesmo(a)"},
      {"numero": 7, "texto": "Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão"},
      {"numero": 8, "texto": "Lentidão para se movimentar ou falar, a ponto de outras pessoas notarem — ou o oposto, ficar tão agitado(a) ou inquieto(a) que você andou de um lado para o outro muito mais do que o normal"},
      {"numero": 9, "texto": "Pensar em se ferir de alguma maneira ou que seria melhor estar morto(a)", "alerta": true}
    ]
  }'::jsonb,
  '[
    {"min": 0, "max": 4, "rotulo": "Mínima"},
    {"min": 5, "max": 9, "rotulo": "Leve"},
    {"min": 10, "max": 14, "rotulo": "Moderada"},
    {"min": 15, "max": 19, "rotulo": "Moderadamente grave"},
    {"min": 20, "max": 27, "rotulo": "Grave"}
  ]'::jsonb,
  'livre',
  'Kroenke, Spitzer & Williams (2001) — versão validada em português'
),
(
  'GAD-7',
  'Generalized Anxiety Disorder-7 (rastreio de ansiedade)',
  '{
    "instrucoes": "Nas últimas 2 semanas, com que frequência você foi incomodado(a) pelos problemas a seguir?",
    "opcoes": [
      {"valor": 0, "label": "Nenhuma vez"},
      {"valor": 1, "label": "Vários dias"},
      {"valor": 2, "label": "Mais da metade dos dias"},
      {"valor": 3, "label": "Quase todos os dias"}
    ],
    "perguntas": [
      {"numero": 1, "texto": "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)"},
      {"numero": 2, "texto": "Não ser capaz de impedir ou controlar as preocupações"},
      {"numero": 3, "texto": "Preocupar-se muito com diversas coisas"},
      {"numero": 4, "texto": "Dificuldade para relaxar"},
      {"numero": 5, "texto": "Ficar tão agitado(a) que se torna difícil permanecer sentado(a)"},
      {"numero": 6, "texto": "Ficar facilmente aborrecido(a) ou irritado(a)"},
      {"numero": 7, "texto": "Sentir medo, como se algo terrível fosse acontecer"}
    ]
  }'::jsonb,
  '[
    {"min": 0, "max": 4, "rotulo": "Mínima"},
    {"min": 5, "max": 9, "rotulo": "Leve"},
    {"min": 10, "max": 14, "rotulo": "Moderada"},
    {"min": 15, "max": 21, "rotulo": "Grave"}
  ]'::jsonb,
  'livre',
  'Spitzer, Kroenke, Williams & Löwe (2006) — versão validada em português'
),
(
  'WHO-5',
  'WHO-5 Well-Being Index (índice de bem-estar)',
  '{
    "instrucoes": "Nas últimas duas semanas...",
    "opcoes": [
      {"valor": 0, "label": "Em nenhum momento"},
      {"valor": 1, "label": "Em alguns momentos"},
      {"valor": 2, "label": "Menos da metade do tempo"},
      {"valor": 3, "label": "Mais da metade do tempo"},
      {"valor": 4, "label": "Na maior parte do tempo"},
      {"valor": 5, "label": "O tempo todo"}
    ],
    "perguntas": [
      {"numero": 1, "texto": "Eu me senti alegre e de bom humor"},
      {"numero": 2, "texto": "Eu me senti calmo(a) e relaxado(a)"},
      {"numero": 3, "texto": "Eu me senti ativo(a) e cheio(a) de energia"},
      {"numero": 4, "texto": "Eu acordei me sentindo descansado(a)"},
      {"numero": 5, "texto": "Meu dia a dia tem sido cheio de coisas que me interessam"}
    ]
  }'::jsonb,
  '[
    {"min": 0, "max": 28, "rotulo": "Bem-estar baixo — avaliação de depressão recomendada"},
    {"min": 29, "max": 50, "rotulo": "Bem-estar abaixo do esperado"},
    {"min": 51, "max": 100, "rotulo": "Bem-estar adequado"}
  ]'::jsonb,
  'livre',
  'OMS (1998), versão validada em português — escore final = soma bruta (0-25) × 4, faixa 0-100'
),
(
  'DASS-21',
  'Depression Anxiety Stress Scales-21 (depressão, ansiedade e estresse)',
  '{
    "instrucoes": "Leia cada frase e escolha o quanto ela se aplicou a você durante a última semana.",
    "opcoes": [
      {"valor": 0, "label": "Não se aplicou de forma alguma"},
      {"valor": 1, "label": "Aplicou-se um pouco, ou por pouco tempo"},
      {"valor": 2, "label": "Aplicou-se consideravelmente, ou por um bom período de tempo"},
      {"valor": 3, "label": "Aplicou-se muito, ou na maior parte do tempo"}
    ],
    "perguntas": [
      {"numero": 1, "texto": "Achei difícil me acalmar", "subescala": "estresse"},
      {"numero": 2, "texto": "Senti minha boca ficar seca", "subescala": "ansiedade"},
      {"numero": 3, "texto": "Não consegui vivenciar nenhum sentimento positivo", "subescala": "depressao"},
      {"numero": 4, "texto": "Tive dificuldade para respirar (ex.: respiração ofegante, falta de ar sem esforço físico)", "subescala": "ansiedade"},
      {"numero": 5, "texto": "Achei difícil ter iniciativa para fazer as coisas", "subescala": "depressao"},
      {"numero": 6, "texto": "Tive a tendência de reagir de forma exagerada às situações", "subescala": "estresse"},
      {"numero": 7, "texto": "Senti tremores (ex.: nas mãos)", "subescala": "ansiedade"},
      {"numero": 8, "texto": "Senti que estava gastando muita energia nervosa", "subescala": "estresse"},
      {"numero": 9, "texto": "Preocupei-me com situações em que eu pudesse entrar em pânico e parecer ridículo(a)", "subescala": "ansiedade"},
      {"numero": 10, "texto": "Senti que não tinha nada a esperar do futuro", "subescala": "depressao"},
      {"numero": 11, "texto": "Percebi que estava ficando agitado(a)", "subescala": "estresse"},
      {"numero": 12, "texto": "Achei difícil relaxar", "subescala": "estresse"},
      {"numero": 13, "texto": "Senti-me deprimido(a) e triste", "subescala": "depressao"},
      {"numero": 14, "texto": "Fiquei intolerante com as coisas que me impediam de continuar o que eu estava fazendo", "subescala": "estresse"},
      {"numero": 15, "texto": "Senti que estava prestes a entrar em pânico", "subescala": "ansiedade"},
      {"numero": 16, "texto": "Não consegui me entusiasmar com nada", "subescala": "depressao"},
      {"numero": 17, "texto": "Senti que não tinha muito valor como pessoa", "subescala": "depressao"},
      {"numero": 18, "texto": "Senti que estava muito irritado(a)", "subescala": "estresse"},
      {"numero": 19, "texto": "Percebi as batidas do meu coração mesmo sem ter feito esforço físico (ex.: taquicardia)", "subescala": "ansiedade"},
      {"numero": 20, "texto": "Tive medo sem motivo", "subescala": "ansiedade"},
      {"numero": 21, "texto": "Senti que a vida não tinha sentido", "subescala": "depressao"}
    ]
  }'::jsonb,
  '{
    "depressao": [
      {"min": 0, "max": 9, "rotulo": "Normal"},
      {"min": 10, "max": 13, "rotulo": "Leve"},
      {"min": 14, "max": 20, "rotulo": "Moderada"},
      {"min": 21, "max": 27, "rotulo": "Severa"},
      {"min": 28, "max": 42, "rotulo": "Extremamente severa"}
    ],
    "ansiedade": [
      {"min": 0, "max": 7, "rotulo": "Normal"},
      {"min": 8, "max": 9, "rotulo": "Leve"},
      {"min": 10, "max": 14, "rotulo": "Moderada"},
      {"min": 15, "max": 19, "rotulo": "Severa"},
      {"min": 20, "max": 42, "rotulo": "Extremamente severa"}
    ],
    "estresse": [
      {"min": 0, "max": 14, "rotulo": "Normal"},
      {"min": 15, "max": 18, "rotulo": "Leve"},
      {"min": 19, "max": 25, "rotulo": "Moderada"},
      {"min": 26, "max": 33, "rotulo": "Severa"},
      {"min": 34, "max": 42, "rotulo": "Extremamente severa"}
    ]
  }'::jsonb,
  'livre',
  'Lovibond & Lovibond (1995), versão em português — escore de cada subescala = soma dos 7 itens × 2 (compatível com as normas do DASS-42)'
)
on conflict (sigla) do update set
  nome = excluded.nome,
  itens = excluded.itens,
  faixas = excluded.faixas,
  licenca = excluded.licenca,
  fonte = excluded.fonte;

-- =========================================================
-- aplicacoes_instrumento — um envio de escala pra um paciente responder.
-- token_publico + expira_em seguem o mesmo padrão de convites_paciente:
-- token aleatório (não o id, pra não dar pra enumerar aplicação de
-- paciente), de uso único (respondido_em preenchido trava reenvio).
-- =========================================================
create table if not exists aplicacoes_instrumento (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  instrumento_id uuid not null references instrumentos(id),
  token_publico text unique,
  expira_em timestamptz,
  respostas jsonb,
  escore numeric,
  faixa text,
  -- Resultado por subescala (ex.: DASS-21 tem depressão/ansiedade/estresse
  -- separados) — "escore"/"faixa" acima viram o resumo (soma/pior faixa)
  -- pro gráfico de evolução; o detalhe fiel mora aqui.
  resultado_detalhado jsonb,
  -- 'formulario' = paciente respondeu pelo link; 'manual' = psicólogo
  -- digitou o escore de um instrumento restrito (sem itens reproduzidos).
  origem text not null default 'formulario' check (origem in ('formulario', 'manual')),
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz
);

create index if not exists aplicacoes_instrumento_paciente_id_idx
  on aplicacoes_instrumento (paciente_id, enviado_em desc);

alter table aplicacoes_instrumento enable row level security;

-- select/insert/update sem restrição de conteúdo (enviar escala, cancelar
-- envio antes de responder etc.); delete é a parte que muda por retenção —
-- ver policy separada abaixo.
drop policy if exists "psicologo_gerencia_aplicacoes" on aplicacoes_instrumento;
drop policy if exists "psicologo_ve_aplicacoes" on aplicacoes_instrumento;
create policy "psicologo_ve_aplicacoes" on aplicacoes_instrumento
  for select using (org_id = auth_org_id() and psicologo_id = auth.uid());
drop policy if exists "psicologo_cria_aplicacoes" on aplicacoes_instrumento;
create policy "psicologo_cria_aplicacoes" on aplicacoes_instrumento
  for insert with check (org_id = auth_org_id() and psicologo_id = auth.uid());
drop policy if exists "psicologo_edita_aplicacoes" on aplicacoes_instrumento;
create policy "psicologo_edita_aplicacoes" on aplicacoes_instrumento
  for update using (
    org_id = auth_org_id() and psicologo_id = auth.uid()
  ) with check (
    org_id = auth_org_id() and psicologo_id = auth.uid()
  );
-- Retenção: uma aplicação já respondida carrega escore/resultado, é dado
-- clínico do paciente — não pode ser apagada (só o envio pendente, sem
-- resposta nenhuma, pode ser cancelado/removido por engano de destinatário).
drop policy if exists "psicologo_apaga_aplicacoes_pendentes" on aplicacoes_instrumento;
create policy "psicologo_apaga_aplicacoes_pendentes" on aplicacoes_instrumento
  for delete using (
    org_id = auth_org_id() and psicologo_id = auth.uid() and respondido_em is null
  );
-- Sem policy nenhuma pra "anon"/paciente: a página pública de resposta
-- passa só pelas funções abaixo (mesmo motivo de convite_info/
-- aceitar_convite_paciente — o token não pode virar uma forma de ler a
-- linha inteira, inclusive o paciente_id de outra pessoa).

-- Dados mínimos pra montar a tela pública de resposta: instrumento
-- completo (se livre) + se o token ainda é válido. Nunca devolve
-- paciente_id/psicologo_id.
create or replace function escala_info(p_token text)
returns table (
  instrumento_sigla text,
  instrumento_nome text,
  instrumento_itens jsonb,
  instrumento_faixas jsonb,
  instrumento_licenca text,
  expirado boolean,
  ja_respondido boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.sigla,
    i.nome,
    i.itens,
    i.faixas,
    i.licenca,
    (a.expira_em is not null and a.expira_em < now()),
    (a.respondido_em is not null)
  from aplicacoes_instrumento a
  join instrumentos i on i.id = a.instrumento_id
  where a.token_publico = p_token;
$$;

grant execute on function escala_info(text) to anon, authenticated;

-- Grava a resposta. O escore/faixa vêm calculados do cliente (a fórmula de
-- cada instrumento é pública e documentada — PHQ-9/GAD-7/WHO-5/DASS-21 não
-- têm nada a esconder no cálculo, diferente de um gabarito proprietário),
-- mas token de uso único + trava de expirado/já respondido aqui garantem
-- que não dá pra responder duas vezes nem depois do prazo.
create or replace function responder_escala(
  p_token text,
  p_respostas jsonb,
  p_escore numeric,
  p_faixa text,
  p_resultado_detalhado jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v aplicacoes_instrumento%rowtype;
begin
  select * into v from aplicacoes_instrumento where token_publico = p_token;

  if not found then
    raise exception 'Link inválido.';
  end if;
  if v.respondido_em is not null then
    raise exception 'Esta escala já foi respondida.';
  end if;
  if v.expira_em is not null and v.expira_em < now() then
    raise exception 'Este link expirou.';
  end if;

  update aplicacoes_instrumento
  set respostas = p_respostas,
      escore = p_escore,
      faixa = p_faixa,
      resultado_detalhado = p_resultado_detalhado,
      respondido_em = now()
  where token_publico = p_token;
end;
$$;

grant execute on function responder_escala(text, jsonb, numeric, text, jsonb) to anon, authenticated;

-- =========================================================
-- Anexa os triggers de preenchimento automático de org_id (funções
-- definidas logo depois de auth_org_id()/auth_role(), no topo do arquivo) —
-- juntos aqui no fim porque é o primeiro ponto em que todas as tabelas
-- referenciadas já existem.
-- =========================================================
create or replace trigger disponibilidades_set_org_id
  before insert on disponibilidades
  for each row execute function set_org_id_from_caller();
create or replace trigger recorrencias_set_org_id
  before insert on recorrencias
  for each row execute function set_org_id_from_caller();
create or replace trigger pacientes_set_org_id
  before insert on pacientes
  for each row execute function set_org_id_from_caller();
create or replace trigger consultas_set_org_id
  before insert on consultas
  for each row execute function set_org_id_from_caller();
create or replace trigger lancamentos_financeiros_set_org_id
  before insert on lancamentos_financeiros
  for each row execute function set_org_id_from_caller();
create or replace trigger checkins_humor_set_org_id
  before insert on checkins_humor
  for each row execute function set_org_id_from_caller();
create or replace trigger registros_habito_set_org_id
  before insert on registros_habito
  for each row execute function set_org_id_from_caller();
create or replace trigger diario_paciente_set_org_id
  before insert on diario_paciente
  for each row execute function set_org_id_from_caller();
create or replace trigger avisos_psicologo_set_org_id
  before insert on avisos_psicologo
  for each row execute function set_org_id_from_caller();
create or replace trigger convites_paciente_set_org_id
  before insert on convites_paciente
  for each row execute function set_org_id_from_caller();

create or replace trigger sessoes_prontuario_set_org_id
  before insert on sessoes_prontuario
  for each row execute function set_org_id_from_paciente();
create or replace trigger adendos_evolucao_set_org_id
  before insert on adendos_evolucao
  for each row execute function set_org_id_from_caller();
create or replace trigger materiais_paciente_set_org_id
  before insert on materiais_paciente
  for each row execute function set_org_id_from_paciente();
create or replace trigger habitos_paciente_set_org_id
  before insert on habitos_paciente
  for each row execute function set_org_id_from_paciente();

create or replace trigger notificacoes_set_org_id
  before insert on notificacoes
  for each row execute function set_org_id_from_consulta();
create or replace trigger pacotes_sessao_set_org_id
  before insert on pacotes_sessao
  for each row execute function set_org_id_from_caller();
create or replace trigger tarefas_paciente_set_org_id
  before insert on tarefas_paciente
  for each row execute function set_org_id_from_caller();
create or replace trigger planos_terapeuticos_set_org_id
  before insert on planos_terapeuticos
  for each row execute function set_org_id_from_caller();
create or replace trigger aplicacoes_instrumento_set_org_id
  before insert on aplicacoes_instrumento
  for each row execute function set_org_id_from_caller();

-- =========================================================
-- audit_log — trilha de acesso a dado clínico (Res. CFP / LGPD). Criada na
-- Fase 0 só como infraestrutura; passa a ser chamada de verdade na Fase 1
-- Entrega C (assinatura de evolução e exportação de prontuário em PDF, ver
-- registrar_auditoria() abaixo e as chamadas em src/lib/patients-client.ts).
-- =========================================================
create table if not exists audit_log (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  actor_id uuid not null references auth.users(id) on delete cascade,
  acao text not null,          -- 'leu_evolucao', 'assinou_evolucao', 'exportou_prontuario' etc.
  entidade text not null,
  entidade_id uuid,
  paciente_id uuid,
  -- só preenchidos quando a chamada vem de um route handler com request de
  -- verdade (ex.: api/gemini); chamadas via RPC direto do client ficam null.
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx on audit_log (org_id, created_at desc);
create index if not exists audit_log_paciente_idx on audit_log (paciente_id);

alter table audit_log enable row level security;

-- Só psicólogo/admin_clinica da própria org leem a trilha. Secretaria não —
-- é o mesmo sigilo do dado que a trilha registra. Sem policy de insert pra
-- "authenticated": a escrita é só via registrar_auditoria() abaixo (mesmo
-- padrão de avisos_psicologo).
drop policy if exists "psicologo_admin_ve_auditoria_da_org" on audit_log;
create policy "psicologo_admin_ve_auditoria_da_org" on audit_log
  for select using (
    org_id = auth_org_id() and auth_role() in ('psicologo', 'admin_clinica')
  );

-- p_ip/p_user_agent (Fase 5): ficam null nas chamadas via RPC direto do
-- client (ex.: "leu_evolucao" em patient-evolucao-tab.tsx), preenchidos só
-- quando quem chama é um route handler com request de verdade — é o caso do
-- módulo de IA (ver src/lib/ia/guards.ts), que loga 'uso_ia' com IP/user
-- agent de onde a chamada ao modelo partiu, igual ao padrão já usado em
-- aceitar_consentimento/api/consentimentos/aceitar.
-- drop explícito: acrescentar parâmetros via "create or replace" cria um
-- SEGUNDO overload em vez de substituir o de 4 argumentos (Postgres
-- identifica a função pela lista de tipos, não pelos defaults) — sem este
-- drop, uma chamada com os 4 argumentos nomeados originais ficaria ambígua
-- entre os dois overloads.
drop function if exists registrar_auditoria(text, text, uuid, uuid);
create or replace function registrar_auditoria(
  p_acao text,
  p_entidade text,
  p_entidade_id uuid default null,
  p_paciente_id uuid default null,
  p_ip inet default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (org_id, actor_id, acao, entidade, entidade_id, paciente_id, ip, user_agent)
  values (auth_org_id(), auth.uid(), p_acao, p_entidade, p_entidade_id, p_paciente_id, p_ip, p_user_agent);
end;
$$;

grant execute on function registrar_auditoria(text, text, uuid, uuid, inet, text) to authenticated;

-- =========================================================
-- recibos (Fase 2) — numeração sequencial POR ORGANIZAÇÃO (não global),
-- texto adequado pra dedução no Imposto de Renda. Escrita só via
-- emitir_recibo() abaixo: calcular "próximo número" e inserir precisam
-- acontecer juntos, e a unique(org_id, numero) é quem garante que uma
-- corrida entre duas emissões simultâneas nunca produz número repetido —
-- a segunda simplesmente falha e tenta de novo (uso real de consultório
-- pequeno, corrida é rara o bastante pra não precisar de retry automático
-- no servidor).
-- =========================================================
create table if not exists recibos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  numero int not null,
  competencia_inicio date not null,
  competencia_fim date not null,
  valor_total numeric(10, 2) not null,
  quantidade_sessoes int not null,
  -- pode ser o responsável legal (paciente menor de idade), não o paciente.
  pagador_nome text not null,
  pagador_cpf text not null,
  emitido_em timestamptz not null default now(),
  unique (org_id, numero)
);

create index if not exists recibos_paciente_id_idx on recibos (paciente_id);

alter table recibos enable row level security;

drop policy if exists "acesso_recibos_select" on recibos;
create policy "acesso_recibos_select" on recibos
  for select using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
-- Fase 3: paciente vê os próprios recibos no portal. Policy separada (não
-- combinada na de cima) de propósito: aqui o OR é correto, porque as duas
-- condições já são exatamente o conjunto de acesso pretendido (psicólogo
-- dono OU paciente dono) — diferente do bug de "org isola" do doc de
-- especificação, essas duas nunca se sobrepõem de um jeito que libera mais
-- do que deveria.
drop policy if exists "cliente_ve_proprios_recibos" on recibos;
create policy "cliente_ve_proprios_recibos" on recibos
  for select using (eh_meu_paciente(recibos.paciente_id::text));
-- Sem policy de insert/update/delete pra "authenticated": só a função
-- abaixo escreve (numeração sequencial não pode passar por um insert cru
-- que um cliente poderia repetir/pular). Sem policy de update/delete
-- nenhuma — recibo emitido é documento fiscal, não se edita.

create or replace function emitir_recibo(
  p_paciente_id uuid,
  p_competencia_inicio date,
  p_competencia_fim date,
  p_valor_total numeric,
  p_quantidade_sessoes int,
  p_pagador_nome text,
  p_pagador_cpf text
)
returns recibos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_proximo_numero int;
  v_recibo recibos;
begin
  if not exists (
    select 1 from pacientes where id = p_paciente_id and psicologo_id = auth.uid()
  ) then
    raise exception 'Paciente não encontrado';
  end if;

  v_org_id := auth_org_id();

  select coalesce(max(numero), 0) + 1 into v_proximo_numero
  from recibos where org_id = v_org_id;

  insert into recibos (
    org_id, psicologo_id, paciente_id, numero, competencia_inicio, competencia_fim,
    valor_total, quantidade_sessoes, pagador_nome, pagador_cpf
  ) values (
    v_org_id, auth.uid(), p_paciente_id, v_proximo_numero, p_competencia_inicio, p_competencia_fim,
    p_valor_total, p_quantidade_sessoes, p_pagador_nome, p_pagador_cpf
  )
  returning * into v_recibo;

  perform registrar_auditoria('emitiu_recibo', 'recibos', v_recibo.id, p_paciente_id);

  return v_recibo;
end;
$$;

grant execute on function emitir_recibo(uuid, date, date, numeric, int, text, text) to authenticated;

-- =========================================================
-- documentos_psicologicos — modelos de documento com a estrutura da Res.
-- CFP 06/2019 (Manual de Elaboração de Documentos Escritos produzidos pelo
-- psicólogo). Só os 2 tipos mais simples/frequentes por ora: 'declaracao'
-- (atesta um fato, ex.: comparecimento/vínculo terapêutico) e 'atestado'
-- (atesta necessidade de afastamento) — Relatório/Laudo/Parecer ficam pra
-- uma fase futura, são bem mais longos e dependem de estrutura própria
-- (histórico de avaliação, instrumentos utilizados, resultado, conclusão).
-- Mesmo padrão de "recibos": numeração sequencial por org via RPC
-- (nunca insert cru), documento emitido é definitivo — sem policy de
-- update/delete, correção é emitir um novo documento, não editar o antigo.
-- =========================================================
create table if not exists documentos_psicologicos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  numero int not null,
  tipo text not null check (tipo in ('declaracao', 'atestado')),
  finalidade text not null,
  conteudo text not null,
  dias_afastamento int,
  data_inicio_afastamento date,
  emitido_em timestamptz not null default now(),
  unique (org_id, numero)
);

create index if not exists documentos_psicologicos_paciente_id_idx on documentos_psicologicos (paciente_id);

alter table documentos_psicologicos enable row level security;

drop policy if exists "acesso_documentos_select" on documentos_psicologicos;
create policy "acesso_documentos_select" on documentos_psicologicos
  for select using (
    org_id = auth_org_id()
    and (
      auth_role() in ('secretaria', 'admin_clinica')
      or (auth_role() = 'psicologo' and psicologo_id = auth.uid())
    )
  );
-- Paciente vê os próprios documentos no portal — mesmo raciocínio de
-- "cliente_ve_proprios_recibos" (OR correto aqui: as duas condições já são
-- exatamente o conjunto de acesso pretendido).
drop policy if exists "cliente_ve_proprios_documentos" on documentos_psicologicos;
create policy "cliente_ve_proprios_documentos" on documentos_psicologicos
  for select using (eh_meu_paciente(documentos_psicologicos.paciente_id::text));
-- Sem policy de insert/update/delete pra "authenticated": só emitir_documento
-- abaixo escreve.

create or replace function emitir_documento(
  p_paciente_id uuid,
  p_tipo text,
  p_finalidade text,
  p_conteudo text,
  p_dias_afastamento int default null,
  p_data_inicio_afastamento date default null
)
returns documentos_psicologicos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_proximo_numero int;
  v_doc documentos_psicologicos;
begin
  if p_tipo not in ('declaracao', 'atestado') then
    raise exception 'Tipo de documento inválido.';
  end if;

  if not exists (
    select 1 from pacientes where id = p_paciente_id and psicologo_id = auth.uid()
  ) then
    raise exception 'Paciente não encontrado';
  end if;

  v_org_id := auth_org_id();

  select coalesce(max(numero), 0) + 1 into v_proximo_numero
  from documentos_psicologicos where org_id = v_org_id;

  insert into documentos_psicologicos (
    org_id, psicologo_id, paciente_id, numero, tipo, finalidade, conteudo,
    dias_afastamento, data_inicio_afastamento
  ) values (
    v_org_id, auth.uid(), p_paciente_id, v_proximo_numero, p_tipo, p_finalidade, p_conteudo,
    p_dias_afastamento, p_data_inicio_afastamento
  )
  returning * into v_doc;

  perform registrar_auditoria('emitiu_documento', 'documentos_psicologicos', v_doc.id, p_paciente_id);

  return v_doc;
end;
$$;

grant execute on function emitir_documento(uuid, text, text, text, int, date) to authenticated;
