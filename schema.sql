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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psicologo_id, cpf)
);

-- alter table (não só create) para que bancos já provisionados antes desta
-- mudança deixem de exigir cpf/telefone ao reexecutar este arquivo.
alter table pacientes alter column cpf drop not null;
alter table pacientes alter column telefone drop not null;

create index if not exists pacientes_psicologo_id_idx on pacientes (psicologo_id);
create index if not exists pacientes_nome_idx on pacientes using gin (nome gin_trgm_ops);

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
  created_at timestamptz not null default now()
);

create index if not exists sessoes_prontuario_paciente_id_idx
  on sessoes_prontuario (paciente_id, data_hora desc);

-- =========================================================
-- consultas (agenda + agendamentos públicos)
-- =========================================================
create table if not exists consultas (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid references pacientes(id) on delete set null,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- alter table (não só create) para que bancos já provisionados antes desta
-- mudança recebam as novas colunas ao reexecutar este arquivo no SQL Editor.
alter table consultas add column if not exists email text;
alter table consultas add column if not exists cliente_id uuid references auth.users(id) on delete set null;

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
-- lancamentos_financeiros — único lugar de onde o Financeiro lê dados.
-- Toda entrada é criada manualmente pelo psicólogo (botão "Novo
-- Lançamento"); agendar/editar uma consulta nunca grava nada aqui.
-- =========================================================
create table if not exists lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  -- snapshot do nome (mesmo padrão de consultas.paciente_nome): evita joins
  -- e preserva o registro histórico legível caso o paciente seja renomeado.
  paciente_nome text not null,
  valor numeric(10, 2) not null,
  status_pagamento text not null default 'pendente'
    check (status_pagamento in ('pago', 'pendente')),
  data date not null default current_date,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
-- Row Level Security
-- =========================================================
alter table perfis enable row level security;
alter table disponibilidades enable row level security;
alter table pacientes enable row level security;
alter table sessoes_prontuario enable row level security;
alter table consultas enable row level security;
alter table lancamentos_financeiros enable row level security;
alter table notificacoes enable row level security;
-- app_secrets fica com RLS ligada e SEM NENHUMA POLICY de propósito: assim
-- nem a anon key (que vai pro bundle JS) nem um usuário logado conseguem ler
-- o segredo do cron. Só postgres (o próprio pg_cron) e a service_role key.
alter table app_secrets enable row level security;

drop policy if exists "psicologo_ve_proprio_perfil" on perfis;
create policy "psicologo_ve_proprio_perfil" on perfis
  for select using (auth.uid() = id);
drop policy if exists "psicologo_cria_proprio_perfil" on perfis;
create policy "psicologo_cria_proprio_perfil" on perfis
  for insert with check (auth.uid() = id);
drop policy if exists "psicologo_edita_proprio_perfil" on perfis;
create policy "psicologo_edita_proprio_perfil" on perfis
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "psicologo_ve_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_ve_proprias_disponibilidades" on disponibilidades
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_cria_proprias_disponibilidades" on disponibilidades
  for insert with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_edita_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_edita_proprias_disponibilidades" on disponibilidades
  for update using (auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_apaga_proprias_disponibilidades" on disponibilidades;
create policy "psicologo_apaga_proprias_disponibilidades" on disponibilidades
  for delete using (auth.uid() = psicologo_id);

drop policy if exists "psicologo_ve_proprios_pacientes" on pacientes;
create policy "psicologo_ve_proprios_pacientes" on pacientes
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprios_pacientes" on pacientes;
create policy "psicologo_cria_proprios_pacientes" on pacientes
  for insert with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_edita_proprios_pacientes" on pacientes;
create policy "psicologo_edita_proprios_pacientes" on pacientes
  for update using (auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_apaga_proprios_pacientes" on pacientes;
create policy "psicologo_apaga_proprios_pacientes" on pacientes
  for delete using (auth.uid() = psicologo_id);

drop policy if exists "psicologo_ve_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_ve_proprias_sessoes" on sessoes_prontuario
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_cria_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_cria_proprias_sessoes" on sessoes_prontuario
  for insert with check (
    exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );

drop policy if exists "psicologo_ve_proprias_consultas" on consultas;
create policy "psicologo_ve_proprias_consultas" on consultas
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprias_consultas" on consultas;
create policy "psicologo_cria_proprias_consultas" on consultas
  for insert with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_edita_proprias_consultas" on consultas;
create policy "psicologo_edita_proprias_consultas" on consultas
  for update using (auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_apaga_proprias_consultas" on consultas;
create policy "psicologo_apaga_proprias_consultas" on consultas
  for delete using (auth.uid() = psicologo_id);
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

drop policy if exists "psicologo_ve_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_ve_proprios_lancamentos" on lancamentos_financeiros
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_cria_proprios_lancamentos" on lancamentos_financeiros
  for insert with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_edita_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_edita_proprios_lancamentos" on lancamentos_financeiros
  for update using (auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
drop policy if exists "psicologo_apaga_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_apaga_proprios_lancamentos" on lancamentos_financeiros
  for delete using (auth.uid() = psicologo_id);

-- Psicólogo enxerga (só leitura) os lembretes das próprias consultas, para
-- poder conferir o que foi enviado. Escrita é exclusiva do despachante, que
-- usa a service_role key e portanto ignora RLS.
drop policy if exists "psicologo_ve_proprias_notificacoes" on notificacoes;
create policy "psicologo_ve_proprias_notificacoes" on notificacoes
  for select using (
    exists (
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
begin
  if not exists (select 1 from perfis where id = p_psicologo_id) then
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
    psicologo_id, cliente_id, paciente_nome, data, horario, status, tipo, origem,
    modalidade, idade, sexo, profissao, telefone, email, endereco, estado_civil,
    escolaridade, motivo
  ) values (
    -- auth.uid() reflete o JWT de quem chamou o RPC, mesmo sendo security
    -- definer — null se o visitante agendou deslogado (fluxo continua
    -- funcionando igual, só não aparece em "Meus Agendamentos" de ninguém).
    p_psicologo_id, auth.uid(), p_paciente_nome, p_data, p_horario, 'pendente', 'consulta', 'publico',
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
-- profiles — identidade genérica de QUALQUER usuário (cliente ou
-- psicólogo). Separada de "perfis", que continua sendo só o perfil de
-- negócio do psicólogo (bio, CRP, valor, disponibilidade etc.) — um
-- cliente nunca ganha linha em "perfis".
-- =========================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  -- nullable de propósito: deixa espaço para um futuro seletor de papel
  -- pós-OAuth sem precisar de nova migração (ver comentário no trigger).
  role text check (role in ('client', 'psychologist') or role is null),
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

alter table profiles enable row level security;

drop policy if exists "usuario_ve_proprio_profile" on profiles;
create policy "usuario_ve_proprio_profile" on profiles
  for select using (auth.uid() = id);
drop policy if exists "usuario_edita_proprio_profile" on profiles;
create policy "usuario_edita_proprio_profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- A policy de update acima permite ao próprio usuário editar seu profile,
-- mas "role" decide se ele acessa /dashboard ou /agendamentos — sem este
-- trigger, um cliente autenticado poderia chamar
-- supabase.from('profiles').update({ role: 'psychologist' }) direto pelo
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

  if v_role = 'psychologist' then
    insert into perfis (id, nome, crp, uf, whatsapp)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      coalesce(new.raw_user_meta_data ->> 'crp', ''),
      coalesce(new.raw_user_meta_data ->> 'uf', ''),
      new.raw_user_meta_data ->> 'telefone'
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
