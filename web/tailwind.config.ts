import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: "#465FFF",
          hover: "#3448D4",
          soft: "#EEF1FF",
        },
        // Light theme surfaces
        surface: {
          DEFAULT: "#FFFFFF",
          app: "#F6F8FC",
          primary: "#FFFFFF",
          secondary: "#F0F4FA",
          elevated: "#FFFFFF",
        },
        // Semantic
        positive: "#079455",
        negative: "#D92D20",
        warning: "#DC6803",
        info: "#1570EF",
        // Text
        text: {
          DEFAULT: "#101828",
          primary: "#101828",
          secondary: "#667085",
          subtle: "#98A2B3",
        },
        // Border
        border: "#E4E7EC",
        shadow: "rgba(16, 24, 40, 0.08)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "16px",
        sm: "10px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px rgba(16, 24, 40, 0.04)",
        hover: "0 2px 4px rgba(16, 24, 40, 0.06), 0 8px 20px rgba(16, 24, 40, 0.08)",
        drawer: "0 4px 16px rgba(16, 24, 40, 0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
