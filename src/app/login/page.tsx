import type { Metadata } from "next";
import { Suspense } from "react";
import { RodapeVersiculo } from "@/components/app/versiculo";
import { Logo } from "@/components/logo";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  "sem-acesso": "Sua sessão terminou ou seu usuário não tem acesso ao Trackco.",
};

async function FormComParametros({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] : undefined;
  return <FormLogin next={next} erroInicial={erro} />;
}

export default function PaginaLogin(props: PageProps<"/login">) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0f3a70] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 10%, #2a78d6 0%, transparent 60%), radial-gradient(50% 50% at 90% 90%, #1baf7a55 0%, transparent 60%)",
          }}
        />
        <div className="relative">
          <Logo claro />
        </div>
        <div className="relative max-w-md space-y-5">
          <h1 className="text-4xl leading-tight font-semibold">
            Metas, desempenho e reconhecimento. <span className="text-[#9ec5f4]">Com clareza total.</span>
          </h1>
          <p className="text-base text-white/80">
            Acompanhe seus agendamentos e consultas realizadas em tempo quase real, entenda como cada número foi
            calculado e conteste o que estiver errado.
          </p>
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {["Cálculo automático", "Regras transparentes", "Extrato com memorial", "Fechamento com aprovação"].map((t) => (
              <li key={t} className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">IOBA · Trackco</p>
      </section>

      <section className="flex flex-col p-6">
        <div className="m-auto w-full max-w-sm space-y-8 py-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Entrar</h2>
            <p className="text-sm text-muted-foreground">Use o mesmo usuário e senha do sistema de relatórios da IOBA.</p>
          </div>
          <Suspense fallback={<FormLogin next="/" />}>
            <FormComParametros searchParams={props.searchParams} />
          </Suspense>
        </div>
        <RodapeVersiculo className="pb-0" />
      </section>
    </main>
  );
}
