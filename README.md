# StelDot — Decentralized Loyalty Reward Donation Platform (Donate-to-Earn)

[Versi Bahasa Indonesia tersedia di README-ID.md](./README-ID.md)

---

## 🇺🇸 English Version

### Description

StelDot is a Decentralized Application (dApp) built on the Stellar network using Soroban smart contracts. It implements a **Donate-to-Earn** loyalty rewards model.
Donors can contribute native XLM to community campaigns. Every donation registers 1 Loyalty Point. Once a donor accumulates 10 loyalty points, they can claim a reward of **1.00 XLM**. Upon owner approval, the points reset to 0, but the historic donation records are safely persisted on the blockchain forever. Double-claims are prevented by locking claimant status to "Pending" until the contract owner executes the payout.

---

### Smart Contract Information (Testnet)

- **Deployed Contract Address (ID)**: `CABKLAYMJR3WTCAAP4CYZHF7OKAAE47U62EHI2GIY276NNEUB4SGJVBD`
- **View on Stellar Explorer**: [Stellar.Expert Contract Link](https://stellar.expert/explorer/testnet/contract/CABKLAYMJR3WTCAAP4CYZHF7OKAAE47U62EHI2GIY276NNEUB4SGJVBD)
- **Asset/Token Address (Native XLM SAC)**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **Example Transaction Hash (Contract Call)**: [`3524e594b555f10f1031d75611b0b55a93ef3f3eb3ace77d9c09b73daca58638`](https://stellar.expert/explorer/testnet/tx/3524e594b555f10f1031d75611b0b55a93ef3f3eb3ace77d9c09b73daca58638)

---

### Features

#### For Clients (Donors)

- **Support Campaigns**: Donate any positive amount of XLM to active campaigns.
- **Categorized Tabs**: Easily navigate between **Active**, **Fully Funded**, and **Inactive** campaigns.
- **Loyalty Rewards**: Earn 1 loyalty point per donation. Track active points dynamically.
- **Earn Payouts**: Request a payout of 1.00 XLM once active points reach 10.
- **Wallet Integration**: Automatic detection of connected Freighter wallet balances.
- **Duplicate Claim Protection**: Claim button locks when status is pending, preventing double claims.
- **Multilingual Support**: Fully togglable English & Indonesian UI.
- **Auto-Translation**: Google Translate API integrated directly to read campaign titles and descriptions in your preferred language.
- **Search & Pagination**: Effortlessly find specific campaigns by ID or Title and navigate through pages.

#### For Owners (Administrators)

- **Owner Dashboard**: A premium, prominent control panel to manage the platform.
- **Campaign Creation**: Upload and configure funding campaigns with unique IDs, titles, descriptions, and targets.
- **Campaign Editing**: Flexibly modify existing campaigns (e.g., correcting typos, adjusting targets, or toggling active status).
- **Audit Pending Requests**: View claimants in the queue waiting for payouts.
- **Payout Approval**: Review and execute on-chain claim approvals.
- **Treasury Safeguards**: The contract validates that the treasury balance is >= 1.00 XLM before processing. If insufficient, approvals are blocked and warnings are shown.

---

### Security & Error Handling

StelDot implements a robust, two-layer error handling architecture covering edge cases and providing an excellent UX:

#### 1. Frontend UI Validations (11 Error States)
Provides user-friendly `SweetAlert` pop-ups to prevent bad data before reaching the blockchain.
- **Connection Error**: Freighter wallet authentication fails or is missing.
- **Invalid Amount**: Donation input is zero or negative.
- **Transaction Failed**: User rejects the signature or a generic on-chain failure occurs.
- **Points Insufficient**: Attempting to claim rewards with less than 10 points.
- **Request/Approval Failed**: Signature rejection during transaction.
- **Invalid Inputs**: Missing required fields when creating/editing campaigns.
- **Deployment Failed**: Failure creating a new campaign.
- **Treasury Deficit**: Smart contract balance is below the required 1.00 XLM payout. Prevents the owner from submitting an invalid transaction.
- **Invalid Contract Format**: Contract ID pasted is not 56 characters long.
- **Translation Failed**: Google Translate API network error.

#### 2. Smart Contract On-Chain Guards (13 Panic States)
Acts as the final line of defense against malicious transactions directly on the blockchain.
- `already initialized`: Prevents re-initialization of the contract.
- `not authorized: only owner can ...`: Strict Role-Based Access Control (RBAC).
- `campaign already exists`: Prevents campaign ID collisions.
- `donation amount must be positive`: On-chain validation of values.
- `campaign is inactive`: Reverts donations to halted campaigns.
- `insufficient loyalty points: need at least 10`: Double-verifies reward eligibility.
- `claim already pending`: Prevents **Double-Claim** vulnerabilities.
- `no pending claim for donor`: Prevents arbitrary payouts.
- `insufficient treasury balance to payout reward`: Liquidity safeguarding.
- `withdrawal amount must be positive`: Invalid treasury withdrawals.

---

### Technology Stack

- **Smart Contract**: Rust, Soroban SDK (v26)
- **Frontend Framework**: React (Vite)
- **Styling**: Tailwind CSS (Apple iOS-style Design System)
- **Wallet Connection**: `@stellar/freighter-api`
- **Notification alerts**: `sweetalert2`
- **Translation Engine**: Google Translate API (Client-side fetch)

---

### Project Directory Structure

```text
stellar-steldot/
├── contracts/
│   └── donation/
│       ├── src/
│       │   ├── lib.rs        # Smart contract logic (Campaigns, Loyalty, Claims)
│       │   └── test.rs       # Contract unit tests
│       └── Cargo.toml        # Contract cargo config
├── src/
│   ├── utils/
│   │   ├── stellar.js        # Freighter API & Soroban RPC integration helpers
│   │   └── i18n.js           # Multi-language dictionary logic
│   ├── App.jsx               # Main React component (iOS UI, SweetAlerts, Role Routing)
│   ├── index.css             # Tailwind CSS directives & iOS variables
│   └── main.jsx              # React mounting script
├── Cargo.toml                # Workspace Cargo file
├── index.html                # Vite HTML template
├── postcss.config.js         # CSS PostProcessor config
├── tailwind.config.js        # Tailwind layout configurations
└── vite.config.js            # Vite compiler configuration
```

---

### Setup Instructions

#### 1. Smart Contract Verification

Verify the smart contract functionality using Cargo tests:

```bash
cargo test
```

To compile the contract to optimized WASM format:

```bash
stellar contract build
```

#### 2. Deploying and Initializing Your Own Contract

Fund a testnet address and deploy:

```bash
stellar keys generate --global deployer
stellar keys fund deployer
stellar contract deploy --wasm target/wasm32v1-none/release/donation.wasm --source deployer --network testnet
```

Initialize the contract (specify your public key as owner and testnet native asset SAC as token):

```bash
stellar contract invoke --id <YOUR_CONTRACT_ID> --source deployer --network testnet -- initialize --owner <OWNER_PUBLIC_KEY> --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

#### 3. Run the Frontend Locally

Install all React/Vite/Tailwind dependencies and launch:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Clicking on the **Contract ID** link allows you to paste your new contract ID to connect live!

---

### Application Preview
### 👤 Owner: Created New Campaign

<img width="700" alt="Owner Created New Campaign" src="https://github.com/user-attachments/assets/7197efcf-0ad6-47c3-8987-9768a48553e8" />

---

### 🤝 Client: Add Donation

<img width="700" alt="Client Add Donation 1" src="https://github.com/user-attachments/assets/94515b5d-baba-4da7-b6f3-9f6db2ab2888" />
<br>
<img width="700" alt="Client Add Donation 2" src="https://github.com/user-attachments/assets/3211e77c-d9e5-425c-b3fc-226bf329c378" />
