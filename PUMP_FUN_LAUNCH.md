# PROTON Token Launch via pump.fun

## Quick Launch Guide

### Step 1: Go to pump.fun
1. Open https://pump.fun
2. Connect your Solana wallet (`6GSSHYqUKkwg9W9o8TjMPKC7RJC9ashFVabYXeRFzXiz`)
3. Click "Create Token"

### Step 2: Fill Token Details

| Field | Value |
|-------|-------|
| **Name** | PROTON |
| **Ticker** | $PROTON |
| **Description** | AI Compute Mining for Solana. Mine with your CPU/GPU, earn PROTON rewards. Decentralized compute network. |
| **Image** | Upload logo (cyberpunk neon style, cyan/purple gradient) |
| **Twitter** | @ProtonMining (create this) |
| **Telegram** | t.me/protonmining (create this) |
| **Website** | https://proton.fun |

### Step 3: Launch Settings
- **Initial Buy**: 0.5-2 SOL (creates initial liquidity + you get first tokens)
- Cost: ~0.02 SOL for deployment

### Step 4: After Launch
You'll get:
- **Token Mint Address** (the contract address)
- **Bonding curve** (auto-AMM by pump.fun)
- **Tradeable immediately** on pump.fun
- After enough volume → graduates to **Raydium** automatically

---

## After Token is Live

### Update Backend Config

Add to `backend/.env`:
```
PROTON_TOKEN_MINT=<YOUR_TOKEN_MINT_ADDRESS_FROM_PUMP_FUN>
PROTON_DECIMALS=6
CLAIM_RATE=1000
# 1000 points = 1 PROTON token
CLAIM_ENABLED=true
CLAIM_WALLET_PRIVATE_KEY=<BASE58_PRIVATE_KEY_FOR_DISTRIBUTION_WALLET>
```

### Fund Distribution Wallet
1. Create a separate wallet for token distribution
2. Transfer PROTON tokens to it (from your main wallet)
3. Add ~0.5 SOL for transaction fees
4. Set the private key in `.env`

---

## Marketing Copy for pump.fun

### Short Description:
```
PROTON - AI Compute Mining for Solana

Mine with CPU/GPU. Earn $PROTON. Join 1000+ miners.
Decentralized AI compute network powering Solana memecoins.

curl -sSL proton.fun/install.sh | bash
```

### Longer Description (for socials):
```
⚡ PROTON - The AI Compute Layer for Solana

What if mining wasn't just hashing... but actually useful?

PROTON miners contribute:
• AI embeddings
• Tensor computations  
• Vector operations
• Compression workloads

All powering the Solana memecoin ecosystem.

🏆 Leaderboard + Tiers
🔗 Referral system (+5% bonus)
💰 Points → Token conversion
🖥️ Cross-platform Rust miner

Genesis miners get priority allocation.
Early = more tokens.

Install: curl -sSL proton.fun/install.sh | bash
```

---

## Timeline

1. ✅ Deploy token on pump.fun (5 minutes)
2. ✅ Copy token mint address
3. ✅ Update backend `.env` with mint address
4. ✅ Fund distribution wallet with tokens
5. ✅ Enable claims for miners
6. Post on Twitter/Telegram
7. Share referral links

---

## Notes

- pump.fun tokens start with a bonding curve
- After ~$69k market cap, auto-migrates to Raydium
- You (as creator) can buy early at lowest price
- Token is SPL standard = works everywhere (Jupiter, Raydium, Phantom, etc.)
- No need for Metaplex metadata separately — pump.fun handles it
