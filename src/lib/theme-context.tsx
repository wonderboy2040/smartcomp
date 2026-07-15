'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

type Theme = 'light'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light'
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  resolvedTheme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

/**
 * PREMIUM LIGHT THEME — site is locked to light mode.
 * Dark theme has been completely removed for a consistent premium look.
 * The theme toggle is a no-op (kept for backward compatibility with existing
 * components that import useTheme, but no UI should expose it).
 */
function applyLightTheme() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  // Ensure dark class is NEVER present
  root.classList.remove('dark')
  root.style.colorScheme = 'light'
  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', '#ffffff')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('light')
  const [resolvedTheme] = useState<'light'>('light')

  // Force light on mount and whenever anything tries to change it
  useEffect(() => {
    applyLightTheme()
    // Clear any previously stored dark preference so the layout's inline script
    // also stays light on next reload.
    try {
      localStorage.setItem('smartcomp-theme', 'light')
    } catch {}
  }, [])

  // No-op setters — kept so existing imports don't crash
  const setTheme = useCallback((_t: Theme) => {
    applyLightTheme()
  }, [])

  const toggleTheme = useCallback(() => {
    applyLightTheme()
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
