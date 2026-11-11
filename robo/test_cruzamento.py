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
