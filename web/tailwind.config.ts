import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#3257FF",
          hover: "#2445E8",
          soft: "#DDE5FF",
        },
        prism: {
          cobalt: "#3257FF",
          cyan: "#00C9E8",
          lime: "#C6F432",
          violet: "#6E46FF",
          coral: "#FF4F73",
          orange: "#FF8A1F",
          magenta: "#E73DFF",
          ink: "#171522",
          porcelain: "#EEF3FF",
          mist: "#DDE5FF",
        },
        surface: {
          DEFAULT: "#F7F9FF",
          app: "#EEF3FF",
          primary: "#FFFFFF",
          secondary: "#DDE5FF",
          elevated: "#FAFBFF",
        },
        positive: "#0F9F87",
        negative: "#FF4F73",
        warning: "#FF8A1F",
        info: "#3257FF",
        text: {
          DEFAULT: "#171522",
          primary: "#171522",
          secondary: "#4C4A63",
          subtle: "#77758E",
        },
        border: "#B9C6F2",
        shadow: "rgba(31, 42, 86, 0.16)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(31, 42, 86, 0.06)",
        hover: "0 18px 42px rgba(50, 87, 255, 0.14)",
        drawer: "0 28px 80px rgba(31, 42, 86, 0.18)",
        chroma: "0 18px 70px rgba(110, 70, 255, 0.2)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "scan-pass": {
          "0%": { transform: "translateX(-120%)", opacity: "0" },
          "20%": { opacity: "0.28" },
          "100%": { transform: "translateX(240%)", opacity: "0" },
        },
        "evidence-pulse": {
          "0%, 100%": { opacity: "0.45", transform: "scale(0.92)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "prism-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "lease-tick": {
          "0%": { transform: "scaleX(1)" },
          "100%": { transform: "scaleX(0.06)" },
        },
        "receipt-lock": {
          "0%": { clipPath: "inset(0 100% 0 0)" },
          "100%": { clipPath: "inset(0 0 0 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.32s cubic-bezier(.2,.8,.2,1)",
        shimmer: "shimmer 1.5s infinite",
        "scan-pass": "scan-pass 7s linear infinite",
        "evidence-pulse": "evidence-pulse 2.8s ease-in-out infinite",
        "prism-flow": "prism-flow 12s ease infinite",
        "lease-tick": "lease-tick 300s linear forwards",
        "receipt-lock": "receipt-lock .22s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
