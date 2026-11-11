-- Trackco · SUS é só para análise e visualização: nunca entra em metas, nota, prêmios, comissão ou pontos.
update trackco.metricas
set definicao = definicao || '{"somente_analise": true}'::jsonb
where codigo in ('agendamentos_sus', 'realizadas_sus');
