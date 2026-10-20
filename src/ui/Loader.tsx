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

// Same hop as .hop, but SVG <animate> moves the dots in paint instead of giving each one a compositing layer:
// those layers, remounted with the status ticker on every save, leaked Safari graphics memory until it reloaded the tab.
// 1em = 20 units; the dots sit on the baseline and hop 4px (6 units at the 13px status text).
export function Dots() {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches // SMIL ignores CSS's reduced-motion override
  return (
    <svg aria-hidden viewBox="0 0 22 20" className="ml-[0.1em] inline h-[1em] w-[1.1em] align-baseline" fill="currentColor">
      {[3, 10, 17].map((cx, i) => (
        <circle key={cx} cx={cx} cy={18.3} r={1.7}>
          {!still && (
            <animate attributeName="cy" values="18.3;12.3;18.3;18.3" keyTimes="0;.3;.6;1" calcMode="spline"
              keySplines=".22 1 .36 1;.22 1 .36 1;0 0 1 1" dur="1s" begin={`${i * 0.12}s`} repeatCount="indefinite" />
          )}
        </circle>
      ))}
    </svg>
  )
}
