import Log from './Log';
import Storage from './Storage';
import Cache from './Cache';
import Encryptor from './Encryptor';

import { ApolloPersistOptions, PersistenceMapperFunction } from './types';

export interface PersistorConfig<T> {
  log: Log<T>;
  cache: Cache<T>;
  storage: Storage<T>;
  encryptor?: Encryptor<T>;
}

export default class Persistor<T> {
  log: Log<T>;
  cache: Cache<T>;
  storage: Storage<T>;
  encryptor?: Encryptor<T>;
  maxSize?: number;
  paused: boolean;
  persistenceMapper?: PersistenceMapperFunction;

  constructor(
    { log, cache, storage, encryptor }: PersistorConfig<T>,
    options: ApolloPersistOptions<T>,
  ) {
    const { maxSize = 1024 * 1024, persistenceMapper } = options;

    this.log = log;
    this.cache = cache;
    this.storage = storage;
    this.paused = false;

    if (persistenceMapper) {
      this.persistenceMapper = persistenceMapper;
    }

    if (maxSize) {
      this.maxSize = maxSize;
    }
    if (encryptor) {
      this.encryptor = encryptor;
    }
  }

  async persist(): Promise<void> {
    try {
      let data = this.cache.extract();

      if (!this.paused && this.persistenceMapper) {
        data = await this.persistenceMapper(data);
      }

      if (
        this.maxSize != null &&
        typeof data === 'string' &&
        data.length > this.maxSize &&
        !this.paused
      ) {
        await this.purge();
        this.paused = true;
        return;
      }

      if (this.paused) {
        return;
      }
      const encryptedData = this.encryptor
        ? this.encryptor.encrypt(data)
        : data;

      await this.storage.write(encryptedData);

      this.log.info(
        typeof data === 'string'
          ? `Persisted cache of size ${data.length} characters`
          : 'Persisted cache',
      );
    } catch (error) {
      this.log.error('Error persisting cache', error);
      throw error;
    }
  }

  async restore(): Promise<void> {
    try {
      const data = await this.storage.read();

      if (data != null) {
        try {
          const decryptedData = this.encryptor
            ? this.encryptor.decrypt(data)
            : data;

          await this.cache.restore(decryptedData);
        } catch (error) {
          if (this.encryptor.onError) {
            this.encryptor.onError(error);
            return;
          }

          throw error;
        }

        this.log.info(
          typeof data === 'string'
            ? `Restored cache of size ${data.length} characters`
            : 'Restored cache',
        );
      } else {
        this.log.info('No stored cache to restore');
      }
    } catch (error) {
      this.log.error('Error restoring cache', error);
      throw error;
    }
  }

  async purge(): Promise<void> {
    try {
      await this.storage.purge();
      this.log.info('Purged cache storage');
    } catch (error) {
      this.log.error('Error purging cache storage', error);
      throw error;
    }
  }
}
