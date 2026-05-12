# PROTON

```
    ██████╗ ██████╗  ██████╗ ████████╗ ██████╗ ███╗   ██╗
    ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗████╗  ██║
    ██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║██╔██╗ ██║
    ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██║╚██╗██║
    ██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║ ╚████║
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝  ╚═══╝
```

**AI Compute Mining for Solana**

PROTON is a decentralized AI compute mining platform built for the Solana ecosystem. Mine with your CPU/GPU, contribute to AI workloads, and earn PROTON rewards.

---

## Quick Start

```bash
curl -sSL proton.fun/install.sh | bash
proton register
proton mine
```

---

## Architecture

```
User Miner (Rust CLI)
       ↓
Task Gateway API (Node.js + Fastify)
       ↓
Redis Queue
       ↓
Verifier Worker
       ↓
PostgreSQL (Reward DB)
       ↓
Solana Wallet Binding
```

---

## Project Structure

```
PROTON/
├── backend/          # Node.js API server
│   ├── src/
│   │   ├── routes/   # auth, tasks, miner, leaderboard, referral
│   │   ├── db/       # PostgreSQL connection + migrations
│   │   └── index.js  # Main server entry
│   ├── Dockerfile
│   └── package.json
├── miner/            # Rust CLI miner
│   ├── src/
│   │   ├── main.rs       # CLI entry + commands
│   │   ├── miner.rs      # Mining loop + heartbeat
│   │   ├── tasks.rs      # Task execution (SHA256, vector, tensor, etc.)
│   │   ├── benchmark.rs  # Hardware benchmark
│   │   ├── auth.rs       # Login/register
│   │   └── config.rs     # Config management
│   └── Cargo.toml
├── frontend/         # Next.js dashboard
│   ├── src/app/
│   │   ├── page.tsx      # Landing + leaderboard
│   │   ├── layout.tsx    # Root layout
│   │   └── globals.css   # Styles
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── install.sh         # One-line installer
└── README.md
```

---

## Mining Workloads

PROTON miners execute hybrid AI compute tasks:

| Workload | Type | Description |
|----------|------|-------------|
| SHA256 Hashing | CPU | Iterative hash computation with verification |
| Vector Math | CPU | Dot product / vector operations |
| Compression | CPU | Deflate compression with ratio validation |
| AI Embedding | CPU/GPU | Token embedding generation |
| Tensor Multiply | GPU | Matrix multiplication kernels |

**Task Distribution:**
- 30% SHA compute
- 40% AI embedding
- 20% Compression
- 10% Proof validation

---

## CLI Commands

```bash
proton register          # Create new account
proton login             # Login to existing account
proton mine              # Start mining
proton mine --threads 8  # Mine with 8 threads
proton mine --gpu        # Enable GPU acceleration
proton benchmark         # Run hardware benchmark
proton stats             # View mining statistics
proton config            # View configuration
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new miner |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get profile |
| POST | `/api/auth/wallet` | Bind Solana wallet |
| GET | `/api/tasks/get` | Get mining task |
| POST | `/api/tasks/submit` | Submit task result |
| POST | `/api/miner/heartbeat` | Heartbeat |
| POST | `/api/miner/benchmark` | Submit benchmark |
| GET | `/api/miner/stats` | Mining stats |
| POST | `/api/miner/session/start` | Start session |
| POST | `/api/miner/session/end` | End session |
| GET | `/api/leaderboard` | Global leaderboard |
| GET | `/api/leaderboard/epoch` | Current epoch top miners |
| GET | `/api/leaderboard/stats` | Network stats |
| GET | `/api/referral` | My referrals |
| GET | `/api/referral/code` | Get referral code |

---

## Deployment

### Option 1: Docker (Recommended)

```bash
# Clone the repo
git clone https://github.com/Protonhash/PROTON.git
cd PROTON

# Copy env and configure
cp backend/.env.example backend/.env
# Edit backend/.env with your secrets

# Start everything
docker-compose up -d

# Run migrations (auto-runs on backend start)
```

Services:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

### Option 2: Manual Setup

```bash
# Prerequisites
# - Node.js 20+
# - PostgreSQL 16+
# - Redis 7+
# - Rust (for miner)

# Backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev

# Frontend
cd frontend
npm install
npm run dev

# Miner (for development)
cd miner
cargo build --release
./target/release/proton-miner register
./target/release/proton-miner mine
```

### Option 3: Cheap VPS Deployment

Recommended providers:
- **Oracle Cloud** - Free tier (ARM, 4 cores, 24GB RAM)
- **Contabo** - $5/mo VPS
- **Fly.io** - Free tier for small apps
- **Railway** - Easy deploy with Git

```bash
# On your VPS
git clone https://github.com/Protonhash/PROTON.git
cd PROTON
docker-compose up -d
```

---

## Tokenomics

| Allocation | Percentage |
|-----------|------------|
| Miners | 40% |
| Liquidity | 20% |
| Treasury | 15% |
| Development | 10% |
| Community | 10% |
| CEX/MM | 5% |

---

## Tier System

| Tier | Benchmark Score | Benefits |
|------|----------------|----------|
| Bronze | < 5,000 | Base rewards |
| Silver | 5,000+ | 1.2x multiplier |
| Gold | 10,000+ | 1.5x multiplier |
| Platinum | 20,000+ | 2x multiplier |
| Diamond | 50,000+ | 3x multiplier |

---

## Referral System

- Invite friends with your unique referral code
- Earn **+5% bonus** on every task your referrals complete
- Track referral earnings in the dashboard

---

## Roadmap

### Phase 1 - Genesis (Current)
- [x] CLI miner
- [x] Backend API
- [x] Leaderboard
- [x] Points system

### Phase 2 - Expansion
- [ ] GPU acceleration (CUDA/ROCm)
- [ ] Referral dashboard
- [ ] Mobile companion app
- [ ] Clan system

### Phase 3 - Integration
- [ ] Solana wallet connect
- [ ] NFT miner badges
- [ ] On-chain proof of compute

### Phase 4 - Token
- [ ] Token launch
- [ ] Points-to-token conversion
- [ ] DEX listing
- [ ] Staking

---

## Security

- **Anti-cheat:** Server-side verification with random nonces
- **Timed workloads:** Tasks must complete within timeout
- **Benchmark validation:** Device capabilities recorded
- **Rate limiting:** Protection against task flooding
- **JWT auth:** Secure token-based authentication

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Miner | Rust |
| Backend | Node.js + Fastify |
| Database | PostgreSQL |
| Cache/Queue | Redis |
| Frontend | Next.js + Tailwind |
| GPU | CUDA (planned) |
| Blockchain | Solana |
| Deploy | Docker |

---

## Contributing

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/PROTON.git

# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git commit -m "feat: your feature"

# Push and create PR
git push origin feature/your-feature
```

---

## License

MIT

---

**PROTON** - AI Compute for Solana.

*Mine. Earn. Build the future.*
