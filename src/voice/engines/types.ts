export type Engine = { start(opts: EngineOpts): Promise<void>; stop(): void }
export type EngineOpts = {
  lang: string
  vocabulary: () => string[] // getter: engines read fresh vocab per request
  onFinal(text: string): void
  onInterim(text: string): void
  onError(msg: string, fatal?: boolean): void // fatal (default): engine has stopped; false: transient, still recording
}
