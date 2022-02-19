import { decodeInitializers } from '@darkforest_eth/settings';
import * as settings from '../../settings';
import { TestLocation } from './TestLocation';

const defaultInitializerValues = {
  DISABLE_ZK_CHECKS: true,
  PLANETHASH_KEY: 1,
  SPACETYPE_KEY: 2,
  BIOMEBASE_KEY: 3,
  ADMIN_CAN_ADD_PLANETS: true,
  TOKEN_MINT_END_TIMESTAMP: '3031-05-27T18:59:59.000Z',
  WORLD_RADIUS_LOCKED: true,
  WORLD_RADIUS_MIN: 304514,
  SPAWN_RIM_AREA: 7234560000,
};

// This builds a fake HRE-like object used to initialize the test contracts
export const initializers = settings.parse(decodeInitializers, defaultInitializerValues);

// This builds a fake HRE-like object used to initialize the test contracts
export const noPlanetTransferInitializers = settings.parse(decodeInitializers, {
  ...defaultInitializerValues,
  PLANET_TRANSFER_ENABLED: false,
});

// This builds a fake HRE-like object used to initialize the test contracts
export const target4Initializers = settings.parse(decodeInitializers, {
  DISABLE_ZK_CHECKS: true,
  PLANETHASH_KEY: 1,
  SPACETYPE_KEY: 2,
  BIOMEBASE_KEY: 3,
  TOKEN_MINT_END_TIMESTAMP: '3031-05-27T18:59:59.000Z',
  WORLD_RADIUS_MIN: 1,
  SPAWN_RIM_AREA: 7234560000,
});

export const VALID_INIT_PERLIN = initializers.INIT_PERLIN_MIN;
export const NEBULA_PERLIN = initializers.PERLIN_THRESHOLD_1 - 1;
export const SPACE_PERLIN = initializers.PERLIN_THRESHOLD_1;
export const DEEP_SPACE_PERLIN = initializers.PERLIN_THRESHOLD_2;
export const DEAD_SPACE_PERLIN = initializers.PERLIN_THRESHOLD_3;

export const INVALID_TOO_CLOSE_SPAWN = initializers.WORLD_RADIUS_MIN - 100000;
export const INVALID_TOO_FAR_SPAWN = initializers.WORLD_RADIUS_MIN + 100000;

export const SPAWN_PLANET_1 = new TestLocation({
  // no asteroids
  // lvl0
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b165',
  perlin: VALID_INIT_PERLIN,
  distFromOrigin: 1998,
});

export const SPAWN_PLANET_2 = new TestLocation({
  // no asteroids
  // lvl0
  hex: '000039be54a58abcff9ef3571afa3f7f2671004d1198fa276b0f9cb54ac9257d',
  perlin: VALID_INIT_PERLIN,
  distFromOrigin: 1998,
});

export const LVL0_PLANET_POPCAP_BOOSTED = new TestLocation({
  // byte #9 is < 16; popcap doubled
  // lvl0
  hex: '000039be54a58abcff0ef3571afa3f7f2671004d1198fa276b0f9cb54ac9257d',
  perlin: VALID_INIT_PERLIN,
  distFromOrigin: 0,
});

export const LVL0_PLANET = new TestLocation({
  // no asteroids
  // lvl0
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b166',
  perlin: VALID_INIT_PERLIN,
  distFromOrigin: 1998,
});

export const LVL0_PLANET_DEEP_SPACE = new TestLocation({
  // no asteroids, lvl 0
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b177',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL0_PLANET_DEAD_SPACE = new TestLocation({
  // no asteroids, lvl 0
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b178',
  perlin: DEAD_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL0_PLANET_OUT_OF_BOUNDS = new TestLocation({
  // no comets, lvl 0, out of bounds
  hex: '000005b379a628bbff76773da66355dc814f5c184bc033e87e011c876418b169',
  perlin: VALID_INIT_PERLIN,
  distFromOrigin: 999999999,
});

export const LVL1_PLANET_NEBULA = new TestLocation({
  // no special props
  // lvl1, nebula
  hex: '000057c13def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827d',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_PLANET_SPACE = new TestLocation({
  // no special props
  // lvl1, space
  hex: '000057c13def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827e',
  perlin: SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_PLANET_DEEP_SPACE = new TestLocation({
  // no special props
  // lvl1, deepspace
  hex: '000057c13def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827f',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL2_PLANET_SPACE = new TestLocation({
  // no special props. it's in space
  // lvl2, space
  hex: '000057c10def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a8280',
  perlin: SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL2_PLANET_DEEP_SPACE = new TestLocation({
  // no special props. it's in deepspace
  // lvl2, deepspace
  hex: '000057c10def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a8281',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL2_PLANET_DEAD_SPACE = new TestLocation({
  // no special props. it's in deepspace
  // lvl2, dead space
  hex: '000057c10def522bffa2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a8282',
  perlin: DEAD_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_ASTEROID_1 = new TestLocation({
  // byte #8 is 22; produces silver in space
  // lvl1, space
  hex: '000081841ff6c628226b1548838bafd047818ef3e4f76916db6f726c2eebf923',
  perlin: SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_ASTEROID_2 = new TestLocation({
  // byte #8 is 22; produces silver in space
  // lvl1, space
  hex: '000081841ff6c628226b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_ASTEROID_NO_PRODUCE = new TestLocation({
  // byte #8 is 33_16 = 51_10; would produce silver in deep space but not nebula
  // lvl1
  hex: '000081841ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf925',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_ASTEROID_DEEP_SPACE = new TestLocation({
  // byte #8 is 33_16 = 51_10; produces silver since it's in deep space
  // lvl1
  hex: '000081841ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf926',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_ASTEROID_NEBULA = new TestLocation({
  // byte #8 is 22
  // lvl1
  hex: '000081841ff6c628226b1548838bafd047818ef3e4f76916db6f726c2eebf927',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

export const LVL3_SPACETIME_1 = new TestLocation({
  // lvl3. byte #8 is 20_16 = 32_10
  hex: '0000818402f6c628206b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL3_SPACETIME_2 = new TestLocation({
  // lvl3. byte #8 is 20_16 = 32_10
  hex: '0000818402f6c628206b1548838bafd047818ef3e4f76916db6f726c2eebf925',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL6_SPACETIME = new TestLocation({
  // lvl6. byte #8 is 20_16 = 32_10
  hex: '00008184000f0028206b1548838bafd047818ef3e4f76916db6f726c2eebf925',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL3_SPACETIME_3 = new TestLocation({
  // lvl3. byte #8 is 20_16 = 32_10
  hex: '0000818402f6c628206b1548838bafd047818ef3e4f76916db6f726c2eebf926',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL1_QUASAR = new TestLocation({
  // lvl1. byte #8 is 08_16 = 08
  hex: '000081841ff6c628086b1548838bafd047818ef3e4f76916db6f726c2eebf923',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

export const LVL3_UNOWNED_NEBULA = new TestLocation({
  // lvl3
  hex: '0000818402f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

export const LVL3_UNOWNED_SPACE = new TestLocation({
  // lvl3
  hex: '0000818402f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eecf924',
  perlin: SPACE_PERLIN,
  distFromOrigin: 0,
});

export const LVL3_UNOWNED_DEEP_SPACE = new TestLocation({
  // lvl3
  hex: '0000818402f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eecf925',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 0,
});

export const LVL4_UNOWNED_DEEP_SPACE = new TestLocation({
  // lvl4
  hex: '0000818400f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eebf924',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const LVL4_UNOWNED_NEBULA = new TestLocation({
  // lvl4
  hex: '0000818400f6c628ff6b1548838bafd047818ef3e4f76916db6f726c2eecf924',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 0,
});

export const MAX_PLANET_NEBULA = new TestLocation({
  // would be a lvl9, but clipped bc it's in nebula
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf924',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

export const MAX_PLANET_SPACE = new TestLocation({
  // would be a lvl9, but clipped bc it's in regular space
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf925',
  perlin: SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const MAX_PLANET_DEEP_SPACE = new TestLocation({
  // lvl9
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf926',
  perlin: DEEP_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const MAX_PLANET_DEAD_SPACE = new TestLocation({
  // lvl9
  hex: '0000818400000028ff6b1548838bafd047818ef3e4f76916db6f726c2eecf927',
  perlin: DEAD_SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const ARTIFACT_PLANET_1 = new TestLocation({
  // lvl1 ruins. byte #8 is 18_16 = 24_10
  hex: '00007c2512896efb182d462faee6041fb33d58930eb9e6b4fbae6d048e9c44c3',
  perlin: SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const ARTIFACT_PLANET_2 = new TestLocation({
  // lvl1 ruins. byte #8 is 18_16 = 24_10
  hex: '00007c2512896efb182d462faee6041fb33d58930eb9e6b4fbae6d048e9c44c4',
  perlin: SPACE_PERLIN,
  distFromOrigin: 1998,
});

export const ADMIN_PLANET = new TestLocation({
  hex: '0000000000000000000000000000000000000000000000000000000000000069',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

// not under difficulty threshold
export const ADMIN_PLANET_CLOAKED = new TestLocation({
  hex: '0100000000000000000000000000000000000000000000000000000000000069',
  perlin: NEBULA_PERLIN,
  distFromOrigin: 1998,
});

export const INVALID_PLANET = new TestLocation({
  hex: '0001115b379a678bf7076778da66355dc814c5c184bc043e87e011c876418b365',
  perlin: VALID_INIT_PERLIN,
  distFromOrigin: 1998,
});

export const SMALL_INTERVAL = 5; // seconds
export const TOLERANCE = 2; // seconds
export const LARGE_INTERVAL = 3 * 86400; // seconds
