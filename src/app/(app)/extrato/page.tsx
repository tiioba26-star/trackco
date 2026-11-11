import { FileText, Lock, ScrollText } from "lucide-react";
import { BarraAtingimento, NivelBadge, Rotulo, Vazio } from "@/components/app/blocos";
import { SeletorCompetencia } from "@/components/app/seletor-competencia";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { descreverRecompensa } from "@/engine/apuracao";
import { competenciaDe, formatarDataBR, hojeNoFuso, inicioCompetencia, nomeCompetencia } from "@/engine/datas";
import { exigirSessao } from "@/lib/auth";
import { buscarTodos } from "@/lib/calculo/carregar";
import type { ApuracaoRow } from "@/lib/dados/painel";
import { carinhaEmoji, competenciaValida, fmtDataHora, fmtPct, fmtValor } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { LinhasOrigem, type LinhaOrigem } from "./linhas-origem";

export const metadata = { title: "Extrato" };

export default async function PaginaExtrato(props: PageProps<"/extrato">) {
  const s = await exigirSessao();
  const sp = await props.searchParams;
  const atual = competenciaDe(hojeNoFuso());
  const comp = competenciaValida(sp.comp) ?? atual;
  const colabId = typeof sp.c === "string" && sp.c ? sp.c : s.colaborador.id;
  const db = await criarClienteServidor();

  // pessoas que o usuário pode consultar (RLS decide)
  const { data: visiveis } = await db.from("colaboradores").select("id, nome").eq("ativo", true).order("nome");
  const pessoas = (visiveis ?? []) as { id: string; nome: string }[];

  const { data: aps } = await db
    .from("apuracoes")
    .select("id, tipo, colaborador_id, equipe_id, funcao, nota, nivel, calculado_em, plano_versao_id, resultado, fechamento_id, fechamentos(status), equipes(nome)")
    .eq("colaborador_id", colabId)
    .eq("competencia", inicioCompetencia(comp));
  type Ap = ApuracaoRow & { tipo: string; fechamentos: { status: string } | null; equipes: { nome: string } | null };
  const lista = (aps ?? []) as unknown as Ap[];
  const ap = lista.find((a) => a.tipo === "final") ?? lista.find((a) => a.tipo === "parcial");

  const seletor = (
    <div className="flex flex-wrap items-center gap-2">
      {pessoas.length > 1 && (
        <form className="flex items-center gap-2" action="/extrato">
          <input type="hidden" name="comp" value={comp} />
          <NativeSelect name="c" defaultValue={colabId} className="w-56">
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </NativeSelect>
          <button className="h-8 rounded-lg border px-3 text-sm hover:bg-muted" type="submit">
            Ver
          </button>
        </form>
      )}
      <SeletorCompetencia competencia={comp} maxima={atual} />
    </div>
  );

  if (!ap) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">{seletor}</div>
        <Vazio
          icone={FileText}
          titulo="Sem apuração neste mês"
          texto="Não há cálculo para esta pessoa no mês escolhido (ou você não tem permissão para vê-lo)."
        />
      </div>
    );
  }

  const r = ap.resultado;
  const [versaoRes, metricasRes, itens] = await Promise.all([
    ap.plano_versao_id
      ? db
          .from("plano_versoes")
          .select("numero, vigente_desde, observacao, planos(nome, modalidade)")
          .eq("id", ap.plano_versao_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("metricas").select("id, nome, descricao"),
    buscarTodos<{ metrica_id: string; origem: string; origem_chave: string; papel: string }>((de, ate) =>
      db
        .from("apuracao_itens")
        .select("metrica_id, origem, origem_chave, papel")
        .eq("apuracao_id", ap.id)
        .range(de, ate),
    ),
  ]);
  const versao = versaoRes.data as
    | { numero: number; vigente_desde: string; observacao: string | null; planos: { nome: string; modalidade: string } | null }
    | null;
  const nomeMetrica = new Map(((metricasRes.data ?? []) as { id: string; nome: string }[]).map((m) => [m.id, m.nome]));

  // linhas de origem (Klingo e lançamentos)
  const chavesKlingo = Array.from(new Set(itens.filter((i) => i.origem === "klingo_agendamentos").map((i) => i.origem_chave)));
  const idsLanc = Array.from(new Set(itens.filter((i) => i.origem === "lancamentos").map((i) => i.origem_chave)));
  const porChave = new Map<string, Record<string, unknown>>();
  for (let k = 0; k < chavesKlingo.length; k += 150) {
    const { data } = await db
      .from("klingo_agendamentos")
      .select("chave, data_agendado_em, data_agendado_para, data_realizacao, paciente_nome, procedimento, profissional, operadora, responsavel_login, atendido, situacao, motivo")
      .in("chave", chavesKlingo.slice(k, k + 150));
    for (const l of data ?? []) porChave.set(l.chave as string, l);
  }
  for (let k = 0; k < idsLanc.length; k += 150) {
    const { data } = await db.from("lancamentos").select("id, data, tipo, valor, descricao").in("id", idsLanc.slice(k, k + 150));
    for (const l of data ?? [])
      porChave.set(l.id as string, { descricao: `${l.tipo}: ${l.valor}${l.descricao ? ` · ${l.descricao}` : ""}`, data_agendado_em: l.data });
  }
  const linhas: LinhaOrigem[] = itens
    .filter((i) => porChave.has(i.origem_chave))
    .map((i) => ({ chave: i.origem_chave, metrica_id: i.metrica_id, papel: i.papel, ...(porChave.get(i.origem_chave) as object) }));
  const metricasComLinhas = Array.from(new Set(itens.map((i) => i.metrica_id))).map((id) => ({
    id,
    nome: nomeMetrica.get(id) ?? "Métrica",
  }));

  const ehFinal = ap.tipo === "final";
  const congelado = ehFinal && ["aprovado", "entregue"].includes(ap.fechamentos?.status ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Extrato de {r.nome}</h2>
          <p className="text-sm text-muted-foreground capitalize">
            {nomeCompetencia(comp)} · {ap.equipes?.nome} · {r.funcao === "lider" ? "líder" : "membro"}
          </p>
        </div>
        {seletor}
      </div>

      <div className="grid gap-4 lg:grid-cols-3" data-tour="extrato-cabecalho">
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Rotulo>Nível</Rotulo>
              <div className="font-heading text-2xl font-semibold" style={{ color: r.faixa?.cor }}>
                {r.faixa?.nivel ?? "Sem nível"}
              </div>
              <div className="text-sm text-muted-foreground">
                Nota geral <b className="text-foreground">{fmtPct(r.nota_pct)}</b>
              </div>
              {r.recompensa && <div className="text-sm">🏅 {descreverRecompensa(r.recompensa)}</div>}
            </div>
            <div className="text-5xl" aria-hidden>
              {carinhaEmoji(r.nota_pct)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 text-sm">
            <Rotulo>Regras aplicadas</Rotulo>
            <div className="font-medium">{versao?.planos?.nome ?? "Plano"}</div>
            <div className="text-muted-foreground">
              Versão {versao?.numero ?? "—"} · vigente desde {versao ? formatarDataBR(versao.vigente_desde) : "—"}
            </div>
            {versao?.observacao && <div className="text-xs text-muted-foreground">{versao.observacao}</div>}
            <Badge variant="secondary" className="capitalize">
              {versao?.planos?.modalidade ?? "—"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 text-sm">
            <Rotulo>Situação do cálculo</Rotulo>
            <div className="flex items-center gap-2 font-medium">
              {congelado ? <Lock className="size-4 text-up" /> : null}
              {ehFinal ? (congelado ? "Resultado oficial (fechamento aprovado)" : "Resultado do fechamento em revisão") : "Parcial (tempo real)"}
            </div>
            <div className="text-muted-foreground">Calculado em {fmtDataHora(ap.calculado_em)}</div>
            <div className="text-muted-foreground">
              Dias úteis: {r.dias.uteis_total} · disponíveis: {r.dias.disponiveis_total}
              {r.dias.ausentes > 0 ? ` · ausências: ${r.dias.ausentes}` : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-tour="extrato-indicadores">
        <CardHeader>
          <CardTitle>Cálculo por indicador</CardTitle>
          <CardDescription>Realizado ÷ meta ajustada = atingimento. A nota geral é a média dos atingimentos ponderada pelos pesos.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead className="text-right">Peso</TableHead>
                <TableHead className="text-right">Apurado</TableHead>
                <TableHead className="text-right">Ajustes</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Meta ajustada</TableHead>
                <TableHead className="min-w-40">Atingimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.indicadores.map((i) => (
                <TableRow key={i.indicador_id}>
                  <TableCell>
                    <div className="font-medium">{i.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.escopo === "equipe" ? "agregado da equipe" : "individual"}
                      {i.denominador !== undefined ? ` · ${fmtValor(i.numerador ?? 0)} ÷ ${fmtValor(i.denominador)}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{i.peso}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtValor(i.realizado - i.ajuste_total, i.unidade)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {i.ajuste_total ? `${i.ajuste_total > 0 ? "+" : ""}${fmtValor(i.ajuste_total)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmtValor(i.realizado, i.unidade)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtValor(i.meta, i.unidade)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtValor(i.meta_ajustada, i.unidade)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <BarraAtingimento pct={i.atingimento_pct} className="w-24" />
                      <span className="text-sm tabular-nums">{i.sem_meta ? "sem meta" : fmtPct(i.atingimento_pct)}</span>
                    </div>
                    {i.atingimento_considerado_pct !== i.atingimento_pct && (
                      <div className="text-xs text-muted-foreground">considerado {fmtPct(i.atingimento_considerado_pct)} (teto)</div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {r.condicoes.length > 0 && (
            <div className="mt-4 space-y-1">
              <Rotulo>Condições</Rotulo>
              {r.condicoes.map((c) => (
                <div key={c.id} className="text-sm">
                  {c.ok ? "✅" : "⛔"} {c.descricao}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour="extrato-memorial">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-5" /> Memorial de cálculo
          </CardTitle>
          <CardDescription>O passo a passo que o sistema seguiu, com os dados e as regras usadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5 text-sm">
            {r.memorial.map((linha, idx) => (
              <li key={idx} className={linha.startsWith("  ·") ? "pl-6 text-muted-foreground" : ""}>
                {linha}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.faixa && <NivelBadge nivel={r.faixa.nivel} cor={r.faixa.cor} />}
          </div>
        </CardContent>
      </Card>

      <Card data-tour="extrato-linhas">
        <CardHeader>
          <CardTitle>Linhas de origem</CardTitle>
          <CardDescription>
            Cada registro do Klingo (ou lançamento) que entrou no cálculo. {linhas.length} linha(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinhasOrigem
            linhas={linhas}
            metricas={metricasComLinhas}
            competencia={comp}
            podeContestar={colabId === s.colaborador.id && !congelado}
          />
        </CardContent>
      </Card>
    </div>
  );
}
