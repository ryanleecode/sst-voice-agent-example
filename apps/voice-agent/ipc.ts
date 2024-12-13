import { VectorStoreHttpHono } from '@voice-agent-example/vector-storage-hono'
import { Config, Effect, Layer, pipe, Schedule } from 'effect'
import { Hono } from 'hono'

const App = Effect.gen(function*() {
  const vectorStore = yield* VectorStoreHttpHono

  const app = yield* Effect.sync(() =>
    new Hono()
      .route('embeddings', vectorStore)
  )

  return app
})

export const layerIPCServer = Layer.effectDiscard(
  Effect.gen(function*() {
    const app = yield* App
    const SOCKET_PATH = yield* pipe(
      Config.nonEmptyString('SOCKET_PATH'),
      Config.withDefault('/tmp/voice-agent.sock'),
    )

    yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          unix: SOCKET_PATH,
          fetch: app.fetch,
        })
      ),
      (server) =>
        pipe(
          Effect.sync(() => server.stop()),
          Effect.catchAll(() => Effect.void),
        ),
    )

    yield* Effect.never
  }).pipe(
    Effect.andThen(() => Effect.never),
    Effect.retry({ schedule: Schedule.forever }),
    Effect.scoped,
    Effect.fork,
  ),
)
