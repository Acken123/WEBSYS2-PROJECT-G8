// routes/users.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

// Show registration form
router.get('/register', (req, res) => {
  res.render('register', { title: "Register" });
});

// Handle registration
router.post('/register', async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email: req.body.email });
    if (existingUser) return res.send("User already exists with this email.");

    const hashedPassword = await bcrypt.hash(req.body.password, 12);
    const currentDate = new Date();

    const newUser = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      passwordHash: hashedPassword,
      role: 'customer',
      accountStatus: 'active',
      isEmailVerified: false,
      createdAt: currentDate,
      updatedAt: currentDate
    };

    await usersCollection.insertOne(newUser);

    res.redirect('/users/list');
  } catch (err) {
    console.error("Error registering user:", err);
    res.send("Something went wrong.");
  }
});

// Show login form
router.get('/login', (req, res) => {
  res.render('login', { title: "Login" });
});

// Handle login
router.post('/login', async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: req.body.email });
    if (!user) return res.send("User not found.");

    if (user.accountStatus !== 'active') {
      return res.send("Account is not active.");
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!isPasswordValid) return res.send("Invalid password.");

    // Save session
    req.session.user = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    };

    res.redirect('/users/dashboard');
  } catch (err) {
    console.error("Error during login:", err);
    res.send("Something went wrong.");
  }
});

// Dashboard route
router.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/users/login');

  res.render('dashboard', {
    title: "User Dashboard",
    user: req.session.user
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/users/login');
  });
});

// ✅ User list
router.get('/list', async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const users = await db.collection('users')
      .find({}, { projection: { passwordHash: 0 } })
      .toArray();

    res.render('user-list', {
      title: "User List",
      users
    });
  } catch (err) {
    next(err);
  }
});

// ✅ Edit user (GET form)
router.get('/edit/:id', async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });

    if (!user) return res.send("User not found.");

    res.render('edit-users', { user });
  } catch (err) {
    next(err);
  }
});

// ✅ Edit user (POST update)
router.post('/edit/:id', async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          updatedAt: new Date()
        }
      }
    );

    res.redirect('/users/list');
  } catch (err) {
    next(err);
  }
});

// ✅ Delete user
router.post('/delete/:id', async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

    res.redirect('/users/list');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
