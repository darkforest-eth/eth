import { AdminPlanets, Contracts, Initializers } from '@darkforest_eth/settings';
import toml from '@iarna/toml';
import chalk from 'chalk';
import { cosmiconfigSync } from 'cosmiconfig';
import * as decoders from 'decoders';
// HRE stuff
import 'hardhat/types/runtime';
import * as path from 'path';
import resolvePackage from 'resolve-package-path';
import { dedent } from 'ts-dedent';

declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    DEPLOYER_MNEMONIC: string | undefined;
    ADMIN_PUBLIC_ADDRESS: string | undefined;

    packageDirs: {
      '@darkforest_eth/contracts': string;
      '@darkforest_eth/snarks': string;
    };

    contracts: Contracts;

    initializers: Initializers;

    adminPlanets: AdminPlanets;
  }
}

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
