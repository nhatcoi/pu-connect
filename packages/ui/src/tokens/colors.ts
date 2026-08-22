/**
 * Phenikaa University Brand Colors & Design Tokens
 */
export const phenikaaColors = {
  // Phenikaa Deep Blue: Tri thức, tin cậy, vững bền
  blue: {
    50: '214 100% 97%',
    100: '214 95% 92%',
    200: '214 90% 82%',
    300: '214 88% 70%',
    400: '214 86% 56%',
    500: '214 88% 45%',
    600: '214 90% 36%',
    700: '214 92% 28%', // Brand Main Blue
    800: '214 94% 20%',
    900: '214 96% 14%',
    950: '214 98% 8%'
  },
  // Phenikaa Innovation Orange: Sáng tạo, nhiệt huyết sinh viên
  orange: {
    50: '30 100% 97%',
    100: '30 100% 92%',
    200: '28 98% 82%',
    300: '28 96% 70%',
    400: '26 95% 60%',
    500: '25 95% 53%', // Brand Accent Orange
    600: '22 92% 46%',
    700: '18 90% 38%',
    800: '15 88% 30%',
    900: '12 85% 22%'
  },
  // Tech Cyan: Công nghệ số, AI & Đổi mới
  cyan: {
    500: '192 85% 48%',
    600: '194 88% 40%'
  }
} as const

export const themeTokens = {
  light: {
    background: '210 20% 98%', // #f8fafc slate-50
    foreground: '224 71.4% 4.1%',
    card: '0 0% 100%',
    cardForeground: '224 71.4% 4.1%',
    popover: '0 0% 100%',
    popoverForeground: '224 71.4% 4.1%',
    primary: '214 92% 28%', // Phenikaa Blue
    primaryForeground: '0 0% 98%',
    secondary: '214 30% 94%',
    secondaryForeground: '214 92% 28%',
    muted: '220 14.3% 95.9%',
    mutedForeground: '220 8.9% 46.1%',
    accent: '25 95% 53%', // Phenikaa Orange
    accentForeground: '0 0% 98%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '0 0% 98%',
    border: '220 13% 91%',
    input: '220 13% 91%',
    ring: '214 92% 28%',
    radius: '0.625rem'
  },
  dark: {
    background: '224 35% 8%', // Deep navy dark
    foreground: '210 40% 98%',
    card: '224 32% 12%',
    cardForeground: '210 40% 98%',
    popover: '224 32% 12%',
    popoverForeground: '210 40% 98%',
    primary: '214 100% 65%', // High-contrast Electric Blue
    primaryForeground: '224 35% 8%',
    secondary: '224 25% 18%',
    secondaryForeground: '210 40% 98%',
    muted: '224 25% 18%',
    mutedForeground: '215 20.2% 65.1%',
    accent: '25 95% 58%', // Bright Phenikaa Orange in dark mode
    accentForeground: '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '210 40% 98%',
    border: '224 25% 20%',
    input: '224 25% 20%',
    ring: '214 100% 65%',
    radius: '0.625rem'
  }
} as const
