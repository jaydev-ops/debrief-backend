// src/routes/notes.js
//
// All note-related endpoints:
//   POST   /notes                        → create + auto-classify a note
//   GET    /notes                        → list notes (filterable by ?type= or ?meetingId=)
//   GET    /notes/meeting/:meetingId     → all notes in one meeting (grouped by type)
//   DELETE /notes/:id                    → delete a note
//   PATCH  /notes/:id/reclassify         → manually change a note's type

const express = require('express');
const router = express.Router();

const {
  createNote,
  getNotes,
  getNotesByMeeting,
  deleteNote,
  reclassifyNote,
} = require('../controllers/notesController');

const { requireAuth } = require('../middleware/auth');

// All note routes require authentication
router.use(requireAuth);

// IMPORTANT: the more specific route "/meeting/:meetingId" must come
// BEFORE the generic "/:id" route, otherwise Express would try to match
// "meeting" as an ID.
router.get('/meeting/:meetingId', getNotesByMeeting);

router.post('/', createNote);
router.get('/', getNotes);
router.delete('/:id', deleteNote);
router.patch('/:id/reclassify', reclassifyNote);

module.exports = router;
