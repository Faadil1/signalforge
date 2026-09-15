import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" fill="none" stroke="#0F766E" strokeWidth="2" />
      <path d="M11 23C18 12 46 12 53 23" fill="none" stroke="#7B8782" strokeWidth="1.5" />
      <path d="M10 31C18 21 46 21 54 31" fill="none" stroke="#7B8782" strokeWidth="1.5" />
      <path d="M10 40C19 49 45 49 54 40" fill="none" stroke="#7B8782" strokeWidth="1.5" />
      <path d="M12 48C21 56 43 56 52 48" fill="none" stroke="#7B8782" strokeWidth="1.5" />
      <path d="M35 7L28 27L38 32L29 57" fill="none" stroke="#A44E2B" strokeWidth="4" strokeLinejoin="miter" />
      <circle cx="33" cy="32" r="3.5" fill="#0F766E" />
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
      <div className="leading-none">
        <span className="block text-[15px] font-semibold tracking-[-0.02em] text-text">SignalForge</span>
        <span className="mt-1 block font-mono text-[7px] uppercase tracking-[0.2em] text-text-subtle">evidence atlas</span>
      </div>
    </div>
  );
}
