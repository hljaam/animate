/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--focus-ring)',
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          dim: 'var(--accent-dim)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--bg-tertiary)',
          foreground: 'var(--text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          dim: 'var(--accent-dim)',
          foreground: '#ffffff',
        },
        popover: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--text-primary)',
        },
        card: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--text-primary)',
        },
        workspace: 'var(--workspace-bg)',
        'border-light': 'var(--border-light)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-label': 'var(--text-label)',
        'bg-hover': 'var(--bg-hover)',
        'bg-tertiary': 'var(--bg-tertiary)',
        export: 'var(--export-btn)',
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '13px',
        lg: '16px',
      },
      spacing: {
        'topbar': 'var(--topbar-height)',
        'toolbar': 'var(--toolbar-width)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
