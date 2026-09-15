import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F766E",
          hover: "#0B5F59",
          soft: "#D7E8E4",
        },
        surface: {
          DEFAULT: "#EAF0ED",
          app: "#DCE3DF",
          primary: "#EEF3F0",
          secondary: "#D2DBD6",
          elevated: "#F2F5F3",
        },
        positive: "#2F7D62",
        negative: "#C75C52",
        warning: "#B56A2B",
        info: "#4E716B",
        text: {
          DEFAULT: "#1B2421",
          primary: "#1B2421",
          secondary: "#56635E",
          subtle: "#7B8782",
        },
        border: "#B9C5BF",
        shadow: "rgba(28, 41, 36, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "10px",
        "2xl": "12px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(27, 36, 33, 0.05)",
        hover: "0 6px 18px rgba(27, 36, 33, 0.08)",
        drawer: "0 14px 40px rgba(27, 36, 33, 0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "scan-pass": {
          "0%": { transform: "translateX(-120%)", opacity: "0" },
          "20%": { opacity: "0.32" },
          "100%": { transform: "translateX(240%)", opacity: "0" },
        },
        "evidence-pulse": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "scan-pass": "scan-pass 7s linear infinite",
        "evidence-pulse": "evidence-pulse 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
