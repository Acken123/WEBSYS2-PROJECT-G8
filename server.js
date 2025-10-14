const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Use process.env.PORT for Render, fallback to 3000 locally
const PORT = process.env.PORT || 3000;

// Trust proxy (important for Render deployment)
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session setup - UPDATED with timeout
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 15 * 60 * 1000 // 15 minutes
  }
}));

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  next();
});

// Session timeout middleware
app.use((req, res, next) => {
  const publicRoutes = [
    '/',
    '/users/login',
    '/users/register',
    '/password/forgot',
    '/health'
  ];

  const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route)) ||
                        req.path.startsWith('/password/reset/') ||
                        req.path.startsWith('/users/verify/') ||
                        req.path.startsWith('/styles/') ||
                        req.path.startsWith('/scripts/') ||
                        req.path.startsWith('/images/');

  if (!isPublicRoute) {
    if (!req.session.user) {
      return res.redirect('/users/login?expired=true');
    }

    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const timeoutDuration = 15 * 60 * 1000;

    if (now - lastActivity > timeoutDuration) {
      req.session.destroy(err => {
        if (err) console.error("Session destruction error:", err);
      });
      return res.redirect('/users/login?expired=true');
    }

    req.session.lastActivity = now;
  }

  next();
});

// MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Expose client & dbName to routes
app.locals.client = client;
app.locals.dbName = process.env.DB_NAME || "ecommerceDB";

// Serve static files before routes
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.type('text').send('ok');
});

// Crash test routes
app.get('/crash', (req, res, next) => {
  // Forward the error to Express's error handler
  next(new Error('Test crash'));
});

app.get('/crash-async', async (req, res, next) => {
  try {
    throw new Error('Async crash');
  } catch (err) {
    next(err); // correctly passes to error handler
  }
});


// Routes
const indexRoute = require('./routes/index');
const usersRoute = require('./routes/users');
const passwordRoute = require('./routes/password');

app.use('/', indexRoute);
app.use('/users', usersRoute);
app.use('/password', passwordRoute);

// 404 handler (must be after all routes and static files)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found', path: req.path });
  }

  res.set('Cache-Control', 'no-store');
  res.status(404).render('404', { title: 'Page Not Found' });
});

// 500 error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
  }

  if (res.headersSent) return next(err);

  res.status(500).render('500', { 
    title: 'Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// MongoDB connection + server startup
async function main() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await client.close();
  process.exit(0);
});

main();
