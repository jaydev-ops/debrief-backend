// src/controllers/notesController.js
//
// Handles everything related to Notes:
//   POST /notes                → create a note (auto-classifies it)
//   GET  /notes                → get all notes (with optional filters)
//   GET  /notes/meeting/:id    → get all notes for a specific meeting
//   DELETE /notes/:id          → delete a note

const prisma = require('../prisma');

const { createNoteService } = require('../services/noteService');

// ─── CREATE NOTE ───────────────────────────────────────────────────────────────
// This is the most important route. It:
//   1. Receives the note content from the frontend
//   2. Runs it through the classifier to determine the type
//   3. Saves it to the database
//
// Input (req.body): { content, meetingId }
// Output: the newly created note with its auto-assigned type

async function createNote(req, res) {
  try {
    const { content, title, meetingId, roomId } = req.body;

    // ── 1. Validation (DTO Layer) ─────────────────────────────────────────────
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'Note content cannot be empty.' });
    }

    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required.' });
    }

    const roomIdInt = parseInt(roomId);
    if (isNaN(roomIdInt)) {
      return res.status(400).json({ error: 'roomId must be a valid number.' });
    }

    let meetingIdInt = null;
    if (meetingId) {
      meetingIdInt = parseInt(meetingId);
      if (isNaN(meetingIdInt)) {
        return res.status(400).json({ error: 'meetingId must be a valid number if provided.' });
      }
    }

    // ── 2. Call Service Layer ──────────────────────────────────────────────────
    const result = await createNoteService({
      content,
      title,
      roomId: roomIdInt,
      meetingId: meetingIdInt,
      authorId: req.user.id
    });

    // ── 3. Return Response ─────────────────────────────────────────────────────
    return res.status(201).json({
      message: 'Note created and classified!',
      note: result.note,
      classification: result.classification,
    });
  } catch (error) {
    console.error('Create note error:', error);
    // Determine if it's a Prisma Foreign Key error for cleaner responses
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid roomId or meetingId provided.' });
    }
    return res.status(500).json({ error: 'Failed to create note. Please try again later.' });
  }
}

// ─── GET ALL NOTES ─────────────────────────────────────────────────────────────
// Returns notes with optional filters via query parameters.
//
// Query params (all optional):
//   ?type=decision     → filter by type
//   ?meetingId=3       → filter by meeting
//
// Examples:
//   GET /notes                       → all notes
//   GET /notes?type=action           → only action items
//   GET /notes?meetingId=2           → all notes in meeting 2
//   GET /notes?meetingId=2&type=problem → problems in meeting 2

async function getNotes(req, res) {
  try {
    const { type, meetingId } = req.query; // req.query reads URL parameters

    // Build the filter dynamically based on what was provided
    // `where` is an object — we only add keys if the filter was provided
    const where = {};

    if (type) {
      const validTypes = ['decision', 'action', 'problem', 'discussion'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
      }
      where.type = type;
    }

    if (meetingId) {
      where.meetingId = parseInt(meetingId);
    }

    if (req.query.roomId) {
      where.roomId = parseInt(req.query.roomId);
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        // Include basic info about the meeting this note belongs to
        meeting: {
          select: { id: true, title: true },
        },
        author: {
          select: { id: true, name: true }
        }
      },
    });

    return res.status(200).json({ notes, count: notes.length });
  } catch (error) {
    console.error('Get notes error:', error);
    return res.status(500).json({ error: 'Failed to fetch notes.' });
  }
}

// ─── GET NOTES BY MEETING ──────────────────────────────────────────────────────
// Shorthand for getting all notes in a specific meeting.
// Also groups them by type for easy display.

async function getNotesByMeeting(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID.' });
    }

    const notes = await prisma.note.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
    });

    // Group notes by type — this is a handy format for the frontend
    // Instead of a flat list, you get:
    // { decision: [...], action: [...], problem: [...], discussion: [...] }
    const grouped = notes.reduce((acc, note) => {
      if (!acc[note.type]) acc[note.type] = [];
      acc[note.type].push(note);
      return acc;
    }, {});

    // Summary counts
    const summary = {
      total: notes.length,
      decisions: (grouped.decision || []).length,
      actions: (grouped.action || []).length,
      problems: (grouped.problem || []).length,
      discussions: (grouped.discussion || []).length,
    };

    return res.status(200).json({ notes, grouped, summary });
  } catch (error) {
    console.error('Get notes by meeting error:', error);
    return res.status(500).json({ error: 'Failed to fetch notes.' });
  }
}

// ─── DELETE NOTE ───────────────────────────────────────────────────────────────

async function deleteNote(req, res) {
  try {
    const noteId = parseInt(req.params.id);

    const note = await prisma.note.findUnique({ where: { id: noteId } });

    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    // Only the author can delete their note
    if (note.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own notes.' });
    }

    await prisma.note.delete({ where: { id: noteId } });

    return res.status(200).json({ message: 'Note deleted.' });
  } catch (error) {
    console.error('Delete note error:', error);
    return res.status(500).json({ error: 'Failed to delete note.' });
  }
}

// ─── RECLASSIFY NOTE ───────────────────────────────────────────────────────────
// Lets the user manually override the auto-classification.
// Input (req.body): { type }

async function reclassifyNote(req, res) {
  try {
    const noteId = parseInt(req.params.id);
    const { type } = req.body;

    const validTypes = ['decision', 'action', 'problem', 'discussion'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const note = await prisma.note.update({
      where: { id: noteId },
      data: { type },
    });

    return res.status(200).json({ message: `Note reclassified as "${type}".`, note });
  } catch (error) {
    console.error('Reclassify error:', error);
    return res.status(500).json({ error: 'Failed to reclassify note.' });
  }
}

module.exports = { createNote, getNotes, getNotesByMeeting, deleteNote, reclassifyNote };
