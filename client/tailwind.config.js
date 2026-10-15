/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0a0f1a',
          900: '#111827',
          850: '#1a2234',
        },
      },
    },
  },
  plugins: [],
};
