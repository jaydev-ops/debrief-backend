// src/controllers/meetingsController.js
//
// Handles everything related to Meetings:
//   POST /meetings     → create a new meeting
//   GET  /meetings     → list all meetings (for the logged-in user)
//   GET  /meetings/:id → get a single meeting with its notes

const prisma = require('../prisma');

// ─── CREATE MEETING ────────────────────────────────────────────────────────────
// Input (req.body): { title, date? }
// Output: the newly created meeting object

async function createMeeting(req, res) {
  try {
    const { title, date } = req.body;

    // Validate input
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Meeting title is required.' });
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: title.trim(),
        date: date ? new Date(date) : new Date(), // Use provided date or now
        createdById: req.user.id, // req.user comes from the auth middleware
      },
    });

    return res.status(201).json({
      message: 'Meeting created!',
      meeting,
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    return res.status(500).json({ error: 'Failed to create meeting.' });
  }
}

// ─── LIST ALL MEETINGS ─────────────────────────────────────────────────────────
// Returns all meetings created by the logged-in user.
// Also counts notes per meeting (useful for the UI).

async function getMeetings(req, res) {
  try {
    const meetings = await prisma.meeting.findMany({
      where: {
        createdById: req.user.id, // Only show THIS user's meetings
      },
      orderBy: {
        date: 'desc', // Newest first
      },
      include: {
        // Include a COUNT of notes without fetching all note data
        _count: {
          select: { notes: true, chatMessages: true },
        },
      },
    });

    return res.status(200).json({ meetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    return res.status(500).json({ error: 'Failed to fetch meetings.' });
  }
}

// ─── GET SINGLE MEETING ────────────────────────────────────────────────────────
// Returns one meeting + all its notes + all its chat messages.
// This is what you'd call when opening a specific meeting page.

async function getMeetingById(req, res) {
  try {
    const meetingId = parseInt(req.params.id); // URL params are always strings — convert to number

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID.' });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, name: true }, // Only include safe fields
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    // Optional: check if this user owns the meeting
    if (meeting.createdById !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this meeting.' });
    }

    return res.status(200).json({ meeting });
  } catch (error) {
    console.error('Get meeting by ID error:', error);
    return res.status(500).json({ error: 'Failed to fetch meeting.' });
  }
}

// ─── DELETE MEETING ────────────────────────────────────────────────────────────

async function deleteMeeting(req, res) {
  try {
    const meetingId = parseInt(req.params.id);

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    if (meeting.createdById !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own meetings.' });
    }

    // Cascade delete is set in schema — notes + chats auto-delete too
    await prisma.meeting.delete({ where: { id: meetingId } });

    return res.status(200).json({ message: 'Meeting deleted.' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    return res.status(500).json({ error: 'Failed to delete meeting.' });
  }
}

module.exports = { createMeeting, getMeetings, getMeetingById, deleteMeeting };
