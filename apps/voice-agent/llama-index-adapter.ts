import type { VectorStore } from '@voice-agent-example/llama-index_storage'
import {
  PGVectorStore,
  PGVectorStoreConfig,
} from '@voice-agent-example/llama-index_storage-pg-vector'
import { Config, Effect, Layer } from 'effect'
import type { ConfigError } from 'effect/ConfigError'
import type { Scope } from 'effect/Scope'
import { OpenAIEmbedding, Settings } from 'llamaindex'
import pg from 'pg'
import { layerIPCServer } from './ipc.js'

const layerVectorStore = Layer.provideMerge(
  layerIPCServer,
  Layer.provide(
    PGVectorStore,
    Layer.effect(
      PGVectorStoreConfig,
      Effect.gen(function*() {
        const DATABASE_URL = yield* Config.nonEmptyString('DATABASE_URL')
        const pool = yield* Effect.sync(() => new pg.Pool({ connectionString: DATABASE_URL }))

        return {
          pool,
          performSetup: false,
          schema: 'data',
          tableName: 'data_voice_agent_llamaindex_embedding',
        }
      }),
    ),
  ),
)

const layerLlamaSettings = Layer.effectDiscard(
  Effect.gen(function*() {
    yield* Effect.sync(() => {
      Settings.embedModel = new OpenAIEmbedding({
        model: 'text-embedding-3-small',
      })
    })
  }),
)

export const layerLlamaIndex: Layer.Layer<VectorStore, ConfigError, Scope> = Layer.provide(
  Layer.mergeAll(layerVectorStore),
  layerLlamaSettings,
)
