# Deploy PROTON ke VPS (Oracle Free Tier)

## Oracle Free Tier — 1 vCPU, 1GB RAM

**Cukup gak?** Cukup buat awal (< 100 miners).  
PostgreSQL + Redis + Node.js backend bisa jalan di 1GB.  
Tapi kalo miners mulai banyak (500+), upgrade ke 2GB+.

**Tips:** Oracle punya ARM instance 4 core / 24GB RAM **gratis**. Pake itu kalo bisa.

---

## Step-by-Step Deployment

### Step 1: Bikin Oracle Cloud Instance

1. Buka https://cloud.oracle.com (sign up free tier)
2. Go to **Compute → Instances → Create Instance**
3. Pilih:
   - **Image:** Ubuntu 22.04 (atau Oracle Linux)
   - **Shape:** VM.Standard.E2.1.Micro (free) ATAU Ampere A1 ARM (free, lebih kuat)
   - **Boot volume:** 50GB (free)
4. Download SSH key / upload key lu
5. Launch instance
6. Catat **Public IP**

### Step 2: Security Rules (Buka Port)

Di Oracle Cloud Console:
1. Go to **Networking → Virtual Cloud Networks → Your VCN**
2. Click **Security Lists → Default**
3. Add **Ingress Rules:**

| Port | Protocol | Source | Untuk |
|------|----------|--------|-------|
| 22 | TCP | 0.0.0.0/0 | SSH |
| 3001 | TCP | 0.0.0.0/0 | Backend API |
| 3000 | TCP | 0.0.0.0/0 | Frontend (optional) |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

### Step 3: SSH ke VPS

```bash
ssh -i your-key.pem ubuntu@<YOUR_VPS_IP>
```

### Step 4: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Git
sudo apt install -y git

# Install Nginx (reverse proxy)
sudo apt install -y nginx certbot python3-certbot-nginx

# Verify
node --version   # v20.x
psql --version   # 16.x
redis-cli ping   # PONG
```

### Step 5: Setup PostgreSQL

```bash
# Create database + user
sudo -u postgres psql <<EOF
CREATE USER proton WITH PASSWORD 'GANTI_PASSWORD_YANG_KUAT';
CREATE DATABASE proton OWNER proton;
GRANT ALL PRIVILEGES ON DATABASE proton TO proton;
EOF

# Test connection
psql -U proton -h localhost -d proton
# Enter password → should connect
```

### Step 6: Clone & Setup Backend

```bash
# Clone repo
cd /opt
sudo git clone https://github.com/Protonhash/PROTON.git
sudo chown -R $USER:$USER /opt/PROTON

# Install backend
cd /opt/PROTON/backend
npm install

# Create .env
cp .env.example .env
nano .env
```

**Edit `.env`:**
```env
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://proton:GANTI_PASSWORD_YANG_KUAT@localhost:5432/proton
REDIS_URL=redis://localhost:6379
JWT_SECRET=GENERATE_RANDOM_STRING_64_CHARS
TASK_TIMEOUT_MS=30000
REFERRAL_BONUS_PERCENT=5
OWNER_WALLET=6GSSHYqUKkwg9W9o8TjMPKC7RJC9ashFVabYXeRFzXiz
OWNER_FEE_PERCENT=10
OWNER_SECRET=GANTI_SECRET_YANG_KUAT
CLAIM_RATE=5000
CLAIM_MIN_POINTS=500
CLAIM_COOLDOWN_MS=7200000
CLAIM_ENABLED=false
```

**Generate random JWT secret:**
```bash
openssl rand -hex 32
```

### Step 7: Run Migrations

```bash
cd /opt/PROTON/backend
npm run migrate
# Output: "Migrations complete!"
```

### Step 8: Setup Systemd Service (auto-start)

```bash
sudo tee /etc/systemd/system/proton.service << 'EOF'
[Unit]
Description=PROTON Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/PROTON/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable proton
sudo systemctl start proton

# Check status
sudo systemctl status proton
# Should say "active (running)"

# Check logs
sudo journalctl -u proton -f
```

### Step 9: Setup Nginx Reverse Proxy

```bash
sudo tee /etc/nginx/sites-available/proton << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/proton /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 10: SSL (Optional, kalau punya domain)

```bash
# Ganti YOUR_DOMAIN dengan domain lu
sudo certbot --nginx -d YOUR_DOMAIN
# Follow prompts, auto-renew enabled
```

### Step 11: Firewall (UFW)

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3001
sudo ufw enable
```

---

## Test Deployment

Dari laptop lu:
```bash
# Health check
curl http://YOUR_VPS_IP:3001/health
# {"status":"ok","version":"0.1.0","name":"PROTON"}

# Register
curl -X POST http://YOUR_VPS_IP:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"miner1","password":"test123456"}'

# Owner dashboard
curl http://YOUR_VPS_IP:3001/api/owner/dashboard \
  -H "x-owner-secret: YOUR_OWNER_SECRET"
```

---

## Update Miner Config

Setelah deploy, user miner perlu set API URL:

**Di `~/.proton/config.json`:**
```json
{
  "api_url": "http://YOUR_VPS_IP:3001",
  "token": null,
  "username": null,
  "threads": 4,
  "gpu_enabled": false
}
```

Atau kalo punya domain:
```json
{
  "api_url": "https://api.proton.fun",
}
```

---

## Update untuk Production

### 1. Hardcode default API di miner (Rust)

Edit `miner/src/config.rs`:
```rust
api_url: "https://api.proton.fun".to_string(),
```

### 2. Rate limiting (penting!)

```bash
# Install di backend
npm install @fastify/rate-limit

# Add to index.js
await fastify.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute'
});
```

### 3. Monitoring

```bash
# Simple: PM2
npm install -g pm2
pm2 start src/index.js --name proton
pm2 save
pm2 startup

# Logs
pm2 logs proton
```

---

## Resource Usage (1c/1g VPS)

| Component | RAM | CPU |
|-----------|-----|-----|
| PostgreSQL | ~100MB | minimal |
| Redis | ~30MB | minimal |
| Node.js Backend | ~80MB | low |
| OS overhead | ~200MB | - |
| **Total** | **~410MB** | cukup |
| **Available** | ~590MB free | OK |

**Verdict: Oracle Free 1c/1g CUKUP buat start (< 100 miners)**

Kalo miners 500+, upgrade ke ARM A1 (4c/24GB, free) atau Contabo $5 (4c/8GB).

---

## Quick Deploy Script (Copy-paste semua sekaligus)

```bash
#!/bin/bash
# PROTON Quick Deploy - Run on fresh Ubuntu VPS

set -e

echo "⚡ Installing PROTON Backend..."

# System
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib redis-server nginx git

# Database
sudo -u postgres psql -c "CREATE USER proton WITH PASSWORD 'proton_prod_2024';"
sudo -u postgres psql -c "CREATE DATABASE proton OWNER proton;"

# Clone
cd /opt
sudo git clone https://github.com/Protonhash/PROTON.git
sudo chown -R $USER:$USER /opt/PROTON

# Backend
cd /opt/PROTON/backend
npm install --production

# Env
cat > .env << 'ENVEOF'
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://proton:proton_prod_2024@localhost:5432/proton
REDIS_URL=redis://localhost:6379
JWT_SECRET=$(openssl rand -hex 32)
TASK_TIMEOUT_MS=30000
REFERRAL_BONUS_PERCENT=5
OWNER_WALLET=6GSSHYqUKkwg9W9o8TjMPKC7RJC9ashFVabYXeRFzXiz
OWNER_FEE_PERCENT=10
OWNER_SECRET=$(openssl rand -hex 16)
CLAIM_RATE=5000
CLAIM_ENABLED=false
ENVEOF

# Migrate
npm run migrate

# Systemd
sudo tee /etc/systemd/system/proton.service > /dev/null << 'SVCEOF'
[Unit]
Description=PROTON Backend
After=network.target postgresql.service redis.service
[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/PROTON/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable proton
sudo systemctl start proton

echo "⚡ PROTON is live on port 3001!"
echo "Test: curl http://localhost:3001/health"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3001 gak bisa diakses | Cek Oracle Security List + UFW |
| PostgreSQL connection refused | `sudo systemctl start postgresql` |
| Redis connection refused | `sudo systemctl start redis` |
| Node crash loop | `journalctl -u proton -n 50` |
| Out of memory | Tambah swap: `sudo fallocate -l 1G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
