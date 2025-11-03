# 📦 Supabase Storage Setup Guide

This guide will help you set up Supabase Storage buckets for file uploads (profile pictures, government IDs, and portfolio images).

---

## 🎯 What You Need to Create

You need **3 storage buckets**:
1. **profile-pictures** - For user profile photos
2. **government-ids** - For artisan ID verification
3. **portfolio-images** - For artisan work samples

---

## 📋 Step-by-Step Setup

### Step 1: Go to Supabase Dashboard

1. Go to [supabase.com](https://supabase.com) and log in
2. Select your **Handyman** project
3. Click **Storage** in the left sidebar

---

### Step 2: Create Buckets

#### **Bucket 1: profile-pictures**

1. Click **"New bucket"**
2. Fill in:
   - **Name**: `profile-pictures`
   - **Public bucket**: ✅ **YES** (check this!)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: Leave empty (we validate in backend)
3. Click **"Create bucket"**

#### **Bucket 2: government-ids**

1. Click **"New bucket"**
2. Fill in:
   - **Name**: `government-ids`
   - **Public bucket**: ❌ **NO** (keep this private!)
   - **File size limit**: 5 MB
3. Click **"Create bucket"**

> ⚠️ **Important**: Government IDs should NOT be public!

#### **Bucket 3: portfolio-images**

1. Click **"New bucket"**
2. Fill in:
   - **Name**: `portfolio-images`
   - **Public bucket**: ✅ **YES** (check this!)
   - **File size limit**: 5 MB
3. Click **"Create bucket"**

---

### Step 3: Set Up Storage Policies

For each bucket, you need to set access policies.

#### **For profile-pictures bucket:**

1. Click on `profile-pictures` bucket
2. Go to **"Policies"** tab
3. Click **"New policy"**
4. Choose **"For full customization"**

**Policy 1: Allow uploads**
```sql
-- Name: Allow authenticated uploads
-- Operation: INSERT
-- Policy:
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures');
```

**Policy 2: Allow public reads**
```sql
-- Name: Allow public reads
-- Operation: SELECT
-- Policy:
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');
```

**Policy 3: Allow users to update their own**
```sql
-- Name: Allow users to update own files
-- Operation: UPDATE
-- Policy:
CREATE POLICY "Allow users to update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Policy 4: Allow users to delete their own**
```sql
-- Name: Allow users to delete own files
-- Operation: DELETE
-- Policy:
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
```

#### **For government-ids bucket:**

1. Click on `government-ids` bucket
2. Go to **"Policies"** tab

**Policy 1: Allow authenticated uploads**
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'government-ids');
```

**Policy 2: Allow users to read their own IDs**
```sql
CREATE POLICY "Allow users to read own IDs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'government-ids' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Policy 3: Allow admins to read all**
```sql
CREATE POLICY "Allow admins to read all IDs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'government-ids' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

#### **For portfolio-images bucket:**

Same policies as `profile-pictures` (replace bucket name).

---

### Step 4: Test Upload

You can test if storage is working:

#### Using Supabase Dashboard:
1. Go to **Storage** → `profile-pictures`
2. Click **"Upload file"**
3. Upload a test image
4. If successful, you'll see the file in the bucket

#### Using API:
```bash
curl -X POST http://localhost:5000/api/upload/profile-picture \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/image.jpg"
```

You should get back:
```json
{
  "success": true,
  "data": {
    "url": "https://xxx.supabase.co/storage/v1/object/public/profile-pictures/..."
  }
}
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep `government-ids` bucket **private**
- Make `profile-pictures` and `portfolio-images` **public**
- Use RLS policies to restrict access
- Validate file types in backend
- Set file size limits

### ❌ DON'T:
- Don't make government IDs public
- Don't allow unauthenticated uploads
- Don't skip file validation
- Don't allow unlimited file sizes

---

## 📱 Frontend Integration

Your frontend developer should upload files like this:

### Example: React Native Upload

```javascript
const uploadProfilePicture = async (imageUri) => {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'profile.jpg',
  });

  const response = await fetch('https://your-backend.up.railway.app/api/upload/profile-picture', {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const result = await response.json();
  return result.data.url; // Returns Supabase public URL
};
```

### Upload Flow During Registration:

**Artisan Registration Steps:**
1. User selects profile picture → Upload to `/api/upload/profile-picture` → Get URL
2. User selects government ID → Upload to `/api/upload/government-id` → Get URL
3. User selects portfolio images → Upload to `/api/upload/portfolio-images` → Get URLs array
4. Submit registration with all URLs included

---

## 🐛 Troubleshooting

### Issue: "403 Forbidden" when uploading
**Solution**: Check that your RLS policies allow the operation.

### Issue: "Bucket not found"
**Solution**: Make sure bucket names match exactly (lowercase, no spaces).

### Issue: Files upload but can't be accessed
**Solution**: 
- Check if bucket is public (for profile pictures/portfolio)
- Verify RLS policies allow SELECT

### Issue: "Policy violation" error
**Solution**: Your RLS policy might be too restrictive. Try the policies above.

---

## 🧪 Test Checklist

Before going to production, test:

- [ ] Upload profile picture as unauthenticated user
- [ ] Upload government ID (should work)
- [ ] Upload portfolio images (multiple at once)
- [ ] Try accessing profile picture URL in browser (should work)
- [ ] Try accessing government ID URL as different user (should fail)
- [ ] Upload file larger than 5MB (should fail)
- [ ] Upload non-image file (should fail)

---

## 🎉 Summary

After completing this guide, you should have:
- ✅ 3 Supabase Storage buckets created
- ✅ Proper RLS policies set up
- ✅ Public access for profile pictures and portfolio
- ✅ Private access for government IDs
- ✅ Working upload endpoints

**Next Step**: Test your registration flow end-to-end!

---

## 💡 Quick Reference

**Bucket Names:**
- `profile-pictures` (public)
- `government-ids` (private)
- `portfolio-images` (public)

**Upload Endpoints:**
- `POST /api/upload/profile-picture`
- `POST /api/upload/government-id`
- `POST /api/upload/portfolio-image`
- `POST /api/upload/portfolio-images` (multiple)

**File Limits:**
- Max size: 5 MB
- Allowed types: JPEG, PNG, WebP
- Rate limit: 10 uploads per 15 minutes

---

**Need help?** Check Supabase Storage docs: https://supabase.com/docs/guides/storage
