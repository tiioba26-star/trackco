// "E sabia que…": uma tela inteira com um fato do mundo que tem EXATAMENTE a mesma porcentagem
// que a retrospectiva mostrou (ex.: você está nos 25% do topo → 25% dos ossos do corpo ficam nos pés).
//
// De onde vem o fato:
// 1. Fatos reais conferidos (FATOS_EXATOS), cada um citando o número inteiro no texto.
// 2. Quando não há fato real com aquele número, um fato calculado com o número exato (MODELOS):
//    "25% da Bíblia são 297 capítulos: lendo desde Gênesis, você chegaria a 1 Samuel 18".
//
// Para nunca repetir em 12 meses seguidos, mesmo que a pessoa tire a mesma porcentagem todo mês:
// - o mês define uma posição (contador de meses);
// - se a posição (contador % 12) existe entre os fatos reais daquele número, usa ele;
// - senão usa o modelo da vez (contador % número de modelos, que são mais de 12 e valem para 1% a 100%).
// Fatos reais de números diferentes nunca se misturam, e o texto do modelo traz o número, então
// porcentagens diferentes também dão textos diferentes.
//
// Cuidados: só fatos conferidos em fontes confiáveis; nada que exponha pessoas, dê má notícia ou
// incomode quem tem fé (a IOBA é uma empresa cristã: sem origem do homem por evolução, ancestralidade
// animal etc.). As contagens da Bíblia seguem a de 66 livros e 1.189 capítulos (a da NVI).

/** Foto de fundo de cada tema (arquivos em public/retrospectiva/fundos). */
export type TemaFoto =
  | "agua" | "bebe" | "biblia" | "brasil" | "cafe" | "campo" | "celular" | "cerebro" | "ceu" | "chocolate"
  | "coala" | "coracao" | "corrida" | "cristo" | "deserto" | "espaco" | "estadio" | "floresta" | "frutas" | "gato"
  | "gelo" | "golfinho" | "lua" | "luz" | "manuscrito" | "marte" | "mel" | "montanha" | "oceano" | "olho"
  | "ossos" | "ouro" | "relogio" | "salvador" | "sol" | "terra" | "vulcao";

export interface FatoPercentual {
  /** o número inteiro que o texto cita (igual ao da tela) */
  valor: number;
  emoji: string;
  tema: TemaFoto;
  texto: string;
}

const f = (valor: number, emoji: string, tema: TemaFoto, texto: string): FatoPercentual => ({ valor, emoji, tema, texto });

export const FATOS_EXATOS: FatoPercentual[] = [
  f(1, "💨", "ceu", "Cerca de 1% do ar que respiramos é argônio, um gás de que quase ninguém se lembra."),
  f(1, "💧", "agua", "Menos de 1% da água do planeta é doce e fácil de alcançar, em rios, lagos e no subsolo."),
  f(1, "👁️", "olho", "A fóvea, o pontinho da retina que enxerga os detalhes, é só cerca de 1% da retina, mas usa metade da área visual do cérebro."),
  f(1, "🌾", "campo", "Cerca de 1% das pessoas no mundo tem doença celíaca e não pode comer glúten."),
  f(1, "🦴", "ossos", "Cerca de 1% do peso do corpo é fósforo, que forma os ossos junto com o cálcio e ajuda a gerar energia."),
  f(1, "🩸", "coracao", "Todo dia o corpo troca cerca de 1% das hemácias: cada uma vive uns 120 dias."),
  f(1, "🌙", "lua", "A Lua tem só cerca de 1% da massa da Terra e, mesmo assim, comanda as marés."),
  f(1, "🛡️", "coracao", "Glóbulos brancos e plaquetas somam menos de 1% do sangue, mas cuidam de toda a defesa e da cicatrização."),
  f(1, "🌳", "floresta", "Na Amazônia, só cerca de 1% das espécies de árvores (227 delas) formam metade de todas as árvores da floresta."),
  f(1, "🏙️", "salvador", "Salvador tem cerca de 1% de toda a população do Brasil: são 2,4 milhões de pessoas."),
  f(1, "🧬", "bebe", "Só cerca de 1% do nosso DNA guarda as receitas das proteínas; o resto organiza e regula."),
  f(1, "📖", "biblia", "Só cerca de 1% do Antigo Testamento foi escrito em aramaico, a língua que Jesus falava; o resto, em hebraico."),
  f(1, "🍼", "bebe", "O leite materno tem só cerca de 1% de proteína: a medida certa para o bebê crescer."),
  f(1, "🌍", "terra", "A crosta, a camada onde vivemos, é só cerca de 1% do volume da Terra."),
  f(2, "🧠", "cerebro", "O cérebro é só cerca de 2% do peso do corpo, mas gasta 20% da energia."),
  f(2, "🧑‍🦰", "salvador", "Só cerca de 2% das pessoas no mundo são ruivas."),
  f(2, "👁️", "olho", "Só cerca de 2% das pessoas no mundo têm olhos verdes, uma das cores mais raras."),
  f(2, "🌴", "floresta", "As florestas tropicais cobrem só cerca de 2% da superfície da Terra, mas abrigam mais da metade das espécies."),
  f(2, "🧪", "coracao", "O fígado tem cerca de 2% do peso do corpo e faz mais de 500 tarefas, de guardar energia a limpar o sangue."),
  f(2, "🧊", "gelo", "Cerca de 2% de toda a água da Terra está congelada em geleiras e calotas polares."),
  f(2, "✨", "espaco", "Hidrogênio e hélio formam 98% da matéria comum do universo; todo o resto, de carbono a ouro, cabe em cerca de 2%."),
  f(2, "🥤", "agua", "Perder só 2% do peso do corpo em água já diminui a atenção e o desempenho. Já bebeu água hoje?"),
  f(2, "🐊", "floresta", "O Pantanal ocupa cerca de 2% do território brasileiro e é a maior planície alagável do mundo."),
  f(2, "🦴", "ossos", "Cerca de 2% do peso do corpo é cálcio, quase todo guardado nos ossos e nos dentes."),
  f(2, "☕", "cafe", "O café conilon tem cerca de 2% de cafeína, quase o dobro do arábica."),
  f(2, "📖", "biblia", "Atos, o livro que conta o começo da igreja, tem 28 dos 1.189 capítulos da Bíblia: cerca de 2%."),
  f(3, "💧", "agua", "Só cerca de 3% de toda a água do planeta é doce; o resto é salgada."),
  f(3, "🧍", "ossos", "Cerca de 3% do peso do corpo é nitrogênio, que está em cada proteína e no DNA."),
  f(3, "🧊", "gelo", "O Oceano Ártico, o menor de todos, cobre só cerca de 3% da superfície da Terra."),
  f(3, "🥛", "agua", "O leite integral tem cerca de 3% de gordura."),
  f(3, "👂", "ossos", "Os 6 menores ossos do corpo ficam nos ouvidos: são cerca de 3% de todos os ossos, e é com eles que você ouve."),
  f(3, "🪨", "montanha", "No planeta-anão Ceres, a gravidade é só cerca de 3% da Terra: um pulo comum subiria mais de 10 metros."),
  f(3, "☀️", "sol", "Em janeiro, a Terra fica cerca de 3% mais perto do Sol do que em julho. Não é isso que faz o verão."),
  f(3, "🔴", "marte", "Um dia em Marte dura só cerca de 3% a mais que o nosso: 24 horas e 37 minutos."),
  f(3, "📖", "biblia", "Provérbios tem 31 capítulos, um para cada dia do mês: cerca de 3% dos capítulos da Bíblia."),
  f(4, "🌍", "terra", "Só cerca de 4% das pessoas no mundo vivem fora do país onde nasceram."),
  f(4, "🎨", "olho", "Cerca de 4% das pessoas têm sinestesia: veem cores em letras ou sentem gosto em palavras."),
  f(4, "👶", "bebe", "Só cerca de 4% dos bebês nascem exatamente na data prevista do parto."),
  f(4, "😮‍💨", "ceu", "O ar que sai dos pulmões tem cerca de 4% de gás carbônico, 100 vezes mais que o ar que entra."),
  f(4, "📖", "biblia", "Gênesis tem 50 dos 1.189 capítulos da Bíblia: cerca de 4%."),
  f(5, "🌌", "espaco", "Tudo o que é feito de átomos, de estrelas a pessoas, é só cerca de 5% do universo."),
  f(5, "👁️", "olho", "Os cones, células da retina que enxergam as cores, são só cerca de 5% das células do olho que captam luz."),
  f(5, "❤️", "coracao", "O coração pesa menos de 1% do corpo, mas fica com cerca de 5% de todo o sangue que ele mesmo bombeia."),
  f(5, "⚙️", "montanha", "O ferro forma cerca de 5% da crosta da Terra."),
  f(6, "🗺️", "brasil", "O Brasil tem cerca de 6% de todas as terras do planeta: é o 5º maior país do mundo."),
  f(6, "🪐", "espaco", "Mercúrio, o planeta mais perto do Sol, tem só cerca de 6% da massa da Terra."),
  f(6, "🪐", "espaco", "Em Plutão, a gravidade é só cerca de 6% da Terra."),
  f(6, "📖", "biblia", "Isaías tem 66 capítulos, o mesmo número de livros da Bíblia: cerca de 6% de todos os capítulos."),
  f(6, "📖", "biblia", "Os 4 evangelhos são só cerca de 6% dos livros da Bíblia, e contam a vida de Jesus."),
  f(7, "🌴", "salvador", "A Bahia ocupa cerca de 7% do território brasileiro: é o 5º maior estado do país."),
  f(7, "🩸", "coracao", "O sangue é cerca de 7% do peso do corpo: uns 5 litros num adulto."),
  f(8, "🎨", "olho", "Cerca de 8% dos homens têm algum grau de daltonismo."),
  f(8, "🪨", "montanha", "O alumínio é cerca de 8% da crosta da Terra: é o metal mais comum nela."),
  f(8, "📖", "biblia", "Os 5 primeiros livros da Bíblia, a Lei, são cerca de 8% dos livros."),
  f(9, "👁️", "olho", "Cerca de 9% das pessoas no mundo têm olhos azuis."),
  f(10, "🧊", "gelo", "Só cerca de 10% de um iceberg fica acima da água; o resto está escondido."),
  f(10, "✍️", "salvador", "Cerca de 10% das pessoas são canhotas."),
  f(10, "🧍", "ossos", "Cerca de 10% do peso do corpo é hidrogênio, quase todo dentro da água."),
  f(10, "🐧", "gelo", "A Antártida ocupa cerca de 10% das terras do planeta."),
  f(10, "👶", "bebe", "Num recém-nascido, o cérebro é cerca de 10% do peso do corpo; no adulto, só 2%."),
  f(10, "🧠", "cerebro", "Mito: usamos só 10% do cérebro. Na verdade, ao longo do dia, usamos praticamente ele todo."),
  f(10, "🌵", "deserto", "A Caatinga cobre cerca de 10% do Brasil e é o único bioma que só existe aqui."),
  f(10, "📖", "biblia", "A Bíblia completa já foi traduzida para mais de 750 línguas: cerca de 10% dos idiomas do mundo."),
  f(11, "🔴", "marte", "Marte tem só cerca de 11% da massa da Terra."),
  f(12, "🌙", "lua", "A Lua reflete só cerca de 12% da luz do Sol que recebe e, ainda assim, ilumina a noite."),
  f(12, "🇧🇷", "brasil", "O Brasil tem cerca de 12% da água doce dos rios do planeta."),
  f(12, "🌳", "floresta", "Resta cerca de 12% da Mata Atlântica original, e é na região dela que vive a maior parte dos brasileiros."),
  f(13, "🌳", "floresta", "A Mata Atlântica ocupa cerca de 13% do território brasileiro."),
  f(13, "📖", "biblia", "Salmos, o maior livro da Bíblia, tem 150 dos 1.189 capítulos: cerca de 13%."),
  f(14, "🌕", "lua", "Na superlua, a Lua parece até 14% maior do que quando está mais longe."),
  f(14, "📅", "relogio", "Um dia é cerca de 14% da semana, e um bom dia já muda a semana inteira."),
  f(14, "🌊", "oceano", "O Oceano Índico cobre cerca de 14% da superfície da Terra."),
  f(14, "🫁", "ceu", "A cada respiração tranquila, só cerca de 1/7 (14%) do ar dos pulmões é renovado."),
  f(15, "🦴", "ossos", "Os ossos são cerca de 15% do peso do corpo."),
  f(15, "🧠", "cerebro", "O cérebro recebe cerca de 15% de todo o sangue que o coração bombeia."),
  f(15, "📖", "biblia", "Os 4 evangelhos são cerca de 15% dos 27 livros do Novo Testamento."),
  f(16, "🧴", "bebe", "A pele é o maior órgão do corpo: cerca de 16% do peso."),
  f(16, "😮‍💨", "ceu", "O ar que você expira ainda tem cerca de 16% de oxigênio. É por isso que a respiração boca a boca funciona."),
  f(17, "🌙", "lua", "Na Lua, a gravidade é cerca de 17% da Terra: quem pesa 60 kg sentiria só uns 10."),
  f(17, "🏙️", "salvador", "Cerca de 17% dos baianos moram em Salvador."),
  f(17, "🍯", "mel", "O mel tem só cerca de 17% de água. Por isso dura anos sem estragar."),
  f(18, "🧍", "ossos", "Cerca de 18% do peso do corpo é carbono, o mesmo elemento do carvão e do diamante."),
  f(18, "🐦", "floresta", "O Brasil tem cerca de 18% de todas as espécies de aves do mundo: quase 2 mil."),
  f(18, "📖", "biblia", "Os 12 profetas menores, de Oseias a Malaquias, são cerca de 18% dos livros da Bíblia."),
  f(19, "🪐", "espaco", "Plutão tem só cerca de 19% do diâmetro da Terra: é menor que a nossa Lua."),
  f(19, "🧠", "cerebro", "O córtex, a parte do cérebro que pensa e planeja, tem só cerca de 19% dos neurônios."),
  f(20, "🫘", "coracao", "Os rins pesam menos de 1% do corpo, mas recebem cerca de 20% do sangue a cada batida do coração."),
  f(20, "🌊", "oceano", "Sozinho, o Rio Amazonas leva ao mar cerca de 20% de toda a água doce que os rios do mundo despejam nos oceanos."),
  f(20, "🏞️", "agua", "O Lago Baikal, na Rússia, guarda sozinho cerca de 20% da água doce de todos os lagos e rios do planeta."),
  f(20, "🌳", "floresta", "Mito: a Amazônia produz 20% do oxigênio do mundo. Ela produz muito, mas a própria floresta consome quase tudo."),
  f(21, "💨", "ceu", "O ar tem cerca de 21% de oxigênio: a medida certa para a vida acontecer."),
  f(21, "🌊", "oceano", "O Oceano Atlântico cobre cerca de 21% da superfície da Terra."),
  f(22, "🏙️", "salvador", "Cerca de 22% dos brasileiros moram no estado de São Paulo, o mais populoso do país."),
  f(22, "📖", "biblia", "O Novo Testamento tem 260 dos 1.189 capítulos da Bíblia: cerca de 22%."),
  f(23, "🌾", "campo", "O Cerrado cobre cerca de 23% do Brasil e é o “berço das águas”: nascem nele rios de 8 das 12 grandes bacias do país."),
  f(23, "💧", "agua", "Cerca de 23% da energia do Sol que chega à Terra é gasta evaporando água. É o motor das chuvas."),
  f(24, "⛰️", "montanha", "As montanhas cobrem cerca de 24% das terras do planeta."),
  f(24, "🪐", "espaco", "Um ano em Mercúrio dura só 88 dias: cerca de 24% do nosso."),
  f(24, "📆", "terra", "Nem todo ano múltiplo de 4 é bissexto: são 97 a cada 400 anos, cerca de 24%."),
  f(25, "🦶", "ossos", "Cerca de 25% dos ossos do corpo ficam nos pés: são 52 de 206."),
  f(25, "☀️", "sol", "Cerca de 25% do Sol é hélio, o mesmo gás das bexigas que flutuam."),
  f(25, "🐠", "oceano", "Os recifes de coral ocupam menos de 1% do fundo do mar, mas abrigam cerca de 25% das espécies marinhas."),
  f(25, "🌊", "oceano", "Os oceanos absorvem cerca de 25% do gás carbônico que a humanidade solta no ar."),
  f(25, "👶", "bebe", "Ao nascer, o cérebro tem cerca de 25% do tamanho que terá na vida adulta."),
  f(25, "🫀", "coracao", "O fígado recebe cerca de 25% de todo o sangue que o coração bombeia."),
  f(25, "🍎", "frutas", "Uma maçã boia na água porque cerca de 25% dela é ar."),
  f(25, "🤧", "olho", "Cerca de 25% das pessoas espirram ao olhar para uma luz forte: é o reflexo fótico."),
  f(26, "🌴", "salvador", "Cerca de 26% dos nordestinos moram na Bahia."),
  f(27, "🌌", "espaco", "Cerca de 27% do universo é matéria escura: ninguém consegue ver, só medir o efeito dela nas galáxias."),
  f(27, "🌙", "lua", "A Lua tem cerca de 27% do diâmetro da Terra."),
  f(27, "📖", "biblia", "Lucas escreveu o evangelho de Lucas e Atos: cerca de 27% do Novo Testamento, mais do que qualquer outro autor."),
  f(27, "📖", "biblia", "Cerca de 27% dos versículos da Bíblia trazem profecias."),
  f(28, "🪨", "montanha", "O silício forma cerca de 28% da crosta da Terra: é a base da areia e dos chips."),
  f(28, "🔴", "marte", "A superfície de Marte é só cerca de 28% da Terra: mais ou menos todas as nossas terras juntas."),
  f(29, "🌍", "terra", "Só cerca de 29% da superfície da Terra é terra firme. É nela que cabem todas as cidades do mundo."),
  f(30, "🌍", "terra", "A Terra devolve para o espaço cerca de 30% da luz do Sol que recebe."),
  f(30, "🌕", "lua", "Na superlua, a Lua pode brilhar até 30% mais do que quando está mais longe."),
  f(30, "💧", "agua", "Cerca de 30% da água doce do planeta está debaixo da terra, nos aquíferos."),
  f(30, "👁️", "olho", "Cerca de 30% do córtex do cérebro trabalha com a visão, muito mais do que com o tato ou a audição."),
  f(30, "🐪", "deserto", "O Saara ocupa cerca de 30% da África."),
  f(31, "🌲", "floresta", "As florestas cobrem cerca de 31% das terras do planeta."),
  f(31, "🌙", "lua", "Os “mares” escuros da Lua cobrem cerca de 31% do lado que vemos, e não têm uma gota d'água."),
  f(32, "🌊", "oceano", "O Oceano Pacífico cobre cerca de 32% da Terra: é maior que todos os continentes juntos."),
  f(32, "🌍", "terra", "O núcleo da Terra tem cerca de 32% da massa do planeta."),
  f(33, "😴", "lua", "Passamos cerca de 33% da vida dormindo, e é aí que o cérebro organiza o que aprendeu."),
  f(33, "🏜️", "deserto", "Cerca de 33% das terras do planeta são deserto, contando os gelados, como a Antártida."),
  f(33, "📖", "biblia", "Cerca de 33% dos ensinamentos de Jesus nos evangelhos foram contados em parábolas."),
  f(33, "📖", "biblia", "Cerca de 33% dos evangelhos contam a última semana de Jesus, da entrada em Jerusalém à ressurreição."),
  f(34, "👓", "olho", "Cerca de 34% das pessoas no mundo são míopes, e até 2050 podem ser metade."),
  f(34, "🧂", "deserto", "O Mar Morto tem cerca de 34% de sal, quase 10 vezes mais que o oceano. Por isso todo mundo boia."),
  f(37, "☕", "cafe", "O Brasil colhe cerca de 37% de todo o café do mundo e é o maior produtor há mais de 150 anos."),
  f(37, "🚜", "campo", "Cerca de 37% das terras do planeta são usadas para plantar e criar animais."),
  f(38, "🔴", "marte", "Em Marte, a gravidade é cerca de 38% da Terra: daria para pular mais de duas vezes e meia mais alto."),
  f(38, "🪐", "espaco", "Mercúrio é bem menor que Marte, mas tem quase a mesma gravidade: cerca de 38% da Terra."),
  f(40, "💪", "corrida", "Os músculos são cerca de 40% do peso do corpo."),
  f(40, "🧒", "bebe", "Por volta dos 5 anos, o cérebro de uma criança gasta cerca de 40% de toda a energia do corpo."),
  f(40, "🏖️", "salvador", "Cerca de 40% das pessoas do mundo vivem a até 100 km do mar, como quem mora em Salvador."),
  f(40, "🌊", "oceano", "A bacia do Rio Amazonas cobre cerca de 40% da América do Sul."),
  f(41, "🌙", "lua", "Cerca de 41% da Lua nunca aparece para quem está na Terra."),
  f(41, "📖", "biblia", "O Novo Testamento tem 27 dos 66 livros da Bíblia: cerca de 41%."),
  f(43, "🔴", "marte", "Marte, mais longe do Sol, recebe só cerca de 43% da luz que chega à Terra."),
  f(44, "🌈", "sol", "Cerca de 44% da energia do Sol que chega ao chão é luz visível, justamente a faixa que nossos olhos enxergam."),
  f(45, "🩸", "coracao", "Cerca de 45% do sangue são glóbulos vermelhos, que levam oxigênio para o corpo todo."),
  f(46, "🪨", "montanha", "O oxigênio forma cerca de 46% da crosta da Terra, preso nas rochas, não no ar."),
  f(47, "💭", "cerebro", "Um estudo de Harvard viu que passamos cerca de 47% do tempo acordados pensando em outra coisa."),
  f(47, "🗺️", "brasil", "O Brasil ocupa cerca de 47% da América do Sul."),
  f(48, "📖", "biblia", "Paulo escreveu 13 dos 27 livros do Novo Testamento: 48% deles."),
  f(49, "🌳", "floresta", "A Amazônia cobre cerca de 49% do território brasileiro."),
  f(49, "⚡", "luz", "Cerca de 49% de toda a energia usada no Brasil vem de fontes renováveis; no mundo, são uns 15%."),
  f(50, "⚖️", "terra", "No equinócio, dia e noite dividem quase exatamente 50% do tempo em todo o planeta."),
  f(50, "🐬", "golfinho", "Os golfinhos dormem com só 50% do cérebro de cada vez: a outra metade fica de olho."),
  f(50, "☀️", "sol", "Cerca de 50% da energia do Sol que chega ao chão é infravermelho: calor que nossos olhos não veem."),
  f(50, "👶", "bebe", "Recém-nascidos passam cerca de 50% do sono em REM, o dobro dos adultos."),
  f(50, "🌊", "oceano", "Cerca de 50% do oxigênio que respiramos é produzido no mar, por algas microscópicas."),
  f(50, "🧬", "bebe", "Exatamente 50% dos seus cromossomos vieram da sua mãe; os outros 50%, do seu pai."),
  f(51, "🖐️", "ossos", "Mãos e pés juntos têm 51% dos ossos do corpo: 106 de 206."),
  f(51, "📖", "biblia", "Cerca de 51% das línguas do mundo já têm pelo menos uma parte da Bíblia traduzida."),
  f(53, "🔴", "marte", "Marte tem cerca de 53% do diâmetro da Terra."),
  f(55, "🩸", "coracao", "Cerca de 55% do sangue é plasma, o líquido que leva nutrientes, hormônios e defesas."),
  f(57, "🏙️", "salvador", "Cerca de 57% das pessoas do mundo vivem em cidades."),
  f(58, "💍", "ouro", "O ouro 14 quilates tem cerca de 58% de ouro puro; o resto são outros metais."),
  f(59, "🌙", "lua", "Graças a um leve “balanço” da Lua, daqui da Terra vemos cerca de 59% da superfície dela, e não só a metade."),
  f(59, "🇧🇷", "brasil", "A Amazônia Legal cobre cerca de 59% do território brasileiro."),
  f(59, "🌏", "terra", "Cerca de 59% de todas as pessoas do mundo vivem na Ásia."),
  f(59, "📖", "biblia", "O Antigo Testamento tem 39 dos 66 livros da Bíblia: cerca de 59%."),
  f(60, "💧", "agua", "Cerca de 60% do corpo de um adulto é água."),
  f(60, "⚽", "estadio", "Num jogo de futebol de 90 minutos, a bola rola de verdade só uns 55 minutos: cerca de 60% do tempo."),
  f(60, "🧠", "cerebro", "Tirando a água, cerca de 60% do cérebro é gordura."),
  f(60, "🌳", "floresta", "Cerca de 60% da Floresta Amazônica fica no Brasil."),
  f(60, "💡", "luz", "Cerca de 60% da eletricidade do Brasil vem das hidrelétricas."),
  f(61, "🌐", "terra", "Cerca de 61% do Hemisfério Norte é coberto por oceano."),
  f(61, "🐧", "gelo", "A Antártida guarda, em gelo, cerca de 61% de toda a água doce do planeta."),
  f(64, "🧴", "bebe", "A pele é cerca de 64% água."),
  f(65, "🧍", "ossos", "Cerca de 65% do peso do corpo é oxigênio, a maior parte dentro da água."),
  f(65, "🦴", "ossos", "Cerca de 65% do peso dos ossos é mineral, principalmente cálcio e fósforo."),
  f(67, "👁️", "olho", "A córnea faz cerca de 67% do foco do olho; o cristalino ajusta o resto."),
  f(67, "☁️", "ceu", "A qualquer momento, cerca de 67% da Terra estão cobertos por nuvens."),
  f(67, "🌋", "vulcao", "O manto, a camada entre a crosta e o núcleo, tem cerca de 67% da massa da Terra."),
  f(67, "🐈", "gato", "Gatos dormem até 16 horas por dia: cerca de 67% do tempo."),
  f(67, "🍼", "bebe", "Um recém-nascido dorme de 14 a 17 horas por dia: cerca de 67% do tempo."),
  f(68, "🌌", "espaco", "Cerca de 68% do universo é energia escura, um dos maiores mistérios que os cientistas ainda tentam entender."),
  f(69, "🧊", "gelo", "Cerca de 69% da água doce do planeta está congelada em geleiras e calotas polares."),
  f(70, "👁️", "olho", "Cerca de 70% dos receptores sensoriais do corpo ficam nos olhos."),
  f(70, "🌾", "campo", "Cerca de 70% da água doce que a humanidade usa vai para a agricultura."),
  f(70, "👶", "bebe", "Ao nascer, os olhos já têm cerca de 70% do tamanho que terão na vida adulta."),
  f(70, "🍫", "chocolate", "No chocolate “70%”, 70% do peso vem do cacau."),
  f(71, "🌊", "oceano", "Cerca de 71% da superfície da Terra é coberta por oceanos."),
  f(73, "☀️", "sol", "Cerca de 73% do Sol é hidrogênio, o combustível que o faz brilhar."),
  f(74, "🌊", "oceano", "Cerca de 74% do fundo do mar ainda não foi mapeado em detalhe."),
  f(75, "🧠", "cerebro", "Cerca de 75% do cérebro é água."),
  f(75, "👶", "bebe", "O corpo de um bebê é cerca de 75% água."),
  f(75, "💍", "ouro", "O ouro 18 quilates tem 75% de ouro puro."),
  f(75, "🍌", "frutas", "A banana é cerca de 75% água."),
  f(75, "🐝", "mel", "Cerca de 75% das plantações de alimento do mundo dependem, ao menos em parte, de abelhas e outros polinizadores."),
  f(75, "🏥", "olho", "Cerca de 75% dos brasileiros dependem só do SUS para cuidar da saúde."),
  f(75, "🌋", "vulcao", "Cerca de 75% dos vulcões do planeta ficam no Círculo de Fogo, em volta do Pacífico."),
  f(75, "🥚", "campo", "Cerca de 75% de um ovo é água."),
  f(75, "🐞", "floresta", "Cerca de 75% das espécies de animais conhecidas são insetos."),
  f(75, "👁️", "olho", "Cerca de 75% das pessoas no mundo têm olhos castanhos."),
  f(78, "💨", "ceu", "Cerca de 78% do ar é nitrogênio, o gás que dá estabilidade à atmosfera."),
  f(78, "📖", "biblia", "O Antigo Testamento tem 929 dos 1.189 capítulos da Bíblia: cerca de 78%."),
  f(80, "🧠", "cerebro", "Cerca de 80% dos neurônios ficam no cerebelo, que tem só 10% do volume do cérebro. Quem contou foi a brasileira Suzana Herculano-Houzel."),
  f(80, "👁️", "olho", "Cerca de 80% do volume do olho é o humor vítreo, um gel transparente."),
  f(80, "🚢", "oceano", "Cerca de 80% de tudo o que se compra e vende no mundo viaja de navio."),
  f(80, "🍯", "mel", "O mel é cerca de 80% açúcar natural."),
  f(80, "🎯", "corrida", "Pela regra de Pareto, muitas vezes 80% dos resultados vêm de 20% das ações. O segredo é saber quais."),
  f(80, "🌲", "floresta", "As florestas abrigam cerca de 80% das espécies de animais e plantas da terra firme."),
  f(81, "🌊", "oceano", "No Hemisfério Sul, o nosso, cerca de 81% da superfície é oceano."),
  f(82, "🪐", "espaco", "Vênus tem cerca de 82% da massa da Terra: é quase um planeta gêmeo."),
  f(83, "🐨", "coala", "Os coalas dormem até 20 horas por dia: cerca de 83% do tempo."),
  f(83, "🫁", "ceu", "Os pulmões, mesmo cheios de ar, são cerca de 83% água."),
  f(84, "🩸", "coracao", "Das cerca de 30 trilhões de células do corpo, uns 84% são glóbulos vermelhos."),
  f(84, "🌌", "espaco", "Cerca de 84% de toda a matéria do universo é matéria escura."),
  f(84, "📖", "cristo", "Cerca de 84% dos brasileiros se declaram cristãos, segundo o Censo de 2022."),
  f(87, "🍼", "bebe", "O leite materno é cerca de 87% água."),
  f(88, "📱", "celular", "Cerca de 88% dos brasileiros com 10 anos ou mais usam a internet."),
  f(90, "🪐", "espaco", "Em Vênus, a gravidade é cerca de 90% da Terra: você quase não sentiria diferença."),
  f(90, "🌋", "vulcao", "Cerca de 90% dos terremotos do mundo acontecem no Círculo de Fogo do Pacífico."),
  f(90, "🐧", "gelo", "Cerca de 90% de todo o gelo do planeta está na Antártida."),
  f(90, "🌎", "terra", "Cerca de 90% das pessoas do mundo vivem no Hemisfério Norte; nós, no Sul, somos a minoria."),
  f(90, "🏠", "salvador", "Passamos cerca de 90% do tempo em ambientes fechados."),
  f(90, "👁️", "olho", "Cerca de 90% da perda de visão no mundo poderia ser evitada ou tratada. Cada consulta marcada conta."),
  f(90, "🌡️", "oceano", "Mais de 90% do calor extra do aquecimento global foi absorvido pelos oceanos."),
  f(90, "📖", "biblia", "Cerca de 90% do evangelho de Marcos também aparece no de Mateus."),
  f(92, "🍉", "frutas", "A melancia é cerca de 92% água."),
  f(92, "🩸", "coracao", "O plasma do sangue é cerca de 92% água."),
  f(93, "🌊", "oceano", "Cerca de 93% do gás carbônico da Terra está guardado nos oceanos."),
  f(95, "🪐", "espaco", "Vênus tem cerca de 95% do diâmetro da Terra: é quase um gêmeo do nosso planeta."),
  f(95, "🔴", "marte", "O ar de Marte é cerca de 95% gás carbônico."),
  f(95, "👁️", "olho", "Cerca de 95% das células que captam luz na retina são bastonetes, que enxergam no escuro."),
  f(95, "📖", "manuscrito", "O livro de Isaías achado nos Manuscritos do Mar Morto tem mais de 2 mil anos e é mais de 95% igual ao das Bíblias de hoje."),
  f(96, "🥒", "frutas", "O pepino é cerca de 96% água."),
  f(96, "🦷", "ossos", "O esmalte dos dentes é cerca de 96% mineral: a parte mais dura do corpo."),
  f(96, "🧍", "ossos", "Só 4 elementos, oxigênio, carbono, hidrogênio e nitrogênio, somam cerca de 96% do peso do corpo."),
  f(97, "🌊", "oceano", "Cerca de 97% da água da Terra está nos oceanos."),
  f(98, "💧", "agua", "As lágrimas são cerca de 98% água."),
  f(100, "🥇", "ouro", "O ouro 24 quilates é praticamente 100% puro: 99,9% de ouro."),
  f(100, "☀️", "sol", "O Sol tem quase 100% de toda a massa do Sistema Solar: 99,8%."),
  f(100, "🧬", "bebe", "Quaisquer duas pessoas têm quase 100% do DNA igual: 99,9%. O pouquinho que sobra faz cada um ser único."),
  f(100, "⚛️", "espaco", "Um átomo é quase 100% espaço vazio."),
];

// ---------------------------------------------------------------------------------------------
// Fatos calculados: valem para qualquer número de 1 a 100 e citam exatamente esse número.
// ---------------------------------------------------------------------------------------------

const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
/** "1,5 milhão", "37,4 milhões" */
const milhoes = (v: number) => `${n1(v)} ${v < 2 ? "milhão" : "milhões"}`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Capítulos de cada livro da Bíblia (66 livros, 1.189 capítulos). */
export const LIVROS_DA_BIBLIA: [string, number][] = [
  ["Gênesis", 50], ["Êxodo", 40], ["Levítico", 27], ["Números", 36], ["Deuteronômio", 34], ["Josué", 24], ["Juízes", 21],
  ["Rute", 4], ["1 Samuel", 31], ["2 Samuel", 24], ["1 Reis", 22], ["2 Reis", 25], ["1 Crônicas", 29], ["2 Crônicas", 36],
  ["Esdras", 10], ["Neemias", 13], ["Ester", 10], ["Jó", 42], ["Salmos", 150], ["Provérbios", 31], ["Eclesiastes", 12],
  ["Cântico dos Cânticos", 8], ["Isaías", 66], ["Jeremias", 52], ["Lamentações", 5], ["Ezequiel", 48], ["Daniel", 12],
  ["Oseias", 14], ["Joel", 3], ["Amós", 9], ["Obadias", 1], ["Jonas", 4], ["Miqueias", 7], ["Naum", 3], ["Habacuque", 3],
  ["Sofonias", 3], ["Ageu", 2], ["Zacarias", 14], ["Malaquias", 4],
  ["Mateus", 28], ["Marcos", 16], ["Lucas", 24], ["João", 21], ["Atos", 28], ["Romanos", 16], ["1 Coríntios", 16],
  ["2 Coríntios", 13], ["Gálatas", 6], ["Efésios", 6], ["Filipenses", 4], ["Colossenses", 4], ["1 Tessalonicenses", 5],
  ["2 Tessalonicenses", 3], ["1 Timóteo", 6], ["2 Timóteo", 4], ["Tito", 3], ["Filemom", 1], ["Hebreus", 13], ["Tiago", 5],
  ["1 Pedro", 5], ["2 Pedro", 3], ["1 João", 5], ["2 João", 1], ["3 João", 1], ["Judas", 1], ["Apocalipse", 22],
];

/** O N-ésimo capítulo da Bíblia, lendo desde Gênesis 1 ("1 Samuel 18"). */
export function capituloDaBiblia(n: number): string {
  let resto = Math.max(1, Math.min(1189, n));
  for (const [livro, caps] of LIVROS_DA_BIBLIA) {
    if (resto <= caps) return `${livro} ${resto}`;
    resto -= caps;
  }
  return "Apocalipse 22";
}

/** População do Censo 2022 (milhões) */
const ESTADOS_POP: [string, number][] = [
  ["Roraima", 0.64], ["Amapá", 0.73], ["Acre", 0.83], ["Tocantins", 1.51], ["Rondônia", 1.58], ["Sergipe", 2.21],
  ["Mato Grosso do Sul", 2.76], ["Distrito Federal", 2.82], ["Alagoas", 3.13], ["Piauí", 3.27], ["Rio Grande do Norte", 3.3],
  ["Mato Grosso", 3.66], ["Espírito Santo", 3.83], ["Amazonas", 3.94], ["Paraíba", 3.97], ["Maranhão", 6.78], ["Goiás", 7.06],
  ["Santa Catarina", 7.61], ["Pará", 8.12], ["Ceará", 8.79], ["Pernambuco", 9.06], ["Rio Grande do Sul", 10.88],
  ["Paraná", 11.44], ["Bahia", 14.14], ["Rio de Janeiro", 16.05], ["Minas Gerais", 20.54], ["São Paulo", 44.41],
];
const BRASIL_POP = 203.08;

/** Área (mil km², IBGE) */
const ESTADOS_AREA: [string, number][] = [
  ["Sergipe", 21.9], ["Alagoas", 27.8], ["Rio de Janeiro", 43.8], ["Espírito Santo", 46.1], ["Rio Grande do Norte", 52.8],
  ["Paraíba", 56.5], ["Santa Catarina", 95.7], ["Pernambuco", 98.1], ["Amapá", 142.5], ["Ceará", 148.9], ["Acre", 164.1],
  ["Paraná", 199.3], ["Roraima", 223.6], ["Rondônia", 237.8], ["São Paulo", 248.2], ["Piauí", 251.8], ["Tocantins", 277.4],
  ["Rio Grande do Sul", 281.7], ["Maranhão", 329.6], ["Goiás", 340.2], ["Mato Grosso do Sul", 357.1], ["Bahia", 564.7],
  ["Minas Gerais", 586.5], ["Mato Grosso", 903.2], ["Pará", 1245.9], ["Amazonas", 1559.2],
];
const BRASIL_AREA = 8510.4;

const maiorAbaixo = <T,>(lista: [T, number][], v: number) => lista.filter(([, x]) => x < v).at(-1) ?? null;
const SEM_ARTIGO = /^(Alagoas|Goiás|Mato Grosso|Mato Grosso do Sul|Minas Gerais|Pernambuco|Rondônia|Roraima|Santa Catarina|São Paulo|Sergipe)$/;
const FEMININO = /^(Bahia|Paraíba)$/;
/** "a Bahia", "o Ceará", "Pernambuco" */
const comArtigo = (e: string) => (FEMININO.test(e) ? `a ${e}` : SEM_ARTIGO.test(e) ? e : `o ${e}`);
/** "da Bahia", "do Ceará", "de Pernambuco" */
const deEstado = (e: string) => (FEMININO.test(e) ? `da ${e}` : SEM_ARTIGO.test(e) ? `de ${e}` : `do ${e}`);

export interface ModeloDeFato {
  id: string;
  emoji: string;
  tema: TemaFoto;
  texto: (p: number) => string;
}

export const MODELOS: ModeloDeFato[] = [
  {
    id: "biblia",
    emoji: "📖",
    tema: "biblia",
    texto: (p) => {
      const caps = Math.max(1, Math.round((1189 * p) / 100));
      return `${p}% dos 1.189 capítulos da Bíblia são ${n0(caps)} capítulos: lendo desde Gênesis 1, você chegaria a ${capituloDaBiblia(caps)}.`;
    },
  },
  {
    id: "ano",
    emoji: "📅",
    tema: "terra",
    texto: (p) => {
      const dias = Math.max(1, Math.round((365 * p) / 100));
      const d = new Date(Date.UTC(2026, 0, dias));
      return `${p}% de um ano são ${dias} ${dias === 1 ? "dia" : "dias"}: contando de 1º de janeiro, você chegaria a ${d.getUTCDate() === 1 ? "1º" : d.getUTCDate()} de ${MESES[d.getUTCMonth()]}.`;
    },
  },
  {
    id: "populacao",
    emoji: "🇧🇷",
    tema: "salvador",
    texto: (p) => {
      const mi = (BRASIL_POP * p) / 100;
      const qtd = mi < 10 ? milhoes(mi) : `${n0(mi)} milhões`;
      if (p === 100) return `100% dos brasileiros são ${qtd} de pessoas, segundo o Censo de 2022.`;
      const comp =
        mi > 84.8
          ? "mais do que toda a região Sudeste"
          : mi > 54.6
            ? "mais do que toda a região Nordeste"
            : mi > 44.41
              ? "mais do que todo o estado de São Paulo, o mais populoso do país"
              : `mais do que toda a população ${deEstado(maiorAbaixo(ESTADOS_POP, mi)![0])}`;
      return `${p}% dos brasileiros são cerca de ${qtd} de pessoas: ${comp}.`;
    },
  },
  {
    id: "area",
    emoji: "🗺️",
    tema: "brasil",
    texto: (p) => {
      const mil = (BRASIL_AREA * p) / 100;
      const qtd = mil >= 1000 ? `${milhoes(mil / 1000)} de km²` : `${n0(mil)} mil km²`;
      if (p === 100) return `100% do território brasileiro são ${qtd}: o 5º maior país do mundo.`;
      const comp =
        mil > 3850
          ? "maior que toda a região Norte, a maior do país"
          : mil > 1559.2
            ? "maior que o Amazonas, o maior estado do país"
            : `maior que ${comArtigo(maiorAbaixo(ESTADOS_AREA, mil)![0])}`;
      return `${p}% do território brasileiro são ${qtd}: um pedaço ${comp}.`;
    },
  },
  {
    id: "lua",
    emoji: "🌙",
    tema: "lua",
    texto: (p) => {
      const km = (384400 * p) / 100;
      const comp =
        km >= 40075
          ? `dá para dar ${Math.floor(km / 40075) === 1 ? "mais de uma volta" : `mais de ${Math.floor(km / 40075)} voltas`} na Terra pela linha do Equador`
          : km >= 4395
            ? `mais de ${Math.floor(km / 4395) === 1 ? "uma vez" : `${Math.floor(km / 4395)} vezes`} a distância do Brasil de norte a sul`
            : "quase a distância do Brasil de norte a sul (4.395 km)";
      return `${p}% do caminho até a Lua são ${n0(km)} km: ${comp}.`;
    },
  },
  {
    id: "everest",
    emoji: "🏔️",
    tema: "montanha",
    texto: (p) => {
      const m = (8849 * p) / 100;
      const comp =
        p === 100
          ? "o ponto mais alto do planeta"
          : m > 2995
            ? "mais alto que o Pico da Neblina, o ponto mais alto do Brasil (2.995 m)"
            : m > 828
              ? "mais alto que o Burj Khalifa, o maior prédio do mundo (828 m)"
              : m > 396
                ? "mais alto que o Pão de Açúcar, no Rio (396 m)"
                : "mais alto que o Elevador Lacerda, em Salvador (72 m)";
      return `${p}% da altura do Monte Everest são ${n0(m)} metros: ${comp}.`;
    },
  },
  {
    id: "luz",
    emoji: "⚡",
    tema: "luz",
    texto: (p) => {
      const kms = (299792 * p) / 100;
      const voltas = kms / 40075;
      const comp =
        voltas >= 1
          ? `daria ${n1(voltas)} ${voltas < 2 ? "volta" : "voltas"} na Terra em 1 segundo`
          : `cruzaria o Brasil de norte a sul em ${n1(4395 / kms)} segundo${4395 / kms >= 2 ? "s" : ""}`;
      return `A ${p}% da velocidade da luz, você percorreria ${n0(kms)} km por segundo: ${comp}.`;
    },
  },
  {
    id: "maracana",
    emoji: "🏟️",
    tema: "estadio",
    texto: (p) =>
      p === 100
        ? "100% do Maracanã lotado são 78.838 torcedores cantando juntos."
        : `${p}% do Maracanã lotado seriam ${n0((78838 * p) / 100)} torcedores. Cheio, ele recebe 78.838.`,
  },
  {
    id: "dia",
    emoji: "⏰",
    tema: "relogio",
    texto: (p) => {
      const min = Math.round((1440 * p) / 100);
      const h = Math.floor(min / 60);
      const m = min % 60;
      const dur = [h ? `${h} ${h === 1 ? "hora" : "horas"}` : "", m ? `${m} ${m === 1 ? "minuto" : "minutos"}` : ""].filter(Boolean).join(" e ");
      return p === 100
        ? "100% de um dia são 24 horas: 1.440 minutos para fazer a diferença."
        : `${p}% de um dia são ${dur}: da meia-noite até as ${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}.`;
    },
  },
  {
    id: "maratona",
    emoji: "🏃",
    tema: "corrida",
    texto: (p) => {
      const km = (42.195 * p) / 100;
      if (p === 100) return "100% de uma maratona são 42,195 km: a prova completa, do tiro de largada à chegada.";
      return `${p}% de uma maratona são ${km < 1 ? `${n0(km * 1000)} metros` : `${n1(km)} km`}. A prova inteira tem 42,195 km.`;
    },
  },
  {
    id: "sol-luz",
    emoji: "☀️",
    tema: "sol",
    texto: (p) => {
      const s = Math.round((499 * p) / 100);
      const t = s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} segundo${s === 1 ? "" : "s"}`;
      if (p === 100) return "100% do caminho do Sol até nós a luz faz em 8 minutos e 19 segundos: são 150 milhões de km.";
      return `A luz do Sol leva 8 minutos e 19 segundos para chegar até nós. ${p}% desse caminho ela faz em ${t}.`;
    },
  },
  {
    id: "respiracao",
    emoji: "🌬️",
    tema: "ceu",
    texto: (p) => `Você respira cerca de 20 mil vezes por dia. ${p}% disso são ${n0((20000 * p) / 100)} respirações, sem nem perceber.`,
  },
  {
    id: "sol-distancia",
    emoji: "🌌",
    tema: "espaco",
    texto: (p) => {
      const mi = (149.6 * p) / 100;
      return `${p}% da distância até o Sol são ${milhoes(mi)} de km: ${n1(mi / 0.3844)} vezes a distância até a Lua.`;
    },
  },
];

/** Contador de meses ("2026-10" → 2026×12 + 9): meses seguidos dão posições seguidas. */
function contadorDoMes(comp: string): number {
  const [a, m] = comp.split("-").map(Number);
  return a * 12 + (m - 1);
}

const porValor = new Map<number, FatoPercentual[]>();
for (const fato of FATOS_EXATOS) porValor.set(fato.valor, [...(porValor.get(fato.valor) ?? []), fato]);

/** Fatos reais com aquele número exato (no máximo 12 entram no rodízio). */
export function fatosReais(p: number): FatoPercentual[] {
  return (porValor.get(p) ?? []).slice(0, 12);
}

/** O fato de uma porcentagem (inteira, 1 a 100) num mês. Em 12 meses seguidos, nunca repete. */
export function fatoDoMes(p: number, comp: string): FatoPercentual | null {
  if (!Number.isInteger(p) || p < 1 || p > 100) return null;
  const c = contadorDoMes(comp);
  const reais = fatosReais(p);
  if (c % 12 < reais.length) return reais[c % 12];
  const m = MODELOS[c % MODELOS.length];
  return { valor: p, emoji: m.emoji, tema: m.tema, texto: m.texto(p) };
}

/**
 * A retrospectiva tem UMA tela "E sabia que…". Ela vai para a primeira porcentagem (na ordem de
 * prioridade) que tenha um fato real naquele mês; se nenhuma tiver, para a primeira, com um fato calculado.
 */
export function fatoDaRetrospectiva<T extends { p: number | null }>(
  telas: T[],
  comp: string,
): { tela: T & { p: number }; fato: FatoPercentual } | null {
  const validas = telas.filter((t): t is T & { p: number } => t.p !== null && Number.isInteger(t.p) && t.p >= 1 && t.p <= 100);
  if (!validas.length) return null;
  const c = contadorDoMes(comp);
  const comReal = validas.find((t) => c % 12 < fatosReais(t.p).length);
  const tela = comReal ?? validas[0];
  const fato = fatoDoMes(tela.p, comp);
  return fato ? { tela, fato } : null;
}
