"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { ProvedorConfirmacao } from "@/components/app/confirmacao";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

/** No celular os avisos aparecem embaixo (em cima ficavam por cima do cabeçalho), acima da barra de navegação. */
function Avisos() {
  const celular = useIsMobile();
  return (
    <Toaster
      richColors
      position={celular ? "bottom-center" : "top-right"}
      mobileOffset={{ bottom: "calc(var(--nav-inferior, 0px) + 12px)", left: "12px", right: "12px" }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <ProvedorConfirmacao>{children}</ProvedorConfirmacao>
        <Avisos />
        <RegistrarServiceWorker />
      </TooltipProvider>
    </ThemeProvider>
  );
}
