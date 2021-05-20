# subgraph

This guide assumes you already have your contracts deployed be it on a local node or on a mainnet, have the json abi files in /abis, and have the CORE_CONTRACT_ADDRESS address and the TOKENS_CONTRACT_ADDRESS as well as the block the core contract was deployed at (so you dont waste time syncing from the genesis block). For localhost you can use block 0.

## thegraph hosted solution

For graph hosted service, you need to create an account on thegraph.com, and create a subgraph using the web interface and note the namespace yourloginname/graphname. Find the access token for this graph (it should be on the top row of the interface), and run

`graph auth https://api.thegraph.com/deploy/ <ACCESS_TOKEN>`

in your terminal.

Then put the contract addresses into the templates and codgen thegraph files
`yarn workspace eth subgraph:template:prod`

Finally ask them to start the indexing
`yarn workspace eth subgraph:deploy:prod yourloginname/graphname`

## local development

To run a local copy of thegraph make sure docker is installed and running, `./scripts/deploy-contracts-locally.sh --subgraph df` OR if you already have your contracts deployed and running run `yarn workspace eth hardhat:dev subgraph:deploy --name df` and find your local hosted explorer at `http://localhost:8000/subgraphs/name/df`
