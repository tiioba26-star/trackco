-- Trackco · schema principal
-- Roda no MESMO projeto Supabase do "relatorio". Nada aqui altera o schema public.
-- Login compartilhado: trackco.colaboradores.auth_id -> auth.users (mesma convenção usuario@acesso.iobaoftalmo.com.br).

create schema if not exists trackco;
grant usage on schema trackco to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pessoas e organização
-- ---------------------------------------------------------------------------
create table trackco.colaboradores (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid unique references auth.users (id) on delete set null,
  nome          text not null,
  login         text unique check (login = lower(login)),
  login_klingo  text,
  papel         text not null default 'colaborador' check (papel in ('admin', 'gestor', 'colaborador')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index colaboradores_login_klingo_un on trackco.colaboradores (lower(login_klingo)) where login_klingo is not null;

create table trackco.equipes (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null unique,
  descricao              text,
  cor                    text not null default '#1C5CAB',
  -- aberto: ranking com números · posicoes: só posições/carinhas · privado: cada um vê só o seu
  visibilidade_ranking   text not null default 'posicoes' check (visibilidade_ranking in ('aberto', 'posicoes', 'privado')),
  -- etapas do fechamento, em ordem (contestacao, lider, admin)
  etapas_aprovacao       text[] not null default array['contestacao', 'lider', 'admin'],
  -- dias de trabalho ISO: 1 = segunda ... 7 = domingo
  dias_trabalho          int[] not null default array[1, 2, 3, 4, 5],
  prazo_contestacao_dias int not null default 5 check (prazo_contestacao_dias between 0 and 31),
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now()
);

create table trackco.equipe_membros (
  id             uuid primary key default gen_random_uuid(),
  equipe_id      uuid not null references trackco.equipes (id) on delete cascade,
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  funcao         text not null default 'membro' check (funcao in ('lider', 'membro')),
  inicio         date not null default current_date,
  fim            date,
  check (fim is null or fim >= inicio)
);
create index equipe_membros_equipe on trackco.equipe_membros (equipe_id);
create index equipe_membros_colab on trackco.equipe_membros (colaborador_id);
-- uma pessoa não pode ter dois vínculos abertos na mesma equipe
create unique index equipe_membros_aberto_un on trackco.equipe_membros (equipe_id, colaborador_id) where fim is null;

create table trackco.ausencias (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  inicio         date not null,
  fim            date not null,
  tipo           text not null default 'ferias' check (tipo in ('ferias', 'atestado', 'folga', 'afastamento', 'outro')),
  observacao     text,
  criado_por     uuid,
  criado_em      timestamptz not null default now(),
  check (fim >= inicio)
);
create index ausencias_colab on trackco.ausencias (colaborador_id, inicio);

create table trackco.feriados (
  data      date primary key,
  descricao text not null
);

-- ---------------------------------------------------------------------------
-- Dados de origem
-- ---------------------------------------------------------------------------
create table trackco.klingo_agendamentos (
  chave              text primary key,
  data_agendado_em   date not null,
  data_agendado_para date,
  data_realizacao    date,
  responsavel_login  text,
  paciente_nome      text,
  procedimento       text,
  profissional       text,
  operadora          text,
  qtd                numeric not null default 1,
  -- null = ainda não verificado (consulta futura ou cruzamento pendente)
  atendido           boolean,
  valor              numeric(12, 2),
  sincronizado_em    timestamptz not null default now()
);
create index klingo_ag_em on trackco.klingo_agendamentos (data_agendado_em);
create index klingo_ag_para on trackco.klingo_agendamentos (data_agendado_para);
create index klingo_ag_real on trackco.klingo_agendamentos (data_realizacao);
create index klingo_ag_resp on trackco.klingo_agendamentos (lower(responsavel_login));

create table trackco.klingo_usuarios (
  login          text primary key check (login = lower(login)),
  nome           text not null,
  atualizado_em  timestamptz not null default now()
);

create table trackco.lancamentos (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  data           date not null,
  tipo           text not null,
  valor          numeric not null default 1,
  descricao      text,
  atributos      jsonb not null default '{}'::jsonb,
  criado_por     uuid,
  criado_em      timestamptz not null default now()
);
create index lancamentos_colab_data on trackco.lancamentos (colaborador_id, data);

create table trackco.sync_execucoes (
  id                  bigint generated always as identity primary key,
  fonte               text not null default 'klingo',
  modo                text not null default 'horario',
  iniciado_em         timestamptz not null default now(),
  finalizado_em       timestamptz,
  status              text not null default 'executando' check (status in ('executando', 'ok', 'parcial', 'erro')),
  linhas_agendamentos int not null default 0,
  linhas_atendimentos int not null default 0,
  mensagem            text,
  detalhes            jsonb not null default '{}'::jsonb
);
create index sync_execucoes_inicio on trackco.sync_execucoes (iniciado_em desc);

-- ---------------------------------------------------------------------------
-- Regras e cálculo
-- ---------------------------------------------------------------------------
create table trackco.metricas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nome          text not null,
  descricao     text,
  tipo          text not null check (tipo in ('quantitativa', 'qualitativa')),
  unidade       text not null default 'un' check (unidade in ('un', '%', 'R$', 'pts')),
  definicao     jsonb not null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table trackco.planos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  descricao     text,
  equipe_id     uuid not null references trackco.equipes (id) on delete cascade,
  modalidade    text not null default 'reconhecimento'
                check (modalidade in ('reconhecimento', 'premio', 'dinheiro', 'pontos', 'misto')),
  status        text not null default 'rascunho' check (status in ('rascunho', 'ativo', 'arquivado')),
  -- definição em edição (vira uma versão imutável ao publicar)
  rascunho      jsonb not null default '{"indicadores":[],"faixas":[],"condicoes":[]}'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index planos_equipe on trackco.planos (equipe_id);
-- um plano ativo por equipe
create unique index planos_ativo_un on trackco.planos (equipe_id) where status = 'ativo';

create table trackco.plano_versoes (
  id            uuid primary key default gen_random_uuid(),
  plano_id      uuid not null references trackco.planos (id) on delete cascade,
  numero        int not null,
  definicao     jsonb not null,
  -- primeira competência (mês) em que esta versão vale
  vigente_desde date not null check (extract(day from vigente_desde) = 1),
  observacao    text,
  publicado_por uuid,
  publicado_em  timestamptz not null default now(),
  unique (plano_id, numero)
);

create table trackco.metas (
  id             uuid primary key default gen_random_uuid(),
  metrica_id     uuid not null references trackco.metricas (id) on delete cascade,
  competencia    date not null check (extract(day from competencia) = 1),
  colaborador_id uuid references trackco.colaboradores (id) on delete cascade,
  equipe_id      uuid references trackco.equipes (id) on delete cascade,
  valor          numeric not null check (valor >= 0),
  criado_por     uuid,
  atualizado_em  timestamptz not null default now(),
  check (num_nonnulls(colaborador_id, equipe_id) = 1),
  unique nulls not distinct (metrica_id, competencia, colaborador_id, equipe_id)
);
create index metas_comp on trackco.metas (competencia);

create table trackco.fechamentos (
  id                uuid primary key default gen_random_uuid(),
  equipe_id         uuid not null references trackco.equipes (id) on delete cascade,
  competencia       date not null check (extract(day from competencia) = 1),
  status            text not null default 'aberto' check (status in (
                      'aberto', 'calculado', 'em_contestacao', 'conferencia_lider',
                      'aprovacao_admin', 'aprovado', 'entregue')),
  prazo_contestacao date,
  calculado_em      timestamptz,
  log               jsonb not null default '[]'::jsonb,
  criado_em         timestamptz not null default now(),
  unique (equipe_id, competencia)
);

create table trackco.apuracoes (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('parcial', 'final')),
  fechamento_id   uuid references trackco.fechamentos (id) on delete cascade,
  equipe_id       uuid not null references trackco.equipes (id) on delete cascade,
  colaborador_id  uuid not null references trackco.colaboradores (id) on delete cascade,
  competencia     date not null,
  funcao          text not null,
  plano_versao_id uuid references trackco.plano_versoes (id) on delete set null,
  nota            numeric,
  nivel           text,
  resultado       jsonb not null,
  calculado_em    timestamptz not null default now(),
  unique (tipo, equipe_id, colaborador_id, competencia)
);
create index apuracoes_comp on trackco.apuracoes (competencia, equipe_id);

-- memorial: cada número aponta para as linhas de origem
create table trackco.apuracao_itens (
  apuracao_id uuid not null references trackco.apuracoes (id) on delete cascade,
  metrica_id  uuid not null,
  origem      text not null default 'klingo_agendamentos',
  origem_chave text not null,
  papel       text not null default 'realizado' check (papel in ('realizado', 'numerador', 'denominador'))
);
create index apuracao_itens_ap on trackco.apuracao_itens (apuracao_id, metrica_id);

create table trackco.ajustes (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  competencia    date not null check (extract(day from competencia) = 1),
  metrica_id     uuid not null references trackco.metricas (id) on delete cascade,
  delta          numeric not null check (delta <> 0),
  justificativa  text not null check (length(trim(justificativa)) >= 5),
  origem_chave   text,
  contestacao_id uuid,
  criado_por     uuid,
  criado_em      timestamptz not null default now()
);
create index ajustes_comp on trackco.ajustes (competencia, colaborador_id);

create table trackco.contestacoes (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  competencia    date not null check (extract(day from competencia) = 1),
  metrica_id     uuid references trackco.metricas (id) on delete set null,
  origem_chave   text,
  descricao      text not null check (length(trim(descricao)) >= 5),
  status         text not null default 'aberta' check (status in ('aberta', 'em_analise', 'aceita', 'recusada')),
  resposta       text,
  respondido_por uuid,
  respondido_em  timestamptz,
  criado_em      timestamptz not null default now()
);
create index contestacoes_comp on trackco.contestacoes (competencia, status);

alter table trackco.ajustes
  add constraint ajustes_contestacao_fk foreign key (contestacao_id) references trackco.contestacoes (id) on delete set null;

create table trackco.auditoria (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id text,
  acao        text not null,
  antes       jsonb,
  depois      jsonb,
  por         uuid,
  em          timestamptz not null default now()
);
create index auditoria_em on trackco.auditoria (em desc);
create index auditoria_tabela on trackco.auditoria (tabela, registro_id);

-- Modo TV: link público sem login. Só o hash do token fica no banco.
create table trackco.paineis_tv (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  token_hash    text not null unique,
  equipes       uuid[] not null default '{}',
  config        jsonb not null default '{}'::jsonb,
  ativo         boolean not null default true,
  criado_por    uuid,
  criado_em     timestamptz not null default now(),
  ultimo_acesso timestamptz
);

-- ---------------------------------------------------------------------------
-- Fases 2 e 3 (prêmios, R$, pontos). Tabelas prontas; telas virão depois.
-- ---------------------------------------------------------------------------
create table trackco.catalogo_premios (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text,
  tipo         text not null default 'produto' check (tipo in ('produto', 'folga', 'dinheiro', 'experiencia')),
  custo_pontos int check (custo_pontos is null or custo_pontos > 0),
  estoque      int,
  imagem_url   text,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

create table trackco.premios_concedidos (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  apuracao_id    uuid references trackco.apuracoes (id) on delete set null,
  premio_id      uuid references trackco.catalogo_premios (id) on delete set null,
  descricao      text not null,
  valor          numeric(12, 2),
  status         text not null default 'pendente' check (status in ('pendente', 'entregue', 'cancelado')),
  entregue_em    timestamptz,
  criado_em      timestamptz not null default now()
);

create table trackco.pontos_extrato (
  id             bigint generated always as identity primary key,
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  data           date not null default current_date,
  pontos         int not null check (pontos <> 0),
  origem         text not null check (origem in ('apuracao', 'resgate', 'ajuste', 'expiracao')),
  apuracao_id    uuid references trackco.apuracoes (id) on delete set null,
  resgate_id     uuid,
  descricao      text,
  criado_em      timestamptz not null default now()
);
create index pontos_extrato_colab on trackco.pontos_extrato (colaborador_id, data);

create table trackco.resgates (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  premio_id      uuid not null references trackco.catalogo_premios (id),
  pontos         int not null check (pontos > 0),
  status         text not null default 'solicitado' check (status in ('solicitado', 'aprovado', 'entregue', 'recusado')),
  observacao     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
