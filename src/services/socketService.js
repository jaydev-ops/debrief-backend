const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

let io;

function initSocket(server) {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://debrief-saas.vercel.app'
  ];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.includes(origin) || 
                          origin.endsWith('.vercel.app') || 
                          origin === process.env.FRONTEND_URL;
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: Token missing'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected to socket: ${socket.user.id}`);

    socket.on('room:join', (roomId) => {
      socket.join(`room-${roomId}`);
      console.log(`User ${socket.user.id} joined room-${roomId}`);
    });

    socket.on('room:leave', (roomId) => {
      socket.leave(`room-${roomId}`);
      console.log(`User ${socket.user.id} left room-${roomId}`);
    });

    socket.on('chat:send', async (data) => {
      try {
        const { text, roomId, meetingId } = data;
        
        const message = await prisma.chatMessage.create({
          data: {
            text,
            roomId,
            meetingId: meetingId || 1, // Default to 1 if no meeting provided yet
            senderId: socket.user.id
          },
          include: {
            sender: { select: { id: true, name: true } }
          }
        });

        // Broadcast to the room if specified, otherwise global (for simple MVP testing)
        if (roomId) {
          io.to(`room-${roomId}`).emit('chat:message', message);
        } else {
          io.emit('chat:message', message);
        }
      } catch (err) {
        console.error('Socket chat error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });
}

function broadcastNoteToRoom(roomId, note) {
  if (io && roomId) {
    io.to(`room-${roomId}`).emit('note:new', note);
  }
}

function broadcastMessageDeletedToRoom(roomId, messageId) {
  if (io && roomId) {
    io.to(`room-${roomId}`).emit('chat:deleted', messageId);
  }
}

module.exports = { initSocket, broadcastNoteToRoom, broadcastMessageDeletedToRoom };
