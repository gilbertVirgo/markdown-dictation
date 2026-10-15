import type { Engine } from './types'

// Replaced in a later task.
export const openai: Engine = {
  async start(opts) {
    opts.onError('not implemented yet')
  },
  stop() {},
}
