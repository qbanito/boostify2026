/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './popup.html',
    './sidepanel.html',
  ],
  theme: {
    extend: {
      colors: {
        boostify: {
          orange: '#f97316',
          dark: '#0a0a0a',
          card: '#1a1a1a',
          border: '#2a2a2a',
          text: '#e5e5e5',
          muted: '#a3a3a3',
        },
      },
    },
  },
  plugins: [],
};
