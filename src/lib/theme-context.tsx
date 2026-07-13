'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  // Update theme-color meta for mobile
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', t === 'dark' ? '#16172a' : '#eef0f6')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Read initial theme from localStorage so the very first client render
  // matches what the inline script in layout.tsx already applied to <html>.
  // This avoids a flash of wrong theme and avoids hydration mismatches.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      const stored = localStorage.getItem('smartcomp-theme')
      if (stored === 'light' || stored === 'dark') return stored
    } catch {}
    return 'light'
  })

  // Apply theme on every change
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem('smartcomp-theme', t)
    } catch {}
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem('smartcomp-theme', next)
      } catch {}
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
