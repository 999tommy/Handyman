# 🚀 Production Deployment Guide

This guide covers deploying your Handyman Marketplace backend to production.

## Deployment Options

### Option 1: Railway (Recommended - Easiest)

**Pros**: Auto-deploy from Git, free tier, built-in PostgreSQL
**Pricing**: Free tier available, ~$5/month for starter

#### Steps:

1. **Prepare Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-github-repo-url
   git push -u origin main
   ```

2. **Deploy to Railway**
   - Go to [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Connect your GitHub repository
   - Railway will auto-detect Node.js

3. **Add Environment Variables**
   - In Railway dashboard, go to Variables
   - Add all variables from `.env` (except PORT)
   - Railway automatically sets PORT

4. **Add Custom Domain (Optional)**
   - Settings > Domains
   - Add custom domain or use Railway subdomain

**Done!** Your API is live at `https://your-app.up.railway.app`

---

### Option 2: Render

**Pros**: Free tier, easy SSL, good documentation
**Pricing**: Free tier available

#### Steps:

1. **Create render.yaml**
   ```yaml
   services:
     - type: web
       name: handyman-api
       env: node
       buildCommand: npm install
       startCommand: npm start
       envVars:
         - key: NODE_ENV
           value: production
   ```

2. **Deploy**
   - Go to [render.com](https://render.com)
   - New > Web Service
   - Connect GitHub repo
   - Render auto-detects settings

3. **Add Environment Variables**
   - Environment tab
   - Add all from `.env`

---

### Option 3: DigitalOcean App Platform

**Pros**: Reliable, scalable, $5/month
**Pricing**: Starts at $5/month

#### Steps:

1. **Deploy from GitHub**
   - Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
   - Apps > Create App
   - Connect GitHub

2. **Configure**
   - App Spec:
     ```yaml
     name: handyman-marketplace
     region: nyc
     services:
     - name: api
       github:
         repo: your-username/handyman-backend
         branch: main
       run_command: npm start
       environment_slug: node-js
       instance_count: 1
       instance_size_slug: basic-xxs
     ```

---

### Option 4: VPS (Advanced)

For full control, deploy to a VPS (DigitalOcean Droplet, AWS EC2, Linode).

#### Steps:

1. **Create Ubuntu 22.04 Server**

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install PM2**
   ```bash
   sudo npm install -g pm2
   ```

4. **Clone Repository**
   ```bash
   git clone your-repo-url
   cd handyman-backend
   npm install
   ```

5. **Create .env**
   ```bash
   nano .env
   # Paste your production environment variables
   ```

6. **Start with PM2**
   ```bash
   pm2 start server.js --name handyman-api
   pm2 startup
   pm2 save
   ```

7. **Setup Nginx Reverse Proxy**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/handyman
   ```

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/handyman /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

8. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## Production Checklist

### Environment Variables

```env
NODE_ENV=production
PORT=5000
API_URL=https://api.yourdomain.com

# Use Production Supabase Project
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your_prod_anon_key
SUPABASE_SERVICE_KEY=your_prod_service_key

# Strong JWT Secret (generate new one)
JWT_SECRET=your_production_jwt_secret

# Production CORS
CORS_ORIGIN=https://yourapp.com,https://www.yourapp.com

# Live Payment Keys
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx

# Production SMS
SMS_PROVIDER=africastalking
SMS_API_KEY=your_live_api_key

# Firebase Production
FIREBASE_SERVER_KEY=your_production_server_key
```

### Security Checklist

- [ ] ✅ Use HTTPS only
- [ ] ✅ Set strong JWT_SECRET (64+ characters)
- [ ] ✅ Enable rate limiting (already configured)
- [ ] ✅ Use production Supabase project
- [ ] ✅ Enable Supabase RLS policies
- [ ] ✅ Use live payment gateway keys
- [ ] ✅ Set secure CORS origins
- [ ] ✅ Remove console.log statements
- [ ] ✅ Set up error monitoring (Sentry)
- [ ] ✅ Enable database backups
- [ ] ✅ Use environment secrets (not .env file)

### Database Setup

1. **Create Production Supabase Project**
   - Go to Supabase Dashboard
   - Create new project (different from dev)
   - Run `database-schema.sql`
   - Enable PostGIS extension

2. **Configure RLS Policies**
   ```sql
   -- Add comprehensive RLS policies
   -- See database-schema.sql for examples
   ```

3. **Setup Backups**
   - Supabase Pro has automated backups
   - Or set up manual backups:
     ```bash
     pg_dump $DATABASE_URL > backup.sql
     ```

### Monitoring & Logging

#### Option 1: Sentry (Error Tracking)

```bash
npm install @sentry/node
```

In `server.js`:
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: process.env.NODE_ENV,
});
```

#### Option 2: PM2 Monitoring

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

View logs:
```bash
pm2 logs handyman-api
pm2 monit
```

### Performance Optimization

1. **Enable Compression**
   ```bash
   npm install compression
   ```

   In `app.js`:
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

2. **Add Caching** (Redis)
   ```bash
   npm install redis
   ```

3. **Optimize Database Queries**
   - Add indexes (already in schema)
   - Use connection pooling
   - Monitor slow queries in Supabase Dashboard

### SSL Certificate

For VPS deployments:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal (certbot sets this up automatically)
sudo certbot renew --dry-run
```

### CI/CD Pipeline

Example GitHub Actions (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
```

### Health Monitoring

Set up uptime monitoring:

1. **UptimeRobot** (free)
   - Monitor `/health` endpoint
   - Get alerts if down

2. **Pingdom** or **Better Uptime**

3. **Custom Script**
   ```bash
   # cron job every 5 minutes
   */5 * * * * curl -f https://api.yourdomain.com/health || echo "API DOWN" | mail -s "Alert" admin@yourdomain.com
   ```

### Database Migrations

For schema changes:

1. **Test in development first**
2. **Backup production database**
3. **Run migration during low-traffic hours**
4. **Have rollback plan ready**

Example migration script:
```sql
-- Add new column
ALTER TABLE artisans ADD COLUMN new_field VARCHAR(100);

-- Update existing data
UPDATE artisans SET new_field = 'default_value';
```

### Scaling Considerations

When you need to scale:

1. **Horizontal Scaling**
   - Deploy multiple instances behind load balancer
   - Use Redis for session storage (Socket.io)
   - Share nothing architecture

2. **Database Scaling**
   - Upgrade Supabase plan
   - Add read replicas
   - Implement caching layer

3. **Socket.io Clustering**
   ```bash
   npm install @socket.io/redis-adapter
   ```

### Costs Estimation

**Starter Setup** (~$15/month):
- Railway/Render: $5-10/month
- Supabase Pro: $25/month (optional, free tier works)
- Domain: $12/year
- SSL: Free (Let's Encrypt)

**Growing** (~$50/month):
- VPS (2GB RAM): $10/month
- Supabase Pro: $25/month
- Redis: $10/month
- Monitoring: $5/month

**Enterprise** ($500+/month):
- Multiple servers: $100+
- Database: $100+
- CDN: $50+
- Monitoring & logging: $100+

---

## Testing in Production

### Smoke Tests

```bash
# Health check
curl https://api.yourdomain.com/health

# Register test user
curl -X POST https://api.yourdomain.com/api/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","email":"test@test.com","password":"Test123!","phone_number":"+2348012345678"}'

# Socket.io connection
# Use socket.io-client to connect and verify
```

### Load Testing

```bash
npm install -g artillery

artillery quick --count 100 --num 10 https://api.yourdomain.com/health
```

---

## Rollback Plan

If deployment fails:

1. **Revert to previous version**
   ```bash
   git revert HEAD
   git push
   ```

2. **Restore database backup** (if needed)

3. **Update DNS** (if domain changed)

---

## Support & Maintenance

### Regular Tasks

- **Weekly**: Check logs for errors
- **Monthly**: Review performance metrics
- **Quarterly**: Security audit, dependency updates
- **Yearly**: Renew domain, review costs

### Updates

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit
npm audit fix
```

---

**🎉 Your backend is now production-ready!**

For issues, check:
- Server logs
- Supabase Dashboard > Logs
- Error monitoring (Sentry)
- Health endpoint
