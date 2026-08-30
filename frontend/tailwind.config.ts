import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070C0A",
        surface: "#0E1714",
        surface2: "#122019",
        border: "#1C2A24",
        borderSoft: "#152019",
        text: "#E9F2EC",
        textDim: "#8FA79C",
        textFaint: "#5C7268",
        accent: "#4CE0A0",
        accentDim: "#2C7A56",
        amber: "#F2C14E",
        amberDim: "#8A6A20",
        danger: "#FF6B6B",
        dangerDim: "#7A2C2C",
      },
      fontFamily: {
        sans: ["Space Grotesk", "Poppins", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
