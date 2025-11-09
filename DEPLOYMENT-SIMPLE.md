# Stocky - Simple Deployment Guide (Automated)

Deploy Stocky to Digital Ocean in **3 simple steps** using automated scripts.

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Digital Ocean account
- (Optional) Domain or subdomain for SSL

### Total Cost
- **Basic**: $6/month (Digital Ocean droplet only)
- **With domain**: $7/month + domain cost (~$10-15/year)

---

## Step 1: Create Digital Ocean Droplet

1. Go to [Digital Ocean](https://cloud.digitalocean.com) → **Create** → **Droplets**

2. Select:
   - **Image**: `Ubuntu 22.04 (LTS) x64` (under OS tab)
     - *Note: Script will install Docker automatically - no need for Docker marketplace image*
   - **Plan**: Basic - $6/mo (1GB RAM, 1 vCPU, 25GB SSD)
   - **Region**: Choose closest to you
   - **Authentication**: Add your SSH key (recommended)
   - **Hostname**: `stocky-prod`

3. Click **Create Droplet**

4. Wait ~60 seconds for droplet to be ready

---

## Step 2: Run Automated Setup Script

SSH into your droplet and run the setup script:

```bash
# SSH into your new droplet
ssh root@your-droplet-ip

# Download and run the setup script
curl -sSL https://raw.githubusercontent.com/yourusername/stocky/main/scripts/setup-server.sh | bash
```

**OR if you want to upload files manually:**

```bash
# On your local machine
scp -r /path/to/stocky root@your-droplet-ip:/opt/stocky/

# SSH into droplet
ssh root@your-droplet-ip

# Run setup
cd /opt/stocky
chmod +x scripts/setup-server.sh
./scripts/setup-server.sh
```

### What the script does:
- ✅ Updates system packages
- ✅ Configures firewall
- ✅ Sets up Docker and application user
- ✅ Clones your repository
- ✅ Generates secure JWT secret
- ✅ Builds and starts all services
- ✅ Creates admin user
- ✅ Sets up automated backups

**That's it! Your app is now running at `http://your-droplet-ip`**

---

## Step 3: Setup Domain & SSL (Optional but Recommended)

If you want to use a domain/subdomain with SSL:

### 3.1 Configure DNS

In your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare):

**For subdomain (e.g., stocky.yourdomain.com):**
```
Type: A Record
Name: stocky
Value: your-droplet-ip
TTL: 3600
```

**For main domain (e.g., yourdomain.com):**
```
Type: A Record
Name: @ (or leave blank)
Value: your-droplet-ip
TTL: 3600
```

Wait 5-30 minutes for DNS propagation.

### 3.2 Run SSL Setup Script

```bash
# SSH into your droplet (if not already connected)
ssh root@your-droplet-ip

# Run domain setup script
cd /opt/stocky
./scripts/setup-domain.sh
```

The script will:
- ✅ Verify DNS configuration
- ✅ Obtain SSL certificate from Let's Encrypt
- ✅ Configure Nginx for HTTPS
- ✅ Setup automatic certificate renewal
- ✅ Enable HTTPS redirect

**Your app is now secured at `https://your-domain.com`** 🔒

---

## 🎉 You're Done!

### Access Your Application

- **Web Interface**: `https://your-domain.com` (or `http://your-droplet-ip`)
- **API Documentation**: `https://your-domain.com/api/docs`

### Default Credentials

```
Username: admin
Password: changeme123
```

**⚠️ CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

---

## 📋 Common Commands

```bash
# View logs
cd /opt/stocky
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop application
docker-compose -f docker-compose.prod.yml down

# Start application
docker-compose -f docker-compose.prod.yml up -d

# Update application
git pull
docker-compose -f docker-compose.prod.yml up -d --build

# Backup database manually
cp data/trader.db data/trader_backup_$(date +%Y%m%d).db
```

---

## 🔧 Troubleshooting

### Application not responding

```bash
cd /opt/stocky
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs
```

### Frontend shows 502 Bad Gateway

```bash
# Restart backend
cd /opt/stocky
docker-compose -f docker-compose.prod.yml restart backend
```

### SSL certificate issues

```bash
# Check certificate status
certbot certificates

# Manual renewal
certbot renew

# Check nginx logs
cd /opt/stocky
docker-compose -f docker-compose.prod.yml logs frontend
```

### Can't login

```bash
# Reset admin password
cd /opt/stocky
docker-compose -f docker-compose.prod.yml exec backend bash

# Inside container:
python << 'EOF'
import os
os.chdir('/app')
from app.database import engine
from app.models import User
from sqlmodel import Session, select
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

with Session(engine) as session:
    stmt = select(User).where(User.username == "admin")
    admin = session.exec(stmt).first()
    if admin:
        admin.password_hash = pwd_context.hash("newpassword123")
        session.add(admin)
        session.commit()
        print("Password reset to: newpassword123")
EOF
```

---

## 🔐 Security Recommendations

### 1. Change Admin Password
Login immediately and change from default password.

### 2. Disable Root SSH (After Setup)

```bash
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart sshd
```

### 3. Enable Automatic Security Updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 4. Monitor Resource Usage

```bash
# Check disk space
df -h

# Check memory
free -h

# Check Docker stats
docker stats
```

---

## 📊 What Gets Installed

- **Backend**: FastAPI application (Python)
- **Frontend**: React application served by Nginx
- **Database**: SQLite with automated backups
- **SSL**: Let's Encrypt certificates (auto-renewal)
- **Scheduler**: Daily market data fetch job (20:00 Europe/Berlin)

---

## 💡 Next Steps

1. ✅ Login and change admin password
2. ✅ Add stock symbols to watch (e.g., AAPL, MSFT, TSLA)
3. ✅ Create and enable trading strategies
4. ✅ Wait for daily job to run (default: 20:00 Europe/Berlin)
5. ✅ Monitor positions and signals
6. ✅ (Optional) Add OpenAI API key for sentiment analysis

---

## 📚 Advanced Configuration

For manual setup, advanced configuration, or troubleshooting, see:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed manual deployment guide
- [README.md](./README.md) - Application documentation
- [CLAUDE.md](./CLAUDE.md) - Development guide

---

## 🆘 Support

- **Issues**: Check logs first (`docker-compose logs`)
- **Documentation**: See README.md and DEPLOYMENT.md
- **Updates**: Run `git pull && docker-compose up -d --build`

---

## 🎯 Summary

| Task | Command | Time |
|------|---------|------|
| Create Droplet | Digital Ocean UI | 1 min |
| Run Setup Script | `curl ... \| bash` | 3-5 min |
| Configure DNS | Domain registrar | 5-30 min (propagation) |
| Setup SSL | `./scripts/setup-domain.sh` | 2 min |
| **Total** | | **~10-40 minutes** |

**Your secure trading platform is ready! Start trading! 📈**
