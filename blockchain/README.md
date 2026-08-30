# CarbonX Blockchain Layer

`contracts/CarbonDNARegistry.sol` — an append-only on-chain log of CarbonX
lifecycle events (DNA generated, audited, stress-tested, revalidated,
integrity flagged/cleared, transferred, retired) keyed by credit ID. It does
**not** itself certify or cancel carbon credits — it's a tamper-evident
record of platform events, matching the backend's `IntegrityReview`,
`Audit`, and `OwnershipEvent` tables.

The contract has been compiled successfully against solc 0.8.26 (see
`contracts/CarbonDNARegistry.abi.json` for the generated ABI) but has **not**
been deployed anywhere — this sandbox has no network access to Polygon RPC
endpoints or the Solidity binary registry needed for a Hardhat toolchain
install. Deploying it is a few commands on a machine with normal internet
access:

```bash
cd blockchain
npm install
cp .env.example .env        # fill in POLYGON_RPC_URL + POLYGON_PRIVATE_KEY
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```

Then copy the deployed address into `backend/.env` as
`CARBON_DNA_CONTRACT_ADDRESS`. Once `POLYGON_RPC_URL`,
`POLYGON_PRIVATE_KEY` and `CARBON_DNA_CONTRACT_ADDRESS` are all set, the
backend adapter (`backend/services/blockchain.py`) switches from "Demo Mode"
to live testnet writes automatically — no other code changes needed. Wiring
the actual `recordEvent` contract call (ABI is already generated) is flagged
as an explicit `NOTE` in that file.
