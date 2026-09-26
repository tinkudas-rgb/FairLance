# FairLance

FairLance is a testnet-only freelance milestone escrow with community dispute resolution. A client locks project funds up front, a freelancer submits a work hash and evidence URI, and the client either approves payment or opens a dispute. Three staked jurors review the evidence and vote; the 2-of-3 majority determines the payout. Jurors in the majority earn the dispute fee and slashed stake from the minority.

> Hackathon MVP. Do not use with real funds. The contract has not been audited.

Pitch deck: [docs/FairLance_Pitch_Deck.pdf](docs/FairLance_Pitch_Deck.pdf)

## What works

- Create and fully fund a project with 1-20 native-ETH milestones
- Freelancer submission with an onchain work hash and URI
- Client approval and immediate milestone payout
- Client or freelancer dispute initiation
- Juror pool with a 0.01 ETH minimum stake
- Three eligible jurors selected per dispute
- One vote per juror, majority settlement after all three votes
- 1% milestone fee shared by majority jurors
- 10% stake slash for minority jurors
- Juror stake locked while assigned to an unresolved dispute
- Client, freelancer, and juror frontend views
- Onchain project and milestone inspector
- Sepolia and Base Sepolia wallet support
- Seven passing contract tests

## MVP simplifications

- Juror selection uses onchain entropy (`prevrandao`, timestamp, IDs). This is suitable for a testnet demo, not a valuable production escrow. A production version should use Chainlink VRF or commit-reveal randomness.
- Work and evidence are URI strings. The app does not upload files to IPFS.
- One contract holds all projects and stakes. There is no upgrade or governance layer.
- There are no deadlines, inactivity escape hatches, appeal rounds, partial awards, reputation scores, or stablecoin support yet.
- Frontend fields accept project/dispute IDs directly for a crisp demo; there is no event-indexed dashboard.
- Native test ETH only. Never use real funds.

## Requirements

- Node.js 20+
- npm
- A WalletConnect Cloud project ID
- A Sepolia RPC URL and testnet-only deployer key for deployment

## Contracts

```bash
npm install
npm test
npm run compile
```

Expected: `7 passing`.

### Deploy to Sepolia

```bash
cp .env.example .env
# Fill SEPOLIA_RPC_URL and a TESTNET-ONLY DEPLOYER_PRIVATE_KEY
npm run deploy
```

Copy the printed contract address.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
# Fill NEXT_PUBLIC_CONTRACT_ADDRESS with the deployed address
npm run dev
```

Open http://localhost:3000. A production check is available with:

```bash
npm run build
npm start
```

## Demo flow

Use six Sepolia accounts: one client, one freelancer, and at least three jurors.

1. Jurors: connect each juror wallet and stake at least 0.01 test ETH.
2. Client: enter the freelancer wallet, job metadata, and milestone amounts, then lock the total.
3. Freelancer: select the project/milestone, enter a work URI, and anchor its hash.
4. Happy path: client approves and payment goes to the freelancer.
5. Dispute path: for a second submitted milestone, client or freelancer opens a dispute with an evidence URI.
6. Jurors: use the dispute ID and cast all three votes.
7. After the third vote, the contract pays the majority's chosen party, rewards majority jurors, and slashes the minority juror.

## Project layout

- `contracts/FairLance.sol` - escrow and jury contract
- `test/FairLance.test.js` - Hardhat tests
- `scripts/deploy.js` - Sepolia deployment script
- `frontend/` - Next.js 14, wagmi, viem, RainbowKit UI
- `.env.example` and `frontend/.env.example` - safe configuration templates

## Security notes

The contract uses checks-effects-interactions and a reentrancy guard for payout/withdrawal paths. Parties cannot serve as jurors on their own project, duplicate juror selection is prevented, and assigned jurors cannot withdraw stake before resolution. This remains unaudited hackathon software.
