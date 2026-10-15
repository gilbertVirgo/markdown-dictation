import type { Engine } from './types'

// Replaced in a later task.
export const deepgram: Engine = {
  async start(opts) {
    opts.onError('not implemented yet')
  },
  stop() {},
}
