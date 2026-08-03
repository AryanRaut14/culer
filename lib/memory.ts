import { MemorySaver } from '@langchain/langgraph';

let saver: MemorySaver | null = null;

export function getMemorySaver() {
  if (!saver) {
    saver = new MemorySaver();
  }

  return saver;
}

export async function initializeMemory() {
  return getMemorySaver();
}
