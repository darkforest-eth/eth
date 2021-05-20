import { BigNumberish } from '@ethersproject/bignumber';
import * as settings from '../../settings';

// This builds a fake HRE-like object used to initialize the test contracts
export const initializers = settings.parse(settings.Initializers, {
  DISABLE_ZK_CHECKS: true,
  PLANETHASH_KEY: 1,
  SPACETYPE_KEY: 2,
  BIOMEBASE_KEY: 3,
  ADMIN_CAN_ADD_PLANETS: true,
  TOKEN_MINT_END_TIMESTAMP: '1937674799',
});

export const validInitPerlin = initializers.INIT_PERLIN_MIN;
export const nebulaPerlin = initializers.PERLIN_THRESHOLD_1 - 1;
export const spacePerlin = initializers.PERLIN_THRESHOLD_1;
export const deepSpacePerlin = initializers.PERLIN_THRESHOLD_2;
export const deadSpacePerlin = initializers.PERLIN_THRESHOLD_3;

export interface TestLocation {
  hex: string; // 64 chat 0-padded hex, not 0x-prefixed
  perlin: BigNumberish;
  distFromOrigin: number;
}

export const asteroid1: TestLocation = {
  // no asteroids
  // lvl0
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b165',
  perlin: validInitPerlin,
  distFromOrigin: 1998,
};

export const asteroid2: TestLocation = {
  // no asteroids
  // lvl0
  hex: '000039be54a58abcff9ef3571afa3f7f2671004d1198fa276b0f9cb54ac9257d',
  perlin: validInitPerlin,
  distFromOrigin: 1998,
};

export const asteroid3: TestLocation = {
  // byte #9 is < 16; popcap doubled
  // lvl0
  hex: '000039be54a58abcff0ef3571afa3f7f2671004d1198fa276b0f9cb54ac9257d',
  perlin: validInitPerlin,
  distFromOrigin: 0,
};

export const deepSpaceAsteroid: TestLocation = {
  // no asteroids, lvl 0
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b177',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const deadSpaceAsteroid: TestLocation = {
  // no asteroids, lvl 0
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b178',
  perlin: deadSpacePerlin,
  distFromOrigin: 1998,
};

export const outOfBoundsLocation: TestLocation = {
  // no comets, lvl 0, out of bounds
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b169',
  perlin: validInitPerlin,
  distFromOrigin: 999999999,
};

export const star1: TestLocation = {
  // no special props
  // lvl1, nebula
  hex: '000057c13def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827d',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

export const star2: TestLocation = {
  // no special props
  // lvl1, space
  hex: '000057c13def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827e',
  perlin: spacePerlin,
  distFromOrigin: 1998,
};

export const star3: TestLocation = {
  // no special props
  // lvl1, deepspace
  hex: '000057c13def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827f',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const star4: TestLocation = {
  // no special props. it's in space
  // lvl2, space
  hex: '000057c10def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a8280',
  perlin: spacePerlin,
  distFromOrigin: 1998,
};

export const star5: TestLocation = {
  // no special props. it's in deepspace
  // lvl2, deepspace
  hex: '000057c10def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a8281',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const star6: TestLocation = {
  // no special props. it's in deepspace
  // lvl2, dead space
  hex: '000057c10def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a8282',
  perlin: deadSpacePerlin,
  distFromOrigin: 1998,
};

export const silverStar1: TestLocation = {
  // byte #8 is 22; produces silver in space
  // lvl1, space
  hex: '000081841ff6c628226b1548838bafd047818ef3e4f76916db6f726c2eebf923',
  perlin: spacePerlin,
  distFromOrigin: 1998,
};

export const silverStar2: TestLocation = {
  // byte #8 is 22; produces silver in space
  // lvl1, space
  hex: '000081841ff6c628226b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: spacePerlin,
  distFromOrigin: 1998,
};

export const nebulaNonSilverStar: TestLocation = {
  // byte #8 is 33_16 = 51_10; would produce silver in deep space but not nebula
  // lvl1
  hex: '000081841ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf925',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

export const silverStar4: TestLocation = {
  // byte #8 is 33_16 = 51_10; produces silver since it's in deep space
  // lvl1
  hex: '000081841ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf926',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const silverStar5: TestLocation = {
  // byte #8 is 22
  // lvl1
  hex: '000081841ff6c628226b1548838bafd047818ef3e4f76916db6f726c2eebf927',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

export const tradingPost1: TestLocation = {
  // lvl3. byte #8 is 20_16 = 32_10
  hex: '0000818402f6c628206b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const tradingPost2: TestLocation = {
  // lvl3. byte #8 is 20_16 = 32_10
  hex: '0000818402f6c628206b1548838bafd047818ef3e4f76916db6f726c2eebf925',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const tradingPost3: TestLocation = {
  // lvl6. byte #8 is 20_16 = 32_10
  hex: '00008184000f0028206b1548838bafd047818ef3e4f76916db6f726c2eebf925',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const silverBank1: TestLocation = {
  // lvl1. byte #8 is 08_16 = 08
  hex: '000081841ff6c628086b1548838bafd047818ef3e4f76916db6f726c2eebf923',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

export const lvl3Location1: TestLocation = {
  // lvl3
  hex: '0000818402f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

export const lvl3Location2: TestLocation = {
  // lvl3
  hex: '0000818402f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eecf924',
  perlin: spacePerlin,
  distFromOrigin: 0,
};

export const lvl3Location3: TestLocation = {
  // lvl3
  hex: '0000818402f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eecf925',
  perlin: deepSpacePerlin,
  distFromOrigin: 0,
};

export const lvl4Location1: TestLocation = {
  // lvl4
  hex: '0000818400f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const lvl4Location2: TestLocation = {
  // lvl4
  hex: '0000818400f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eecf924',
  perlin: nebulaPerlin,
  distFromOrigin: 0,
};

export const maxLvlLocation1: TestLocation = {
  // would be a lvl9, but clipped bc it's in nebula
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf924',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

export const maxLvlLocation2: TestLocation = {
  // would be a lvl9, but clipped bc it's in regular space
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf925',
  perlin: spacePerlin,
  distFromOrigin: 1998,
};

export const maxLvlLocation3: TestLocation = {
  // lvl9
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf926',
  perlin: deepSpacePerlin,
  distFromOrigin: 1998,
};

export const maxLvlLocation4: TestLocation = {
  // lvl9
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf927',
  perlin: deadSpacePerlin,
  distFromOrigin: 1998,
};

export const planetWithArtifact1: TestLocation = {
  // lvl1 ruins. byte #8 is 18_16 = 24_10
  hex: '00007c2512896efb182d462faee6041fb33d58930eb9e6b4fbae6d048e9c44c3',
  perlin: spacePerlin,
  distFromOrigin: 1998,
};

export const adminPlanet: TestLocation = {
  hex: '0000000000000000000000000000000000000000000000000000000000000069',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

// not under difficulty threshold
export const adminPlanetCloaked: TestLocation = {
  hex: '0100000000000000000000000000000000000000000000000000000000000069',
  perlin: nebulaPerlin,
  distFromOrigin: 1998,
};

export const invalidPlanet = {
  hex: '0001115b379a678bf7076778da66355dc814c5c184bc043e87e011c876418b365',
  perlin: validInitPerlin,
  distFromOrigin: 1998,
};

export const SMALL_INTERVAL = 5; // seconds
export const TOLERANCE = 2; // seconds
export const LARGE_INTERVAL = 3 * 86400; // seconds
