export const voxeraTokens = {
  font: {
    sans: "'Geist', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    display: "'Inter Display', 'Geist', 'Inter', sans-serif",
    mono: "'Geist Mono', 'JetBrains Mono', monospace",
    sizes: {
      display: {
        size: '2.25rem',
        lineHeight: '2.75rem',
        letterSpacing: '-0.04em',
        weight: '500'
      },
      h1: {
        size: '1.5rem',
        lineHeight: '2rem',
        letterSpacing: '-0.03em',
        weight: '500'
      },
      h2: {
        size: '1.125rem',
        lineHeight: '1.75rem',
        letterSpacing: '-0.02em',
        weight: '500'
      },
      body: {
        size: '0.9375rem',
        lineHeight: '1.625rem',
        letterSpacing: '-0.01em',
        weight: '400'
      },
      caption: {
        size: '0.75rem',
        lineHeight: '1rem',
        letterSpacing: '0',
        weight: '400'
      }
    },
    features: {
      heading: '"ss04" 1',
      numeric: '"tnum" 1, "zero" 1'
    }
  },
  color: {
    bg: {
      page: '#0a0a0a',
      surface: '#111111',
      overlay: '#171717',
      input: '#161616'
    },
    text: {
      primary: '#ededed',
      secondary: '#a0a0a0',
      tertiary: '#666666',
      inverse: '#0a0a0a'
    },
    border: {
      subtle: 'rgba(255,255,255,0.08)',
      hover: 'rgba(255,255,255,0.16)',
      active: 'rgba(255,255,255,0.24)'
    },
    focus: '#7dd3fc',
    chips: {
      notion: {
        glowColor: 'rgba(255,255,255,0.14)',
        glowShadow: '0 0 20px rgba(255,255,255,0.1), 0 0 40px rgba(255,255,255,0.05)',
        borderHover: 'rgba(255,255,255,0.24)',
        accent: '#f5f5f5'
      },
      kakao: {
        glowColor: 'rgba(250,224,66,0.22)',
        glowShadow: '0 0 20px rgba(250,224,66,0.16), 0 0 48px rgba(250,224,66,0.08)',
        borderHover: 'rgba(250,224,66,0.32)',
        accent: '#fae042'
      },
      gmail: {
        glowColor: 'rgba(255,122,89,0.18)',
        glowShadow: '0 0 20px rgba(255,122,89,0.16), 0 0 48px rgba(255,122,89,0.08)',
        borderHover: 'rgba(255,122,89,0.3)',
        accent: '#ff7a59'
      },
      gdocs: {
        glowColor: 'rgba(76,132,255,0.18)',
        glowShadow: '0 0 20px rgba(76,132,255,0.18), 0 0 48px rgba(76,132,255,0.08)',
        borderHover: 'rgba(76,132,255,0.3)',
        accent: '#4c84ff'
      }
    }
  },
  radius: {
    card: '24px',
    chip: '22px',
    sheet: '28px'
  },
  shadow: {
    sm: '0 5px 10px rgba(0,0,0,0.12)',
    md: '0 18px 42px rgba(0,0,0,0.18)',
    lg: '0 30px 60px rgba(0,0,0,0.24)'
  },
  motion: {
    ease: [0.16, 1, 0.3, 1] as const,
    spring: {
      type: 'spring' as const,
      stiffness: 360,
      damping: 30,
      mass: 0.9
    },
    stagger: 0.06
  }
} as const;

export type VoxeraChipTone = keyof typeof voxeraTokens.color.chips;
