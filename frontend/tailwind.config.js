/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Carried over from the previous CSS tokens, so the visual identity
        // survives the move from hand-written CSS to Tailwind utilities.
        navy: { DEFAULT: "#1a2e6e", dark: "#0d1c4a" },
        brand: {
          50: "#eef1fb", 100: "#dae1f6", 200: "#b3c0ea", 300: "#8399de",
          400: "#4d6bcb", 500: "#1a2e6e", 600: "#162760", 700: "#0d1c4a",
          800: "#0a1638", 900: "#070f27",
        },
        danger: { DEFAULT: "#c41230", dark: "#9e0f27" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
