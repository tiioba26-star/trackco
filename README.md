# Trackco · Remuneração variável da IOBA

Webapp (PWA) para medir o desempenho dos colaboradores e transformá-lo em reconhecimento, prêmios, comissão ou pontos, a partir dos dados do Klingo, com conferência, aprovação e extrato para cada pessoa.

**Endereço:** https://trackco.ioba.com.br · **Piloto:** equipe Comercial (5 atendentes + 1 líder), fase *Reconhecimento*.

## O que tem

| Área | O que faz |
|---|---|
| **Painel** | Meta x realizado, atingimento, ritmo necessário por dia útil, projeção, nível, evolução diária e ranking (visão do atendente, do líder e do admin). |
| **Extrato** | Memorial de cálculo: regra aplicada (versão), meta original e ajustada, ajustes, nota e **todas as linhas do Klingo usadas**, com botão **Contestar**. |
| **Contestações** | O atendente aponta divergências; o líder ou o admin respondem e podem lançar ajustes com justificativa. |
| **Fechamentos** | Cálculo → prazo de contestação → conferência do líder → aprovação do admin → entregue (etapas configuráveis por equipe). O checklist "O que revisar" acompanha cada etapa. |
| **Relatórios** | Evolução mensal, quebras por operadora, procedimento e profissional, e exportação em CSV. |
| **Métricas** | Construtor sem código: fonte, data de referência, filtros e contagem/soma/taxa, com teste em dados reais. |
| **Planos e regras** | Indicadores com escopo (individual/equipe), pesos, tetos, faixas, recompensas e condições. Simulador e versões imutáveis. |
| **Metas** | Grade mensal por pessoa e por equipe, com cópia do mês anterior. |
| **Equipes / Colaboradores / Ausências** | Estrutura flexível para novas equipes (limpeza, recepção…). Férias e atestados geram meta proporcional. |
| **Modo TV** | Link público e anônimo (carinhas neutra, feliz e mega feliz, nunca triste). A tela alterna os modos a cada 30 s e não mostra R$ nem pontos. |
| **Ajuda (?)** | Em todas as telas há uma explicação da seção e um tour guiado (driver.js). |
| **Auditoria** | Registra quem mudou o quê e quando, com os valores de antes e depois. |

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Recharts · Supabase (Postgres + Auth + RLS) · Vercel · robô Python + Playwright no GitHub Actions.

```
src/engine/            motor de cálculo puro (testado com Vitest)
src/lib/calculo/       carrega dados do Supabase, roda o motor e grava apurações + memorial
src/app/(app)/         telas autenticadas
src/app/tv/[token]/    modo TV (público)
src/app/api/           recálculo (robô), dados da TV, CSV
supabase/migrations/   schema trackco, RLS, funções, seed do piloto
supabase/tests/        testes das migrations/RLS em Postgres local (PGlite)
robo/                  sincronização Klingo → Supabase
```

## Como os números são calculados (padrão do piloto)

- **Agendamentos (quantitativo):** marcações *Particular* feitas pelo atendente, contadas **no dia em que ele agendou**.
- **Consultas realizadas (qualitativo):** marcações dele que viraram atendimento, contadas **no dia em que a consulta aconteceu**. Se ele agendou no mês passado e o paciente veio hoje, o número dele sobe hoje.
- **Taxa de conversão:** das consultas marcadas para o mês até ontem, quantas % aconteceram.
- **Líder:** avaliado pelos mesmos indicadores com **escopo equipe**, ou seja, a soma dos membros contra a meta da equipe.
- **Nota geral** = média dos atingimentos ponderada pelos pesos, limitada ao teto. A nota cai numa faixa: *Em desenvolvimento* (<80%), *Quase lá* (80–99%), *Meta batida* (100–119%) ou *Destaque* (120%+).

Tudo isso pode ser alterado nas telas **Métricas** e **Planos e regras**, sem código.

## Configuração (primeira vez)

### 1. Supabase (mesmo projeto do sistema `relatorio`)

1. Rode as migrations **na ordem**. Pelo SQL Editor do Supabase, cole o conteúdo de cada arquivo de `supabase/migrations/`; ou use `supabase db push`.
   - Elas criam só o schema `trackco` e **não alteram** nada do `relatorio`.
   - O seed importa de `public.usuarios` a equipe *Comercial* e os admins.
2. **Exponha o schema** em *Project Settings → Data API → Exposed schemas*: adicione `trackco`.
3. Pegue as chaves em *Project Settings → API Keys*: URL, *publishable* e *secret*.

### 2. Vercel

1. *Add New → Project* → importe o repositório do GitHub.
2. Em *Environment Variables*, cadastre as variáveis de `.env.example`.
3. Em *Settings → Domains*, adicione `trackco.ioba.com.br`. O DNS já está na Vercel.

### 3. GitHub Actions (robô do Klingo)

No repositório, em *Settings → Secrets and variables → Actions*:

| Secret | Valor |
|---|---|
| `KLINGO_USUARIO` / `KLINGO_SENHA` | Mesmo usuário que o robô do relatorio usa |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Do projeto Supabase |
| `TRACKCO_RECALC_TOKEN` | O mesmo valor cadastrado na Vercel |

O robô roda de hora em hora (07h–19h, seg–sáb) e faz uma reconciliação às 03h. Para disparar na mão: *Actions → Sincronizar Klingo → Run workflow*. Para testar localmente sem gravar nada:

```bash
pip install -r robo/requirements.txt && python -m playwright install chromium
python robo/sync_klingo.py --dry-run --toml ../relatorio/klingo.toml
```

### 4. Primeiro acesso

1. Entre com o usuário admin do relatorio.
2. **Equipes → Comercial:** marque quem é o líder.
3. **Colaboradores:** confira o *login no Klingo* de cada pessoa.
4. **Metas:** defina as metas do mês.
5. **Dados e lançamentos → Recalcular agora.**
6. **Painéis de TV:** crie o link da TV.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev                  # http://localhost:3000
npm test                     # motor + migrations/RLS (PGlite) — não toca no Supabase real
python robo/test_cruzamento.py
```

## Próximas fases

- **Fase 2 (após os 2 meses de reconhecimento):** catálogo de prêmios (bombom, caneca, camiseta…) e controle de entrega. As tabelas `catalogo_premios` e `premios_concedidos` já existem.
- **Fase 3 (após 6 meses):** comissão em R$ e pontos com loja de resgate (folga, produtos, dinheiro). As tabelas `pontos_extrato` e `resgates` já existem.
- **App Android/iOS:** Expo/React Native sobre o mesmo Supabase. As regras e o cálculo já ficam no servidor.
