// Recalcula as apurações parciais de um período com o mesmo código do site.
// Uso (precisa das variáveis NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY):
//   npm run recalcular -- 2025-01 2026-11
// No dia a dia use a tela "Dados e lançamentos → Recalcular um período".
import { competenciaAnterior } from "@/engine/datas";
import { recalcularParcial } from "@/lib/calculo/recalcular";

const [de, ate] = process.argv.slice(2);
if (!/^\d{4}-\d{2}$/.test(de ?? "") || !/^\d{4}-\d{2}$/.test(ate ?? "")) {
  console.error("Uso: npm run recalcular -- AAAA-MM AAAA-MM");
  process.exit(1);
}
const meses: string[] = [];
for (let c = ate; c >= de; c = competenciaAnterior(c)) meses.unshift(c);
for (const m of meses) {
  const t = Date.now();
  const r = await recalcularParcial(m);
  const resumo = r.equipes.map((e) => `${e.equipe}: ${e.pessoas} pessoa(s), ${e.plano ?? "sem plano"}`).join(" | ");
  console.log(m, resumo, `${((Date.now() - t) / 1000).toFixed(1)}s`);
}
