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
  title: "SignalForge — Explainable market intelligence for traders and AI agents",
  description:
    "SignalForge fuses technical structure, trend, funding, open interest and volume into one explainable market signal, available through a visual workspace and agent-ready API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} light`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
