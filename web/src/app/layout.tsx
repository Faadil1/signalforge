import type { Metadata } from "next";
import Script from "next/script";
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

const DEV_RUNTIME = "https://signalforge.faadil-casecraft.workers.dev";

export const metadata: Metadata = {
  title: "SignalForge — Evidence-bound market intelligence for agents",
  description:
    "SignalForge fuses complementary market evidence into confidence-gated Decision Packets with explicit provenance, contradictions, invalidation and no execution authority.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const devBridge = process.env.NODE_ENV === "development";

  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} light`}>
      <body className="min-h-screen">
        {devBridge && (
          <Script id="signalforge-dev-api-bridge" strategy="beforeInteractive">
            {`(() => {
              const runtime = ${JSON.stringify(DEV_RUNTIME)};
              const nativeFetch = window.fetch.bind(window);
              const shouldBridge = (url) =>
                typeof url === "string" &&
                (url.startsWith("/api/") || url === "/health" || url.startsWith("/.well-known/"));

              window.fetch = (input, init) => {
                const rawUrl = typeof input === "string"
                  ? input
                  : input instanceof URL
                    ? input.toString()
                    : input && typeof input.url === "string"
                      ? input.url
                      : "";

                if (!shouldBridge(rawUrl)) return nativeFetch(input, init);

                const target = runtime + rawUrl;
                if (typeof Request !== "undefined" && input instanceof Request) {
                  return nativeFetch(new Request(target, input), init);
                }
                return nativeFetch(target, init);
              };

              window.__SIGNALFORGE_DEV_API_BRIDGE__ = runtime;
            })();`}
          </Script>
        )}
        {children}
        <a
          href="/judge"
          className="fixed right-4 top-20 z-[70] border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-brand backdrop-blur hover:bg-surface-secondary"
        >
          Judge proof
        </a>
      </body>
    </html>
  );
}

declare global {
  interface Window {
    __SIGNALFORGE_DEV_API_BRIDGE__?: string;
  }
}
