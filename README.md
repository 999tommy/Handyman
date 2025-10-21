# 🔨 Handyman Marketplace Backend

Express.js backend for a two-sided marketplace connecting customers with skilled artisans.

## 🚀 Features

- **Two-Sided Platform**: Separate registration flows for customers and artisans
- **Admin Approval**: Artisans require admin verification before accepting jobs
- **Real-Time Chat**: Socket.io-powered messaging between customers and artisans
- **Geolocation**: Track artisans, search nearby, calculate distances
- **Job Bidding**: Transparent offer system where artisans bid on jobs
- **Escrow Payments**: Secure payment holding until job completion
- **Ratings & Reviews**: Two-way review system
- **Push Notifications**: FCM/APNS for mobile notifications

## 📦 Tech Stack

- **Runtime**: Node.js v18+
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Authentication**: Supabase Auth + JWT
- **Real-Time**: Socket.io
- **Payments**: Paystack (Nigerian market)
- **SMS**: Twilio/Africa's Talking
- **Push Notifications**: Firebase Cloud Messaging

## 📁 Project Structure

```
handyman-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic
│   ├── routes/          # API routes
│   ├── sockets/         # Socket.io handlers
│   └── utils/           # Helper functions
├── logs/                # Application logs
├── server.js            # Entry point
└── package.json
```

## 🛠️ Setup Instructions

### 1. Prerequisites

- Node.js v18 or higher
- Supabase account ([signup here](https://supabase.com))
- Paystack account (for payments)
- Twilio/Africa's Talking account (for SMS)
- Firebase account (for push notifications)

### 2. Installation

```bash
# Clone and navigate to directory
cd handyman-backend

# Install dependencies
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

**Required Configuration:**

1. **Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Get your project URL and keys from Settings > API
   - Run the database schema (see Database Setup below)

2. **Paystack**:
   - Sign up at [paystack.com](https://paystack.com)
   - Get your test keys from Settings > API Keys

3. **SMS Provider**:
   - For Twilio: Get credentials from [twilio.com/console](https://twilio.com/console)
   - For Africa's Talking: Get credentials from [africastalking.com](https://africastalking.com)

4. **Firebase**:
   - Create project at [console.firebase.google.com](https://console.firebase.google.com)
   - Get server key from Project Settings > Cloud Messaging

### 4. Database Setup

Run the SQL schema in your Supabase project:

1. Go to Supabase Dashboard > SQL Editor
2. Copy and paste the schema from `database-schema.sql` (provided separately)
3. Run the query
4. Verify tables are created in Table Editor

**Key Tables Created:**
- `profiles` - Base user data
- `customers` - Customer-specific data
- `artisans` - Artisan profiles
- `jobs` - Job postings
- `offers` - Bids from artisans
- `conversations` & `messages` - Chat system
- `payments` - Escrow payment tracking
- `reviews` - Ratings and reviews
- `notifications` - User notifications

### 5. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:5000`

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

All protected routes require JWT token in header:
```
Authorization: Bearer <token>
```

### Key Endpoints

**Authentication**
- `POST /api/auth/register/customer` - Customer registration
- `POST /api/auth/register/artisan` - Artisan registration
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-phone` - Verify phone number

**Jobs**
- `POST /api/jobs` - Create job
- `GET /api/jobs/browse` - Browse jobs (artisan)
- `GET /api/jobs/my-jobs` - Get customer's jobs
- `POST /api/jobs/:id/cancel` - Cancel job

**Offers**
- `POST /api/offers` - Submit offer
- `GET /api/jobs/:jobId/offers` - View job offers
- `POST /api/offers/:id/accept` - Accept offer

**Chat**
- `GET /api/chat/conversations` - List conversations
- `GET /api/chat/conversations/:id/messages` - Get messages
- `POST /api/chat/conversations/:id/messages` - Send message

**Geolocation**
- `POST /api/location/update` - Update live location
- `GET /api/location/nearby` - Find nearby artisans
- `GET /api/artisans/search` - Search artisans by location/category

**Payments**
- `POST /api/payments/initiate` - Start escrow payment
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/:id/release` - Release payment to artisan

**Admin**
- `GET /api/admin/artisans/pending` - View pending approvals
- `POST /api/admin/artisans/:id/approve` - Approve artisan
- `GET /api/admin/stats` - Platform statistics

Full API documentation available at `/api-docs` when server is running.

## 🔌 WebSocket Events

Connect to Socket.io at `http://localhost:5000`

**Chat Events**
```javascript
socket.emit('chat:join', { conversation_id })
socket.emit('chat:message', { conversation_id, content })
socket.emit('chat:typing', { conversation_id, is_typing })
socket.on('chat:message', (message) => {})
```

**Location Events**
```javascript
socket.emit('location:update', { latitude, longitude })
socket.emit('location:track', { artisan_id })
socket.on('location:update', (location) => {})
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

## 🔐 Security Features

- ✅ Helmet.js security headers
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Input validation (Joi)
- ✅ JWT authentication
- ✅ Row Level Security (RLS) in Supabase
- ✅ SQL injection prevention
- ✅ XSS protection

## 📊 Key Workflows

### 1. Customer Posts Job
```
Customer creates job → Job goes live → Artisans browse → Artisans submit offers
→ Customer accepts offer → Chat enabled → Payment held in escrow
→ Job completed → Customer reviews → Payment released
```

### 2. Artisan Registration
```
Artisan registers → Upload ID → Admin reviews → Admin approves/rejects
→ If approved: Artisan can browse jobs and submit offers
```

### 3. Offer Acceptance
```
Customer accepts offer → Other offers auto-rejected → Conversation created
→ Job status: "assigned" → Notification sent to artisan
```

## 🚨 Error Handling

All API errors return consistent format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {...}
  }
}
```

## 📝 Logging

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only
- Logs rotate daily

## 🌍 Deployment

### Environment Variables
Ensure all production credentials are set:
- Change `NODE_ENV=production`
- Use production Supabase keys
- Use live Paystack keys
- Update `CORS_ORIGIN` to your mobile app URLs

### Hosting Recommendations
- **VPS**: DigitalOcean, AWS EC2, Linode
- **PaaS**: Render, Railway, Heroku
- **Serverless**: Vercel (with Express adapter)

### Database
- Supabase handles database hosting
- Enable connection pooling for production
- Set up automated backups

## 🤝 Support

For issues or questions, please open an issue in the repository.

## 📄 License

MIT License - see LICENSE file for details

---

**Built with ❤️ for the Next.js to Express.js journey**
