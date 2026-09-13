/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        iunav: {
          blue: '#1B3A5C',
          'blue-light': '#2A5580',
          'blue-dark': '#0F2640',
          red: '#8B1A1A',
          'red-light': '#A52A2A',
          'red-dark': '#6B1010',
        },
        primary: {
          DEFAULT: '#1B3A5C',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#8B1A1A',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#2A5580',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        background: '#F8FAFC',
        foreground: '#0F172A',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#1B3A5C',
      },
    },
  },
  plugins: [],
};
