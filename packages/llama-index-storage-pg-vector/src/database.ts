import { Context, Effect, Layer, pipe } from 'effect'
import { Kysely, PostgresDialect, sql } from 'kysely'
import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { _PGVectorStoreConfig } from './config.js'

/**
 * @internal
 */
export interface Database {
  [key: string]: EmbeddingsTable
}

/**
 * @internal
 */
export interface EmbeddingsTable {
  id: Generated<number>
  node_id: string
  text: string
  metadata_: Record<string, string>
  embedding: string
}

/**
 * @internal
 */
export type Embedding = Selectable<EmbeddingsTable>
/**
 * @internal
 */
export type NewEmbedding = Insertable<EmbeddingsTable>
/**
 * @internal
 */
export type EmbeddingUpdate = Updateable<EmbeddingsTable>

/**
 * @internal
 */
export class DB extends Context.Tag('llama-index_storage-pg-vector/DB')<DB, Kysely<Database>>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function*() {
      const config = yield* _PGVectorStoreConfig

      const dialect = yield* Effect.sync(() => new PostgresDialect({ pool: config.pool }))
      const db = new Kysely<Database>({ dialect })

      return db
    }),
  )

  static setupTables = Effect.gen(function*() {
    const db = yield* DB
    const { schema, tableName, dimensions } = yield* _PGVectorStoreConfig

    yield* Effect.promise(() => sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db))
    yield* Effect.promise(() => db.schema.createSchema(schema).ifNotExists().execute())
    yield* Effect.promise(() =>
      db.schema
        .createTable(`${schema}.${tableName}`)
        .ifNotExists()
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('node_id', 'varchar', (col) => col.unique().notNull())
        .addColumn('text', 'varchar', (col) => col.notNull())
        .addColumn('metadata_', 'jsonb', (col) => col.notNull().defaultTo('{}'))
        .addColumn('embedding', sql`VECTOR(${sql.raw(dimensions)})`, (col) => col.notNull())
        .execute()
    )

    const rawTableName = sql.raw(tableName)
    const rawSchema = sql.raw(schema)

    yield* Effect.promise(() =>
      sql`
        CREATE INDEX IF NOT EXISTS idx_${rawTableName}_node_id 
          ON ${rawSchema}.${rawTableName} (node_id);
      `.execute(db)
    )

    yield* Effect.promise(() =>
      db.schema.createIndex(`${tableName}_embedding_idx`)
        .ifNotExists()
        .on(`${schema}.${tableName}`)
        .using('hnsw')
        .expression(sql`embedding vector_cosine_ops`)
        .execute()
    )

    yield* Effect.promise(() =>
      sql`
        CREATE INDEX IF NOT EXISTS idx_${rawTableName}_text_search 
          ON ${rawSchema}.${rawTableName} USING GIN (to_tsvector('english', text));
      `.execute(db)
    )

    yield* Effect.promise(() =>
      sql`
        CREATE OR REPLACE FUNCTION hybrid_search(
          query_text TEXT,
          query_embedding VECTOR(${sql.raw(dimensions)}),
          match_count INT,
          full_text_weight FLOAT = 1,
          semantic_weight FLOAT = 1,
          rrf_k INT = 50
        ) RETURNS TABLE (
          id INT,
          node_id VARCHAR,
          text VARCHAR,
          metadata_ JSONB,
          embedding VECTOR(${sql.raw(dimensions)}),
          score FLOAT
        ) 
        LANGUAGE SQL
        AS $$
          WITH full_text AS (
            SELECT id,
              ROW_NUMBER() OVER(ORDER BY ts_rank_cd(to_tsvector('english', text), websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
            FROM ${rawSchema}.${rawTableName}
            WHERE to_tsvector('english', text) @@ websearch_to_tsquery('english', query_text)
            ORDER BY rank_ix
            LIMIT GREATEST(match_count, 30) * 2
          ),
          semantic AS (
            SELECT id,
              ROW_NUMBER() OVER (ORDER BY 1 - (embedding <=> query_embedding)) AS rank_ix
            FROM ${rawSchema}.${rawTableName}
            ORDER BY rank_ix
            LIMIT GREATEST(match_count, 30) * 2
          )
          SELECT 
            ${rawTableName}.id,
            ${rawTableName}.node_id,
            ${rawTableName}.text,
            ${rawTableName}.metadata_,
            ${rawTableName}.embedding,
            COALESCE(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight + 
            COALESCE(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight AS score
          FROM full_text
          FULL OUTER JOIN semantic ON full_text.id = semantic.id
          JOIN ${rawSchema}.${rawTableName} ON COALESCE(full_text.id, semantic.id) = ${rawTableName}.id
          ORDER BY score DESC
          LIMIT GREATEST(match_count, 30)
        $$;
      `.execute(db)
    )
  })
}
