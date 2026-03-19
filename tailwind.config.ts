import type { Config } from 'tailwindcss';
import { voxeraTokens } from './src/shared/design/design-tokens';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
    './src/shared/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter-display)', 'var(--font-geist-sans)', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'monospace']
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        bg: voxeraTokens.color.bg,
        text: voxeraTokens.color.text,
        stroke: {
          DEFAULT: voxeraTokens.color.border.subtle,
          hover: voxeraTokens.color.border.hover,
          active: voxeraTokens.color.border.active
        },
        chip: {
          notion: voxeraTokens.color.chips.notion.accent,
          kakao: voxeraTokens.color.chips.kakao.accent,
          gmail: voxeraTokens.color.chips.gmail.accent,
          gdocs: voxeraTokens.color.chips.gdocs.accent
        }
      },
      spacing: {
        '4.5': '18px',
        '18': '72px'
      },
      boxShadow: {
        sm: voxeraTokens.shadow.sm,
        md: voxeraTokens.shadow.md,
        lg: voxeraTokens.shadow.lg,
        'glow-notion': voxeraTokens.color.chips.notion.glowShadow,
        'glow-kakao': voxeraTokens.color.chips.kakao.glowShadow,
        'glow-gmail': voxeraTokens.color.chips.gmail.glowShadow,
        'glow-gdocs': voxeraTokens.color.chips.gdocs.glowShadow
      },
      keyframes: {
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'float-subtle': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -6px, 0)' }
        }
      },
      animation: {
        'slide-up': 'slide-up 220ms ease-out',
        'float-subtle': 'float-subtle 5s ease-in-out infinite'
      }
    }
  },
  plugins: []
};

export default config;
