/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm lo-fi darks — purple/plum undertones rather than pure black.
        obsidian: {
          950: '#0a0812',   // body bg
          900: '#110d1a',   // one step up
          800: '#191322',   // cards
          700: '#221a2d',
          600: '#2d2439',
          500: '#3a2f48',
          // 400/300 are the "secondary text" tones used across the app
          // (Clear all, X chip removers, helper labels). Bumped lighter +
          // warmer than the original plum-grays so they stay legible on
          // top of the dynamic per-track BackdropAura wash, regardless of
          // whether the current artwork is dark or bright.
          400: '#9b94a3',
          300: '#bab3bd',
          200: '#c5bfc9',
          100: '#ece6dc',   // warm cream — primary text
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        cream: '#ece6dc',
        dusk: '#0a0812',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 80px -10px rgb(var(--accent) / 0.45), 0 0 200px -40px rgb(var(--accent) / 0.25)',
        deep: '0 30px 60px -20px rgba(0,0,0,0.75)',
        card: '0 6px 30px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'spin-slow': 'spin 40s linear infinite',
        'spin-vinyl': 'spin 8s linear infinite',
        'pulse-soft': 'pulseSoft 4s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out',
        'float': 'float 7s ease-in-out infinite',
        'float-slow': 'float 11s ease-in-out infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.04)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
}
