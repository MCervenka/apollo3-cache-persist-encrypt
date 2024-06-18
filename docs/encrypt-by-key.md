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
