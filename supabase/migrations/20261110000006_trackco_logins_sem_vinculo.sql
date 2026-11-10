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
