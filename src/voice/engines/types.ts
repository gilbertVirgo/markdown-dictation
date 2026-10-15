export type Engine = { start(opts: EngineOpts): Promise<void>; stop(): void }
export type EngineOpts = {
  lang: string
  vocabulary: string[]
  onFinal(text: string): void
  onInterim(text: string): void
  onError(msg: string): void
}
