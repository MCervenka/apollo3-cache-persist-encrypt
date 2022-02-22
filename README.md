This library is based on apollo3-cache-persist. It have added option to use encryption during persistance. This solution was taken from apollo-cache-persist-encrypt, but it was renewed for apollo3. There was also added option to encryptByKey (here it is good to write your own persisting function). And to use white list for encryption.

While using encryptByKey, we should rather use own encrypting function, so only necessary changes would be going through encryption and not whole cache on each write. This function is project specific because it depends on our apollo set up. Example of own encrypting function:

```js
import AsyncStorage from '@react-native-community/async-storage';
import * as CryptoJS from 'crypto-js';
import { stringifyQueryVariables } from 'utils/stringifyQueryVariables';

// only queries on the whitelist (as named on graphql server) are going to get encrypted during persisting
export const whiteList = [
  'getPerson',
  'InsuranceCard',
  'getCertificateList',
  'getPdfCertificate',
  'getQrcCertificate',
  'examinations',
  'examinationDetailId',
  'dentalBenefits',
  'dentalBenefitDetail',
  'prescriptions',
];

let asyncStorageData = null;
let asyncDataParsed: any = {};
let writeDebounce: number | null = null;

export const clearAsyncStorage = () => {
  asyncStorageData = null;
  asyncDataParsed = {};
};

//this function should be called once after cache creation and persistor setup
export const persistApolloCache = async (cache: any, signingKey: string) => {
  asyncStorageData = await AsyncStorage.getItem('apollo-cache-persist');
  asyncDataParsed = asyncStorageData ? JSON.parse(asyncStorageData) : {};
  //Here we manipulate apollo function to first do what it used to, and then persisting the data
  // this function is called by Apollo each time when there is something to write to cache

  const write = cache.write;
  cache.write = (...args: any[]) => {
    const result = write.apply(cache, args);

    try {
      args.forEach(el => {
        //cache key is created by joining query name with its variables sorted
        //prescriptions({"first":10,"insuredPersonUid":"1000"})
        const variables = stringifyQueryVariables(el.variables);

        //generally getPerson query is specific because it is used for different subqueries
        //we have type policy to merge getPersons query results, when creating InMemoryCache
        Object.keys(el.result).forEach(key => {
          const cacheKey = `${key}(${variables})`;
          let stringifiedValue = '';
          //financial details uses getPerson query but with more variables- therefore it is stored differently and doesn't need to be extracted
          if (key === 'getPerson' && Object.keys(el.variables).length === 1) {
            const extractedCache = cache.extract()['ROOT_QUERY'];
            stringifiedValue = JSON.stringify(extractedCache[cacheKey]);

            //insurance cards are stored by reference - I guess it is because they are nested list with ID property
            if (el.result[key].insuranceCardsList) {
              el.result[key].insuranceCardsList.forEach(insuranceCard => {
                asyncDataParsed[
                  `InsuranceCard:${insuranceCard.id}`
                ] = CryptoJS.AES.encrypt(
                  JSON.stringify(insuranceCard),
                  signingKey,
                ).toString();
              });
            }
          } else {
            stringifiedValue = JSON.stringify(el.result[key]);
          }
          const encryptedValue = whiteList.includes(key)
            ? CryptoJS.AES.encrypt(stringifiedValue, signingKey).toString()
            : stringifiedValue;
          if (!asyncDataParsed['ROOT_QUERY']) {
            asyncDataParsed['ROOT_QUERY'] = {};
          }
          asyncDataParsed['ROOT_QUERY'][cacheKey] = encryptedValue;
        });
      });

      if (writeDebounce) {
        clearTimeout(writeDebounce);
      }
      const setToAsyncStorage = () =>
        AsyncStorage.setItem(
          'apollo-cache-persist',
          JSON.stringify(asyncDataParsed),
        );
      if (
        args.some(el => Object.keys(el.result).includes('getQrcCertificate'))
      ) {
        setToAsyncStorage();
      } else {
        writeDebounce = setTimeout(() => setToAsyncStorage(), 1500);
      }
    } catch (e) {
      console.log(e);
    }

    return result;
  };
};
```

# apollo3-cache-persist [![npm version](https://badge.fury.io/js/apollo3-cache-persist.svg)](https://badge.fury.io/js/apollo3-cache-persist) [![build status](https://travis-ci.org/apollographql/apollo-cache-persist.svg?branch=master)](https://travis-ci.org/apollographql/apollo-cache-persist) [![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Simple persistence for all Apollo Client 3.0 cache implementations, including
[`InMemoryCache`][0] and [`Hermes`][1].

Supports web and React Native. [See all storage providers.](./docs/storage-providers.md)

[0]: https://github.com/apollographql/apollo-client/tree/master/src/cache/inmemory
[1]: https://github.com/convoyinc/apollo-cache-hermes

- [Basic Usage](#basic-usage)
  - [React Native](#react-native)
  - [Web](#web)
- [Storage Providers](./docs/storage-providers.md)
- [Advanced Usage](./docs/advanced-usage.md)
- [FAQ](./docs/faq.md)
- [Contributing](#contributing)
- [Maintainers](#maintainers)

## Basic Usage

```sh
npm install --save apollo3-cache-persist
```

or

```sh
yarn add apollo3-cache-persist
```

To get started, simply pass your Apollo cache and an
[underlying storage provider](./docs/storage-providers.md) to `persistCache`.

By default, the contents of your Apollo cache will be immediately restored
(asynchronously, see [how to persist data before rendering](./docs/faq.md#how-do-i-wait-for-the-cache-to-be-restored-before-rendering-my-app)), and will be persisted upon every write to the cache (with a
short debounce interval).

### Examples

#### React Native

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InMemoryCache } from '@apollo/client/core';
import { persistCache, AsyncStorageWrapper } from 'apollo3-cache-persist';

const cache = new InMemoryCache({...});

// await before instantiating ApolloClient, else queries might run before the cache is persisted
await persistCache({
  cache,
  storage: new AsyncStorageWrapper(AsyncStorage),
});

// Continue setting up Apollo as usual.

const client = new ApolloClient({
  cache,
  ...
});
```

See a complete example in the [React Native example](./examples/react-native/App.tsx).

#### Web

```js
import { InMemoryCache } from '@apollo/client/core';
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist';

const cache = new InMemoryCache({...});

// await before instantiating ApolloClient, else queries might run before the cache is persisted
await persistCache({
  cache,
  storage: new LocalStorageWrapper(window.localStorage),
});

// Continue setting up Apollo as usual.

const client = new ApolloClient({
  cache,
  ...
});
```

See a complete example in the [web example](./examples/web/src/index.tsx).

## Contributing

Want to make the project better? Awesome! Please read through our [Contributing Guidelines](./CONTRIBUTING.md).

## Maintainers

We all do this for free... so please be nice 😁.

- [@wtrocki](https://github.com/wtrocki)
- [@wodCZ](https://github.com/wodCZ)
- [@jspizziri](https://github.com/jspizziri)
