import { Transfer } from '../generated/DarkForestTokens/DarkForestTokens';
import { Artifact } from '../generated/schema';

export function handleTransfer(event: Transfer): void {
  let artifact = Artifact.load(event.params.tokenId.toHexString());
  if (artifact !== null) {
    artifact.owner = event.params.to.toHexString();
    artifact.save();
  }
}
