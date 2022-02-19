# Dark Forest Diamond

The Dark Forest game implements the Diamond pattern, [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535). This pattern provides a single point-of-entry into all game functions, and the ability to upgrade or enhance live game instances.

Besides the EIP specification, which is a highly recommended read, some additional materials about the Diamond pattern include:

- [Introduction to EIP-2535 Diamonds](https://eip2535diamonds.substack.com/p/introduction-to-the-diamond-standard) by Nick Mudge
- [The Diamond Standard: A new paradigm for upgradeability](https://medium.com/derivadex/the-diamond-standard-a-new-paradigm-for-upgradeability-569121a08954) by Ainsley Sutherland
- [Understanding Diamonds on Ethereum](https://dev.to/mudgen/understanding-diamonds-on-ethereum-1fb) by Nick Mudge
- [Ethereum's Maximum Contract Size Limit is Solved with the Diamond Standard](https://dev.to/mudgen/ethereum-s-maximum-contract-size-limit-is-solved-with-the-diamond-standard-2189) by Nick Mudge

## Terminology

This document assumes some understanding of Solidity smart contract development. Additionally, the Diamond pattern introduces its own terminology:

- The `diamond` is the entrypoint smart contract that can proxy to different facets.
- A `facet` is a smart contract that provides functionality to the diamond. Individual functions of a `facet` are cut into a diamond via their selectors.
- The `cut` (or `diamondCut`) function call is used to add, remove, or update facets with the diamond. The `cut` function call can also execute initialization logic after the diamond is updated.
- A [`selector`](https://docs.soliditylang.org/en/v0.8.10/abi-spec.html#function-selector) is the first four bytes of the call data for a function call. There is a very small chance of a collision between any two `selectors` but cutting multiple of the same selector is disallowed.
- Each diamond will provide a `loupe` facet that provides introspection functions for the diamond itself. This can be used to lookup facets and functions already registered with the diamond.

**Note:** The implementations of `diamondCut` and `loupe` functions can vary based on complexity and gas cost choices. Dark Forest has chosen the ["diamond-2"](https://github.com/mudgen/diamond#diamond-implementations) implementation because it allows cheaper gas cost of the `diamondCut` function, which is useful for Lobbies. This results in a higher cost `loupe` function call.

## Organization

The various smart contracts are organized into a few different places.

1. Facets are stored in the [`facets/`](./facets/) directory and contain the game logic.
2. Libraries are stored in the [`libraries/`](./libraries/) directory and contain functionality that can't fit in a facet or must be [shared by multiple facets](#sharing-between-facets). Additionally, `libraries/LibStorage.sol` contains Dark Forest's [Diamond Storage](#diamond-storage).
3. Vendored contracts are stored in the [`vendor/`](./vendor/) directory, which has a mirrored structure of `vendor/facets/`, `vendor/interfaces/`, and `vendor/libraries/`. The [vendor README](./vendor/README.md) provides more information about the vendoring process.
4. The [`DFInitialize.sol`](./DFInitialize.sol) contract is provided at the root because it is only used by the `diamondCut` process.
5. The [`DFTypes.sol`](./DFTypes.sol) file is also provided at the root because it only provides enum and struct types for the rest of the contracts—it is not a contract itself.

## Diamond Storage

Contract state is shared with a pattern called [Diamond Storage](https://dev.to/mudgen/how-diamond-storage-works-90e) and is documented in detail in [`libraries/LibStorage.sol`](./libraries/LibStorage.sol).

## Sharing between facets

The article [How to Share Functions Between Facets of a Diamond](https://dev.to/mudgen/how-to-share-functions-between-facets-of-a-diamond-1njb) by Nick Mudge describes a bunch of possible ways to share functionality between facet smart contracts.

In order of preference, Dark Forest contracts share functionality using:

1. Storing shared state inside an existing storage struct or create a new one following the Diamond Storage pattern.
2. Organizing and refactoring the facets so they don't need cross-facet calls.
3. Writing libraries with `internal` function calls; however, this might cause contract size issues. As documented on [ethereum.org](https://ethereum.org/en/developers/tutorials/downsizing-contracts-to-fight-the-contract-size-limit/#libraries):

   > Don't declare the library functions as internal as those will be added to the contract directly during compilation

4. Calling another another facet through the diamond, using the type safe calling convention `OtherFacet(address(this)).someFunction(arg1, arg2)`.

   **Be aware**: Care must be taken about the `msg.sender` and permissions on certain functionality.

5. Writing libraries with `public` or `external` function calls. These aren't inlined and must be deployed and linked into the facets. This is the **least** preferred solution.

## Implementation references

Much of the Dark Forest Diamond code was based on Nick Mudge's [diamond-2-hardhat](https://github.com/mudgen/diamond-2-hardhat) repository at the [7feb995](https://github.com/mudgen/diamond-3-hardhat/tree/0cf47c8) commit.

Other inspiration for the implementation came from Aavegotchi's [ghst-staking](https://github.com/aavegotchi/ghst-staking) and [aavegotchi-contracts](https://github.com/aavegotchi/aavegotchi-contracts).

## Other

For a previous version of the the Diamond pattern spec, Trail of Bits released an article titled [Good idea, bad design: How the Diamond standard falls short](https://blog.trailofbits.com/2020/10/30/good-idea-bad-design-how-the-diamond-standard-falls-short/); however, Nick Mudge addressed these concerns in a [follow-up article](https://dev.to/mudgen/addressing-josselin-feist-s-concern-s-of-eip-2535-diamond-standard-me8) that outlined how the EIP-2535 had been updated to address the concerns.

Nick Mudge maintains a [list of security audits](https://eip2535diamonds.substack.com/p/smart-contract-security-audits-for) against the three different reference implementations of the Diamond pattern.
