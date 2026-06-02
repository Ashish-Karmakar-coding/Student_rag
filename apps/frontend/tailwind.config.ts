import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
        mono: ["JetBrains Mono", ...fontFamily.mono],
      },
      colors: {
        // Kinetic Logic Color Spectrum
        surface: {
          base: "#0C0C0E",       // Foundation background (deep floor)
          raised: "#111113",     // Sidebar, cards, containers (raised floor)
          overlay: "#18181B",    // Modals, popovers, context menus
          sunken: "#0A0A0C",     // Input fields, search bars
          dim: "#131315",
          bright: "#39393b",
          container: {
            lowest: "#0e0e10",
            low: "#1b1b1d",
            DEFAULT: "#201f21",
            high: "#2a2a2c",
            highest: "#353437",
          }
        },
        primary: {
          DEFAULT: "#0F9B7C",    // Refined Teal (primary accent)
          accent: "#0F9B7C",
          container: "#21a383",
          fixed: "#84f7d3",
          dim: "#66dab8",
          on: "#00382b",
        },
        secondary: {
          DEFAULT: "#7C7AE0",    // Slate Purple (tag/secondary accent)
          accent: "#7C7AE0",
          container: "#3e3b9e",
          fixed: "#e2dfff",
          dim: "#c3c1ff",
          on: "#241e85",
        },
        tertiary: {
          DEFAULT: "#c8c5ca",
          container: "#929094",
        },
        error: {
          DEFAULT: "#ffb4ab",
          container: "#93000a",
          on: "#690005",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.05)",
          default: "rgba(255, 255, 255, 0.12)",
        },
        text: {
          primary: "#e5e1e4",
          secondary: "#bccac3",
          muted: "#87948d",
        }
      },
      borderRadius: {
        sm: "0.125rem",        // 2px
        DEFAULT: "0.25rem",    // 4px
        md: "0.375rem",        // 6px
        lg: "0.5rem",          // 8px
        xl: "0.75rem",         // 12px
        full: "9999px",
      },
      boxShadow: {
        "hard-modal": "0 4px 0px 0px #000000", // Subtle, sharp 4px black shadow with 0% blur
      },
      animation: {
        "fade-up": "fadeUp 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 150ms ease forwards",
        "scale-in": "scaleIn 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95) translateY(10px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
