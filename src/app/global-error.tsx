"use client";

import "./globals.css";

/** Falha no layout principal: substitui a página inteira, então traz o próprio <html> e o estilo. */
export default function ErroGeral({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error);
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-background text-foreground">
        <title>Trackco · algo deu errado</title>
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">O Trackco não conseguiu abrir</h1>
          <p className="text-sm text-muted-foreground">Pode ter sido uma falha passageira. Tente de novo em instantes; se continuar, avise o administrador.</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => retry()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Tentar de novo
            </button>
            {/* recarrega a página inteira: o layout pode ter quebrado, então o Link do Next não serve aqui */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="rounded-lg border px-4 py-2 text-sm font-medium">
              Ir para o início
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
