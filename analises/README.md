# Análises comentadas pela IA (área Gestão)

Uma rotina no computador da administração escreve estes textos todo dia às 5h, com repescagem às 13h. Ela usa o Claude Code pela assinatura, sem chave de API, e os textos aparecem no fim de cada aba da Gestão do Trackco, que só administradores veem.

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
- **`config.json`**: modelo e esforço das análises por seção e da geral, e quantas análises rodam ao mesmo tempo.
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
| `npm run analises:rodar -- --amostra` | Calibração de gasto; grava em `.dados/amostra` e não publica |
| `npm run analises:rodar -- --sem-publicar` | Escreve, mas não publica |

Os números vêm calculados pelo código (`src/lib/analises/dados.ts`) e a IA só interpreta. Nenhum dado de paciente sai do banco. Os motivos de cancelamento vão para a IA só como categorias.
