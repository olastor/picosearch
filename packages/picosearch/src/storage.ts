import type { ParsedOptions, StorageDriver } from './schemas';
import type { Document, IStorageDriver } from './types';

export class LocalStorageDriver implements IStorageDriver {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  get(): Promise<string> {
    return Promise.resolve(localStorage.getItem(this.key) ?? '');
  }

  persist(value: string): Promise<void> {
    localStorage.setItem(this.key, value);
    return Promise.resolve();
  }

  delete(): Promise<void> {
    localStorage.removeItem(this.key);
    return Promise.resolve();
  }
}

export class IndexedDBStorageDriver implements IStorageDriver {
  private dbName: string;
  private storeName: string;
  private key: string;

  constructor(key: string, dbName: string, storeName: string) {
    this.key = key;
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const indexedDB =
        typeof globalThis !== 'undefined'
          ? (globalThis as typeof globalThis & { indexedDB?: IDBFactory })
              .indexedDB
          : undefined;
      if (!indexedDB) {
        reject(new Error('IndexedDB is not available in this environment'));
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(): Promise<string> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const request = store.get(this.key);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ?? '');
      };
    });
  }

  async persist(value: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.put(value, this.key);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.delete(this.key);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// TODO: add more native storage driver like FileSystem

export const getStorageDriver = <T extends Document>(
  opts: ParsedOptions<T>,
): StorageDriver | undefined => {
  const { storageDriver } = opts;
  if (!storageDriver) {
    return undefined;
  }

  switch (storageDriver.type) {
    case 'localstorage':
      return new LocalStorageDriver(storageDriver.key);
    case 'indexeddb':
      return new IndexedDBStorageDriver(
        storageDriver.key,
        storageDriver.dbName,
        storageDriver.storeName,
      );
    case 'custom':
      return storageDriver.driver;
    default:
      throw new Error('Unknown storage driver type.');
  }
};
