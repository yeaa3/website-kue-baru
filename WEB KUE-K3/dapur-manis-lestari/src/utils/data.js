import { DATA_URL } from './paths.js';

const cache = new Map();

/** Memuat berkas JSON dari src/data (hasilnya di-cache). */
export async function loadData(name) {
  if (!cache.has(name)) {
    const response = await fetch(`${DATA_URL}${name}.json`);
    if (!response.ok) throw new Error(`Gagal memuat data "${name}" (${response.status})`);
    cache.set(name, await response.json());
  }
  return cache.get(name);
}
