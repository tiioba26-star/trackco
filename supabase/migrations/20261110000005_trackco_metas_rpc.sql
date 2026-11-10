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
