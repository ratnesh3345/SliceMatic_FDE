/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink:   "#1A1614",
        paper: "#FBF6EF",
        panel: "#FFFFFF",
        brand: "#E11D74",
        branddark: "#B01259",
        crust: "#F2A65A",
        basil: "#2F7A4D",
        line:  "#E7DDD2",
        muted: "#8A7E73",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,22,20,0.04), 0 8px 24px rgba(26,22,20,0.06)",
        pop:  "0 12px 40px rgba(26,22,20,0.14)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
