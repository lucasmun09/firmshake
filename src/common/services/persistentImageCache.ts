const DB_NAME = 'firmshake-image-cache';
const STORE_NAME = 'images';
const DB_VERSION = 1;
const MAX_ENTRIES = 200;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface CachedImageRecord {
  url: string;
  blob: Blob;
  fetchedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open image cache'));
    });
  }

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Image cache transaction failed'));
      }),
  );
}

async function pruneExpiredAndOverflow(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  await new Promise<void>((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const records = (request.result as CachedImageRecord[]).filter(Boolean);
      const now = Date.now();

      const valid = records.filter((record) => now - record.fetchedAt <= MAX_AGE_MS);
      const expired = records.filter((record) => now - record.fetchedAt > MAX_AGE_MS);

      for (const record of expired) {
        store.delete(record.url);
      }

      if (valid.length > MAX_ENTRIES) {
        const sorted = [...valid].sort((left, right) => left.fetchedAt - right.fetchedAt);
        const toRemove = sorted.slice(0, valid.length - MAX_ENTRIES);
        for (const record of toRemove) {
          store.delete(record.url);
        }
      }

      resolve();
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to prune image cache'));
  });
}

export async function getPersistentImageBlob(url: string): Promise<Blob | null> {
  if (!url || !isIndexedDbAvailable()) {
    return null;
  }

  try {
    const record = await runTransaction<CachedImageRecord | undefined>('readonly', (store) =>
      store.get(url),
    );

    if (!record?.blob) {
      return null;
    }

    if (Date.now() - record.fetchedAt > MAX_AGE_MS) {
      await deletePersistentImage(url);
      return null;
    }

    return record.blob;
  } catch {
    return null;
  }
}

export async function setPersistentImageBlob(url: string, blob: Blob): Promise<void> {
  if (!url || !isIndexedDbAvailable()) {
    return;
  }

  try {
    await runTransaction<IDBValidKey>('readwrite', (store) =>
      store.put({
        url,
        blob,
        fetchedAt: Date.now(),
      } satisfies CachedImageRecord),
    );
    await pruneExpiredAndOverflow();
  } catch {
    // Ignore cache write failures.
  }
}

export async function deletePersistentImage(url: string): Promise<void> {
  if (!url || !isIndexedDbAvailable()) {
    return;
  }

  try {
    await runTransaction<undefined>('readwrite', (store) => store.delete(url));
  } catch {
    // Ignore cache delete failures.
  }
}

export async function clearPersistentImageCache(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  try {
    await runTransaction<undefined>('readwrite', (store) => store.clear());
  } catch {
    // Ignore cache clear failures.
  } finally {
    dbPromise = null;
  }
}
