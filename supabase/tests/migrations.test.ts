// Valida as migrations e as policies de RLS num Postgres local (PGlite), sem tocar no Supabase de produção.
// Simula o necessário do Supabase: roles anon/authenticated/service_role, auth.users e auth.uid().
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const DIR = join(__dirname, "..", "migrations");

const STUB_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;

  -- tabela do sistema "relatorio" (mesmo projeto Supabase)
  create table public.usuarios (
    id uuid primary key default gen_random_uuid(),
    auth_id uuid unique references auth.users (id),
    nome text not null, login_site text unique, login_klingo text,
    equipe text not null default 'Outros', papel text not null default 'colaborador',
    ativo boolean not null default true, trocar_senha boolean not null default false,
    metas jsonb not null default '{}'::jsonb, criado_em timestamptz not null default now()
  );
`;

const U = {
  admin: "00000000-0000-0000-0000-00000000000a",
  ana: "00000000-0000-0000-0000-000000000001",
  bia: "00000000-0000-0000-0000-000000000002",
  leo: "00000000-0000-0000-0000-000000000003",
  ze: "00000000-0000-0000-0000-000000000004",
};

let db: PGlite;

async function como<T>(usuario: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${usuario ? "authenticated" : "anon"}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [usuario ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB_SUPABASE);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U.admin}', 'admin@acesso.iobaoftalmo.com.br'),
      ('${U.ana}', 'ana@acesso.iobaoftalmo.com.br'),
      ('${U.bia}', 'bia@acesso.iobaoftalmo.com.br'),
      ('${U.leo}', 'leo@acesso.iobaoftalmo.com.br'),
      ('${U.ze}', 'ze@acesso.iobaoftalmo.com.br');
    insert into public.usuarios (auth_id, nome, login_site, login_klingo, equipe, papel) values
      ('${U.admin}', 'Admin', 'admin', null, 'Outros', 'admin'),
      ('${U.ana}', 'Ana', 'ana', 'ANA.K', 'Comercial', 'colaborador'),
      ('${U.bia}', 'Bia', 'bia', 'bia.k', 'Comercial', 'colaborador'),
      ('${U.leo}', 'Léo', 'leo', 'leo.k', 'Comercial', 'colaborador'),
      ('${U.ze}', 'Zé', 'ze', 'ze.k', 'Outros', 'colaborador');
  `);
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(DIR, f), "utf8"));
  }
  // Léo é o líder da equipe Comercial
  await db.exec(`
    update trackco.equipe_membros set funcao = 'lider'
    where colaborador_id = (select id from trackco.colaboradores where login = 'leo');
  `);
  await db.query(`select trackco.klingo_sincronizar_mes('2026-10-01', $1::jsonb)`, [
    JSON.stringify([
      { chave: "k1", data_agendado_em: "2026-10-05", data_agendado_para: "2026-10-15", responsavel_login: "ana.k", paciente_nome: "Maria", procedimento: "Consulta", profissional: "Dr. X", operadora: "Particular", qtd: 1 },
      { chave: "k2", data_agendado_em: "2026-10-06", data_agendado_para: "2026-10-16", responsavel_login: "bia.k", paciente_nome: "João", procedimento: "Consulta", profissional: "Dr. Y", operadora: "Particular", qtd: 1 },
      { chave: "k3", data_agendado_em: "2026-10-07", data_agendado_para: "2026-10-17", responsavel_login: "ze.k", paciente_nome: "Paulo", procedimento: "Exame", profissional: "Dr. Z", operadora: "SUS", qtd: 1 },
    ]),
  ]);
});

describe("seed", () => {
  it("importa só Comercial + admins do relatorio", async () => {
    const r = await db.query<{ login: string; papel: string }>(`select login, papel from trackco.colaboradores order by login`);
    expect(r.rows.map((x) => x.login)).toEqual(["admin", "ana", "bia", "leo"]);
    expect(r.rows.find((x) => x.login === "admin")?.papel).toBe("admin");
  });
  it("cria métricas, plano ativo e versão 1", async () => {
    const m = await db.query(`select codigo from trackco.metricas`);
    expect(m.rows.length).toBe(6);
    const v = await db.query<{ n: number }>(`select count(*)::int as n from trackco.plano_versoes`);
    expect(v.rows[0].n).toBe(1);
  });
});

describe("RLS", () => {
  it("atendente vê só as próprias linhas do Klingo e não vê R$", async () => {
    const linhas = await como(U.ana, () =>
      db.query<{ chave: string }>(`select chave from trackco.klingo_agendamentos order by chave`),
    );
    expect(linhas.rows.map((r) => r.chave)).toEqual(["k1"]);
    await expect(
      como(U.ana, () => db.query(`select valor from trackco.klingo_agendamentos`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("líder vê a equipe; admin vê tudo; anon não vê nada", async () => {
    const lider = await como(U.leo, () =>
      db.query<{ chave: string }>(`select chave from trackco.klingo_agendamentos order by chave`),
    );
    expect(lider.rows.map((r) => r.chave)).toEqual(["k1", "k2"]);
    const admin = await como(U.admin, () =>
      db.query<{ chave: string }>(`select chave from trackco.klingo_agendamentos order by chave`),
    );
    expect(admin.rows.map((r) => r.chave)).toEqual(["k1", "k2", "k3"]);
    await expect(como(null, () => db.query(`select 1 from trackco.klingo_agendamentos`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("atendente vê só o próprio cadastro; líder vê a equipe", async () => {
    const ana = await como(U.ana, () => db.query<{ login: string }>(`select login from trackco.colaboradores`));
    expect(ana.rows.map((r) => r.login)).toEqual(["ana"]);
    const leo = await como(U.leo, () =>
      db.query<{ login: string }>(`select login from trackco.colaboradores order by login`),
    );
    expect(leo.rows.map((r) => r.login)).toEqual(["ana", "bia", "leo"]);
  });

  it("contestação: só pode abrir a própria", async () => {
    const ids = await db.query<{ id: string; login: string }>(`select id, login from trackco.colaboradores`);
    const id = (l: string) => ids.rows.find((r) => r.login === l)!.id;
    await como(U.ana, () =>
      db.query(
        `insert into trackco.contestacoes (colaborador_id, competencia, descricao) values ($1, '2026-10-01', 'Agendei a Maria e não contou')`,
        [id("ana")],
      ),
    );
    await expect(
      como(U.ana, () =>
        db.query(
          `insert into trackco.contestacoes (colaborador_id, competencia, descricao) values ($1, '2026-10-01', 'Tentando pela colega')`,
          [id("bia")],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const aud = await db.query<{ n: number }>(`select count(*)::int as n from trackco.auditoria where tabela = 'contestacoes'`);
    expect(aud.rows[0].n).toBe(1);
  });

  it("atendente não altera regras", async () => {
    const r = await como(U.ana, () => db.query(`update trackco.metricas set nome = 'x' returning id`));
    expect(r.rows.length).toBe(0);
  });

  it("ranking respeita a visibilidade 'posicoes'", async () => {
    const eq = (await db.query<{ id: string }>(`select id from trackco.equipes where nome = 'Comercial'`)).rows[0].id;
    await db.query(
      `insert into trackco.apuracoes (tipo, equipe_id, colaborador_id, competencia, funcao, nota, nivel, resultado)
       select 'parcial', $1, c.id, '2026-10-01', 'membro', n.nota, n.nivel, '{"memorial":["x"],"indicadores":[]}'::jsonb
       from trackco.colaboradores c join (values ('ana', 110, 'Meta batida'), ('bia', 50, 'Em desenvolvimento')) n(login, nota, nivel) on n.login = c.login`,
      [eq],
    );
    const r = await como(U.ana, () =>
      db.query<{ posicao: number; nome: string; eu: boolean; nota: string | null; resultado: unknown }>(
        `select * from trackco.ranking_equipe($1, '2026-10-01')`,
        [eq],
      ),
    );
    expect(r.rows.map((x) => [x.posicao, x.nome, x.eu])).toEqual([
      [1, "Ana", true],
      [2, "Bia", false],
    ]);
    expect(Number(r.rows[0].nota)).toBe(110);
    expect(r.rows[1].nota).toBeNull(); // número da colega escondido
    expect(r.rows[0].resultado).not.toHaveProperty("memorial");

    await db.query(`update trackco.equipes set visibilidade_ranking = 'privado' where id = $1`, [eq]);
    const p = await como(U.bia, () => db.query(`select * from trackco.ranking_equipe($1, '2026-10-01')`, [eq]));
    expect(p.rows.length).toBe(1);
    const ze = await como(U.ze, () => db.query(`select * from trackco.ranking_equipe($1, '2026-10-01')`, [eq]));
    expect(ze.rows.length).toBe(0);
  });
});

describe("metas", () => {
  it("admin grava a grade; atendente não", async () => {
    const eq = (await db.query<{ id: string }>(`select id from trackco.equipes where nome = 'Comercial'`)).rows[0].id;
    const met = (await db.query<{ id: string }>(`select id from trackco.metricas where codigo = 'agendamentos'`)).rows[0].id;
    const ana = (await db.query<{ id: string }>(`select id from trackco.colaboradores where login = 'ana'`)).rows[0].id;
    const linhas = JSON.stringify([
      { metrica_id: met, colaborador_id: ana, valor: 120 },
      { metrica_id: met, colaborador_id: null, valor: 600 },
    ]);
    const n = await como(U.admin, () =>
      db.query<{ n: number }>(`select trackco.salvar_metas($1, '2026-11-01', array[$2]::uuid[], $3::jsonb) as n`, [eq, met, linhas]),
    );
    expect(n.rows[0].n).toBe(2);
    // regravar substitui (não duplica)
    await como(U.admin, () =>
      db.query(`select trackco.salvar_metas($1, '2026-11-01', array[$2]::uuid[], $3::jsonb)`, [
        eq,
        met,
        JSON.stringify([{ metrica_id: met, colaborador_id: ana, valor: 130 }]),
      ]),
    );
    const r = await db.query<{ valor: string; equipe_id: string | null }>(
      `select valor::text, equipe_id from trackco.metas where competencia = '2026-11-01'`,
    );
    expect(r.rows).toEqual([{ valor: "130", equipe_id: null }]);
    await expect(
      como(U.ana, () => db.query(`select trackco.salvar_metas($1, '2026-11-01', array[$2]::uuid[], '[]'::jsonb)`, [eq, met])),
    ).rejects.toThrow(/apenas administradores/);
  });
});

describe("sincronização do Klingo", () => {
  it("preserva o cruzamento e remove o que saiu do Klingo", async () => {
    const n = await db.query<{ n: number }>(
      `select trackco.klingo_marcar_atendidos($1::jsonb) as n`,
      [JSON.stringify([{ chave: "k1", atendido: true, valor: 350 }])],
    );
    expect(n.rows[0].n).toBe(1);
    // nova sincronização: k2 sumiu, k1 continua, k4 entrou
    await db.query(`select trackco.klingo_sincronizar_mes('2026-10-01', $1::jsonb)`, [
      JSON.stringify([
        { chave: "k1", data_agendado_em: "2026-10-05", data_agendado_para: "2026-10-15", responsavel_login: "ANA.K", paciente_nome: "Maria", procedimento: "Consulta", profissional: "Dr. X", operadora: "Particular", qtd: 1 },
        { chave: "k3", data_agendado_em: "2026-10-07", data_agendado_para: "2026-10-17", responsavel_login: "ze.k", paciente_nome: "Paulo", procedimento: "Exame", profissional: "Dr. Z", operadora: "SUS", qtd: 1 },
        { chave: "k4", data_agendado_em: "2026-10-09", data_agendado_para: "2026-11-03", responsavel_login: "bia.k", paciente_nome: "Rita", procedimento: "Consulta", profissional: "Dr. Y", operadora: "Particular", qtd: 1 },
      ]),
    ]);
    const r = await db.query<{ chave: string; atendido: boolean | null; data_realizacao: string | null; responsavel_login: string }>(
      `select chave, atendido, data_realizacao::text, responsavel_login from trackco.klingo_agendamentos order by chave`,
    );
    expect(r.rows.map((x) => x.chave)).toEqual(["k1", "k3", "k4"]);
    expect(r.rows[0].atendido).toBe(true);
    expect(r.rows[0].data_realizacao).toBe("2026-10-15");
    expect(r.rows[0].responsavel_login).toBe("ana.k");
  });

  it("mês vazio não apaga nada", async () => {
    const r = await db.query<{ r: { ignorado: boolean } }>(`select trackco.klingo_sincronizar_mes('2026-10-01', '[]'::jsonb) as r`);
    expect(r.rows[0].r.ignorado).toBe(true);
    const n = await db.query<{ n: number }>(`select count(*)::int as n from trackco.klingo_agendamentos`);
    expect(n.rows[0].n).toBe(3);
  });

  it("rejeita linhas fora do mês", async () => {
    await expect(
      db.query(`select trackco.klingo_sincronizar_mes('2026-11-01', $1::jsonb)`, [
        JSON.stringify([{ chave: "x", data_agendado_em: "2026-10-01" }]),
      ]),
    ).rejects.toThrow(/fora do mês/);
  });

  it("lista logins do Klingo sem colaborador vinculado (só admin)", async () => {
    const r = await como(U.admin, () =>
      db.query<{ login: string; agendamentos: string }>(`select * from trackco.logins_klingo_sem_vinculo('2026-01-01')`),
    );
    expect(r.rows.map((x) => x.login)).toEqual(["ze.k"]);
    await expect(
      como(U.ana, () => db.query(`select * from trackco.logins_klingo_sem_vinculo('2026-01-01')`)),
    ).rejects.toThrow(/apenas administradores/);
  });

  it("funções do robô não ficam expostas para usuários logados", async () => {
    await expect(
      como(U.admin, () => db.query(`select trackco.klingo_marcar_atendidos('[]'::jsonb)`)),
    ).rejects.toThrow(/permission denied/);
  });
});
