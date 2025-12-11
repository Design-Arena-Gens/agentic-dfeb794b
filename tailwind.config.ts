import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"]
      },
      boxShadow: {
        neon: "0 0 25px rgba(129, 140, 248, 0.5)",
        insetGlow: "inset 0 0 20px rgba(59, 130, 246, 0.35)"
      },
      animation: {
        pulseSoft: "pulseSoft 2.5s ease-in-out infinite",
        float: "float 6s ease-in-out infinite"
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.75" },
          "50%": { opacity: "1" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
