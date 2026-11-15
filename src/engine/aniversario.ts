// Aniversário: os parabéns do dia (obrigatório na primeira visita), a tela na retrospectiva do mês
// e o que dá para dizer sobre o dia e o ano em que a pessoa nasceu.
//
// Para não repetir: cada pessoa tem uma posição fixa (ordem dos cadastros) e o texto sai de
// (posição + ano × passo) na lista. Assim, no mesmo ano, até N pessoas recebem textos diferentes
// (N = tamanho da lista, sempre acima de 30), e a mesma pessoa recebe outro texto no ano seguinte.
import { diaDaSemanaISO } from "./datas";

export interface VersiculoAniversario {
  referencia: string;
  /** texto da NVI, conferido no Bíblia On */
  texto: string;
  /** convite curto para buscar a Deus */
  convite: string;
}

/** {nome} vira o primeiro nome da pessoa */
export const MENSAGENS_PARABENS: string[] = [
  "{nome}, hoje o dia é seu! Obrigado por tudo o que você faz e pelo jeito como faz. A IOBA fica melhor com você aqui.",
  "Feliz aniversário, {nome}! Que este novo ano venha com saúde, paz e muitos motivos para sorrir. É um privilégio ter você na equipe.",
  "Parabéns, {nome}! Por trás de cada paciente bem cuidado existe gente como você. Obrigado por fazer a diferença.",
  "{nome}, que alegria celebrar mais um ano da sua vida! O seu esforço é visto e faz diferença todos os dias.",
  "Feliz aniversário, {nome}! Que o seu novo ciclo seja leve, abençoado e cheio de conquistas, no trabalho e fora dele.",
  "{nome}, hoje a gente para tudo para dizer: obrigado! A sua dedicação ajuda muita gente a ser bem atendida.",
  "Parabéns pelo seu dia, {nome}! Que nunca faltem saúde, paz em casa e pessoas queridas por perto.",
  "{nome}, mais um ano de vida é mais um ano de histórias. Obrigado por fazer parte da história da IOBA.",
  "Feliz aniversário, {nome}! Que este dia seja especial do começo ao fim, do jeito que você merece.",
  "{nome}, parabéns! Que o novo ano traga sonhos novos e força para realizar cada um deles. Conte com a gente.",
  "Hoje é dia de festa, {nome}! Obrigado por cada dia de trabalho dedicado. Você faz a diferença na vida de quem chega à IOBA.",
  "{nome}, feliz aniversário! Que você colha neste novo ano tudo de bom que planta todos os dias.",
  "Parabéns, {nome}! Que a sua vida continue sendo luz para quem está perto de você.",
  "{nome}, que este novo ano seja o melhor até agora! Obrigado por somar com a equipe todos os dias.",
  "Feliz aniversário, {nome}! O seu trabalho ajuda pessoas a cuidar de algo precioso: a visão. Obrigado por isso.",
  "{nome}, hoje celebramos a sua vida! Que não faltem saúde, alegria e paz em cada dia do novo ano.",
  "Parabéns, {nome}! Um novo ano de vida é uma página em branco. Que ela seja escrita com muitas alegrias.",
  "{nome}, obrigado por fazer parte do time! Que o seu aniversário seja cheio de carinho e de boas surpresas.",
  "Feliz aniversário, {nome}! Que cada desafio do novo ano venha acompanhado de força e de boas pessoas ao seu lado.",
  "{nome}, parabéns pelo seu dia! A diferença que você faz aparece em cada paciente que sai daqui bem atendido.",
  "Hoje o número mais importante do Trackco é o seu novo ano de vida! Feliz aniversário, {nome}.",
  "{nome}, que este aniversário marque o começo de um ano de crescimento, saúde e muitas bênçãos.",
  "Feliz aniversário, {nome}! Obrigado pela dedicação, pela paciência e pelo cuidado de todos os dias.",
  "{nome}, parabéns! Que a alegria de hoje acompanhe você pelos próximos 365 dias.",
  "Feliz aniversário, {nome}! Que o novo ano traga mais motivos para agradecer do que para pedir.",
  "{nome}, hoje é um ótimo dia para lembrar o quanto você é importante para a equipe. Parabéns!",
  "Parabéns, {nome}! Que a sua casa se encha de amor, a sua mesa de fartura e o seu coração de paz.",
  "{nome}, feliz aniversário! Cada dia seu aqui ajuda a IOBA a cumprir a missão de cuidar das pessoas.",
  "Feliz aniversário, {nome}! Que você esteja sempre cercado de gente que faz bem e de dias que valem a pena.",
  "{nome}, parabéns pelo seu novo ano! Que sobrem saúde para viver, sabedoria para escolher e amor para dividir.",
  "Feliz aniversário, {nome}! Num dia corrido, o seu esforço pode até passar despercebido. Hoje a gente quer dizer: obrigado.",
  "{nome}, que o seu novo ciclo seja de vitórias, das pequenas às grandes. Feliz aniversário!",
  "Parabéns, {nome}! Que este ano traga bons encontros, aprendizados e muitas razões para sorrir.",
  "{nome}, hoje é dia de comemorar quem você é. Obrigado por fazer da IOBA um lugar melhor.",
  "Feliz aniversário, {nome}! Que o seu dia seja tão bom quanto o cuidado que você dedica a cada pessoa.",
  "{nome}, mais um ano para agradecer pela sua vida e pela sua presença na equipe. Parabéns!",
];

const v = (referencia: string, texto: string, convite: string): VersiculoAniversario => ({ referencia, texto, convite });

/** Versículos da NVI (conferidos no Bíblia On), cada um com um convite para buscar a Deus. */
export const VERSICULOS_ANIVERSARIO: VersiculoAniversario[] = [
  v("Salmos 90:12", "Ensina-nos a contar os nossos dias para que o nosso coração alcance sabedoria.", "Cada dia é um presente. Que neste novo ano você conte os seus dias ao lado de Deus, buscando nele a sabedoria."),
  v("Salmos 139:14", "Eu te louvo porque me fizeste de modo especial e admirável. Tuas obras são maravilhosas! Digo isso com convicção.", "Deus fez você de um jeito único. Que tal começar o novo ano agradecendo a Ele em oração?"),
  v("Salmos 139:16", "Os teus olhos viram o meu embrião; todos os dias determinados para mim foram escritos no teu livro antes de qualquer deles existir.", "Antes do seu primeiro dia, Deus já conhecia você. Ele quer caminhar com você em cada um dos próximos."),
  v("Jeremias 29:11", "“Porque sou eu que conheço os planos que tenho para vocês”, diz o Senhor, “planos de fazê-los prosperar e não de causar dano, planos de dar a vocês esperança e um futuro.”", "Deus tem planos de esperança para a sua vida. Entregue a Ele o seu novo ano."),
  v("Jeremias 29:13", "Vocês me procurarão e me acharão quando me procurarem de todo o coração.", "Deus se deixa encontrar por quem o procura de coração. Reserve um tempo do seu dia para falar com Ele."),
  v("Números 6:24-26", "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e te conceda graça; o Senhor volte para ti o seu rosto e te dê paz.", "Esta é a nossa oração por você hoje. Que a presença de Deus vá à sua frente em todo o novo ano."),
  v("Lamentações 3:22-23", "Graças ao grande amor do Senhor é que não somos consumidos, pois as suas misericórdias são inesgotáveis. Renovam-se cada manhã; grande é a sua fidelidade!", "Todo dia é uma nova chance com Deus. As misericórdias dele se renovam a cada manhã, inclusive nesta."),
  v("Tiago 4:8", "Aproximem-se de Deus, e ele se aproximará de vocês!", "Deus está mais perto do que parece. Um passo em direção a Ele, numa oração simples, já faz diferença."),
  v("Salmos 16:11", "Tu me farás conhecer a vereda da vida, a alegria plena da tua presença, eterno prazer à tua direita.", "A alegria completa está na presença de Deus. Que este novo ano seja de mais intimidade com Ele."),
  v("Salmos 27:4", "Uma coisa pedi ao Senhor e a procuro: que eu possa viver na casa do Senhor todos os dias da minha vida, para contemplar a bondade do Senhor e buscar sua orientação no seu templo.", "Buscar a Deus é o melhor desejo para um novo ano. Que você encontre tempo para estar com Ele todos os dias."),
  v("Salmos 63:1", "Ó Deus, tu és o meu Deus, eu te busco intensamente; a minha alma tem sede de ti! Todo o meu ser anseia por ti, numa terra seca, exausta e sem água.", "Assim como o corpo precisa de água, a alma precisa de Deus. Que você o busque de todo o coração neste novo ciclo."),
  v("João 15:5", "Eu sou a videira; vocês são os ramos. Se alguém permanecer em mim e eu nele, esse dará muito fruto; pois sem mim vocês não podem fazer coisa alguma.", "Quem permanece em Jesus dá fruto. Que o seu novo ano seja ligado a Ele, como o ramo à videira."),
  v("Filipenses 1:6", "Estou convencido de que aquele que começou boa obra em vocês, vai completá-la até o dia de Cristo Jesus.", "Deus não abandona o que começa. O que Ele começou na sua vida, Ele vai completar."),
  v("Provérbios 3:5-6", "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento; reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas.", "Confie a Deus os seus caminhos neste novo ano. Ele sabe guiar melhor do que ninguém."),
  v("Isaías 40:31", "Mas aqueles que esperam no Senhor renovam as suas forças. Voam alto como águias; correm e não ficam exaustos, andam e não se cansam.", "Quando o cansaço vier, lembre-se: quem espera em Deus encontra forças novas."),
  v("Salmos 23:6", "Sei que a bondade e a fidelidade me acompanharão todos os dias da minha vida, e voltarei à casa do Senhor enquanto eu viver.", "A bondade de Deus acompanha você todos os dias, não só hoje. Caminhe com Ele."),
  v("Romanos 8:28", "Sabemos que Deus age em todas as coisas para o bem daqueles que o amam, dos que foram chamados de acordo com o seu propósito.", "Mesmo nos dias difíceis, Deus está agindo. Entregue a Ele cada parte do seu novo ano."),
  v("Mateus 11:28", "Venham a mim, todos os que estão cansados e sobrecarregados, e eu darei descanso a vocês.", "Jesus convida você a descansar nele. Leve a Ele o que pesa no seu coração."),
  v("Apocalipse 3:20", "Eis que estou à porta e bato. Se alguém ouvir a minha voz e abrir a porta, entrarei e cearei com ele, e ele comigo.", "Jesus bate à porta do seu coração. Neste novo ano, abra a porta para Ele."),
  v("Salmos 37:4", "Deleite-se no Senhor, e ele atenderá aos desejos do seu coração.", "Encontrar alegria em Deus muda o que desejamos. Que Ele seja a sua maior alegria."),
  v("Sofonias 3:17", "O Senhor, o seu Deus, está em seu meio, poderoso para salvar. Ele se regozijará em você; com o seu amor a renovará, ele se regozijará em você com brados de alegria.", "Deus se alegra com você. Que você descubra esse amor de perto neste novo ano."),
  v("Efésios 2:10", "Porque somos criação de Deus realizada em Cristo Jesus para fazermos boas obras, as quais Deus preparou antes para nós as praticarmos.", "Você foi criado por Deus com propósito. Peça a Ele que mostre as boas obras que preparou para você."),
  v("Josué 1:9", "Não fui eu que ordenei a você? Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.", "Seja qual for o desafio do novo ano, Deus vai com você por onde você andar."),
  v("João 10:10", "Eu vim para que tenham vida e a tenham plenamente.", "Jesus veio trazer vida plena. Que neste novo ano você conheça essa vida de perto."),
  v("Salmos 34:8", "Provem, e vejam como o Senhor é bom. Como é feliz o homem que nele se refugia!", "A bondade de Deus se prova na prática. Experimente buscá-lo um pouco a cada dia."),
  v("Isaías 43:1", "Não tema, pois eu o resgatei; eu o chamei pelo nome; você é meu.", "Deus conhece você pelo nome. Você é importante para Ele, hoje e sempre."),
  v("Romanos 15:13", "Que o Deus da esperança os encha de toda alegria e paz, por sua confiança nele, para que vocês transbordem de esperança, pelo poder do Espírito Santo.", "Que a esperança que vem de Deus encha o seu novo ano de alegria e paz."),
  v("Hebreus 11:6", "Sem fé é impossível agradar a Deus, pois quem dele se aproxima precisa crer que ele existe e que recompensa aqueles que o buscam.", "Deus recompensa quem o busca. Que este seja um ano de buscar a Deus com fé."),
  v("Salmos 145:18", "O Senhor está perto de todos os que o invocam, de todos os que o invocam com sinceridade.", "Deus está perto de quem o chama com sinceridade. Uma oração já é o começo."),
  v("Deuteronômio 31:8", "O próprio Senhor irá à sua frente e estará com você; ele nunca o deixará, nunca o abandonará. Não tenha medo! Não desanime!", "Você não está só. Deus vai à sua frente em cada passo do novo ano."),
  v("Salmos 65:11", "Coroas o ano com a tua bondade, e por onde passas emana fartura.", "Que Deus coroe o seu novo ano com a bondade dele, do primeiro ao último dia."),
  v("Salmos 103:2", "Bendiga o Senhor a minha alma! Não esqueça nenhuma de suas bênçãos!", "Hoje é um bom dia para lembrar de tudo o que Deus já fez e agradecer a Ele."),
  v("Mateus 6:33", "Busquem, pois, em primeiro lugar o Reino de Deus e a sua justiça, e todas essas coisas serão acrescentadas a vocês.", "Coloque Deus em primeiro lugar neste novo ano, e Ele cuidará do resto."),
  v("2 Coríntios 5:17", "Portanto, se alguém está em Cristo, é nova criação. As coisas antigas já passaram; eis que surgiram coisas novas!", "Em Cristo sempre há um recomeço. Que o novo ano seja um tempo de coisas novas com Ele."),
  v("João 3:16", "Porque Deus tanto amou o mundo que deu o seu Filho Unigênito, para que todo o que nele crer não pereça, mas tenha a vida eterna.", "O maior presente que alguém pode receber já foi dado: o amor de Deus em Jesus. Ele é para você."),
  v("Romanos 5:8", "Mas Deus demonstra seu amor por nós: Cristo morreu em nosso favor quando ainda éramos pecadores.", "Deus amou você primeiro, sem esperar nada em troca. Esse amor está à sua espera."),
  v("1 João 4:19", "Nós amamos porque ele nos amou primeiro.", "Tudo começa no amor de Deus por você. Que você o conheça mais a cada dia."),
  v("Salmos 118:24", "Este é o dia em que o Senhor agiu; alegremo-nos e exultemos neste dia.", "Este dia foi feito por Deus. Alegre-se nele e agradeça pela sua vida!"),
];

/** Algo marcante do ano em que a pessoa nasceu (fatos conhecidos e sem polêmica). */
export const FATOS_DO_ANO: Record<number, string> = {
  1950: "O Brasil sediou a Copa do Mundo, o Maracanã foi inaugurado e entrou no ar a primeira emissora de TV do país, a TV Tupi.",
  1951: "Começou a funcionar o UNIVAC I, um dos primeiros computadores vendidos a empresas.",
  1952: "Adhemar Ferreira da Silva ganhou o ouro olímpico no salto triplo, em Helsinque, com recorde mundial.",
  1953: "Edmund Hillary e Tenzing Norgay chegaram pela primeira vez ao topo do Monte Everest.",
  1954: "Foi feito o primeiro transplante de rim bem-sucedido do mundo, nos Estados Unidos.",
  1955: "A Disneylândia abriu as portas, na Califórnia.",
  1956: "Pelé estreou no Santos, com apenas 15 anos.",
  1957: "O Sputnik, primeiro satélite artificial, foi lançado ao espaço.",
  1958: "O Brasil ganhou a sua primeira Copa do Mundo, na Suécia, com Pelé aos 17 anos.",
  1959: "Saiu o disco “Chega de Saudade”, do baiano João Gilberto, marco da Bossa Nova.",
  1960: "Brasília foi inaugurada e virou a capital do Brasil.",
  1961: "Yuri Gagarin se tornou o primeiro ser humano a ir ao espaço.",
  1962: "O Brasil foi bicampeão mundial de futebol, no Chile, com Garrincha brilhando.",
  1963: "A seleção brasileira de basquete foi bicampeã mundial, jogando no Rio de Janeiro.",
  1964: "O Japão inaugurou o primeiro trem-bala do mundo, entre Tóquio e Osaka.",
  1965: "O primeiro satélite comercial de telecomunicações, o “Early Bird”, entrou em órbita.",
  1966: "Foi criado o FGTS, o fundo de garantia dos trabalhadores.",
  1967: "Foi feito o primeiro transplante de coração do mundo, na África do Sul.",
  1968: "A Apollo 8 levou os primeiros humanos a dar a volta na Lua, e os astronautas leram Gênesis 1 ao vivo na noite de Natal.",
  1969: "O ser humano pisou na Lua pela primeira vez, e Pelé fez o seu milésimo gol no Maracanã.",
  1970: "O Brasil foi tricampeão mundial no México e ficou de vez com a Taça Jules Rimet.",
  1971: "Foi lançado o primeiro microprocessador, o Intel 4004, avô dos chips de hoje.",
  1972: "O Brasil teve a sua primeira transmissão oficial de TV em cores.",
  1973: "Foi feita a primeira ligação de um telefone celular, em Nova York.",
  1974: "Foi inaugurada a Ponte Rio–Niterói.",
  1975: "Foi fundada a Microsoft.",
  1976: "Foi fundada a Apple.",
  1977: "Foram lançadas as sondas Voyager, que hoje viajam além do Sistema Solar.",
  1978: "Foi lançado Space Invaders, um dos primeiros videogames a virar febre.",
  1979: "Foi lançado o Walkman, o primeiro aparelho de som portátil a fazer sucesso no mundo todo.",
  1980: "Foi lançado o Pac-Man.",
  1981: "Foi lançado o primeiro computador pessoal da IBM, o famoso PC.",
  1982: "Um professor dos Estados Unidos usou pela primeira vez o :-) para indicar um sorriso num texto.",
  1983: "Começou a ser vendido o primeiro celular para o público, o Motorola DynaTAC.",
  1984: "Foi lançado o primeiro Macintosh, da Apple.",
  1985: "Foi lançada a primeira versão do Windows.",
  1986: "O cometa Halley passou perto da Terra. Ele só volta em 2061.",
  1987: "Nelson Piquet conquistou o seu terceiro título mundial na Fórmula 1.",
  1988: "Foi promulgada a Constituição que criou o SUS.",
  1989: "Foi criada a World Wide Web, o “www” que usamos até hoje.",
  1990: "O Telescópio Espacial Hubble foi lançado ao espaço.",
  1991: "Ayrton Senna conquistou o seu terceiro título mundial na Fórmula 1.",
  1992: "Foi enviada a primeira mensagem de texto (SMS) por celular. Dizia: “Feliz Natal”.",
  1993: "Foi lançado o Mosaic, o navegador que popularizou a internet.",
  1994: "O Brasil foi tetracampeão mundial nos Estados Unidos, e nasceu o Real, a moeda que usamos até hoje.",
  1995: "Estreou Toy Story, o primeiro filme feito todo em computador.",
  1996: "Jacqueline e Sandra ganharam o vôlei de praia em Atlanta: o primeiro ouro olímpico de mulheres brasileiras.",
  1997: "A sonda Pathfinder pousou em Marte e levou o primeiro robô a andar por lá.",
  1998: "Foi fundado o Google.",
  1999: "O mundo todo se preparou para o “bug do milênio”, que acabou não acontecendo.",
  2000: "O Brasil completou 500 anos, com a festa principal em Porto Seguro, na Bahia.",
  2001: "Foi criada a Wikipédia.",
  2002: "O Brasil foi pentacampeão mundial, na Copa da Coreia e do Japão.",
  2003: "Os cientistas terminaram a primeira leitura do DNA humano, no Projeto Genoma.",
  2004: "Foi lançado o Orkut, a rede social que virou febre no Brasil.",
  2005: "Foi criado o YouTube.",
  2006: "Marcos Pontes se tornou o primeiro brasileiro a ir ao espaço.",
  2007: "O Cristo Redentor foi eleito uma das Sete Novas Maravilhas do Mundo.",
  2008: "Chegou às lojas o primeiro celular com Android.",
  2009: "Foi criado o WhatsApp.",
  2010: "Foi lançado o Instagram.",
  2011: "A população do mundo chegou a 7 bilhões de pessoas.",
  2012: "O robô Curiosity pousou em Marte.",
};

const DIAS_SEMANA = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const bissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/** O aniversário num ano ("2027-02-28" para quem nasceu em 29/02 e o ano não é bissexto). */
export function aniversarioNoAno(nascimento: string, ano: number): string {
  const md = nascimento.slice(5, 10);
  return md === "02-29" && !bissexto(ano) ? `${ano}-02-28` : `${ano}-${md}`;
}

/** O último aniversário até hoje (o deste ano, se já passou; senão o do ano passado). */
export function ultimoAniversario(nascimento: string, hoje: string): string {
  const ano = Number(hoje.slice(0, 4));
  const deste = aniversarioNoAno(nascimento, ano);
  return deste <= hoje ? deste : aniversarioNoAno(nascimento, ano - 1);
}

/** Dias desde o aniversário até hoje (0 = é hoje). */
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * O aniversário que ainda falta parabenizar: no dia, ou na primeira visita depois dele
 * (até `janela` dias; depois disso fica para a retrospectiva do mês).
 */
export function parabensPendente(nascimento: string | null, vistoEm: string | null, hoje: string, janela = 30): string | null {
  if (!nascimento || !/^\d{4}-\d{2}-\d{2}/.test(nascimento)) return null;
  const aniv = ultimoAniversario(nascimento, hoje);
  if (diasEntre(aniv, hoje) > janela) return null;
  if (vistoEm && vistoEm >= aniv) return null;
  return aniv;
}

/** Texto da lista sem repetir: no mesmo ano, posições diferentes dão textos diferentes; a mesma posição muda a cada ano. */
export function escolherSemRepetir<T>(lista: T[], posicao: number, ano: number, passo: number, deslocamento = 0): T {
  const n = lista.length;
  return lista[(((posicao + ano * passo + deslocamento) % n) + n) % n];
}

export function mensagemDeParabens(nome: string, posicao: number, ano: number, deslocamento = 0): string {
  return escolherSemRepetir(MENSAGENS_PARABENS, posicao, ano, 7, deslocamento).replaceAll("{nome}", nome);
}

export function versiculoDeAniversario(posicao: number, ano: number): VersiculoAniversario {
  return escolherSemRepetir(VERSICULOS_ANIVERSARIO, posicao, ano, 11);
}

/** "12 de março de 1995" */
export function dataPorExtenso(iso: string, comAno = true): string {
  const t = `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
  return comAno ? `${t} de ${iso.slice(0, 4)}` : t;
}

export interface CuriosidadesDoNascimento {
  diaDaSemana: string;
  diasDeVida: number;
  luasCheias: number;
  /** batidas do coração, em bilhões (uns 100 mil por dia) */
  batidasBilhoes: number;
  fatoDoAno: string | null;
}

export function curiosidadesDoNascimento(nascimento: string, hoje: string): CuriosidadesDoNascimento {
  const dias = Math.max(0, diasEntre(nascimento.slice(0, 10), hoje));
  return {
    diaDaSemana: DIAS_SEMANA[diaDaSemanaISO(nascimento.slice(0, 10)) - 1],
    diasDeVida: dias,
    luasCheias: Math.floor(dias / 29.53),
    batidasBilhoes: Math.floor((dias * 100_000) / 100_000_000) / 10,
    fatoDoAno: FATOS_DO_ANO[Number(nascimento.slice(0, 4))] ?? null,
  };
}

/** Dia da semana curto do aniversário deste ano ("qui"). */
export function diaDaSemanaCurto(iso: string): string {
  return ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][diaDaSemanaISO(iso) - 1];
}

