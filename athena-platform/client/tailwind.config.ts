import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ATHENA Brand Colors — Rose-based primary (feminine, professional)
        primary: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        // Soft blush accent (for washes, pill backgrounds, etc.)
        blossom: {
          50: '#fff7f9',
          100: '#fde8ef',
          200: '#fbd2e2',
          300: '#f7aecd',
          400: '#ef7fb2',
          500: '#e0588f',
          600: '#c23a73',
          700: '#9b285c',
          800: '#7a1e47',
          900: '#5b1436',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        athena: {
          rose: '#f43f5e',
          gold: '#f59e0b',
          emerald: '#10b981',
          violet: '#8b5cf6',
          sky: '#0ea5e9',
          blush: '#fde4ec',
          lavender: '#ede9fe',
          peach: '#fed7aa',
        },
        // Social action colors
        social: {
          like: '#ef4444',
          comment: '#3b82f6',
          share: '#10b981',
          save: '#f59e0b',
          follow: '#8b5cf6',
        },
        // Safety score colors
        safety: {
          excellent: '#10b981',
          good: '#22c55e',
          fair: '#f59e0b',
          poor: '#ef4444',
        },
        // Status colors
        status: {
          online: '#10b981',
          away: '#f59e0b',
          busy: '#ef4444',
          offline: '#71717a',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains)', 'Fira Code', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
        'sidebar-collapsed': '64px',
        'sidebar-expanded': '256px',
        'header': '64px',
        'bottom-nav': '64px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-out': 'fadeOut 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'heart-beat': 'heartBeat 0.3s ease-in-out',
        'shake': 'shake 0.5s ease-in-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        heartBeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'athena-gradient': 'linear-gradient(135deg, #f43f5e 0%, #a855f7 55%, #f59e0b 100%)',
        'athena-gradient-alt': 'linear-gradient(135deg, #e11d48 0%, #7c3aed 100%)',
        'athena-gradient-soft': 'linear-gradient(135deg, #fde4ec 0%, #ede9fe 55%, #ffedd5 100%)',
        'emerald-glow': 'radial-gradient(circle, rgba(244, 63, 94, 0.18) 0%, transparent 70%)',
        'rose-glow': 'radial-gradient(circle, rgba(244, 63, 94, 0.22) 0%, transparent 70%)',
      },
      boxShadow: {
        'emerald': '0 4px 14px 0 rgba(16, 185, 129, 0.25)',
        'rose': '0 4px 14px 0 rgba(244, 63, 94, 0.25)',
        'blossom': '0 10px 30px -12px rgba(236, 72, 153, 0.35)',
        'purple': '0 4px 14px 0 rgba(168, 85, 247, 0.25)',
        'orange': '0 4px 14px 0 rgba(249, 115, 22, 0.25)',
        'inner-glow': 'inset 0 2px 4px 0 rgba(244, 63, 94, 0.1)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      aspectRatio: {
        'video-portrait': '9/16',
        'video-landscape': '16/9',
        'square': '1/1',
      },
      screens: {
        'xs': '320px',
        '3xl': '1920px',
      },
      zIndex: {
        'dropdown': '1000',
        'sticky': '1100',
        'banner': '1200',
        'overlay': '1300',
        'modal': '1400',
        'popover': '1500',
        'toast': '1700',
        'tooltip': '1800',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

export default config;
