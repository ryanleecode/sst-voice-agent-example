import { Context, Effect, Layer, Match } from 'effect'
import { MetadataMode } from 'llamaindex'
import pg from 'pg'

export type PoolConfig = pg.PoolConfig

export type IPGVectorStoreConfig = {
  pool: pg.Pool
  /**
   * @default "public"
   */
  schema?: string
  /**
   * @default "data_llamaindex_embedding"
   */
  tableName?: string
  /**
   * @default "1536"
   */
  dimensions?: string
  /**
   * @default true
   */
  performSetup?: boolean
  /**
   * @default "NONE"
   */
  metadataMode?: 'ALL' | 'EMBED' | 'LLM' | 'NONE'
}

export class PGVectorStoreConfig extends Context.Tag('llama-index_storage-pg-vector/PGVectorStoreConfig')<
  PGVectorStoreConfig,
  IPGVectorStoreConfig
>() {}

/**
 * @internal
 */
export class _PGVectorStoreConfig extends Context.Tag('llama-index_storage-pg-vector/_PGVectorStoreConfig')<
  _PGVectorStoreConfig,
  & Omit<IPGVectorStoreConfig, 'metadataMode'>
  & Required<Pick<IPGVectorStoreConfig, 'schema' | 'tableName' | 'dimensions' | 'performSetup'>>
  & { metadataMode: MetadataMode }
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function*() {
      const config = yield* PGVectorStoreConfig

      return {
        pool: config.pool,
        schema: config.schema ?? 'public',
        tableName: config.tableName ?? 'data_llamaindex_embedding',
        dimensions: config.dimensions ?? '1536',
        performSetup: config.performSetup ?? true,
        metadataMode: Match.value(config.metadataMode).pipe(
          Match.when('ALL', () => MetadataMode.ALL),
          Match.when('EMBED', () => MetadataMode.EMBED),
          Match.when('LLM', () => MetadataMode.LLM),
          Match.when('NONE', () => MetadataMode.NONE),
          Match.when(undefined, () => MetadataMode.NONE),
          Match.exhaustive,
        ),
      }
    }),
  )
}
