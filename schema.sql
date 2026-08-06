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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessoes_prontuario_origem_check'
  ) then
    alter table sessoes_prontuario add constraint sessoes_prontuario_origem_check
      check (origem in ('manual', 'transcricao'));
  end if;
end $$;

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
drop policy if exists "psicologo_apaga_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_apaga_proprias_sessoes" on sessoes_prontuario
  for delete using (
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

create index if not exists convites_paciente_paciente_idx
  on convites_paciente (paciente_id);

alter table convites_paciente enable row level security;

-- Só o dono do paciente enxerga/gera convites. O acesso público ao token
-- não passa por policy: vai pelas funções security definer abaixo, que
-- devolvem só o mínimo necessário para montar a tela do convite.
drop policy if exists "psicologo_ve_proprios_convites" on convites_paciente;
create policy "psicologo_ve_proprios_convites" on convites_paciente
  for select using (
    exists (
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
    insert into convites_paciente (paciente_id, token)
    values (p_paciente_id, v_token);
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
begin
  select paciente_id into v_paciente_id
  from convites_paciente
  where token = p_token and aceito_em is null;

  if v_paciente_id is null then
    raise exception 'Convite inválido ou já utilizado.';
  end if;

  update pacientes
  set cliente_user_id = auth.uid()
  where id = v_paciente_id;

  update consultas
  set cliente_id = auth.uid()
  where paciente_id = v_paciente_id and cliente_id is null;

  update convites_paciente
  set aceito_em = now(), aceito_por = auth.uid()
  where token = p_token;
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

create index if not exists avisos_psicologo_psicologo_id_idx
  on avisos_psicologo (psicologo_id, created_at desc);

alter table avisos_psicologo enable row level security;

drop policy if exists "psicologo_ve_proprios_avisos" on avisos_psicologo;
create policy "psicologo_ve_proprios_avisos" on avisos_psicologo
  for select using (auth.uid() = psicologo_id);

drop policy if exists "psicologo_marca_proprios_avisos" on avisos_psicologo;
create policy "psicologo_marca_proprios_avisos" on avisos_psicologo
  for update using (auth.uid() = psicologo_id) with check (auth.uid() = psicologo_id);

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
begin
  select psicologo_id, nome into v_psicologo_id, v_paciente_nome
  from pacientes
  where id = p_paciente_id and cliente_user_id = auth.uid();

  if v_psicologo_id is null then
    raise exception 'Vínculo não encontrado.';
  end if;

  update pacientes set cliente_user_id = null where id = p_paciente_id;

  insert into avisos_psicologo (psicologo_id, mensagem)
  values (
    v_psicologo_id,
    v_paciente_nome || ' parou de compartilhar o check-in de humor com você.'
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
      psicologo_id, nome, telefone, email, escolaridade,
      cliente_user_id, data_primeira_consulta, observacoes
    ) values (
      v.psicologo_id, v.paciente_nome, v.telefone, v.email, v.escolaridade,
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
