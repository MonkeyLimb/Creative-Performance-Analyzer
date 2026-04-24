import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0e0e0f",
        surface: "#161618",
        surface2: "#1e1e21",
        border: "#2a2a2e",
        text: "#e8e8ea",
        textDim: "#8a8a92",
        accent: "#6b5fff",
        winner: "#1D9E75",
        watch: "#EF9F27",
        cut: "#E24B4A",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
