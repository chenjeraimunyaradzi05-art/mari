module.exports = {
  content: ["./app/**/*.{ts,tsx,js,jsx}", "./components/**/*.{ts,tsx,js,jsx}", "./pages/**/*.{ts,tsx,js,jsx}", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        rose: {
          600: '#d53f8c',
          400: '#f687b3'
        },
        teal: {
          500: '#208080',
          600: '#1a6666'
        },
        blush: {
          50: '#fff8fb',
          100: '#ffe4ef'
        },
        mauve: {
          300: '#cdb4db'
        },
        midnight: {
          900: '#2f2432'
        }
      }
    }
  },
  plugins: [],
}
