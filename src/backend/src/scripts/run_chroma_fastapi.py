"""Run Chroma's Python FastAPI server (bypasses rust CLI wrapper).

Usage:
  D:\TechStore_AI\.venv\Scripts\python.exe src/scripts/run_chroma_fastapi.py
"""
import os
import sys

# Prefer Python FastAPI implementation instead of rust bindings CLI
os.environ.setdefault('CHROMA_API_IMPL', 'chromadb.api.fastapi.FastAPI')
# Prefer loopback by default on Windows to avoid invalid-address errors
# Allow overriding via environment when needed.
os.environ.setdefault('CHROMA_SERVER_HOST', os.environ.get('CHROMA_SERVER_HOST', '127.0.0.1'))
# Chroma Python server reads chroma_server_http_port from Settings; set default
os.environ.setdefault('CHROMA_SERVER_HTTP_PORT', os.environ.get('CHROMA_SERVER_HTTP_PORT', os.environ.get('CHROMA_SERVER_PORT', '8000')))

def main():
    try:
        from chromadb.config import Settings
        from chromadb.server.fastapi import FastAPI as ChromaFastAPI
    except Exception as e:
        print('Failed to import chromadb FastAPI server:', e)
        sys.exit(1)

    settings = Settings()
    server = ChromaFastAPI(settings)
    app = server._app

    import uvicorn
    # uvicorn host/port (use CHROMA_SERVER_HOST/CHROMA_SERVER_PORT for compatibility)
    host = os.environ.get('CHROMA_SERVER_HOST', '127.0.0.1')
    port = int(os.environ.get('CHROMA_SERVER_PORT', os.environ.get('CHROMA_SERVER_HTTP_PORT', os.environ.get('CHROMA_PORT', 8000))))
    print(f'Starting Chroma FastAPI on {host}:{port} (CHROMA_API_IMPL={settings.chroma_api_impl})')
    uvicorn.run(app, host=host, port=port)

if __name__ == '__main__':
    main()
