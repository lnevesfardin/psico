-- Schema do Psico (multi-tenant): cada psicólogo é um usuário do Supabase
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
  compartilha_humor boolean not null default true,
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
-- Desligado pelo próprio paciente em parar_compartilhar_humor(). Só governa
-- o check-in de humor: o vínculo da conta (cliente_user_id) continua de pé,
-- pra não derrubar junto o acesso dele aos materiais e hábitos.
alter table pacientes add column if not exists compartilha_humor boolean not null default true;
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- alter table (não só create) para bancos provisionados antes desta mudança.
alter table sessoes_prontuario add column if not exists origem text not null default 'manual';
alter table sessoes_prontuario add column if not exists consentimento_em timestamptz;
alter table sessoes_prontuario add column if not exists duracao_segundos int;
-- Marca quando uma anotação foi editada depois de criada (comparado a
-- data_hora na UI) — editar o texto não deve mexer em data_hora, que é
-- quando a sessão de fato aconteceu.
alter table sessoes_prontuario add column if not exists updated_at timestamptz not null default now();

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

create or replace trigger sessoes_prontuario_set_updated_at
  before update on sessoes_prontuario
  for each row execute function set_updated_at();

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
  como_conheceu text,
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
alter table consultas add column if not exists como_conheceu text;

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

-- =========================================================
-- assinatura_ativa() — "este psicólogo pode CRIAR/EDITAR dados?". Usada nas
-- policies de escrita logo abaixo (ver a tabela "assinaturas" mais adiante
-- neste arquivo pra definição de status/isento e pro grandfather de quem já
-- usava o app antes da cobrança existir).
--
-- trialing/active = em dia (o trial do Stripe já exige cartão cadastrado).
-- Qualquer outro estado (past_due, canceled, unpaid, ou nenhuma linha)
-- bloqueia ESCRITA. Leitura e exportação ficam livres de propósito: o
-- prontuário é dado clínico sob guarda obrigatória (Res. CFP 01/2009 e
-- 06/2019), e reter isso de um profissional inadimplente criaria um problema
-- muito pior que a mensalidade atrasada.
--
-- security definer pelo motivo de sempre neste arquivo: a policy roda com a
-- permissão de quem escreve, e "assinaturas" só tem policy de select da
-- própria linha — a função devolve só um boolean, nunca a linha.
--
-- language plpgsql (não sql) de propósito: o corpo de uma função plpgsql não
-- é resolvido contra o catálogo na hora do CREATE, então esta função pode
-- ser declarada aqui, antes das policies que a usam, mesmo que a tabela
-- "assinaturas" só seja criada mais abaixo. Trocar pra "language sql"
-- quebraria a primeira execução do arquivo num banco vazio.
-- =========================================================
create or replace function assinatura_ativa()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from assinaturas
    where psicologo_id = auth.uid()
      and (isento or status in ('trialing', 'active'))
  );
end;
$$;

grant execute on function assinatura_ativa() to authenticated;

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
  for insert with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_edita_proprios_pacientes" on pacientes;
create policy "psicologo_edita_proprios_pacientes" on pacientes
  for update using (auth.uid() = psicologo_id and assinatura_ativa())
  with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_apaga_proprios_pacientes" on pacientes;
create policy "psicologo_apaga_proprios_pacientes" on pacientes
  for delete using (auth.uid() = psicologo_id and assinatura_ativa());

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
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_apaga_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_apaga_proprias_sessoes" on sessoes_prontuario
  for delete using (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_edita_proprias_sessoes" on sessoes_prontuario;
create policy "psicologo_edita_proprias_sessoes" on sessoes_prontuario
  for update using (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  ) with check (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = sessoes_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );

drop policy if exists "psicologo_ve_proprias_consultas" on consultas;
create policy "psicologo_ve_proprias_consultas" on consultas
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprias_consultas" on consultas;
create policy "psicologo_cria_proprias_consultas" on consultas
  for insert with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_edita_proprias_consultas" on consultas;
create policy "psicologo_edita_proprias_consultas" on consultas
  for update using (auth.uid() = psicologo_id and assinatura_ativa())
  with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_apaga_proprias_consultas" on consultas;
create policy "psicologo_apaga_proprias_consultas" on consultas
  for delete using (auth.uid() = psicologo_id and assinatura_ativa());
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

-- =========================================================
-- recorrencias — consulta que se repete toda semana (ou a cada 2 semanas) no
-- mesmo dia da semana e horário. Cada ocorrência continua sendo uma linha
-- normal em "consultas" (com recorrencia_id preenchido) — não existe
-- consulta "virtual" calculada na hora; tudo que aparece na agenda é uma
-- linha real, editável/cancelável individualmente sem afetar o resto da
-- série.
-- =========================================================
create table if not exists recorrencias (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0=domingo..6=sábado
  horario time not null,
  modalidade text check (modalidade in ('presencial', 'online')),
  intervalo_semanas int not null default 1 check (intervalo_semanas in (1, 2)),
  inicio date not null,
  fim date,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists recorrencias_psicologo_id_idx on recorrencias (psicologo_id);

alter table recorrencias enable row level security;

drop policy if exists "psicologo_ve_proprias_recorrencias" on recorrencias;
create policy "psicologo_ve_proprias_recorrencias" on recorrencias
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprias_recorrencias" on recorrencias;
create policy "psicologo_cria_proprias_recorrencias" on recorrencias
  for insert with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_edita_proprias_recorrencias" on recorrencias;
create policy "psicologo_edita_proprias_recorrencias" on recorrencias
  for update using (auth.uid() = psicologo_id and assinatura_ativa())
  with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_apaga_proprias_recorrencias" on recorrencias;
create policy "psicologo_apaga_proprias_recorrencias" on recorrencias
  for delete using (auth.uid() = psicologo_id and assinatura_ativa());

-- Liga cada ocorrência (linha em "consultas") à série que a gerou — nullable,
-- a maioria das consultas continua avulsa. "on delete set null": apagar a
-- recorrência (não usado hoje, só desativar via "ativa") nunca apaga a
-- consulta em si.
alter table consultas add column if not exists recorrencia_id uuid references recorrencias(id) on delete set null;
create index if not exists consultas_recorrencia_id_idx on consultas (recorrencia_id);

drop policy if exists "psicologo_ve_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_ve_proprios_lancamentos" on lancamentos_financeiros
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_cria_proprios_lancamentos" on lancamentos_financeiros
  for insert with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_edita_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_edita_proprios_lancamentos" on lancamentos_financeiros
  for update using (auth.uid() = psicologo_id and assinatura_ativa())
  with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_apaga_proprios_lancamentos" on lancamentos_financeiros;
create policy "psicologo_apaga_proprios_lancamentos" on lancamentos_financeiros
  for delete using (auth.uid() = psicologo_id and assinatura_ativa());

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
-- Acesso público a "perfis"/"disponibilidades"/"consultas" (usado pela
-- página /agendar/[psicologoId]) — funções security definer, não views.
--
-- Isto ERA implementado como 3 views ("perfis_publico" etc.) rodando com o
-- privilégio de quem as criou pra contornar a RLS de propósito, só devolvendo
-- colunas seguras. Funciona, mas é exatamente o que o Security Advisor do
-- Supabase acusa como "Security Definer View" CRITICAL: bypass de RLS
-- implícito, não documentado no próprio objeto (por isso o Postgres 15+
-- criou security_invoker=true como opt-out). Trocar as views pra
-- security_invoker=true não é a correção certa aqui — quebraria a página
-- pública de agendamento inteira, já que anon não tem nenhuma policy de RLS
-- em "perfis"/"disponibilidades"/"consultas"; a view herdaria exatamente
-- essa ausência de acesso.
--
-- A correção é trocar as 3 views por funções security definer com o mesmo
-- propósito — o bypass fica explícito na assinatura da função, não é um
-- comportamento padrão surpreendente como em view, e o Security Advisor não
-- acusa isso. Ganho extra: as views antigas não tinham filtro nenhum — um
-- SELECT direto contra a API REST em perfis_publico devolvia o perfil de
-- TODOS os psicólogos da plataforma, não só de quem a tela pedia. As
-- funções abaixo exigem o(s) id(s) do psicólogo como parâmetro.
--
-- drop view if exists: remove os objetos antigos de bancos que já rodaram
-- uma versão anterior deste arquivo (idempotente).
-- =========================================================
drop view if exists perfis_publico cascade;
drop view if exists disponibilidades_publico cascade;
drop view if exists consultas_publico cascade;

-- Aceita uma lista de ids (não só um) porque o histórico de agendamentos do
-- cliente pode envolver mais de um psicólogo de uma vez.
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
-- rate_limit_eventos / checar_rate_limit — freio simples contra abuso das
-- RPCs públicas (agendamento e resposta de escala), sem precisar de serviço
-- externo (Redis/Upstash etc.) nem mudar a arquitetura atual (o front chama
-- a RPC direto com a anon key, sem passar por rota própria do Next).
--
-- Limita por ALVO (ex.: "agendamento:<psicologo_id>"), não por IP de quem
-- chama: o objetivo aqui é impedir que a agenda ou a caixa de respostas de
-- UM psicólogo seja floodada, não identificar o atacante. Isso tem uma
-- limitação consciente — um atacante que espalhe requisições entre vários
-- psicólogos-alvo não é pego por este freio — mas cobre o cenário real (bot
-- floodando o link de uma pessoa) sem depender de cabeçalho de IP repassado
-- pela infra do Supabase, que não dá pra validar sem acesso ao projeto live.
-- =========================================================
create table if not exists rate_limit_eventos (
  id bigint generated always as identity primary key,
  chave text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_eventos_chave_idx
  on rate_limit_eventos (chave, created_at desc);

-- Sem RLS/grant nenhum pra anon/authenticated: só funções security definer
-- (chamadas abaixo) tocam esta tabela — ninguém lê nem escreve aqui direto.
alter table rate_limit_eventos enable row level security;

create or replace function checar_rate_limit(p_chave text, p_limite int, p_janela interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contagem int;
begin
  -- Limpeza oportunista (a cada chamada) em vez de um cron dedicado: a
  -- tabela não cresce sem limite mesmo sob tentativa de flood, já que cada
  -- flood gera muitas chamadas — cada uma dispara essa faxina.
  delete from rate_limit_eventos where created_at < now() - p_janela - interval '1 hour';

  select count(*) into v_contagem
  from rate_limit_eventos
  where chave = p_chave and created_at > now() - p_janela;

  if v_contagem >= p_limite then
    return false;
  end if;

  insert into rate_limit_eventos (chave) values (p_chave);
  return true;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC em função nova por padrão — sem este
-- revoke, anon/authenticated poderiam chamar checar_rate_limit() direto via
-- PostgREST (não só de dentro de criar_agendamento_publico/
-- responder_escala_publico) e esgotar de propósito o contador de QUALQUER
-- psicólogo-alvo, bloqueando agendamentos/respostas legítimos sem nunca
-- passar pelo fluxo real. security definer preserva a chamada interna das
-- outras funções (roda com o privilégio de quem é dono delas, não de quem
-- chamou originalmente), então isto não quebra nada.
revoke execute on function checar_rate_limit(text, int, interval) from public;

-- =========================================================
-- client_ip — IP de quem chamou a RPC via PostgREST, lido do cabeçalho
-- x-forwarded-for que a infra do Supabase repassa (current_setting(
-- 'request.headers', true) é exposto pelo próprio PostgREST em toda
-- chamada via API REST/RPC — comportamento padrão, não uma opção que
-- precisa ser ligada no painel). Usado para complementar o rate limit por
-- alvo (agendamento:<psicologo_id> etc.): aquele freia flood contra UM
-- psicólogo, este freia um único IP varrendo VÁRIOS psicólogos/e-mails
-- diferentes rápido demais.
--
-- "true" em current_setting = não lança erro se a GUC não existir (ex.:
-- chamada feita direto no SQL Editor, sem passar pelo PostgREST) — nesse
-- caso devolve null, e quem chama trata como "sem IP disponível" em vez de
-- quebrar. split_part pega só o primeiro IP da cadeia (o mais próximo do
-- visitante) quando x-forwarded-for tem vários, separados por vírgula.
-- =========================================================
create or replace function client_ip()
returns text
language sql
stable
as $$
  select nullif(
    trim(split_part(
      coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for',
      ',', 1
    )),
    ''
  );
$$;

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
drop function if exists criar_agendamento_publico(
  uuid, text, date, time, text, int, text, text, text, text, text, text, text, text
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
  p_motivo text,
  p_como_conheceu text
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

  if not checar_rate_limit('agendamento:' || p_psicologo_id::text, 8, interval '5 minutes') then
    raise exception 'Muitas tentativas de agendamento em pouco tempo. Aguarde alguns minutos e tente novamente.';
  end if;

  -- Camada extra: freia um único IP tentando agendar em vários psicólogos
  -- diferentes rápido demais (o freio acima só olha um alvo por vez).
  if client_ip() is not null
    and not checar_rate_limit('agendamento_ip:' || client_ip(), 20, interval '5 minutes')
  then
    raise exception 'Muitas tentativas de agendamento em pouco tempo. Aguarde alguns minutos e tente novamente.';
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
    escolaridade, motivo, como_conheceu
  ) values (
    -- auth.uid() reflete o JWT de quem chamou o RPC, mesmo sendo security
    -- definer — null se o visitante agendou deslogado (fluxo continua
    -- funcionando igual, só não aparece em "Meus Agendamentos" de ninguém).
    p_psicologo_id, auth.uid(), p_paciente_nome, p_data, p_horario, 'pendente', 'consulta', 'publico',
    p_modalidade, p_idade, p_sexo, p_profissao, p_telefone, p_email, p_endereco, p_estado_civil,
    p_escolaridade, p_motivo, p_como_conheceu
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function criar_agendamento_publico(
  uuid, text, date, time, text, int, text, text, text, text, text, text, text, text, text
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

-- A constraint dentro do "create table if not exists" acima só se aplica
-- quando a tabela é criada do zero — bancos já provisionados antes desta
-- linha existir (ou mexidos por fora, ex.: o incidente de "org_id") ficam
-- com a constraint velha/errada ao reexecutar o arquivo, sem erro nenhum
-- avisando disso. Drop + add explícitos garantem que a constraint em vigor
-- é sempre esta, não a que existia antes.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('client', 'psychologist') or role is null);

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
--
-- Rate limit por e-mail consultado (5 a cada 10 min): freia quem martela o
-- MESMO e-mail repetidamente. Não freia varrer uma LISTA de e-mails
-- diferentes rápido — isso exigiria limitar por IP de quem chama, que
-- depende de cabeçalho repassado pela infra do Supabase e não dá pra
-- validar sem acesso ao projeto live (mesma ressalva de
-- checar_rate_limit/RPCs públicas). auth-form.tsx já degrada bem se esta
-- função der erro: cai na mensagem genérica de "email ou senha
-- incorretos" em vez de quebrar o login.
-- language plpgsql (não mais "sql") e sem "stable": checar_rate_limit faz
-- insert/delete, incompatível com uma função declarada sem efeito colateral.
-- =========================================================
create or replace function email_existe(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not checar_rate_limit('email_existe:' || lower(trim(p_email)), 5, interval '10 minutes') then
    raise exception 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  end if;

  -- Camada extra: freia um único IP varrendo uma LISTA de e-mails
  -- diferentes rápido (o freio acima só olha um e-mail por vez).
  if client_ip() is not null
    and not checar_rate_limit('email_existe_ip:' || client_ip(), 15, interval '10 minutes')
  then
    raise exception 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  end if;

  return exists (
    select 1 from profiles where lower(email) = lower(p_email)
  );
end;
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
--
-- compartilha_humor é o que o botão "parar de compartilhar" desliga. Antes
-- esse botão zerava cliente_user_id, o que de fato escondia o humor — mas
-- junto levava o acesso do paciente aos materiais e aos hábitos (ver
-- eh_meu_paciente mais abaixo), coisa que a confirmação na tela não avisa.
drop policy if exists "psicologo_ve_humor_pacientes_vinculados" on checkins_humor;
create policy "psicologo_ve_humor_pacientes_vinculados" on checkins_humor
  for select using (
    exists (
      select 1 from pacientes p
      where p.cliente_user_id = checkins_humor.cliente_id
        and p.psicologo_id = auth.uid()
        and p.compartilha_humor
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
  -- security definer ignora RLS, então a trava de assinatura das policies
  -- não vale aqui — precisa ser checada explicitamente (mesma checagem em
  -- confirmar_consulta_e_criar_paciente e gerar_convite_escala).
  if not assinatura_ativa() then
    raise exception 'Assinatura inativa: reative seu plano para convidar pacientes.';
  end if;

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
    -- gen_random_uuid() (núcleo do Postgres, sem extensão) em vez de
    -- encode(gen_random_bytes(...), 'hex') do pgcrypto — este quebrou neste
    -- projeto em algum momento ("function gen_random_bytes(integer) does
    -- not exist"), provavelmente mesma bagunça externa que mexeu em
    -- org_id/triggers/constraints. gen_random_uuid() já é usado em toda
    -- coluna "id" deste arquivo e comprovadamente funciona aqui.
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
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
  v_email text;
  v_telefone text;
begin
  select paciente_id into v_paciente_id
  from convites_paciente
  where token = p_token and aceito_em is null;

  if v_paciente_id is null then
    raise exception 'Convite inválido ou já utilizado.';
  end if;

  -- Guarda extra: como é security definer (ignora RLS), nada impede por si
  -- só que uma conta de psicólogo logada chame este RPC. Convite é sempre
  -- pra vínculo de cliente.
  if exists (select 1 from profiles where id = auth.uid() and role = 'psychologist') then
    raise exception 'Contas de psicólogo não podem aceitar convite de paciente.';
  end if;

  -- Dados que a própria pessoa acabou de digitar no mini-cadastro (já
  -- gravados em profiles pelo handle_new_user, que roda antes deste RPC na
  -- mesma sessão). Só preenchem o que estiver em branco na ficha — nunca
  -- sobrescrevem um dado que o psicólogo já tinha preenchido, pra não
  -- arriscar apagar informação de prontuário por cima do autorrelato.
  -- "nome" fica de fora: pacientes.nome nunca fica em branco (obrigatório
  -- desde a criação da ficha), então não haveria o que preencher.
  select email, whatsapp into v_email, v_telefone
  from profiles where id = auth.uid();

  update pacientes
  set cliente_user_id = auth.uid(),
      email = coalesce(nullif(email, ''), v_email),
      telefone = coalesce(nullif(telefone, ''), v_telefone)
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
    and p.compartilha_humor
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
  where id = p_paciente_id
    and cliente_user_id = auth.uid()
    and compartilha_humor;

  if v_psicologo_id is null then
    raise exception 'Vínculo não encontrado.';
  end if;

  -- Desliga só o humor. Zerar cliente_user_id (o que esta função fazia
  -- antes) também derrubava o acesso do paciente aos materiais que o
  -- psicólogo enviou e aos hábitos definidos pra ele — efeito que a
  -- confirmação na tela não menciona e que ele não tem como desfazer
  -- sozinho, porque um novo vínculo depende de convite do psicólogo.
  update pacientes set compartilha_humor = false where id = p_paciente_id;

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
  -- Ver comentário em gerar_convite_paciente: security definer ignora RLS,
  -- então a trava de assinatura tem que ser explícita aqui (esta função
  -- CRIA paciente, é escrita de verdade).
  if not assinatura_ativa() then
    raise exception 'Assinatura inativa: reative seu plano para confirmar agendamentos.';
  end if;

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
      psicologo_id, nome, telefone, email, escolaridade, como_conheceu,
      cliente_user_id, data_primeira_consulta, observacoes
    ) values (
      v.psicologo_id, v.paciente_nome, v.telefone, v.email, v.escolaridade, v.como_conheceu,
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

-- =========================================================
-- modelos_documentos — modelos de documentos (atestado, laudo, declaração
-- etc.) que o psicólogo customiza e reutiliza para gerar documentos prontos
-- para pacientes. "conteudo" guarda texto com placeholders (ex.:
-- {{paciente_nome}}, ver PLACEHOLDER_TOKENS em src/lib/document-templates.ts)
-- substituídos na hora de gerar — nunca dado de paciente, só o texto-modelo.
-- =========================================================
create table if not exists modelos_documentos (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  nome text not null,
  conteudo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists modelos_documentos_psicologo_id_idx
  on modelos_documentos (psicologo_id);

create or replace trigger modelos_documentos_set_updated_at
  before update on modelos_documentos
  for each row execute function set_updated_at();

alter table modelos_documentos enable row level security;

drop policy if exists "psicologo_ve_proprios_modelos" on modelos_documentos;
create policy "psicologo_ve_proprios_modelos" on modelos_documentos
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_cria_proprios_modelos" on modelos_documentos;
create policy "psicologo_cria_proprios_modelos" on modelos_documentos
  for insert with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_edita_proprios_modelos" on modelos_documentos;
create policy "psicologo_edita_proprios_modelos" on modelos_documentos
  for update using (auth.uid() = psicologo_id and assinatura_ativa())
  with check (auth.uid() = psicologo_id and assinatura_ativa());
drop policy if exists "psicologo_apaga_proprios_modelos" on modelos_documentos;
create policy "psicologo_apaga_proprios_modelos" on modelos_documentos
  for delete using (auth.uid() = psicologo_id and assinatura_ativa());

-- =========================================================
-- documentos_emitidos — histórico dos documentos gerados (atestado, laudo
-- etc.) para um paciente a partir de um modelo. "conteudo" é o texto FINAL
-- já com os placeholders substituídos, congelado no momento da emissão — de
-- propósito NÃO referencia modelos_documentos: editar/apagar o modelo depois
-- não pode alterar o que já foi emitido, é documento clínico e precisa
-- continuar íntegro. Mesmo tratamento de dado sensível de
-- "sessoes_prontuario": nunca logado, RLS restringe ao psicólogo dono do
-- paciente.
-- =========================================================
create table if not exists documentos_emitidos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  tipo text not null,
  modelo_nome text not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists documentos_emitidos_paciente_id_idx
  on documentos_emitidos (paciente_id, created_at desc);

alter table documentos_emitidos enable row level security;

drop policy if exists "psicologo_ve_documentos_emitidos" on documentos_emitidos;
create policy "psicologo_ve_documentos_emitidos" on documentos_emitidos
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = documentos_emitidos.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_cria_documentos_emitidos" on documentos_emitidos;
create policy "psicologo_cria_documentos_emitidos" on documentos_emitidos
  for insert with check (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = documentos_emitidos.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_apaga_documentos_emitidos" on documentos_emitidos;
create policy "psicologo_apaga_documentos_emitidos" on documentos_emitidos
  for delete using (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = documentos_emitidos.paciente_id and p.psicologo_id = auth.uid()
    )
  );

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

create index if not exists materiais_paciente_paciente_idx
  on materiais_paciente (paciente_id, created_at desc);

alter table materiais_paciente enable row level security;

-- Dividida em leitura + escrita (era "for all") por causa da trava de
-- assinatura: quem está inadimplente continua VENDO/baixando o que já
-- enviou, só não envia nem apaga material novo. "for all" cobriria o select
-- junto e tiraria o acesso de leitura.
drop policy if exists "psicologo_gerencia_materiais" on materiais_paciente;
drop policy if exists "psicologo_ve_materiais" on materiais_paciente;
create policy "psicologo_ve_materiais" on materiais_paciente
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = materiais_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_cria_materiais" on materiais_paciente;
create policy "psicologo_cria_materiais" on materiais_paciente
  for insert with check (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = materiais_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_edita_materiais" on materiais_paciente;
create policy "psicologo_edita_materiais" on materiais_paciente
  for update using (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = materiais_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  ) with check (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = materiais_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_apaga_materiais" on materiais_paciente;
create policy "psicologo_apaga_materiais" on materiais_paciente
  for delete using (
    assinatura_ativa() and exists (
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
--
-- allowed_mime_types/file_size_limit são aplicados pelo próprio Storage do
-- Supabase (não só RLS/app) — sem isso, o upload aceitava QUALQUER tipo de
-- arquivo (inclusive HTML/SVG com script embutido, um vetor de XSS se o
-- paciente abrir o "material" enviado por um psicólogo) e o limite de 25 MB
-- só existia no código do cliente (src/lib/materiais-client.ts), fácil de
-- contornar chamando a API do Storage direto. A lista precisa ficar igual à
-- de MATERIAL_MIME_TYPES_PERMITIDOS nesse mesmo arquivo.
-- "do update" (não "do nothing"): reexecutar este arquivo num bucket já
-- existente precisa aplicar a restrição, não só na primeira vez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materiais-paciente',
  'materiais-paciente',
  false,
  26214400, -- 25 MB em bytes
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/x-m4a',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies do storage: a primeira pasta do caminho é o paciente_id, então
-- dá pra decidir acesso sem consultar materiais_paciente. Compara como texto
-- (p.id::text) de propósito — cast do nome da pasta para uuid explodiria em
-- qualquer arquivo solto com nome fora do padrão.
-- Mesma divisão de materiais_paciente (era "for all"): leitura/download do
-- que já existe fica livre, upload/remoção exigem assinatura em dia.
drop policy if exists "psicologo_gerencia_materiais_storage" on storage.objects;
drop policy if exists "psicologo_ve_materiais_storage" on storage.objects;
create policy "psicologo_ve_materiais_storage" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materiais-paciente'
    and exists (
      select 1 from pacientes p
      where p.id::text = (storage.foldername(name))[1]
        and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_envia_materiais_storage" on storage.objects;
create policy "psicologo_envia_materiais_storage" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materiais-paciente'
    and assinatura_ativa()
    and exists (
      select 1 from pacientes p
      where p.id::text = (storage.foldername(name))[1]
        and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_apaga_materiais_storage" on storage.objects;
create policy "psicologo_apaga_materiais_storage" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materiais-paciente'
    and assinatura_ativa()
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

alter table habitos_paciente enable row level security;

-- Mesma divisão de materiais_paciente (era "for all"): leitura livre,
-- escrita exige assinatura em dia.
drop policy if exists "psicologo_gerencia_habitos" on habitos_paciente;
drop policy if exists "psicologo_ve_habitos" on habitos_paciente;
create policy "psicologo_ve_habitos" on habitos_paciente
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = habitos_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_cria_habitos" on habitos_paciente;
create policy "psicologo_cria_habitos" on habitos_paciente
  for insert with check (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = habitos_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_edita_habitos" on habitos_paciente;
create policy "psicologo_edita_habitos" on habitos_paciente
  for update using (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = habitos_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  ) with check (
    assinatura_ativa() and exists (
      select 1 from pacientes p
      where p.id = habitos_paciente.paciente_id and p.psicologo_id = auth.uid()
    )
  );
drop policy if exists "psicologo_apaga_habitos" on habitos_paciente;
create policy "psicologo_apaga_habitos" on habitos_paciente
  for delete using (
    assinatura_ativa() and exists (
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
-- respostas_escala — respostas de escalas de rastreio (PHQ-9, GAD-7,
-- SNAP-IV, C-SSRS) enviadas pelo link público de escala (ver
-- src/lib/escalas.ts para os itens/opções e src/app/escala/[psicologoId]/
-- [slug] para a página pública). Guarda só as respostas brutas por item
-- ("respostas" jsonb, chave = id do item) — a pontuação/classificação é
-- calculada no dashboard a partir das mesmas funções que geram o
-- formulário (fonte única, evita a pontuação salva divergir da lógica
-- atual caso os pontos de corte mudem depois).
-- =========================================================
create table if not exists respostas_escala (
  id uuid primary key default gen_random_uuid(),
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  escala text not null check (escala in ('cssrs', 'phq9', 'gad7', 'snap-iv')),
  -- Digitado livremente por quem respondeu, sem validação — o formulário
  -- público não exige login nem conta (ver "não necessita de dados" no
  -- pedido original), então isto é a única forma opcional de saber quem
  -- respondeu.
  paciente_nome text,
  respostas jsonb not null,
  created_at timestamptz not null default now()
);

-- Preenchido só quando a escala foi enviada por um convite vinculado a uma
-- ficha (ver convites_escala abaixo). Continua nulo no link genérico, em que
-- quem responde não tem cadastro — os dois fluxos convivem na mesma tabela.
-- "on delete set null": apagar a ficha do paciente não pode apagar em
-- silêncio o histórico de rastreio já coletado.
alter table respostas_escala
  add column if not exists paciente_id uuid references pacientes(id) on delete set null;

create index if not exists respostas_escala_psicologo_id_idx
  on respostas_escala (psicologo_id, created_at desc);

create index if not exists respostas_escala_paciente_idx
  on respostas_escala (paciente_id, created_at desc) where paciente_id is not null;

alter table respostas_escala enable row level security;

drop policy if exists "psicologo_ve_proprias_respostas_escala" on respostas_escala;
create policy "psicologo_ve_proprias_respostas_escala" on respostas_escala
  for select using (auth.uid() = psicologo_id);
drop policy if exists "psicologo_apaga_proprias_respostas_escala" on respostas_escala;
create policy "psicologo_apaga_proprias_respostas_escala" on respostas_escala
  for delete using (auth.uid() = psicologo_id);
-- Sem policy de INSERT para "anon"/"authenticated" de propósito, mesmo
-- motivo de "consultas": quem responde a escala é sempre um visitante sem
-- vínculo verificável com o psicólogo, então a escrita passa pela função
-- responder_escala_publico() (security definer) abaixo, nunca por insert
-- cru na tabela.

-- =========================================================
-- convites_escala — liga uma escala a uma ficha de paciente já cadastrada.
-- Sem isto, o link de escala é anônimo: chega uma resposta com um nome
-- digitado à mão, que ninguém garante ser de quem diz ser, e sem histórico
-- por paciente. Com o convite, a resposta cai direto na ficha certa.
--
-- Token aleatório (não paciente_id) pelo mesmo motivo de convites_paciente:
-- a página que consome o link é pública, e id na URL permitiria enumerar
-- pacientes — "fulano faz rastreio de depressão com o psicólogo X" é dado
-- sensível de saúde (LGPD).
--
-- NÃO é de uso único de propósito: reaplicar a mesma escala em intervalos
-- (PHQ-9 a cada poucas semanas, por exemplo) é uso clínico normal, e cada
-- resposta vira uma linha nova em respostas_escala. respondido_em guarda a
-- última vez que o link foi usado, só como referência na tela.
-- =========================================================
create table if not exists convites_escala (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  escala text not null check (escala in ('cssrs', 'phq9', 'gad7', 'snap-iv')),
  token text not null unique,
  criado_em timestamptz not null default now(),
  respondido_em timestamptz,
  unique (paciente_id, escala)
);

create index if not exists convites_escala_paciente_idx
  on convites_escala (paciente_id);

alter table convites_escala enable row level security;

-- Mesma lógica de convites_paciente: só o dono da ficha enxerga o convite.
-- O acesso público ao token não passa por policy — vai pela função
-- security definer de resposta, que nunca devolve dado do paciente.
drop policy if exists "psicologo_ve_proprios_convites_escala" on convites_escala;
create policy "psicologo_ve_proprios_convites_escala" on convites_escala
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = convites_escala.paciente_id and p.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- gerar_convite_escala — cria (ou reaproveita) o convite de uma escala para
-- um paciente e devolve o token. Reaproveitar mantém o link estável: o
-- psicólogo pode reenviar o mesmo endereço para uma reaplicação sem
-- invalidar o que já mandou antes.
-- =========================================================
create or replace function gerar_convite_escala(
  p_paciente_id uuid,
  p_escala text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- Ver comentário em gerar_convite_paciente sobre security definer x RLS.
  if not assinatura_ativa() then
    raise exception 'Assinatura inativa: reative seu plano para enviar escalas.';
  end if;

  if not exists (
    select 1 from pacientes
    where id = p_paciente_id and psicologo_id = auth.uid()
  ) then
    raise exception 'Paciente não encontrado';
  end if;

  if p_escala not in ('cssrs', 'phq9', 'gad7', 'snap-iv') then
    raise exception 'Escala inválida';
  end if;

  select token into v_token
  from convites_escala
  where paciente_id = p_paciente_id and escala = p_escala;

  if v_token is null then
    -- Mesmo motivo do token em gerar_convite_paciente: gen_random_uuid() no
    -- lugar de gen_random_bytes (pgcrypto), que não existe neste projeto.
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into convites_escala (paciente_id, escala, token)
    values (p_paciente_id, p_escala, v_token);
  end if;

  return v_token;
end;
$$;

grant execute on function gerar_convite_escala(uuid, text) to authenticated;

-- =========================================================
-- responder_escala_publico — único caminho de escrita para o link público
-- de escala. security definer para o visitante anônimo (sem policy de
-- INSERT em respostas_escala, ver acima) conseguir gravar; valida só que o
-- psicólogo existe e que a escala é uma das implementadas — a validação de
-- formato/obrigatoriedade de cada item é feita no cliente (src/lib/
-- escalas.ts), então "respostas" chega aqui como jsonb livre.
--
-- p_token é opcional: presente, amarra a resposta à ficha do paciente (link
-- gerado em convites_escala); ausente, mantém o fluxo anônimo de antes.
-- =========================================================
-- drop explícito da assinatura antiga (sem p_token): "create or replace"
-- criaria uma segunda função sobrecarregada em vez de substituir, e a
-- chamada do PostgREST ficaria ambígua entre as duas.
drop function if exists responder_escala_publico(uuid, text, text, jsonb);

create or replace function responder_escala_publico(
  p_psicologo_id uuid,
  p_escala text,
  p_paciente_nome text,
  p_respostas jsonb,
  p_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_paciente_id uuid;
begin
  if not exists (select 1 from perfis where id = p_psicologo_id) then
    raise exception 'Psicólogo não encontrado';
  end if;

  -- Token inválido/trocado falha alto em vez de gravar como anônimo: uma
  -- resposta que deveria entrar na ficha e some dela é pior que um erro.
  -- A checagem amarra token, escala e psicólogo — link de um paciente não
  -- serve para responder outra escala nem para outro profissional.
  if p_token is not null and p_token <> '' then
    select ce.paciente_id into v_paciente_id
    from convites_escala ce
    join pacientes p on p.id = ce.paciente_id
    where ce.token = p_token
      and ce.escala = p_escala
      and p.psicologo_id = p_psicologo_id;

    if v_paciente_id is null then
      raise exception 'Link inválido ou expirado.';
    end if;
  end if;

  if p_escala not in ('cssrs', 'phq9', 'gad7', 'snap-iv') then
    raise exception 'Escala inválida';
  end if;

  if not checar_rate_limit('escala:' || p_psicologo_id::text, 8, interval '5 minutes') then
    raise exception 'Muitas respostas enviadas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  end if;

  -- Camada extra: freia um único IP respondendo escalas de vários
  -- psicólogos diferentes rápido demais (o freio acima só olha um alvo).
  if client_ip() is not null
    and not checar_rate_limit('escala_ip:' || client_ip(), 20, interval '5 minutes')
  then
    raise exception 'Muitas respostas enviadas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  end if;

  insert into respostas_escala (psicologo_id, escala, paciente_nome, respostas, paciente_id)
  values (p_psicologo_id, p_escala, nullif(trim(p_paciente_nome), ''), p_respostas, v_paciente_id)
  returning id into v_id;

  if v_paciente_id is not null then
    update convites_escala set respondido_em = now() where token = p_token;
  end if;

  return v_id;
end;
$$;

grant execute on function responder_escala_publico(uuid, text, text, jsonb, text)
  to anon, authenticated;

-- =========================================================
-- acessos_prontuario — trilha de auditoria (LGPD): registra QUANDO o
-- prontuário de um paciente foi acessado, complementando o RLS (que só
-- controla QUEM pode acessar). Gravado pelo cliente logo após buscar as
-- sessões (ver registrarAcessoProntuario em src/lib/patients-client.ts),
-- porque Postgres não tem trigger de SELECT — não tem como registrar
-- leitura só no banco.
--
-- De propósito NÃO tem policy de UPDATE/DELETE: um log que a própria
-- pessoa auditada pode apagar deixa de ser confiável como log.
-- =========================================================
create table if not exists acessos_prontuario (
  id bigint generated always as identity primary key,
  psicologo_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists acessos_prontuario_paciente_idx
  on acessos_prontuario (paciente_id, created_at desc);

alter table acessos_prontuario enable row level security;

drop policy if exists "psicologo_registra_acesso_prontuario" on acessos_prontuario;
create policy "psicologo_registra_acesso_prontuario" on acessos_prontuario
  for insert with check (
    auth.uid() = psicologo_id
    and exists (
      select 1 from pacientes p
      where p.id = acessos_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );

drop policy if exists "psicologo_ve_proprios_acessos_prontuario" on acessos_prontuario;
create policy "psicologo_ve_proprios_acessos_prontuario" on acessos_prontuario
  for select using (
    exists (
      select 1 from pacientes p
      where p.id = acessos_prontuario.paciente_id and p.psicologo_id = auth.uid()
    )
  );

-- =========================================================
-- assinaturas — status da assinatura Stripe de cada psicólogo. Uma linha
-- por psicólogo; a fonte da verdade sobre cobrança é sempre o Stripe, isto
-- é só um cache local pra saber "esse psicólogo tem assinatura ativa?" sem
-- chamar a API do Stripe a cada carregamento de tela.
--
-- "status" usa o vocabulário do próprio Stripe (trialing/active/past_due/
-- canceled/...), sem tradução — evita bug de mapeamento e fica fácil
-- comparar com o painel do Stripe na hora de depurar.
--
-- Sem policy de insert/update/delete pra "authenticated" de propósito: só
-- o webhook (service role, ver /api/stripe/webhook) escreve aqui. Se o
-- psicólogo pudesse gravar a própria linha, daria pra se autoconceder
-- status "active" direto pelo client, sem pagar nada.
-- =========================================================
create table if not exists assinaturas (
  psicologo_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  plano text check (plano in ('mensal', 'trimestral', 'anual')),
  status text not null
    check (status in (
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )),
  trial_fim timestamptz,
  periodo_atual_fim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- create table if not exists é no-op numa tabela que já existe: quando o
-- plano "trimestral" foi adicionado depois, o constraint antigo (só
-- mensal/anual) só é corrigido de fato reaplicando-o aqui.
alter table assinaturas drop constraint if exists assinaturas_plano_check;
alter table assinaturas add constraint assinaturas_plano_check
  check (plano in ('mensal', 'trimestral', 'anual'));

create unique index if not exists assinaturas_stripe_customer_idx
  on assinaturas (stripe_customer_id);

alter table assinaturas enable row level security;

drop policy if exists "psicologo_ve_propria_assinatura" on assinaturas;
create policy "psicologo_ve_propria_assinatura" on assinaturas
  for select using (auth.uid() = psicologo_id);

create or replace trigger assinaturas_set_updated_at
  before update on assinaturas
  for each row execute function set_updated_at();

-- Conta cortesia/vitalícia (sócio, conta de demonstração, e principalmente
-- quem já usava o app antes da cobrança existir — ver backfill abaixo).
-- Separado de "status" de propósito: status é espelho fiel do Stripe, e
-- misturar um valor nosso ali quebraria a comparação com o painel deles.
alter table assinaturas add column if not exists isento boolean not null default false;

-- Conta isenta não tem cliente no Stripe — a coluna nasceu "not null"
-- porque só o webhook criava linha aqui.
alter table assinaturas alter column stripe_customer_id drop not null;

-- =========================================================
-- Grandfather: todo psicólogo que já existia quando a cobrança entrou no ar
-- continua usando de graça. Sem isto, reexecutar este arquivo cortaria na
-- hora quem já usa o app em produção (que nunca teve como assinar, porque
-- o Stripe não existia ainda).
--
-- O corte é uma data fixa, não "todo mundo que não tem linha": assim isto
-- continua idempotente (pode reexecutar à vontade) sem passar a isentar
-- também quem se cadastrar amanhã.
-- =========================================================
insert into assinaturas (psicologo_id, status, isento)
select p.id, 'active', true
from profiles p
where p.role = 'psychologist'
  and p.created_at < timestamptz '2026-08-14 00:00:00-03'
  and not exists (select 1 from assinaturas a where a.psicologo_id = p.id)
on conflict (psicologo_id) do nothing;

-- A função assinatura_ativa(), que lê esta tabela, fica declarada bem antes
-- daqui (junto das policies que a usam) — ver o comentário lá sobre por que
-- ela precisa nascer antes desta tabela existir.

-- =========================================================
-- erros_app — o que quebrou na mão de quem está usando.
--
-- Com um único usuário dava pra saber por telefone; com gente desconhecida
-- não dá — quem tropeça num erro não reporta, só some. Fica aqui em vez de
-- num serviço tipo Sentry de propósito: mensagem de erro carrega fragmento
-- de dado clínico com frequência (nome em constraint, id de paciente na
-- rota), e mandar isso pra fora acrescentaria um operador estrangeiro de
-- dado de saúde ao tratamento, com tudo que a LGPD exige junto.
--
-- Consulta no SQL Editor:
--   select ocorrido_em, origem, rota, mensagem, count(*) over () as total
--   from erros_app order by ocorrido_em desc limit 50;
-- =========================================================
create table if not exists erros_app (
  id bigint generated always as identity primary key,
  ocorrido_em timestamptz not null default now(),
  origem text not null check (origem in ('cliente', 'servidor')),
  rota text,
  mensagem text not null,
  stack text,
  user_agent text,
  usuario_id uuid references auth.users(id) on delete set null
);

create index if not exists erros_app_ocorrido_em_idx
  on erros_app (ocorrido_em desc);

-- RLS ligada e SEM policy nenhuma: ninguém logado lê nem escreve direto. A
-- escrita passa só pelo registrar_erro_app() abaixo (security definer), e a
-- leitura é sua, pelo painel do Supabase. Um psicólogo não tem por que ver
-- o erro que outro tomou.
alter table erros_app enable row level security;

-- Aceita chamada anônima de propósito: erro na página pública de
-- agendamento é justamente o que você não fica sabendo de outro jeito.
-- Nunca lança exceção — reportar erro que vira erro só piora a tela de quem
-- já está travado.
create or replace function registrar_erro_app(
  p_origem text,
  p_rota text,
  p_mensagem text,
  p_stack text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_origem not in ('cliente', 'servidor') then
    return;
  end if;
  if coalesce(trim(p_mensagem), '') = '' then
    return;
  end if;

  -- Freio pra esta porta (aberta ao anônimo) não virar caminho de flood.
  if not checar_rate_limit(
    'erro_app:' || coalesce(auth.uid()::text, client_ip(), 'anon'),
    20,
    interval '10 minutes'
  ) then
    return;
  end if;

  -- left() em tudo: stack de navegador passa fácil de dezenas de KB, e não
  -- interessa guardar isso multiplicado por cada visitante.
  insert into erros_app (origem, rota, mensagem, stack, user_agent, usuario_id)
  values (
    p_origem,
    left(p_rota, 300),
    left(p_mensagem, 2000),
    left(p_stack, 4000),
    left(p_user_agent, 300),
    auth.uid()
  );
exception
  when others then
    return;
end;
$$;

grant execute on function registrar_erro_app(text, text, text, text, text)
  to anon, authenticated;

-- =========================================================
-- checar_limite_ia — freio das rotas que chamam o Gemini, que são as únicas
-- em que cada requisição custa dinheiro de verdade. Sem isto, uma conta
-- autenticada consegue rodar em laço e queimar a cota inteira.
--
-- Os limites ficam DENTRO da função, não nos parâmetros: checar_rate_limit()
-- é revogada do public justamente pra ninguém escolher chave e teto na mão
-- (ver o comentário lá em cima), e repassar isso pro chamador aqui abriria a
-- mesma porta de novo. A chave sai de auth.uid(), nunca de argumento.
-- =========================================================
create or replace function checar_limite_ia(p_recurso text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite int;
  v_janela interval;
begin
  if auth.uid() is null then
    return false;
  end if;

  case p_recurso
    when 'chat' then
      v_limite := 40; v_janela := interval '10 minutes';
    when 'lancamento' then
      v_limite := 40; v_janela := interval '10 minutes';
    -- A transcrição manda um trecho a cada 90s enquanto a sessão corre:
    -- 50 minutos dão ~34 chamadas. O teto cobre folgado duas sessões
    -- seguidas na mesma hora sem atrapalhar ninguém legítimo.
    when 'transcricao' then
      v_limite := 150; v_janela := interval '1 hour';
    else
      raise exception 'Recurso de IA desconhecido: %', p_recurso;
  end case;

  return checar_rate_limit(
    'ia:' || p_recurso || ':' || auth.uid()::text, v_limite, v_janela
  );
end;
$$;

grant execute on function checar_limite_ia(text) to authenticated;
