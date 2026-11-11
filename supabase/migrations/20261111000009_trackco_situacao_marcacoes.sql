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
