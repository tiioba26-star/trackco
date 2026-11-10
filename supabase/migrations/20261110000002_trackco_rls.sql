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
