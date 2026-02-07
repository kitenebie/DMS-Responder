/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Status colors
        statusPending: '#6b7280',
        statusOngoing: '#3b82f6',
        statusArrived: '#22c55e',
        statusCompleted: '#10b981',
        statusCancelled: '#ef4444',
        statusDuplicate: '#f97316',
        // Theme colors
        slate900: '#0F172A',
        slate800: '#1E293B',
        slate700: '#334155',
        slate600: '#475569',
        slate500: '#64748B',
        slate400: '#94A3B8',
        slate300: '#CBD5E1',
        blue600: '#2563EB',
        blue500: '#3B82F6',
        emerald600: '#059669',
        purple600: '#7C3AED',
        red600: '#DC2626',
        red500: '#EF4444',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
