/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './popup.html',
    './sidepanel.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        instagram: {
          pink: '#E1306C',
          purple: '#833AB4',
          orange: '#F77737',
          yellow: '#FCAF45',
          blue: '#405DE6',
        },
      },
    },
  },
  plugins: [],
};
