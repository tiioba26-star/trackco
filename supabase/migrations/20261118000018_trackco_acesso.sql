-- Trackco · "acesso" separado de "ativo"
--
-- acesso = a pessoa pode ENTRAR no Trackco (o botão deslizante na tela Colaboradores).
-- Sem acesso, ela continua sendo da clínica: fica nas equipes, nos relatórios, na Gestão e no ranking; só não entra.
-- Isso permite montar equipes com quem está só no Klingo (ex.: Recepção Consultório, Recepção SUS) e acompanhar
-- os números delas mesmo que ninguém da equipe use o Trackco.
-- ativo continua sendo "é da clínica" (desmarcar tira a pessoa das listas).

alter table trackco.colaboradores add column if not exists acesso boolean not null default true;

-- quem não tem login não tem acesso
update trackco.colaboradores set acesso = false where auth_id is null;

-- o usuário logado só "existe" para o banco se for ativo E tiver acesso
create or replace function trackco.meu_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo and c.acesso
$$;

create or replace function trackco.meu_papel() returns text
language sql stable security definer set search_path = '' as $$
  select c.papel from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo and c.acesso
$$;

create or replace function trackco.e_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.papel = 'admin' from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo and c.acesso), false)
$$;

create or replace function trackco.e_gestor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.papel in ('admin', 'gestor', 'leitura') from trackco.colaboradores c
                   where c.auth_id = auth.uid() and c.ativo and c.acesso), false)
$$;

create or replace function trackco.e_leitura() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.papel = 'leitura' from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo and c.acesso), false)
$$;

create or replace function trackco.lidero(p_equipe uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from trackco.equipe_membros m
    join trackco.colaboradores c on c.id = m.colaborador_id
    where c.auth_id = auth.uid() and c.ativo and c.acesso and m.equipe_id = p_equipe and m.funcao = 'lider'
      and (m.fim is null or m.fim >= current_date)
  )
$$;

create or replace function trackco.lidero_colaborador(p_colab uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from trackco.equipe_membros eu
    join trackco.colaboradores c on c.id = eu.colaborador_id
    join trackco.equipe_membros ele on ele.equipe_id = eu.equipe_id
    where c.auth_id = auth.uid() and c.ativo and c.acesso and eu.funcao = 'lider'
      and (eu.fim is null or eu.fim >= current_date)
      and ele.colaborador_id = p_colab
  )
$$;

create or replace function trackco.membro_da_equipe(p_equipe uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from trackco.equipe_membros m
    join trackco.colaboradores c on c.id = m.colaborador_id
    where c.auth_id = auth.uid() and c.ativo and c.acesso and m.equipe_id = p_equipe
      and (m.fim is null or m.fim >= current_date)
  )
$$;
