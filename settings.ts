import toml from '@iarna/toml';
import chalk from 'chalk';
import { cosmiconfigSync } from 'cosmiconfig';
// HRE stuff
import 'hardhat/types/runtime';
import * as path from 'path';
import resolvePackage from 'resolve-package-path';
import dedent from 'ts-dedent';
import * as yup from 'yup';

declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    DEPLOYER_MNEMONIC: string | undefined;
    ADMIN_PUBLIC_ADDRESS: string | undefined;

    packageDirs: {
      '@darkforest_eth/contracts': string;
      '@darkforest_eth/snarks': string;
    };

    contracts: yup.Asserts<typeof Contracts>;

    initializers: yup.Asserts<typeof Initializers>;

    adminPlanets: yup.Asserts<typeof AdminPlanets>;
  }
}

export const Contracts = yup
  .object({
    /**
     * Network information
     */
    NETWORK: yup.string().required(),
    NETWORK_ID: yup.number().required(),
    START_BLOCK: yup.number().required(),
    /**
     * Library addresses
     */
    UTILS_LIBRARY_ADDRESS: yup.string().required(),
    PLANET_LIBRARY_ADDRESS: yup.string().required(),
    ARTIFACT_UTILS_LIBRARY_ADDRESS: yup.string().required(),
    VERIFIER_LIBRARY_ADDRESS: yup.string().required(),
    INITIALIZE_LIBRARY_ADDRESS: yup.string().required(),
    LAZY_UPDATE_LIBRARY_ADDRESS: yup.string().required(),
    /**
     * Contract addresses
     */
    CORE_CONTRACT_ADDRESS: yup.string().required(),
    TOKENS_CONTRACT_ADDRESS: yup.string().required(),
    GETTERS_CONTRACT_ADDRESS: yup.string().required(),
    WHITELIST_CONTRACT_ADDRESS: yup.string().required(),
    GPT_CREDIT_CONTRACT_ADDRESS: yup.string().required(),
    SCORING_CONTRACT_ADDRESS: yup.string(),
  })
  .defined();

export const Initializers = yup
  .object({
    ADMIN_CAN_ADD_PLANETS: yup.boolean().default(false),
    WORLD_RADIUS_LOCKED: yup.boolean().default(false),
    TOKEN_MINT_END_TIMESTAMP: dateInSeconds().default(oneYearFromNow),
    TARGET4_RADIUS: yup.number().default(800),
    INITIAL_WORLD_RADIUS: yup.number().default(8000),
    /**
     * SNARK keys & Perlin parameters
     */
    DISABLE_ZK_CHECKS: yup.boolean().default(false),
    PLANETHASH_KEY: yup.number().required(),
    SPACETYPE_KEY: yup.number().required(),
    BIOMEBASE_KEY: yup.number().required(),
    PERLIN_MIRROR_X: yup.boolean().default(false),
    PERLIN_MIRROR_Y: yup.boolean().default(false),
    PERLIN_LENGTH_SCALE: yup.number().default(8192), // must be power of two at most 8192
    /**
     * Game configuration
     */
    MAX_NATURAL_PLANET_LEVEL: yup.number().default(256),
    TIME_FACTOR_HUNDREDTHS: yup.number().default(100),
    PERLIN_THRESHOLD_1: yup.number().default(13),
    PERLIN_THRESHOLD_2: yup.number().default(15),
    PERLIN_THRESHOLD_3: yup.number().default(18),
    INIT_PERLIN_MIN: yup.number().default(12),
    INIT_PERLIN_MAX: yup.number().default(13),
    BIOME_THRESHOLD_1: yup.number().default(15),
    BIOME_THRESHOLD_2: yup.number().default(17),
    PLANET_RARITY: yup.number().default(16384),
    PHOTOID_ACTIVATION_DELAY: yup.number().default(60 * 60 * 12),
    SPAWN_RIM_AREA: yup.mixed().default(0),
    LOCATION_REVEAL_COOLDOWN: yup.number().default(60 * 60 * 24),
    CLAIM_PLANET_COOLDOWN: yup.number().default(60 * 60 * 3),
    PLANET_TYPE_WEIGHTS: yup
      .array(yup.array(yup.array(yup.number().min(0).max(255)).length(5)).length(10))
      .length(4)
      .default([
        [
          [1, 0, 0, 0, 0],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
          [13, 2, 0, 0, 1],
        ],
        [
          [1, 0, 0, 0, 0],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
          [12, 2, 1, 0, 1],
        ],
        [
          [1, 0, 0, 0, 0],
          [10, 4, 1, 0, 1],
          [10, 4, 1, 0, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
        ],
        [
          [1, 0, 0, 0, 0],
          [10, 4, 1, 0, 1],
          [10, 4, 1, 0, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
          [8, 4, 1, 2, 1],
        ],
      ]),
    ARTIFACT_POINT_VALUES: yup
      .array()
      .length(6)
      .default([0, 2000, 10000, 200000, 3000000, 20000000]),
    ROUND_NAME: yup.string().required(),
    ROUND_END: dateInSeconds().required(),
  })
  .defined();

const AdminPlanet = yup
  .object({
    x: yup.number().required(),
    y: yup.number().required(),
    level: yup.number().required(),
    planetType: yup.number().required(),
    requireValidLocationId: yup.boolean().required(),
    revealLocation: yup.boolean().required(),
  })
  .defined();

export const AdminPlanets = yup.array(AdminPlanet).defined();

// Util for parsing & validating schemas with pretty printing
export function parse<S extends yup.BaseSchema>(schema: S, data: unknown): yup.Asserts<S> {
  try {
    return schema.validateSync(data, { abortEarly: false });
  } catch (err) {
    if (err instanceof Error) {
      const error = err as yup.ValidationError;
      printValidationErrors(error);
    } else {
      console.log(err);
    }
    process.exit(1);
  }
}

// A function that iterates over a Hardhat `lazyObject` to force them to be loaded.
//
// This is needed because some of our Yup Schemas have `.required()` properties but aren't
// immediately validated due to `lazyObject`.
export function required<S extends { [key: string]: unknown }>(schema: S, keys: Array<keyof S>) {
  const header = '* Required keys/values:';
  const messages = keys.map((key, idx) => {
    if (typeof key === 'string' || typeof key === 'number') {
      return `* ${idx + 1}. ${key}: ${schema[key]}`;
    } else {
      console.error(chalk.red('Invalid key'), key);
      process.exit(1);
    }
  });

  const longest = messages.reduce((max, msg) => Math.max(msg.length, max), header.length);
  const stars = '*'.repeat(longest);

  const msg = dedent`
    ${stars}
    ${header}
    *
    ${messages.join('\n')}
    ${stars}
  `;

  // We pretty much just log them so we have something to do with them.
  console.log(chalk.green(msg));
}

function printValidationErrors(err: yup.ValidationError) {
  const header = '* Encountered configuration errors:';
  const messages = err.errors.map((msg: string, idx: number) => `* ${idx + 1}. ${msg}`);

  const longest = messages.reduce((max, msg) => Math.max(msg.length, max), header.length);
  const stars = '*'.repeat(longest);

  const msg = dedent`
    ${stars}
    ${header}
    *
    ${messages.join('\n')}
    ${stars}
  `;

  console.error(chalk.red(msg));
}

// Resolve workspace package directories
export function resolvePackageDir(pkg: string) {
  const contractsPkg = resolvePackage(pkg, __dirname);
  if (!contractsPkg) {
    throw new Error(`Unable to find the ${pkg} package. Exiting...`);
  }
  return path.dirname(contractsPkg);
}

function tomlLoader(filename: string, content: string) {
  try {
    return toml.parse(content);
  } catch (err) {
    console.error(chalk.red(`Error parsing ${path.basename(filename)}`));
    if (err instanceof Error) {
      console.error(chalk.yellow(err.message));
    }

    process.exit(1);
  }
}

const explorers: { [key: string]: ReturnType<typeof cosmiconfigSync> } = {};

export function load(network: string): { [key: string]: unknown } {
  let explorer = explorers[network];
  if (!explorer) {
    // Config file loading stuff, cache it based on network key
    explorer = explorers[network] = cosmiconfigSync('darkforest', {
      cache: true,
      searchPlaces: [`darkforest.${network}.toml`, 'darkforest.toml'],
      loaders: {
        '.toml': tomlLoader,
      },
    });
  }
  const result = explorer.search();
  if (result) {
    return result.config;
  } else {
    console.warn(chalk.yellow('Could not find `darkforest.toml` - using defaults.'));
    return {};
  }
}

// Util for generating a number representing seconds timestamp from input datetime
function dateInSeconds() {
  return yup.number().transform(function (value, originalValue) {
    if (this.isType(value)) return value;

    return Math.floor(new Date(originalValue).getTime() / 1000);
  });
}

// Generates the Default for TOKEN_MINT_END_TIMESTAMP
function oneYearFromNow() {
  const oneYear = 60 * 60 * 24 * 365 * 1000;
  // The default doesn't get passed through the transform so we still need to divide by 1000
  return Math.floor((Date.now() + oneYear) / 1000);
}
