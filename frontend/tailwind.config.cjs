/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        saffron: "#FF9933",
        gold: "#FFD700"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,153,51,.20), 0 24px 90px rgba(255,153,51,.12)",
        glass: "0 26px 120px rgba(0,0,0,.55)"
      }
    }
  },
  plugins: []
};

