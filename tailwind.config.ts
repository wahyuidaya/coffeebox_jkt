import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "cbx-br": "#1A0F07",
        "cbx-bm": "#5C2E1A",
        "cbx-bl": "#B87040",
        "cbx-gold": "#C8972F",
        "cbx-gl": "#E8C878",
        "cbx-cream": "#FBF4E8",
        "cbx-cb": "#FEFCF7",
        "cbx-bd": "#DFC9A8",
        "cbx-tm": "#7A5C3A",
      },
      fontFamily: {
        playfair: ["Playfair Display", "serif"],
        dmsans: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;