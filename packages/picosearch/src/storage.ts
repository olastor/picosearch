import { DEFAULT_STORAGE_DRIVER_KEY } from './constants';
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

// TODO: add more native storage driver like IndexedDB, FileSystem

export const getStorageDriver = <T extends Document>(
  opts: ParsedOptions<T>,
): StorageDriver | undefined => {
  const { storageDriver } = opts;
  if (!storageDriver) {
    return undefined;
  }

  if (typeof storageDriver === 'string') {
    switch (storageDriver) {
      case 'localstorage':
        return new LocalStorageDriver(DEFAULT_STORAGE_DRIVER_KEY);
      default:
        throw new Error(`Unknown storage driver: ${storageDriver}`);
    }
  }

  switch (storageDriver.type) {
    case 'localstorage':
      return new LocalStorageDriver(storageDriver.key);
    case 'custom':
      return storageDriver.driver;
    default:
      throw new Error('Unknown storage driver type.');
  }
};
