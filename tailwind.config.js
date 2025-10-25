/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'purple-dark': '#1a0f2e',
        'purple-border': '#2d1b4e',
        'purple-muted': '#a78bfa',
        'purple-brand': '#8b5cf6',
        'purple-accent': '#a855f7',
        'purple-light': '#c084fc',
      },
      fontFamily: {
        'press-start': ['Press Start 2P', 'system-ui'],
        'share-tech': ['Share Tech Mono', 'monospace'],
      },
      animation: {
        'grid-move': 'gridMove 22s linear infinite',
        'latest-pulse': 'latestPulse 900ms ease-out',
        'airdrop-flash': 'airdropFlash 800ms ease-out',
        'win-glow': 'winGlow 1200ms ease-out',
      },
      keyframes: {
        gridMove: {
          'from': { backgroundPosition: '0 0, 0 0, 0 0, 0 0' },
          'to': { backgroundPosition: '0 0, 0 0, 0 44px, 44px 0' },
        },
        latestPulse: {
          '0%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)', borderColor: '#2d1b4e' },
          '30%': { boxShadow: '0 0 30px rgba(139,92,246,0.5)', borderColor: '#a855f7' },
          '100%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)', borderColor: '#2d1b4e' },
        },
        airdropFlash: {
          '0%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)', borderColor: '#2d1b4e' },
          '50%': { boxShadow: '0 0 30px rgba(139,92,246,0.5)', borderColor: '#a855f7' },
          '100%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)', borderColor: '#2d1b4e' },
        },
        winGlow: {
          '0%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)' },
          '40%': { boxShadow: '0 0 40px rgba(139,92,246,0.6)' },
          '100%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)' },
        },
      },
    },
  },
  plugins: [],
}
