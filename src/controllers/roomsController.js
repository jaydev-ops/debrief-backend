const prisma = require('../prisma');

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function createRoom(req, res) {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const inviteCode = generateInviteCode();

    const room = await prisma.room.create({
      data: {
        name,
        description,
        inviteCode,
        createdById: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: 'admin',
          }
        }
      }
    });

    return res.status(201).json({
      room: {
        id: room.id,
        name: room.name,
        inviteCode: room.inviteCode,
        memberCount: 1
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
}

async function getRooms(req, res) {
  try {
    const memberships = await prisma.roomMember.findMany({
      where: { userId: req.user.id },
      include: {
        room: {
          include: {
            _count: { select: { members: true } },
            notes: { orderBy: { createdAt: 'desc' }, take: 1 },
            chatMessages: { orderBy: { createdAt: 'desc' }, take: 1 }
          }
        }
      }
    });

    const rooms = memberships.map(m => ({
      ...m.room,
      memberCount: m.room._count.members,
      lastNoteCreatedAt: m.room.notes[0]?.createdAt || null,
      lastChatMessageText: m.room.chatMessages[0]?.text || null
    }));

    return res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
}

async function getRoomById(req, res) {
  try {
    const roomId = parseInt(req.params.id);
    if (isNaN(roomId)) return res.status(400).json({ error: 'Invalid room id' });

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true } } }
        },
        notes: { orderBy: { createdAt: 'desc' } },
        chatMessages: { orderBy: { createdAt: 'desc' }, take: 50, include: { sender: { select: { id: true, name: true } } } }
      }
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isMember = room.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    return res.json({
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        inviteCode: room.inviteCode
      },
      members: room.members.map(m => ({ id: m.user.id, name: m.user.name, role: m.role })),
      notes: room.notes,
      recentMessages: room.chatMessages.reverse()
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
}

async function joinRoom(req, res) {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Invite code required' });

    const room = await prisma.room.findUnique({
      where: { inviteCode }
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const existingMember = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: req.user.id, roomId: room.id } }
    });

    if (existingMember) {
      return res.json({ room, role: existingMember.role });
    }

    const newMember = await prisma.roomMember.create({
      data: {
        userId: req.user.id,
        roomId: room.id,
        role: 'member'
      }
    });

    return res.json({ room, role: newMember.role });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
}

async function inviteToRoom(req, res) {
  try {
    const roomId = parseInt(req.params.id);
    const { email } = req.body;

    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: req.user.id, roomId } }
    });

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Must be admin to invite' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.roomMember.upsert({
      where: { userId_roomId: { userId: user.id, roomId } },
      update: {},
      create: { userId: user.id, roomId, role: 'member' }
    });

    return res.json({ message: 'User invited successfully' });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
}

async function deleteRoom(req, res) {
  try {
    const roomId = parseInt(req.params.id);
    
    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: req.user.id, roomId } }
    });

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Must be admin to delete room' });
    }

    await prisma.room.delete({
      where: { id: roomId }
    });

    return res.json({ message: 'Room deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
}

async function leaveRoom(req, res) {
  try {
    const roomId = parseInt(req.params.id);
    const userId = req.user.id;

    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
      include: { room: { include: { members: { orderBy: { joinedAt: 'asc' } } } } }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Not a member of this room' });
    }

    const room = membership.room;
    const remainingMembers = room.members.filter(m => m.userId !== userId);

    if (remainingMembers.length === 0) {
      // If last member leaves, delete the room
      await prisma.room.delete({ where: { id: roomId } });
    } else {
      if (membership.role === 'admin') {
        const otherAdmins = remainingMembers.filter(m => m.role === 'admin');
        if (otherAdmins.length === 0) {
          // Promote oldest member
          await prisma.roomMember.update({
            where: { id: remainingMembers[0].id },
            data: { role: 'admin' }
          });
        }
      }
      // Remove the user's membership
      await prisma.roomMember.delete({ where: { id: membership.id } });
    }

    return res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
}

module.exports = { createRoom, getRooms, getRoomById, joinRoom, inviteToRoom, deleteRoom, leaveRoom };
