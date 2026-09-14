import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SignalForge — Evidence-bound market intelligence for agents",
  description:
    "SignalForge fuses complementary market evidence into confidence-gated Decision Packets with explicit provenance, contradictions, invalidation and no execution authority.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} light`}>
      <body className="min-h-screen">
        {children}
        <a
          href="/judge"
          className="fixed right-4 top-20 z-[70] rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-brand shadow-drawer backdrop-blur hover:bg-surface-secondary"
        >
          Judge proof
        </a>
      </body>
    </html>
  );
}
