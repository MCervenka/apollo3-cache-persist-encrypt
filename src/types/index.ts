import { ApolloCache } from '@apollo/client/core';
import { CachePersistor } from '..';

export type LogLevel = 'log' | 'warn' | 'error';

export type LogLine = [LogLevel, any[]];

export type TriggerUninstallFunction = () => void;

export type TriggerFunction = (persist: () => void) => TriggerUninstallFunction;

export type PersistenceMapperFunction = (data: any) => Promise<any>;

export type PersistedData<T> = T | string | null;

export interface PersistentStorage<T> {
  getItem: (key: string) => Promise<T | null> | T | null;
  setItem: (key: string, value: T) => Promise<T> | Promise<void> | void | T;
  removeItem: (key: string) => Promise<T> | Promise<void> | void;
}
export type OnEncryptionError<T> = (
  error: Error,
  persistor: CachePersistor<T>,
) => void;

export interface EncryptOptions<T> {
  onError?: OnEncryptionError<T>;
  /**
   * if the queries should be encrypted by query name, otherwise whole cache is going to encrypted at once
   */
  encryptByKey?: boolean;
  secretKey: string;
  /**
   *  only queries on the whitelist (as named on graphql server) are going to get encrypted during persisting
   *  if this field is empty then all queries are going to be encrypted. encryptByKey needs to be true
   */
  whiteList?: string[];
}
type StorageType<T, TSerialize extends boolean> = TSerialize extends true
  ? PersistentStorage<string>
  : PersistentStorage<T>;

export interface ApolloPersistOptions<
  TSerialized,
  TSerialize extends boolean = true
> {
  cache: ApolloCache<TSerialized>;
  storage: StorageType<PersistedData<TSerialized>, TSerialize>;
  trigger?: 'write' | 'background' | TriggerFunction | false;
  debounce?: number;
  key?: string;
  serialize?: TSerialize;
  maxSize?: number | false;
  persistenceMapper?: PersistenceMapperFunction;
  debug?: boolean;
  encrypt?: EncryptOptions<TSerialized>;
}
