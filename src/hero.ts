// Author: nattapat2871 (https://nattapat2871.me)
import { heroui } from '@heroui/react'

// Arrivals-board palette: board black, flap charcoal, signage yellow.
export default heroui({
  defaultTheme: 'dark',
  layout: { radius: { small: '2px', medium: '3px', large: '4px' }, disabledOpacity: '0.45' },
  themes: {
    dark: {
      colors: {
        background: '#0d0f0e',
        foreground: '#f2efe6',
        content1: '#161918',
        content2: '#1d2120',
        content3: '#262a28',
        content4: '#2f3432',
        divider: '#2a2f2d',
        focus: '#f5c518',
        default: { DEFAULT: '#262a28', foreground: '#f2efe6', 100: '#1d2120', 200: '#262a28', 300: '#343a37', 400: '#59605c', 500: '#8b918d' },
        primary: { DEFAULT: '#f5c518', foreground: '#0d0f0e' },
        danger: { DEFAULT: '#ff6b5e', foreground: '#0d0f0e' },
        success: { DEFAULT: '#7fd3a0', foreground: '#0d0f0e' },
      },
    },
  },
})
