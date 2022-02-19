import { BigNumber, BigNumberish } from 'ethers';

interface TestLocationConstructorParam {
  hex: string;
  perlin: BigNumberish;
  distFromOrigin: number;
}

export class TestLocation {
  hex: string; // 64 chat 0-padded hex, not 0x-prefixed
  id: BigNumber;
  perlin: BigNumberish;
  distFromOrigin: number;

  constructor({ hex, perlin, distFromOrigin }: TestLocationConstructorParam) {
    this.hex = hex;
    this.id = BigNumber.from(`0x${hex}`);
    this.perlin = perlin;
    this.distFromOrigin = distFromOrigin;
  }
}
