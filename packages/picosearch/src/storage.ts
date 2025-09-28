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

export class FileStorageDriver implements IStorageDriver {
  private fileName: string;
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  constructor(fileName: string) {
    this.fileName = fileName;
  }

  private async getDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
    if (this.directoryHandle) {
      return this.directoryHandle;
    }

    // Check if File System Access API is available
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not available in this environment');
    }

    try {
      const directoryHandle = await (window as any).showDirectoryPicker();
      this.directoryHandle = directoryHandle;
      return directoryHandle;
    } catch (error) {
      throw new Error(`Failed to access directory: ${error}`);
    }
  }

  private async getFileHandle(create: boolean = false): Promise<FileSystemFileHandle> {
    const directoryHandle = await this.getDirectoryHandle();
    
    try {
      return await directoryHandle.getFileHandle(this.fileName, { create });
    } catch (error) {
      if (!create && error instanceof DOMException && error.name === 'NotFoundError') {
        // File doesn't exist, return empty content
        throw error;
      }
      throw new Error(`Failed to access file ${this.fileName}: ${error}`);
    }
  }

  async get(): Promise<string> {
    try {
      const fileHandle = await this.getFileHandle(false);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        // File doesn't exist, return empty string
        return '';
      }
      throw error;
    }
  }

  async persist(value: string): Promise<void> {
    try {
      const fileHandle = await this.getFileHandle(true);
      const writable = await fileHandle.createWritable();
      await writable.write(value);
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to persist data to file ${this.fileName}: ${error}`);
    }
  }

  async delete(): Promise<void> {
    try {
      const directoryHandle = await this.getDirectoryHandle();
      await directoryHandle.removeEntry(this.fileName);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        // File doesn't exist, nothing to delete
        return;
      }
      throw new Error(`Failed to delete file ${this.fileName}: ${error}`);
    }
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
    case 'filesystem':
      return new FileStorageDriver(storageDriver.fileName);
    case 'custom':
      return storageDriver.driver;
    default:
      throw new Error('Unknown storage driver type.');
  }
};
