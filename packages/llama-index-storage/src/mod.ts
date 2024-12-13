import { Context } from 'effect'
import type { VectorStore as IVectorStore } from 'llamaindex/vector-store'

export type { IVectorStore }
export class VectorStore extends Context.Tag('llama-index_storage/VectorStore')<
  VectorStore,
  IVectorStore
>() {}
