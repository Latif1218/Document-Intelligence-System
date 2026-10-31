/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Obsidian Cyan (Dark Theme)
        obsidian: {
          bg: '#0B0F19',
          surface: '#111827',
          card: '#1E293B',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        cyanBrand: {
          light: '#38BDF8',
          DEFAULT: '#0EA5E9',
          dark: '#0284C7',
        },
        indigoBrand: {
          light: '#818CF8',
          DEFAULT: '#6366F1',
          dark: '#4F46E5',
        },

        // Warm Studio (Off-White, Orange & Slate Gray)
        warm: {
          bg: '#F8F9FA',
          card: '#FFFFFF',
          border: '#E2E8F0',
          borderHover: '#CBD5E1',
          text: '#0F172A',
          muted: '#64748B',
        },
        orangeBrand: {
          light: '#FB923C',
          DEFAULT: '#F97316',
          dark: '#EA580C',
          hover: '#C2410C',
        },
        slateGray: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      boxShadow: {
        'glow-cyan': '0 10px 25px -5px rgba(14, 165, 233, 0.25)',
        'glow-orange': '0 10px 25px -5px rgba(249, 115, 22, 0.25)',
        'soft-float': '0 10px 30px -10px rgba(0, 0, 0, 0.12)',
        'warm-card': '0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 4px 10px -2px rgba(249, 115, 22, 0.08)',
      },
      backgroundImage: {
        'gradient-cyan-indigo': 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
        'gradient-orange-warm': 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
      },
    },
  },
  plugins: [],
}

