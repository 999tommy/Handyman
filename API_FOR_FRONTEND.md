# 📱 Handyman Marketplace - Frontend API Integration Guide

This guide provides accurate, descriptive, and comprehensive documentation for integrating the frontend application (e.g., React Native/web) with the Handyman Marketplace Backend API.

---

## 🌐 API Configuration & Global Behaviors

### 1. Base URLs & Path Fallbacks
* **Base API URL:** `https://handyman-1-drwc.onrender.com/api` (Production) / `http://localhost:5000/api` (Local Dev)
* **WebSocket URL:** `handyman-1-drwc.onrender.com` (Production) / `ws://localhost:5000` (Local Dev)

> [!WARNING]
> **API Path Duplication Safe-Guards:**
> The backend has built-in compatibility layers to handle common frontend request configuration mistakes:
> 1. **Axios BaseURL prefix mismatch:** If your client prefixes with `/api` but calls `/api/auth/...`, it evaluates to `/api/api/auth/...`. The backend explicitly mounts routes on `/api/api/auth` (and other endpoints) to prevent **404 Route Not Found** errors.
> 2. **Missing `/api` prefix:** If a client directly calls `/auth/login` instead of `/api/auth/login`, the backend will resolve this correctly.
>
> *Best Practice:* Configure your Axios client with `baseURL: 'https://domain.com/api'` and make calls using relative paths like `/auth/login` without repeating `/api`.

### 2. Nigerian Phone Number Normalization
All phone number inputs are normalized using the following rule before hitting validation or database checks:
* If starts with `+234` -> Left unchanged.
* If starts with `0` (e.g., `08031234567`) -> Replaces leading `0` with `+234` (results in `+2348031234567`).
* Else -> Prepends `+234`.

> [!NOTE]
> All APIs expecting or returning a phone number will require or produce the normalized international format (`+234...`).

### 3. SMS OTP Verification (Development Mode)
* **OTP Expiration:** 10 minutes.
* **Rate Limits:** Maximum 5 attempts per phone number.
* **Development Constant:** In development mode (`NODE_ENV=development`), the generated SMS OTP code is hardcoded to **`666666`**. It will also be returned directly in the response payload for easy testing.

### 4. Authenticated Request Header
Protected routes require the Supabase JWT access token passed in the `Authorization` header:
```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

---

## ❌ Error Response Schema

All errors (including validation failures, unauthorized access, and database conflicts) return a standardized JSON structure with a `4xx` or `5xx` status code.

### 1. Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable summary of the error",
    "details": null
  }
}
```

### 2. Validation Error Format (Status 400)
When Joi validation fails, the backend returns detailed information mapping specific fields to their failures:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "body.phone_number",
        "message": "phone_number must match the pattern /^(\\+234|0)[789]\\d{9}$/"
      },
      {
        "field": "body.password",
        "message": "password length must be at least 8 characters long"
      }
    ]
  }
}
```

### Common Error Codes Table
| Code | HTTP Status | Description |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | The payload format, field types, or limits failed validation checks. |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired authentication token. |
| `FORBIDDEN` | 403 | Authenticated user has insufficient roles or permissions (e.g. unverified phone). |
| `NOT_FOUND` | 404 | Resource (user, job, offer, conversation, etc.) does not exist. |
| `CONFLICT` | 409 | Unique constraint conflict (e.g. email/phone already registered, offer already made). |
| `RATE_LIMIT_EXCEEDED` | 429 | IP or number exceeded limits (Auth/SMS/Search limiters). |
| `INTERNAL_SERVER_ERROR` | 500 | An unhandled error occurred on the server. |

---

## 📊 Database-to-JSON Data Structures

To prevent model nesting confusion, please note how Supabase joins format returned JSON data.

### 1. Customer User Object Structure
Retrieving profile information for a customer yields this exact root structure:
```json
{
  "id": "customer-uuid",
  "role": "customer",
  "full_name": "John Doe",
  "phone_number": "+2348012345678",
  "phone_verified": false,
  "profile_picture_url": "https://.../pic.jpg",
  "created_at": "2026-06-05T08:00:00.000Z",
  "updated_at": "2026-06-05T08:00:00.000Z",
  "role_data": {
    "id": "customer-uuid",
    "total_jobs_posted": 3,
    "total_spent": 18000.00,
    "average_rating": 4.67,
    "created_at": "2026-06-05T08:00:00.000Z"
  }
}
```

### 2. Artisan User Object Structure
An artisan's user data merges profile details with professional metadata under `role_data`:
```json
{
  "id": "artisan-uuid",
  "role": "artisan",
  "full_name": "Jane Smith",
  "phone_number": "+2348098765432",
  "phone_verified": true,
  "profile_picture_url": "https://.../pic.jpg",
  "created_at": "2026-06-05T08:00:00.000Z",
  "updated_at": "2026-06-05T08:00:00.000Z",
  "role_data": {
    "id": "artisan-uuid",
    "tagline": "Expert electrician in Lagos mainland",
    "profession": "Electrician",
    "category_id": "category-uuid",
    "years_experience": 5,
    "description": "I provide domestic and commercial electrical repairs...",
    "skills": ["wiring", "fuse repair", "inverter install"],
    "base_rate": 4500.00,
    "government_id_url": "https://.../id.jpg",
    "verification_status": "verified",
    "approval_status": "approved",
    "bank_name": "Access Bank",
    "account_number": "0123456789",
    "account_name": "Jane Smith",
    "total_jobs_completed": 12,
    "total_earnings": 54000.00,
    "average_rating": 4.85,
    "total_reviews": 12,
    "category": { "name": "Electrical" },
    "location": [
      {
        "id": "loc-uuid",
        "workstation_address": "15 Herbert Macaulay Way, Yaba",
        "city": "Lagos",
        "latitude": 6.5095,
        "longitude": 3.3711
      }
    ]
  }
}
```

---

## 🔐 Authentication Endpoints

### 1. Send Phone Verification SMS
Initiates OTP sending to a phone number. Used in the artisan multi-step flow.
* **Route:** `POST /api/auth/send-verification-code`
* **Auth Required:** No
* **Request Body:**
  ```json
  {
    "phone_number": "08012345678"
  }
  ```
* **Response (Development Mode):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Verification code sent",
      "code": "666666"
    }
  }
  ```

### 2. Verify Phone OTP Code
Validates the OTP code received by SMS. Can be run before account creation.
* **Route:** `POST /api/auth/verify-phone`
* **Auth Required:** No
* **Request Body:**
  ```json
  {
    "phone_number": "08012345678",
    "code": "666666"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Phone verified successfully",
      "phone_verified": true
    }
  }
  ```

### 3. Register Customer (Auto Logged In)
Registers a new customer profile.
* **Route:** `POST /api/auth/register/customer`
* **Auth Required:** No
* **Request Body:**
  ```json
  {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "phone_number": "08012345678",
    "address": "No 3, Rajui Road, Lagos",
    "interested_services": ["Plumbing", "Electrical"]
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "customer-uuid",
        "email": "john.doe@example.com",
        "role": "customer"
      },
      "session": {
        "access_token": "eyJhbGciOi...",
        "refresh_token": "refresh-token-string",
        "expires_in": 3600,
        "token_type": "bearer"
      }
    }
  }
  ```

### 4. Register Artisan (Auto Approved & Auto Logged In)
Registers a professional artisan profile. Under the hood, this account is auto-approved and auto-verified in the database, allowing immediate logins.
* **Route:** `POST /api/auth/register/artisan`
* **Auth Required:** No
* **Request Body:**
  * Note: Must include *either* `category_id` OR `category_name`, but NOT both.
  ```json
  {
    "category_name": "Plumbing",
    "full_name": "Jane Smith",
    "email": "jane.smith@example.com",
    "password": "SecurePass123!",
    "phone_number": "08098765432",
    "profession": "Plumber & Pipe Fitter",
    "tagline": "Expert residential plumber with 5 years experience",
    "years_experience": 5,
    "description": "I provide high quality residential plumbing fixes, leak repairs, and pipe installations.",
    "skills": ["pipe fitting", "drain unblocking", "leak patching"],
    "profile_picture_url": "https://supabase-storage-url.../profile.jpg",
    "government_id_url": "https://supabase-storage-url.../govt_id.jpg",
    "portfolio_images": [
      "https://supabase-storage-url.../work1.jpg",
      "https://supabase-storage-url.../work2.jpg"
    ],
    "base_rate": 5000,
    "workstation_address": "12 Ikoyi Road, Lagos",
    "city": "Lagos",
    "latitude": 6.4281,
    "longitude": 3.4219,
    "availability": [
      { "day_of_week": 1, "start_time": "08:00", "end_time": "17:00" },
      { "day_of_week": 2, "start_time": "08:00", "end_time": "17:00" },
      { "day_of_week": 3, "start_time": "08:00", "end_time": "17:00" },
      { "day_of_week": 4, "start_time": "08:00", "end_time": "17:00" },
      { "day_of_week": 5, "start_time": "08:00", "end_time": "17:00" }
    ],
    "bank_name": "GTBank",
    "account_number": "0123456789",
    "account_name": "Jane Smith"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Registration successful! You can now start browsing jobs.",
      "user": {
        "id": "artisan-uuid",
        "email": "jane.smith@example.com",
        "role": "artisan",
        "approval_status": "approved"
      },
      "session": {
        "access_token": "eyJhbGciOi...",
        "refresh_token": "refresh-token-string",
        "expires_in": 3600
      }
    }
  }
  ```

### 5. Login
Logs in any user role.
* **Route:** `POST /api/auth/login`
* **Auth Required:** No
* **Request Body:**
  ```json
  {
    "email": "jane.smith@example.com",
    "password": "SecurePass123!"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "user-uuid",
        "email": "jane.smith@example.com",
        "role": "artisan",
        "profile": {
          "id": "user-uuid",
          "role": "artisan",
          "full_name": "Jane Smith",
          "phone_number": "+2348098765432"
        }
      },
      "session": {
        "access_token": "eyJhbGciOi...",
        "refresh_token": "refresh-token-string",
        "expires_in": 3600
      }
    }
  }
  ```

### 6. Refresh Token
Refreshes an expired JWT session.
* **Route:** `POST /api/auth/refresh`
* **Auth Required:** No
* **Request Body:**
  ```json
  {
    "refresh_token": "your-refresh-token-string"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "session": {
        "access_token": "new-access-token-string",
        "refresh_token": "new-refresh-token-string",
        "expires_in": 3600
      }
    }
  }
  ```

---

## 👤 User Profile Management

### 1. Get Current User Profile
Fetches complete details of the logged-in user. Note the specific `role_data` nesting.
* **Route:** `GET /api/users/me`
* **Auth Required:** Yes
* **Response:** Returns either Customer or Artisan structures (defined in [Database-to-JSON Data Structures](#-database-to-json-data-structures)).

### 2. Update Customer Profile
Updates fields in the profiles table.
* **Route:** `PATCH /api/users/me`
* **Auth Required:** Yes
* **Request Body:** (All optional)
  ```json
  {
    "full_name": "John Updated Doe",
    "profile_picture_url": "https://supabase.../new_profile.png"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "profile": {
        "id": "customer-uuid",
        "role": "customer",
        "full_name": "John Updated Doe",
        "phone_number": "+2348012345678",
        "profile_picture_url": "https://supabase.../new_profile.png",
        "role_data": { ... }
      }
    }
  }
  ```

### 3. Update Artisan Profile
Allows an artisan to update fields distributed across the `profiles`, `artisans`, and `artisan_locations` tables.
* **Route:** `PATCH /api/artisans/me`
* **Auth Required:** Yes (Artisan role only)
* **Request Body:** (All optional)
  ```json
  {
    "full_name": "Jane S. Smith",
    "base_rate": 5500,
    "city": "Ikeja",
    "workstation_address": "88 Allen Avenue, Ikeja",
    "tagline": "Premium electrical services in mainland",
    "skills": ["industrial wiring", "panel building"]
  }
  ```
* **Response:** Returns the full updated artisan structure at the root level.

---

## 👷 Artisan Directory & Public Profiles

### 1. Search & Filter Artisans (Public)
Publicly browses approved artisans with optional geolocation sorting.
* **Route:** `GET /api/artisans/search`
* **Auth Required:** Optional
* **Query Parameters:**
  * `category` (UUID, optional) - Category ID to filter by.
  * `city` (string, optional) - Performs case-insensitive matching against workstation locations.
  * `lat` & `lng` (float, optional) - Centroid coordinates. Required to filter by distance or sort by proximity.
  * `radius` (integer, optional) - Distance limit in km. Defaults to `25`. Max is `100`.
  * `sort` (string, optional) - Sorting field: `rating` (default) | `distance` | `reviews` | `price`.
  * `page` (integer, optional) - Pagination index. Defaults to `1`.
  * `limit` (integer, optional) - Items per page limit. Defaults to `20`. Max is `100`.
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "artisans": [
        {
          "id": "artisan-uuid",
          "profession": "Plumber",
          "tagline": "Lagos Plumber Pro",
          "average_rating": 4.8,
          "total_reviews": 24,
          "total_jobs_completed": 18,
          "base_rate": 4000.00,
          "profile": {
            "full_name": "Jane Smith",
            "profile_picture_url": "https://..."
          },
          "location": [
            {
              "city": "Lagos",
              "latitude": 6.5244,
              "longitude": 3.3792
            }
          ],
          "distance_km": 4.2
        }
      ],
      "pagination": {
        "total": 12,
        "page": 1,
        "limit": 20,
        "pages": 1,
        "hasNext": false,
        "hasPrev": false
      }
    }
  }
  ```

### 2. Get Public Artisan Profile
* **Route:** `GET /api/artisans/:id`
* **Auth Required:** Optional
* **Response:** Returns the public profile format including availability, portfolio images, category details, and ratings.

### 3. Get Artisan Reviews
List reviews for a specific user.
* **Route:** `GET /api/artisans/:id/reviews`
* **Auth Required:** No
* **Query Parameters:** `page` (default 1), `limit` (default 10)
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "reviews": [
        {
          "id": "review-uuid",
          "rating": 5,
          "comment": "Perfect electrical work!",
          "created_at": "2026-06-01T10:00:00.000Z",
          "reviewer": {
            "full_name": "John Doe",
            "profile_picture_url": "https://..."
          },
          "job": {
            "id": "job-uuid",
            "title": "Fix sitting room sockets"
          }
        }
      ],
      "rating_breakdown": {
        "5_stars": 8,
        "4_stars": 1,
        "3_stars": 0,
        "2_stars": 0,
        "1_star": 0,
        "total_reviews": 9,
        "average_rating": 4.9
      },
      "pagination": {
        "total": 9,
        "page": 1,
        "pages": 1
      }
    }
  }
  ```

---

## 💼 Jobs Management

### 1. Create a Job
Creates a new service request. 

> [!NOTE]
> All fields except `category_id`, `description`, `budget`, `date_preference`, and `service_type` are optional on the backend validation layer. The frontend client-side code is responsible for checking if `title`, `street`, `city`, `latitude`, or `longitude` should be required (e.g., when `service_type` is `onsite`).

* **Route:** `POST /api/jobs`
* **Auth Required:** Yes (Customer role only)
* **Request Body:**
  ```json
  {
    "category_id": "category-uuid",
    "title": "Repair bathroom faucet leak",
    "description": "The faucet in the master bedroom bathroom is dripping constantly and needs new valves.",
    "budget": 8000,
    "date_preference": "on_date",
    "preferred_date": "2026-06-10T00:00:00.000Z",
    "time_preference": "morning",
    "needs_specific_time": false,
    "service_type": "onsite",
    "street": "14 Adeola Odeku St",
    "city": "Lagos",
    "latitude": 6.4311,
    "longitude": 3.4158,
    "photos": [
      "https://supabase-storage-url.../leak_photo.jpg"
    ]
  }
  ```
* **Response:** Returns the created job record with standard default status `"posted"`.

### 2. Get Job Details
Fetches job details. Automatically fetches related entities (customer profile, category, photos, and assigned artisan profile).
* **Route:** `GET /api/jobs/:id`
* **Auth Required:** Yes
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "id": "job-uuid",
      "customer_id": "customer-uuid",
      "category_id": "category-uuid",
      "title": "Repair bathroom faucet leak",
      "description": "...",
      "budget": 8000.00,
      "date_preference": "on_date",
      "preferred_date": "2026-06-10",
      "status": "posted",
      "customer": {
        "id": "customer-uuid",
        "profiles": {
          "full_name": "John Doe",
          "profile_picture_url": "https://..."
        }
      },
      "category": {
        "id": "category-uuid",
        "name": "Plumbing",
        "icon_url": "https://..."
      },
      "photos": [
        {
          "id": "photo-uuid",
          "photo_url": "https://...",
          "upload_order": 0
        }
      ],
      "assigned_artisan": null
    }
  }
  ```

### 3. Get My Jobs (Customer Portal)
* **Route:** `GET /api/jobs/my-jobs`
* **Auth Required:** Yes (Customer only)
* **Query Parameters:**
  * `page` (default 1)
  * `limit` (default 20)
  * `status` (string, optional) - Special filters allowed:
    * `"open"`: retrieves status `posted` or `offers_received`.
    * `"active"` or `"ongoing"`: retrieves status `assigned` or `in_progress`.
    * Other exact status: `completed`, `cancelled`, etc.
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "jobs": [ ... ],
      "pagination": { ... }
    }
  }
  ```

### 3.5 Get My Jobs (Artisan Portal)
Allows artisans to view their history of assigned, ongoing, completed, and cancelled jobs.
* **Route:** `GET /api/jobs/artisan/my-jobs`
* **Auth Required:** Yes (Artisan only)
* **Query Parameters:**
  * `page` (default 1) - Pagination index.
  * `limit` (default 20) - Items per page.
  * `status` (string, optional) - Filter criteria:
    * `"all"` or omitted: retrieves all assigned jobs regardless of status.
    * `"open"`: retrieves status `assigned` or `in_progress`.
    * `"completed"`: retrieves status `completed`.
    * `"cancelled"`: retrieves status `cancelled`.
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "jobs": [
        {
          "id": "job-uuid",
          "customer_id": "customer-uuid",
          "category_id": "category-uuid",
          "title": "Repair bathroom faucet leak",
          "description": "The faucet in the master bedroom bathroom is dripping constantly...",
          "budget": 8000.00,
          "date_preference": "on_date",
          "preferred_date": "2026-06-10",
          "status": "assigned",
          "street": "14 Adeola Odeku St",
          "city": "Lagos",
          "latitude": 6.4311,
          "longitude": 3.4158,
          "created_at": "2026-06-05T09:00:00.000Z",
          "category": {
            "name": "Plumbing"
          },
          "photos": [
            {
              "photo_url": "https://..."
            }
          ],
          "customer": {
            "id": "customer-uuid",
            "profiles": {
              "full_name": "John Doe",
              "profile_picture_url": "https://..."
            }
          }
        }
      ],
      "pagination": {
        "total": 1,
        "page": 1,
        "limit": 20,
        "pages": 1,
        "hasNext": false,
        "hasPrev": false
      }
    }
  }
  ```

### 4. Browse Jobs (Artisan Board)
Allows artisans to view open jobs.
* **Route:** `GET /api/jobs/browse`
* **Auth Required:** Yes (Artisan only)
* **Query Parameters:** (All optional)
  * `category` (UUID) - Filter by category.
  * `city` (string) - Proximity search by city name.
  * `max_distance` (number) - Max distance in km from artisan's primary location.
  * `min_budget`, `max_budget` (number) - Budget ranges.
  * `date_from`, `date_to` (date) - Range of preferred date.
  * `sort` - Sort parameter: `budget` | `date` (default).
* **Response:** Returns matching open jobs list including calculated `distance_km` relative to artisan's location.

### 5. Update Job Details
Customers can edit jobs (except when completed or cancelled). Can be used to change state to complete.
* **Route:** `PATCH /api/jobs/:id`
* **Auth Required:** Yes (Customer owner only)
* **Request Body:**
  ```json
  {
    "budget": 9000,
    "status": "completed"
  }
  ```
* **Response:** Returns updated job object.

### 6. Cancel Job
* **Route:** `POST /api/jobs/:id/cancel`
* **Auth Required:** Yes (Customer owner only)
* **Request Body:**
  ```json
  {
    "reason": "Artisan failed to show up."
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Job cancelled successfully"
    }
  }
  ```

---

## 🔨 Offers & Bidding Endpoints

### 1. Submit Offer
* **Route:** `POST /api/offers`
* **Auth Required:** Yes (Artisan only)
* **Request Body:**
  ```json
  {
    "job_id": "job-uuid",
    "proposed_price": 7500,
    "cover_letter": "I can repair the faucet leak quickly. I have standard replacement O-rings and tools.",
    "estimated_duration": "2 hours"
  }
  ```
* **Response:** Returns created offer object with status `"pending"`.

### 2. Update Pending Offer
* **Route:** `PATCH /api/offers/:id`
* **Auth Required:** Yes (Artisan owner only)
* **Request Body:**
  ```json
  {
    "proposed_price": 7000
  }
  ```
* **Response:** Returns updated offer object.

### 3. Withdraw Offer
* **Route:** `DELETE /api/offers/:id`
* **Auth Required:** Yes (Artisan owner only)
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Offer withdrawn successfully"
    }
  }
  ```

### 4. Get Job Offers
Customers can retrieve all bids for their job. Artisans calling this on a job will only receive their own submitted bid.
* **Route:** `GET /api/jobs/:jobId/offers`
* **Auth Required:** Yes
* **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "offer-uuid",
        "job_id": "job-uuid",
        "artisan_id": "artisan-uuid",
        "proposed_price": 7500.00,
        "cover_letter": "...",
        "estimated_duration": "2 hours",
        "status": "pending",
        "created_at": "2026-06-05T09:00:00.000Z",
        "artisan": {
          "id": "artisan-uuid",
          "profession": "Plumber",
          "average_rating": 4.80,
          "total_reviews": 24,
          "total_jobs_completed": 18,
          "profiles": {
            "full_name": "Jane Smith",
            "profile_picture_url": "https://..."
          }
        }
      }
    ]
  }
  ```

### 5. Accept Offer
Customer accepts a bid. Accepted status triggers a database constraint automatically rejecting all other job offers, assigning the artisan, and opening a chat conversation room.
* **Route:** `POST /api/offers/:id/accept`
* **Auth Required:** Yes (Customer owner only)
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Offer accepted successfully",
      "conversation_id": "conversation-uuid"
    }
  }
  ```

---

## 💬 Chat & Messaging System

All in-chat actions trigger standard system messages so both participants can review alterations inside the message history stream.

### 1. List Active Conversations
* **Route:** `GET /api/chat/conversations`
* **Auth Required:** Yes
* **Query Parameters:** `page` (default 1), `limit` (default 20)
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "conversations": [
        {
          "id": "conversation-uuid",
          "job_id": "job-uuid",
          "customer_id": "customer-uuid",
          "artisan_id": "artisan-uuid",
          "created_at": "2026-06-05T09:00:00.000Z",
          "updated_at": "2026-06-05T09:15:00.000Z",
          "job": {
            "id": "job-uuid",
            "title": "Repair bathroom faucet leak",
            "status": "assigned"
          },
          "customer": {
            "id": "customer-uuid",
            "profiles": {
              "full_name": "John Doe",
              "profile_picture_url": "https://..."
            }
          },
          "artisan": {
            "id": "artisan-uuid",
            "profession": "Plumber",
            "profiles": {
              "full_name": "Jane Smith",
              "profile_picture_url": "https://..."
            }
          },
          "participant": {
            "id": "artisan-uuid",
            "profession": "Plumber",
            "profiles": {
              "full_name": "Jane Smith",
              "profile_picture_url": "https://..."
            }
          },
          "unread_count": 2,
          "last_message": {
            "content": "Sure, I will arrive at 9 AM",
            "created_at": "2026-06-05T09:15:00.000Z",
            "is_read": false,
            "sender_id": "artisan-uuid"
          }
        }
      ],
      "pagination": { ... }
    }
  }
  ```

### 2. Get Messages List
* **Route:** `GET /api/chat/conversations/:id/messages`
* **Auth Required:** Yes
* **Query Parameters:** `page` (default 1), `limit` (default 50)
* **Response:** Returns paginated messages ordered chronological oldest-first:
  ```json
  {
    "success": true,
    "data": {
      "messages": [
        {
          "id": "msg-uuid",
          "conversation_id": "conversation-uuid",
          "sender_id": null,
          "message_type": "system",
          "content": "Conversation started. You can now chat with each other about the job.",
          "image_url": null,
          "system_event": "conversation_started",
          "system_metadata": { "job_id": "job-uuid" },
          "is_read": false,
          "read_at": null,
          "created_at": "2026-06-05T09:00:00.000Z",
          "sender": null
        },
        {
          "id": "msg-uuid-2",
          "conversation_id": "conversation-uuid",
          "sender_id": "customer-uuid",
          "message_type": "text",
          "content": "Hi, when are you free to start?",
          "image_url": null,
          "system_event": null,
          "system_metadata": null,
          "is_read": true,
          "read_at": "2026-06-05T09:05:00.000Z",
          "created_at": "2026-06-05T09:02:00.000Z",
          "sender": {
            "full_name": "John Doe",
            "profile_picture_url": "https://..."
          }
        }
      ],
      "pagination": { ... }
    }
  }
  ```

### 3. Send Message (REST Fallback)
Sends a message via HTTP instead of WebSocket.
* **Route:** `POST /api/chat/conversations/:id/messages`
* **Auth Required:** Yes
* **Request Body:**
  * For Text Messages:
    ```json
    {
      "message_type": "text",
      "content": "Yes, I will bring the standard pipes."
    }
    ```
  * For Image Sharing:
    ```json
    {
      "message_type": "image",
      "content": "Here is the broken faucet part.",
      "image_url": "https://supabase-storage-url.../msg_image.jpg"
    }
    ```
* **Response:** Returns the created message object.

### 4. Mark Messages as Read
* **Route:** `POST /api/chat/conversations/:id/read`
* **Auth Required:** Yes
* **Request Body:** (Optional)
  ```json
  {
    "message_ids": ["msg-uuid-1", "msg-uuid-2"]
  }
  ```
  *Note:* Leaving `message_ids` empty marks **all** unread messages sent by the other user in the conversation as read.
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Messages marked as read"
    }
  }
  ```

### 5. Reschedule Job (In-Chat Action)
Allows the customer to reschedule the job date/time directly from their conversation window.
* **Route:** `POST /api/chat/conversations/:id/reschedule`
* **Auth Required:** Yes (Customer participant only)
* **Request Body:**
  ```json
  {
    "new_date": "2026-06-12",
    "new_time": "afternoon"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Job rescheduled",
      "system_message_id": "new-system-message-uuid"
    }
  }
  ```

### 6. Increase Budget (In-Chat Action)
Allows the customer to increase the job budget directly from the conversation.
* **Route:** `POST /api/chat/conversations/:id/increase-price`
* **Auth Required:** Yes (Customer participant only)
* **Request Body:**
  ```json
  {
    "new_budget": 10000
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Budget updated",
      "system_message_id": "new-system-message-uuid"
    }
  }
  ```

---

## 💳 Escrow Payments via Paystack

Payments are held securely in escrow. Verification triggers state transitions in job scheduling.

### 1. Initiate Payment
Pre-processes structural details and requests a checkout gateway URL from Paystack. The amount is defined in standard Naira and converted to Kobo on the backend.
* **Route:** `POST /api/payments/initiate`
* **Auth Required:** Yes (Customer owner of assigned job only)
* **Request Body:**
  ```json
  {
    "job_id": "job-uuid",
    "amount": 7500
  }
  ```
* **Response:**
  * Redirect your user directly to `authorization_url` to complete payment.
  ```json
  {
    "success": true,
    "data": {
      "payment_id": "payment-uuid",
      "authorization_url": "https://checkout.paystack.com/97yhadhkashdaksh",
      "access_code": "97yhadhkashdaksh",
      "reference": "TXN_1700000000000_abcd"
    }
  }
  ```

### 2. Verify Payment
Call this route immediately after the payment checkout returns a success status code to capture, log, and verify the transaction in Supabase.
* **Route:** `POST /api/payments/verify`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "reference": "TXN_1700000000000_abcd"
  }
  ```
* **Response:**
  * Triggers job status update to `"in_progress"`.
  ```json
  {
    "success": true,
    "data": {
      "status": "held",
      "message": "Payment verified and held in escrow",
      "payment": {
        "id": "payment-uuid",
        "job_id": "job-uuid",
        "amount": 7500.00,
        "platform_fee": 750.00,
        "artisan_payout": 6750.00,
        "status": "held",
        "transaction_reference": "TXN_1700000000000_abcd"
      }
    }
  }
  ```

### 3. Release Payment
Transfers held escrow funds to the artisan's payout metrics.
* **Route:** `POST /api/payments/:id/release`
* **Auth Required:** Yes (Customer owner only)
* **Response:**
  * Note: The corresponding job must have status `"completed"`.
  ```json
  {
    "success": true,
    "data": {
      "message": "Payment released to artisan",
      "status": "released"
    }
  }
  ```

### 4. Request Refund
Customer requests a refund for unresolved issues before funds are released.
* **Route:** `POST /api/payments/:id/refund`
* **Auth Required:** Yes (Customer owner only)
* **Request Body:**
  ```json
  {
    "reason": "Artisan left the work incomplete."
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Refund processed successfully",
      "status": "refunded"
    }
  }
  ```

### 5. Get Payment History
Retrieves historical logs.
* **Route:** `GET /api/payments/history`
* **Auth Required:** Yes
* **Query Parameters:** `page` (default 1), `limit` (default 20)
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "payments": [
        {
          "id": "payment-uuid",
          "job_id": "job-uuid",
          "amount": 7500.00,
          "status": "released",
          "transaction_reference": "TXN_1700000000000_abcd",
          "created_at": "2026-06-05T09:30:00.000Z",
          "job": {
            "id": "job-uuid",
            "title": "Repair bathroom faucet leak"
          }
        }
      ],
      "pagination": {
        "total": 1,
        "page": 1,
        "pages": 1
      }
    }
  }
  ```

### 6. Paystack Webhook Handler (Backend Webhook integration)
* **Route:** `POST /api/payments/webhook`
* **Auth Required:** No (Verifies Paystack Header: `x-paystack-signature` using cryptographical SHA-512 hashes)
* **Payload:** Direct payload object dispatched by Paystack.
* **Events Processed:**
  * `charge.success` -> Moves payment record to `held`, sets job to `in_progress`, notifies artisan.
  * `charge.failed` -> Sets payment to `failed`.
  * `dispute.create` / `dispute.created` -> Moves payment to `disputed`, updates job to `disputed`.
  * `dispute.resolve` / `dispute.resolved` -> Resolves payment status based on winner (`merchant_won` -> `held`, `customer_won` -> `refunded`).

---

## ⭐ Reviews & Ratings

### 1. Create a Review
Reviews can only be posted after the job is `"completed"`.
* **Route:** `POST /api/reviews`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "job_id": "job-uuid",
    "reviewee_id": "artisan-uuid",
    "rating": 5,
    "comment": "Did a fantastic job patching the leak. Highly recommended!"
  }
  ```
* **Response:** Returns the created review object.

### 2. Flag an Offensive Review
Allows the user being reviewed to flag it for administrative review. This removes it from public listings immediately.
* **Route:** `POST /api/reviews/:id/flag`
* **Auth Required:** Yes (Reviewee owner of review only)
* **Request Body:**
  ```json
  {
    "reason": "This review contains abusive language."
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Review flagged for admin review"
    }
  }
  ```

---

## 🔔 Push Notifications Subsystem

### 1. Register FCM Device Token
Registers a device token for push notifications.
* **Route:** `POST /api/notifications/device-token`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "token": "d7a4hka973h1293adja07a...",
    "platform": "android"
  }
  ```
  *Note:* `platform` must be either `"ios"` or `"android"`.
* **Response:** Returns the database record mapping this user to their active token.

### 2. Remove FCM Device Token
* **Route:** `DELETE /api/notifications/device-token/:token`
* **Auth Required:** Yes
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Device token removed"
    }
  }
  ```

### 3. Get User Notifications
Retrieve all inbox alerts.
* **Route:** `GET /api/notifications`
* **Auth Required:** Yes
* **Query Parameters:** `page` (default 1), `limit` (default 20)
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "notifications": [
        {
          "id": "notif-uuid",
          "user_id": "user-uuid",
          "type": "offer_accepted",
          "title": "Offer Accepted! 🎉",
          "body": "Your offer for Repair bathroom faucet leak has been accepted",
          "job_id": "job-uuid",
          "offer_id": "offer-uuid",
          "conversation_id": "conversation-uuid",
          "is_read": false,
          "created_at": "2026-06-05T09:00:00.000Z"
        }
      ],
      "pagination": { ... }
    }
  }
  ```

### 4. Mark Notification as Read
* **Route:** `PATCH /api/notifications/:id/read`
* **Auth Required:** Yes
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Notification marked as read"
    }
  }
  ```

---

## 📤 Supabase Storage Uploads

Files must be uploaded directly to Supabase Storage *before* submitting them in registration payloads or messages. No authentication token is required for registration uploads.

* **Route:** `POST /api/upload?type=<TYPE>`
* **Auth Required:** No
* **Content-Type:** `multipart/form-data`

### Upload Type Parameters Reference Table
| Type Query Parameter | Form Field Name | Storage Bucket Name | Upload Count | Description |
| --- | --- | --- | --- | --- |
| `profile_picture` | `file` | `profile-pictures` | Single File | Used for the user's avatar image. Public access. |
| `government_id` | `file` | `government-ids` | Single File | Used for artisan identity verification documents. Private access. |
| `portfolio_image` | `file` | `portfolio-images` | Single File | Individual file portfolio upload. Public access. |
| `portfolio_images` | `files` | `portfolio-images` | Multiple Files (max 10) | Bulk portfolio upload. Public access. |

### Response Examples
* **Single File Upload (Success):**
  ```json
  {
    "success": true,
    "data": {
      "url": "https://zpxqpdvsh...supabase.co/storage/v1/object/public/profile-pictures/170000_pic.jpg"
    }
  }
  ```
* **Multiple File Upload (Success):**
  ```json
  {
    "success": true,
    "data": {
      "urls": [
        "https://zpxqpdvsh...supabase.co/storage/v1/object/public/portfolio-images/170000_work1.jpg",
        "https://zpxqpdvsh...supabase.co/storage/v1/object/public/portfolio-images/170000_work2.jpg"
      ]
    }
  }
  ```

---

## 🔌 Socket.io Events Reference

### 1. Connection & Authentication
Connect to the Socket.io server passing the bearer token parameter.
```javascript
import io from 'socket.io-client';

const socket = io('https://your-backend-url.com', {
  auth: {
    token: 'YOUR_ACCESS_TOKEN'
  }
});

socket.on('connect', () => {
  console.log('Connected to socket server');
});
```

### 2. Client-to-Server Events List
* **Join Chat Room:** Joins message rooms after offer acceptance.
  ```javascript
  socket.emit('chat:join', { conversation_id: 'conversation-uuid' });
  ```
  *Server Acknowledgment:* Emits back a `chat:join` event to the sender:
  ```json
  { "conversation_id": "conversation-uuid", "status": "joined" }
  ```

* **Leave Chat Room:**
  ```javascript
  socket.emit('chat:leave', { conversation_id: 'conversation-uuid' });
  ```

* **Send Message:** (Saves message to DB and emits it to all room participants).
  ```javascript
  socket.emit('chat:message', {
    conversation_id: 'conversation-uuid',
    content: 'Are you on your way?',
    message_type: 'text' // or 'image'
  });
  ```
  *Server Acknowledgment:* Emits `message:sent` back to the sender:
  ```json
  { "message_id": "message-uuid" }
  ```

* **Send Typing Indicator:** Broadcasts to other participants in the conversation.
  ```javascript
  socket.emit('chat:typing', {
    conversation_id: 'conversation-uuid',
    is_typing: true // or false
  });
  ```

* **Read Receipt:** Marks message IDs read.
  ```javascript
  socket.emit('chat:read', {
    conversation_id: 'conversation-uuid',
    message_ids: ['msg-uuid-1', 'msg-uuid-2']
  });
  ```

* **Update Live Location:** Dispatches geolocation metrics.
  ```javascript
  socket.emit('location:update', {
    latitude: 6.5244,
    longitude: 3.3792,
    accuracy: 10 // accuracy radius in meters
  });
  ```

* **Track User's Location:** Join tracking room for coordinates broadcast.
  ```javascript
  socket.emit('location:track', { user_id: 'user-uuid' });
  ```

* **Stop Tracking Location:** Leave tracking room.
  ```javascript
  socket.emit('location:stop', { user_id: 'user-uuid' });
  ```

### 3. Server-to-Client Events List
* **New Chat Message (`chat:message`):** Fired in the conversation room.
  ```json
  {
    "id": "msg-uuid",
    "conversation_id": "conversation-uuid",
    "sender_id": "sender-uuid",
    "message_type": "text",
    "content": "Are you on your way?",
    "created_at": "2026-06-05T09:15:00.000Z",
    "sender": {
      "full_name": "John Doe",
      "profile_picture_url": "https://..."
    }
  }
  ```

* **Typing Indicator Broadcast (`chat:typing`):** Received when other participant types.
  ```json
  {
    "user_id": "other-user-uuid",
    "is_typing": true
  }
  ```

* **Read Receipts Broadcast (`chat:read`):**
  ```json
  {
    "user_id": "other-user-uuid",
    "message_ids": ["msg-uuid-1"]
  }
  ```

* **Live Location Updates (`location:update`):** Fired to users inside tracking rooms.
  ```json
  {
    "user_id": "tracked-user-uuid",
    "latitude": 6.5246,
    "longitude": 3.3793,
    "accuracy": 10,
    "timestamp": "2026-06-05T09:16:00.000Z"
  }
  ```

* **User Online/Offline Broadcasts (`user:online` / `user:offline`):**
  Fired globally on connection changes:
  ```json
  {
    "user_id": "user-uuid",
    "is_online": true
  }
  ```

* **Push Notification Fallback (`notification`):**
  Dispatched when user receives alerts while socket connection is active:
  ```json
  {
    "id": "notif-uuid",
    "type": "new_message",
    "title": "New Message",
    "body": "Hi there"
  }
  ```

---

## 🛠️ Admin Management Endpoints

All admin endpoints require an authentication token belonging to a user with role `"admin"`.

* **Get Pending Artisan Approvals:**
  `GET /api/admin/artisans/pending`
* **Approve Artisan Profile:**
  `POST /api/admin/artisans/:id/approve`
* **Reject Artisan Profile:**
  `POST /api/admin/artisans/:id/reject`
  Request body: `{ "reason": "Documents are not clear." }`
* **List Users Registry:**
  `GET /api/admin/users`
* **Get User Profile Details:**
  `GET /api/admin/users/:id`
* **List Job Registry:**
  `GET /api/admin/jobs`
* **Override Job Status:**
  `PATCH /api/admin/jobs/:id/status`
  Request body: `{ "status": "cancelled", "reason": "Violation of policies." }`
* **List Bidding Registry:**
  `GET /api/admin/offers`
* **Override Offer Status:**
  `PATCH /api/admin/offers/:id/status`
  Request body: `{ "status": "rejected", "reason": "Spam bid." }`
* **List Payment History:**
  `GET /api/admin/payments`
* **Get Payments Dashboard Metrics:**
  `GET /api/admin/payments/metrics`
* **Admin Escrow Force-Release Override:**
  `POST /api/admin/payments/:id/release`
  Request body: `{ "platform_fee": 500.00, "artisan_payout": 4500.00, "reason": "Escrow released manually." }` (Fees are optional overrides)
* **Admin Escrow Force-Refund Override:**
  `POST /api/admin/payments/:id/refund`
  Request body: `{ "reason": "Artisan did not show up." }`
* **Get Platform Growth Stats:**
  `GET /api/admin/stats`
* **Get Flagged Reviews Feed:**
  `GET /api/admin/reviews/flagged`

---

## 📦 React Native Integration Boilerplate (Axios Client)

Save this template setup to handle interceptors, token storage, and clean baseURL config:

```javascript
// api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://your-backend-url.com';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request Interceptor: Attach Supabase JWT Token
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Storage read failure:', error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor: Handle Global Failures
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    
    // Auto-refresh expired token logic (401 error)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (refreshToken) {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          const newSession = res.data.data.session;
          await AsyncStorage.setItem('token', newSession.access_token);
          await AsyncStorage.setItem('refresh_token', newSession.refresh_token);
          
          originalRequest.headers.Authorization = `Bearer ${newSession.access_token}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        console.error('Session expired. Redirecting to login.');
        await AsyncStorage.multiRemove(['token', 'refresh_token']);
      }
    }
    
    // Standardize error propagation
    return Promise.reject(error.response?.data || {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Unable to reach the server' }
    });
  }
);
```