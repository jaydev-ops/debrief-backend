// src/routes/chat.js
//
// Chat-related endpoints:
//   POST /chat               → send a message
//   GET  /chat/:meetingId    → get all messages for a meeting

const express = require('express');
const router = express.Router();

const { sendMessage, getMessages, deleteMessage } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', sendMessage);
router.get('/:meetingId', getMessages);
router.get('/room/:roomId', getMessages);
router.delete('/:id', deleteMessage);

module.exports = router;
