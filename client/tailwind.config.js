/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14211C',
        forest: { DEFAULT: '#1F4D3A', dark: '#153628', light: '#E3EDE7' },
        saffron: { DEFAULT: '#F0A81F', dark: '#C98A0E', light: '#FCF0D5' },
        paper: '#F6F7F4',
        mist: '#E4E8E2',
        chili: { DEFAULT: '#C7402D', light: '#FBE9E6' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      boxShadow: { lift: '0 8px 30px -12px rgba(20,33,28,.25)' },
    },
  },
  plugins: [],
};
