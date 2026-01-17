/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#005a9c',
          dark: '#004a80',
          light: '#e6f0f7',
        },
        accent: {
          red: '#d9534f',
          green: '#5cb85c',
          orange: '#f0ad4e',
        },
      },
    },
  },
  plugins: [],
}
