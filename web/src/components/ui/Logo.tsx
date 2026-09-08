import { cn } from "@/lib/utils";

/**
 * The SignalForge logo mark — an exact match of `src/app/icon.svg`,
 * so the in-app logo is identical to the browser-tab favicon.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#465FFF" />
      <path d="M38 8 L15 36 L27 36 L24 56 L49 26 L35 26 L43 8 Z" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo({
  className,
  markClass = "h-9 w-9",
}: {
  className?: string;
  markClass?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClass} />
      <span className="text-[16px] font-semibold tracking-tight text-text">SignalForge</span>
    </div>
  );
}