# Deploying Ad Studio to AWS (EC2 + GitHub Actions)

Pushes to `main` run CI (types, lint, build). When `DEPLOY_ENABLED` is on,
they also build the Docker image, push it to GHCR, and restart the app on
the EC2 instance. SQLite and generated media live on the instance disk at
`/opt/ad-studio/data`, so deploys never lose data.

Single instance by design — SQLite + the in-process job queue are
single-process. Do not add instances until the Supabase migration.

## One-time setup

### 1. Launch the EC2 instance (AWS console)

- AMI: **Ubuntu Server 24.04 LTS**, type: **t3.small** (~$15/mo; t3.micro
  works but is tight during builds of large images)
- Storage: 20 GB gp3
- Security group: allow **22** (SSH, ideally your IP only) and **80** (HTTP)
- Create/download a key pair (`.pem`)
- Allocate an **Elastic IP** and associate it, so the address survives restarts

### 2. Prepare the server (SSH in once)

```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

sudo apt-get update && sudo apt-get install -y docker.io curl
sudo usermod -aG docker ubuntu && newgrp docker

sudo mkdir -p /opt/ad-studio/data
sudo tee /opt/ad-studio/.env > /dev/null << 'EOF'
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
OPENAI_API_KEY=...
STAGING_PASSWORD=...
AI_DAILY_BUDGET_USD=10
EOF
sudo chmod 600 /opt/ad-studio/.env
```

### 3. Wire up GitHub (repo → Settings)

Secrets (Actions → New repository secret):

| Secret        | Value                                   |
| ------------- | --------------------------------------- |
| `EC2_HOST`    | the Elastic IP                          |
| `EC2_USER`    | `ubuntu`                                |
| `EC2_SSH_KEY` | full contents of the `.pem` private key |

Variables (Actions → Variables): set `DEPLOY_ENABLED` = `true`.

### 4. Deploy

Push to `main` (or run the workflow manually from the Actions tab). The
app comes up at `http://YOUR_ELASTIC_IP` behind the staging password.

## Later, when it matters

- **HTTPS/domain**: point a subdomain at the Elastic IP and put Caddy on
  the instance (`caddy reverse-proxy --from staging.yourdomain.com --to :80`)
  — automatic TLS, one command.
- **DB backup**: `/opt/ad-studio/data` is the whole state. A nightly
  `aws s3 cp` cron of `ad-studio.db` is plenty for staging.
- **Rollback**: every deploy is also tagged with the commit SHA —
  `docker run ... ghcr.io/naumanarsh/ad_studio:<sha>` on the server.
