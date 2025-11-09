#!/bin/bash

##############################################################################
# Stocky - Domain & SSL Setup Script
#
# This script automates domain configuration and SSL certificate setup
# for Stocky. Supports both main domains and subdomains.
#
# Usage:
#   cd /opt/stocky
#   ./scripts/setup-domain.sh
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

APP_DIR="/opt/stocky"
cd $APP_DIR

log_info "Starting domain and SSL setup..."

##############################################################################
# Step 1: Get domain information
##############################################################################
echo ""
echo -e "${BLUE}Domain Configuration${NC}"
echo "=========================================================================="
echo ""

SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"
echo ""
echo "Enter your domain or subdomain (e.g., stocky.yourdomain.com)"
read -p "Domain: " DOMAIN

if [ -z "$DOMAIN" ]; then
    log_error "Domain cannot be empty"
    exit 1
fi

echo ""
log_info "Domain: $DOMAIN"

##############################################################################
# Step 2: Verify DNS configuration
##############################################################################
log_info "Verifying DNS configuration..."
echo ""
echo -e "${YELLOW}Before continuing, ensure your DNS is configured:${NC}"
echo ""
echo "For subdomain (e.g., stocky.yourdomain.com):"
echo "  Type: A Record"
echo "  Name: stocky (or your subdomain)"
echo "  Value: $SERVER_IP"
echo "  TTL: 3600 (or default)"
echo ""
echo "For main domain (e.g., yourdomain.com):"
echo "  Type: A Record"
echo "  Name: @ (or leave blank)"
echo "  Value: $SERVER_IP"
echo "  TTL: 3600 (or default)"
echo ""

# Check DNS resolution
log_info "Checking DNS resolution..."
RESOLVED_IP=$(dig +short "$DOMAIN" | tail -n1)

if [ -z "$RESOLVED_IP" ]; then
    log_warning "DNS not resolving yet. This may take 5-30 minutes after DNS configuration."
    read -p "Continue anyway? (y/N): " continue_dns
    if [[ ! "$continue_dns" =~ ^[Yy]$ ]]; then
        log_error "Exiting. Please configure DNS first."
        exit 1
    fi
elif [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
    log_warning "DNS resolves to $RESOLVED_IP but server IP is $SERVER_IP"
    read -p "Continue anyway? (y/N): " continue_dns
    if [[ ! "$continue_dns" =~ ^[Yy]$ ]]; then
        log_error "Exiting. Please check DNS configuration."
        exit 1
    fi
else
    log_success "DNS correctly resolves to $SERVER_IP"
fi

##############################################################################
# Step 3: Get email for Let's Encrypt
##############################################################################
echo ""
read -p "Enter email for SSL certificate notifications: " EMAIL

if [ -z "$EMAIL" ]; then
    log_error "Email cannot be empty"
    exit 1
fi

##############################################################################
# Step 4: Stop frontend temporarily
##############################################################################
log_info "Stopping frontend service temporarily..."
cd $APP_DIR
docker-compose -f docker-compose.prod.yml stop frontend
log_success "Frontend stopped"

##############################################################################
# Step 5: Obtain SSL certificate
##############################################################################
log_info "Obtaining SSL certificate from Let's Encrypt..."
echo ""

# Check if certificate already exists
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log_warning "Certificate for $DOMAIN already exists"
    read -p "Renew certificate? (y/N): " renew_cert
    if [[ "$renew_cert" =~ ^[Yy]$ ]]; then
        certbot renew --cert-name "$DOMAIN"
    fi
else
    # Obtain new certificate
    certbot certonly --standalone \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --preferred-challenges http

    if [ $? -eq 0 ]; then
        log_success "SSL certificate obtained successfully"
    else
        log_error "Failed to obtain SSL certificate"
        docker-compose -f docker-compose.prod.yml up -d frontend
        exit 1
    fi
fi

##############################################################################
# Step 6: Copy certificates to nginx directory
##############################################################################
log_info "Copying SSL certificates..."
mkdir -p $APP_DIR/nginx/ssl
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $APP_DIR/nginx/ssl/
chown -R stocky:stocky $APP_DIR/nginx/ssl/
chmod 600 $APP_DIR/nginx/ssl/*.pem
log_success "Certificates copied"

##############################################################################
# Step 7: Update nginx configuration
##############################################################################
log_info "Updating nginx configuration..."

# Create backup of current config
cp $APP_DIR/nginx/nginx.conf $APP_DIR/nginx/nginx.conf.backup

# Update nginx config with domain and enable HTTPS
sed -i "s/server_name _;/server_name $DOMAIN;/" $APP_DIR/nginx/nginx.conf
sed -i "s/# server_name your-domain.com;/server_name $DOMAIN;/" $APP_DIR/nginx/nginx.conf

# Uncomment HTTPS redirect
sed -i 's|#     return 301 https://\$host\$request_uri;|    return 301 https://\$host\$request_uri;|' $APP_DIR/nginx/nginx.conf

# Comment out HTTP location block (keep only for redirect)
sed -i '/^        # Comment out in production with SSL$/,/^        }$/ s/^/        # /' $APP_DIR/nginx/nginx.conf

# Uncomment HTTPS server block
sed -i 's/^    # server {/    server {/' $APP_DIR/nginx/nginx.conf
sed -i 's/^    #     /    /' $APP_DIR/nginx/nginx.conf
sed -i 's/^    # }/    }/' $APP_DIR/nginx/nginx.conf

log_success "Nginx configuration updated"

##############################################################################
# Step 8: Restart services
##############################################################################
log_info "Restarting services..."
cd $APP_DIR
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
sleep 10

log_success "Services restarted"

##############################################################################
# Step 9: Test SSL certificate
##############################################################################
log_info "Testing SSL configuration..."
if curl -fk "https://$DOMAIN/health" &>/dev/null; then
    log_success "HTTPS is working!"
else
    log_warning "HTTPS test failed. Check logs for details."
fi

##############################################################################
# Step 10: Setup automatic certificate renewal
##############################################################################
log_info "Setting up automatic certificate renewal..."

# Create renewal script
cat > /opt/stocky/scripts/renew-cert.sh << EOF
#!/bin/bash
certbot renew --quiet --deploy-hook "\\
    cp /etc/letsencrypt/live/$DOMAIN/*.pem /opt/stocky/nginx/ssl/ && \\
    chown stocky:stocky /opt/stocky/nginx/ssl/*.pem && \\
    chmod 600 /opt/stocky/nginx/ssl/*.pem && \\
    cd /opt/stocky && \\
    docker-compose -f docker-compose.prod.yml restart frontend"
EOF

chmod +x /opt/stocky/scripts/renew-cert.sh

# Add to crontab if not already present
(crontab -l 2>/dev/null | grep -v renew-cert.sh; echo "0 2 * * * /opt/stocky/scripts/renew-cert.sh >> /var/log/certbot-renew.log 2>&1") | crontab -

log_success "Certificate auto-renewal configured (daily at 2 AM)"

##############################################################################
# Step 11: Update firewall (if needed)
##############################################################################
log_info "Verifying firewall configuration..."
if ! ufw status | grep -q "443/tcp.*ALLOW"; then
    ufw allow 443/tcp
    log_success "Opened port 443 for HTTPS"
fi

##############################################################################
# Final Summary
##############################################################################
echo ""
echo "=========================================================================="
echo -e "${GREEN}✅ Domain & SSL Setup Complete!${NC}"
echo "=========================================================================="
echo ""
echo -e "${BLUE}Your Application is Now Available At:${NC}"
echo "  🔒 https://$DOMAIN"
echo "  📚 API Docs: https://$DOMAIN/api/docs"
echo ""
echo -e "${BLUE}SSL Certificate Information:${NC}"
echo "  Domain: $DOMAIN"
echo "  Issuer: Let's Encrypt"
echo "  Auto-Renewal: Enabled (daily check at 2 AM)"
echo "  Valid Until: $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/cert.pem | cut -d= -f2)"
echo ""
echo -e "${BLUE}Certificate Management:${NC}"
echo "  View certificates: certbot certificates"
echo "  Manual renewal: certbot renew"
echo "  Revoke certificate: certbot revoke --cert-path /etc/letsencrypt/live/$DOMAIN/cert.pem"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo "  • HTTP traffic will automatically redirect to HTTPS"
echo "  • Certificates will auto-renew 30 days before expiration"
echo "  • Backup of old nginx config: $APP_DIR/nginx/nginx.conf.backup"
echo ""
echo -e "${GREEN}🎉 Your Stocky platform is now secured with SSL!${NC}"
echo "=========================================================================="
