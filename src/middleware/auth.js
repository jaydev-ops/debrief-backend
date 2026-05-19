// src/middleware/auth.js
//
// MIDDLEWARE: Code that runs BETWEEN receiving a request and sending a response.
//
// This specific middleware checks: "Is this person logged in?"
// It does that by reading a JWT (JSON Web Token) from the request headers.
//
// How JWT works (simple explanation):
//   1. User logs in → server creates a signed "token" string
//   2. Frontend stores that token (in localStorage or memory)
//   3. On every request, frontend sends: `Authorization: Bearer <token>`
//   4. THIS middleware reads and verifies the token
//   5. If valid → continues to the route handler
//   6. If invalid/missing → returns 401 Unauthorized immediately

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // ── Step 1: Read the Authorization header ─────────────────────────────────
  // It should look like: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'No authorization header. Please log in first.',
    });
  }

  // ── Step 2: Extract the token (remove the "Bearer " prefix) ───────────────
  // "Bearer eyJ..." → split by space → take the second part
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Malformed authorization header. Expected: Bearer <token>',
    });
  }

  // ── Step 3: Verify the token ───────────────────────────────────────────────
  // jwt.verify checks:
  //   a) Was this token signed with our secret? (not tampered with)
  //   b) Has it expired?
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Step 4: Attach user info to the request object ───────────────────────
    // Now any route handler can access req.user.id and req.user.email
    req.user = decoded;

    // ── Step 5: Pass control to the next handler ──────────────────────────────
    next();
  } catch (error) {
    // Token is invalid or expired
    return res.status(401).json({
      error: 'Invalid or expired token. Please log in again.',
    });
  }
}

module.exports = { requireAuth };
