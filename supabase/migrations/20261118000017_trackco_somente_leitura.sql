-- Trackco · nível "Somente leitura" (papel 'leitura')
--
-- Para quem acompanha a gestão mas não usa o Klingo (ex.: tráfego pago, contador): vê tudo o que o administrador vê
-- e não altera nada. Escrever continua exigindo e_admin() (ou ser líder), então este papel não grava em lugar nenhum.

alter table trackco.colaboradores drop constraint if exists colaboradores_papel_check;
alter table trackco.colaboradores add constraint colaboradores_papel_check
  check (papel in ('admin', 'gestor', 'leitura', 'colaborador'));

create or replace function trackco.e_leitura() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.papel = 'leitura' from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo), false)
$$;

-- e_gestor() é o "vê tudo" (só aparece em políticas e funções de LEITURA): passa a incluir o somente leitura
create or replace function trackco.e_gestor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.papel in ('admin', 'gestor', 'leitura') from trackco.colaboradores c where c.auth_id = auth.uid() and c.ativo), false)
$$;

-- Tabelas que o administrador lê por uma política só dele (auditoria, painéis de TV, formulários, prêmios…):
-- o somente leitura ganha uma política de LEITURA em cada uma. A lista sai do catálogo, para não esquecer nenhuma.
do $$
declare
  t text;
begin
  for t in
    select distinct p.tablename
    from pg_policies p
    where p.schemaname = 'trackco' and p.cmd in ('SELECT', 'ALL') and p.qual ilike '%e_admin()%'
  loop
    execute format('drop policy if exists leitura_ver on trackco.%I', t);
    execute format('create policy leitura_ver on trackco.%I for select to authenticated using ((select trackco.e_leitura()))', t);
  end loop;
end $$;

-- logins do Klingo sem vínculo (tela Colaboradores): é só leitura
create or replace function trackco.logins_klingo_sem_vinculo(p_desde date)
returns table (login text, nome text, agendamentos bigint, ultimo date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (trackco.e_admin() or trackco.e_leitura()) then
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
