import { effectValidator } from '@hono/effect-validator'
import { VectorStore } from '@voice-agent-example/llama-index_storage'
import { Cause, Effect, Exit, pipe, Runtime } from 'effect'
import { Hono } from 'hono'
import { VectorStoreQuery } from './schema.js'

/**
 * @alpha
 */
export const VectorStoreHttpHono = Effect.gen(function*() {
  const runtime = yield* Effect.runtime()
  const vectorStore = yield* VectorStore
  const app = new Hono().post(
    '*',
    effectValidator('json', VectorStoreQuery),
    async (c) => {
      const result = await pipe(
        Effect.gen(function*() {
          const payload = c.req.valid('json')

          const result = yield* pipe(
            Effect.promise(() => vectorStore.query(payload)),
            Effect.map((r) => ({
              ...r,
              nodes: r.nodes?.map((node) => node.toJSON()) ?? [],
            })),
          )

          return result
        }),
        Runtime.runPromiseExit(runtime),
      )

      if (Exit.isFailure(result)) {
        throw Cause.squash(result.cause)
      }

      return c.json(result.value)
    },
  )

  return app
})
