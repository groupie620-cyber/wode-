/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F4ECDF",
        paper: "#FFFCF6",
        ink: "#2D2924",
        muted: "#71695F",
        clay: "#A65F46",
        sage: "#788775",
        sand: "#D9B878",
        line: "#DED3C2"
      },
      fontFamily: {
        display: ["Merriweather", "Kaiti SC", "STKaiti", "KaiTi", "Georgia", "serif"],
        kai: ["Kaiti SC", "STKaiti", "KaiTi", "LXGW WenKai", "serif"],
        sans: ["Inter", "PingFang SC", "Microsoft YaHei", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 18px 50px rgba(65, 52, 39, 0.08)",
        float: "0 22px 65px rgba(65, 52, 39, 0.14)"
      },
      borderRadius: {
        card: "1.5rem"
      }
    }
  },
  plugins: []
};
