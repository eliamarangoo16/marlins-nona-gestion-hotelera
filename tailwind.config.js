/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0f2a44', 50: '#eef3f8', 100: '#d6e2ee', 200: '#adc5dc', 300: '#7ea1c4', 400: '#4f7aa6', 500: '#2f5a85', 600: '#1f4468', 700: '#17344f', 800: '#0f2a44', 900: '#0a1c2f' },
        sand: { DEFAULT: '#c8a96a', 50: '#faf6ee', 100: '#f3ead8', 200: '#e7d5b0', 300: '#dbc088', 400: '#c8a96a', 500: '#b3924e', 600: '#8f733b' },
      },
      fontFamily: { sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
}
