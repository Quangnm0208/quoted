import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,md,mdx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand (Indigo per Quoted brand v1.0)
        brand: {
          DEFAULT: "#3b3fbf",
          50: "#eef0fb",      // primary-soft
          100: "#d8dbf5",
          200: "#b6bbed",
          300: "#8d93e0",
          400: "#666cce",
          500: "#3b3fbf",     // primary
          600: "#2f33a3",     // primary-hover
          700: "#262989",
          800: "#1f216f",
          900: "#1b1e6b",     // primary-ink
        },
        // Neutrals tuned to brand tokens
        ink: {
          DEFAULT: "#15151b",        // --q-text
          muted: "#5b6678",          // --q-text-muted
        },
        surface: {
          DEFAULT: "#ffffff",        // --q-surface
          bg: "#fafbfc",             // --q-bg
        },
        line: {
          DEFAULT: "#e4e7ec",        // --q-border
          soft: "#eef0f3",           // --q-border-soft
        },
        // Status
        success: { DEFAULT: "#10b981", bg: "#e6f4ec", fg: "#066848" },
        warning: { DEFAULT: "#eab308", bg: "#fef4e6", fg: "#92590b" },
        danger:  { DEFAULT: "#dc2626", bg: "#fdecec", fg: "#a72020" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11.5px", { lineHeight: "1.45" }],
        xs: ["12.5px", { lineHeight: "1.5" }],
        sm: ["13.5px", { lineHeight: "1.55" }],
        base: ["14px", { lineHeight: "1.6" }],
        lg: ["17px", { lineHeight: "1.5" }],
        xl: ["20px", { lineHeight: "1.4" }],
        "2xl": ["22px", { lineHeight: "1.35", letterSpacing: "-0.018em" }],
        "3xl": ["28px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "4xl": ["36px", { lineHeight: "1.15", letterSpacing: "-0.022em" }],
        "5xl": ["44px", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
        "6xl": ["56px", { lineHeight: "1.05", letterSpacing: "-0.028em" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "10px",
        "2xl": "14px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.06)",
        card: "0 4px 12px rgba(0,0,0,0.06)",
        elevated: "0 8px 24px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [typography],
};

export default config;
