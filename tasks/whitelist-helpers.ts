// todo dedup with whitelist server
import _ from 'lodash';

// the gas per tx can only do so many at a time
export const keysPerTx = 400;

export const KEY_SYMBOLS: string[] = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const KEY_PART_LEN = 5;
export const KEY_PARTS = 5;
export const generateKey = (): string => {
  const makePart = () =>
    _.join(
      _.times(KEY_PART_LEN, () => _.sample(KEY_SYMBOLS)),
      ''
    );
  const key = _.join(_.times(KEY_PARTS, makePart), '-');
  return key;
};

export const generateKeys = (count: number): string[] => _.range(count).map((_) => generateKey());
