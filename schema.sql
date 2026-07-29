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
  foto_url text,
  bio text,
  valor_consulta numeric(10, 2) not null default 0,
  whatsapp text,
  -- disponibilidade para agendamento online
  dias_disponiveis int[] not null default '{1,2,3,4,5,6}', -- 0=domingo ... 6=sábado
  horario_inicio time not null default '09:00',
  horario_fim time not null default '20:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger perfis_set_updated_at
  before update on perfis
  for each row execute function set_updated_at();

-- =========================================================
-- pacientes
-- =========================================================
create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  cpf text not null,
  telefone text not null,
  email text,
  data_nascimento date,
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psicologo_id, cpf)
);

create index if not exists pacientes_psicologo_id_idx on pacientes (psicologo_id);
create index if not exists pacientes_nome_idx on pacientes using gin (nome gin_trgm_ops);

create trigger pacientes_set_updated_at
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
  endereco text,
  estado_civil text,
  escolaridade text,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultas_psicologo_data_idx
  on consultas (psicologo_id, data, horario);

-- Impede double-booking mesmo sob concorrência (dois agendamentos públicos
-- simultâneos para o mesmo horário): o segundo insert falha na constraint.
create unique index if not exists consultas_slot_unique
  on consultas (psicologo_id, data, horario)
  where status in ('pendente', 'confirmada');

create trigger consultas_set_updated_at
  before update on consultas
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security
-- =========================================================
alter table perfis enable row level security;
alter table pacientes enable row level security;
alter table sessoes_prontuario enable row level security;
alter table consultas enable row level security;

create policy "psicologo_ve_proprio_perfil" on perfis
  for select using (auth.uid() = id);
create policy "psicologo_cria_proprio_perfil" on perfis
  for insert with check (auth.uid() = id);
create policy "psicologo_edita_proprio_perfil" on perfis
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "psicologo_ve_proprios_pacientes" on pacientes
  for select using (auth.uid() = psicologo_id);
create policy "psicologo_cria_proprios_pacientes" on pacientes
  for insert with check (auth.uid() = psicologo_id);
create policy "psicologo_edita_proprios_pacientes" on pacientes
  for update using (auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
create policy "psicologo_apaga_proprios_pacientes" on pacientes
  for delete using (auth.uid() = psicologo_id);

create policy "psicologo_ve_proprias_sessoes" on sessoes_prontuario
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );
create policy "psicologo_cria_proprias_sessoes" on sessoes_prontuario
  for insert with check (
    exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );

create policy "psicologo_ve_proprias_consultas" on consultas
  for select using (auth.uid() = psicologo_id);
create policy "psicologo_cria_proprias_consultas" on consultas
  for insert with check (auth.uid() = psicologo_id);
create policy "psicologo_edita_proprias_consultas" on consultas
  for update using (auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);
-- Sem policy de INSERT para "anon": agendamentos públicos passam pela função
-- criar_agendamento_publico() (security definer) abaixo, nunca por insert cru
-- na tabela — isso evita que a anon key (que vai pro bundle JS) seja usada
-- pra forjar status='confirmada' ou floodar a agenda de qualquer psicologo_id.

-- =========================================================
-- View pública (usada pela página /agendar/[psicologoId])
-- Expõe só as colunas seguras de "perfis" — nunca o whatsapp, já que RLS é
-- por linha, não por coluna, e essa view roda com o privilégio de quem a
-- criou (contorna a RLS de "perfis" de propósito, só para estas colunas).
-- =========================================================
create or replace view perfis_publico as
select
  id,
  nome,
  titulo,
  crp,
  foto_url,
  bio,
  valor_consulta,
  dias_disponiveis,
  horario_inicio,
  horario_fim
from perfis;

grant select on perfis_publico to anon, authenticated;

-- View pública de "consultas" — a página /agendar/[psicologoId] precisa
-- saber quais horários já estão ocupados para um psicólogo, mas a RLS de
-- "consultas" só permite o dono ler suas próprias linhas (auth.uid() =
-- psicologo_id), o que bloquearia completamente um visitante anônimo. Esta
-- view expõe só o essencial pra checar disponibilidade — nunca nome,
-- telefone ou qualquer outro dado do paciente.
create or replace view consultas_publico as
select psicologo_id, data, horario, status
from consultas;

grant select on consultas_publico to anon, authenticated;

-- =========================================================
-- Agendamento público (RPC) — único caminho de escrita para visitantes
-- anônimos. Força status/origem no servidor e valida o horário antes de
-- inserir (o índice único acima é a garantia final contra corrida).
-- =========================================================
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
    psicologo_id, paciente_nome, data, horario, status, tipo, origem,
    modalidade, idade, sexo, profissao, telefone, endereco, estado_civil,
    escolaridade, motivo
  ) values (
    p_psicologo_id, p_paciente_nome, p_data, p_horario, 'pendente', 'consulta', 'publico',
    p_modalidade, p_idade, p_sexo, p_profissao, p_telefone, p_endereco, p_estado_civil,
    p_escolaridade, p_motivo
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function criar_agendamento_publico(
  uuid, text, date, time, text, int, text, text, text, text, text, text, text
) to anon, authenticated;

-- =========================================================
-- Provisionamento automático: toda conta nova (auth.users) ganha uma linha
-- em "perfis", puxando o nome informado no cadastro (signUp options.data.name).
-- =========================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================
-- Realtime: necessário para a Agenda do dashboard reagir a novos
-- agendamentos públicos sem precisar recarregar a página.
-- =========================================================
alter publication supabase_realtime add table consultas;
