import Link from "next/link";
import { CabecalhoPagina } from "@/components/app/blocos";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDataBR, hojeNoFuso } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Auditoria" };

const TABELAS: Record<string, string> = {
  metricas: "Métricas",
  planos: "Planos",
  plano_versoes: "Versões de plano",
  metas: "Metas",
  ajustes: "Ajustes",
  contestacoes: "Contestações",
  fechamentos: "Fechamentos",
  equipes: "Equipes",
  equipe_membros: "Membros",
  colaboradores: "Colaboradores",
  ausencias: "Ausências",
  lancamentos: "Lançamentos",
  paineis_tv: "Painéis de TV",
};
const ACAO: Record<string, string> = { insert: "criou", update: "alterou", delete: "excluiu" };
const IGNORAR = new Set(["atualizado_em", "criado_em", "token_hash", "rascunho", "resultado"]);

function diferencas(antes: Record<string, unknown> | null, depois: Record<string, unknown> | null) {
  const chaves = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  const out: { campo: string; de: string; para: string }[] = [];
  for (const k of chaves) {
    if (IGNORAR.has(k)) continue;
    const a = JSON.stringify(antes?.[k] ?? null);
    const d = JSON.stringify(depois?.[k] ?? null);
    if (a !== d) out.push({ campo: k, de: a, para: d });
  }
  return out;
}

export default async function PaginaAuditoria(props: PageProps<"/auditoria">) {
  await exigirAdmin();
  const sp = await props.searchParams;
  const tabela = typeof sp.t === "string" && TABELAS[sp.t] ? sp.t : undefined;
  const db = await criarClienteServidor();
  // 50 por vez (eram 150 cartões numa página enorme); "Mostrar mais" soma outros 50
  const n = Math.min(500, Math.max(50, Number(sp.n) || 50));
  let q = db
    .from("auditoria")
    .select("*")
    .order("em", { ascending: false })
    .limit(n + 1);
  if (tabela) q = q.eq("tabela", tabela);
  const [{ data }, { data: pessoas }] = await Promise.all([q, db.from("colaboradores").select("auth_id, nome")]);
  const nomePor = new Map((pessoas ?? []).map((p) => [p.auth_id, p.nome]));
  type A = {
    id: number;
    tabela: string;
    registro_id: string | null;
    acao: string;
    antes: Record<string, unknown> | null;
    depois: Record<string, unknown> | null;
    por: string | null;
    em: string;
  };

  return (
    <div>
      <CabecalhoPagina
        titulo="Auditoria"
        descricao="Tudo o que mudou em regras, metas, ajustes e cadastros: quem, quando, antes e depois."
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/auditoria" className={cn("rounded-full border px-3 py-1 text-sm", !tabela && "bg-primary text-primary-foreground")}>
          Tudo
        </Link>
        {Object.entries(TABELAS).map(([k, t]) => (
          <Link
            key={k}
            href={`/auditoria?t=${k}`}
            className={cn("rounded-full border px-3 py-1 text-sm", tabela === k && "bg-primary text-primary-foreground")}
          >
            {t}
          </Link>
        ))}
      </div>
      <Card data-tour="aud-lista" className="py-0">
        <CardContent className="divide-y px-0">
          {((data ?? []) as A[]).slice(0, n).map((a, i, lista) => {
            const dif = diferencas(a.antes, a.depois);
            const nomeRegistro = (a.depois?.nome ?? a.antes?.nome ?? a.depois?.descricao ?? a.antes?.descricao ?? "") as string;
            const dia = formatarDataBR(hojeNoFuso(new Date(a.em)));
            const novoDia = i === 0 || formatarDataBR(hojeNoFuso(new Date(lista[i - 1].em))) !== dia;
            return (
              <div key={a.id}>
                {novoDia && <div className="bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">{dia}</div>}
                <div className="space-y-1 px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="tabular-nums text-muted-foreground">
                      {new Date(a.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })}
                    </span>
                    <span className="font-medium">{a.por ? (nomePor.get(a.por) ?? "usuário") : "sistema"}</span>
                    <span>{ACAO[a.acao] ?? a.acao}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{TABELAS[a.tabela] ?? a.tabela}</span>
                    {nomeRegistro && <span className="truncate text-muted-foreground">{String(nomeRegistro).slice(0, 80)}</span>}
                  </div>
                  {a.acao === "update" && dif.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-xs text-primary">{dif.length} campo(s) alterado(s)</summary>
                      <ul className="mt-1 space-y-0.5 font-mono text-xs">
                        {dif.map((d) => (
                          <li key={d.campo} className="break-all">
                            <b>{d.campo}</b>: <span className="text-down">{d.de.slice(0, 200)}</span> →{" "}
                            <span className="text-up">{d.para.slice(0, 200)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
          {!data?.length && <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum registro.</p>}
        </CardContent>
      </Card>
      {(data?.length ?? 0) > n && (
        <div className="mt-4 flex justify-center">
          <Link
            href={`/auditoria?${new URLSearchParams({ ...(tabela ? { t: tabela } : {}), n: String(n + 50) })}`}
            className={buttonVariants({ variant: "outline" })}
            scroll={false}
          >
            Mostrar mais 50
          </Link>
        </div>
      )}
    </div>
  );
}
