-- =====================================================================
-- Trackco · TODAS as migrations num arquivo só, para colar no SQL Editor do Supabase.
-- Gerado por scripts/combinar-sql.mjs a partir de supabase/migrations/ (não edite aqui).
-- Roda numa transação: se algo falhar, nada é aplicado.
-- Só cria o schema "trackco"; não altera nada do sistema relatorio.
-- =====================================================================
begin;

-- >>>>>>>>>> 20261110000001_trackco_schema.sql
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

-- >>>>>>>>>> 20261110000002_trackco_rls.sql
-- Trackco · funções auxiliares, RLS, auditoria e ranking
-- Regra geral: colaborador vê o que é dele; líder vê a equipe que lidera; admin/gestor vê tudo.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer para não recursar nas policies)
-- ---------------------------------------------------------------------------
create or replace function trackco.meu_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo
$$;

create or replace function trackco.meu_papel() returns text
language sql stable security definer set search_path = '' as $$
  select c.papel from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo
$$;

create or replace function trackco.e_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.papel = 'admin' from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo), false)
$$;

-- admin ou gestor (gestor vê tudo, mas não configura)
create or replace function trackco.e_gestor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.papel in ('admin', 'gestor') from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo), false)
$$;

create or replace function trackco.lidero(p_equipe uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from trackco.equipe_membros m
    join trackco.colaboradores c on c.id = m.colaborador_id
    where c.auth_id = auth.uid() and c.ativo and m.equipe_id = p_equipe and m.funcao = 'lider'
      and (m.fim is null or m.fim >= current_date)
  )
$$;

-- o usuário atual lidera alguma equipe da qual p_colab é membro (vínculo vigente)?
create or replace function trackco.lidero_colaborador(p_colab uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from trackco.equipe_membros eu
    join trackco.colaboradores c on c.id = eu.colaborador_id
    join trackco.equipe_membros ele on ele.equipe_id = eu.equipe_id
    where c.auth_id = auth.uid() and c.ativo and eu.funcao = 'lider'
      and (eu.fim is null or eu.fim >= current_date)
      and ele.colaborador_id = p_colab
  )
$$;

create or replace function trackco.posso_ver(p_colab uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_colab = trackco.meu_id() or trackco.e_gestor() or trackco.lidero_colaborador(p_colab)
$$;

-- logins do Klingo cujas linhas o usuário pode ver (o próprio + equipe que lidera)
create or replace function trackco.logins_visiveis() returns setof text
language sql stable security definer set search_path = '' as $$
  select lower(c.login_klingo) from trackco.colaboradores c
  where c.login_klingo is not null and (c.id = trackco.meu_id() or trackco.lidero_colaborador(c.id))
$$;

create or replace function trackco.membro_da_equipe(p_equipe uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from trackco.equipe_membros m
    join trackco.colaboradores c on c.id = m.colaborador_id
    where c.auth_id = auth.uid() and c.ativo and m.equipe_id = p_equipe
      and (m.fim is null or m.fim >= current_date)
  )
$$;

-- ---------------------------------------------------------------------------
-- atualizado_em + auditoria
-- ---------------------------------------------------------------------------
create or replace function trackco.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger colaboradores_tocar before update on trackco.colaboradores for each row execute function trackco.tocar_atualizado_em();
create trigger metricas_tocar before update on trackco.metricas for each row execute function trackco.tocar_atualizado_em();
create trigger planos_tocar before update on trackco.planos for each row execute function trackco.tocar_atualizado_em();
create trigger metas_tocar before update on trackco.metas for each row execute function trackco.tocar_atualizado_em();

create or replace function trackco.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_antes - 'atualizado_em' = v_depois - 'atualizado_em' then
    return new;
  end if;
  insert into trackco.auditoria (tabela, registro_id, acao, antes, depois, por)
  values (tg_table_name, coalesce(v_depois ->> 'id', v_antes ->> 'id'), lower(tg_op), v_antes, v_depois, auth.uid());
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'colaboradores', 'equipes', 'equipe_membros', 'ausencias', 'feriados', 'lancamentos', 'metricas',
    'planos', 'plano_versoes', 'metas', 'fechamentos', 'ajustes', 'contestacoes', 'paineis_tv',
    'catalogo_premios', 'premios_concedidos', 'resgates'
  ] loop
    execute format('create trigger %I after insert or update or delete on trackco.%I for each row execute function trackco.auditar()',
                   t || '_auditoria', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Privilégios: authenticated passa por RLS; anon não acessa nada (o modo TV usa o servidor).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema trackco from anon, public;
grant select, insert, update, delete on all tables in schema trackco to authenticated;
grant all on all tables in schema trackco to service_role;
grant usage, select on all sequences in schema trackco to authenticated, service_role;
alter default privileges in schema trackco grant all on tables to service_role;
alter default privileges in schema trackco grant usage, select on sequences to service_role;

-- valor em R$ das consultas: só pelo servidor (admin). Demais colunas liberadas por RLS.
revoke select, insert, update, delete on trackco.klingo_agendamentos from authenticated;
grant select (chave, data_agendado_em, data_agendado_para, data_realizacao, responsavel_login, paciente_nome,
              procedimento, profissional, operadora, qtd, atendido, sincronizado_em)
  on trackco.klingo_agendamentos to authenticated;

-- dados de sincronização e cálculo só são gravados pelo servidor (service_role)
revoke insert, update, delete on trackco.klingo_usuarios, trackco.sync_execucoes, trackco.apuracoes,
  trackco.apuracao_itens, trackco.auditoria from authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'trackco' loop
    execute format('alter table trackco.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- colaboradores
create policy colab_ler on trackco.colaboradores for select to authenticated
  using (trackco.posso_ver(id));
create policy colab_admin on trackco.colaboradores for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- equipes e vínculos: leitura para todos os logados (nomes de equipes não são sensíveis)
create policy equipes_ler on trackco.equipes for select to authenticated using (true);
create policy equipes_admin on trackco.equipes for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

create policy membros_ler on trackco.equipe_membros for select to authenticated
  using (trackco.e_gestor() or trackco.membro_da_equipe(equipe_id) or colaborador_id = trackco.meu_id());
create policy membros_admin on trackco.equipe_membros for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- ausências: admin ou líder do colaborador lançam
create policy ausencias_ler on trackco.ausencias for select to authenticated
  using (trackco.posso_ver(colaborador_id));
create policy ausencias_gravar on trackco.ausencias for all to authenticated
  using (trackco.e_admin() or trackco.lidero_colaborador(colaborador_id))
  with check (trackco.e_admin() or trackco.lidero_colaborador(colaborador_id));

create policy feriados_ler on trackco.feriados for select to authenticated using (true);
create policy feriados_admin on trackco.feriados for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- linhas do Klingo
create policy klingo_ler on trackco.klingo_agendamentos for select to authenticated
  using (trackco.e_gestor() or lower(responsavel_login) in (select trackco.logins_visiveis()));

create policy klingo_usuarios_ler on trackco.klingo_usuarios for select to authenticated
  using (trackco.e_gestor());

-- lançamentos manuais (ex.: avaliação qualitativa do líder)
create policy lancamentos_ler on trackco.lancamentos for select to authenticated
  using (trackco.posso_ver(colaborador_id));
create policy lancamentos_gravar on trackco.lancamentos for all to authenticated
  using (trackco.e_admin() or trackco.lidero_colaborador(colaborador_id))
  with check (trackco.e_admin() or (trackco.lidero_colaborador(colaborador_id) and colaborador_id <> trackco.meu_id()));

create policy sync_ler on trackco.sync_execucoes for select to authenticated using (true);

-- regras: transparentes para todos os logados (quem recebe pode ver como é calculado)
create policy metricas_ler on trackco.metricas for select to authenticated using (true);
create policy metricas_admin on trackco.metricas for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());
create policy planos_ler on trackco.planos for select to authenticated using (true);
create policy planos_admin on trackco.planos for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());
create policy versoes_ler on trackco.plano_versoes for select to authenticated using (true);
create policy versoes_admin on trackco.plano_versoes for insert to authenticated
  with check (trackco.e_admin());

-- metas
create policy metas_ler on trackco.metas for select to authenticated
  using (
    (colaborador_id is not null and trackco.posso_ver(colaborador_id))
    or (equipe_id is not null and (trackco.e_gestor() or trackco.membro_da_equipe(equipe_id)))
  );
create policy metas_admin on trackco.metas for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- fechamentos: todos leem o status; transições validadas no servidor
create policy fechamentos_ler on trackco.fechamentos for select to authenticated
  using (trackco.e_gestor() or trackco.membro_da_equipe(equipe_id));
create policy fechamentos_admin on trackco.fechamentos for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- apurações (gravadas pelo servidor)
create policy apuracoes_ler on trackco.apuracoes for select to authenticated
  using (trackco.posso_ver(colaborador_id));
create policy itens_ler on trackco.apuracao_itens for select to authenticated
  using (exists (select 1 from trackco.apuracoes a where a.id = apuracao_id and trackco.posso_ver(a.colaborador_id)));

-- ajustes
create policy ajustes_ler on trackco.ajustes for select to authenticated
  using (trackco.posso_ver(colaborador_id));
create policy ajustes_admin on trackco.ajustes for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- contestações: o próprio colaborador abre; líder/admin respondem
create policy contest_ler on trackco.contestacoes for select to authenticated
  using (trackco.posso_ver(colaborador_id));
create policy contest_abrir on trackco.contestacoes for insert to authenticated
  with check (colaborador_id = trackco.meu_id() and status = 'aberta');
create policy contest_responder on trackco.contestacoes for update to authenticated
  using (trackco.e_admin() or trackco.lidero_colaborador(colaborador_id))
  with check (trackco.e_admin() or trackco.lidero_colaborador(colaborador_id));

create policy auditoria_ler on trackco.auditoria for select to authenticated using (trackco.e_admin());

create policy paineis_admin on trackco.paineis_tv for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- fases 2/3
create policy catalogo_ler on trackco.catalogo_premios for select to authenticated using (true);
create policy catalogo_admin on trackco.catalogo_premios for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());
create policy premios_ler on trackco.premios_concedidos for select to authenticated using (trackco.posso_ver(colaborador_id));
create policy premios_admin on trackco.premios_concedidos for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());
create policy pontos_ler on trackco.pontos_extrato for select to authenticated using (trackco.posso_ver(colaborador_id));
create policy pontos_admin on trackco.pontos_extrato for all to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());
create policy resgates_ler on trackco.resgates for select to authenticated using (trackco.posso_ver(colaborador_id));
create policy resgates_pedir on trackco.resgates for insert to authenticated
  with check (colaborador_id = trackco.meu_id() and status = 'solicitado');
create policy resgates_admin on trackco.resgates for update to authenticated
  using (trackco.e_admin()) with check (trackco.e_admin());

-- ---------------------------------------------------------------------------
-- Ranking com a visibilidade configurada na equipe
--   aberto   -> nomes e números para todos da equipe
--   posicoes -> nomes, posição e nível; números só do próprio
--   privado  -> só a própria linha
-- Líder da equipe, gestor e admin sempre veem tudo.
-- ---------------------------------------------------------------------------
create or replace function trackco.ranking_equipe(p_equipe uuid, p_competencia date)
returns table (posicao int, colaborador_id uuid, nome text, eu boolean, funcao text, nota numeric, nivel text, resultado jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_vis text;
  v_eu uuid := trackco.meu_id();
  v_total boolean := trackco.e_gestor() or trackco.lidero(p_equipe);
begin
  if not v_total and not trackco.membro_da_equipe(p_equipe) then
    return;
  end if;
  select e.visibilidade_ranking into v_vis from trackco.equipes e where e.id = p_equipe;

  return query
  with base as (
    select a.colaborador_id, c.nome, a.funcao, a.nota, a.nivel, a.resultado,
           rank() over (order by a.nota desc nulls last)::int as pos
    from trackco.apuracoes a
    join trackco.colaboradores c on c.id = a.colaborador_id
    where a.equipe_id = p_equipe and a.competencia = p_competencia and a.tipo = 'parcial' and a.funcao = 'membro'
  )
  select b.pos,
         case when v_total or v_vis <> 'privado' or b.colaborador_id = v_eu then b.colaborador_id end,
         case when v_total or v_vis <> 'privado' or b.colaborador_id = v_eu then b.nome end,
         b.colaborador_id = v_eu,
         b.funcao,
         case when v_total or v_vis = 'aberto' or b.colaborador_id = v_eu then b.nota end,
         case when v_total or v_vis <> 'privado' or b.colaborador_id = v_eu then b.nivel end,
         case when v_total or v_vis = 'aberto' or b.colaborador_id = v_eu then b.resultado - 'memorial' end
  from base b
  where v_total or v_vis <> 'privado' or b.colaborador_id = v_eu
  order by b.pos;
end $$;

revoke all on function trackco.ranking_equipe(uuid, date) from public, anon;
grant execute on function trackco.ranking_equipe(uuid, date) to authenticated;

-- >>>>>>>>>> 20261110000003_trackco_klingo_sync.sql
-- Trackco · funções usadas pelo robô do Klingo (somente service_role)

-- Substitui as marcações de um mês (por data_agendado_em) pelo retrato atual do relatório 2331.
-- Linhas que sumiram do Klingo (canceladas/excluídas) são removidas; o resultado do cruzamento
-- (atendido/valor/data_realizacao) é preservado nas linhas que continuam iguais.
create or replace function trackco.klingo_sincronizar_mes(p_mes date, p_linhas jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_upsert int;
  v_removidas int;
begin
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    -- mês vazio nunca apaga o que já existe (protege contra falha silenciosa do Klingo)
    return jsonb_build_object('mes', v_ini, 'upsert', 0, 'removidas', 0, 'ignorado', true);
  end if;

  drop table if exists pg_temp._novas;
  create temporary table _novas on commit drop as
  select * from jsonb_to_recordset(p_linhas) as x(
    chave text, data_agendado_em date, data_agendado_para date, responsavel_login text, paciente_nome text,
    procedimento text, profissional text, operadora text, qtd numeric);

  if exists (select 1 from _novas where data_agendado_em < v_ini or data_agendado_em > v_fim) then
    raise exception 'linhas fora do mês %', to_char(v_ini, 'YYYY-MM');
  end if;

  insert into trackco.klingo_agendamentos as k
    (chave, data_agendado_em, data_agendado_para, responsavel_login, paciente_nome, procedimento, profissional, operadora, qtd, sincronizado_em)
  select chave, data_agendado_em, data_agendado_para, lower(nullif(trim(responsavel_login), '')), paciente_nome,
         procedimento, profissional, operadora, coalesce(qtd, 1), now()
  from _novas
  on conflict (chave) do update set
    data_agendado_para = excluded.data_agendado_para,
    responsavel_login  = excluded.responsavel_login,
    paciente_nome      = excluded.paciente_nome,
    procedimento       = excluded.procedimento,
    profissional       = excluded.profissional,
    operadora          = excluded.operadora,
    qtd                = excluded.qtd,
    sincronizado_em    = now();
  get diagnostics v_upsert = row_count;

  delete from trackco.klingo_agendamentos k
  where k.data_agendado_em between v_ini and v_fim
    and not exists (select 1 from _novas n where n.chave = k.chave);
  get diagnostics v_removidas = row_count;

  return jsonb_build_object('mes', v_ini, 'upsert', v_upsert, 'removidas', v_removidas);
end $$;

-- Marcações com consulta marcada num mês: o robô usa para cruzar com a produção (319).
create or replace function trackco.klingo_marcacoes_para(p_mes date)
returns table (chave text, data_agendado_em date, data_agendado_para date, responsavel_login text,
               paciente_nome text, procedimento text, profissional text, qtd numeric, operadora text)
language sql stable security definer set search_path = '' as $$
  select k.chave, k.data_agendado_em, k.data_agendado_para, k.responsavel_login, k.paciente_nome,
         k.procedimento, k.profissional, k.qtd, k.operadora
  from trackco.klingo_agendamentos k
  where k.data_agendado_para >= date_trunc('month', p_mes)::date
    and k.data_agendado_para < (date_trunc('month', p_mes) + interval '1 month')::date
  order by k.data_agendado_para, k.data_agendado_em, k.chave
$$;

-- Grava o resultado do cruzamento 2331 x 319.
create or replace function trackco.klingo_marcar_atendidos(p_linhas jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  update trackco.klingo_agendamentos k set
    atendido        = x.atendido,
    valor           = x.valor,
    data_realizacao = case when x.atendido then coalesce(x.data_realizacao, k.data_agendado_para) end
  from jsonb_to_recordset(p_linhas) as x(chave text, atendido boolean, valor numeric, data_realizacao date)
  where k.chave = x.chave
    and (k.atendido is distinct from x.atendido or k.valor is distinct from x.valor
         or k.data_realizacao is distinct from case when x.atendido then coalesce(x.data_realizacao, k.data_agendado_para) end);
  get diagnostics v = row_count;
  return v;
end $$;

revoke all on function trackco.klingo_sincronizar_mes(date, jsonb) from public, anon, authenticated;
revoke all on function trackco.klingo_marcacoes_para(date) from public, anon, authenticated;
revoke all on function trackco.klingo_marcar_atendidos(jsonb) from public, anon, authenticated;
grant execute on function trackco.klingo_sincronizar_mes(date, jsonb) to service_role;
grant execute on function trackco.klingo_marcacoes_para(date) to service_role;
grant execute on function trackco.klingo_marcar_atendidos(jsonb) to service_role;

-- >>>>>>>>>> 20261110000004_trackco_seed.sql
-- Trackco · configuração inicial (piloto Comercial em modo Reconhecimento)
-- Tudo aqui pode ser alterado depois pelas telas do sistema.

-- Feriados (nacionais + Bahia + Salvador). Pontos facultativos ficam de fora; o admin pode incluir.
insert into trackco.feriados (data, descricao) values
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-24', 'São João (Salvador)'),
  ('2026-07-02', 'Independência da Bahia'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Dia da Consciência Negra'),
  ('2026-12-08', 'Nossa Senhora da Conceição da Praia (Salvador)'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternização Universal'),
  ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-21', 'Tiradentes'),
  ('2027-05-01', 'Dia do Trabalho'),
  ('2027-06-24', 'São João (Salvador)'),
  ('2027-07-02', 'Independência da Bahia'),
  ('2027-09-07', 'Independência do Brasil'),
  ('2027-10-12', 'Nossa Senhora Aparecida'),
  ('2027-11-02', 'Finados'),
  ('2027-11-15', 'Proclamação da República'),
  ('2027-11-20', 'Dia da Consciência Negra'),
  ('2027-12-08', 'Nossa Senhora da Conceição da Praia (Salvador)'),
  ('2027-12-25', 'Natal')
on conflict (data) do nothing;

-- Equipe piloto
insert into trackco.equipes (nome, descricao, visibilidade_ranking)
values ('Comercial', 'Atendentes que agendam consultas (piloto do Trackco).', 'posicoes')
on conflict (nome) do nothing;

-- Métricas padrão (Q7: quantitativo pela data do agendamento; qualitativo pela data de realização)
insert into trackco.metricas (codigo, nome, descricao, tipo, unidade, definicao) values
(
  'agendamentos', 'Agendamentos',
  'Quantas consultas Particular o atendente agendou, contadas no dia em que o agendamento foi feito.',
  'quantitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_em",
    "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"}]}'
),
(
  'realizadas', 'Consultas realizadas',
  'Quantas consultas Particular agendadas pelo atendente de fato aconteceram, contadas no dia em que aconteceram (mesmo que tenham sido agendadas em outro mês).',
  'qualitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_realizacao",
    "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"},{"campo":"atendido","op":"verdadeiro"}]}'
),
(
  'conversao', 'Taxa de conversão',
  'Das consultas Particular marcadas para o mês (até ontem), quantas % aconteceram.',
  'qualitativa', '%',
  '{"tipo_calculo":"taxa","corte":"ontem",
    "numerador":{"fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para",
                 "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"},{"campo":"atendido","op":"verdadeiro"}]},
    "denominador":{"fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para",
                   "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"}]}}'
),
(
  'agendamentos_sus', 'Agendamentos SUS',
  'Agendamentos da operadora SUS, pela data do agendamento.',
  'quantitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_em",
    "filtros":[{"campo":"operadora","op":"contem","valor":"SUS"}]}'
),
(
  'realizadas_sus', 'Realizadas SUS',
  'Consultas SUS agendadas pelo atendente que aconteceram, pela data de realização.',
  'qualitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_realizacao",
    "filtros":[{"campo":"operadora","op":"contem","valor":"SUS"},{"campo":"atendido","op":"verdadeiro"}]}'
),
(
  'avaliacao_lider', 'Avaliação qualitativa do líder',
  'Nota lançada manualmente pelo admin (0 a 10) sobre a liderança no mês.',
  'qualitativa', 'pts',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"lancamentos","agregacao":"somar","campo_data":"data","campo_valor":"valor",
    "filtros":[{"campo":"tipo","op":"igual","valor":"avaliacao_lider"}]}'
)
on conflict (codigo) do nothing;

-- Plano de Reconhecimento da equipe Comercial (versão 1 publicada, vigente desde jan/2026 para permitir conferir meses passados)
do $$
declare
  v_equipe uuid;
  v_plano uuid;
  v_ag uuid;
  v_re uuid;
  v_cv uuid;
  v_def jsonb;
begin
  select id into v_equipe from trackco.equipes where nome = 'Comercial';
  select id into v_ag from trackco.metricas where codigo = 'agendamentos';
  select id into v_re from trackco.metricas where codigo = 'realizadas';
  select id into v_cv from trackco.metricas where codigo = 'conversao';

  if exists (select 1 from trackco.planos where equipe_id = v_equipe) then
    return;
  end if;

  v_def := jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('id', 'ind-agendamentos', 'metrica_id', v_ag, 'escopo', 'individual', 'aplica_a', 'membros',
                         'peso', 50, 'teto_pct', 150, 'meta_proporcional', true),
      jsonb_build_object('id', 'ind-realizadas', 'metrica_id', v_re, 'escopo', 'individual', 'aplica_a', 'membros',
                         'peso', 50, 'teto_pct', 150, 'meta_proporcional', true),
      jsonb_build_object('id', 'ind-conversao', 'metrica_id', v_cv, 'escopo', 'individual', 'aplica_a', 'membros',
                         'peso', 0, 'teto_pct', 150, 'meta_proporcional', false),
      jsonb_build_object('id', 'ind-eq-agendamentos', 'nome', 'Agendamentos da equipe', 'metrica_id', v_ag, 'escopo', 'equipe',
                         'aplica_a', 'lider', 'peso', 50, 'teto_pct', 150, 'meta_proporcional', true, 'incluir_lider', false),
      jsonb_build_object('id', 'ind-eq-realizadas', 'nome', 'Realizadas da equipe', 'metrica_id', v_re, 'escopo', 'equipe',
                         'aplica_a', 'lider', 'peso', 50, 'teto_pct', 150, 'meta_proporcional', true, 'incluir_lider', false)
    ),
    'faixas', jsonb_build_array(
      jsonb_build_object('id', 'fx-dev', 'de_pct', 0, 'ate_pct', 80, 'nivel', 'Em desenvolvimento', 'cor', '#64748b'),
      jsonb_build_object('id', 'fx-quase', 'de_pct', 80, 'ate_pct', 100, 'nivel', 'Quase lá', 'cor', '#0ea5e9'),
      jsonb_build_object('id', 'fx-meta', 'de_pct', 100, 'ate_pct', 120, 'nivel', 'Meta batida', 'cor', '#16a34a',
                         'recompensa', jsonb_build_object('tipo', 'reconhecimento', 'descricao', 'Selo Meta batida')),
      jsonb_build_object('id', 'fx-destaque', 'de_pct', 120, 'ate_pct', null, 'nivel', 'Destaque', 'cor', '#f59e0b',
                         'recompensa', jsonb_build_object('tipo', 'reconhecimento', 'descricao', 'Destaque do mês'))
    ),
    'condicoes', '[]'::jsonb
  );

  insert into trackco.planos (nome, descricao, equipe_id, modalidade, status, rascunho)
  values ('Comercial · Reconhecimento',
          'Fase de reconhecimento (2 primeiros meses): acompanhar e validar os dados, sem prêmios.',
          v_equipe, 'reconhecimento', 'ativo', v_def)
  returning id into v_plano;

  insert into trackco.plano_versoes (plano_id, numero, definicao, vigente_desde, observacao)
  values (v_plano, 1, v_def, '2026-01-01', 'Versão inicial do piloto.');
end $$;

-- Colaboradores: importa do relatorio (public.usuarios) a equipe Comercial e os admins.
-- O admin confirma no app quem é o líder. Ninguém mais é importado automaticamente.
do $$
declare v_equipe uuid;
begin
  if to_regclass('public.usuarios') is null then
    raise notice 'public.usuarios não existe; nenhum colaborador importado.';
    return;
  end if;
  select id into v_equipe from trackco.equipes where nome = 'Comercial';

  insert into trackco.colaboradores (auth_id, nome, login, login_klingo, papel, ativo)
  select u.auth_id, u.nome, u.login_site, nullif(u.login_klingo, ''),
         case when u.papel = 'admin' then 'admin' else 'colaborador' end, u.ativo
  from public.usuarios u
  where u.equipe = 'Comercial' or u.papel = 'admin'
  on conflict do nothing;

  insert into trackco.equipe_membros (equipe_id, colaborador_id, funcao, inicio)
  select v_equipe, c.id, 'membro', '2026-01-01'
  from trackco.colaboradores c
  join public.usuarios u on lower(u.login_klingo) = lower(c.login_klingo)
  where u.equipe = 'Comercial'
  on conflict do nothing;
end $$;

-- >>>>>>>>>> 20261110000005_trackco_metas_rpc.sql
-- Trackco · gravação atômica da grade de metas de uma equipe/mês (roda como o usuário: RLS vale, só admin grava)
create or replace function trackco.salvar_metas(p_equipe uuid, p_competencia date, p_metricas uuid[], p_linhas jsonb)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_comp date := date_trunc('month', p_competencia)::date;
  v_membros uuid[];
  v_n int;
begin
  if not trackco.e_admin() then
    raise exception 'apenas administradores definem metas';
  end if;

  select coalesce(array_agg(distinct m.colaborador_id), '{}') into v_membros
  from trackco.equipe_membros m
  where m.equipe_id = p_equipe
    and m.inicio <= (v_comp + interval '1 month - 1 day')::date
    and (m.fim is null or m.fim >= v_comp);

  delete from trackco.metas t
  where t.competencia = v_comp
    and t.metrica_id = any (p_metricas)
    and (t.equipe_id = p_equipe or t.colaborador_id = any (v_membros));

  insert into trackco.metas (metrica_id, competencia, colaborador_id, equipe_id, valor, criado_por)
  select x.metrica_id, v_comp,
         case when x.colaborador_id = any (v_membros) then x.colaborador_id end,
         case when x.colaborador_id is null then p_equipe end,
         x.valor, trackco.meu_id()
  from jsonb_to_recordset(p_linhas) as x(metrica_id uuid, colaborador_id uuid, valor numeric)
  where x.valor is not null and x.metrica_id = any (p_metricas)
    and (x.colaborador_id is null or x.colaborador_id = any (v_membros));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function trackco.salvar_metas(uuid, date, uuid[], jsonb) from public, anon;
grant execute on function trackco.salvar_metas(uuid, date, uuid[], jsonb) to authenticated;

-- >>>>>>>>>> 20261110000006_trackco_logins_sem_vinculo.sql
-- Trackco · logins do Klingo que aparecem nos agendamentos mas não estão ligados a nenhum colaborador
create or replace function trackco.logins_klingo_sem_vinculo(p_desde date)
returns table (login text, nome text, agendamentos bigint, ultimo date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not trackco.e_admin() then
    raise exception 'apenas administradores';
  end if;
  return query
  select k.responsavel_login, ku.nome, count(*)::bigint, max(k.data_agendado_em)
  from trackco.klingo_agendamentos k
  left join trackco.klingo_usuarios ku on ku.login = k.responsavel_login
  where k.data_agendado_em >= p_desde
    and k.responsavel_login is not null
    and not exists (select 1 from trackco.colaboradores c where lower(c.login_klingo) = k.responsavel_login)
  group by k.responsavel_login, ku.nome
  order by count(*) desc;
end $$;

revoke all on function trackco.logins_klingo_sem_vinculo(date) from public, anon;
grant execute on function trackco.logins_klingo_sem_vinculo(date) to authenticated;

-- >>>>>>>>>> 20261111000007_trackco_sus_somente_analise.sql
-- Trackco · SUS é só para análise e visualização: nunca entra em metas, nota, prêmios, comissão ou pontos.
update trackco.metricas
set definicao = definicao || '{"somente_analise": true}'::jsonb
where codigo in ('agendamentos_sus', 'realizadas_sus');

-- >>>>>>>>>> 20261111000008_trackco_historico_2025.sql
-- Trackco · histórico desde jan/2025: feriados de 2025 e versão inicial do plano valendo desde jan/2025
insert into trackco.feriados (data, descricao) values
  ('2025-01-01', 'Confraternização Universal'),
  ('2025-04-18', 'Sexta-feira Santa'),
  ('2025-04-21', 'Tiradentes'),
  ('2025-05-01', 'Dia do Trabalho'),
  ('2025-06-24', 'São João (Salvador)'),
  ('2025-07-02', 'Independência da Bahia'),
  ('2025-09-07', 'Independência do Brasil'),
  ('2025-10-12', 'Nossa Senhora Aparecida'),
  ('2025-11-02', 'Finados'),
  ('2025-11-15', 'Proclamação da República'),
  ('2025-11-20', 'Dia da Consciência Negra'),
  ('2025-12-08', 'Nossa Senhora da Conceição da Praia (Salvador)'),
  ('2025-12-25', 'Natal')
on conflict (data) do nothing;

update trackco.plano_versoes v set vigente_desde = '2025-01-01'
from trackco.planos p
where p.id = v.plano_id and p.nome = 'Comercial · Reconhecimento' and v.numero = 1 and v.vigente_desde = '2026-01-01';

-- >>>>>>>>>> 20261111000009_trackco_situacao_marcacoes.sql
-- Trackco · por que a consulta não aconteceu (relatórios 47 e 8440 do Klingo)
-- situacao: realizada | falta | falta_remarcada | remarcada | cancelada | erro | bloqueio_clinica | nao_realizada
-- (null = ainda não verificada: consulta futura ou dia corrente)
alter table trackco.klingo_agendamentos
  add column if not exists situacao text
    check (situacao in ('realizada', 'falta', 'falta_remarcada', 'remarcada', 'cancelada', 'erro', 'bloqueio_clinica', 'nao_realizada')),
  add column if not exists motivo text;
create index if not exists klingo_ag_situacao on trackco.klingo_agendamentos (situacao);

grant select (situacao, motivo) on trackco.klingo_agendamentos to authenticated;

-- Grava a situação calculada pelo robô (somente service_role).
create or replace function trackco.klingo_marcar_situacao(p_linhas jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  update trackco.klingo_agendamentos k set situacao = x.situacao, motivo = x.motivo
  from jsonb_to_recordset(p_linhas) as x(chave text, situacao text, motivo text)
  where k.chave = x.chave
    and (k.situacao is distinct from x.situacao or k.motivo is distinct from x.motivo);
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function trackco.klingo_marcar_situacao(jsonb) from public, anon, authenticated;
grant execute on function trackco.klingo_marcar_situacao(jsonb) to service_role;

-- Conversão justa: remarcações, faltas que viraram remarcação, bloqueios da clínica e erros de cadastro
-- saem da base (denominador). Faltas, cancelamentos por outros motivos e não comparecimentos continuam contando.
update trackco.metricas
set definicao = jsonb_set(
      definicao, '{denominador,filtros}',
      (definicao #> '{denominador,filtros}') || '[{"campo":"situacao","op":"nao_em","valor":["remarcada","falta_remarcada","bloqueio_clinica","erro"]}]'::jsonb),
    descricao = 'Das consultas Particular marcadas para o mês (até ontem), quantas % aconteceram. Remarcações, bloqueios da clínica e erros de cadastro não entram na conta.'
where codigo = 'conversao'
  and not (definicao #> '{denominador,filtros}') @> '[{"campo":"situacao"}]'::jsonb;

-- >>>>>>>>>> 20261112000010_trackco_desempenho.sql
-- Trackco · desempenho com o histórico grande (257 mil marcações)
-- 1) índices compostos login + data: cada consulta lê só as linhas da equipe no período
-- 2) RLS sem função por linha: as funções viram subconsultas avaliadas UMA vez por consulta
--    (padrão recomendado pelo Supabase: "(select fn())" em vez de "fn()")

create index if not exists klingo_ag_resp_em on trackco.klingo_agendamentos (responsavel_login, data_agendado_em);
create index if not exists klingo_ag_resp_para on trackco.klingo_agendamentos (responsavel_login, data_agendado_para);
create index if not exists klingo_ag_resp_real on trackco.klingo_agendamentos (responsavel_login, data_realizacao);
create index if not exists apuracoes_colab_comp on trackco.apuracoes (colaborador_id, competencia);

-- colaboradores que o usuário atual pode ver: ele mesmo, a equipe que lidera, ou todos (admin/gestor)
create or replace function trackco.colaboradores_visiveis() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from trackco.colaboradores c
  where trackco.e_gestor() or c.id = trackco.meu_id() or trackco.lidero_colaborador(c.id)
$$;
revoke all on function trackco.colaboradores_visiveis() from public, anon;
grant execute on function trackco.colaboradores_visiveis() to authenticated;

-- recria as policies de leitura no formato "uma vez por consulta"
drop policy if exists colab_ler on trackco.colaboradores;
create policy colab_ler on trackco.colaboradores for select to authenticated
  using (id in (select trackco.colaboradores_visiveis()));

drop policy if exists klingo_ler on trackco.klingo_agendamentos;
create policy klingo_ler on trackco.klingo_agendamentos for select to authenticated
  using ((select trackco.e_gestor()) or responsavel_login in (select trackco.logins_visiveis()));

drop policy if exists ausencias_ler on trackco.ausencias;
create policy ausencias_ler on trackco.ausencias for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));

drop policy if exists lancamentos_ler on trackco.lancamentos;
create policy lancamentos_ler on trackco.lancamentos for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));

drop policy if exists metas_ler on trackco.metas;
create policy metas_ler on trackco.metas for select to authenticated
  using (
    colaborador_id in (select trackco.colaboradores_visiveis())
    or (equipe_id is not null and ((select trackco.e_gestor()) or trackco.membro_da_equipe(equipe_id)))
  );

drop policy if exists apuracoes_ler on trackco.apuracoes;
create policy apuracoes_ler on trackco.apuracoes for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));

drop policy if exists itens_ler on trackco.apuracao_itens;
create policy itens_ler on trackco.apuracao_itens for select to authenticated
  using (apuracao_id in (select a.id from trackco.apuracoes a where a.colaborador_id in (select trackco.colaboradores_visiveis())));

drop policy if exists ajustes_ler on trackco.ajustes;
create policy ajustes_ler on trackco.ajustes for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));

drop policy if exists contest_ler on trackco.contestacoes;
create policy contest_ler on trackco.contestacoes for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));

drop policy if exists premios_ler on trackco.premios_concedidos;
create policy premios_ler on trackco.premios_concedidos for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));
drop policy if exists pontos_ler on trackco.pontos_extrato;
create policy pontos_ler on trackco.pontos_extrato for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));
drop policy if exists resgates_ler on trackco.resgates;
create policy resgates_ler on trackco.resgates for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));

-- limpeza: versões publicadas em duplicidade (cliques repetidos no botão Publicar).
-- Remove só as que são cópia IDÊNTICA de uma versão posterior (mesmo plano, mesma vigência, mesma regra)
-- e que nenhuma apuração usa; depois renumera em sequência.
delete from trackco.plano_versoes v
where exists (
    select 1 from trackco.plano_versoes w
    where w.plano_id = v.plano_id and w.vigente_desde = v.vigente_desde
      and md5(w.definicao::text) = md5(v.definicao::text) and w.numero > v.numero)
  and not exists (select 1 from trackco.apuracoes a where a.plano_versao_id = v.id);

update trackco.plano_versoes v set numero = r.n
from (select id, row_number() over (partition by plano_id order by numero)::int as n from trackco.plano_versoes) r
where r.id = v.id and v.numero <> r.n;

-- planos: um rascunho idêntico à última versão não vira versão nova (evita duplicar por clique repetido)
create unique index if not exists plano_versoes_sem_duplicata
  on trackco.plano_versoes (plano_id, vigente_desde, md5(definicao::text));

-- Métrica para comparar "maçã com maçã": consultas MARCADAS PARA o período (pela data da consulta),
-- com a mesma base da taxa de conversão (sem remarcações, bloqueios da clínica e erros de cadastro).
insert into trackco.metricas (codigo, nome, descricao, tipo, unidade, definicao) values (
  'marcadas_para', 'Consultas marcadas para o período',
  'Quantas consultas Particular estavam marcadas para o dia/mês (pela data da consulta), sem remarcações, bloqueios da clínica e erros de cadastro. Compare com "Consultas realizadas" do mesmo período.',
  'quantitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para",
    "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"},
               {"campo":"situacao","op":"nao_em","valor":["remarcada","falta_remarcada","bloqueio_clinica","erro"]}]}'
) on conflict (codigo) do nothing;

-- >>>>>>>>>> 20261113000011_trackco_confirmacoes_formularios.sql
-- Trackco · agendamentos válidos, "confirmar amanhã" e formulários obrigatórios

-- ---------------------------------------------------------------------------
-- 1) Agendamentos válidos (sem remarcações, bloqueios e erros) ao lado do total
-- ---------------------------------------------------------------------------
insert into trackco.metricas (codigo, nome, descricao, tipo, unidade, definicao)
select 'agendamentos_validos', 'Agendamentos válidos Particular',
  'Agendamentos Particular pelo dia em que foram marcados, sem as marcações que depois viraram remarcação, bloqueios da clínica e erros de cadastro. Cada paciente conta uma vez.',
  'quantitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_em",
    "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"},
               {"campo":"situacao","op":"nao_em","valor":["remarcada","falta_remarcada","bloqueio_clinica","erro"]}]}'::jsonb
where not exists (select 1 from trackco.metricas where codigo = 'agendamentos_validos');

-- ---------------------------------------------------------------------------
-- 2) Confirmar amanhã: a atendente marca se confirmou a consulta na véspera
-- ---------------------------------------------------------------------------
create table if not exists trackco.confirmacoes (
  chave          text primary key references trackco.klingo_agendamentos (chave) on delete cascade,
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  resultado      text not null check (resultado in ('confirmado', 'sem_contato')),
  registrado_em  timestamptz not null default now()
);
create index if not exists confirmacoes_colab on trackco.confirmacoes (colaborador_id, registrado_em);
alter table trackco.confirmacoes enable row level security;

drop policy if exists confirmacoes_ler on trackco.confirmacoes;
create policy confirmacoes_ler on trackco.confirmacoes for select to authenticated
  using (colaborador_id in (select trackco.colaboradores_visiveis()));
-- só leitura direta; gravação pela função abaixo (confere se a consulta é de quem está marcando)
grant select on trackco.confirmacoes to authenticated;

create or replace function trackco.marcar_confirmacao(p_chave text, p_resultado text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_eu uuid := trackco.meu_id();
begin
  if v_eu is null then raise exception 'sem acesso'; end if;
  if not exists (
    select 1 from trackco.klingo_agendamentos k
    join trackco.colaboradores c on c.id = v_eu
    where k.chave = p_chave and lower(k.responsavel_login) = lower(c.login_klingo)
  ) then
    raise exception 'Esta consulta não foi marcada por você.';
  end if;
  if p_resultado is null then
    delete from trackco.confirmacoes where chave = p_chave;
  elsif p_resultado in ('confirmado', 'sem_contato') then
    insert into trackco.confirmacoes (chave, colaborador_id, resultado) values (p_chave, v_eu, p_resultado)
    on conflict (chave) do update set resultado = excluded.resultado, colaborador_id = excluded.colaborador_id, registrado_em = now();
  else
    raise exception 'resultado inválido';
  end if;
  return true;
end $$;
revoke all on function trackco.marcar_confirmacao(text, text) from public, anon;
grant execute on function trackco.marcar_confirmacao(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Formulários obrigatórios (pesquisas curtas, com agenda)
-- ---------------------------------------------------------------------------
create table if not exists trackco.formularios (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descricao     text,
  perguntas     jsonb not null default '[]'::jsonb,
  modelo        text check (modelo in ('sus')),
  recorrencia   text not null default 'mensal' check (recorrencia in ('mensal', 'unica')),
  dia_mes       int check (dia_mes between 1 and 28),
  a_cada_meses  int not null default 1 check (a_cada_meses between 1 and 12),
  data_unica    date,
  inicio        date not null default current_date,
  publico       jsonb not null default '{"equipes":[],"funcoes":["membro","lider"]}'::jsonb,
  anonimo       boolean not null default true,
  ativo         boolean not null default false,
  criado_por    uuid,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- quem já respondeu cada rodada (é o que libera o site); não guarda as respostas
create table if not exists trackco.formulario_envios (
  formulario_id  uuid not null references trackco.formularios (id) on delete cascade,
  rodada         text not null,
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  respondido_em  timestamptz not null default now(),
  primary key (formulario_id, rodada, colaborador_id)
);

-- as respostas; em formulário anônimo, sem colaborador e só com a data (sem hora) para não dar para cruzar
create table if not exists trackco.formulario_respostas (
  id             uuid primary key default gen_random_uuid(),
  formulario_id  uuid not null references trackco.formularios (id) on delete cascade,
  rodada         text not null,
  colaborador_id uuid references trackco.colaboradores (id) on delete set null,
  equipe_id      uuid references trackco.equipes (id) on delete set null,
  respostas      jsonb not null,
  respondido_dia date not null default current_date
);
create index if not exists formulario_respostas_rodada on trackco.formulario_respostas (formulario_id, rodada);

alter table trackco.formularios enable row level security;
alter table trackco.formulario_envios enable row level security;
alter table trackco.formulario_respostas enable row level security;

drop policy if exists formularios_ler on trackco.formularios;
create policy formularios_ler on trackco.formularios for select to authenticated using (true);
drop policy if exists formularios_admin on trackco.formularios;
create policy formularios_admin on trackco.formularios for all to authenticated
  using ((select trackco.e_admin())) with check ((select trackco.e_admin()));

drop policy if exists envios_ler on trackco.formulario_envios;
create policy envios_ler on trackco.formulario_envios for select to authenticated
  using (colaborador_id = (select trackco.meu_id()) or (select trackco.e_gestor()));

drop policy if exists respostas_ler on trackco.formulario_respostas;
create policy respostas_ler on trackco.formulario_respostas for select to authenticated
  using ((select trackco.e_gestor()));

-- formulários: o admin edita (RLS acima). Envio e resposta: só leitura direta;
-- a gravação é pela função, que faz as duas juntas e uma vez por rodada.
grant select, insert, update, delete on trackco.formularios to authenticated;
grant select on trackco.formulario_envios, trackco.formulario_respostas to authenticated;

create or replace function trackco.responder_formulario(p_formulario uuid, p_rodada text, p_respostas jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := trackco.meu_id();
  v_anonimo boolean;
  v_equipe uuid;
begin
  if v_eu is null then raise exception 'sem acesso'; end if;
  if p_rodada !~ '^\d{4}-\d{2}(-\d{2})?$' then raise exception 'rodada inválida'; end if;
  if jsonb_typeof(p_respostas) <> 'object' or length(p_respostas::text) > 30000 then raise exception 'respostas inválidas'; end if;
  select anonimo into v_anonimo from trackco.formularios where id = p_formulario and ativo;
  if not found then raise exception 'formulário não está ativo'; end if;

  insert into trackco.formulario_envios (formulario_id, rodada, colaborador_id)
  values (p_formulario, p_rodada, v_eu)
  on conflict do nothing;
  if not found then return false; end if; -- já tinha respondido

  select m.equipe_id into v_equipe from trackco.equipe_membros m
  where m.colaborador_id = v_eu and (m.fim is null or m.fim >= current_date)
  order by (m.funcao = 'membro') desc limit 1;

  insert into trackco.formulario_respostas (formulario_id, rodada, colaborador_id, equipe_id, respostas)
  values (p_formulario, p_rodada, case when v_anonimo then null else v_eu end, v_equipe, p_respostas);
  return true;
end $$;
revoke all on function trackco.responder_formulario(uuid, text, jsonb) from public, anon;
grant execute on function trackco.responder_formulario(uuid, text, jsonb) to authenticated;

drop trigger if exists formularios_tocar on trackco.formularios;
create trigger formularios_tocar before update on trackco.formularios for each row execute function trackco.tocar_atualizado_em();
drop trigger if exists formularios_auditoria on trackco.formularios;
create trigger formularios_auditoria after insert or update or delete on trackco.formularios for each row execute function trackco.auditar();

-- modelos prontos, DESLIGADOS: o admin revisa as perguntas e liga quando quiser
insert into trackco.formularios (titulo, descricao, modelo, recorrencia, dia_mes, a_cada_meses, perguntas, anonimo, ativo)
select 'Como está sendo usar o Trackco?',
  'São 10 frases rápidas. Responda pensando no seu dia a dia com o Trackco. As respostas são anônimas e servem para melhorar o sistema.',
  'sus', 'mensal', 2, 3,
  '[{"id":"sus1","tipo":"escala5","texto":"Eu gostaria de usar o Trackco com frequência.","obrigatoria":true},
    {"id":"sus2","tipo":"escala5","texto":"Eu achei o Trackco desnecessariamente complicado.","obrigatoria":true},
    {"id":"sus3","tipo":"escala5","texto":"Eu achei o Trackco fácil de usar.","obrigatoria":true},
    {"id":"sus4","tipo":"escala5","texto":"Eu precisaria da ajuda de alguém para conseguir usar o Trackco.","obrigatoria":true},
    {"id":"sus5","tipo":"escala5","texto":"As partes do Trackco funcionam bem juntas.","obrigatoria":true},
    {"id":"sus6","tipo":"escala5","texto":"O Trackco tem muitas coisas que não combinam entre si.","obrigatoria":true},
    {"id":"sus7","tipo":"escala5","texto":"A maioria das pessoas aprenderia a usar o Trackco rapidamente.","obrigatoria":true},
    {"id":"sus8","tipo":"escala5","texto":"Eu achei o Trackco muito trabalhoso de usar.","obrigatoria":true},
    {"id":"sus9","tipo":"escala5","texto":"Eu me senti confiante usando o Trackco.","obrigatoria":true},
    {"id":"sus10","tipo":"escala5","texto":"Eu precisei aprender muitas coisas antes de conseguir usar o Trackco.","obrigatoria":true},
    {"id":"comentario","tipo":"texto","texto":"Se pudesse mudar uma coisa no Trackco, o que seria?","obrigatoria":false}]'::jsonb,
  true, false
where not exists (select 1 from trackco.formularios where modelo = 'sus');

insert into trackco.formularios (titulo, descricao, modelo, recorrencia, dia_mes, a_cada_meses, perguntas, anonimo, ativo)
select 'Pulso do mês',
  '4 perguntas, menos de 1 minuto. Anônimo: ninguém vê o que você respondeu.',
  null, 'mensal', 2, 1,
  '[{"id":"clareza","tipo":"escala5","texto":"Eu entendo como os meus números são contados.","obrigatoria":true},
    {"id":"justica","tipo":"escala5","texto":"Acho justa a forma como o meu desempenho é medido.","obrigatoria":true},
    {"id":"acao","tipo":"escala5","texto":"O Trackco me ajuda a saber o que fazer para melhorar.","obrigatoria":true},
    {"id":"comentario","tipo":"texto","texto":"O que mais te atrapalhou no mês passado?","obrigatoria":false}]'::jsonb,
  true, false
where not exists (select 1 from trackco.formularios where titulo = 'Pulso do mês');

-- >>>>>>>>>> registro das migrations (compatível com a CLI do Supabase)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261110000001', 'trackco_schema'),
  ('20261110000002', 'trackco_rls'),
  ('20261110000003', 'trackco_klingo_sync'),
  ('20261110000004', 'trackco_seed'),
  ('20261110000005', 'trackco_metas_rpc'),
  ('20261110000006', 'trackco_logins_sem_vinculo'),
  ('20261111000007', 'trackco_sus_somente_analise'),
  ('20261111000008', 'trackco_historico_2025'),
  ('20261111000009', 'trackco_situacao_marcacoes'),
  ('20261112000010', 'trackco_desempenho'),
  ('20261113000011', 'trackco_confirmacoes_formularios')
on conflict (version) do nothing;

commit;

-- Conferência rápida (deve listar a equipe Comercial e as métricas):
select (select string_agg(nome, ', ') from trackco.equipes) as equipes,
       (select count(*) from trackco.metricas) as metricas,
       (select count(*) from trackco.colaboradores) as colaboradores_importados,
       (select count(*) from trackco.equipe_membros) as membros_comercial;
