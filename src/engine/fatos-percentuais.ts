// "E sabia que…": um fato do mundo com o mesmo tamanho da porcentagem que a retrospectiva mostra
// (ex.: você está entre os 15% → a gravidade da Lua é 16,5% da Terra).
//
// Regras da tabela:
// - cada faixa tem pelo menos 12 fatos, e o fato do mês sai de um contador de meses: em 12 meses seguidos
//   a mesma faixa nunca repete um fato (com mais de 12, os anos seguintes trazem fatos novos);
// - dentro de um mês, cada faixa é usada uma vez só (a segunda porcentagem da mesma faixa fica sem fato);
// - `valor` é o número citado no texto e precisa caber na faixa (o teste confere);
// - só fatos conferidos em fontes confiáveis; nada que exponha pessoas, dê má notícia ou incomode quem tem fé
//   (a IOBA é uma empresa cristã: sem origem do homem por evolução, ancestralidade animal etc.);
// - as contagens da Bíblia seguem a de 66 livros e 1.189 capítulos (a da NVI).

export interface FatoPercentual {
  /** o número que o texto cita */
  valor: number;
  emoji: string;
  texto: string;
}

export interface FaixaDeFatos {
  rotulo: string;
  /** de (inclusive) até (exclusive; a última vai até 100 inclusive) */
  de: number;
  ate: number;
  fatos: FatoPercentual[];
}

const f = (valor: number, emoji: string, texto: string): FatoPercentual => ({ valor, emoji, texto });

export const FAIXAS_DE_FATOS: FaixaDeFatos[] = [
  {
    rotulo: "1%",
    de: 0.5,
    ate: 1.5,
    fatos: [
      f(0.9, "💨", "Quase 1% do ar que respiramos é argônio, um gás de que quase ninguém se lembra."),
      f(1, "💧", "Menos de 1% da água do planeta é doce e fácil de alcançar, em rios, lagos e no subsolo."),
      f(1, "👁️", "A fóvea, o pontinho da retina que enxerga os detalhes, é só cerca de 1% da retina, mas usa metade da área visual do cérebro."),
      f(1, "🌾", "Cerca de 1% das pessoas no mundo tem doença celíaca e não pode comer glúten."),
      f(1, "🦴", "Cerca de 1% do peso do corpo é fósforo, que forma os ossos junto com o cálcio e ajuda a gerar energia."),
      f(0.8, "🩸", "Todo dia o corpo troca quase 1% das hemácias: cada uma vive cerca de 120 dias."),
      f(1.2, "🌙", "A Lua tem só cerca de 1,2% da massa da Terra e, mesmo assim, comanda as marés."),
      f(1, "🛡️", "Glóbulos brancos e plaquetas somam menos de 1% do sangue, mas cuidam de toda a defesa e da cicatrização."),
      f(1.4, "🌳", "Na Amazônia, só 1,4% das espécies de árvores (227 delas) formam metade de todas as árvores da floresta."),
      f(1.2, "🏙️", "Salvador tem cerca de 1,2% de toda a população do Brasil: são 2,4 milhões de pessoas."),
      f(1.2, "🧬", "Só pouco mais de 1% do nosso DNA guarda as receitas das proteínas; o resto organiza e regula."),
      f(0.5, "🎨", "Só cerca de 0,5% das mulheres são daltônicas."),
      f(1.2, "📖", "Só cerca de 1% do Antigo Testamento foi escrito em aramaico, a língua que Jesus falava; o resto, em hebraico."),
      f(0.57, "📖", "O Salmo 119, o maior capítulo da Bíblia, tem 176 versículos: sozinho, mais de 0,5% de todos os versículos."),
      f(1, "🍼", "O leite materno tem só cerca de 1% de proteína: a medida certa para o bebê crescer."),
      f(1, "🌍", "A crosta, a camada onde vivemos, é só cerca de 1% do volume da Terra."),
      f(0.6, "🔴", "O ar de Marte é tão rarefeito que a pressão lá é menos de 1% da nossa."),
    ],
  },
  {
    rotulo: "2%",
    de: 1.5,
    ate: 2.5,
    fatos: [
      f(2, "🧠", "O cérebro é só cerca de 2% do peso do corpo, mas gasta 20% da energia."),
      f(1.5, "🧑‍🦰", "Só cerca de 1% a 2% das pessoas no mundo são ruivas."),
      f(2, "👁️", "Só cerca de 2% das pessoas no mundo têm olhos verdes, uma das cores mais raras."),
      f(2, "🌴", "As florestas tropicais cobrem só cerca de 2% da superfície da Terra, mas abrigam mais da metade das espécies."),
      f(2, "🧪", "O fígado tem cerca de 2% do peso do corpo e faz mais de 500 tarefas, de guardar energia a limpar o sangue."),
      f(1.7, "🧊", "Cerca de 1,7% de toda a água da Terra está congelada em geleiras e calotas polares."),
      f(2, "✨", "Hidrogênio e hélio formam 98% da matéria comum do universo; todo o resto, de carbono a ouro, cabe em cerca de 2%."),
      f(2, "🥤", "Perder só 2% do peso do corpo em água já diminui a atenção e o desempenho. Já bebeu água hoje?"),
      f(1.8, "🐊", "O Pantanal ocupa menos de 2% do território brasileiro, mas é a maior planície alagável do mundo."),
      f(1.5, "🦴", "Cerca de 1,5% do peso do corpo é cálcio, quase todo guardado nos ossos e nos dentes."),
      f(2, "☕", "O café conilon tem cerca de 2% de cafeína, quase o dobro do arábica."),
      f(2.4, "📖", "Atos, o livro que conta o começo da igreja, tem 28 dos 1.189 capítulos da Bíblia: cerca de 2,4%."),
    ],
  },
  {
    rotulo: "3%",
    de: 2.5,
    ate: 4,
    fatos: [
      f(2.5, "💧", "Só cerca de 2,5% de toda a água do planeta é doce."),
      f(3.5, "🌊", "A água do mar tem cerca de 3,5% de sal: são uns 35 gramas em cada litro."),
      f(2.5, "🇧🇷", "O Brasil tem cerca de 2,5% da população do mundo: mais de 200 milhões de pessoas."),
      f(3, "🧍", "Cerca de 3% do peso do corpo é nitrogênio, que está em cada proteína e no DNA."),
      f(2.8, "🧊", "O Oceano Ártico, o menor de todos, cobre só cerca de 3% da superfície da Terra."),
      f(3, "🥛", "O leite integral tem cerca de 3% de gordura."),
      f(3.6, "🌍", "Só cerca de 3,6% das pessoas no mundo vivem fora do país onde nasceram."),
      f(2.9, "👂", "Os 6 menores ossos do corpo ficam nos ouvidos: são cerca de 3% de todos os ossos, e é com eles que você ouve."),
      f(3.5, "🪐", "No ar de Vênus, o nitrogênio, que aqui é a maior parte do ar, é só 3,5%; o resto é quase todo gás carbônico."),
      f(2.9, "🪨", "No planeta-anão Ceres, a gravidade é só cerca de 3% da Terra: um pulo comum subiria mais de 10 metros."),
      f(3.3, "☀️", "Em janeiro, a Terra fica cerca de 3% mais perto do Sol do que em julho. Não é isso que faz o verão."),
      f(2.6, "🔴", "Um dia em Marte dura só cerca de 3% a mais que o nosso: 24 horas e 37 minutos."),
      f(2.6, "📖", "Provérbios tem 31 capítulos, um para cada dia do mês: cerca de 2,6% dos capítulos da Bíblia."),
    ],
  },
  {
    rotulo: "5%",
    de: 4,
    ate: 7,
    fatos: [
      f(5, "🌌", "Tudo o que é feito de átomos, de estrelas a pessoas, é só cerca de 5% do universo."),
      f(5, "👁️", "Os cones, células da retina que enxergam as cores, são só cerca de 5% das células do olho que captam luz."),
      f(6.6, "🌴", "A Bahia ocupa cerca de 6,6% do território brasileiro: é o 5º maior estado do país."),
      f(5.7, "🗺️", "O Brasil tem cerca de 5,7% de todas as terras do planeta: é o 5º maior país do mundo."),
      f(5.5, "🪐", "Mercúrio, o planeta mais perto do Sol, tem só cerca de 5,5% da massa da Terra."),
      f(6, "🪐", "Em Plutão, a gravidade é só cerca de 6% da Terra."),
      f(4, "🎨", "Cerca de 4% das pessoas têm sinestesia: veem cores em letras ou sentem gosto em palavras."),
      f(4, "👶", "Só cerca de 4% dos bebês nascem exatamente na data prevista do parto."),
      f(5, "❤️", "O coração pesa menos de 1% do corpo, mas fica com cerca de 5% de todo o sangue que ele mesmo bombeia."),
      f(4, "😮‍💨", "O ar que sai dos pulmões tem cerca de 4% de gás carbônico, 100 vezes mais que o ar que entra."),
      f(5, "⚙️", "O ferro forma cerca de 5% da crosta da Terra."),
      f(5.5, "📖", "Isaías tem 66 capítulos, o mesmo número de livros da Bíblia: cerca de 5,5% de todos os capítulos."),
      f(4.2, "📖", "Gênesis tem 50 dos 1.189 capítulos da Bíblia: cerca de 4%."),
      f(6, "📖", "Os 4 evangelhos são só cerca de 6% dos livros da Bíblia, e contam a vida de Jesus."),
    ],
  },
  {
    rotulo: "10%",
    de: 7,
    ate: 12.5,
    fatos: [
      f(10, "🧊", "Só cerca de 10% de um iceberg fica acima da água; o resto está escondido."),
      f(10, "✍️", "Cerca de 10% das pessoas são canhotas."),
      f(9, "👁️", "Cerca de 8% a 10% das pessoas no mundo têm olhos azuis."),
      f(8, "🎨", "Cerca de 8% dos homens têm algum grau de daltonismo."),
      f(12, "🌙", "A Lua reflete só cerca de 12% da luz do Sol que recebe e, ainda assim, ilumina a noite."),
      f(10, "🧍", "Cerca de 10% do peso do corpo é hidrogênio, quase todo dentro da água."),
      f(12, "🇧🇷", "O Brasil tem cerca de 12% da água doce dos rios do planeta."),
      f(12, "🌳", "Resta cerca de 12% da Mata Atlântica original, e é na região dela que vive a maior parte dos brasileiros."),
      f(11, "🔴", "Marte tem só cerca de 11% da massa da Terra."),
      f(9.5, "🐧", "A Antártida ocupa quase 10% das terras do planeta."),
      f(8, "🪨", "O alumínio é cerca de 8% da crosta da Terra: é o metal mais comum nela."),
      f(10, "👶", "Num recém-nascido, o cérebro é cerca de 10% do peso do corpo; no adulto, só 2%."),
      f(10, "🧠", "Mito: usamos só 10% do cérebro. Na verdade, ao longo do dia, usamos praticamente ele todo."),
      f(10, "🌵", "A Caatinga cobre cerca de 10% do Brasil e é o único bioma que só existe aqui."),
      f(7, "🩸", "O sangue é cerca de 7% do peso do corpo: uns 5 litros num adulto."),
      f(7.6, "📖", "Os 5 primeiros livros da Bíblia, a Lei, são cerca de 8% dos livros."),
      f(10, "📖", "A Bíblia completa já foi traduzida para mais de 750 línguas: cerca de 10% dos idiomas do mundo."),
    ],
  },
  {
    rotulo: "15%",
    de: 12.5,
    ate: 17.5,
    fatos: [
      f(16, "🧴", "A pele é o maior órgão do corpo: cerca de 16% do peso."),
      f(16, "😮‍💨", "O ar que você expira ainda tem cerca de 16% de oxigênio. É por isso que a respiração boca a boca funciona."),
      f(16.5, "🌙", "Na Lua, a gravidade é cerca de 16,5% da Terra: quem pesa 60 kg sentiria só 10."),
      f(13, "🌳", "A Mata Atlântica ocupa cerca de 13% do território brasileiro."),
      f(17, "🏙️", "Cerca de 17% dos baianos moram em Salvador."),
      f(14, "🌕", "Na superlua, a Lua parece até 14% maior do que quando está mais longe."),
      f(15, "🦴", "Os ossos são cerca de 15% do peso do corpo."),
      f(14, "📅", "Um dia é cerca de 14% da semana, e um bom dia já muda a semana inteira."),
      f(15, "🧠", "O cérebro recebe cerca de 15% de todo o sangue que o coração bombeia."),
      f(17, "😴", "Cerca de 15% a 20% do sono de um adulto é sono profundo, a fase em que o corpo mais se recupera."),
      f(14, "🌊", "O Oceano Índico cobre cerca de 14% da superfície da Terra."),
      f(17, "🍯", "O mel tem só cerca de 17% de água. Por isso dura anos sem estragar."),
      f(14, "🫁", "A cada respiração tranquila, só cerca de 1/7 (14%) do ar dos pulmões é renovado."),
      f(12.6, "📖", "Salmos, o maior livro da Bíblia, tem 150 dos 1.189 capítulos: cerca de 13%."),
      f(15, "📖", "Os 4 evangelhos são cerca de 15% dos 27 livros do Novo Testamento."),
    ],
  },
  {
    rotulo: "20%",
    de: 17.5,
    ate: 22.5,
    fatos: [
      f(21, "💨", "O ar tem cerca de 21% de oxigênio: a medida certa para a vida acontecer."),
      f(20, "🫘", "Os rins pesam menos de 1% do corpo, mas recebem cerca de 20% do sangue a cada batida do coração."),
      f(18, "🧍", "Cerca de 18% do peso do corpo é carbono, o mesmo elemento do carvão e do diamante."),
      f(20, "🌊", "Sozinho, o Rio Amazonas leva ao mar cerca de 20% de toda a água doce que os rios do mundo despejam nos oceanos."),
      f(18, "🐦", "O Brasil tem cerca de 18% de todas as espécies de aves do mundo: quase 2 mil."),
      f(19, "🪐", "Plutão tem só cerca de 19% do diâmetro da Terra: é menor que a nossa Lua."),
      f(19, "🧠", "O córtex, a parte do cérebro que pensa e planeja, tem só cerca de 19% dos neurônios."),
      f(22, "😴", "Cerca de 20% a 25% do sono de um adulto é REM, a fase dos sonhos mais vivos."),
      f(20, "🏞️", "O Lago Baikal, na Rússia, guarda sozinho cerca de 20% da água doce de todos os lagos e rios do planeta."),
      f(21, "🌊", "O Oceano Atlântico cobre cerca de 21% da superfície da Terra."),
      f(20, "🌳", "Mito: a Amazônia produz 20% do oxigênio do mundo. Ela produz muito, mas a própria floresta consome quase tudo."),
      f(22, "🏙️", "Cerca de 1 em cada 5 brasileiros mora no estado de São Paulo, o mais populoso do país."),
      f(18, "📖", "Os 12 profetas menores, de Oseias a Malaquias, são cerca de 18% dos livros da Bíblia."),
      f(22, "📖", "O Novo Testamento tem 260 dos 1.189 capítulos da Bíblia: cerca de 22%."),
    ],
  },
  {
    rotulo: "25%",
    de: 22.5,
    ate: 27.5,
    fatos: [
      f(25, "🦶", "Cerca de 25% dos ossos do corpo ficam nos pés: são 52 de 206."),
      f(27, "🌌", "Cerca de 27% do universo é matéria escura: ninguém consegue ver, só medir o efeito dela nas galáxias."),
      f(25, "☀️", "Cerca de 25% do Sol é hélio, o mesmo gás das bexigas que flutuam."),
      f(23, "🌾", "O Cerrado cobre cerca de 23% do Brasil e é o “berço das águas”: nascem nele rios de 8 das 12 grandes bacias do país."),
      f(25, "🐠", "Os recifes de coral ocupam menos de 1% do fundo do mar, mas abrigam cerca de 25% das espécies marinhas."),
      f(24, "⛰️", "As montanhas cobrem cerca de 1/4 das terras do planeta."),
      f(27, "🌙", "A Lua tem cerca de 27% do diâmetro da Terra."),
      f(24, "🪐", "Um ano em Mercúrio dura só 88 dias: cerca de 24% do nosso."),
      f(25, "🌊", "Os oceanos absorvem cerca de 25% do gás carbônico que a humanidade solta no ar."),
      f(24.25, "📆", "Quase exatamente 25% dos anos são bissextos: são 97 a cada 400 anos, ou 24,25%."),
      f(25, "👶", "Ao nascer, o cérebro tem cerca de 1/4 do tamanho que terá na vida adulta."),
      f(23, "💧", "Cerca de 23% da energia do Sol que chega à Terra é gasta evaporando água. É o motor das chuvas."),
      f(25, "🫀", "O fígado recebe cerca de 25% de todo o sangue que o coração bombeia."),
      f(25, "🍎", "Uma maçã boia na água porque cerca de 25% dela é ar."),
      f(25, "🤧", "Cerca de 1 em cada 4 pessoas espirra ao olhar para uma luz forte: é o reflexo fótico."),
      f(26, "🌴", "Cerca de 1 em cada 4 nordestinos mora na Bahia."),
      f(27, "📖", "Lucas escreveu o evangelho de Lucas e Atos: cerca de 27% do Novo Testamento, mais do que qualquer outro autor."),
      f(27, "📖", "Cerca de 27% dos versículos da Bíblia trazem profecias."),
    ],
  },
  {
    rotulo: "30%",
    de: 27.5,
    ate: 35,
    fatos: [
      f(29, "🌍", "Só cerca de 29% da superfície da Terra é terra firme. É nela que cabem todas as cidades do mundo."),
      f(33, "😴", "Passamos cerca de 1/3 da vida dormindo, e é aí que o cérebro organiza o que aprendeu."),
      f(30, "🌍", "A Terra devolve para o espaço cerca de 30% da luz do Sol que recebe."),
      f(34, "👓", "Cerca de 1 em cada 3 pessoas no mundo é míope, e até 2050 podem ser metade."),
      f(32, "🌊", "O Oceano Pacífico cobre cerca de 1/3 da Terra: é maior que todos os continentes juntos."),
      f(34, "🧂", "O Mar Morto tem cerca de 34% de sal, quase 10 vezes mais que o oceano. Por isso todo mundo boia."),
      f(28, "🪨", "O silício forma cerca de 28% da crosta da Terra: é a base da areia e dos chips."),
      f(30, "🌕", "Na superlua, a Lua pode brilhar até 30% mais do que quando está mais longe."),
      f(30, "💧", "Cerca de 30% da água doce do planeta está debaixo da terra, nos aquíferos."),
      f(31, "🌲", "As florestas cobrem cerca de 31% das terras do planeta."),
      f(30, "👁️", "Cerca de 30% do córtex do cérebro trabalha com a visão, muito mais do que com o tato ou a audição."),
      f(33, "🏜️", "Cerca de 1/3 das terras do planeta é deserto, contando os gelados, como a Antártida."),
      f(28, "🔴", "A superfície de Marte é só cerca de 28% da Terra: mais ou menos todas as nossas terras juntas."),
      f(32, "🌍", "O núcleo da Terra tem cerca de 1/3 da massa do planeta."),
      f(30, "🐪", "O Saara ocupa cerca de 30% da África."),
      f(31, "🌙", "Os “mares” escuros da Lua cobrem cerca de 31% do lado que vemos, e não têm uma gota d'água."),
      f(33, "📖", "Cerca de 1/3 dos ensinamentos de Jesus nos evangelhos foram contados em parábolas."),
      f(33, "📖", "Cerca de 1/3 dos evangelhos conta a última semana de Jesus, da entrada em Jerusalém à ressurreição."),
    ],
  },
  {
    rotulo: "40%",
    de: 35,
    ate: 45,
    fatos: [
      f(38, "🔴", "Em Marte, a gravidade é cerca de 38% da Terra: daria para pular mais de duas vezes e meia mais alto."),
      f(38, "🪐", "Mercúrio é bem menor que Marte, mas tem quase a mesma gravidade: cerca de 38% da Terra."),
      f(40, "💪", "Os músculos são cerca de 40% do peso do corpo."),
      f(37, "☕", "O Brasil colhe mais de 1/3 de todo o café do mundo e é o maior produtor há mais de 150 anos."),
      f(44, "🌈", "Cerca de 44% da energia do Sol que chega ao chão é luz visível, justamente a faixa que nossos olhos enxergam."),
      f(40, "🧒", "Por volta dos 5 anos, o cérebro de uma criança gasta cerca de 40% de toda a energia do corpo."),
      f(43, "🔴", "Marte, mais longe do Sol, recebe só cerca de 43% da luz que chega à Terra."),
      f(42, "🩸", "Cerca de 40% a 45% do sangue são glóbulos vermelhos, que levam oxigênio para o corpo todo."),
      f(41, "🌙", "Cerca de 41% da Lua nunca aparece para quem está na Terra."),
      f(40, "🏖️", "Cerca de 40% das pessoas do mundo vivem a até 100 km do mar, como quem mora em Salvador."),
      f(40, "🌊", "A bacia do Rio Amazonas cobre cerca de 40% da América do Sul."),
      f(37, "🚜", "Cerca de 37% das terras do planeta são usadas para plantar e criar animais."),
      f(41, "📖", "O Novo Testamento tem 27 dos 66 livros da Bíblia: cerca de 41%."),
    ],
  },
  {
    rotulo: "50%",
    de: 45,
    ate: 55,
    fatos: [
      f(50, "⚖️", "No equinócio, dia e noite dividem quase exatamente 50% do tempo em todo o planeta."),
      f(51, "🖐️", "Mãos e pés juntos têm mais da metade dos ossos do corpo: 106 de 206."),
      f(49, "🌳", "A Amazônia cobre cerca de 49% do território brasileiro."),
      f(50, "🐬", "Os golfinhos dormem com só 50% do cérebro de cada vez: a outra metade fica de olho."),
      f(47, "💭", "Um estudo de Harvard viu que passamos cerca de 47% do tempo acordados pensando em outra coisa."),
      f(47, "🗺️", "O Brasil ocupa cerca de 47% da América do Sul."),
      f(49, "⚡", "Cerca de 49% de toda a energia usada no Brasil vem de fontes renováveis; no mundo, são uns 15%."),
      f(46, "🪨", "O oxigênio forma cerca de 46% da crosta da Terra, preso nas rochas, não no ar."),
      f(53, "🔴", "Marte tem cerca de 53% do diâmetro da Terra."),
      f(50, "☀️", "Cerca de metade da energia do Sol que chega ao chão é infravermelho: calor que nossos olhos não veem."),
      f(50, "👶", "Recém-nascidos passam cerca de 50% do sono em REM, o dobro dos adultos."),
      f(50, "🌊", "Cerca de metade do oxigênio que respiramos é produzido no mar, por algas microscópicas."),
      f(50, "🧬", "Metade dos seus cromossomos veio da sua mãe, e a outra metade, do seu pai."),
      f(48, "📖", "Paulo escreveu 13 dos 27 livros do Novo Testamento: quase metade."),
      f(51, "📖", "Cerca de metade das línguas do mundo já tem pelo menos uma parte da Bíblia traduzida."),
    ],
  },
  {
    rotulo: "60%",
    de: 55,
    ate: 65,
    fatos: [
      f(60, "💧", "Cerca de 60% do corpo de um adulto é água."),
      f(55, "🩸", "Cerca de 55% do sangue é plasma, o líquido que leva nutrientes, hormônios e defesas."),
      f(59, "🌙", "Graças a um leve “balanço” da Lua, daqui da Terra vemos cerca de 59% da superfície dela, e não só a metade."),
      f(59, "🇧🇷", "A Amazônia Legal cobre cerca de 59% do território brasileiro."),
      f(57, "🏙️", "Cerca de 57% das pessoas do mundo vivem em cidades."),
      f(58, "💍", "O ouro 14 quilates tem cerca de 58% de ouro puro; o resto são outros metais."),
      f(60, "⚽", "Num jogo de futebol de 90 minutos, a bola rola de verdade só uns 55 minutos: cerca de 60% do tempo."),
      f(60, "🧠", "Tirando a água, cerca de 60% do cérebro é gordura."),
      f(60, "🌳", "Cerca de 60% da Floresta Amazônica fica no Brasil."),
      f(59, "🌏", "Quase 60% de todas as pessoas do mundo vivem na Ásia."),
      f(60, "💡", "Cerca de 60% da eletricidade do Brasil vem das hidrelétricas."),
      f(61, "🌐", "Cerca de 61% do Hemisfério Norte é coberto por oceano."),
      f(64, "🧴", "A pele é cerca de 64% água."),
      f(61, "🐧", "A Antártida guarda, em gelo, cerca de 61% de toda a água doce do planeta."),
      f(59, "📖", "O Antigo Testamento tem 39 dos 66 livros da Bíblia: cerca de 59%."),
    ],
  },
  {
    rotulo: "70%",
    de: 65,
    ate: 72.5,
    fatos: [
      f(71, "🌊", "Cerca de 71% da superfície da Terra é coberta por oceanos."),
      f(65, "🧍", "Cerca de 65% do peso do corpo é oxigênio, a maior parte dentro da água."),
      f(69, "🧊", "Cerca de 69% da água doce do planeta está congelada em geleiras e calotas polares."),
      f(67, "👁️", "A córnea faz cerca de 2/3 do foco do olho; o cristalino ajusta o resto."),
      f(70, "👁️", "Cerca de 70% dos receptores sensoriais do corpo ficam nos olhos."),
      f(67, "☁️", "A qualquer momento, cerca de 2/3 da Terra estão cobertos por nuvens."),
      f(67, "🌋", "O manto, a camada entre a crosta e o núcleo, tem cerca de 2/3 da massa da Terra."),
      f(67, "🐈", "Gatos dormem até 16 horas por dia: cerca de 2/3 do tempo."),
      f(68, "🌌", "Cerca de 68% do universo é energia escura, um dos maiores mistérios que os cientistas ainda tentam entender."),
      f(67, "🦴", "Cerca de 2/3 do peso dos ossos é mineral, principalmente cálcio e fósforo."),
      f(70, "🌾", "Cerca de 70% da água doce que a humanidade usa vai para a agricultura."),
      f(70, "👶", "Ao nascer, os olhos já têm cerca de 70% do tamanho que terão na vida adulta."),
      f(70, "🍫", "No chocolate “70%”, 70% do peso vem do cacau."),
      f(67, "🍼", "Um recém-nascido dorme de 14 a 17 horas por dia: cerca de 2/3 do tempo."),
    ],
  },
  {
    rotulo: "75%",
    de: 72.5,
    ate: 77.5,
    fatos: [
      f(73, "☀️", "Cerca de 3/4 do Sol é hidrogênio, o combustível que o faz brilhar."),
      f(75, "🧠", "Cerca de 75% do cérebro é água."),
      f(75, "👶", "O corpo de um bebê é cerca de 75% água."),
      f(75, "💍", "O ouro 18 quilates tem 75% de ouro puro."),
      f(75, "🍌", "A banana é cerca de 75% água."),
      f(75, "🐝", "Cerca de 75% das plantações de alimento do mundo dependem, ao menos em parte, de abelhas e outros polinizadores."),
      f(75, "🏥", "Cerca de 75% dos brasileiros dependem só do SUS para cuidar da saúde."),
      f(75, "🌋", "Cerca de 75% dos vulcões do planeta ficam no Círculo de Fogo, em volta do Pacífico."),
      f(75, "🥚", "Cerca de 75% de um ovo é água."),
      f(75, "🐞", "Cerca de 3/4 das espécies de animais conhecidas são insetos."),
      f(74, "🌊", "Cerca de 3/4 do fundo do mar ainda não foram mapeados em detalhe."),
      f(75, "👁️", "Entre 70% e 80% das pessoas no mundo têm olhos castanhos."),
    ],
  },
  {
    rotulo: "80%",
    de: 77.5,
    ate: 85,
    fatos: [
      f(78, "💨", "Cerca de 78% do ar é nitrogênio, o gás que dá estabilidade à atmosfera."),
      f(82, "🪐", "Vênus tem cerca de 82% da massa da Terra: é quase um planeta gêmeo."),
      f(80, "🧠", "Cerca de 80% dos neurônios ficam no cerebelo, que tem só 10% do volume do cérebro. Quem contou foi a brasileira Suzana Herculano-Houzel."),
      f(80, "👁️", "Cerca de 80% do volume do olho é o humor vítreo, um gel transparente."),
      f(84, "🩸", "Das cerca de 30 trilhões de células do corpo, uns 84% são glóbulos vermelhos."),
      f(81, "🌊", "No Hemisfério Sul, o nosso, cerca de 81% da superfície é oceano."),
      f(80, "🚢", "Cerca de 80% de tudo o que se compra e vende no mundo viaja de navio."),
      f(80, "🍯", "O mel é cerca de 80% açúcar natural."),
      f(83, "🐨", "Os coalas dormem até 20 horas por dia: mais de 80% do tempo."),
      f(83, "🫁", "Os pulmões, mesmo cheios de ar, são cerca de 83% água."),
      f(80, "🎯", "Pela regra de Pareto, muitas vezes 80% dos resultados vêm de 20% das ações. O segredo é saber quais."),
      f(83, "✈️", "Aviões comerciais voam a cerca de 80% a 85% da velocidade do som."),
      f(84, "🌌", "Cerca de 84% de toda a matéria do universo é matéria escura."),
      f(80, "🌲", "As florestas abrigam cerca de 80% das espécies de animais e plantas da terra firme."),
      f(78, "📖", "O Antigo Testamento tem 929 dos 1.189 capítulos da Bíblia: cerca de 78%."),
      f(84, "📖", "Cerca de 84% dos brasileiros se declaram cristãos, segundo o Censo de 2022."),
    ],
  },
  {
    rotulo: "90%",
    de: 85,
    ate: 95,
    fatos: [
      f(92, "🍉", "A melancia é cerca de 92% água."),
      f(87, "🍼", "O leite materno é cerca de 87% água."),
      f(92, "🩸", "O plasma do sangue é cerca de 92% água."),
      f(88, "📱", "Cerca de 88% dos brasileiros com 10 anos ou mais usam a internet."),
      f(90, "🪐", "Em Vênus, a gravidade é cerca de 90% da Terra: você quase não sentiria diferença."),
      f(90, "🌋", "Cerca de 90% dos terremotos do mundo acontecem no Círculo de Fogo do Pacífico."),
      f(90, "🐧", "Cerca de 90% de todo o gelo do planeta está na Antártida."),
      f(90, "🌎", "Cerca de 90% das pessoas do mundo vivem no Hemisfério Norte; nós, no Sul, somos a minoria."),
      f(90, "🏠", "Passamos cerca de 90% do tempo em ambientes fechados."),
      f(90, "👁️", "Cerca de 90% da perda de visão no mundo poderia ser evitada ou tratada. Cada consulta marcada conta."),
      f(90, "🌡️", "Mais de 90% do calor extra do aquecimento global foi absorvido pelos oceanos."),
      f(93, "🌊", "Cerca de 93% do gás carbônico da Terra está guardado nos oceanos."),
      f(94.9, "🪐", "Vênus tem quase 95% do diâmetro da Terra."),
      f(90, "📖", "Cerca de 90% do evangelho de Marcos também aparece no de Mateus."),
    ],
  },
  {
    rotulo: "95% a 100%",
    de: 95,
    ate: 100,
    fatos: [
      f(99.9, "🥇", "O ouro 24 quilates tem 99,9% de pureza: o padrão máximo."),
      f(99.8, "☀️", "O Sol tem 99,8% de toda a massa do Sistema Solar."),
      f(97, "🌊", "Cerca de 97% da água da Terra está nos oceanos."),
      f(96, "🥒", "O pepino é cerca de 96% água."),
      f(95, "🔴", "O ar de Marte é cerca de 95% gás carbônico."),
      f(95, "👁️", "Cerca de 95% das células que captam luz na retina são bastonetes, que enxergam no escuro."),
      f(96, "🦷", "O esmalte dos dentes é cerca de 96% mineral: a parte mais dura do corpo."),
      f(98, "💧", "As lágrimas são cerca de 98% água."),
      f(99.9, "🧬", "Quaisquer duas pessoas têm cerca de 99,9% do DNA igual. O 0,1% que sobra faz cada um ser único."),
      f(99.99, "⚛️", "Um átomo é mais de 99,99% espaço vazio."),
      f(96, "🧍", "Só 4 elementos, oxigênio, carbono, hidrogênio e nitrogênio, somam cerca de 96% do peso do corpo."),
      f(95, "📖", "O livro de Isaías achado nos Manuscritos do Mar Morto tem mais de 2 mil anos e é mais de 95% igual ao das Bíblias de hoje."),
    ],
  },
];

/** Posição da faixa de uma porcentagem (-1 se for pequena demais ou passar de 100). */
export function faixaDoPercentual(p: number): number {
  if (!Number.isFinite(p)) return -1;
  return FAIXAS_DE_FATOS.findIndex((x, i) => p >= x.de && (p < x.ate || (i === FAIXAS_DE_FATOS.length - 1 && p <= x.ate)));
}

/** Contador de meses ("2026-10" → 2026×12 + 9): meses seguidos dão posições seguidas. */
function contadorDoMes(comp: string): number {
  const [a, m] = comp.split("-").map(Number);
  return a * 12 + (m - 1);
}

/** O fato de uma faixa num mês: 12 meses seguidos nunca repetem (cada faixa tem pelo menos 12 fatos). */
export function fatoDaFaixa(faixa: number, comp: string): FatoPercentual {
  const fatos = FAIXAS_DE_FATOS[faixa].fatos;
  return fatos[contadorDoMes(comp) % fatos.length];
}

/**
 * Um fato para cada porcentagem que a retrospectiva do mês mostra, em ordem de prioridade.
 * A mesma faixa só sai uma vez por mês: a segunda porcentagem da mesma faixa fica sem fato
 * (um fato de outra faixa citaria um número diferente do da tela). Assim ninguém vê o mesmo fato
 * duas vezes em 12 meses seguidos.
 */
export function fatosDoMes(percentuais: (number | null | undefined)[], comp: string): (FatoPercentual | null)[] {
  const usadas = new Set<number>();
  return percentuais.map((p) => {
    if (p === null || p === undefined) return null;
    const i = faixaDoPercentual(p);
    if (i < 0 || usadas.has(i)) return null;
    usadas.add(i);
    return fatoDaFaixa(i, comp);
  });
}
