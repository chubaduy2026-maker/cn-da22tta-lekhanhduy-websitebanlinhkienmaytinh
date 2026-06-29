const fs = require('fs');
const path = require('path');

const KNOWLEDGE_ROOT = path.resolve(__dirname, '..', 'data', 'kien thuc_co so');

function listMarkdownFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeMarkdown(content) {
  const unix = content.replace(/\r\n/g, '\n');
  const lines = unix.split('\n').map((line) => line.replace(/[ \t]+$/g, ''));

  const normalized = [];
  let blankCount = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})([^#\s].*)$/);
    const fixedHeading = headingMatch ? `${headingMatch[1]} ${headingMatch[2].trim()}` : line;

    if (!fixedHeading.trim()) {
      blankCount += 1;
      if (blankCount <= 1) {
        normalized.push('');
      }
      continue;
    }

    blankCount = 0;
    normalized.push(fixedHeading);
  }

  return `${normalized.join('\n').trim()}\n`;
}

function run({ write = false } = {}) {
  if (!fs.existsSync(KNOWLEDGE_ROOT)) {
    throw new Error(`Knowledge root not found: ${KNOWLEDGE_ROOT}`);
  }

  const files = listMarkdownFiles(KNOWLEDGE_ROOT);
  let changedFiles = 0;
  let unchangedFiles = 0;

  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = normalizeMarkdown(before);

    if (before === after) {
      unchangedFiles += 1;
      continue;
    }

    changedFiles += 1;
    if (write) {
      fs.writeFileSync(file, after, 'utf8');
    }
  }

  return {
    success: true,
    write,
    knowledgeRoot: KNOWLEDGE_ROOT,
    markdownFiles: files.length,
    changedFiles,
    unchangedFiles,
  };
}

function main() {
  const write = process.argv.includes('--write');
  const result = run({ write });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  run,
  normalizeMarkdown,
};
