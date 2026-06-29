const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LocalRAGPythonBridge {
  constructor() {
    this.backendRoot = path.resolve(__dirname, '../../../');
    this.workspaceRoot = path.resolve(this.backendRoot, '..');
    this.queryScript = path.join(this.backendRoot, 'scripts', 'query_rag.py');
  }

  _resolvePythonExecutable() {
    if (process.env.RAG_PYTHON_PATH) {
      return process.env.RAG_PYTHON_PATH;
    }

    const venvPython = path.join(this.workspaceRoot, '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPython)) {
      return venvPython;
    }

    return 'python';
  }

  _runQueryScript(question, topK = 4) {
    return new Promise((resolve, reject) => {
      const pythonBin = this._resolvePythonExecutable();
      const args = [this.queryScript, '--question', question, '--top-k', String(topK)];

      const child = spawn(pythonBin, args, {
        cwd: this.backendRoot,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
        },
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString('utf-8');
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString('utf-8');
      });

      child.on('error', (error) => reject(error));

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Python query script exited with code ${code}. ${stderr}`));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (!parsed.success) {
            return reject(new Error(parsed.error || 'RAG query failed'));
          }
          resolve(parsed);
        } catch (parseError) {
          reject(new Error(`Failed to parse RAG query output: ${parseError.message}. Raw: ${stdout}`));
        }
      });
    });
  }

  async retrieveTopChunks(question, topK = 4) {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    const safeTopK = Number.isFinite(topK) ? Math.max(1, Math.min(20, topK)) : 4;
    return this._runQueryScript(question.trim(), safeTopK);
  }
}

module.exports = new LocalRAGPythonBridge();
