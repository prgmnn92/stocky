# Deployment Guide

Production deployment checklist and instructions for Stocky.

## Pre-Deployment Checklist

### Security
- [ ] Generate secure API keys for data providers
- [ ] Use strong database passwords (if not SQLite)
- [ ] Enable CORS only for trusted domains
- [ ] Review and restrict API endpoint access
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules

### Configuration
- [ ] Set `APP_ENV=prod` in environment
- [ ] Configure timezone correctly
- [ ] Set appropriate logging level (INFO or WARNING)
- [ ] Configure scheduler time for market hours
- [ ] Set reasonable `LOOKBACK_DAYS` (default: 400)

### Data Management
- [ ] Plan database backup strategy
- [ ] Configure log rotation
- [ ] Set up monitoring alerts
- [ ] Test data provider rate limits

### Testing
- [ ] Run full test suite: `make test`
- [ ] Verify strategy logic with backtest
- [ ] Test manual job trigger
- [ ] Validate signal quality
- [ ] Test API endpoints

## Deployment Options

### Option 1: Single VPS (Recommended for MVP)

**Requirements**:
- Ubuntu 22.04 or similar
- 2 CPU cores
- 2GB RAM
- 10GB storage
- Docker and Docker Compose

**Steps**:

1. **Set up server**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Create application user
sudo useradd -m -s /bin/bash trader
sudo usermod -aG docker trader
```

2. **Deploy application**:
```bash
# Switch to trader user
sudo su - trader

# Clone repository (or upload files)
git clone https://github.com/yourusername/stocky.git
cd stocky

# Create .env file
cp .env.example .env
nano .env  # Edit configuration

# Create data directory
mkdir -p data

# Build and start
docker-compose up -d

# Initialize database
docker-compose exec app python scripts/init_db.py

# Check logs
docker-compose logs -f
```

3. **Set up reverse proxy (optional)**:

**Nginx configuration** (`/etc/nginx/sites-available/stocky`):
```nginx
server {
    listen 80;
    server_name stocky.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/stocky /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. **SSL with Let's Encrypt**:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d stocky.yourdomain.com
```

### Option 2: Cloud Platform (AWS, GCP, Azure)

**AWS ECS Fargate** (Serverless):

1. **Build and push image**:
```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_REPO

# Build and push
docker build -t stocky:latest .
docker tag stocky:latest YOUR_ECR_REPO:latest
docker push YOUR_ECR_REPO:latest
```

2. **Create ECS task definition**:
```json
{
  "family": "stocky",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "stocky",
    "image": "YOUR_ECR_REPO:latest",
    "portMappings": [{
      "containerPort": 8000,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "APP_ENV", "value": "prod"},
      {"name": "TZ", "value": "Europe/Berlin"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/stocky",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

3. **Create ECS service with ALB**.

**Note**: For production, consider RDS (PostgreSQL) instead of SQLite.

### Option 3: Kubernetes (Scalable)

**Basic deployment** (`k8s/deployment.yaml`):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stocky
spec:
  replicas: 2
  selector:
    matchLabels:
      app: stocky
  template:
    metadata:
      labels:
        app: stocky
    spec:
      containers:
      - name: stocky
        image: stocky:latest
        ports:
        - containerPort: 8000
        env:
        - name: APP_ENV
          value: "prod"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: stocky-secrets
              key: database-url
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: stocky-data
---
apiVersion: v1
kind: Service
metadata:
  name: stocky
spec:
  selector:
    app: stocky
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer
```

## Database Migration (SQLite → PostgreSQL)

When scaling beyond MVP:

1. **Install PostgreSQL**:
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=stocky \
  -p 5432:5432 \
  postgres:15
```

2. **Update `.env`**:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/stocky
```

3. **Migrate data** (use Alembic or manual export):
```bash
# Export from SQLite
sqlite3 data/trader.db .dump > backup.sql

# Import to PostgreSQL (manual mapping required)
# Or use a migration tool like pgloader
```

4. **Update connection settings**:
- Remove SQLite-specific `connect_args` from `app/database.py`
- Configure connection pooling for PostgreSQL

## Monitoring and Maintenance

### Health Checks

**Endpoint**: `GET /health`

**Monitoring script** (`scripts/healthcheck.sh`):
```bash
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ $response != "200" ]; then
    echo "Health check failed: $response"
    # Send alert (email, Slack, PagerDuty, etc.)
    exit 1
fi
```

**Cron job**:
```bash
*/5 * * * * /path/to/scripts/healthcheck.sh
```

### Log Management

**Rotate logs** (`/etc/logrotate.d/stocky`):
```
/var/log/stocky/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    create 644 trader trader
}
```

**View logs**:
```bash
# Docker
docker-compose logs -f --tail=100

# Systemd (if running as service)
journalctl -u stocky -f
```

### Database Backups

**Daily backup script** (`scripts/backup_db.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/backups/stocky"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR

# Backup SQLite
cp data/trader.db "$BACKUP_DIR/trader_$DATE.db"

# Compress
gzip "$BACKUP_DIR/trader_$DATE.db"

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.db.gz" -mtime +30 -delete

echo "Backup completed: trader_$DATE.db.gz"
```

**Cron job**:
```bash
0 2 * * * /path/to/scripts/backup_db.sh
```

### Performance Monitoring

**Key metrics**:
- API response times
- Job execution duration
- Database query performance
- Memory usage
- CPU usage

**Monitoring tools**:
- Prometheus + Grafana
- DataDog
- New Relic
- CloudWatch (AWS)

## Troubleshooting

### High Memory Usage
- Reduce `LOOKBACK_DAYS` to fetch less historical data
- Optimize strategy calculations
- Consider PostgreSQL for better memory management

### Slow API Responses
- Add database indexes on frequently queried columns
- Implement caching layer (Redis)
- Use connection pooling

### Scheduler Not Running
- Check timezone configuration
- Verify cron expression
- Check logs for scheduler errors
- Ensure APScheduler is started in `main.py`

### Data Provider Rate Limits
- Implement exponential backoff
- Add delays between API calls
- Consider premium data provider tier
- Cache data more aggressively

## Security Hardening

### Application Level
1. **API Authentication**: Add JWT or API key authentication
2. **Rate Limiting**: Implement rate limiting on endpoints
3. **Input Validation**: Validate all user inputs
4. **Error Handling**: Don't expose stack traces in production

### Infrastructure Level
1. **Firewall**: Only expose port 8000 (or 443 for HTTPS)
2. **SSH**: Use key-based authentication, disable password login
3. **Updates**: Keep system and dependencies updated
4. **Backups**: Store backups securely (encrypted, off-site)

### Docker Security
1. **Non-root user**: ✓ Already implemented
2. **Read-only filesystem**: Consider for containers
3. **Resource limits**: Set memory/CPU limits
4. **Image scanning**: Use `docker scan` or Snyk

## Scaling Considerations

### Horizontal Scaling (Multiple Instances)

**Challenges with SQLite**:
- File-based, not designed for concurrent writes
- Migrate to PostgreSQL for multi-instance deployment

**Load balancing**:
- Use Nginx, HAProxy, or cloud load balancer
- Implement session affinity if needed
- Share database connection

### Vertical Scaling (Bigger Machine)

**When to scale**:
- > 100 symbols being tracked
- > 10 strategies running
- Response times > 1 second
- Memory usage > 80%

**Resource recommendations**:
- Small: 1 CPU, 1GB RAM (< 50 symbols)
- Medium: 2 CPU, 2GB RAM (50-100 symbols)
- Large: 4 CPU, 4GB RAM (> 100 symbols)

## Support and Updates

### Update Process

1. **Test in staging**:
```bash
git pull origin main
docker-compose build
docker-compose up -d
```

2. **Backup production**:
```bash
./scripts/backup_db.sh
```

3. **Deploy to production**:
```bash
docker-compose down
git pull origin main
docker-compose up -d
```

4. **Verify health**:
```bash
curl http://localhost:8000/health
docker-compose logs -f --tail=50
```

### Rollback Procedure

```bash
# Stop current version
docker-compose down

# Restore database
cp /backups/stocky/trader_YYYYMMDD.db.gz data/
gunzip data/trader_YYYYMMDD.db.gz

# Checkout previous version
git checkout <previous-commit>

# Rebuild and start
docker-compose up -d
```

---

**Need help?** Check the [README](README.md) or open an issue on GitHub.
