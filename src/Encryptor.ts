import { PersistedData, EncryptOptions, OnEncryptionError } from './types';
import * as CryptoJS from 'crypto-js';
import { CachePersistor } from '.';

export default class Encryptor<T> {
  _onError?: OnEncryptionError<T>;
  secretKey: string;
  persistor: CachePersistor<T>;
  encryptByKey: boolean;
  whiteList?: string[];

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
    this.whiteList = options.whiteList;
  }

  encrypt(data: PersistedData<T>): PersistedData<T> {
    if (!this.encryptByKey) {
      return CryptoJS.AES.encrypt(data as string, this.secretKey).toString();
    }
    const parsedCache = JSON.parse(data as string);
    const parsedData = parsedCache['ROOT_QUERY'];
    const result: { [key: string]: any } = { ROOT_QUERY: {} };
    Object.keys(parsedData).forEach(el => {
      if (!this.whiteList || this.whiteList?.some((value) => el.includes(value))) {
        result['ROOT_QUERY'][el] = CryptoJS.AES.encrypt(
          JSON.stringify(parsedData[el]),
          this.secretKey,
        ).toString();
      } else {
        result['ROOT_QUERY'][el] = JSON.stringify(parsedData[el]);
      }
        
    });
    Object.keys(parsedCache).forEach(el => {
      if (el !== 'ROOT_QUERY') {
        if (!this.whiteList || this.whiteList?.some((value) => el.includes(value))) {
        result[el] = CryptoJS.AES.encrypt(
          JSON.stringify(parsedCache[el]),
          this.secretKey,
        ).toString();
        } else {
          result[el] = JSON.stringify(parsedCache[el]);
        }
      }
    });

    return JSON.stringify(result);
  }

  decrypt(data: PersistedData<T>): PersistedData<T> {
    if (!this.encryptByKey) {
      const bytes = CryptoJS.AES.decrypt(data as string, this.secretKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    }
    const result: { [key: string]: any } = { ROOT_QUERY: {} };
    const parsedCache = JSON.parse(data as string);
    const parsedData = parsedCache['ROOT_QUERY'];
    Object.keys(parsedData).forEach(el => {
      try {
        if (!this.whiteList || this.whiteList?.some((value) => el.includes(value))) {
        const bytes = CryptoJS.AES.decrypt(parsedData[el], this.secretKey);
        result['ROOT_QUERY'][el] = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } else {
          result['ROOT_QUERY'][el] = JSON.parse(parsedData[el]);
        }
      } catch (e) {
        console.log('decrypting err', el, e);
      }
      
    });
    Object.keys(parsedCache).forEach(el => {
      if (el !== 'ROOT_QUERY') {
        try {
           if (!this.whiteList || this.whiteList?.some((value) => el.includes(value))) {
            const bytes = CryptoJS.AES.decrypt(parsedCache[el], this.secretKey);
            result[el] = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
          } else {
            result[el] = JSON.parse(parsedCache[el])
          }
        } catch (e) {
          console.log('parsedCache other keys',el,  e);
        }
      }
    });
    return JSON.stringify(result);
  }

  onError(error: Error): void {
    this._onError(error, this.persistor);
  }
}
