/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'selector',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        endfield: {
          yellow: '#FFFA00', // Updated to match official site
          dark: '#0A0A0A',   // Deep black/gray
          panel: '#141414',  // Panel background
          border: '#333333', // Technical borders
          text: '#E5E5E5',   // Off-white text
          muted: '#888888',  // Muted text
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'none': '0px',
        'sm': '0px',
        'DEFAULT': '0px',
        'md': '0px',
        'lg': '0px',
        'xl': '0px',
        '2xl': '0px',
        '3xl': '0px',
        'full': '9999px', // Keep full for avatars if needed, but mostly 0
      }
    },
  },
  plugins: [],
}
