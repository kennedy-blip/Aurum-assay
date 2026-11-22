/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: "#06070B",
        gold: { 300: "#FCD34D", 400: "#FBBF24", 500: "#F59E0B", 600: "#D97706" },
        emerald2: "#10B981",
        ice: "#38BDF8",
      },
      fontFamily: {
        display: ["'Cinzel'", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
