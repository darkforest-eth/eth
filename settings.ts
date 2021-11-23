import toml from '@iarna/toml';
import chalk from 'chalk';
import { cosmiconfigSync } from 'cosmiconfig';
import * as decoders from 'decoders';
// HRE stuff
import 'hardhat/types/runtime';
import * as path from 'path';
import resolvePackage from 'resolve-package-path';
import dedent from 'ts-dedent';

declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    DEPLOYER_MNEMONIC: string | undefined;
    ADMIN_PUBLIC_ADDRESS: string | undefined;

    packageDirs: {
      '@darkforest_eth/contracts': string;
      '@darkforest_eth/snarks': string;
    };

    contracts: ReturnType<typeof Contracts>;

    initializers: ReturnType<typeof Initializers>;

    adminPlanets: ReturnType<typeof AdminPlanets>;
  }
}

export const Contracts = decoders.guard(
  decoders.exact({
    /**
     * Network information
     */
    NETWORK: decoders.string,
    NETWORK_ID: decoders.number,
    START_BLOCK: decoders.number,
    /**
     * Library addresses
     */
    UTILS_LIBRARY_ADDRESS: decoders.string,
    PLANET_LIBRARY_ADDRESS: decoders.string,
    ARTIFACT_UTILS_LIBRARY_ADDRESS: decoders.string,
    VERIFIER_LIBRARY_ADDRESS: decoders.string,
    INITIALIZE_LIBRARY_ADDRESS: decoders.string,
    LAZY_UPDATE_LIBRARY_ADDRESS: decoders.string,
    /**
     * Contract addresses
     */
    CORE_CONTRACT_ADDRESS: decoders.string,
    TOKENS_CONTRACT_ADDRESS: decoders.string,
    GETTERS_CONTRACT_ADDRESS: decoders.string,
    WHITELIST_CONTRACT_ADDRESS: decoders.string,
  }),
  { style: 'simple' }
);

type PlanetTypeWeights = ExactArray4<ExactArray10<ExactArray5<number>>>;

// Handle Date or ISO8601 strings because the TOML parser converts to Date already
const dateInSeconds = decoders.map(decoders.either(decoders.date, decoders.iso8601), (val) =>
  Math.floor(val.getTime() / 1000)
);

export const Initializers = decoders.guard(
  decoders.exact({
    ADMIN_CAN_ADD_PLANETS: withDefault(decoders.boolean, false),
    WORLD_RADIUS_LOCKED: withDefault(decoders.boolean, false),
    TOKEN_MINT_END_TIMESTAMP: withDefault(dateInSeconds, oneYearFromNow()),
    TARGET4_RADIUS: withDefault(decoders.number, 800),
    INITIAL_WORLD_RADIUS: withDefault(decoders.number, 8000),
    /**
     * SNARK keys & Perlin parameters
     */
    DISABLE_ZK_CHECKS: withDefault(decoders.boolean, false),
    PLANETHASH_KEY: decoders.number,
    SPACETYPE_KEY: decoders.number,
    BIOMEBASE_KEY: decoders.number,
    PERLIN_MIRROR_X: withDefault(decoders.boolean, false),
    PERLIN_MIRROR_Y: withDefault(decoders.boolean, false),
    PERLIN_LENGTH_SCALE: withDefault(decoders.number, 8192), // must be power of two at most 8192
    /**
     * Game configuration
     */
    MAX_NATURAL_PLANET_LEVEL: withDefault(decoders.number, 256),
    TIME_FACTOR_HUNDREDTHS: withDefault(decoders.number, 100),
    PERLIN_THRESHOLD_1: withDefault(decoders.number, 13),
    PERLIN_THRESHOLD_2: withDefault(decoders.number, 15),
    PERLIN_THRESHOLD_3: withDefault(decoders.number, 18),
    INIT_PERLIN_MIN: withDefault(decoders.number, 12),
    INIT_PERLIN_MAX: withDefault(decoders.number, 13),
    BIOME_THRESHOLD_1: withDefault(decoders.number, 15),
    BIOME_THRESHOLD_2: withDefault(decoders.number, 17),
    PLANET_RARITY: withDefault(decoders.number, 16384),
    PHOTOID_ACTIVATION_DELAY: withDefault(decoders.number, 60 * 60 * 12),
    SPAWN_RIM_AREA: withDefault(decoders.number, 0),
    LOCATION_REVEAL_COOLDOWN: withDefault(decoders.number, 60 * 60 * 24),
    CLAIM_PLANET_COOLDOWN: withDefault(decoders.number, 60 * 60 * 3),
    PLANET_TYPE_WEIGHTS: withDefault<PlanetTypeWeights>(
      exactArray4(exactArray10(exactArray5(between(decoders.number, 0, 255)))),
      [
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
      ]
    ),
    ARTIFACT_POINT_VALUES: withDefault<Tuple6<number>>(
      array6(decoders.number),
      [0, 2000, 10000, 200000, 3000000, 20000000]
    ),
  }),
  { style: 'simple' }
);

const AdminPlanet = decoders.exact({
  x: decoders.number,
  y: decoders.number,
  level: decoders.number,
  planetType: decoders.number,
  requireValidLocationId: decoders.boolean,
  revealLocation: decoders.boolean,
});

export const AdminPlanets = decoders.guard(decoders.array(AdminPlanet), { style: 'simple' });

// Util for parsing & validating schemas with pretty printing
export function parse<S>(guard: decoders.Guard<S>, data: unknown): ReturnType<decoders.Guard<S>> {
  try {
    return guard(data);
  } catch (err) {
    if (err instanceof Error) {
      printValidationErrors(err);
    } else {
      console.log(err);
    }
    process.exit(1);
  }
}

// A function that iterates over a Hardhat `lazyObject` to force them to be loaded.
//
// This is needed because some of our Schemas have required properties but aren't
// immediately validated due to `lazyObject`.
export function required<S extends { [key: string]: unknown }>(schema: S, keys: Array<keyof S>) {
  const header = 'Required keys/values:';
  const messages = keys.map((key, idx) => {
    if (typeof key === 'string' || typeof key === 'number') {
      return `${idx + 1}. ${key}: ${schema[key]}`;
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

    ${messages.join('\n')}
    ${stars}
  `;

  // We pretty much just log them so we have something to do with them.
  console.log(chalk.green(msg));
}

function printValidationErrors(err: Error) {
  const header = `Encountered configuration errors:`;
  const message = err.message.trim();
  const longest = err.message
    .split('\n')
    .reduce((max, msg) => Math.max(msg.length, max), header.length);
  const stars = '*'.repeat(longest);

  const msg = dedent`
    ${stars}
    ${header}

    ${message}
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

// Decoder helpers that will probably be refactored into a package
function withDefault<A>(decoder: decoders.Decoder<A>, def: A) {
  return decoders.map(decoders.optional(decoder), (val) => {
    if (val === undefined) {
      return def;
    } else {
      return val;
    }
  });
}

function between(decoder: decoders.Decoder<number>, min: number, max: number) {
  return decoders.compose(
    decoder,
    decoders.predicate((val) => val >= min && val <= max, `Must be between ${min} and ${max}`)
  );
}

type ExactArray4<A> = [A, A, A, A];

function exactArray4<A>(decoder: decoders.Decoder<A>) {
  return decoders.map(
    decoders.compose(
      decoders.array(decoder),
      decoders.predicate((arr) => arr.length === 4, `Must be exactly 4-length`)
    ),
    (value) => [value[0], value[1], value[2], value[3]] as ExactArray4<A>
  );
}

type ExactArray5<A> = [A, A, A, A, A];

function exactArray5<A>(decoder: decoders.Decoder<A>) {
  return decoders.map(
    decoders.compose(
      decoders.array(decoder),
      decoders.predicate((arr) => arr.length === 5, `Must be exactly 5-length`)
    ),
    (value) => [value[0], value[1], value[2], value[3], value[4]] as ExactArray5<A>
  );
}

type Tuple6<A> = [A, A, A, A, A, A];

function array6<A>(decoder: decoders.Decoder<A>) {
  return decoders.map(
    decoders.compose(
      decoders.array(decoder),
      decoders.predicate((arr) => arr.length === 6, `Must be exactly 6-length`)
    ),
    (value) => [value[0], value[1], value[2], value[3], value[4], value[5]] as Tuple6<A>
  );
}

type ExactArray10<A> = [A, A, A, A, A, A, A, A, A, A];

function exactArray10<A>(decoder: decoders.Decoder<A>) {
  return decoders.map(
    decoders.compose(
      decoders.array(decoder),
      decoders.predicate((arr) => arr.length === 10, `Must be exactly 10-length`)
    ),
    (value) =>
      [
        value[0],
        value[1],
        value[2],
        value[3],
        value[4],
        value[5],
        value[6],
        value[7],
        value[8],
        value[9],
      ] as ExactArray10<A>
  );
}

// Generates the default for TOKEN_MINT_END_TIMESTAMP
function oneYearFromNow() {
  const oneYear = 60 * 60 * 24 * 365 * 1000;
  // The default doesn't get passed through the transform so we still need to divide by 1000
  return Math.floor((Date.now() + oneYear) / 1000);
}
