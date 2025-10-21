# 📱 Frontend API Integration Guide

**Base URL:** `https://your-backend-url.com/api`
**Socket URL:** `wss://your-backend-url.com`

---

## 🔐 Authentication

### 1. Register Customer
```http
POST /api/auth/register/customer
Content-Type: application/json

{
  "full_name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone_number": "+2348012345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "john@example.com", "role": "customer" },
    "session": {
      "access_token": "eyJhbG...",
      "refresh_token": "..."
    }
  }
}
```

**Save the `access_token` - use it in all authenticated requests!**

### 2. Register Artisan
```http
POST /api/auth/register/artisan
Content-Type: application/json

{
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "phone_number": "+2348012345679",
  "profession": "Plumber",
  "category_id": "uuid-of-plumbing-category",
  "tagline": "Expert plumber with 10 years experience",
  "years_experience": 10,
  "description": "Professional plumbing services...",
  "skills": ["pipe installation", "leak repair"],
  "base_rate": 5000,
  "workstation_address": "123 Main St",
  "city": "Lagos",
  "latitude": 6.5244,
  "longitude": 3.3792
}
```

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

**Common Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limited)
- `500` - Server Error

---

## 📤 File Uploads

### Upload Profile Picture
```javascript
const formData = new FormData();
formData.append('file', {
  uri: imageUri,
  type: 'image/jpeg',
  name: 'profile.jpg'
});

await fetch(`${API_URL}/api/users/upload-profile-picture`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'multipart/form-data'
  },
  body: formData
});
```

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

For full documentation, see `README.md`
