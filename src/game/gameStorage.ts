/**
 * Game Storage Module
 * Persists completed games to IndexedDB for later review.
 */
import type { MoveHistoryEntry } from './types.js';

export interface SavedGame {
  id: string;
  date: string;
  type: 'engine' | 'online' | 'local';
  white: string;
  black: string;
  result: string;
  moves: MoveHistoryEntry[];
  moveCount: number;
}

const DB_NAME = 'klikschaak';
const DB_VERSION = 1;
const STORE_NAME = 'games';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGame(game: SavedGame): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(game);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getGames(): Promise<SavedGame[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('date');
    const request = index.getAll();
    request.onsuccess = () => {
      db.close();
      // Return newest first
      resolve((request.result as SavedGame[]).reverse());
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteGame(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
