import * as S from 'effect/Schema'
import * as llamaindex from 'llamaindex/vector-store'

export const VectorStoreQuery = S.TaggedStruct('VectorStoreQuery', {
  queryEmbedding: S.optionalWith(S.mutable(S.Array(S.Number)), { nullable: true }),
  similarityTopK: S.Number,
  docIds: S.optionalWith(S.mutable(S.Array(S.String)), { nullable: true }),
  queryStr: S.optionalWith(S.String, { nullable: true }),
  mode: S.Enums(llamaindex.VectorStoreQueryMode),
  alpha: S.optionalWith(S.Number, { nullable: true }),
  // filters: S.optionalWith(S.Any, { nullable: true }),
  mmrThreshold: S.optionalWith(S.Number, { nullable: true }),
})

export type VectorStoreQuery = S.Schema.Type<typeof VectorStoreQuery>

/** @internal */
export namespace Guards {
  type TypeEqualityGuard<A, B> = Exclude<A, B> | Exclude<B, A>
  type AssertTypeEquality<T extends never> = T extends never ? true : false

  type _ = AssertTypeEquality<
    TypeEqualityGuard<Omit<VectorStoreQuery, '_tag'>, Readonly<llamaindex.VectorStoreQuery>>
  >
}
