# 🎨 New Onboarding Flow - Implementation Summary

## ✅ What Has Been Implemented

### 1. **Customer Registration** (Simplified)

**Old Flow:**
- Just full_name, email, password, phone_number
- SMS verification required

**New Flow:**
- `first_name` + `last_name` (combined as full_name in DB)
- `email`, `password`, `phone_number`
- `address` (plain text, e.g., "No 3, Rajui Road Lagos Nigeria")
- `interested_services` (array of categories like ["plumbing", "carpentry"])
- ✅ **No SMS verification**
- ✅ **Auto-login after registration**

**Endpoint:**
```http
POST /api/auth/register/customer

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

---

### 2. **SMS Verification** (Separate Endpoints for Artisans)

**New Endpoints:**

**Send Verification Code:**
```http
POST /api/auth/send-verification-code

{
  "phone_number": "+2348012345678"
}

Response:
{
  "success": true,
  "data": {
    "message": "Verification code sent",
    "code": "123456"  // Only in development mode
  }
}
```

**Verify Code:**
```http
POST /api/auth/verify-phone

{
  "phone_number": "+2348012345678",
  "code": "123456"
}

Response:
{
  "success": true,
  "data": {
    "message": "Phone verified successfully",
    "phone_verified": true
  }
}
```

**Features:**
- ✅ Stores verification codes in `phone_verifications` table
- ✅ 10-minute expiration
- ✅ Rate limiting (max 5 attempts)
- ✅ Uses Twilio for SMS sending
- ✅ Returns code in development mode for testing
- ✅ Does NOT require authentication (can verify before registration)

---

### 3. **Artisan Registration** (Complete Flow)

**New Required Fields:**
```javascript
{
  // Screen 1: Category + Basic Info
  "category_id": "uuid-from-supabase",
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "phone_number": "+2348012345679",  // Must be verified separately
  
  // Screen 3: Professional Info
  "tagline": "Expert plumber with 10 years experience",
  "years_experience": 10,
  "description": "I specialize in residential and commercial plumbing...",
  "skills": ["pipe installation", "leak repair", "water heater"],
  
  // Screen 4: Media
  "profile_picture_url": "https://...supabase.co/.../profile.jpg",
  "government_id_url": "https://...supabase.co/.../id.jpg",
  "portfolio_images": [
    "https://...supabase.co/.../work1.jpg",
    "https://...supabase.co/.../work2.jpg"
  ],
  
  // Screen 5: Pricing
  "base_rate": 5000,
  
  // Screen 6: Location
  "workstation_address": "123 Main Street, Ikeja",
  "city": "Lagos",
  "latitude": 6.5244,
  "longitude": 3.3792,
  
  // Screen 7: Availability
  "availability": [
    { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" },
    { "day_of_week": 2, "start_time": "09:00", "end_time": "17:00" }
  ],
  
  // Screen 9: Bank Details
  "bank_name": "GTBank",
  "account_number": "0123456789",
  "account_name": "Jane Smith"
}
```

**Changes:**
- ✅ All fields now **required** (no optional fields)
- ✅ **Auto-approved** (no admin approval needed)
- ✅ **Auto-login** after registration
- ✅ Phone verification happens **before** registration (separate endpoint)
- ✅ Returns session token for immediate login

---

### 4. **File Upload Endpoints** (Unified)

**Upload Profile Picture:**
```http
POST /api/upload?type=profile_picture
Content-Type: multipart/form-data

Form field: file (image file)

Response:
{
  "success": true,
  "data": {
    "url": "https://xxx.supabase.co/storage/v1/object/public/profile-pictures/..."
  }
}
```

**Upload Government ID:**
```http
POST /api/upload?type=government_id
Form field: file
```

**Upload Single Portfolio Image:**
```http
POST /api/upload?type=portfolio_image
Form field: file
```

**Upload Multiple Portfolio Images:**
```http
POST /api/upload?type=portfolio_images
Form field: files (multiple)

Response:
{
  "success": true,
  "data": {
    "urls": [
      "https://.../.../image1.jpg",
      "https://.../.../image2.jpg",
      "https://.../.../image3.jpg"
    ]
  }
}
```

**Features:**
- ✅ **No authentication required** (can upload during registration)
- ✅ Uploads to Supabase Storage
- ✅ Max file size: 5 MB
- ✅ Allowed types: JPEG, PNG, WebP
- ✅ Rate limited (10 uploads per 15 minutes)
- ✅ Files organized by user ID in storage

---

### 5. **Database Changes**

**New Table:**
```sql
CREATE TABLE phone_verifications (
  phone_number TEXT UNIQUE,
  code TEXT,
  expires_at TIMESTAMPTZ,
  attempts INTEGER
);
```

**Updated Tables:**
```sql
-- profiles table
ALTER TABLE profiles
ADD COLUMN address TEXT,
ADD COLUMN interested_services TEXT[];

-- artisans table (default values changed)
ALTER TABLE artisans
ALTER COLUMN approval_status SET DEFAULT 'approved',
ALTER COLUMN verification_status SET DEFAULT 'verified';
```

---

### 6. **Supabase Storage Buckets**

You need to create 3 buckets:

1. **profile-pictures** (public)
2. **government-ids** (private)
3. **portfolio-images** (public)

See `SUPABASE_STORAGE_SETUP.md` for full setup instructions.

---

## 📱 Frontend Integration Guide

### Customer Registration Flow:

```javascript
// Step 1: Collect data from 2 screens
const customerData = {
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  password: "password123",
  phone_number: "+2348012345678",
  address: "No 3, Rajui Road Lagos",
  interested_services: ["plumbing", "electrical"]  // From checkboxes
};

// Step 2: Register (one API call)
const response = await api.post('/auth/register/customer', customerData);

// Step 3: Auto-logged in!
const { user, session } = response.data.data;
await AsyncStorage.setItem('token', session.access_token);
```

---

### Artisan Registration Flow:

```javascript
// Step 1: Select category
const category_id = "selected-uuid";

// Step 2: Collect basic info
const basicInfo = {
  full_name: "Jane Smith",
  email: "jane@example.com",
  password: "password123",
  phone_number: "+2348012345679"
};

// Step 3: Send SMS verification
await api.post('/auth/send-verification-code', {
  phone_number: basicInfo.phone_number
});

// Step 4: User enters code
const code = "123456"; // From user input
await api.post('/auth/verify-phone', {
  phone_number: basicInfo.phone_number,
  code: code
});
// ✅ Phone verified! Continue to next screen

// Step 5-8: Collect all other data
const professionalInfo = {
  tagline: "...",
  years_experience: 10,
  description: "...",
  skills: ["..."]
};

// Step 9: Upload files (do this before final registration)
const profilePicUrl = await uploadFile('/api/upload?type=profile_picture', profileImage);
const govIdUrl = await uploadFile('/api/upload?type=government_id', idImage);
const portfolioUrls = await uploadFiles('/api/upload?type=portfolio_images', portfolioImages);

// Step 10: Submit complete registration
const artisanData = {
  category_id,
  ...basicInfo,
  ...professionalInfo,
  profile_picture_url: profilePicUrl,
  government_id_url: govIdUrl,
  portfolio_images: portfolioUrls,
  base_rate: 5000,
  workstation_address: "...",
  city: "Lagos",
  latitude: 6.5244,
  longitude: 3.3792,
  availability: [...],
  bank_name: "GTBank",
  account_number: "0123456789",
  account_name: "Jane Smith"
};

const response = await api.post('/auth/register/artisan', artisanData);

// ✅ Auto-approved and auto-logged in!
const { user, session } = response.data.data;
await AsyncStorage.setItem('token', session.access_token);
```

---

## 🔧 Setup Instructions

### 1. Run Database Migration

```bash
# In Supabase SQL Editor, run:
database-migration-onboarding.sql
```

### 2. Set Up Supabase Storage

Follow instructions in `SUPABASE_STORAGE_SETUP.md` to create buckets and set policies.

### 3. Configure Twilio (Optional)

Update `.env` file:
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

### 4. Test Endpoints

**Test Customer Registration:**
```bash
curl -X POST http://localhost:5000/api/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "Customer",
    "email": "test@example.com",
    "password": "TestPass123!",
    "phone_number": "+2348012345678",
    "address": "Test Address Lagos",
    "interested_services": ["plumbing"]
  }'
```

**Test SMS Verification:**
```bash
# Send code
curl -X POST http://localhost:5000/api/auth/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+2348012345678"}'

# Verify code (check backend logs for code in dev mode)
curl -X POST http://localhost:5000/api/auth/verify-phone \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+2348012345678", "code": "123456"}'
```

**Test File Upload:**
```bash
curl -X POST "http://localhost:5000/api/upload?type=profile_picture" \
  -F "file=@/path/to/image.jpg"
```

---

## 📊 Summary of Changes

| Component | Changes Made |
|-----------|-------------|
| **Customer Registration** | Added first_name, last_name, address, interested_services; Removed SMS verification |
| **Artisan Registration** | All fields now required; Auto-approval; Auto-login |
| **SMS Verification** | Separate endpoints; Stores codes in DB; Rate limiting; No auth required |
| **File Uploads** | 1 Unified endpoint (`/api/upload?type=...`); Supabase Storage integration; No auth required |
| **Database** | New phone_verifications table; Added columns to profiles table |
| **Validation** | Updated Joi schemas for all new fields |
| **Services** | Updated authService with new logic |

---

## ✅ Testing Checklist

- [ ] Customer can register with new fields
- [ ] Customer auto-logs in after registration
- [ ] SMS code is sent to phone number
- [ ] SMS code can be verified
- [ ] SMS code expires after 10 minutes
- [ ] Profile picture uploads successfully
- [ ] Government ID uploads successfully
- [ ] Portfolio images upload successfully (multiple)
- [ ] Artisan can register with all required fields
- [ ] Artisan is auto-approved
- [ ] Artisan auto-logs in after registration
- [ ] Artisan can login without phone verification
- [ ] Database has new columns
- [ ] Supabase Storage buckets exist
- [ ] Uploaded files are accessible

---

## 🎉 Next Steps

1. ✅ Run database migration
2. ✅ Set up Supabase Storage buckets
3. ✅ Configure Twilio (optional for testing)
4. ✅ Test all endpoints
5. ✅ Update frontend to use new API structure
6. ✅ Test complete registration flows end-to-end

---

**Files to Review:**
- `src/services/authService.js` - Registration logic
- `src/middleware/validation.js` - Validation schemas
- `src/controllers/uploadController.js` - File uploads
- `src/routes/uploadRoutes.js` - Upload endpoints
- `database-migration-onboarding.sql` - Database changes
- `SUPABASE_STORAGE_SETUP.md` - Storage setup guide
