import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'pure-white': '#FFFFFF',
        'warm-white': '#FBF7F0',
        'lontar-pale': '#F5EFE4',
        'sand-light': '#EDE4D3',
        
        // Accents (Emas)
        'golden-ink': '#C8922A',
        'deep-gold': '#A67520',
        'bright-gold': '#E8B84B',
        'gold-tint': '#FAE8B0',
        
        // Text & Structure
        'ink-dark': '#2C1A08',
        'ink-brown': '#5C3D1A',
        'warm-gray': '#8B6340',
        'muted-tan': '#C4A882',
        
        // Mastery States
        mastery: {
          dikuasai: '#2E7D4F',
          aktif: '#C8922A',
          lemah: '#C0392B',
          terkunci: '#C4A882',
        },

        // Surface variants
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F5EFE4',
        },
      },
      fontFamily: {
        heading: ['var(--font-playfair)', 'Playfair Display', 'serif'],
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #C8922A 0%, #A67520 100%)',
        'gradient-gold-bright': 'linear-gradient(135deg, #E8B84B 0%, #C8922A 100%)',
        'gradient-lontar': 'linear-gradient(180deg, #FBF7F0 0%, #F5EFE4 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'gold': '0 4px 20px rgba(200, 146, 42, 0.15)',
        'gold-lg': '0 8px 30px rgba(200, 146, 42, 0.25)',
        'card': '0 2px 16px rgba(44, 26, 8, 0.06)',
        'card-hover': '0 8px 30px rgba(44, 26, 8, 0.10)',
        'float': '0 20px 50px rgba(44, 26, 8, 0.12)',
        'inner-gold': 'inset 0 2px 4px rgba(200, 146, 42, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-left': 'slideInLeft 0.5s ease-out forwards',
        'slide-right': 'slideInRight 0.5s ease-out forwards',
        'float': 'float 4s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'spin-slow': 'spinSlow 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200, 146, 42, 0.3)' },
          '50%': { boxShadow: '0 0 0 12px rgba(200, 146, 42, 0)' },
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
