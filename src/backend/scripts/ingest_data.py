import argparse
import json
import os
from pathlib import Path
from typing import List, Dict

import chromadb
import google.generativeai as genai
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
KNOWLEDGE_ROOT = BASE_DIR / "data" / "kien thuc_co so"
CHROMA_DB_DIR = BASE_DIR / "chroma_db"
COLLECTION_NAME = "techstore_knowledge"
EXPECTED_FOLDER_COUNT = 7
EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "models/gemini-embedding-001")


class RecursiveCharacterTextSplitter:
    def __init__(self, chunk_size: int, chunk_overlap: int, separators: List[str]):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators

    def split_text(self, text: str) -> List[str]:
        return self._split_recursive(text, self.separators)

    def _split_recursive(self, text: str, separators: List[str]) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text]

        if not separators:
            return self._sliding_window_split(text)

        separator = separators[0]
        next_separators = separators[1:]

        if separator == "":
            return self._sliding_window_split(text)

        parts = text.split(separator)
        if len(parts) == 1:
            return self._split_recursive(text, next_separators)

        merged: List[str] = []
        current = ""
        for part in parts:
            candidate = f"{current}{separator}{part}" if current else part
            if len(candidate) <= self.chunk_size:
                current = candidate
            else:
                if current:
                    merged.append(current)
                if len(part) > self.chunk_size:
                    merged.extend(self._split_recursive(part, next_separators))
                    current = ""
                else:
                    current = part

        if current:
            merged.append(current)

        return self._with_overlap(merged)

    def _sliding_window_split(self, text: str) -> List[str]:
        chunks: List[str] = []
        start = 0
        step = max(1, self.chunk_size - self.chunk_overlap)
        while start < len(text):
            end = min(len(text), start + self.chunk_size)
            chunks.append(text[start:end])
            if end == len(text):
                break
            start += step
        return chunks

    def _with_overlap(self, chunks: List[str]) -> List[str]:
        if not chunks:
            return []

        output: List[str] = []
        for idx, chunk in enumerate(chunks):
            if idx == 0:
                output.append(chunk)
                continue

            overlap_text = chunks[idx - 1][-self.chunk_overlap :] if self.chunk_overlap > 0 else ""
            merged = f"{overlap_text}{chunk}" if overlap_text else chunk
            output.append(merged[: self.chunk_size])
        return output


def _configure_gemini():
    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing in backend/.env")
    genai.configure(api_key=api_key)


def embed_texts(texts: List[str]) -> List[List[float]]:
    response = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=texts,
        task_type="retrieval_document",
    )
    embedding = response.get("embedding")
    if not embedding:
        raise RuntimeError("Gemini embedding API returned empty embedding")

    # API can return either a single vector or list of vectors depending on input size.
    if embedding and isinstance(embedding[0], (int, float)):
        return [embedding]
    return embedding


def list_markdown_files(knowledge_root: Path) -> List[Path]:
    if not knowledge_root.exists():
        raise FileNotFoundError(f"Knowledge root not found: {knowledge_root}")

    md_files = sorted(knowledge_root.rglob("*.md"))
    return [f for f in md_files if f.is_file()]


def split_markdown_file(file_path: Path) -> List[Dict]:
    content = file_path.read_text(encoding="utf-8", errors="ignore")
    if not content.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    docs = splitter.split_text(content)

    chunks: List[Dict] = []
    total = len(docs)
    for idx, doc in enumerate(docs):
        base_id = str(file_path.relative_to(KNOWLEDGE_ROOT)).replace("\\", "/").replace("/", "__")
        chunks.append(
            {
                "id": f"{base_id}__chunk_{idx}",
                "text": doc,
                "metadata": {
                    "source": str(file_path.relative_to(BASE_DIR)).replace("\\", "/"),
                    "file_name": file_path.name,
                    "category": file_path.parent.name,
                    "chunk_index": idx,
                    "chunk_total": total,
                },
            }
        )

    return chunks


def ingest(force_recreate: bool = True) -> Dict:
    _configure_gemini()
    folders = [p for p in KNOWLEDGE_ROOT.iterdir() if p.is_dir()] if KNOWLEDGE_ROOT.exists() else []
    md_files = list_markdown_files(KNOWLEDGE_ROOT)

    if not md_files:
        raise RuntimeError("No markdown files found in knowledge folders.")

    all_chunks: List[Dict] = []
    for md_file in md_files:
        all_chunks.extend(split_markdown_file(md_file))

    CHROMA_DB_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DB_DIR))

    if force_recreate:
        try:
            client.delete_collection(name=COLLECTION_NAME)
        except Exception:
            pass

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    batch_size = 100
    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i : i + batch_size]
        embeddings = embed_texts([item["text"] for item in batch])
        collection.add(
            ids=[item["id"] for item in batch],
            documents=[item["text"] for item in batch],
            metadatas=[item["metadata"] for item in batch],
            embeddings=embeddings,
        )

    return {
        "success": True,
        "knowledge_root": str(KNOWLEDGE_ROOT),
        "folders_found": len(folders),
        "expected_folders": EXPECTED_FOLDER_COUNT,
        "markdown_files": len(md_files),
        "chunks_ingested": len(all_chunks),
        "collection": COLLECTION_NAME,
        "chroma_db_path": str(CHROMA_DB_DIR),
        "embedding_model": EMBEDDING_MODEL,
        "folder_names": [f.name for f in sorted(folders, key=lambda x: x.name)],
        "warning": None
        if len(folders) == EXPECTED_FOLDER_COUNT
        else f"Expected {EXPECTED_FOLDER_COUNT} folders but found {len(folders)}",
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest TechStore markdown knowledge into local ChromaDB")
    parser.add_argument("--no-reset", action="store_true", help="Do not recreate collection before ingest")
    args = parser.parse_args()

    result = ingest(force_recreate=not args.no_reset)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
