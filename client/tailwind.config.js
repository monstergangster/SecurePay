/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          200: '#E5EAF2',
          300: '#D5DCE8',
        },
      },
    },
  },
  plugins: [],
};
