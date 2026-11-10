import { cn } from "@/lib/utils";

export function LogoIcone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1c5cab" />
      <rect x="7" y="17" width="4" height="8" rx="1.5" fill="#fff" />
      <rect x="14" y="12" width="4" height="13" rx="1.5" fill="#fff" />
      <rect x="21" y="7" width="4" height="18" rx="1.5" fill="#9ec5f4" />
      <circle cx="23" cy="6.5" r="2.2" fill="#f5b72e" />
    </svg>
  );
}

export function Logo({ claro = false, className }: { claro?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoIcone />
      <div className="leading-none">
        <div className={cn("font-heading text-lg font-semibold tracking-tight", claro ? "text-white" : "text-foreground")}>
          Trackco
        </div>
        <div className={cn("text-[10px] tracking-[0.18em] uppercase", claro ? "text-white/70" : "text-muted-foreground")}>
          IOBA
        </div>
      </div>
    </div>
  );
}
