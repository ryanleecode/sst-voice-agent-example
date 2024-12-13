from typing import Any, List, Sequence
from llama_index.core.vector_stores.types import (
    BasePydanticVectorStore,
    VectorStoreQuery,
    VectorStoreQueryResult,
)
from llama_index.core.schema import TextNode, BaseNode
import aiohttp
import asyncio

def clean_dict(d):
    return {k: v for k, v in d.items() if v is not None}
class IPCVectorStore(BasePydanticVectorStore):
    stores_text: bool = True
    socket_path: str

    def __init__(self, socket_path: str):
        super().__init__(socket_path=socket_path)

    @property
    def client(self) -> Any:
        return self.socket

    def add(self, nodes: Sequence[BaseNode], **kwargs: Any) -> List[str]:
        # TODO: Implement add method
        raise NotImplementedError("add method not implemented")

    def delete(self, ref_doc_id: str, **delete_kwargs: Any) -> None:
        # TODO: Implement delete method
        raise NotImplementedError("delete method not implemented")

    def query(self, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
        return asyncio.run(self.aquery(query, **kwargs))

    async def aquery(
        self, query: VectorStoreQuery, **kwargs: Any
    ) -> VectorStoreQueryResult:
        connector = aiohttp.UnixConnector(path=self.socket_path)
        async with aiohttp.ClientSession(connector=connector) as session:
            body = {
                "_tag": "VectorStoreQuery",
                "queryEmbedding": query.query_embedding,
                "similarityTopK": query.similarity_top_k,
                "docIds": query.doc_ids,
                "queryStr": query.query_str,
                "mode": query.mode,
                "alpha": query.alpha,
                "filters": query.filters,
                "mmrThreshold": query.mmr_threshold,
            }

            response = await session.post("http://localhost/embeddings", json=body)
            if response.status == 200:
                result = await response.json()

                deserialized = VectorStoreQueryResult(
                    ids=result.get("ids", []),
                    similarities=result.get("similarities", []),
                    nodes=[
                        TextNode.model_validate(
                            clean_dict(
                                {
                                    "id_": node.get("id_"),
                                    "metadata": node.get("metadata"),
                                    "excluded_embed_metadata_keys": node.get(
                                        "excludedEmbedMetadataKeys"
                                    ),
                                    "excluded_llm_metadata_keys": node.get(
                                        "excludedLlmMetadataKeys"
                                    ),
                                    "relationships": node.get("relationships"),
                                    "embedding": node.get("embedding"),
                                    "text": node.get("text"),
                                    "text_template": node.get("textTemplate"),
                                    "metadata_template": node.get("metadataTemplate"),
                                    "metadata_seperator": node.get("metadataSeparator"),
                                }
                            )
                        )
                        for node in result.get("nodes", [])
                    ],
                )

                return deserialized
            else:
                # don't crash. log errors and monitor errors from the 
                # IPC server.
                return VectorStoreQueryResult()
