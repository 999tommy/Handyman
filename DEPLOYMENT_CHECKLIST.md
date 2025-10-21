# ✅ Deployment Checklist

## Before Deployment

- [ ] All code is working locally
- [ ] Database schema installed in Supabase
- [ ] `.env` file has real Supabase credentials (not placeholders)
- [ ] Test at least one endpoint locally
- [ ] Code is committed to Git

## Deployment Steps

- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Sign up for Railway.app
- [ ] Deploy from GitHub repo
- [ ] Add ALL environment variables in Railway
- [ ] Wait for deployment to complete
- [ ] Copy Railway URL

## Testing Deployed Backend

- [ ] Visit `https://YOUR-URL.com/health` - should return `{"status": "ok"}`
- [ ] Test registration endpoint with Postman/curl
- [ ] Create test customer account
- [ ] Create test artisan account
- [ ] Verify accounts exist in Supabase

## For Frontend Developer

### Files to Send:
- [ ] `API_FOR_FRONTEND.md` - Complete API documentation
- [ ] Railway URL - `https://your-app.up.railway.app`
- [ ] Test credentials (customer + artisan)

### Information to Share:
```
API Base URL: https://your-app.up.railway.app/api
Socket.io URL: wss://your-app.up.railway.app

Test Customer:
Email: test.customer@test.com
Password: TestPass123!

Test Artisan:
Email: test.artisan@test.com  
Password: TestPass123!
```

## Post-Deployment

- [ ] Monitor Railway logs for errors
- [ ] Check Supabase for new data
- [ ] Coordinate with frontend dev for testing
- [ ] Set up error monitoring (optional: Sentry)

---

## Quick Commands

**Push to GitHub:**
```bash
git init
git add .
git commit -m "Backend ready"
git remote add origin https://github.com/YOUR_USERNAME/handyman-backend.git
git push -u origin main
```

**Test Deployed API:**
```bash
curl https://YOUR-RAILWAY-URL.com/health
```

**Create Test Customer:**
```bash
curl -X POST https://YOUR-URL.com/api/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test Customer","email":"test.customer@test.com","password":"TestPass123!","phone_number":"+2348012345678"}'
```

---

## What NOT To Do

❌ Don't deploy to Netlify (doesn't support Express.js)
❌ Don't commit `.env` file to GitHub
❌ Don't use test/fake Supabase credentials
❌ Don't skip environment variables in Railway
❌ Don't forget to test after deployment

---

**Total Time Required:** ~15-20 minutes

**Recommended Platform:** Railway (easiest + free tier)

**Alternative:** Render.com (also free)
