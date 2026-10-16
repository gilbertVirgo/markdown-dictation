// Playful loading: stepping colour bars + a word whose letters hop in turn
export function Loader({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex-1 p-4">
      {[80, 55, 68].map((w, i) => (
        <div key={i} className="loader-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.2}s` }} />
      ))}
      <div aria-hidden className="t-small hop mt-3 text-mute">
        {[...label].map((c, i) => <span key={i} style={{ animationDelay: `${i * 0.05}s` }}>{c}</span>)}
      </div>
    </div>
  )
}

export const Dots = () => (
  <span aria-hidden className="hop">
    {[0, 1, 2].map((i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }}>.</span>)}
  </span>
)
