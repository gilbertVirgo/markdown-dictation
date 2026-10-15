import { useEffect } from 'react'

// iOS keeps 100dvh when the keyboard opens and may pan the page; track the visible viewport's
// height (--vvh) and offset (--vvt) so a fixed root container stays inside it.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement.style
    const set = () => {
      if (vv.scale !== 1) return // pinch-zoom: leave layout alone
      root.setProperty('--vvh', `${vv.height}px`)
      root.setProperty('--vvt', `${vv.offsetTop}px`)
    }
    set()
    vv.addEventListener('resize', set)
    vv.addEventListener('scroll', set)
    return () => {
      vv.removeEventListener('resize', set)
      vv.removeEventListener('scroll', set)
      root.removeProperty('--vvh')
      root.removeProperty('--vvt')
    }
  }, [])
}
