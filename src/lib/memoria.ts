import "server-only";

// Cache em memória do servidor para dados da TV que mudam devagar (a TV pede a cada minuto).
// Em várias instâncias cada uma tem o seu; o pior caso é recalcular, nunca mostrar dado de outra TV.
const memoria = new Map<string, { ate: number; valor: unknown }>();

export async function lembrar<T>(chave: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const m = memoria.get(chave);
  if (m && m.ate > Date.now()) return m.valor as T;
  const valor = await fn();
  memoria.set(chave, { ate: Date.now() + ms, valor });
  if (memoria.size > 500) for (const [k, v] of memoria) if (v.ate <= Date.now()) memoria.delete(k);
  return valor;
}
