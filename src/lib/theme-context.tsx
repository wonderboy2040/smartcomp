'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  let resolved: 'light' | 'dark' = 'light'
  
  if (theme === 'system') {
    resolved = getSystemTheme()
  } else {
    resolved = theme
  }
  
  if (resolved === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
  
  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0a0e1a' : '#ffffff')
  }
  
  return resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    try {
      const stored = localStorage.getItem('smartcomp-theme') as Theme | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    } catch {}
    return 'system'
  })
  
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      const stored = localStorage.getItem('smartcomp-theme') as Theme | null
      if (stored === 'light') return 'light'
      if (stored === 'dark') return 'dark'
      return getSystemTheme()
    } catch {
      return 'light'
    }
  })

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const newResolved = mediaQuery.matches ? 'dark' : 'light'
      setResolvedTheme(newResolved)
      applyTheme('system')
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  useEffect(() => {
    const resolved = applyTheme(theme)
    if (resolved) setResolvedTheme(resolved)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem('smartcomp-theme', t)
    } catch {}
    const resolved = applyTheme(t)
    if (resolved) setResolvedTheme(resolved)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      // Cycle: light -> dark -> system -> light
      let next: Theme
      if (prev === 'light') next = 'dark'
      else if (prev === 'dark') next = 'system'
      else next = 'light'
      
      try {
        localStorage.setItem('smartcomp-theme', next)
      } catch {}
      
      const resolved = applyTheme(next)
      if (resolved) setResolvedTheme(resolved)
      
      return next
    })
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
