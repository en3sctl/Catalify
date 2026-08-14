/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm lo-fi darks — purple/plum undertones rather than pure black.
        // All theme-able colors route through CSS variables (globals.css
        // :root / [data-theme="light"]) so the light theme is a pure
        // variable swap — including `white`/`black`, which flip to ink /
        // paper so the ubiquitous bg-white/[0.0x] washes keep working.
        obsidian: {
          950: 'rgb(var(--ob-950) / <alpha-value>)',   // body bg
          900: 'rgb(var(--ob-900) / <alpha-value>)',   // one step up
          800: 'rgb(var(--ob-800) / <alpha-value>)',   // cards
          700: 'rgb(var(--ob-700) / <alpha-value>)',
          600: 'rgb(var(--ob-600) / <alpha-value>)',
          500: 'rgb(var(--ob-500) / <alpha-value>)',
          // 400/300 are the "secondary text" tones used across the app.
          400: 'rgb(var(--ob-400) / <alpha-value>)',
          300: 'rgb(var(--ob-300) / <alpha-value>)',
          200: 'rgb(var(--ob-200) / <alpha-value>)',
          100: 'rgb(var(--ob-100) / <alpha-value>)',   // warm cream — primary text
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        cream: 'rgb(var(--cream) / <alpha-value>)',
        dusk: 'rgb(var(--ob-950) / <alpha-value>)',
        white: 'rgb(var(--white) / <alpha-value>)',
        black: 'rgb(var(--black) / <alpha-value>)',
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
