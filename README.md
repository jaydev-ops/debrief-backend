# Debrief Backend

A clean Node.js + Express + Prisma + SQLite backend for the Debrief meeting notes app.

---

## Project Structure

```
debrief-backend/
├── prisma/
│   ├── schema.prisma       ← Database blueprint (tables + columns)
│   └── seed.js             ← Starter data for testing
├── src/
│   ├── server.js           ← Entry point — starts the server
│   ├── prisma.js           ← Shared database client (one connection)
│   ├── middleware/
│   │   └── auth.js         ← JWT token checker (protects routes)
│   ├── services/
│   │   └── classifyNote.js ← Auto-classification logic (keyword matching)
│   ├── controllers/
│   │   ├── authController.js      ← register / login / getMe
│   │   ├── meetingsController.js  ← CRUD for meetings
│   │   ├── notesController.js     ← CRUD for notes + auto-classify
│   │   └── chatController.js      ← send/get chat messages
│   └── routes/
│       ├── auth.js         ← /auth/...
│       ├── meetings.js     ← /meetings/...
│       ├── notes.js        ← /notes/...
│       └── chat.js         ← /chat/...
├── .env                    ← Secret config (never commit this)
├── .gitignore
└── package.json
```

---

## Step-by-Step Setup

### Step 1 — Install dependencies

```bash
cd debrief-backend
npm install
```

This installs: express, cors, dotenv, bcryptjs, jsonwebtoken, @prisma/client, prisma, nodemon.

---

### Step 2 — Set up the database

```bash
npm run db:migrate
```

This does three things automatically:
1. Reads `prisma/schema.prisma`
2. Creates a `dev.db` SQLite file in the `prisma/` folder
3. Creates all the tables (User, Meeting, Note, ChatMessage)

You'll be prompted for a migration name — just press Enter.

---

### Step 3 — Generate Prisma Client

```bash
npm run db:generate
```

This generates the TypeScript/JS types that let you write `prisma.user.findMany()` etc.

> Note: `db:migrate` usually runs this automatically, but run it manually if you see import errors.

---

### Step 4 — Seed the database (optional but recommended)

```bash
npm run db:seed
```

Creates:
- A demo user: `demo@debrief.com` / `password123`
- A sample meeting: "Q4 Planning Meeting"
- 4 sample notes (one of each type)
- 2 sample chat messages

---

### Step 5 — Start the server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

You should see:
```
🚀 Debrief backend is running!
📡 URL:      http://localhost:3001
❤️  Health:   http://localhost:3001/health
```

Visit http://localhost:3001/health to confirm it's working.

---

## API Reference

### Auth

| Method | URL             | Auth? | Body                           | Description        |
|--------|-----------------|-------|--------------------------------|--------------------|
| POST   | /auth/register  | No    | `{ name, email, password }`   | Create account     |
| POST   | /auth/login     | No    | `{ email, password }`          | Login, get token   |
| GET    | /auth/me        | Yes   | —                              | Get my profile     |

**Login response** (save the `token` — you'll need it for all other requests):
```json
{
  "message": "Logged in successfully!",
  "user": { "id": 1, "name": "Demo User", "email": "demo@debrief.com" },
  "token": "eyJhbGci..."
}
```

**How to send the token** (add this header to every protected request):
```
Authorization: Bearer eyJhbGci...
```

---

### Meetings

| Method | URL              | Auth? | Body            | Description              |
|--------|------------------|-------|-----------------|--------------------------|
| POST   | /meetings        | Yes   | `{ title }`     | Create meeting           |
| GET    | /meetings        | Yes   | —               | List my meetings         |
| GET    | /meetings/:id    | Yes   | —               | Get meeting + notes/chat |
| DELETE | /meetings/:id    | Yes   | —               | Delete meeting           |

---

### Notes

| Method | URL                           | Auth? | Body                     | Description                     |
|--------|-------------------------------|-------|--------------------------|---------------------------------|
| POST   | /notes                        | Yes   | `{ content, meetingId }` | Create + auto-classify note     |
| GET    | /notes                        | Yes   | —                        | All notes (see filters below)   |
| GET    | /notes/meeting/:meetingId     | Yes   | —                        | All notes in a meeting          |
| DELETE | /notes/:id                    | Yes   | —                        | Delete a note                   |
| PATCH  | /notes/:id/reclassify         | Yes   | `{ type }`               | Manually override type          |

**GET /notes query filters:**
```
GET /notes?type=action           → only action items
GET /notes?meetingId=1           → only notes from meeting 1
GET /notes?type=decision&meetingId=1  → decisions from meeting 1
```

**POST /notes response** (note the `classification` field showing why it was classified):
```json
{
  "message": "Note created and classified!",
  "note": { "id": 5, "content": "We decided to use Postgres", "type": "decision", ... },
  "classification": {
    "type": "decision",
    "matchedKeywords": ["decide"]
  }
}
```

---

### Chat

| Method | URL                    | Auth? | Body                    | Description               |
|--------|------------------------|-------|-------------------------|---------------------------|
| POST   | /chat                  | Yes   | `{ text, meetingId }`  | Send a message            |
| GET    | /chat/:meetingId       | Yes   | —                       | Get all messages          |

---

## Testing with Postman or curl

### 1. Register
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@test.com", "password": "secret123"}'
```

### 2. Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@debrief.com", "password": "password123"}'
```

### 3. Create a meeting (replace TOKEN with yours)
```bash
curl -X POST http://localhost:3001/meetings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title": "Sprint Planning"}'
```

### 4. Create a note (auto-classified!)
```bash
curl -X POST http://localhost:3001/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"content": "We decided to use Postgres for the database", "meetingId": 1}'
```

### 5. Get all notes grouped by type
```bash
curl http://localhost:3001/notes/meeting/1 \
  -H "Authorization: Bearer TOKEN"
```

---

## How Classification Works

The backend reads the note text and checks keyword patterns:

| Type       | Example triggers                                          |
|------------|-----------------------------------------------------------|
| decision   | "decided", "final", "agreed", "approved", "going with"   |
| action     | "will fix", "needs to", "assign", "deadline", "by Friday"|
| problem    | "bug", "error", "crash", "not working", "outage"         |
| discussion | (default — anything that doesn't match above)             |

The classifier is in `src/services/classifyNote.js` and is completely independent —
you can swap it for an AI/OpenAI call later without touching any routes or controllers.

---

## Connecting to the Frontend

In your React app, update your API calls to point to `http://localhost:3001`.

Example (using fetch):
```js
// Login
const res = await fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { token } = await res.json();
localStorage.setItem('token', token);

// Create a note (protected)
const token = localStorage.getItem('token');
const res = await fetch('http://localhost:3001/notes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ content: noteText, meetingId: 1 }),
});
```
