import type { Metadata } from "next";
import { Suspense } from "react";
import { TvCliente } from "./tv-cliente";

export const metadata: Metadata = { title: "Painel TV", robots: { index: false, follow: false } };

async function ComToken({ params }: { params: PageProps<"/tv/[token]">["params"] }) {
  const { token } = await params;
  return <TvCliente token={token} />;
}

export default function PaginaTv(props: PageProps<"/tv/[token]">) {
  return (
    <Suspense fallback={<main className="fixed inset-0 bg-[#060d1a]" />}>
      <ComToken params={props.params} />
    </Suspense>
  );
}
