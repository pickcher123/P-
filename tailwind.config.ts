import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        body: ['"Noto Sans TC"', 'sans-serif'],
        headline: ['Orbitron', 'sans-serif'],
        code: ['Rajdhani', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'blob': {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        'fade-in-up': {
            '0%': { transform: 'translateY(10px)' },
            '100%': { transform: 'translateY(0)' },
        },
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        },
        'explode-pack': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        'glow-burst': {
            '0%': { transform: 'scale(0)', opacity: '0' },
            '50%': { transform: 'scale(2)', opacity: '0.8' },
            '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'glow-legendary': {
          '0%, 100%': { boxShadow: '0 0 20px 5px hsl(var(--accent) / 0.4)', opacity: '0.8' },
          '50%': { boxShadow: '0 0 50px 20px hsl(var(--accent) / 0.6)', opacity: '1' }
        },
        'glow-rare': {
          '0%, 100%': { boxShadow: '0 0 15px 2px hsl(var(--primary) / 0.3)', opacity: '0.8' },
          '50%': { boxShadow: '0 0 40px 12px hsl(var(--primary) / 0.5)', opacity: '1' }
        },
        'firework': {
          '0%': { transform: 'scale(0.1)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' }
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - 1rem))' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'electric-chaos': {
          '0%, 100%': { opacity: '0', transform: 'scale(0.8) rotate(var(--tw-rotate))' },
          '10%, 90%': { opacity: '0.8', transform: 'scale(1.1) rotate(var(--tw-rotate))' },
          '20%, 40%, 60%, 80%': { opacity: '0.2', transform: 'scale(0.9) rotate(var(--tw-rotate))' },
          '30%, 50%, 70%': { opacity: '1', transform: 'scale(1.2) rotate(var(--tw-rotate))' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'blob': 'blob 7s infinite',
        'fade-in-up': 'fade-in-up 1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'shake': 'shake 0.7s cubic-bezier(.36,.07,.19,.97) both',
        'explode-pack': 'explode-pack 0.5s ease-out forwards',
        'glow-burst': 'glow-burst 0.6s ease-in-out forwards',
        'glow-legendary': 'glow-legendary 10s ease-in-out infinite',
        'glow-rare': 'glow-rare 10s ease-in-out infinite',
        'firework': 'firework 0.8s ease-out forwards',
        'marquee': 'marquee 80s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'electric-chaos': 'electric-chaos 2s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
