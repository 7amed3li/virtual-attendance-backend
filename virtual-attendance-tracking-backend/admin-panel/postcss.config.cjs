module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4B2E83', // University purple
          light: '#6E4BA5',
          dark: '#3A2266',
        },
        secondary: {
          DEFAULT: '#00A3E0', // University blue
          light: '#33B5E6',
          dark: '#0082B3',
        },
      },
    },
  },
  plugins: [],
};
