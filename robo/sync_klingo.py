"""Robô do Trackco: sincroniza o Klingo com o Supabase (schema trackco).

Baseado no robô do sistema "relatorio" (scripts/atualizar_dados.py), com duas diferenças:
- grava direto no banco (tabela trackco.klingo_agendamentos), sem CSV no repositório;
- traz todas as operadoras (os filtros, ex.: Particular ou SUS, ficam nas métricas do Trackco).

Passos:
 1. Login no Klingo (Playwright) e captura do token da API.
 2. Nomes dos usuários do Klingo (usuarios.index) -> trackco.klingo_usuarios.
 3. Relatório 2331 (marcações) por mês de "Data Agendado Em" -> trackco.klingo_sincronizar_mes.
 4. Relatório 319 (produção) por mês de "Data Atendimento" x marcações do banco -> atendido/valor/data_realizacao.
 5. Registra a execução em trackco.sync_execucoes e pede o recálculo ao Trackco (/api/recalcular).

O nome do paciente é gravado (decisão da IOBA, LGPD) mas nunca é impresso no log.

Variáveis de ambiente:
  KLINGO_USUARIO, KLINGO_SENHA            (ou --toml caminho/klingo.toml com usuario/senha)
  SUPABASE_URL, SUPABASE_SECRET_KEY       (secret key do projeto; só no GitHub Actions)
  TRACKCO_URL, TRACKCO_RECALC_TOKEN       (opcional: pede o recálculo após sincronizar)

Uso:
  python robo/sync_klingo.py                      # modo horário: mês atual e anterior
  python robo/sync_klingo.py --modo reconciliacao # madrugada: últimos 4 meses de marcações e de produção
  python robo/sync_klingo.py --dry-run --toml ../relatorio/klingo.toml   # testa sem gravar nada
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import io
import json
import os
import sys
import tomllib
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

URL_LOGIN = "https://ioba.klingo.app/"
URL_API_REL = "https://api-relatorio.klingo.app/api/aql"
URL_API = "https://api.klingo.app/api/aql"
FUSO = timezone(timedelta(hours=-3))  # America/Bahia (sem horário de verão)

limpa = lambda v: (v or "").strip().removeprefix('="').removesuffix('"').strip()  # noqa: E731
norm = lambda v: " ".join(unicodedata.normalize("NFKD", limpa(v)).encode("ascii", "ignore").decode().upper().split())  # noqa: E731


def data_de(v: str) -> date:
    s = limpa(v)[:10]
    return datetime.strptime(s, "%Y-%m-%d" if s[4:5] == "-" else "%d/%m/%Y").date()


def valor_de(v: str) -> float:
    s = limpa(v)
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s or 0)
    except ValueError:
        return 0.0


def proximo_mes(d: date) -> str:
    return f"{d.year + (d.month == 12)}-{d.month % 12 + 1:02d}"


def meses_ate(fim: date, n: int) -> list[str]:
    """Os n meses terminando em `fim` (AAAA-MM), do mais antigo ao mais recente."""
    out, a, m = [], fim.year, fim.month
    for _ in range(n):
        out.append(f"{a}-{m:02d}")
        m -= 1
        if m == 0:
            a, m = a - 1, 12
    return sorted(out)


# ---------------------------------------------------------------- Supabase (REST)
class Supabase:
    def __init__(self, url: str, chave: str, dry: bool):
        self.url = url.strip().rstrip("/").removesuffix("/rest/v1").rstrip("/")
        self.chave = chave
        self.dry = dry

    def _req(self, metodo: str, caminho: str, corpo=None, extra: dict | None = None):
        headers = {
            "apikey": self.chave,
            "content-type": "application/json",
            "accept": "application/json",
            "accept-profile": "trackco",
            "content-profile": "trackco",
        }
        if self.chave.startswith("eyJ"):  # chave legada (JWT)
            headers["authorization"] = f"Bearer {self.chave}"
        headers.update(extra or {})
        dados = json.dumps(corpo).encode() if corpo is not None else None
        req = urllib.request.Request(f"{self.url}/rest/v1/{caminho}", data=dados, method=metodo, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                txt = r.read().decode() or "null"
                return json.loads(txt)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Supabase {metodo} {caminho.split('?')[0]} -> {e.code}: {e.read().decode()[:300]}") from None

    def rpc(self, nome: str, args: dict, query: str = "", tentativas: int = 3):
        # o banco pode cancelar por tempo-limite em horários de carga: tenta de novo com espera
        for t in range(1, tentativas + 1):
            try:
                return self._req("POST", f"rpc/{nome}{query}", args)
            except RuntimeError as e:
                if "57014" not in str(e) or t == tentativas:
                    raise
                import time
                time.sleep(10 * t)

    def insert(self, tabela: str, linha: dict):
        return self._req("POST", tabela, linha, {"prefer": "return=representation"})

    def upsert(self, tabela: str, linhas: list, conflito: str):
        return self._req("POST", f"{tabela}?on_conflict={conflito}", linhas, {"prefer": "resolution=merge-duplicates,return=minimal"})

    def patch(self, tabela: str, filtro: str, valores: dict):
        return self._req("PATCH", f"{tabela}?{filtro}", valores, {"prefer": "return=minimal"})


# ---------------------------------------------------------------- Klingo
class Klingo:
    def __init__(self, page):
        self.page = page
        self.token: str | None = None

    def login(self, usuario: str, senha: str):
        p = self.page
        p.goto(URL_LOGIN, wait_until="networkidle")
        p.fill("input[name=login-username]", usuario)
        p.fill("input[name=login-userpassword]", senha)
        with p.expect_response(lambda r: r.url.endswith("/api/login"), timeout=30000) as resp:
            p.press("input[name=login-userpassword]", "Enter")
        self.token = resp.value.json().get("access_token")
        if not self.token:
            raise RuntimeError("Login no Klingo não devolveu token (usuário/senha?).")

    def _headers(self):
        return {
            "authorization": "Bearer " + (self.token or ""),
            "content-type": "application/json",
            "accept": "application/json",
            "x-domain": "ioba",
            "x-unidade": "1",
            "x-portal": "0",
        }

    def relatorio(self, parms: dict) -> list[dict]:
        """Relatório pela API (csv=true, sem limite de linhas da tela)."""
        r = self.page.context.request.post(
            URL_API_REL,
            timeout=180000,
            headers=self._headers(),
            data=json.dumps({"q": [{"name": "relatorios.show", "parms": {
                **parms, "csv": True, "config_cols": None, "tipo_detalhe": "S", "dimensao": None}}]}),
        )
        if not r.ok:
            raise RuntimeError(f"API do Klingo respondeu {r.status}")
        d = r.json()["relatorios.show"]["data"]
        res = d.get("result")
        if d.get("error") or not isinstance(res, dict) or not isinstance(res.get("data"), str):
            raise RuntimeError(f"relatório sem dados ({(d.get('error') or '')[:80]})")
        return list(csv.DictReader(io.StringIO(res["data"].lstrip("﻿"), newline=""), delimiter=";"))

    def usuarios(self) -> dict[str, str]:
        r = self.page.context.request.post(
            f"{URL_API}?a=usuarios.index",
            timeout=60000,
            headers=self._headers(),
            data=json.dumps({"q": [{"name": "usuarios.index", "id": "item", "parms": {}}]}),
        )
        if not r.ok:
            raise RuntimeError(f"usuarios.index respondeu {r.status}")
        return {
            u["st_login"].lower(): u["search"].strip()
            for u in r.json()["item"]["data"]
            if u.get("st_login") and (u.get("search") or "").strip()
        }


# ---------------------------------------------------------------- transformação
def chaves_2331(linhas: list[dict]) -> list[dict]:
    """Converte o 2331 em linhas do banco. A chave é um hash dos campos + ordinal (marcações idênticas)."""
    contagem: collections.Counter = collections.Counter()
    out = []
    for r in linhas:
        if not limpa(r.get("Data Agendado Em")):
            continue
        em = data_de(r["Data Agendado Em"])
        para = data_de(r["Data Agendado Para"]) if limpa(r.get("Data Agendado Para")) else None
        base = "|".join([
            em.isoformat(), para.isoformat() if para else "", limpa(r.get("Responsável")).lower(), norm(r.get("Procedimento")),
            norm(r.get("Profissional")), norm(r.get("Operadora")), limpa(r.get("Qtd")), norm(r.get("Paciente - Nome")),
        ])
        h = hashlib.sha1(base.encode()).hexdigest()[:20]
        contagem[h] += 1
        out.append({
            "chave": f"{h}-{contagem[h]}",
            "data_agendado_em": em.isoformat(),
            "data_agendado_para": para.isoformat() if para else None,
            "responsavel_login": limpa(r.get("Responsável")).lower() or None,
            "paciente_nome": limpa(r.get("Paciente - Nome")) or None,
            "procedimento": limpa(r.get("Procedimento")) or None,
            "profissional": limpa(r.get("Profissional")) or None,
            "operadora": limpa(r.get("Operadora")) or None,
            "qtd": valor_de(r.get("Qtd")) or 1,
        })
    return out


def categoria_operadora(v) -> str:
    """Particular ou SUS. O 2331 traz "Particular"/"SUS"; o 319 traz "Particular - PARTICULAR", "SUS - SUS"..."""
    n = norm(v)
    if n.startswith("PARTIC"):
        return "particular"
    if n == "SUS" or n.startswith("SUS ") or n.startswith("SUS-"):
        return "sus"
    return ""


def operadoras_conflitam(a, b) -> bool:
    """Marcação Particular não é confirmada por atendimento SUS (e vice-versa). Outras operadoras não bloqueiam."""
    return {categoria_operadora(a), categoria_operadora(b)} == {"particular", "sus"}


def indice_cancelamentos(cancelamentos: list[dict] | None) -> dict:
    """Relatório 47 agrupado por visita (paciente + dia da consulta)."""
    c47 = collections.defaultdict(list)
    for r in cancelamentos or []:
        if not (limpa(r.get("Agendado Para")) and limpa(r.get("Paciente"))):
            continue
        try:
            c47[(norm(r["Paciente"]), data_de(r["Agendado Para"]))].append(r)
        except ValueError:  # linha quebrada no CSV do Klingo
            continue
    return c47


def _mesmo_prof(a, b) -> bool:
    a, b = norm(a), norm(b)
    return bool(a and b) and (a.startswith(b) or b.startswith(a))


def casar_cancelamentos(lista: list[dict], canc: list[dict]) -> dict:
    """Liga cada cancelamento do 47 a uma marcação da visita. O "Usuario" do 47 é quem fez a marcação cancelada
    (confere em 99,8% dos casos sem ambiguidade, out-nov/2026), então ele vem primeiro; depois o profissional
    (o 47 às vezes abrevia o nome ou traz a sala, ex.: CENTRO CIRURGICO); por fim só o procedimento.
    Entre candidatas iguais, a marcação mais antiga recebe o cancelamento. Devolve {chave da marcação: linha do 47}."""
    livres = list(canc)
    out: dict = {}
    ordem = sorted(lista, key=lambda b: (b.get("data_agendado_em") or "", b["chave"]))

    def proc(r, b):
        return norm(r.get("Procedimento")) == norm(b.get("procedimento"))

    def dono(r, b):
        return bool(limpa(r.get("Usuario"))) and limpa(r.get("Usuario")).lower() == (b.get("responsavel_login") or "").lower()

    def prof(r, b):
        return _mesmo_prof(r.get("Profissional"), b.get("profissional"))

    criterios = (
        lambda r, b: proc(r, b) and dono(r, b) and prof(r, b),
        lambda r, b: proc(r, b) and dono(r, b),
        lambda r, b: proc(r, b) and prof(r, b),
        proc,
    )
    for criterio in criterios:
        for b in ordem:
            if b["chave"] in out:
                continue
            i = next((i for i, r in enumerate(livres) if criterio(r, b)), None)
            if i is not None:
                out[b["chave"]] = livres.pop(i)
    return out


def _ordem_credito(lista: list[dict], canceladas: dict) -> list[dict]:
    """Quem recebe a produção primeiro: marcação não cancelada, depois a mais recente (numa remarcação para o
    mesmo dia, a nova); a chave só desempata, para o resultado não depender da ordem do banco."""
    por_chave = sorted(lista, key=lambda b: b["chave"])
    por_data = sorted(por_chave, key=lambda b: b.get("data_agendado_em") or "", reverse=True)
    return sorted(por_data, key=lambda b: b["chave"] in canceladas)


def cruzar(marcacoes: list[dict], producao: list[dict], hoje: date, cancelamentos: list[dict] | None = None) -> list[dict]:
    """Mesmo critério do relatorio (paciente + dia; primeiro casa o mesmo procedimento, depois o que sobrar), com duas
    regras para o crédito ir para quem marcou a consulta que de fato aconteceu:
    - se a visita tem mais marcações do que atendimentos, a produção vai primeiro para a marcação que NÃO foi
      cancelada no relatório 47 e, entre elas, para a mais recente;
    - atendimento SUS não confirma marcação Particular (e vice-versa).
    """
    prod = collections.defaultdict(list)
    for r in producao:
        if limpa(r.get("Data Atendimento")):
            prod[(norm(r.get("Paciente")), data_de(r["Data Atendimento"]))].append(
                (norm(r.get("Procedimento")), valor_de(r.get("Valor")), limpa(r.get("Operadora"))))
    c47 = indice_cancelamentos(cancelamentos)

    visitas = collections.defaultdict(list)
    for m in marcacoes:
        if not m.get("data_agendado_para") or not m.get("paciente_nome"):
            continue
        visitas[(norm(m["paciente_nome"]), date.fromisoformat(m["data_agendado_para"]))].append(m)

    resultado = []
    for (pac, para), lista in visitas.items():
        lista = _ordem_credito(lista, casar_cancelamentos(lista, c47.get((pac, para), [])))
        restantes = list(prod.get((pac, para), []))
        casadas, sem_par = [], []
        for b in lista:
            i = next((i for i, (p, _, op) in enumerate(restantes)
                      if p == norm(b.get("procedimento")) and not operadoras_conflitam(op, b.get("operadora"))), None)
            if i is None:
                sem_par.append(b)
            else:
                casadas.append([b, restantes.pop(i)[1]])
        for b in sem_par:
            i = next((i for i, (_, _, op) in enumerate(restantes) if not operadoras_conflitam(op, b.get("operadora"))), None)
            if i is not None:
                casadas.append([b, restantes.pop(i)[1]])
            elif para < hoje:  # dia já passou e não houve atendimento (desta operadora)
                resultado.append({"chave": b["chave"], "atendido": False, "valor": None, "data_realizacao": None})
            # para == hoje sem produção ainda: fica pendente (null)
        if casadas and restantes:  # itens feitos a mais na visita (mesma operadora) ficam com a primeira marcação
            casadas[0][1] += sum(v for _, v, op in restantes if not operadoras_conflitam(op, casadas[0][0].get("operadora")))
        for b, v in casadas:
            resultado.append({"chave": b["chave"], "atendido": True, "valor": round(v, 2), "data_realizacao": para.isoformat()})
    return resultado


def classificar(marcacoes: list[dict], cruzamento: list[dict], cancelamentos: list[dict], remarcacoes: list[dict],
                hoje: date) -> list[dict]:
    """Por que cada marcação não virou consulta (relatórios 47 e 8440 do Klingo).

    - realizada: cruzou com a produção (319)
    - bloqueio_clinica / remarcada / erro / cancelada: relatório 47 (Status + Motivo do cancelamento); se a visita tem
      mais de uma marcação, usa o cancelamento do mesmo procedimento/profissional
    - falta_remarcada / remarcada: relatório 8440 (marcação de origem de uma remarcação; Falta=1 = faltou antes)
    - nao_realizada: dia já passou e nenhum relatório explica (não compareceu)
    - None: consulta de hoje ou futura ainda sem desfecho
    """
    atendido = {r["chave"]: r["atendido"] for r in cruzamento}
    c47 = indice_cancelamentos(cancelamentos)
    r8440 = {}
    for r in remarcacoes:
        origem = next((v for k, v in r.items() if k and k.startswith("Origem")), None)
        if limpa(origem) and limpa(r.get("Paciente")):
            try:
                r8440.setdefault((norm(r["Paciente"]), data_de(origem)), r)
            except ValueError:
                continue
    visitas = collections.defaultdict(list)
    for m in marcacoes:
        if m.get("data_agendado_para") and m.get("paciente_nome"):
            visitas[(norm(m["paciente_nome"]), date.fromisoformat(m["data_agendado_para"]))].append(m)
    out = []
    for visita, lista in visitas.items():
        canc = c47.get(visita, [])
        ligados = casar_cancelamentos(lista, canc) if canc else {}
        for m in lista:
            situacao, motivo = None, None
            if atendido.get(m["chave"]) is True:
                situacao = "realizada"
            elif canc:
                r = ligados.get(m["chave"]) or canc[0]
                motivo = limpa(r.get("Motivo"))[:200] or None
                mot = norm(motivo)
                if limpa(r.get("Status")).lower().startswith("bloq"):
                    situacao = "bloqueio_clinica"
                elif "REMARC" in mot:
                    situacao = "remarcada"
                elif mot.startswith("ERRO") or "UNIFICAD" in mot or "DUPLIC" in mot:
                    situacao = "erro"
                else:
                    situacao = "cancelada"
            elif visita in r8440:
                situacao = "falta_remarcada" if limpa(r8440[visita].get("Falta")) == "1" else "remarcada"
            elif visita[1] < hoje:
                situacao = "nao_realizada"
            out.append({"chave": m["chave"], "situacao": situacao, "motivo": motivo})
    return out


# ---------------------------------------------------------------- principal
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modo", choices=["horario", "reconciliacao"], default="horario")
    ap.add_argument("--desde", help="carga histórica: sincroniza de AAAA-MM até hoje (ex.: 2025-01)")
    ap.add_argument("--meses", help="só estes meses, separados por vírgula (ex.: 2025-07,2025-08)")
    ap.add_argument("--toml")
    ap.add_argument("--dry-run", action="store_true", help="não grava nada; só mostra o resumo")
    ap.add_argument("--visivel", action="store_true")
    args = ap.parse_args()

    if args.toml:
        cfg = tomllib.loads(Path(args.toml).read_text(encoding="utf-8"))
        usuario, senha = cfg["usuario"], cfg["senha"]
    else:
        usuario, senha = os.environ.get("KLINGO_USUARIO"), os.environ.get("KLINGO_SENHA")
    if not usuario or not senha:
        sys.exit("Credenciais do Klingo ausentes (KLINGO_USUARIO/KLINGO_SENHA ou --toml).")
    sb_url, sb_chave = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
    if not args.dry_run and (not sb_url or not sb_chave):
        sys.exit("SUPABASE_URL/SUPABASE_SECRET_KEY ausentes (use --dry-run para testar sem gravar).")
    sb = Supabase(sb_url or "", sb_chave or "", args.dry_run)

    hoje = datetime.now(FUSO).date()
    if args.desde:
        a, m = (int(x) for x in args.desde.split("-"))
        n = (hoje.year - a) * 12 + hoje.month - m + 1
        if not 1 <= n <= 60:
            sys.exit("--desde precisa ser um mês entre 5 anos atrás e hoje (AAAA-MM).")
        n_ag = n_prod = n
        args.modo = "historico"
    else:
        n_ag, n_prod = (2, 2) if args.modo == "horario" else (4, 4)
    meses_ag = meses_ate(hoje, n_ag)
    # + o próximo mês: marcações feitas agora para consultas futuras já saem dos "válidos" quando são remarcadas
    meses_prod = meses_ate(hoje, n_prod) + [proximo_mes(hoje)]
    if args.meses:
        meses_ag = meses_prod = sorted(m.strip() for m in args.meses.split(",") if m.strip())
        args.modo = "historico"
    print(f"Modo {args.modo} | marcações: {', '.join(meses_ag)} | produção: {', '.join(meses_prod)}", flush=True)

    exec_id = None
    if not args.dry_run:
        exec_id = sb.insert("sync_execucoes", {"modo": args.modo, "status": "executando"})[0]["id"]

    avisos: list[str] = []
    total_ag = total_cruz = 0
    detalhes: dict = {"meses": {}}
    from playwright.sync_api import sync_playwright  # importa só aqui: o resto do módulo é testável sem navegador

    try:
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(channel="chrome", headless=not args.visivel)
            except Exception:
                browser = p.chromium.launch(headless=not args.visivel)
            page = browser.new_context(viewport={"width": 1400, "height": 900}).new_page()
            k = Klingo(page)
            k.login(usuario, senha)

            # 1) nomes dos usuários do Klingo
            try:
                nomes = k.usuarios()
                if not args.dry_run and nomes:
                    sb.upsert("klingo_usuarios", [{"login": l, "nome": n, "atualizado_em": datetime.now(timezone.utc).isoformat()} for l, n in nomes.items()], "login")
                print(f"Usuários do Klingo: {len(nomes)}", flush=True)
            except Exception as e:  # não impede o resto
                avisos.append(f"usuarios.index: {type(e).__name__}")

            # 2) marcações (2331), mês a mês pela data do agendamento
            for m in meses_ag:
                try:
                    linhas = chaves_2331(k.relatorio({"id": "2331", ":periodo0": "lm", ":periodo0-mes": m}))
                    linhas = [l for l in linhas if l["data_agendado_em"].startswith(m)]
                    if not linhas:
                        raise RuntimeError("mês sem linhas")
                    if args.dry_run:
                        ops = collections.Counter(l["operadora"] for l in linhas)
                        print(f"  2331 {m}: {len(linhas)} marcações · operadoras: {dict(ops.most_common(6))}", flush=True)
                    else:
                        r = sb.rpc("klingo_sincronizar_mes", {"p_mes": f"{m}-01", "p_linhas": linhas})
                        print(f"  2331 {m}: {r}", flush=True)
                    total_ag += len(linhas)
                    detalhes["meses"][m] = {"marcacoes": len(linhas)}
                except Exception as e:
                    avisos.append(f"2331 {m}: {type(e).__name__}: {str(e)[:120]}")
                    print(f"  Aviso 2331 {m}: {e}", flush=True)

            # 3) produção (319) x marcações do banco, mês a mês pela data marcada
            for m in meses_prod:
                try:
                    futuro = m > hoje.strftime("%Y-%m")
                    if futuro:
                        producao = []  # consultas que ainda não aconteceram: só os motivos (47/8440) importam
                    else:
                        try:
                            producao = k.relatorio({"id": "319", ":periodo": "lm", ":periodo-mes": m, ":medico": "", ":unidade": "", ":operadora": ""})
                        except Exception:
                            # se o filtro "todas as operadoras" não for aceito, cai para Particular (como no relatorio)
                            producao = k.relatorio({"id": "319", ":periodo": "lm", ":periodo-mes": m, ":medico": "", ":unidade": "", ":operadora": 1})
                            avisos.append(f"319 {m}: só Particular (filtro de todas as operadoras não aceito)")
                    # por que não aconteceu: cancelamentos/bloqueios (47) e remarcações/faltas (8440).
                    # O 47 também decide o crédito quando a mesma visita tem mais de uma marcação.
                    canc = rem = None
                    try:
                        canc = k.relatorio({"id": "47", ":periodo": "lm", ":periodo-mes": m, ":unidade": "", ":operadora": ""})
                        rem = k.relatorio({"id": "8440", ":periodo1": "lm", ":periodo1-mes": m, ":parm2": "S"})
                    except Exception as e:  # sem os motivos, o cruzamento continua como antes
                        if not futuro:
                            avisos.append(f"47/8440 {m}: {type(e).__name__}: {str(e)[:120]}")
                    if args.dry_run:
                        print(f"  319 {m}: {len(producao)} linhas de produção · 47: {len(canc or [])} · 8440: {len(rem or [])}", flush=True)
                        continue
                    marcacoes: list[dict] = []
                    while True:
                        lote = sb.rpc("klingo_marcacoes_para", {"p_mes": f"{m}-01"}, f"?limit=1000&offset={len(marcacoes)}")
                        marcacoes += lote
                        if len(lote) < 1000:
                            break
                    res = cruzar(marcacoes, producao, hoje, canc)
                    alterados = 0
                    for i in range(0, len(res), 2000):
                        alterados += sb.rpc("klingo_marcar_atendidos", {"p_linhas": res[i:i + 2000]}) or 0
                    if canc is not None and rem is not None:
                        sit = classificar(marcacoes, res, canc, rem, hoje)
                        for i in range(0, len(sit), 2000):
                            sb.rpc("klingo_marcar_situacao", {"p_linhas": sit[i:i + 2000]})
                        cont = collections.Counter(x["situacao"] for x in sit)
                        detalhes["meses"].setdefault(m, {})["situacao"] = {str(a): b for a, b in cont.items()}
                        print(f"  47/8440 {m}: {dict(cont)}", flush=True)
                    atendidas = sum(1 for x in res if x["atendido"])
                    total_cruz += len(res)
                    detalhes["meses"].setdefault(m, {})["cruzamento"] = {"verificadas": len(res), "atendidas": atendidas, "alteradas": alterados}
                    print(f"  319 {m}: {len(res)} marcações verificadas, {atendidas} atendidas, {alterados} alteradas", flush=True)
                except Exception as e:
                    avisos.append(f"319 {m}: {type(e).__name__}: {str(e)[:120]}")
                    print(f"  Aviso 319 {m}: {e}", flush=True)
            browser.close()
    except Exception as e:
        if exec_id:
            sb.patch("sync_execucoes", f"id=eq.{exec_id}", {
                "status": "erro", "finalizado_em": datetime.now(timezone.utc).isoformat(),
                "mensagem": f"{type(e).__name__}: {str(e)[:300]}", "detalhes": detalhes})
        raise

    # 4) pede o recálculo ao Trackco (o resultado fica registrado na execução, visível em "Dados")
    url, token = os.environ.get("TRACKCO_URL"), (os.environ.get("TRACKCO_RECALC_TOKEN") or "").strip()
    if args.dry_run:
        pass
    elif not url or not token:
        avisos.append("recálculo não pedido: TRACKCO_URL/TRACKCO_RECALC_TOKEN ausentes")
    else:
        detalhes["recalculo"] = {}
        for comp in meses_ate(hoje, n_ag if args.desde else 2)[::-1]:  # um pedido por mês (limite de 60 s da Vercel)
            try:
                req = urllib.request.Request(f"{url.rstrip('/')}/api/recalcular", data=json.dumps({"competencia": comp}).encode(),
                                             method="POST", headers={"authorization": f"Bearer {token}",
                                                                     "content-type": "application/json", "user-agent": "trackco-robo"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    detalhes["recalculo"][comp] = r.status
                    print(f"Recálculo {comp}: HTTP {r.status}", flush=True)
            except urllib.error.HTTPError as e:
                msg = "token não confere com a Vercel" if e.code == 401 else e.read().decode()[:120]
                avisos.append(f"recálculo {comp} falhou (HTTP {e.code}: {msg})")
            except Exception as e:
                avisos.append(f"recálculo {comp} falhou ({type(e).__name__}: {str(e)[:120]})")

    status = "ok" if not avisos else ("parcial" if total_ag else "erro")
    if exec_id:
        sb.patch("sync_execucoes", f"id=eq.{exec_id}", {
            "status": status,
            "finalizado_em": datetime.now(timezone.utc).isoformat(),
            "linhas_agendamentos": total_ag,
            "linhas_atendimentos": total_cruz,
            "mensagem": "; ".join(avisos)[:1000] or None,
            "detalhes": detalhes,
        })

    print(f"Concluído: {status} · {total_ag} marcações · {total_cruz} cruzamentos" + (f" · avisos: {avisos}" if avisos else ""))
    return 0 if status != "erro" else 1


if __name__ == "__main__":
    sys.exit(main())
