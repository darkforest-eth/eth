const { expect } = require("chai");
const { accounts, contract, web3 } = require("@openzeppelin/test-environment");

const [deployer, user1, user2] = accounts;

exports.deployer = deployer;
exports.user1 = user1;
exports.user2 = user2;

exports.zeroOwner = "0x0000000000000000000000000000000000000000";

// Create a contract object from a compilation artifact
const fakeDAOAddress = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const Whitelist = contract.fromArtifact("Whitelist");
const DarkForestCore = contract.fromArtifact("DarkForestCore");
const Verifier = contract.fromArtifact("Verifier");
const DarkForestPlanet = contract.fromArtifact("DarkForestPlanet");
const DarkForestLazyUpdate = contract.fromArtifact("DarkForestLazyUpdate");
const DarkForestUtils = contract.fromArtifact("DarkForestUtils");
const DarkForestTypes = contract.fromArtifact("DarkForestTypes");
const DarkForestInitialize = contract.fromArtifact("DarkForestInitialize");
const DarkForestTokens = contract.fromArtifact("DarkForestTokens");

// Create a contract object from a compilation artifact
exports.fakeDAOAddress = fakeDAOAddress;
exports.Whitelist = Whitelist;
exports.DarkForestCore = DarkForestCore;
exports.Verifier = Verifier;
exports.DarkForestPlanet = DarkForestPlanet;
exports.DarkForestLazyUpdate = DarkForestLazyUpdate;
exports.DarkForestUtils = DarkForestUtils;
exports.DarkForestTypes = DarkForestTypes;
exports.DarkForestInitialize = DarkForestInitialize;
exports.DarkForestTokens = DarkForestTokens;

exports.getPlanetIdFromHex = (hex) => {
  return web3.utils.toBN(`0x${hex}`);
};

exports.asteroid1Location = {
  // no asteroids
  // lvl0
  hex: "000005b379a628bf7e76773da66355dc814f5c184bc033e87e011c876418b165",
};

exports.asteroid1WithArtifact = {
  // no asteroids
  // lvl0
  hex: "000005b379a628bf7e76773da66300dc814f5c184bc033e87e011c876418b165",
};

exports.asteroid2Location = {
  // no asteroids
  // lvl0
  hex: "000039be54a58abc4e9ef3571afa3f7f2671004d1198fa276b0f9cb54ac9257d",
};

exports.asteroid3Location = {
  // byte #9 is < 16
  // ZK friendly
  // lvl0
  hex: "000039be54a58abcff0ef3571afa3f7f2671004d1198fa276b0f9cb54ac9257d",
};

exports.star1Location = {
  // no special props
  // lvl1
  hex: "000057c13def5229f1a2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827d",
};

exports.star2Location = {
  // no special props
  // lvl2
  hex: "000057c10def5229f1a2fee2eeb9ce2cc04b5f5176538cbfe524d8f6b00a827d",
};

exports.silverStar1Location = {
  // byte #8 is 00; produces silver everywhere
  // lvl1
  hex: "000081841ff6c628006b1548838bafd047818ef3e4f76916db6f726c2eebf923",
};

exports.silverStar2Location = {
  // byte #8 is 00; produces silver everywhere
  // lvl1
  hex: "000081841ff6c628006b1548838bafd047818ef3e4f76916db6f726c2eebf924",
};

exports.silverStar3Location = {
  // byte #8 is 33_16 = 51_10; produces silver in deep space but not nebula
  // lvl1
  hex: "000081841ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf925",
};

exports.silverStar4Location = {
  // byte #8 is 33_16 = 51_10; produces silver in deep space but not nebula
  // lvl1
  hex: "000081841ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf926",
};

exports.lvl3Location1 = {
  // lvl3
  hex: "0000818402f6c628cd6b1548838bafd047818ef3e4f76916db6f726c2eebf924",
};

exports.lvl3Location2 = {
  // lvl3
  hex: "0000818402f6c628cd6b1548838bafd047818ef3e4f76916db6f726c2eecf924",
};

exports.lvl4Location1 = {
  // lvl4
  hex: "0000818400f6c628cd6b1548838bafd047818ef3e4f76916db6f726c2eebf924",
};

exports.lvl4Location2 = {
  // lvl4
  hex: "0000818400f6c628cd6b1548838bafd047818ef3e4f76916db6f726c2eecf924",
};

exports.maxLvlLocation1 = {
  // lvl7
  hex: "0000818400000028cd6b1548838bafd047818ef3e4f76916db6f726c2eecf924",
};

exports.maxLvlLocation2 = {
  // lvl7
  hex: "0000818400000028cd6b1548838bafd047818ef3e4f76916db6f726c2eecf925",
};

exports.planetWithArtifact1 = {
  hex: "00007c2512896efbcc2d462faee6041fb33d58930eb9e6b4fbae6d048e9c44c3",
};

exports.planetWithArtifact2 = {
  hex: "00007c2512896efbcc2d462faee0000fb33d58930eb9e6b4fbae6d048e9c44c4",
};

exports.SMALL_INTERVAL = 5; // seconds
exports.TOLERANCE = 2; // seconds
exports.LARGE_INTERVAL = 86400; // seconds

exports.makeInitArgs = (planetId, perlin, radius) => {
  return [
    [0, 0],
    [
      [0, 0],
      [0, 0],
    ],
    [0, 0],
    [planetId, perlin, radius],
  ];
};

exports.makeMoveArgs = (
  oldLoc,
  newLoc,
  newPerlin,
  newRadius,
  maxDist,
  popMoved,
  silverMoved
) => {
  return [
    [0, 0],
    [
      [0, 0],
      [0, 0],
    ],
    [0, 0],
    [oldLoc, newLoc, newPerlin, newRadius, maxDist, popMoved, silverMoved],
  ];
};

exports.expectEqualWithTolerance = (value1, value2, tolerance = 0.01) => {
  expect(value1).to.be.least(value2 * (1 - tolerance));
  expect(value1).to.be.most(value2 * (1 + tolerance));
};

exports.initializeTest = async function (testObj, whitelistEnabled) {
  testObj.timeout(10000);

  await Whitelist.detectNetwork();
  testObj.whitelistContract = await Whitelist.new({ from: deployer });
  await testObj.whitelistContract.initialize(deployer, !!whitelistEnabled);

  await DarkForestTokens.detectNetwork();
  testObj.tokensContract = await DarkForestTokens.new({ from: deployer });

  testObj.verifierLib = await Verifier.new({ from: deployer });
  testObj.dfUtilsLib = await DarkForestUtils.new({ from: deployer });
  testObj.dfLazyUpdateLib = await DarkForestLazyUpdate.new({ from: deployer });
  testObj.dfTypesLib = await DarkForestTypes.new({ from: deployer });
  await DarkForestPlanet.detectNetwork();
  await DarkForestPlanet.link(
    "DarkForestTokens",
    testObj.tokensContract.address
  );
  await DarkForestPlanet.link(
    "DarkForestLazyUpdate",
    testObj.dfLazyUpdateLib.address
  );
  await DarkForestPlanet.link("DarkForestUtils", testObj.dfUtilsLib.address);
  testObj.dfPlanetLib = await DarkForestPlanet.new({ from: deployer });
  testObj.dfInitializeLib = await DarkForestInitialize.new({ from: deployer });
  await DarkForestCore.detectNetwork();
  await DarkForestCore.link("Verifier", testObj.verifierLib.address);
  await DarkForestCore.link("DarkForestPlanet", testObj.dfPlanetLib.address);
  await DarkForestCore.link(
    "DarkForestLazyUpdate",
    testObj.dfLazyUpdateLib.address
  );
  await DarkForestCore.link("DarkForestTypes", testObj.dfTypesLib.address);
  await DarkForestCore.link("DarkForestUtils", testObj.dfUtilsLib.address);
  await DarkForestCore.link(
    "DarkForestInitialize",
    testObj.dfInitializeLib.address
  );
  testObj.contract = await DarkForestCore.new({ from: deployer });

  testObj.tokensContract.initialize(testObj.contract.address);
  await DarkForestCore.link("DarkForestTokens", testObj.tokensContract.address);

  await testObj.contract.initialize(
    deployer,
    testObj.whitelistContract.address,
    testObj.tokensContract.address,
    true
  );
};
