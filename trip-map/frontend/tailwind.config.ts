import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#1b1410",
        paper: "#f4efe4",
        sand: "#e7d7b8",
        copper: "#c46a2c",
        moss: "#3d5a45",
        warning: "#d97706",
      },
    },
  },
  plugins: [],
};

export default config;
