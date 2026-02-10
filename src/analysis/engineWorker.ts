/**
 * Web Worker for WASM chess engine.
 * Runs engine computations off the main thread.
 */

import init, { wasm_eval, wasm_get_moves } from '../wasm/engine/klikschaak_engine.js';

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, fen, depth } = e.data;

  try {
    await ensureInit();

    let result: string;
    if (type === 'eval') {
      result = wasm_eval(fen, depth ?? 4);
    } else if (type === 'moves') {
      result = wasm_get_moves(fen);
    } else {
      self.postMessage({ id, error: `Unknown message type: ${type}` });
      return;
    }

    self.postMessage({ id, result: JSON.parse(result) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};

// Signal that the worker is ready
ensureInit().then(() => {
  self.postMessage({ type: 'ready' });
}).catch((err) => {
  self.postMessage({ type: 'error', error: String(err) });
});
