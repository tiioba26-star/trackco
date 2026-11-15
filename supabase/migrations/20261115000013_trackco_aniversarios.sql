-- Trackco · aniversários
-- O Klingo não guarda a data de nascimento dos funcionários (o cadastro de usuário só tem login e nome),
-- então ela é lançada no Trackco, em Colaboradores, pelo líder da equipe ou por um administrador.

-- ---------------------------------------------------------------------------
-- 1) Data de nascimento
-- ---------------------------------------------------------------------------
alter table trackco.colaboradores add column if not exists nascimento date;
comment on column trackco.colaboradores.nascimento is
  'Data de nascimento, para os parabéns e a lista de aniversariantes. Lançada pelo líder ou administrador em Colaboradores.';

-- ---------------------------------------------------------------------------
-- 2) Quando a pessoa viu os parabéns de cada aniversário (abrem sozinhos uma vez só)
-- ---------------------------------------------------------------------------
create table if not exists trackco.parabens_vistos (
  colaborador_id uuid not null references trackco.colaboradores (id) on delete cascade,
  aniversario    date not null,
  visto_em       timestamptz not null default now(),
  primary key (colaborador_id, aniversario)
);
alter table trackco.parabens_vistos enable row level security;
-- só o servidor (chave secreta) lê e grava; pelo navegador ninguém acessa
revoke all on trackco.parabens_vistos from anon, authenticated;
