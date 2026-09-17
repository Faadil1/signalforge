import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sf-prism" x1="7" y1="7" x2="57" y2="57" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3257FF" />
          <stop offset=".24" stopColor="#00C9E8" />
          <stop offset=".46" stopColor="#C6F432" />
          <stop offset=".66" stopColor="#6E46FF" />
          <stop offset=".83" stopColor="#FF4F73" />
          <stop offset="1" stopColor="#E73DFF" />
        </linearGradient>
      </defs>
      <rect x="7" y="7" width="50" height="50" rx="13" fill="#fff" stroke="#B9C6F2" />
      <path d="M16 17h12v30H16z" fill="#3257FF" opacity=".14" />
      <path d="M36 17h12v30H36z" fill="#FF4F73" opacity=".14" />
      <path d="M26 13h12v38H26z" fill="url(#sf-prism)" opacity=".9" />
      <path d="M22 24h20M22 32h20M22 40h20" stroke="#171522" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5.5" fill="#C6F432" stroke="#171522" strokeWidth="2" />
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
        <span className="block text-[15px] font-semibold tracking-[-0.03em] text-text">SignalForge</span>
        <span className="mt-1 block font-mono text-[7px] uppercase tracking-[0.2em] text-prism-violet">pre-action evidence gate</span>
      </div>
    </div>
  );
}
