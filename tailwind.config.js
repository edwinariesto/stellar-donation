/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ios: {
          bg: '#F2F2F7',
          card: '#FFFFFF',
          blue: '#007AFF',
          green: '#34C759',
          red: '#FF3B30',
          darkGray: '#8E8E93',
          lightGray: '#E5E5EA',
          darkText: '#000000',
          secondaryText: '#3C3C43',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        ios: '0 4px 20px rgba(0,0,0,0.05)',
        iosPressed: '0 2px 10px rgba(0,0,0,0.03)',
      }
    },
  },
  plugins: [],
}
