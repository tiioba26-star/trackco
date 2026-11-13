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
