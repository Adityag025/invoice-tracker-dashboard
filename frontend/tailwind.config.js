/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#032448',
        'on-primary': '#ffffff',
        'primary-container': '#1f3a5f',
        'on-primary-container': '#cde3ff',
        secondary: '#0b61a1',
        'on-secondary': '#ffffff',
        'secondary-container': '#7cbaff',
        'on-secondary-container': '#001d36',
        surface: '#f8f9ff',
        'surface-container-low': '#eef4ff',
        'surface-container': '#e1eafa',
        'on-surface': '#1a2332',
        'on-surface-variant': '#43474e',
        outline: '#74777f',
        'outline-variant': '#c4c6cf',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error': '#ffffff',
        'on-error-container': '#410002',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '260px',
      },
      boxShadow: {
        card: '0px 4px 20px rgba(26, 35, 50, 0.04)',
        'card-md': '0px 8px 32px rgba(26, 35, 50, 0.08)',
      },
    },
  },
  plugins: [],
};
