# 🔄 Next.js to Express.js - Developer Guide

A practical guide for Next.js developers transitioning to Express.js.

## Key Philosophy Differences

**Next.js**: Convention over configuration, automatic routing, integrated frontend/backend
**Express.js**: Explicit configuration, manual setup, backend-only, maximum flexibility

---

## 1. Project Structure

### Next.js
```
app/
├── api/users/route.ts    # API endpoint
└── page.tsx              # UI component
```

### Express.js
```
src/
├── routes/userRoutes.js       # URL routing
├── controllers/userController.js  # Request handling
├── services/userService.js    # Business logic
└── middleware/auth.js         # Cross-cutting concerns
```

**Why the difference?** Express enforces separation of concerns for better maintainability at scale.

---

## 2. Routing

### Next.js (File-based)
```typescript
// app/api/users/route.ts
export async function GET(request: Request) {
  return Response.json({ users: [] });
}
```

### Express.js (Explicit)
```javascript
// routes/userRoutes.js
router.get('/', userController.getUsers);

// controllers/userController.js
const getUsers = async (req, res) => {
  res.json({ users: [] });
};
```

**Key Takeaway**: Express routes are defined explicitly and connected manually.

---

## 3. Request/Response Handling

### Next.js
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const { searchParams } = request.nextUrl;
  
  return Response.json({ data: body }, { status: 201 });
}
```

### Express.js
```javascript
const createUser = async (req, res) => {
  const body = req.body;        // Already parsed
  const query = req.query;       // URL params
  
  res.status(201).json({ data: body });
};
```

**Key Takeaway**: Express uses `req`/`res` objects; body parsing handled by middleware.

---

## 4. Authentication

### Next.js
```typescript
import { getServerSession } from 'next-auth';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // ... protected logic
}
```

### Express.js
```javascript
// middleware/auth.js
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  req.user = await verifyToken(token);
  next(); // Continue to next handler
};

// routes/userRoutes.js
router.get('/profile', authenticate, userController.getProfile);
```

**Key Takeaway**: Express uses middleware chain pattern for reusable auth logic.

---

## 5. Middleware

### Next.js (middleware.ts)
```typescript
export function middleware(request: Request) {
  // Runs on every matching request
  const token = request.cookies.get('token');
  if (!token) return NextResponse.redirect('/login');
  return NextResponse.next();
}

export const config = { matcher: '/dashboard/:path*' };
```

### Express.js
```javascript
// Global middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Route-specific middleware chain
router.post('/create',
  authenticate,        // Check auth
  validateInput,       // Validate data
  rateLimiter,        // Limit requests
  controller.create    // Handle request
);
```

**Key Takeaway**: Express middleware is more granular and composable.

---

## 6. Error Handling

### Next.js
```typescript
export async function GET(request: Request) {
  try {
    const data = await fetchData();
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Express.js
```javascript
// Controller (throws errors)
const getUser = async (req, res) => {
  const user = await userService.getUser(req.params.id);
  res.json({ user });
};

// Global error handler (catches all)
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.statusCode || 500).json({
    error: { code: err.code, message: err.message }
  });
});

// Async wrapper utility
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/:id', asyncHandler(getUser));
```

**Key Takeaway**: Express uses centralized error handling with async wrappers.

---

## 7. Environment Variables

### Next.js
```typescript
// Client-side (public)
process.env.NEXT_PUBLIC_API_URL

// Server-side (private)
process.env.DATABASE_URL
```

### Express.js
```javascript
require('dotenv').config();

// All env vars are server-side
process.env.DATABASE_URL
process.env.JWT_SECRET
```

**Key Takeaway**: In Express, all env vars are private by default.

---

## 8. Database Queries

### Next.js (in API route)
```typescript
export async function GET() {
  const { data, error } = await supabase
    .from('users')
    .select('*');
  
  return Response.json({ data });
}
```

### Express.js (separated layers)
```javascript
// services/userService.js (business logic)
const getUsers = async () => {
  const { data } = await supabase.from('users').select('*');
  return data;
};

// controllers/userController.js (HTTP handling)
const getUsers = async (req, res) => {
  const users = await userService.getUsers();
  res.json({ users });
};
```

**Key Takeaway**: Express encourages separating DB logic from HTTP logic.

---

## 9. Validation

### Next.js
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  if (!body.email || !body.password) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }
  // ... rest of logic
}
```

### Express.js
```javascript
// middleware/validation.js
const validateUser = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  });
  
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  next();
};

// routes/userRoutes.js
router.post('/', validateUser, userController.createUser);
```

**Key Takeaway**: Express uses validation middleware with libraries like Joi.

---

## 10. Real-time Features

### Next.js
```typescript
// Limited - use external services or custom WebSocket server
// Next.js doesn't have built-in WebSocket support
```

### Express.js + Socket.io
```javascript
// server.js
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    io.to(roomId).emit('message', data);
  });
});

server.listen(5000);
```

**Key Takeaway**: Express easily integrates with Socket.io for real-time features.

---

## Common Patterns Translation

### API Route → Express Route

**Next.js:**
```typescript
// app/api/users/[id]/route.ts
export async function GET(req, { params }) {
  return Response.json({ id: params.id });
}
```

**Express:**
```javascript
// routes/userRoutes.js
router.get('/:id', userController.getUser);

// controllers/userController.js
const getUser = async (req, res) => {
  res.json({ id: req.params.id });
};
```

### Protected Route

**Next.js:**
```typescript
const session = await getServerSession();
if (!session) return redirect('/login');
```

**Express:**
```javascript
router.get('/profile', authenticate, controller.getProfile);
```

### Rate Limiting

**Next.js:**
```typescript
// Use external service or custom implementation
```

**Express:**
```javascript
const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 60000, max: 100 }));
```

---

## Development Workflow Differences

| Task | Next.js | Express.js |
|------|---------|------------|
| **Start dev** | `npm run dev` | `npm run dev` (with nodemon) |
| **Hot reload** | ✅ Automatic | ✅ With nodemon |
| **API testing** | Via frontend | Postman/curl directly |
| **Debugging** | Chrome DevTools | Node debugger/console |
| **Deployment** | Vercel (optimized) | Any Node.js host |

---

## Advantages of Each

### Next.js Advantages
- ✅ Faster development for full-stack apps
- ✅ Built-in optimizations (caching, ISR, SSR)
- ✅ Tight integration with React
- ✅ Great for startups/MVPs

### Express.js Advantages
- ✅ Maximum flexibility and control
- ✅ Better for microservices
- ✅ Easier to scale independently
- ✅ Language-agnostic frontend
- ✅ Better for complex backends
- ✅ Easier real-time features

---

## Migration Tips

1. **Start with routes**: Map Next.js API routes to Express routes
2. **Extract logic**: Move business logic to services
3. **Add middleware**: Replace inline checks with middleware
4. **Centralize errors**: Use global error handler
5. **Test incrementally**: Test each endpoint after migration

---

## Learning Resources

- **Express Docs**: expressjs.com
- **Node.js Best Practices**: github.com/goldbergyoni/nodebestpractices
- **This Codebase**: Well-commented for learning!

---

## Quick Reference

```javascript
// Next.js → Express.js

// Request body
request.json() → req.body

// Query params
request.nextUrl.searchParams → req.query

// URL params
params.id → req.params.id

// Headers
request.headers.get('x-header') → req.headers['x-header']

// Response
Response.json({data}) → res.json({data})

// Status code
Response.json({}, {status: 201}) → res.status(201).json({})

// Redirect
NextResponse.redirect('/login') → res.redirect('/login')

// Cookies
request.cookies.get('token') → req.cookies.token
```

---

**🎉 You're ready to work with Express.js!**

This codebase follows all these patterns. Explore the code to see them in action.
