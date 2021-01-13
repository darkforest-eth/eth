# Dark Forest Smart Contracts

## Development Guide

### Installing Core Dependencies

-   Node (v14.15.x)
-   Yarn (Javascript Package Manager)
-   Ganache CLI

#### Installing The Correct Node Version Using NVM

Dark Forest is built and tested using Node.js v14.15.x and might not run properly on other Node.js versions. We recommend using NVM to switch between multiple Node.js version on your machine.

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
nvm install
```

After the installation is finished, you can run `node --version` to verify that you are running v14.15.x

#### Installing Yarn & Other Dev Dependencies

Refer to [Yarn's official documentation](https://classic.yarnpkg.com/en/docs/install) for the installation guide.

After you have Yarn installed, run the following commands in the root director install the remaining dev depencies:

```
yarn global add ganache-cli
yarn install
```

### Smart Contract Development Setup

All of our smartcontract related code are located in the `/eth` directory.

-   `/eth/contracts` contains the smartcontract code written in solidity
-   `/eth/test` contains the test for the smartcontract written in Javascript

#### Installing Dependenciees

**Navigate to the `/eth` folder and run the following commands:**

```
yarn install
```

#### Running Tests

```
yarn test
```

#### Deploying Contracts Locally

First, run `oz init` in the `eth` directory (press `ENTER` to accept defaults - typechain support is irrelevant).

Next, open a separate terminal and run a local blockchain with `ganache-cli`.

Finally, in your original terminal, run `yarn run deploy:dev`.
