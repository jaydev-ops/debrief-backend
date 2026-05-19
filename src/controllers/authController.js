// src/controllers/authController.js
//
// Controllers handle the LOGIC for each route.
// They read from the request, talk to the database, and send back a response.
//
// This controller handles:
//   POST /auth/register → create a new account
//   POST /auth/login    → log in and get a JWT token

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// ─── REGISTER ─────────────────────────────────────────────────────────────────
// Creates a new user account.
// Input (req.body): { name, email, password }
// Output: { user: {...}, token: "..." }

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // ── Validate input ────────────────────────────────────────────────────────
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'name, email, and password are all required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters.',
      });
    }

    // ── Check if email already exists ─────────────────────────────────────────
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      });
    }

    // ── Hash the password ─────────────────────────────────────────────────────
    // bcrypt.hash(password, saltRounds)
    // saltRounds=10 is a good balance of security vs speed
    // This turns "mypassword" into something like "$2a$10$xyz..."
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Save user to database ─────────────────────────────────────────────────
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    // ── Create a JWT token ────────────────────────────────────────────────────
    // jwt.sign(payload, secret, options)
    // payload = what we encode into the token (we store user id + email)
    // expiresIn = token is invalid after 7 days
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ── Respond with user info + token ────────────────────────────────────────
    // We never send the password back — not even the hashed version
    return res.status(201).json({
      message: 'Account created successfully!',
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Something went wrong during registration.' });
  }
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// Checks credentials and returns a JWT token.
// Input (req.body): { email, password }
// Output: { user: {...}, token: "..." }

async function login(req, res) {
  try {
    const { email, password } = req.body;

    // ── Validate input ────────────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    // ── Find user by email ────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // We say "invalid credentials" (not "email not found") for security
      // This prevents attackers from knowing which emails exist
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ── Compare password with stored hash ─────────────────────────────────────
    // bcrypt.compare handles the hashing internally — you just pass the plain text
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ── Create JWT token ──────────────────────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Logged in successfully!',
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Something went wrong during login.' });
  }
}

// ─── GET ME ───────────────────────────────────────────────────────────────────
// Returns the currently logged-in user's profile.
// Requires auth middleware (req.user is set by middleware).
// Input: JWT token in Authorization header
// Output: { user: {...} }

async function getMe(req, res) {
  try {
    // req.user was set by the requireAuth middleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, createdAt: true }, // Never select password
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────
async function deleteAccount(req, res) {
  try {
    const userId = req.user.id;

    // 1. Admin auto-reassignment logic
    // We must ensure rooms aren't left without admins, and if empty, they are deleted.
    const allMemberships = await prisma.roomMember.findMany({
      where: { userId },
      include: { room: { include: { members: { orderBy: { joinedAt: 'asc' } } } } }
    });

    for (const membership of allMemberships) {
      const room = membership.room;
      const remainingMembers = room.members.filter(m => m.userId !== userId);
      
      if (remainingMembers.length === 0) {
        // Room is completely empty, delete it
        await prisma.room.delete({ where: { id: room.id } });
      } else if (membership.role === 'admin') {
        // User is an admin, check if there are other admins
        const otherAdmins = remainingMembers.filter(m => m.role === 'admin');
        if (otherAdmins.length === 0) {
          // No other admins, promote the oldest member
          const oldestMember = remainingMembers[0];
          await prisma.roomMember.update({
            where: { id: oldestMember.id },
            data: { role: 'admin' }
          });
        }
      }
    }

    // 2. Remove the user's memberships
    await prisma.roomMember.deleteMany({ where: { userId } });

    // Note: Thanks to onDelete: SetNull in schema.prisma, 
    // ChatMessages, Notes, Meetings, and Rooms created by the user 
    // will NOT be deleted, but their author/createdById will become null.
    // This preserves collaborative history!

    // 3. Finally delete the user
    await prisma.user.delete({ where: { id: userId } });

    return res.status(200).json({ message: 'Account deleted successfully. Collaborative history preserved anonymously.' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
}

module.exports = { register, login, getMe, deleteAccount };
