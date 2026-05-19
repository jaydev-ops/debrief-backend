// src/controllers/chatController.js
//
// Handles the group chat feature inside each meeting.
//
//   POST /chat              → send a new message
//   GET  /chat/:meetingId   → get all messages in a meeting's chat
//   DELETE /chat/:id        → delete a message

const prisma = require('../prisma');
const { broadcastMessageDeletedToRoom } = require('../services/socketService');

// ─── SEND MESSAGE ──────────────────────────────────────────────────────────────
// Input (req.body): { text, meetingId }
// Output: the saved message

  async function sendMessage(req, res) {
  try {
    const { text, meetingId, roomId } = req.body;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Message text cannot be empty.' });
    }

    if (!meetingId && !roomId) {
      return res.status(400).json({ error: 'meetingId or roomId is required.' });
    }

    const meetingIdInt = meetingId ? parseInt(meetingId) : 1; // Fallback for MVP db constraint
    const roomIdInt = roomId ? parseInt(roomId) : null;

    // ── Save message ──────────────────────────────────────────────────────────
    const message = await prisma.chatMessage.create({
      data: {
        text: text.trim(),
        meetingId: meetingIdInt,
        roomId: roomIdInt,
        senderId: req.user.id, // Who sent this (from auth middleware)
      },
      include: {
        // Include sender's name in the response so the frontend can display it
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(201).json({
      message: 'Message sent!',
      chatMessage: message,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
}

// ─── GET MESSAGES ──────────────────────────────────────────────────────────────
// Returns all chat messages for a specific meeting, oldest-first.
// Input: meetingId in URL params
// Output: array of messages with sender info

async function getMessages(req, res) {
  try {
    const meetingId = req.params.meetingId ? parseInt(req.params.meetingId) : undefined;
    const roomId = req.params.roomId ? parseInt(req.params.roomId) : undefined;

    if (!meetingId && !roomId) {
      return res.status(400).json({ error: 'Invalid meeting ID or room ID.' });
    }

    const where = {};
    if (meetingId) where.meetingId = meetingId;
    if (roomId) where.roomId = roomId;

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' }, // Oldest first (natural chat order)
      include: {
        sender: {
          select: { id: true, name: true }, // Name to display next to message
        },
      },
    });

    return res.status(200).json({ messages, count: messages.length });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ error: 'Failed to fetch messages.' });
  }
}

// ─── DELETE MESSAGE ────────────────────────────────────────────────────────────
async function deleteMessage(req, res) {
  try {
    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID.' });
    }

    const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Must be sender OR room admin
    let isAdmin = false;
    if (message.roomId) {
      const membership = await prisma.roomMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: message.roomId } }
      });
      if (membership && membership.role === 'admin') isAdmin = true;
    }

    if (message.senderId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this message.' });
    }

    await prisma.chatMessage.delete({ where: { id: messageId } });
    
    if (message.roomId) {
      broadcastMessageDeletedToRoom(message.roomId, messageId);
    }

    return res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ error: 'Failed to delete message.' });
  }
}

module.exports = { sendMessage, getMessages, deleteMessage };
