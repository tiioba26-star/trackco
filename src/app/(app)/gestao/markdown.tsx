import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Texto da IA em Markdown, com o visual do app. Sem HTML (o react-markdown escapa tudo) e sem links clicáveis.
const COMPONENTES: Components = {
  h2: ({ children }) => <h3 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-primary uppercase first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 mb-1.5 text-sm font-semibold">{children}</h4>,
  p: ({ children }) => <p className="text-sm leading-relaxed text-foreground/90 [&+p]:mt-2">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{children}</ol>,
  li: ({ children }) => <li className="marker:text-muted-foreground">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ children }) => <span className="underline decoration-dotted">{children}</span>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">{children}</th>,
  td: ({ children }) => <td className="border-t px-2.5 py-1.5 align-top tabular-nums">{children}</td>,
  hr: () => <hr className="my-4" />,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>,
};

export function TextoIA({ texto }: { texto: string }) {
  return (
    <div className="space-y-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTES} skipHtml>
        {texto}
      </ReactMarkdown>
    </div>
  );
}
