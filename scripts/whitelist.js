// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const axios = require('axios');

const LIST_URL = 'http://34.65.237.251:8000/list.json';
const seconds = 60 * 30;

let intervalId;

const fetch = async (url) => {
  try {
    const response = await axios.get(url)
    return response.data;
  } catch (error) {
    console.log(error);
  }
};

async function whitelist() {

  console.log("\n/* running whitelist task */\n");

  const players = await fetch(LIST_URL);
  if(players) {
    console.log(`\n/* received ${players.length} players */\n`);

    const list = players.map(p => p.address).toString();
    await hre.run('whitelist-nokey:registerList', {
      list,
      drip: true,
      dry: false
    });
  }
  console.log("\n/* finished whitelist task */\n");
    // register.action({path:, drip: true})
    // Make whitelist call
}

async function main() {
  if(seconds) {
    console.log(`looping every ${seconds/60} minutes`);
    if(!intervalId) {
      intervalID = setInterval(whitelist, parseInt(seconds*1000))
    }
  }
  else {
    await whitelist();
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main();