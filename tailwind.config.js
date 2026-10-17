/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blueprint: {
          bg: "#EAF3FF",
          panel: "#FFFFFF",
          panel2: "#F3F8FF",
          secondary: "#D1E3FA",
          nav: "#BCD5F6",
          dashnav: "#8FB4EC",
          grid: "#D6E6FA",
          line: "#D3E3F8",
          steel: "#475569",
          steel2: "#CBD5E1",
          amber: "#2563EB",
          amberDim: "#1D4ED8",
          text: "#0F172A",
          muted: "#64748B",
          muted2: "#94A3B8",
          success: "#16A34A",
          error: "#DC2626",
        },
      },
      fontFamily: {
        display: ["'Inter'", "sans-serif"],
        mono: ["'Inter'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      backgroundImage: {
        "blueprint-grid": "none",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
      boxShadow: {
        amber: "0 0 0 1px rgba(37,99,235,0.35), 0 4px 16px rgba(37,99,235,0.12)",
      },
    },
  },
  plugins: [],
}
