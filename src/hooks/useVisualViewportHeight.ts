import { useEffect } from 'react'

// iOS keeps 100dvh when the keyboard opens; track the visible viewport so footers sit above it.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement.style
    const set = () => root.setProperty('--vvh', `${vv.height}px`)
    set()
    vv.addEventListener('resize', set)
    vv.addEventListener('scroll', set)
    return () => {
      vv.removeEventListener('resize', set)
      vv.removeEventListener('scroll', set)
      root.removeProperty('--vvh')
    }
  }, [])
}
