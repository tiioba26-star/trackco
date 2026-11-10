// Gera supabase/aplicar-tudo.sql (todas as migrations numa transação) para colar no SQL Editor do Supabase.
// Uso: npm run sql:combinar   — o teste "aplicar-tudo.sql está atualizado" falha se esquecer de rodar.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "supabase", "migrations");
const SAIDA = join(import.meta.dirname, "..", "supabase", "aplicar-tudo.sql");

export function combinar() {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const cab = `-- =====================================================================
-- Trackco · TODAS as migrations num arquivo só, para colar no SQL Editor do Supabase.
-- Gerado por scripts/combinar-sql.mjs a partir de supabase/migrations/ (não edite aqui).
-- Roda numa transação: se algo falhar, nada é aplicado.
-- Só cria o schema "trackco"; não altera nada do sistema relatorio.
-- =====================================================================
begin;
`;
  const corpo = arquivos.map((f) => `\n-- >>>>>>>>>> ${f}\n${readFileSync(join(DIR, f), "utf8")}`).join("");
  const versoes = arquivos
    .map((f) => {
      const [versao, ...resto] = f.replace(/\.sql$/, "").split("_");
      return `('${versao}', '${resto.join("_")}')`;
    })
    .join(",\n  ");
  const rodape = `
-- >>>>>>>>>> registro das migrations (compatível com a CLI do Supabase)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ${versoes}
on conflict (version) do nothing;

commit;

-- Conferência rápida (deve listar a equipe Comercial e as métricas):
select (select string_agg(nome, ', ') from trackco.equipes) as equipes,
       (select count(*) from trackco.metricas) as metricas,
       (select count(*) from trackco.colaboradores) as colaboradores_importados,
       (select count(*) from trackco.equipe_membros) as membros_comercial;
`;
  return cab + corpo + rodape;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  writeFileSync(SAIDA, combinar(), "utf8");
  console.log(`Gerado ${SAIDA}`);
}
