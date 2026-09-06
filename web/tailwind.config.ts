import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sf: {
          bg: "#09090B",
          card: "#18181B",
          border: "#27272A",
          text: "#FAFAFA",
          muted: "#A1A1AA",
          accent: "#22C55E",
          danger: "#EF4444",
          warn: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
