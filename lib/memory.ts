import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'culer-memory.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let saver: SqliteSaver | null = null;

export function getMemorySaver() {
  if (!saver) {
    saver = new SqliteSaver({
      databasePath: dbPath,
    });
  }

  return saver;
}

export async function initializeMemory() {
  const memory = getMemorySaver();
  await memory.setup();
  return memory;
}
