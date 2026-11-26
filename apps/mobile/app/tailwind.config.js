/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        obsidian: '#0F0A18',
        surface: '#1A1524',
        elevated: '#252031',
        skybrand: '#59B9F9',
        checkgreen: '#71D769',
      },
      borderRadius: {
        card: '16px',
        cardlg: '24px',
        sheet: '32px',
      },
    },
  },
  plugins: [],
};
