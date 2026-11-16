import "server-only";
import JSZip from "jszip";

// O exceljs não escreve gráficos. Aqui eles são acrescentados ao .xlsx pronto (OOXML/DrawingML), como gráficos
// NATIVOS do Excel: leem os dados das células da planilha, então continuam certos se alguém editar os números.

export interface SerieGrafico {
  nome: string;
  /** intervalo dos valores, ex.: "'Painel'!$B$2:$B$9" */
  valores: string;
  cor?: string; // hex sem #
}

export interface Grafico {
  aba: string;
  tipo: "coluna" | "barra" | "linha" | "pizza";
  titulo: string;
  categorias: string;
  series: SerieGrafico[];
  empilhado?: boolean;
  /** formato dos números do eixo, ex.: '"R$" #,##0' (padrão: o das células) */
  formato?: string;
  /** células (0 = primeira): canto de cima à esquerda e tamanho */
  posicao: { col: number; linha: number; largura: number; altura: number };
}

const CORES = ["2A78D6", "EB6834", "1BAF7A", "6250D6", "EDA100", "E87BA4", "008300", "E34948"];
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const T_DRAWING = `${NS_REL}/drawing`;
const T_CHART = `${NS_REL}/chart`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Intervalo absoluto de uma aba: ref("Painel", 1, 2, 1, 9) → 'Painel'!$B$2:$B$9 (colunas e linhas começando em 1). */
export function ref(aba: string, col1: number, lin1: number, col2: number, lin2: number): string {
  const letra = (n: number) => {
    let s = "";
    for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
    return s;
  };
  return `'${aba.replace(/'/g, "''")}'!$${letra(col1)}$${lin1}:$${letra(col2)}$${lin2}`;
}

function xmlGrafico(g: Grafico): string {
  const titulo = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="pt-BR" sz="1200" b="1"/><a:t>${esc(g.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
  const cor = (s: SerieGrafico, i: number) => s.cor ?? CORES[i % CORES.length];
  const cat = `<c:cat><c:strRef><c:f>${esc(g.categorias)}</c:f></c:strRef></c:cat>`;
  const val = (s: SerieGrafico) => `<c:val><c:numRef><c:f>${esc(s.valores)}</c:f></c:numRef></c:val>`;
  const tx = (s: SerieGrafico) => `<c:tx><c:v>${esc(s.nome)}</c:v></c:tx>`;
  const eixos = (horizontal: boolean) =>
    `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "b" : "l"}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>${g.formato ? `<c:numFmt formatCode="${esc(g.formato)}" sourceLinked="0"/>` : `<c:numFmt formatCode="General" sourceLinked="1"/>`}<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="5001"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;

  let plot: string;
  if (g.tipo === "pizza") {
    const s = g.series[0];
    plot = `<c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${tx(s)}<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>${cat}${val(s)}</c:ser><c:firstSliceAng val="0"/></c:pieChart>`;
  } else if (g.tipo === "linha") {
    const sers = g.series
      .map(
        (s, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx(s)}<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${cor(s, i)}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>${cat}${val(s)}<c:smooth val="0"/></c:ser>`,
      )
      .join("");
    plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>${eixos(false)}`;
  } else {
    const horizontal = g.tipo === "barra";
    const sers = g.series
      .map(
        (s, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx(s)}<c:spPr><a:solidFill><a:srgbClr val="${cor(s, i)}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${cat}${val(s)}</c:ser>`,
      )
      .join("");
    plot =
      `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="${g.empilhado ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${sers}` +
      `<c:gapWidth val="60"/>${g.empilhado ? '<c:overlap val="100"/>' : ""}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>${eixos(horizontal)}`;
  }
  const legenda = g.series.length > 1 || g.tipo === "pizza" ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_REL}">` +
    `<c:roundedCorners val="0"/><c:chart>${titulo}<c:plotArea><c:layout/>${plot}</c:plotArea>${legenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:chartSpace>`
  );
}

function xmlAncora(g: Grafico, i: number, rid: string): string {
  const { col, linha, largura, altura } = g.posicao;
  const ponto = (c: number, l: number) => `<xdr:col>${c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${l}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
  return (
    `<xdr:twoCellAnchor editAs="oneCell"><xdr:from>${ponto(col, linha)}</xdr:from><xdr:to>${ponto(col + largura, linha + altura)}</xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
    `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${NS_REL}" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

const rels = (lista: { id: string; tipo: string; alvo: string }[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  lista.map((r) => `<Relationship Id="${r.id}" Type="${r.tipo}" Target="${r.alvo}"/>`).join("") +
  `</Relationships>`;

/** Acrescenta os gráficos ao .xlsx e devolve o arquivo novo. */
export async function comGraficos(xlsx: Buffer | ArrayBuffer | Uint8Array, graficos: Grafico[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx);
  const ler = async (p: string) => (await zip.file(p)?.async("string")) ?? null;
  // sem as entradas de pasta que o JSZip cria por padrão (o Excel não precisa delas)
  const gravar = (p: string, conteudo: string) => zip.file(p, conteudo, { createFolders: false });

  const workbook = (await ler("xl/workbook.xml"))!;
  const wbRels = (await ler("xl/_rels/workbook.xml.rels"))!;
  const alvoDoRid = new Map([...wbRels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])?.[1], /Target="([^"]+)"/.exec(m[0])?.[1]]));
  const arquivoDaAba = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = /name="([^"]+)"/.exec(m[0])?.[1];
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    const alvo = rid ? alvoDoRid.get(rid) : undefined;
    if (nome && alvo) arquivoDaAba.set(nome.replace(/&amp;/g, "&"), `xl/${alvo.replace(/^\/?xl\//, "")}`);
  }

  let tipos = (await ler("[Content_Types].xml"))!;
  const porAba = new Map<string, Grafico[]>();
  for (const g of graficos) porAba.set(g.aba, [...(porAba.get(g.aba) ?? []), g]);

  let nDesenho = 0;
  let nGrafico = 0;
  for (const [aba, lista] of porAba) {
    const arqAba = arquivoDaAba.get(aba);
    if (!arqAba) throw new Error(`aba "${aba}" não existe na planilha`);
    nDesenho++;
    const desenho = `xl/drawings/trackco${nDesenho}.xml`;
    const relDesenho: { id: string; tipo: string; alvo: string }[] = [];
    const ancoras: string[] = [];
    lista.forEach((g, i) => {
      nGrafico++;
      const arqGraf = `xl/charts/trackco${nGrafico}.xml`;
      gravar(arqGraf, xmlGrafico(g));
      tipos = tipos.replace("</Types>", `<Override PartName="/${arqGraf}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      relDesenho.push({ id: `rId${i + 1}`, tipo: T_CHART, alvo: `../charts/trackco${nGrafico}.xml` });
      ancoras.push(xmlAncora(g, i, `rId${i + 1}`));
    });
    gravar(
      desenho,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${ancoras.join("")}</xdr:wsDr>`,
    );
    gravar(`xl/drawings/_rels/trackco${nDesenho}.xml.rels`, rels(relDesenho));
    tipos = tipos.replace("</Types>", `<Override PartName="/${desenho}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);

    // liga o desenho à aba
    const pasta = arqAba.slice(0, arqAba.lastIndexOf("/"));
    const nomeArq = arqAba.slice(arqAba.lastIndexOf("/") + 1);
    const arqRels = `${pasta}/_rels/${nomeArq}.rels`;
    const existentes = await ler(arqRels);
    const rid = "rIdTrackcoDesenho";
    const relNova = `<Relationship Id="${rid}" Type="${T_DRAWING}" Target="../drawings/trackco${nDesenho}.xml"/>`;
    gravar(arqRels, existentes ? existentes.replace("</Relationships>", `${relNova}</Relationships>`) : rels([{ id: rid, tipo: T_DRAWING, alvo: `../drawings/trackco${nDesenho}.xml` }]));

    let xmlAba = (await ler(arqAba))!;
    if (!/xmlns:r=/.test(xmlAba.slice(0, 600))) xmlAba = xmlAba.replace("<worksheet ", `<worksheet xmlns:r="${NS_REL}" `);
    const tag = `<drawing r:id="${rid}"/>`;
    // ordem do OOXML: drawing vem depois de pageMargins/pageSetup/headerFooter e antes de legacyDrawing/tableParts/extLst
    const antesDe = ["<legacyDrawing", "<legacyDrawingHF", "<picture", "<oleObjects", "<controls", "<webPublishItems", "<tableParts", "<extLst"]
      .map((t) => xmlAba.indexOf(t))
      .filter((i) => i >= 0);
    const pos = antesDe.length ? Math.min(...antesDe) : xmlAba.lastIndexOf("</worksheet>");
    xmlAba = xmlAba.slice(0, pos) + tag + xmlAba.slice(pos);
    gravar(arqAba, xmlAba);
  }
  gravar("[Content_Types].xml", tipos);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
