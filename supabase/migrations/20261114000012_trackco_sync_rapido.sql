-- Trackco · sincronização do Klingo mais leve
--
-- Meses com ~12 mil marcações estouravam o tempo do banco (erro 57014) em parte das execuções do robô:
-- a função regravava TODAS as linhas do mês a cada hora (9 índices atualizados por linha) e comparava
-- as chaves com uma tabela temporária sem índice nem estatística.
-- Agora: a tabela temporária tem chave primária e estatística, e só as linhas que mudaram são regravadas.
-- O resultado é o mesmo (mesmas linhas, mesmas remoções); só fica mais rápido.

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
  create temporary table _novas (
    chave text primary key, data_agendado_em date, data_agendado_para date, responsavel_login text, paciente_nome text,
    procedimento text, profissional text, operadora text, qtd numeric
  ) on commit drop;
  insert into _novas
  select x.chave, x.data_agendado_em, x.data_agendado_para, lower(nullif(trim(x.responsavel_login), '')), x.paciente_nome,
         x.procedimento, x.profissional, x.operadora, coalesce(x.qtd, 1)
  from jsonb_to_recordset(p_linhas) as x(
    chave text, data_agendado_em date, data_agendado_para date, responsavel_login text, paciente_nome text,
    procedimento text, profissional text, operadora text, qtd numeric)
  on conflict (chave) do nothing;
  analyze _novas;

  if exists (select 1 from _novas where data_agendado_em < v_ini or data_agendado_em > v_fim) then
    raise exception 'linhas fora do mês %', to_char(v_ini, 'YYYY-MM');
  end if;

  insert into trackco.klingo_agendamentos as k
    (chave, data_agendado_em, data_agendado_para, responsavel_login, paciente_nome, procedimento, profissional, operadora, qtd, sincronizado_em)
  select chave, data_agendado_em, data_agendado_para, responsavel_login, paciente_nome,
         procedimento, profissional, operadora, qtd, now()
  from _novas
  on conflict (chave) do update set
    data_agendado_para = excluded.data_agendado_para,
    responsavel_login  = excluded.responsavel_login,
    paciente_nome      = excluded.paciente_nome,
    procedimento       = excluded.procedimento,
    profissional       = excluded.profissional,
    operadora          = excluded.operadora,
    qtd                = excluded.qtd,
    sincronizado_em    = now()
  -- só regrava o que mudou (antes regravava o mês inteiro toda hora)
  where (k.data_agendado_para, k.responsavel_login, k.paciente_nome, k.procedimento, k.profissional, k.operadora, k.qtd)
        is distinct from
        (excluded.data_agendado_para, excluded.responsavel_login, excluded.paciente_nome, excluded.procedimento,
         excluded.profissional, excluded.operadora, excluded.qtd);
  get diagnostics v_upsert = row_count;

  delete from trackco.klingo_agendamentos k
  where k.data_agendado_em between v_ini and v_fim
    and not exists (select 1 from _novas n where n.chave = k.chave);
  get diagnostics v_removidas = row_count;

  return jsonb_build_object('mes', v_ini, 'upsert', v_upsert, 'removidas', v_removidas);
end $$;

revoke all on function trackco.klingo_sincronizar_mes(date, jsonb) from public, anon, authenticated;
grant execute on function trackco.klingo_sincronizar_mes(date, jsonb) to service_role;
