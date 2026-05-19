// src/routes/auth.js
//
// Routes are like a "menu" — they map URL + HTTP method to a controller function.
//
// This file maps:
//   POST /auth/register → authController.register
//   POST /auth/login    → authController.login
//   GET  /auth/me       → authController.getMe  (requires login)

const express = require('express');
const router = express.Router(); // A mini Express app just for auth routes

const { register, login, getMe, deleteAccount } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// Public routes — no login needed
router.post('/register', register);
router.post('/login', login);

// Protected route — must be logged in
// requireAuth runs FIRST, then getMe runs if the token is valid
router.get('/me', requireAuth, getMe);
router.delete('/me', requireAuth, deleteAccount);

module.exports = router;
