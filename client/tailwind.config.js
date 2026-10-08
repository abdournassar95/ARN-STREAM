/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "400px",
      },
      colors: {
        primaryMovies: "rgb(var(--color-primary-movies-rgb) / <alpha-value>)",
        primaryMusic: "rgb(var(--color-primary-music-rgb) / <alpha-value>)",
        bg: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--color-surface-rgb) / <alpha-value>)",
        surfaceHover: "rgb(var(--color-surface-hover-rgb) / <alpha-value>)",
        border: "rgb(var(--color-border-rgb) / <alpha-value>)",
        text: "rgb(var(--color-text-rgb) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb) / <alpha-value>)",
        tx: "rgb(var(--color-text-rgb) / <alpha-value>)",
        bgr: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "Alexandria", "Cairo", "system-ui", "sans-serif"],
        cairo: ["Cairo", "sans-serif"],
        alexandria: ["Alexandria", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px"
      }
    }
  },
  plugins: []
}
