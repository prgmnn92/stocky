# Stocky - Digital Ocean Deployment Guide

Complete guide for deploying Stocky to Digital Ocean.

## Prerequisites

- Digital Ocean account
- Domain name (optional but recommended for SSL)
- Git installed locally
- SSH key added to Digital Ocean

## Deployment Options

### Option 1: Docker Droplet (Recommended)
- **Cost**: $6-12/month (Basic or Regular Droplet)
- **Setup Time**: 15-20 minutes
- **Best For**: Simple deployment, learning

### Option 2: App Platform
- **Cost**: $12-24/month
- **Setup Time**: 10 minutes
- **Best For**: Managed service, auto-scaling

This guide covers **Option 1: Docker Droplet** (more cost-effective and flexible).

---

## Part 1: Create Digital Ocean Droplet

### 1.1 Create Droplet

1. Log into Digital Ocean → Create → Droplets
2. Choose configuration:
   - **Image**: Docker on Ubuntu 22.04
   - **Plan**: Basic ($6/mo - 1GB RAM, 1 vCPU, 25GB SSD)
   - **Datacenter**: Choose closest to you
   - **Authentication**: SSH Key (recommended) or Password
   - **Hostname**: `stocky-prod`

3. Click **Create Droplet**

### 1.2 Connect to Droplet

```bash
ssh root@your-droplet-ip
```

---

## Part 2: Server Setup

### 2.1 Update System

```bash
apt update && apt upgrade -y
```

### 2.2 Install Additional Tools

```bash
apt install -y git curl nano
```

### 2.3 Create Application User

```bash
# Create user
useradd -m -s /bin/bash stocky

# Add to docker group
usermod -aG docker stocky

# Create app directory
mkdir -p /opt/stocky
chown -R stocky:stocky /opt/stocky
```

### 2.4 Setup Firewall (UFW)

```bash
# Enable firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

---

## Part 3: Deploy Application

### 3.1 Clone Repository

```bash
# Switch to stocky user
su - stocky

# Clone repository
cd /opt/stocky
git clone https://github.com/yourusername/stocky.git .

# Or upload via SCP from local machine:
# scp -r /path/to/stocky root@your-droplet-ip:/opt/stocky/
```

### 3.2 Configure Environment Variables

```bash
# Copy production environment template
cp .env.prod.example .env.prod

# Edit with your secrets
nano .env.prod
```

**Required changes in `.env.prod`:**

```bash
# Generate secure JWT secret (run locally or on server)
openssl rand -hex 32

# Update .env.prod with generated key
JWT_SECRET_KEY=your-generated-secret-here

# Optional: Add OpenAI key for sentiment analysis
OPENAI_API_KEY=sk-your-openai-key
```

### 3.3 Create Data Directories

```bash
mkdir -p data logs logs/nginx nginx/ssl
chmod 755 data logs
```

### 3.4 Build and Start Services

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3.5 Verify Deployment

```bash
# Test backend health
curl http://localhost:8000/health

# Test frontend
curl http://your-droplet-ip/
```

---

## Part 4: Domain Setup (Optional)

### 4.1 Configure DNS

1. Go to your domain registrar (e.g., Namecheap, GoDaddy)
2. Add DNS records:
   - **A Record**: `@` → `your-droplet-ip`
   - **A Record**: `www` → `your-droplet-ip`

3. Wait for DNS propagation (5-30 minutes)

### 4.2 Install SSL Certificate (Let's Encrypt)

```bash
# Install certbot
apt install -y certbot

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop frontend

# Generate certificate
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to nginx directory
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/stocky/nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/stocky/nginx/ssl/
chown stocky:stocky /opt/stocky/nginx/ssl/*

# Update nginx.conf
nano /opt/stocky/nginx/nginx.conf
```

**In `nginx.conf`:**
1. Comment out the HTTP `location /` block
2. Uncomment the HTTPS server block
3. Update `server_name` to your domain
4. Uncomment the HTTP→HTTPS redirect

```bash
# Restart services
docker-compose -f docker-compose.prod.yml restart frontend
```

### 4.3 Auto-Renew SSL Certificate

```bash
# Add cron job for auto-renewal
crontab -e

# Add this line (runs daily at 2am)
0 2 * * * certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/stocky/nginx/ssl/ && docker-compose -f /opt/stocky/docker-compose.prod.yml restart frontend"
```

---

## Part 5: Create Admin User

### 5.1 Access Backend Container

```bash
cd /opt/stocky
docker-compose -f docker-compose.prod.yml exec backend bash
```

### 5.2 Create Admin User (Python Script)

Create a script to add users:

```bash
# Inside container
cat > /tmp/create_admin.py << 'EOF'
import os
os.chdir('/app')

from app.database import engine, create_db_and_tables
from app.models import User
from sqlmodel import Session, select
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Initialize database
create_db_and_tables(engine)

with Session(engine) as session:
    # Check if admin exists
    stmt = select(User).where(User.username == "admin")
    admin = session.exec(stmt).first()

    if not admin:
        admin = User(
            username="admin",
            email="admin@stocky.local",
            password_hash=pwd_context.hash("changeme123"),
            role="ADMIN",
            balance=100000.0
        )
        session.add(admin)
        session.commit()
        print("✅ Admin user created!")
        print("   Username: admin")
        print("   Password: changeme123")
        print("   ⚠️  CHANGE PASSWORD IMMEDIATELY!")
    else:
        print("❌ Admin user already exists")
EOF

python /tmp/create_admin.py
exit
```

**Important**: Change the admin password immediately after first login!

---

## Part 6: Monitoring & Maintenance

### 6.1 View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Backend only
docker-compose -f docker-compose.prod.yml logs -f backend

# Frontend only
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### 6.2 Restart Services

```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart backend only
docker-compose -f docker-compose.prod.yml restart backend
```

### 6.3 Update Application

```bash
cd /opt/stocky

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### 6.4 Backup Database

```bash
# Create backup script
cat > /opt/stocky/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/stocky/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /opt/stocky/data/trader.db $BACKUP_DIR/trader_$DATE.db
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
EOF

chmod +x /opt/stocky/scripts/backup.sh

# Add to crontab (daily backup at 3am)
crontab -e
# Add: 0 3 * * * /opt/stocky/scripts/backup.sh
```

### 6.5 Monitor Resources

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check container stats
docker stats
```

---

## Part 7: Scaling Up (If Needed)

### 7.1 Upgrade Droplet

If you need more resources:

1. Digital Ocean Dashboard → Droplets → Your Droplet
2. Click "Resize"
3. Choose larger plan ($12/mo for 2GB RAM)
4. Resize (no downtime required)

### 7.2 Add PostgreSQL Database (Optional)

For better performance with multiple users:

```bash
# Add PostgreSQL service to docker-compose.prod.yml
# Update DATABASE_URL in .env.prod
# Migrate data from SQLite to PostgreSQL
```

---

## Part 8: Security Best Practices

### 8.1 Disable Root Login

```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Set:
PermitRootLogin no
PasswordAuthentication no

# Restart SSH
systemctl restart sshd
```

### 8.2 Setup Automatic Updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 8.3 Enable Docker Log Rotation

```bash
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker
```

---

## Troubleshooting

### Issue: Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check disk space
df -h

# Check memory
free -h
```

### Issue: Frontend Shows 502 Error

```bash
# Check backend is running
docker-compose -f docker-compose.prod.yml ps

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend

# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend
```

### Issue: Database Locked Error

```bash
# Check database file permissions
ls -la /opt/stocky/data/

# Fix permissions
chown -R stocky:stocky /opt/stocky/data/

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

### Issue: SSL Certificate Not Working

```bash
# Check certificate files exist
ls -la /opt/stocky/nginx/ssl/

# Check nginx configuration
docker-compose -f docker-compose.prod.yml exec frontend nginx -t

# View nginx logs
docker-compose -f docker-compose.prod.yml logs frontend
```

---

## Cost Breakdown

### Basic Deployment (Recommended)
- **Droplet**: $6/month (1GB RAM)
- **Domain**: $10-15/year (optional)
- **SSL**: Free (Let's Encrypt)
- **Total**: ~$6-7/month

### With AI Features
- **Droplet**: $6/month
- **OpenAI API**: ~$5-20/month (depending on usage)
- **Total**: ~$11-26/month

---

## Quick Reference Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Update application
git pull && docker-compose -f docker-compose.prod.yml up -d --build

# Access backend shell
docker-compose -f docker-compose.prod.yml exec backend bash

# Backup database
cp data/trader.db data/trader_backup_$(date +%Y%m%d).db
```

---

## Support

- **Documentation**: Check README.md and CLAUDE.md
- **Issues**: Report on GitHub
- **Logs**: Check `/opt/stocky/logs/`

---

## Next Steps After Deployment

1. ✅ Access your app at `http://your-droplet-ip` or `https://yourdomain.com`
2. ✅ Login with admin credentials
3. ✅ Change admin password immediately
4. ✅ Add symbols to watch
5. ✅ Configure strategies
6. ✅ Wait for daily job to run (default: 20:00 Europe/Berlin)
7. ✅ Monitor logs and resource usage

**Congratulations! Your Stocky trading platform is now live! 🚀**
