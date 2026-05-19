const prisma = require('../prisma');
const { classifyNoteWithDetails } = require('./classifyNote');
const { broadcastNoteToRoom } = require('./socketService');

/**
 * Service to handle the business logic of creating a note.
 * Generates an automatic title, classifies the content, and broadcasts via sockets.
 * 
 * @param {Object} data 
 * @param {string} data.content - Raw note text
 * @param {string} [data.title] - Optional explicit title
 * @param {number} [data.roomId] - Associated workspace/room ID
 * @param {number} [data.meetingId] - Associated meeting ID (legacy/optional)
 * @param {number} data.authorId - ID of the user creating the note
 * @returns {Promise<{note: Object, classification: Object}>}
 */
async function createNoteService(data) {
  const { content, title, roomId, meetingId, authorId } = data;

  // 1. Classify the note using AI rules
  const { type, matches } = classifyNoteWithDetails(content);
  
  // 2. Generate a title if missing
  let finalTitle = title;
  if (!finalTitle) {
    const words = content.split(' ');
    finalTitle = words.slice(0, 5).join(' ');
    if (words.length > 5) finalTitle += '...';
  }

  // 3. Persist to Database
  const note = await prisma.note.create({
    data: {
      content: content.trim(),
      title: finalTitle,
      type,
      roomId: roomId || null,
      meetingId: meetingId || null,
      authorId,
    },
    include: {
      author: {
        select: { id: true, name: true }
      }
    }
  });

  // 4. Broadcast via WebSockets
  if (roomId) {
    broadcastNoteToRoom(roomId, note);
  }

  // 5. Return structured result
  return {
    note,
    classification: {
      type,
      matchedKeywords: matches
    }
  };
}

module.exports = {
  createNoteService
};
