# 🚀 Deploy Backend for Frontend Developer

## ❌ Why Not Netlify?

**Netlify doesn't support:**
- ✗ Persistent WebSocket connections (Socket.io)
- ✗ Long-running Node.js processes
- ✗ Express.js servers

**Netlify is for:** Static sites, JAMstack, serverless functions only.

---

## ✅ Best Hosting Options for Your Backend

### Option 1: Railway (RECOMMENDED - Easiest) ⭐

**Why Railway?**
- ✅ Free tier ($5 credit/month)
- ✅ Auto-deploy from GitHub
- ✅ Supports Socket.io
- ✅ Built-in SSL
- ✅ Environment variables UI
- ✅ Zero configuration

**Steps:**

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Backend ready"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/handyman-backend.git
   git push -u origin main
   ```

2. **Deploy to Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `handyman-backend` repo
   - Railway auto-detects Node.js and deploys!

3. **Add Environment Variables**
   - In Railway dashboard, click your project
   - Go to "Variables" tab
   - Add all variables from `.env.example`:
     ```
     NODE_ENV=production
     SUPABASE_URL=your_supabase_url
     SUPABASE_ANON_KEY=your_key
     SUPABASE_SERVICE_KEY=your_service_key
     JWT_SECRET=your_secret
     # ... etc
     ```

4. **Get Your API URL**
   - Go to "Settings" → "Domains"
   - Railway gives you: `https://handyman-backend-production.up.railway.app`
   - **This is the URL to send to frontend dev!**

**Cost:** FREE for ~$5 worth of usage/month, then $5-10/month

---

### Option 2: Render (Also Great)

1. Go to [render.com](https://render.com)
2. "New" → "Web Service"
3. Connect GitHub repo
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables
6. Deploy!

**Your URL:** `https://handyman-backend.onrender.com`

**Cost:** FREE tier available (server sleeps after inactivity)

---

### Option 3: Heroku (Paid but reliable)

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create handyman-backend

# Add environment variables
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_ANON_KEY=your_key
# ... etc

# Deploy
git push heroku main
```

**Your URL:** `https://handyman-backend.herokuapp.com`

**Cost:** $7/month minimum

---

## 📤 What to Send to Frontend Developer

### 1. Create API Documentation File

I'll create this for you (see `FRONTEND_API_DOCS.md`)

### 2. Information to Share

Send your frontend developer:

✅ **API Base URL**
```
Production: https://your-app.up.railway.app/api
Socket.io: wss://your-app.up.railway.app
```

✅ **Authentication Flow**
- How to register users
- How to login
- How to handle JWT tokens
- Token refresh process

✅ **All API Endpoints**
- Full list of endpoints
- Request/response examples
- Required headers
- Error responses

✅ **Socket.io Events**
- How to connect
- Events to listen for
- Events to emit

✅ **File Upload Process**
- How to upload images
- Accepted formats
- Size limits

✅ **Test Credentials** (for development)
```
Test Customer:
Email: test.customer@example.com
Password: TestPass123!

Test Artisan:
Email: test.artisan@example.com
Password: TestPass123!
```

---

## 🔧 Quick Deployment Commands

### Railway (After GitHub push)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Add environment variable
railway variables set SUPABASE_URL=your_url

# Deploy
railway up
```

### Check if Backend is Live
```bash
curl https://your-backend-url.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-10-21T...",
  "uptime": 123.45,
  "environment": "production"
}
```

---

## 📱 Frontend Developer Setup

Your frontend dev will need to:

### 1. Install Dependencies
```bash
npm install axios socket.io-client
```

### 2. Create API Client
```javascript
// api/client.js
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = 'https://your-backend.up.railway.app';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = AsyncStorage.getItem('token'); // or your storage method
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Socket.io connection
export const socket = io(API_URL, {
  autoConnect: false,
  auth: (cb) => {
    const token = AsyncStorage.getItem('token');
    cb({ token });
  },
});
```

### 3. Example Usage
```javascript
// Register customer
import { api } from './api/client';

const registerCustomer = async (data) => {
  try {
    const response = await api.post('/auth/register/customer', {
      full_name: 'John Doe',
      email: 'john@example.com',
      password: 'SecurePass123!',
      phone_number: '+2348012345678'
    });
    
    // Save token
    await AsyncStorage.setItem('token', response.data.data.session.access_token);
    return response.data;
  } catch (error) {
    console.error('Registration failed:', error.response?.data);
  }
};

// Connect to Socket.io
import { socket } from './api/client';

socket.connect();

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('notification', (data) => {
  console.log('New notification:', data);
});

// Join chat conversation
socket.emit('chat:join', { conversation_id: 'uuid-here' });

// Send message
socket.emit('chat:message', {
  conversation_id: 'uuid-here',
  content: 'Hello!',
  message_type: 'text'
});
```

---

## 🔒 Security Checklist Before Sharing

Before deploying and sharing with frontend dev:

- [ ] ✅ Change all default passwords
- [ ] ✅ Use production Supabase project (not dev)
- [ ] ✅ Set strong JWT_SECRET (generate new one)
- [ ] ✅ Configure CORS to allow frontend domain
- [ ] ✅ Use HTTPS only (Railway/Render handle this)
- [ ] ✅ Enable rate limiting (already configured)
- [ ] ✅ Set up error monitoring (optional: Sentry)
- [ ] ✅ Test all endpoints work

---

## 🧪 Testing Your Deployed Backend

### 1. Health Check
```bash
curl https://your-backend-url.com/health
```

### 2. Test Registration
```bash
curl -X POST https://your-backend-url.com/api/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123!",
    "phone_number": "+2348012345678"
  }'
```

### 3. Test Socket.io
Use [socket.io-client-tool](https://amritb.github.io/socketio-client-tool/)
- URL: `https://your-backend-url.com`
- Add auth header with token

---

## 📋 Deployment Checklist

**Before Deployment:**
- [ ] All code pushed to GitHub
- [ ] `.env` file NOT in repo (in `.gitignore`)
- [ ] Database schema installed in Supabase
- [ ] Test credentials created

**During Deployment:**
- [ ] Choose hosting platform (Railway recommended)
- [ ] Connect GitHub repo
- [ ] Add all environment variables
- [ ] Deploy and wait for build

**After Deployment:**
- [ ] Test `/health` endpoint
- [ ] Test auth endpoints
- [ ] Test Socket.io connection
- [ ] Create test users
- [ ] Share API URL with frontend dev
- [ ] Share API documentation

---

## 💡 Pro Tips

1. **Use Railway** - It's the easiest and has everything you need
2. **Create admin user first** - Frontend dev will need to test artisan approval
3. **Share Postman collection** - Export your API tests
4. **Set up monitoring** - Use Railway logs or add Sentry
5. **Document everything** - Clear API docs save hours of back-and-forth

---

## 🆘 Common Issues

### Issue: "CORS Error"
**Solution:** Add frontend domain to `CORS_ORIGIN` environment variable
```env
CORS_ORIGIN=https://your-frontend-app.com,exp://192.168.1.x:8081
```

### Issue: "Socket.io won't connect"
**Solution:** 
- Ensure using WSS (not WS) for production
- Check firewall isn't blocking WebSocket
- Verify token is being sent

### Issue: "Backend sleeps on Render free tier"
**Solution:**
- Upgrade to paid tier ($7/month)
- Or use Railway (better free tier)
- Or ping `/health` every 10 minutes to keep awake

---

## 📞 What Frontend Dev Needs From You

### Immediate:
1. ✅ **API Base URL** - `https://your-backend.up.railway.app`
2. ✅ **API Documentation** - Send `FRONTEND_API_DOCS.md`
3. ✅ **Test Credentials** - Create test customer + artisan accounts

### Optional but Helpful:
4. ✅ **Postman Collection** - Export your API tests
5. ✅ **Socket.io Events List** - Document in API docs
6. ✅ **Error Codes** - Document error responses
7. ✅ **Example Requests** - Show working examples

---

## 🎯 Recommended Workflow

1. **You**: Deploy backend to Railway
2. **You**: Test all endpoints work
3. **You**: Create `FRONTEND_API_DOCS.md` (I'll create this)
4. **You**: Create test accounts (customer, artisan, admin)
5. **You**: Send frontend dev:
   - API URL
   - API documentation
   - Test credentials
   - Example code (see above)
6. **Frontend Dev**: Integrates API
7. **Both**: Test together with real devices

---

**Next Step:** I'll create the `FRONTEND_API_DOCS.md` file for you to send to your frontend developer!
