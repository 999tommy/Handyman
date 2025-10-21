# ⚡ Quick Start Guide

Get your backend running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a project
2. Copy `Project URL` and API keys from Settings > API
3. Go to SQL Editor and run `database-schema.sql`

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=generate_a_random_32_char_string
```

## 4. Start Server

```bash
npm run dev
```

You should see:
```
✅ Socket.io: Enabled
✅ Database: Connected
Server ready at http://localhost:5000
```

## 5. Test API

```bash
curl http://localhost:5000/health
```

## Next Steps

- Read `SETUP_GUIDE.md` for detailed setup
- See `README.md` for API documentation
- Check `DEPLOYMENT.md` for production deployment

## Key Endpoints

- **Health**: `GET /health`
- **Register Customer**: `POST /api/auth/register/customer`
- **Register Artisan**: `POST /api/auth/register/artisan`
- **Login**: `POST /api/auth/login`
- **Browse Jobs**: `GET /api/jobs/browse` (artisan)
- **Create Job**: `POST /api/jobs` (customer)

## Troubleshooting

**Database connection failed?**
- Check Supabase URL and keys in `.env`
- Ensure database schema is installed

**Port already in use?**
- Change `PORT=5000` to another port in `.env`

**Module not found?**
- Run `npm install` again

---

🎉 **Your backend is ready!**
