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
