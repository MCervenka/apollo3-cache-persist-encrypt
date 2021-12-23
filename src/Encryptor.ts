import { PersistedData, EncryptOptions, OnEncryptionError } from './types';
import * as CryptoJS from 'crypto-js';
import { CachePersistor } from '.';

export default class Encryptor<T> {
  _onError?: OnEncryptionError<T>;
  secretKey: string;
  persistor: CachePersistor<T>;
  encryptByKey: boolean;

  constructor(persistor: CachePersistor<T>, options: EncryptOptions<T>) {
    if (!options.secretKey) {
      throw new Error(
        'In order to encrypt your Apollo Cache, you need to pass in a secretKey. ',
      );
    }

    this._onError = options.onError;
    this.secretKey = options.secretKey;
    this.persistor = persistor;
    this.encryptByKey = !!options.encryptByKey;
  }

  encrypt(data: PersistedData<T>): PersistedData<T> {
    if (!this.encryptByKey) {
      return CryptoJS.AES.encrypt(data as string, this.secretKey).toString();
    }
    const parsedData = JSON.parse(data as string)['ROOT_QUERY'];
    const result: { [key: string]: string } = {};
    Object.keys(parsedData).forEach(el => {
      result[el] = CryptoJS.AES.encrypt(
        JSON.stringify(parsedData[el]),
        this.secretKey,
      ).toString();
    });
    return JSON.stringify({ ROOT_QUERY: result });
  }

  decrypt(data: PersistedData<T>): PersistedData<T> {
    if (!this.encryptByKey) {
      const bytes = CryptoJS.AES.decrypt(data as string, this.secretKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    }
    const result: { [key: string]: string } = {};
    const parsedData = JSON.parse(data as string)['ROOT_QUERY'];
    Object.keys(parsedData).forEach(el => {
      const bytes = CryptoJS.AES.decrypt(parsedData[el], this.secretKey);
      result[el] = bytes.toString(CryptoJS.enc.Utf8);
    });
    return JSON.stringify({ ROOT_QUERY: result });
  }

  onError(error: Error): void {
    this._onError(error, this.persistor);
  }
}
