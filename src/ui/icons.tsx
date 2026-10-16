import type { ReactNode, SVGProps } from 'react'

// Lucide-style 24px stroke icons
const icon = (paths: ReactNode) => (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    {paths}
  </svg>
)

export const Mic = icon(<><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></>)
export const Settings = icon(<><path d="M20 7h-9M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></>)
export const ArrowLeft = icon(<path d="m12 19-7-7 7-7M19 12H5" />)
export const MoreVertical = icon(<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>)
export const Trash = icon(<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />)
export const Plus = icon(<path d="M5 12h14M12 5v14" />)
export const Link = icon(<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />)
export const Quote = icon(<path d="M17 6H3M21 12H8M21 18H8M3 12v6" />)
export const List = icon(<path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13" />)
