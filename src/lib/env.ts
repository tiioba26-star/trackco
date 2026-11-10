// Leitura centralizada das variáveis de ambiente (falha cedo e com mensagem clara).

function obrigatoria(nome: string, valor: string | undefined): string {
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

export const env = {
  supabaseUrl: () => obrigatoria("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: () =>
    obrigatoria("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  supabaseSecretKey: () => obrigatoria("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  recalcToken: () => obrigatoria("TRACKCO_RECALC_TOKEN", process.env.TRACKCO_RECALC_TOKEN),
  /** Domínio fictício usado para transformar "usuario" em e-mail no Supabase Auth (mesmo do relatorio). */
  dominioLogin: () => process.env.LOGIN_DOMINIO || "acesso.iobaoftalmo.com.br",
};

export function loginParaEmail(login: string): string {
  return `${login.trim().toLowerCase()}@${env.dominioLogin()}`;
}
