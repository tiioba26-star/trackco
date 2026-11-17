# Análises comentadas pela IA (área Gestão)

Uma rotina no computador da administração escreve estes textos todo dia às 5h, com repescagem às 13h. Ela usa duas assinaturas, sem chave de API, e os textos aparecem no fim de cada aba da Gestão do Trackco, que só administradores veem:

- **Google AI Pro**, pelo Antigravity CLI `agy`: as 100 análises por seção (Gemini 3.8 Flash). Se a cota acabar, a reserva é o Claude Sonnet 4.6, também pela cota do Google.
- **Anthropic (Claude Pro)**, pelo Claude Code: só a análise geral, uma vez por dia, no Opus 5.5. É a mesma conta usada para programar, por isso a rotina gasta pouco dela.

Na calibração de 17/11/2026, cada análise do Gemini Flash gastou cerca de 0,1% da cota semanal do Google.

- **`gestao/`**: as análises.
  - `<seção>__<período>__<comparação>__<recorte>.md` são 100 arquivos, que saem da combinação abaixo:

    | Item | Opções |
    |---|---|
    | Seção (5) | faturamento, marcacao, equipes, quem, perdas |
    | Período (5) | mes, mes_passado, 3m, ano, 12m |
    | Comparação (2) | anterior, ano |
    | Recorte (2) | particular, todas |

  - `geral.md` é a análise geral da clínica.
  - `_status.json` diz como foi a última rodada: quantas análises saíram, quais falharam, tokens e custo equivalente.
- **`prompts/`**: as instruções que a IA recebe.
  - `base.md` vale para todas as análises.
  - Há um guia por seção e o `geral.md`. Para mudar o estilo ou o foco das análises, edite esses arquivos.
- **`config.json`**: para as análises por seção e para a geral, define motor, modelo, esforço e quantas rodam ao mesmo tempo.
  - O motor é `claude` (conta Anthropic) ou `antigravity` (conta Google; `gemini` é o nome antigo e também vale).
  - `reserva` (opcional) é o motor que assume se a cota do principal acabar no meio da rodada.
  - `maximo_por_rodada` (opcional) limita quantas análises por seção saem em cada rodada, as mais importantes primeiro (este mês, mês passado, 12 meses…). O resto fica pendente para a rodada seguinte.
  - Modelos da conta Google: `agy models`.
    - Hoje: `gemini-3.8-flash-high`, `-medium` e `-low`, `claude-sonnet-4-6` e `claude-opus-4-6-thinking`. O Argon não aparece no Google AI Pro.
    - Os modelos Claude do `agy` não aceitam esforço: deixe `"esforco": ""`.
  - O `agy` é achado em `~/.gemini/bin` (ou em `AGY_BIN`); o `claude`, na extensão do Antigravity, VS Code ou Cursor (ou em `CLAUDE_BIN`).
- Ficam fora do git `.dados/` (os números enviados à IA, para conferência) e `logs/`.

## Como a rotina decide o que refazer

- **"Este mês" e "este ano":** todo dia.
- **Mês passado, 3 e 12 meses:** só quando os números mudam de verdade (variação de mais ou menos 5%).
- **Dia 1:** tudo o que fechou é refeito.
- **Geral:** sai todo dia, depois das seções.

## Comandos

Rode na pasta da rotina.

| Comando | O que faz |
|---|---|
| `npm run analises:rodar` | Rodada normal (faz commit e push de `analises/gestao`) |
| `npm run analises:rodar -- --tudo` | Refaz as 101 |
| `npm run analises:rodar -- --amostra` | Calibração: as mesmas 3 análises em Sonnet médio, Opus médio e Gemini Flash alto, mais a geral no motor da config e no Gemini. Grava em `.dados/amostra` e não publica |
| `npm run analises:rodar -- --so <arquivo>.md --motor gemini --modelo gemini-3.8-flash-high --esforco high --sem-publicar` | Testa uma análise num motor |
| `npm run analises:rodar -- --sem-publicar` | Escreve, mas não publica |

Os números vêm calculados pelo código (`src/lib/analises/dados.ts`) e a IA só interpreta. Nenhum dado de paciente sai do banco. Os motivos de cancelamento vão para a IA só como categorias.
