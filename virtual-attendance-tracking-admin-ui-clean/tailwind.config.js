module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0edf5',
          100: '#d1c7e2',
          200: '#b3a1cf',
          300: '#957bbc',
          400: '#7655a9',
          500: '#4b2e83', // University primary purple
          600: '#3b2366',
          700: '#2b1949',
          800: '#1b0f2d',
          900: '#0b0510',
        },
        secondary: {
          50: '#e6f7fd',
          100: '#b3e7f9',
          200: '#80d7f5',
          300: '#4dc7f1',
          400: '#1ab7ed',
          500: '#00a3e0', // University secondary blue
          600: '#0082b3',
          700: '#006286',
          800: '#004159',
          900: '#00212c',
        },
        accent: {
          50: '#f9f7f2',
          100: '#ede8d9',
          200: '#e0d9c0',
          300: '#d4caa7',
          400: '#c7bb8e',
          500: '#b7a57a', // University accent gold
          600: '#a08a5a',
          700: '#7a6943',
          800: '#53472d',
          900: '#2c2616',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
