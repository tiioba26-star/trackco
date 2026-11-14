"""Testes do cruzamento 2331 x 319 e da geração de chaves (rodam sem Klingo e sem navegador).

    python robo/test_cruzamento.py
"""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sync_klingo import chaves_2331, classificar, cruzar, meses_ate  # noqa: E402


def m(chave, pac, para, proc="CONSULTA"):
    return {"chave": chave, "paciente_nome": pac, "data_agendado_para": para, "procedimento": proc}


def p(pac, dia, proc="CONSULTA", valor="350,00"):
    return {"Paciente": pac, "Data Atendimento": dia, "Procedimento": proc, "Valor": valor}


class TestCruzamento(unittest.TestCase):
    HOJE = date(2026, 11, 10)

    def test_atendido_e_nao_atendido(self):
        res = {r["chave"]: r for r in cruzar(
            [m("a", "Maria Silva", "2026-11-05"), m("b", "João", "2026-11-06")],
            [p("MARIA  SILVA", "05/11/2026")],
            self.HOJE,
        )}
        self.assertTrue(res["a"]["atendido"])
        self.assertEqual(res["a"]["valor"], 350.0)
        self.assertEqual(res["a"]["data_realizacao"], "2026-11-05")
        self.assertFalse(res["b"]["atendido"])

    def test_hoje_sem_producao_fica_pendente(self):
        self.assertEqual(cruzar([m("a", "Ana", "2026-11-10")], [], self.HOJE), [])

    def test_mesmo_procedimento_primeiro_e_troca_na_hora(self):
        res = {r["chave"]: r for r in cruzar(
            [m("a", "Rita", "2026-11-03", "EXAME A"), m("b", "Rita", "2026-11-03", "CONSULTA")],
            [p("Rita", "2026-11-03", "CONSULTA", "200"), p("Rita", "2026-11-03", "EXAME B", "100")],
            self.HOJE,
        )}
        self.assertEqual(res["b"]["valor"], 200.0)  # casou pelo procedimento
        self.assertTrue(res["a"]["atendido"])  # trocou na hora (EXAME A -> EXAME B)
        self.assertEqual(res["a"]["valor"], 100.0)

    def test_acento_e_caixa(self):
        res = cruzar([m("a", "José Conceição", "2026-11-02")], [p("JOSE CONCEICAO", "2026-11-02")], self.HOJE)
        self.assertTrue(res[0]["atendido"])

    def test_remarcacao_no_mesmo_dia_credita_quem_remarcou(self):
        # caso real de out/2026: Maiane marcou, Igor remarcou para o mesmo dia (duas vezes); só a última aconteceu
        marc = [
            {**m("mai", "Paula", "2026-10-07"), "data_agendado_em": "2026-10-03", "profissional": "MAURICIO MATEUS", "responsavel_login": "m.fiais"},
            {**m("ig1", "Paula", "2026-10-07"), "data_agendado_em": "2026-10-06", "profissional": "GUSTAVO GOMES", "responsavel_login": "i.soares"},
            {**m("ig2", "Paula", "2026-10-07"), "data_agendado_em": "2026-10-06", "profissional": "LORENA CAMPOS", "responsavel_login": "i.soares"},
        ]
        canc = [
            {"Paciente": "PAULA", "Agendado Para": "2026-10-07 08:00:00", "Procedimento": "CONSULTA", "Profissional": "Mauricio Mateus de Souza", "Status": "Cancelada", "Motivo": "Remarcado."},
            {"Paciente": "PAULA", "Agendado Para": "2026-10-07 09:00:00", "Procedimento": "CONSULTA", "Profissional": "Gustavo Gomes d", "Status": "Cancelada", "Motivo": "Remarcado."},
        ]
        res = {r["chave"]: r["atendido"] for r in cruzar(marc, [p("Paula", "2026-10-07")], self.HOJE, canc)}
        self.assertEqual(res, {"ig2": True, "mai": False, "ig1": False})
        sit = {x["chave"]: x["situacao"] for x in classificar(marc, [{"chave": k, "atendido": v} for k, v in res.items()], canc, [], self.HOJE)}
        self.assertEqual(sit, {"ig2": "realizada", "mai": "remarcada", "ig1": "remarcada"})

    def test_empate_no_mesmo_dia_usa_quem_fez_a_marcacao_cancelada(self):
        # duas pessoas marcaram no mesmo dia; o 47 diz de quem era a marcação cancelada (campo Usuario)
        marc = [
            {**m("bri", "Iara", "2026-10-28"), "data_agendado_em": "2026-10-28", "profissional": "GUSTAVO GOMES", "responsavel_login": "brisa"},
            {**m("ana", "Iara", "2026-10-28"), "data_agendado_em": "2026-10-28", "profissional": "GUSTAVO GOMES", "responsavel_login": "a.luiza"},
        ]
        for usuario, credito in (("A.LUIZA", "bri"), ("BRISA", "ana")):
            canc = [{"Paciente": "IARA", "Agendado Para": "2026-10-28 10:00:00", "Procedimento": "CONSULTA",
                     "Profissional": "Gustavo Gomes", "Status": "Cancelada", "Motivo": "Remarcado.", "Usuario": usuario}]
            for ordem in (marc, list(reversed(marc))):
                res = {r["chave"]: r["atendido"] for r in cruzar(ordem, [p("Iara", "2026-10-28")], self.HOJE, canc)}
                self.assertEqual([k for k, v in res.items() if v], [credito])

    def test_sem_cancelamento_a_marcacao_mais_recente_leva(self):
        marc = [{**m("velha", "Rui", "2026-10-07"), "data_agendado_em": "2026-10-01"},
                {**m("nova", "Rui", "2026-10-07"), "data_agendado_em": "2026-10-05"}]
        for ordem in (marc, list(reversed(marc))):  # não depende da ordem que vem do banco
            res = {r["chave"]: r["atendido"] for r in cruzar(ordem, [p("Rui", "2026-10-07")], self.HOJE)}
            self.assertEqual(res, {"nova": True, "velha": False})

    def test_atendimento_sus_nao_confirma_marcacao_particular(self):
        marc = [{**m("part", "Lia", "2026-10-07"), "operadora": "Particular"},
                {**m("sus", "Lia", "2026-10-07", "EXAME"), "operadora": "SUS"}]
        prod = [{**p("Lia", "2026-10-07", "EXAME", "0"), "Operadora": "SUS"},
                {**p("Lia", "2026-10-07", "RETORNO", "0"), "Operadora": "SUS - SUS"}]
        res = {r["chave"]: r["atendido"] for r in cruzar(marc, prod, self.HOJE)}
        self.assertEqual(res, {"sus": True, "part": False})
        prod_part = [{**p("Lia", "2026-10-07", "CONSULTA", "300"), "Operadora": "Particular - M. M. VASCONCELOS"}]
        self.assertTrue(cruzar(marc[:1], prod_part, self.HOJE)[0]["atendido"])

    def test_cada_marcacao_recebe_o_proprio_motivo(self):
        marc = [{**m("a", "Teo", "2026-10-07", "CONSULTA"), "profissional": "DR A", "data_agendado_em": "2026-10-01"},
                {**m("b", "Teo", "2026-10-07", "EXAME"), "profissional": "DR B", "data_agendado_em": "2026-10-01"}]
        canc = [{"Paciente": "Teo", "Agendado Para": "2026-10-07", "Procedimento": "EXAME", "Profissional": "DR B", "Status": "Cancelada", "Motivo": "ERRO DE CADASTRO"},
                {"Paciente": "Teo", "Agendado Para": "2026-10-07", "Procedimento": "CONSULTA", "Profissional": "DR A", "Status": "Cancelada", "Motivo": "Remarcado"}]
        sit = {x["chave"]: x["situacao"] for x in classificar(marc, [], canc, [], self.HOJE)}
        self.assertEqual(sit, {"a": "remarcada", "b": "erro"})


class TestSituacao(unittest.TestCase):
    HOJE = date(2026, 11, 10)

    def test_classifica_motivos(self):
        marc = [m("r", "Ana", "2026-10-01"), m("rem", "Bia", "2026-10-02"), m("blq", "Caio", "2026-10-03"),
                m("err", "Davi", "2026-10-04"), m("can", "Eva", "2026-10-05"), m("fr", "Fabi", "2026-10-06"),
                m("nr", "Gil", "2026-10-07"), m("fut", "Hugo", "2026-11-20")]
        cruz = [{"chave": "r", "atendido": True}]
        canc = [
            {"Paciente": "BIA", "Agendado Para": "2026-10-02 08:00:00", "Status": "Cancelada", "Motivo": "Remarcado."},
            {"Paciente": "Caio", "Agendado Para": "2026-10-03 09:00:00", "Status": "Bloqueada", "Motivo": "maquina com defeito"},
            {"Paciente": "Davi", "Agendado Para": "2026-10-04 09:00:00", "Status": "Cancelada", "Motivo": "ERRO"},
            {"Paciente": "Eva", "Agendado Para": "2026-10-05 09:00:00", "Status": "Cancelada", "Motivo": "paciente desistiu"},
        ]
        rem = [{"Paciente": "Fabi", "Origem (Remarcação)": "2026-10-06 07:00:00", "Agendado Para": "2026-10-20 08:00:00", "Falta": "1"}]
        res = {x["chave"]: x["situacao"] for x in classificar(marc, cruz, canc, rem, self.HOJE)}
        self.assertEqual(res, {"r": "realizada", "rem": "remarcada", "blq": "bloqueio_clinica", "err": "erro",
                               "can": "cancelada", "fr": "falta_remarcada", "nr": "nao_realizada", "fut": None})


class TestChaves(unittest.TestCase):
    def test_marcacoes_identicas_tem_chaves_distintas_e_estaveis(self):
        linha = {"Data Agendado Em": "05/11/2026", "Data Agendado Para": "10/11/2026", "Responsável": "ANA.K",
                 "Procedimento": "Consulta", "Profissional": "Dr X", "Operadora": "Particular", "Qtd": "1",
                 "Paciente - Nome": "Maria"}
        a = chaves_2331([linha, dict(linha)])
        b = chaves_2331([linha, dict(linha)])
        self.assertEqual([x["chave"] for x in a], [x["chave"] for x in b])
        self.assertNotEqual(a[0]["chave"], a[1]["chave"])
        self.assertEqual(a[0]["responsavel_login"], "ana.k")
        self.assertEqual(a[0]["data_agendado_para"], "2026-11-10")

    def test_meses(self):
        self.assertEqual(meses_ate(date(2026, 1, 15), 3), ["2025-11", "2025-12", "2026-01"])


if __name__ == "__main__":
    unittest.main()
