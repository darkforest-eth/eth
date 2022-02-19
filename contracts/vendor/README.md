# Vendored Smart Contracts

All vendored Smart Contracts are consolidated into this directory—unless they are available via `npm`, such as [SolidState contracts](https://www.npmjs.com/package/@solidstate/contracts).

## Why

Vendored contracts are not often touched when working on the Dark Forest contracts. They will generally:

1. Provide reference implementations, such as the Diamond pattern reference implementation from [mudgen/diamond-2-hardhat](https://github.com/mudgen/diamond-2-hardhat/). These generally won't need to be customized and can be copied verbatim into the project.
2. Contain utilities, such as the [ADBKMath64x64 library](https://github.com/abdk-consulting/abdk-libraries-solidity).

These contracts are stored in a separate directory to make it more explicit that they were copied without any changes, which also helps if they ever need to be updated.

## How

If a contract is available via `npm`, it should be installed as a dependency to better manage its versioning. However, many needed contracts aren't published, so we copy them into this directory.

Vendored contracts are copied directly from their source into the relevent directory, such as `facets`, `interfaces`, or `libraries`. In addition to copying the files, a comment should be added to the file indicating the URL it was copied from (with the exact git hash if possible)and the date it was vendored. In order to make updates easier, these comments should be the only change to the file.

If a file needs any customization, it shouldn't be added to the `vendor/` directory, but should still include the URL and date of the original reference contract. An example of this is the `DFInitialize.sol` contract, which was expected to be customized!

## Updating

When updating a vendored contract, the diff should be fairly straightforward because the only non-upstream change should be the comment about vendoring date and URL.
