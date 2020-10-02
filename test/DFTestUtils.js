const { expect } = require("chai");
const { accounts, contract, web3 } = require("@openzeppelin/test-environment");

const [deployer, user1, user2] = accounts;

exports.deployer = deployer;
exports.user1 = user1;
exports.user2 = user2;

exports.zeroOwner = "0x0000000000000000000000000000000000000000";

// Create a contract object from a compilation artifact
exports.fakeDAOAddress = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
exports.Whitelist = contract.fromArtifact("Whitelist");
exports.DarkForestCore = contract.fromArtifact("DarkForestCore");
exports.Verifier = contract.fromArtifact("Verifier");
exports.DarkForestPlanet = contract.fromArtifact("DarkForestPlanet");
exports.DarkForestLazyUpdate = contract.fromArtifact("DarkForestLazyUpdate");
exports.DarkForestUtils = contract.fromArtifact("DarkForestUtils");
exports.DarkForestTypes = contract.fromArtifact("DarkForestTypes");
exports.DarkForestInitialize = contract.fromArtifact("DarkForestInitialize");

exports.getPlanetIdFromHex = (hex) => {
  return web3.utils.toBN(`0x${hex}`);
};

exports.asteroid1Location = {
  // no asteroids
  // lvl0
  hex: "000005b379a628bf7e76773da66355dc814f5c184bc033e87e011c876418b165",
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
  // lvl2
  hex: "000081840ff6c628006b1548838bafd047818ef3e4f76916db6f726c2eebf923",
};

exports.silverStar2Location = {
  // byte #8 is 00; produces silver everywhere
  // lvl2
  hex: "000081840ff6c628006b1548838bafd047818ef3e4f76916db6f726c2eebf924",
};

exports.silverStar3Location = {
  // byte #8 is 33_16 = 51_10; produces silver in deep space but not nebula
  // lvl2
  hex: "000081840ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf925",
};

exports.silverStar4Location = {
  // byte #8 is 33_16 = 51_10; produces silver in deep space but not nebula
  // lvl2
  hex: "000081840ff6c628336b1548838bafd047818ef3e4f76916db6f726c2eebf926",
};

exports.lvl3Location1 = {
  // lvl4
  hex: "0000818402f6c628cd6b1548838bafd047818ef3e4f76916db6f726c2eebf924",
};

exports.lvl3Location2 = {
  // lvl4
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
