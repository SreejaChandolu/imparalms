import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#04060a",
        foreground: "#f8fafc",
        brand: {
          bg: "#04060a",
          surface: "#070c18",
          card: "#0a1120",
          border: "rgba(41, 217, 255, 0.12)",
          cyan: "#29d9ff",
          "cyan-glow": "rgba(41, 217, 255, 0.35)",
        },
        cyan: {
          accent: "#29d9ff",
          400: "#38bdf8",
          500: "#29d9ff",
          600: "#0ea5e9",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      keyframes: {
        "drift-watermark": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(24px, -16px)" },
          "50%": { transform: "translate(-18px, 20px)" },
          "75%": { transform: "translate(16px, 14px)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "drift-watermark": "drift-watermark 18s ease-in-out infinite",
        "pulse-subtle": "pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
