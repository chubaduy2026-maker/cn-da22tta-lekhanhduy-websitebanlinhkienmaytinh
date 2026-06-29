import argparse
import json
import os
from pathlib import Path

import chromadb
import google.generativeai as genai
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
CHROMA_DB_DIR = BASE_DIR / "chroma_db"
COLLECTION_NAME = "techstore_knowledge"
EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "models/gemini-embedding-001")


def _configure_gemini():
    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing in backend/.env")
    genai.configure(api_key=api_key)


def embed_query(question: str):
    response = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=question,
        task_type="retrieval_query",
    )
    embedding = response.get("embedding")
    if not embedding:
        raise RuntimeError("Gemini embedding API returned empty query embedding")
    return embedding


def query(question: str, top_k: int = 4):
    _configure_gemini()
    client = chromadb.PersistentClient(path=str(CHROMA_DB_DIR))
    collection = client.get_collection(name=COLLECTION_NAME)
    query_embedding = embed_query(question)
    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]

    chunks = []
    for idx, doc in enumerate(documents):
        chunks.append(
            {
                "content": doc,
                "metadata": metadatas[idx] if idx < len(metadatas) else {},
                "distance": distances[idx] if idx < len(distances) else None,
            }
        )

    return {
        "success": True,
        "question": question,
        "top_k": top_k,
        "chunks": chunks,
        "count": len(chunks),
    }


def main():
    parser = argparse.ArgumentParser(description="Query TechStore local ChromaDB")
    parser.add_argument("--question", required=True, help="User question to search")
    parser.add_argument("--top-k", type=int, default=4, help="Number of chunks to retrieve")
    args = parser.parse_args()

    try:
        payload = query(question=args.question, top_k=args.top_k)
        print(json.dumps(payload, ensure_ascii=True))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=True))


if __name__ == "__main__":
    main()
