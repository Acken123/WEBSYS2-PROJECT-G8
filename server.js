const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Use process.env.PORT for Render, fallback to 3000 locally
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true only in production with HTTPS
}));

// MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Expose client & dbName to routes
app.locals.client = client;
app.locals.dbName = process.env.DB_NAME || "ecommerceDB";

// Routes
const usersRoute = require('./routes/users');
app.use('/users', usersRoute);

// Optional: handle root `/`
app.get('/', (req, res) => {
  res.send('<h1>Welcome to Ecommerce App</h1><p><a href="/users/list">View Users</a></p>');
});

// Updated server startup with MongoDB connection
async function main() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }

  // Always start the server (even if DB fails)
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

main();
