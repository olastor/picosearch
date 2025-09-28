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

// Extend global interface to include File System Access API types
declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
  
  var showSaveFilePicker: ((options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>) | undefined;
  var showOpenFilePicker: ((options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>) | undefined;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

export class FileStorageDriver implements IStorageDriver {
  private filename: string;
  private fileHandle: FileSystemFileHandle | null = null;

  constructor(filename: string) {
    this.filename = filename;
  }

  private async ensureFileHandle(): Promise<FileSystemFileHandle> {
    if (this.fileHandle) {
      return this.fileHandle;
    }

    // Check if File System Access API is available
    if (typeof globalThis === 'undefined' || !globalThis.showSaveFilePicker) {
      throw new Error('File System Access API is not available in this environment');
    }

    // If no stored handle, we'll create the file on first persist
    return this.requestFileAccess();
  }

  private async requestFileAccess(): Promise<FileSystemFileHandle> {
    try {
      // Check if the API is available
      const showSaveFilePicker = globalThis.showSaveFilePicker;
      if (!showSaveFilePicker) {
        throw new Error('File System Access API is not supported');
      }

      // Request file access from user
      const fileHandle = await showSaveFilePicker({
        suggestedName: this.filename,
        types: [{
          description: 'JSON files',
          accept: {
            'application/json': ['.json'],
          },
        }],
      });
      
      this.fileHandle = fileHandle;
      return fileHandle;
    } catch (error) {
      throw new Error('User cancelled file access or File System Access API not supported');
    }
  }

  async get(): Promise<string> {
    try {
      const fileHandle = await this.ensureFileHandle();
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return '';
      }
      // Return empty string if file doesn't exist or can't be read
      return '';
    }
  }

  async persist(value: string): Promise<void> {
    try {
      if (!this.fileHandle) {
        this.fileHandle = await this.requestFileAccess();
      }

      const writable = await this.fileHandle.createWritable();
      await writable.write(value);
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to persist data to file: ${error}`);
    }
  }

  async delete(): Promise<void> {
    try {
      if (!this.fileHandle) {
        return; // Nothing to delete
      }

      const writable = await this.fileHandle.createWritable();
      await writable.write('');
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to delete file content: ${error}`);
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
      return new FileStorageDriver(storageDriver.filename);
    case 'custom':
      return storageDriver.driver;
    default:
      throw new Error('Unknown storage driver type.');
  }
};
