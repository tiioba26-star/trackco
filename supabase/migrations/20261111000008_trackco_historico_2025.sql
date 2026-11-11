-- Trackco · histórico desde jan/2025: feriados de 2025 e versão inicial do plano valendo desde jan/2025
insert into trackco.feriados (data, descricao) values
  ('2025-01-01', 'Confraternização Universal'),
  ('2025-04-18', 'Sexta-feira Santa'),
  ('2025-04-21', 'Tiradentes'),
  ('2025-05-01', 'Dia do Trabalho'),
  ('2025-06-24', 'São João (Salvador)'),
  ('2025-07-02', 'Independência da Bahia'),
  ('2025-09-07', 'Independência do Brasil'),
  ('2025-10-12', 'Nossa Senhora Aparecida'),
  ('2025-11-02', 'Finados'),
  ('2025-11-15', 'Proclamação da República'),
  ('2025-11-20', 'Dia da Consciência Negra'),
  ('2025-12-08', 'Nossa Senhora da Conceição da Praia (Salvador)'),
  ('2025-12-25', 'Natal')
on conflict (data) do nothing;

update trackco.plano_versoes v set vigente_desde = '2025-01-01'
from trackco.planos p
where p.id = v.plano_id and p.nome = 'Comercial · Reconhecimento' and v.numero = 1 and v.vigente_desde = '2026-01-01';
