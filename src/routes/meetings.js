// src/routes/meetings.js
//
// All meeting-related endpoints:
//   POST   /meetings        → create a meeting
//   GET    /meetings        → list all my meetings
//   GET    /meetings/:id    → get one meeting (with notes + chat)
//   DELETE /meetings/:id    → delete a meeting

const express = require('express');
const router = express.Router();

const {
  createMeeting,
  getMeetings,
  getMeetingById,
  deleteMeeting,
} = require('../controllers/meetingsController');

const { requireAuth } = require('../middleware/auth');

// All meeting routes require authentication
// requireAuth is applied to every route in this file
router.use(requireAuth);

router.post('/', createMeeting);
router.get('/', getMeetings);
router.get('/:id', getMeetingById);
router.delete('/:id', deleteMeeting);

module.exports = router;
