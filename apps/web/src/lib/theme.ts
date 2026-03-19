export interface ThemePreset {
  id: string
  name: string
  primary: string
  primaryForeground: string
  ring: string
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default Purple',
    primary: '#7c3aed',
    primaryForeground: '#ffffff',
    ring: '#7c3aed',
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    primary: '#2563eb',
    primaryForeground: '#ffffff',
    ring: '#2563eb',
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    primary: '#059669',
    primaryForeground: '#ffffff',
    ring: '#059669',
  },
  {
    id: 'rose',
    name: 'Rose Pink',
    primary: '#e11d48',
    primaryForeground: '#ffffff',
    ring: '#e11d48',
  },
  {
    id: 'amber',
    name: 'Amber Orange',
    primary: '#d97706',
    primaryForeground: '#ffffff',
    ring: '#d97706',
  },
  {
    id: 'slate',
    name: 'Slate Gray',
    primary: '#475569',
    primaryForeground: '#ffffff',
    ring: '#475569',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    primary: '#0891b2',
    primaryForeground: '#ffffff',
    ring: '#0891b2',
  },
]

const STORAGE_KEY = 'axy_theme_colors'

interface StoredTheme {
  id: string
  customColor?: string
}

/**
 * Calculate relative luminance of a hex color and return white or black
 * for optimal foreground contrast.
 */
export function getForegroundForColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  // sRGB to linear
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return luminance > 0.4 ? '#000000' : '#ffffff'
}

/**
 * Apply a color theme by setting CSS variables on the document root.
 * For the "default" theme, we remove overrides so the CSS defaults apply.
 */
export function applyTheme(themeId: string, customColor?: string): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  if (themeId === 'default') {
    root.style.removeProperty('--primary')
    root.style.removeProperty('--primary-foreground')
    root.style.removeProperty('--ring')
    return
  }

  if (themeId === 'custom' && customColor) {
    const fg = getForegroundForColor(customColor)
    root.style.setProperty('--primary', customColor)
    root.style.setProperty('--primary-foreground', fg)
    root.style.setProperty('--ring', customColor)
    return
  }

  const preset = THEME_PRESETS.find((t) => t.id === themeId)
  if (preset) {
    root.style.setProperty('--primary', preset.primary)
    root.style.setProperty('--primary-foreground', preset.primaryForeground)
    root.style.setProperty('--ring', preset.ring)
  }
}

/**
 * Read the active color theme from localStorage.
 */
export function getStoredTheme(): StoredTheme {
  if (typeof localStorage === 'undefined') return { id: 'default' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { id: 'default' }
    return JSON.parse(raw) as StoredTheme
  } catch {
    return { id: 'default' }
  }
}

/**
 * Persist the selected color theme to localStorage.
 */
export function storeTheme(id: string, customColor?: string): void {
  if (typeof localStorage === 'undefined') return
  const data: StoredTheme = { id }
  if (customColor) data.customColor = customColor
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Load and apply the stored color theme. Call on app startup.
 */
export function initColorTheme(): void {
  const { id, customColor } = getStoredTheme()
  applyTheme(id, customColor)
}
