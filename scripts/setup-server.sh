#!/bin/bash

##############################################################################
# Stocky - Automated Server Setup Script
#
# This script automates the complete setup of a fresh Digital Ocean droplet
# for running the Stocky trading platform.
#
# Usage:
#   1. Create a Docker on Ubuntu 22.04 droplet
#   2. SSH into the droplet: ssh root@your-droplet-ip
#   3. Run: curl -sSL https://raw.githubusercontent.com/yourusername/stocky/main/scripts/setup-server.sh | bash
#
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (or use sudo)"
    exit 1
fi

log_info "Starting Stocky server setup..."

##############################################################################
# Step 1: Update system
##############################################################################
log_info "Updating system packages..."
apt update && apt upgrade -y
log_success "System updated"

##############################################################################
# Step 2: Install Docker (if not already installed)
##############################################################################
if ! command -v docker &> /dev/null; then
    log_info "Docker not found. Installing Docker..."

    # Update package database
    apt update

    # Install prerequisites
    apt install -y ca-certificates curl gnupg lsb-release

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker compose-plugin

    log_success "Docker installed successfully"
else
    log_success "Docker is already installed"
fi

# Verify Docker is running
if ! systemctl is-active --quiet docker; then
    log_info "Starting Docker..."
    systemctl start docker
    systemctl enable docker
fi

log_success "Docker is running"

##############################################################################
# Step 3: Install required packages
##############################################################################
log_info "Installing required packages..."
apt install -y git curl nano ufw certbot
log_success "Packages installed"

##############################################################################
# Step 4: Configure firewall
##############################################################################
log_info "Configuring firewall..."
ufw --force enable
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
log_success "Firewall configured"

##############################################################################
# Step 5: Create application user
##############################################################################
log_info "Creating stocky user..."
if id "stocky" &>/dev/null; then
    log_warning "User 'stocky' already exists, skipping..."
else
    useradd -m -s /bin/bash stocky
    usermod -aG docker stocky
    log_success "User 'stocky' created"
fi

##############################################################################
# Step 5: Setup application directory
##############################################################################
log_info "Setting up application directory..."
APP_DIR="/opt/stocky"
mkdir -p $APP_DIR
cd $APP_DIR

##############################################################################
# Step 6: Clone or update repository
##############################################################################
log_info "Setting up repository..."
echo ""
echo -e "${YELLOW}Repository Setup Options:${NC}"
echo "1) Clone from GitHub (recommended)"
echo "2) Manual upload (you'll upload files via SCP later)"
echo ""
read -p "Choose option (1 or 2): " repo_option

if [ "$repo_option" = "1" ]; then
    read -p "Enter GitHub repository URL (e.g., https://github.com/yourusername/stocky.git): " repo_url

    if [ -d ".git" ]; then
        log_info "Repository exists, pulling latest changes..."
        sudo -u stocky git pull
    else
        log_info "Cloning repository..."
        sudo -u stocky git clone "$repo_url" .
    fi
    log_success "Repository setup complete"
else
    log_warning "Manual upload selected. Please upload your files to $APP_DIR"
    log_info "Example: scp -r /local/stocky/* root@$(hostname -I | awk '{print $1}'):$APP_DIR/"
    read -p "Press Enter after you've uploaded the files..."
fi

##############################################################################
# Step 7: Configure environment variables
##############################################################################
log_info "Configuring environment variables..."

if [ ! -f ".env.prod" ]; then
    cp .env.prod.example .env.prod

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/your-secure-jwt-secret-key-here-change-this/$JWT_SECRET/" .env.prod

    log_success "Environment file created with generated JWT secret"

    echo ""
    log_warning "IMPORTANT: Review and update .env.prod if needed"
    read -p "Do you want to edit .env.prod now? (y/N): " edit_env

    if [[ "$edit_env" =~ ^[Yy]$ ]]; then
        nano .env.prod
    fi
else
    log_warning ".env.prod already exists. Checking JWT_SECRET_KEY..."

    # Check if JWT_SECRET_KEY is set
    if grep -q "JWT_SECRET_KEY=your-secure-jwt-secret-key-here-change-this" .env.prod || grep -q "JWT_SECRET_KEY=$" .env.prod || ! grep -q "JWT_SECRET_KEY=" .env.prod; then
        log_warning "JWT_SECRET_KEY not configured. Generating new one..."
        JWT_SECRET=$(openssl rand -hex 32)

        # Add or update JWT_SECRET_KEY
        if grep -q "JWT_SECRET_KEY=" .env.prod; then
            sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$JWT_SECRET/" .env.prod
        else
            echo "JWT_SECRET_KEY=$JWT_SECRET" >> .env.prod
        fi

        log_success "JWT_SECRET_KEY generated and added to .env.prod"
    else
        log_success "JWT_SECRET_KEY is already configured"
    fi
fi

##############################################################################
# Step 8: Create required directories
##############################################################################
log_info "Creating data directories..."
mkdir -p data logs logs/nginx nginx/ssl backups
chmod -R 755 data logs backups
log_success "Directories created"

##############################################################################
# Step 9: Set permissions
##############################################################################
log_info "Setting file permissions..."
chown -R stocky:stocky $APP_DIR
log_success "Permissions set"

##############################################################################
# Step 10: Build and start services
##############################################################################
log_info "Building Docker images (this may take a few minutes)..."
cd $APP_DIR

# Run docker commands as root, but ensure stocky user owns the files
# Note: Using 'sg docker' to run commands with docker group without logout
docker compose -f docker-compose.prod.yml build

log_info "Starting services..."
docker compose -f docker-compose.prod.yml up -d

log_success "Services started"

##############################################################################
# Step 11: Wait for services to be healthy
##############################################################################
log_info "Waiting for services to be healthy..."
sleep 10

# Check backend health
if curl -f http://localhost:8000/health &>/dev/null; then
    log_success "Backend is healthy"
else
    log_warning "Backend health check failed, checking logs..."
    docker compose -f docker-compose.prod.yml logs backend | tail -20
fi

##############################################################################
# Step 12: Create admin user
##############################################################################
log_info "Creating admin user..."

docker compose -f docker-compose.prod.yml exec -T backend python << 'EOF'
import os
os.chdir('/app')

from app.database import engine, create_db_and_tables
from app.models import User
from sqlmodel import Session, select
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

create_db_and_tables(engine)

with Session(engine) as session:
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
        print("✅ Admin user created")
    else:
        print("ℹ️  Admin user already exists")
EOF

log_success "Admin user setup complete"

##############################################################################
# Step 13: Setup backup cron job
##############################################################################
log_info "Setting up automated backups..."

cat > /opt/stocky/scripts/backup.sh << 'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="/opt/stocky/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /opt/stocky/data/trader.db $BACKUP_DIR/trader_$DATE.db
# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
BACKUP_EOF

chmod +x /opt/stocky/scripts/backup.sh

# Add to crontab if not already present
(crontab -l 2>/dev/null | grep -v backup.sh; echo "0 3 * * * /opt/stocky/scripts/backup.sh") | crontab -

log_success "Backup cron job configured (daily at 3 AM)"

##############################################################################
# Step 14: Enable Docker log rotation
##############################################################################
log_info "Configuring Docker log rotation..."

cat > /etc/docker/daemon.json << 'DOCKER_EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DOCKER_EOF

systemctl restart docker
sleep 5
cd $APP_DIR
docker compose -f docker-compose.prod.yml up -d

log_success "Docker log rotation configured"

##############################################################################
# Final Summary
##############################################################################
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=========================================================================="
echo -e "${GREEN}✅ Stocky Server Setup Complete!${NC}"
echo "=========================================================================="
echo ""
echo -e "${BLUE}Server Information:${NC}"
echo "  IP Address: $SERVER_IP"
echo "  Application Directory: $APP_DIR"
echo ""
echo -e "${BLUE}Access Your Application:${NC}"
echo "  Web Interface: http://$SERVER_IP"
echo "  API Docs: http://$SERVER_IP/api/docs"
echo ""
echo -e "${BLUE}Default Admin Credentials:${NC}"
echo "  Username: admin"
echo "  Password: changeme123"
echo -e "  ${RED}⚠️  CHANGE THIS PASSWORD IMMEDIATELY!${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs: cd $APP_DIR && docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart: cd $APP_DIR && docker compose -f docker-compose.prod.yml restart"
echo "  Stop: cd $APP_DIR && docker compose -f docker-compose.prod.yml down"
echo "  Start: cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Access http://$SERVER_IP and login"
echo "  2. Change admin password"
echo "  3. (Optional) Setup domain with SSL - run: ./scripts/setup-domain.sh"
echo ""
echo "=========================================================================="
