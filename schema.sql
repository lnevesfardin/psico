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
  agendado_para timestamptz not null, -- início da consulta menos 1h
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  -- Garantia de idempotência: mesmo se o cron rodar duas vezes em paralelo,
  -- o mesmo lembrete nunca é enfileirado (nem enviado) duas vezes.
  unique (consulta_id, tipo, destinatario, canal)
);

alter table notificacoes add column if not exists org_id uuid references organizations(id);

create index if not exists notificacoes_pendentes_idx
  on notificacoes (agendado_para)
  where status = 'pendente';

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
-- View pública (usada pela página /agendar/[psicologoId])
-- Expõe só as colunas seguras de "perfis" — nunca o whatsapp, já que RLS é
-- por linha, não por coluna, e essa view roda com o privilégio de quem a
-- criou (contorna a RLS de "perfis" de propósito, só para estas colunas).
-- =========================================================
-- drop explícito antes do create: "create or replace view" não pode
-- renomear/reordenar colunas de uma view já existente (ex.: bancos
-- provisionados antes da coluna "uf" existir tinham view sem essa coluna
-- no meio, e o replace falha com "cannot change name of view column").
-- Sem outras views/objetos dependendo desta no schema, então o CASCADE só
-- derruba os GRANTs abaixo, que são recriados na sequência.
drop view if exists perfis_publico cascade;

create or replace view perfis_publico as
select
  id,
  nome,
  titulo,
  crp,
  uf,
  cidade,
  foto_url,
  bio,
  valor_consulta,
  especialidades,
  abordagens,
  faixas_etarias,
  tem_consultorio,
  consultorio_rua,
  consultorio_numero,
  consultorio_bairro,
  consultorio_cidade,
  consultorio_uf,
  consultorio_maps_url
from perfis;

grant select on perfis_publico to anon, authenticated;

-- View pública de "disponibilidades" — a página /agendar/[psicologoId]
-- precisa saber os blocos de horário do psicólogo pra montar os dias e
-- horários disponíveis, sem exigir login. Mesmas colunas da tabela: nada
-- sensível aqui (só dia/horário/modalidade).
drop view if exists disponibilidades_publico cascade;

create or replace view disponibilidades_publico as
select id, psicologo_id, dia_semana, horario_inicio, horario_fim, modalidade
from disponibilidades;

grant select on disponibilidades_publico to anon, authenticated;

-- View pública de "consultas" — a página /agendar/[psicologoId] precisa
-- saber quais horários já estão ocupados para um psicólogo, mas a RLS de
-- "consultas" só permite o dono ler suas próprias linhas (auth.uid() =
-- psicologo_id), o que bloquearia completamente um visitante anônimo. Esta
-- view expõe só o essencial pra checar disponibilidade — nunca nome,
-- telefone ou qualquer outro dado do paciente.
-- mesmo motivo do drop de perfis_publico acima; sem dependentes no schema.
drop view if exists consultas_publico cascade;

create or replace view consultas_publico as
select psicologo_id, data, horario, status
from consultas;

grant select on consultas_publico to anon, authenticated;

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

create or replace function registrar_auditoria(
  p_acao text,
  p_entidade text,
  p_entidade_id uuid default null,
  p_paciente_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (org_id, actor_id, acao, entidade, entidade_id, paciente_id)
  values (auth_org_id(), auth.uid(), p_acao, p_entidade, p_entidade_id, p_paciente_id);
end;
$$;

grant execute on function registrar_auditoria(text, text, uuid, uuid) to authenticated;

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
