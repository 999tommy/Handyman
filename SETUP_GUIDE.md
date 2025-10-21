# 🚀 Handyman Marketplace - Complete Setup Guide

This guide will walk you through setting up the backend from scratch.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js v18 or higher installed
- ✅ npm or yarn package manager
- ✅ A Supabase account (free tier works)
- ✅ A code editor (VS Code recommended)

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including Express, Socket.io, Supabase client, etc.

## Step 2: Set Up Supabase Database

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: handyman-marketplace
   - **Database Password**: (choose a strong password)
   - **Region**: Choose closest to your users
5. Wait for project to be created (~2 minutes)

### 2.2 Run Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `database-schema.sql`
4. Paste into the SQL editor
5. Click "Run" (bottom right)
6. You should see: "Success. No rows returned"

### 2.3 Enable PostGIS Extension

In the SQL Editor, run:

```sql
CREATE EXTENSION IF NOT EXISTS "postgis";
```

### 2.4 Get API Keys

1. Go to **Settings** > **API**
2. Copy these values:
   - **Project URL** (e.g., https://xxxxx.supabase.co)
   - **anon public** key
   - **service_role** key (keep this secret!)

## Step 3: Configure Environment Variables

### 3.1 Create .env file

```bash
cp .env.example .env
```

### 3.2 Fill in Supabase Credentials

Open `.env` and replace:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

### 3.3 Generate JWT Secret

Run this in terminal to generate a random secret:

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Mac/Linux:**
```bash
openssl rand -base64 32
```

Add to `.env`:
```env
JWT_SECRET=your_generated_secret_here
```

### 3.4 Configure CORS (Important!)

If you're running React Native locally, update:

```env
CORS_ORIGIN=http://localhost:3000,http://localhost:19000,http://localhost:19001,exp://192.168.1.x:8081
```

Replace `192.168.1.x` with your local IP address.

## Step 4: Optional Services Setup

### 4.1 SMS Service (Twilio)

For phone verification:

1. Go to [twilio.com/console](https://www.twilio.com/console)
2. Get:
   - Account SID
   - Auth Token
3. Update `.env`:
```env
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=your_account_sid
SMS_API_KEY=your_auth_token
SMS_SENDER_ID=+1234567890
```

**Alternative: Africa's Talking** (Better for African markets)

1. Go to [africastalking.com](https://africastalking.com)
2. Get API Key
3. Update `.env`:
```env
SMS_PROVIDER=africastalking
SMS_API_KEY=your_api_key
```

### 4.2 Payment Gateway (Paystack)

For payments:

1. Go to [paystack.com](https://paystack.com)
2. Sign up and verify your business
3. Go to Settings > API Keys & Webhooks
4. Copy Test Keys (use Live Keys in production)
5. Update `.env`:
```env
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_CALLBACK_URL=http://localhost:5000/api/payments/callback
```

### 4.3 Firebase (Push Notifications)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Go to Project Settings > Cloud Messaging
4. Copy Server Key
5. Update `.env`:
```env
FIREBASE_SERVER_KEY=your_server_key
FIREBASE_PROJECT_ID=your_project_id
```

### 4.4 Cloudinary (Optional - for image uploads)

If you prefer Cloudinary over Supabase Storage:

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for free account
3. Get credentials from Dashboard
4. Update `.env`:
```env
UPLOAD_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Note**: By default, we use Supabase Storage (no extra config needed).

## Step 5: Start the Server

### Development Mode (with auto-restart)

```bash
npm run dev
```

You should see:

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🔨 Handyman Marketplace API                         ║
║                                                        ║
║   Environment: development                             ║
║   Port: 5000                                           ║
║   API URL: http://localhost:5000                       ║
║                                                        ║
║   Socket.io: ✅ Enabled                               ║
║   Database: ✅ Connected                              ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

### Production Mode

```bash
npm start
```

## Step 6: Test the API

### 6.1 Health Check

Open your browser or use curl:

```bash
curl http://localhost:5000/health
```

You should get:
```json
{
  "status": "ok",
  "timestamp": "2025-10-17T...",
  "uptime": 10.5,
  "environment": "development"
}
```

### 6.2 API Documentation

Visit: `http://localhost:5000/api`

### 6.3 Test Registration

**Register a Customer:**

```bash
curl -X POST http://localhost:5000/api/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "phone_number": "+2348012345678"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid...",
      "email": "john@example.com",
      "role": "customer"
    },
    "session": {
      "access_token": "eyJhbG...",
      "refresh_token": "..."
    }
  }
}
```

## Step 7: Create Admin User

To create an admin user for approving artisans:

1. Go to Supabase Dashboard > **Authentication** > **Users**
2. Click "Add User" > "Create new user"
3. Enter email and password
4. After user is created, go to **SQL Editor**
5. Run:

```sql
-- Get the user ID from auth.users
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';

-- Create admin profile
INSERT INTO profiles (id, role, full_name, phone_number, phone_verified)
VALUES ('user-id-from-above', 'admin', 'Admin User', '+2348012345678', true);
```

## Step 8: Connect Frontend (React Native)

In your React Native app:

### Install Socket.io Client

```bash
npm install socket.io-client axios
```

### Create API Client

```javascript
// api/client.js
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = 'http://192.168.1.x:5000'; // Your local IP
const SOCKET_URL = 'http://192.168.1.x:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getToken(); // Your token storage logic
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Socket.io connection
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: {
    token: getToken(),
  },
});
```

### Test API Call

```javascript
import { api } from './api/client';

// Register customer
const registerCustomer = async (data) => {
  try {
    const response = await api.post('/auth/register/customer', data);
    console.log('Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
};
```

## Troubleshooting

### Issue: "Failed to connect to database"

**Solutions:**
- Check your Supabase URL and keys in `.env`
- Ensure your Supabase project is active
- Check if PostGIS extension is enabled

### Issue: "CORS error" from React Native

**Solutions:**
- Add your device's IP to `CORS_ORIGIN` in `.env`
- Use `http://` not `https://` for local development
- Restart the server after changing `.env`

### Issue: Socket.io not connecting

**Solutions:**
- Ensure you're using the correct IP address
- Check if port 5000 is not blocked by firewall
- Verify token is being sent in socket auth

### Issue: SMS not sending

**Solutions:**
- In development, SMS is logged to console (check terminal)
- For production, ensure SMS provider credentials are correct
- Check SMS provider balance/quota

### Issue: "Module not found" errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

### 1. Use Nodemon for Auto-Restart

Already configured! Just run:
```bash
npm run dev
```

### 2. Check Logs

Logs are stored in `logs/` directory (production only).

In development, everything is logged to console.

### 3. Test with Postman

Import the API routes into Postman for easier testing:
- Set base URL: `http://localhost:5000/api`
- Add Authorization header: `Bearer YOUR_TOKEN`

### 4. Monitor Database

Use Supabase Dashboard > **Table Editor** to view data in real-time.

### 5. Debugging Socket.io

In your frontend:

```javascript
socket.on('connect', () => console.log('Connected:', socket.id));
socket.on('disconnect', () => console.log('Disconnected'));
socket.on('error', (error) => console.error('Socket error:', error));
```

## Next Steps

1. ✅ **Test all authentication endpoints**
2. ✅ **Create test artisan and get admin approval**
3. ✅ **Test job posting and bidding flow**
4. ✅ **Test real-time chat**
5. ✅ **Configure payment gateway**
6. ✅ **Set up push notifications**
7. ✅ **Deploy to production**

## Production Deployment

See `DEPLOYMENT.md` for detailed deployment instructions.

Quick checklist:
- [ ] Use production database (not Supabase test project)
- [ ] Use live payment gateway keys
- [ ] Set `NODE_ENV=production` in environment
- [ ] Use HTTPS for all connections
- [ ] Set up proper logging and monitoring
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Use environment secrets (not .env file)

## Support

For issues or questions:
- Check README.md for API documentation
- Review the code comments (heavily commented for learning)
- Check Supabase logs in Dashboard
- Review server logs in terminal

---

**🎉 Congratulations!** Your backend is ready to power your Handyman Marketplace app!
