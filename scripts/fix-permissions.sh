#!/bin/bash

##############################################################################
# Quick Fix Script for Permission Issues
#
# Run this if you encounter Docker permission errors during setup
##############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (or use sudo)"
    exit 1
fi

APP_DIR="/opt/stocky"
cd $APP_DIR

log_info "Fixing permissions and environment..."

# Ensure stocky user is in docker group
if ! groups stocky | grep -q docker; then
    log_info "Adding stocky user to docker group..."
    usermod -aG docker stocky
    log_success "User added to docker group"
fi

# Generate JWT secret if missing
if [ -f ".env.prod" ]; then
    if ! grep -q "JWT_SECRET_KEY=.\{20,\}" .env.prod; then
        log_info "Generating JWT_SECRET_KEY..."
        JWT_SECRET=$(openssl rand -hex 32)
        if grep -q "JWT_SECRET_KEY=" .env.prod; then
            sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$JWT_SECRET/" .env.prod
        else
            echo "JWT_SECRET_KEY=$JWT_SECRET" >> .env.prod
        fi
        log_success "JWT_SECRET_KEY configured"
    fi
fi

# Set correct permissions
log_info "Setting file permissions..."
chown -R stocky:stocky $APP_DIR
chmod -R 755 $APP_DIR
log_success "Permissions fixed"

# Build and start services as root
log_info "Building Docker images..."
docker compose -f docker-compose.prod.yml build

log_info "Starting services..."
docker compose -f docker-compose.prod.yml up -d

log_success "Services started"

# Wait and check health
sleep 10

if curl -f http://localhost:8000/health &>/dev/null; then
    log_success "Backend is healthy!"
    echo ""
    echo "=========================================================================="
    echo -e "${GREEN}✅ All Fixed!${NC}"
    echo "=========================================================================="
    echo ""
    echo "Your application is now running at:"
    echo "  http://$(hostname -I | awk '{print $1}')"
    echo ""
else
    log_error "Backend health check failed"
    echo "Checking logs..."
    docker compose -f docker-compose.prod.yml logs backend | tail -30
fi
