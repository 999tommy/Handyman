# 📱 Frontend API Integration Guide

**Base URL:** `https://your-backend-url.com/api`
**Socket URL:** `wss://your-backend-url.com`

---
### Key Endpoints

**Authentication**
- `POST /api/auth/register/customer` - Customer registration (step 2)
- `POST /api/auth/register/artisan` - Artisan registration (final step)
- `POST /api/auth/login` - Login
- `POST /api/auth/send-verification-code` - Send SMS verification code (artisan step 1)
- `POST /api/auth/verify-phone` - Verify SMS code (artisan step 2)

**File Uploads** (no auth required)
- `POST /api/upload/profile-picture`
- `POST /api/upload/government-id`
- `POST /api/upload/portfolio-image`
- `POST /api/upload/portfolio-images`

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

## 🔐 Authentication

### 1. Customer Onboarding Flow

**Step 1: Collect details across two screens**

| Screen | Fields |
| --- | --- |
| Account | `first_name`, `last_name`, `email`, `password` |
| Contact & Preferences | `phone_number`, `address`, `interested_services[]` |

**Step 2: Register Customer**
```http
POST /api/auth/register/customer
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone_number": "+2348012345678",
  "address": "No 3, Rajui Road Lagos Nigeria",
  "interested_services": ["plumbing", "electrical", "carpentry"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { 
      "id": "uuid", 
      "email": "john@example.com", 
      "role": "customer",
      "profile": {
        "full_name": "John Doe",
        "address": "No 3, Rajui Road Lagos Nigeria",
        "interested_services": ["plumbing", "electrical", "carpentry"]
      }
    },
    "session": {
      "access_token": "eyJhbG...",
      "refresh_token": "..."
    }
  }
}
```

✅ Save the `access_token` immediately. Customer is fully registered and logged in after this call.

📌 **No SMS verification for customers.**

### 2. Artisan Onboarding Flow

**Multi-step sequence:**

1. **Select Service Category** – choose `category_id`
2. **Basic Info** – `full_name`, `email`, `password`, `phone_number`
3. **Phone Verification**
   - `POST /api/auth/send-verification-code`
   - `POST /api/auth/verify-phone`
4. **Professional Details** – `tagline`, `years_experience`, `description`, `skills[]`
5. **Uploads** (call upload APIs first)
   - Profile picture → `profile_picture_url`
   - Government ID → `government_id_url`
   - Portfolio images → `portfolio_images[]`
6. **Pricing & Location** – `base_rate`, `workstation_address`, `city`, `latitude`, `longitude`
7. **Availability** – weekly schedule array
8. **Bank Details** – `bank_name`, `account_number`, `account_name`

**Final Step: Register Artisan**
```http
POST /api/auth/register/artisan
Content-Type: application/json

{
  "category_id": "uuid-of-plumbing-category",
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "phone_number": "+2348012345679",
  "tagline": "Expert plumber with 10 years experience",
  "years_experience": 10,
  "description": "Professional plumbing services across Lagos. I specialise in residential plumbing...",
  "skills": ["pipe installation", "leak repair", "water heater"],
  "profile_picture_url": "https://.../profile.jpg",
  "government_id_url": "https://.../id.jpg",
  "portfolio_images": [
    "https://.../work-1.jpg",
    "https://.../work-2.jpg"
  ],
  "base_rate": 5000,
  "workstation_address": "123 Main St, Ikeja",
  "city": "Lagos",
  "latitude": 6.5244,
  "longitude": 3.3792,
  "availability": [
    { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" },
    { "day_of_week": 3, "start_time": "09:00", "end_time": "17:00" }
  ],
  "bank_name": "GTBank",
  "account_number": "0123456789",
  "account_name": "Jane Smith"
}
```

**Response: artisan is auto-approved and auto-logged in**

```json
{
  "success": true,
  "data": {
    "message": "Registration successful! You can now start browsing jobs.",
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "role": "artisan",
      "approval_status": "approved"
    },
    "session": {
      "access_token": "eyJhbG...",
      "refresh_token": "..."
    }
  }
}
```

✅ Artisan can log in immediately after this call. No admin approval gate.

### 3. Login
```http
POST /api/auth/login

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

### 4. Authenticated Requests
**Add header to ALL requests after login:**
```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## 👤 User Profile

### Get Current User
```http
GET /api/users/me
Authorization: Bearer TOKEN
```

**Response (Customer):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "customer@example.com",
    "role": "customer",
    "phone_verified": false,
    "created_at": "2025-10-30T12:00:00.000Z",
    "profile": {
      "full_name": "John Doe",
      "address": "No 3, Rajui Road Lagos Nigeria",
      "interested_services": ["plumbing", "electrical"],
      "profile_picture_url": "https://.../profile.jpg"
    },
    "customer": {
      "total_jobs": 12,
      "active_jobs": 2,
      "completed_jobs": 9,
      "wallet_balance": 15000
    }
  }
}
```

**Response (Artisan):**
```json
{
  "success": true,
  "data": {
    "id": "artisan-uuid",
    "email": "artisan@example.com",
    "role": "artisan",
    "phone_verified": true,
    "created_at": "2025-09-01T09:30:00.000Z",
    "profile": {
      "full_name": "Jane Smith",
      "profile_picture_url": "https://.../profile.jpg"
    },
    "artisan": {
      "category_id": "uuid-of-plumbing-category",
      "profession": "Plumber",
      "tagline": "Expert plumber with 10 years experience",
      "years_experience": 10,
      "description": "Professional plumbing services across Lagos...",
      "skills": ["pipe installation", "leak repair", "water heater"],
      "base_rate": 5000,
      "rating": 4.8,
      "total_reviews": 36,
      "approval_status": "approved",
      "verification_status": "verified"
    },
    "availability": [
      { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" },
      { "day_of_week": 3, "start_time": "09:00", "end_time": "17:00" }
    ],
    "location": {
      "workstation_address": "123 Main St, Ikeja",
      "city": "Lagos",
      "latitude": 6.5244,
      "longitude": 3.3792
    },
    "bank": {
      "bank_name": "GTBank",
      "account_number": "0123456789",
      "account_name": "Jane Smith"
    },
    "portfolio": [
      "https://.../work-1.jpg",
      "https://.../work-2.jpg"
    ]
  }
}
```

### Update Profile
```http
PATCH /api/users/me
Authorization: Bearer TOKEN

{
  "full_name": "New Name",
  "profile_picture_url": "https://..."
}
```

---

## 👷 Artisan Endpoints

### Search Artisans
```http
GET /api/artisans/search?category=plumber&lat=6.5244&lng=3.3792&radius=25
```

**Query Parameters:**
- `category` - Category ID
- `lat`, `lng` - User's location
- `radius` - Search radius in km (default: 25)
- `city` - Filter by city
- `sort` - rating | distance | reviews | price
- `page`, `limit` - Pagination

### Get Artisan Profile
```http
GET /api/artisans/:id
```

---

## 💼 Jobs (Customer)

### Create Job
```http
POST /api/jobs
Authorization: Bearer CUSTOMER_TOKEN

{
  "category_id": "uuid",
  "title": "Fix leaking pipe",
  "description": "Kitchen sink is leaking",
  "budget": 10000,
  "date_preference": "on_date",
  "preferred_date": "2025-11-01",
  "time_preference": "morning",
  "needs_specific_time": true,
  "service_type": "onsite",
  "street": "123 Main Street",
  "city": "Lagos",
  "latitude": 6.5244,
  "longitude": 3.3792
}
```

### Get My Jobs
```http
GET /api/jobs/my-jobs?status=posted&page=1&limit=20
Authorization: Bearer CUSTOMER_TOKEN
```

### Cancel Job
```http
POST /api/jobs/:id/cancel
Authorization: Bearer CUSTOMER_TOKEN

{
  "reason": "Found another artisan"
}
```

---

## 🔨 Jobs (Artisan)

### Browse Available Jobs
```http
GET /api/jobs/browse?lat=6.5244&lng=3.3792&radius=25
Authorization: Bearer ARTISAN_TOKEN
```

---

## 💰 Offers (Bidding)

### Create Offer (Artisan)
```http
POST /api/offers
Authorization: Bearer ARTISAN_TOKEN

{
  "job_id": "uuid",
  "proposed_price": 8000,
  "cover_letter": "I can fix this quickly...",
  "estimated_duration": "2 hours"
}
```

### Get Job Offers (Customer)
```http
GET /api/jobs/:jobId/offers
Authorization: Bearer CUSTOMER_TOKEN
```

### Accept Offer (Customer)
```http
POST /api/offers/:offerId/accept
Authorization: Bearer CUSTOMER_TOKEN
```

---

## 💬 Chat

### Get Conversations
```http
GET /api/chat/conversations
Authorization: Bearer TOKEN
```

### Get Messages
```http
GET /api/chat/conversations/:id/messages?page=1&limit=50
Authorization: Bearer TOKEN
```

### Send Message (via REST)
```http
POST /api/chat/conversations/:id/messages
Authorization: Bearer TOKEN

{
  "content": "Hello, when can you start?",
  "message_type": "text"
}
```

---

## 💳 Payments

### Initiate Payment (Customer)
```http
POST /api/payments/initiate
Authorization: Bearer CUSTOMER_TOKEN

{
  "job_id": "uuid",
  "amount": 8000
}
```

**Response includes Paystack payment URL - redirect user to complete payment**

### Verify Payment
```http
POST /api/payments/verify

{
  "reference": "TXN-xxxxx"
}
```

### Release Payment (After job completion)
```http
POST /api/payments/:paymentId/release
Authorization: Bearer CUSTOMER_TOKEN
```

---

## ⭐ Reviews

### Create Review
```http
POST /api/reviews
Authorization: Bearer TOKEN

{
  "job_id": "uuid",
  "reviewee_id": "artisan-uuid",
  "rating": 5,
  "comment": "Excellent work!"
}
```

### Get User Reviews
```http
GET /api/reviews/user/:userId?page=1
```

---

## 🔌 Socket.io Events

### Connect to Socket
```javascript
import io from 'socket.io-client';

const socket = io('https://your-backend-url.com', {
  auth: { token: 'YOUR_ACCESS_TOKEN' }
});

socket.on('connect', () => console.log('Connected'));
```

### Chat Events

**Join Conversation:**
```javascript
socket.emit('chat:join', { conversation_id: 'uuid' });
```

**Send Message:**
```javascript
socket.emit('chat:message', {
  conversation_id: 'uuid',
  content: 'Hello!',
  message_type: 'text'
});
```

**Listen for Messages:**
```javascript
socket.on('chat:message', (message) => {
  console.log('New message:', message);
});
```

**Typing Indicator:**
```javascript
socket.emit('chat:typing', { conversation_id: 'uuid', is_typing: true });

socket.on('chat:typing', ({ user_id, is_typing }) => {
  // Show/hide typing indicator
});
```

### Location Events

**Update Location:**
```javascript
socket.emit('location:update', {
  latitude: 6.5244,
  longitude: 3.3792,
  accuracy: 10
});
```

**Track User:**
```javascript
socket.emit('location:track', { user_id: 'artisan-uuid' });

socket.on('location:update', ({ user_id, latitude, longitude }) => {
  // Update map marker
});
```

### Notification Events
```javascript
socket.on('notification', (data) => {
  console.log('New notification:', data);
  // Show push notification
});
```

---

## 📞 SMS Verification (Artisan Only)

### Send Verification Code
```http
POST /api/auth/send-verification-code
Content-Type: application/json

{
  "phone_number": "+2348012345679"
}
```

**Response (development):**
```json
{
  "success": true,
  "data": {
    "message": "Verification code sent",
    "code": "123456"
  }
}
```

### Verify Code
```http
POST /api/auth/verify-phone
Content-Type: application/json

{
  "phone_number": "+2348012345679",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Phone verified successfully",
    "phone_verified": true
  }
}
```

📌 Codes expire after 10 minutes. Rate limited to 5 attempts per number.

---

## ❌ Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { "field": "email", "issue": "Invalid format" }
  }
}
```

Common Status Codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limited)
- `500` - Server Error

---

## 📤 File Uploads (Supabase Storage)

Uploads happen **before** the final artisan registration call.

| Endpoint | Field | Bucket | Auth Required |
| --- | --- | --- | --- |
| `POST /api/upload/profile-picture` | `file` | `profile-pictures` (public) | No |
| `POST /api/upload/government-id` | `file` | `government-ids` (private) | No |
| `POST /api/upload/portfolio-image` | `file` | `portfolio-images` (public) | No |
| `POST /api/upload/portfolio-images` | `files[]` | `portfolio-images` (public) | No |

**Single file upload example (React Native):**
```javascript
const uploadFile = async (endpoint, localUri) => {
  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: 'image/jpeg',
    name: 'upload.jpg',
  });

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const result = await response.json();
  return result.data.url;
};

const profilePictureUrl = await uploadFile('/api/upload/profile-picture', imageUri);
```

**Multiple portfolio images:**
```javascript
const uploadPortfolioImages = async (images) => {
  const formData = new FormData();

  images.forEach((uri, idx) => {
    formData.append('files', {
      uri,
      type: 'image/jpeg',
      name: `portfolio-${idx}.jpg`,
    });
  });

  const response = await fetch(`${API_URL}/api/upload/portfolio-images`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const result = await response.json();
  return result.data.urls;
};
```

📌 Buckets (`profile-pictures`, `portfolio-images`) are public. `government-ids` remains private.

---

## 🧪 Test Credentials

**Customer:**
```
Email: test.customer@test.com
Password: TestPass123!
```

**Artisan:**
```
Email: test.artisan@test.com
Password: TestPass123!
```

---

## 📦 React Native Example Code

```javascript
// api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://your-backend.up.railway.app';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Example: Register customer
export const registerCustomer = async (data) => {
  const response = await api.post('/auth/register/customer', data);
  await AsyncStorage.setItem('token', response.data.data.session.access_token);
  return response.data;
};

// Example: Get current user
export const getCurrentUser = async () => {
  const response = await api.get('/users/me');
  return response.data;
};
```

---

For full documentation, see `README.md'