const express = require('express');
const { requireAuth } = require('../middleware/auth');
const roomsController = require('../controllers/roomsController');

const router = express.Router();

// All room routes require authentication
router.use(requireAuth);

router.post('/', roomsController.createRoom);
router.get('/', roomsController.getRooms);
router.get('/:id', roomsController.getRoomById);
router.post('/join', roomsController.joinRoom);
router.post('/:id/invite', roomsController.inviteToRoom);
router.delete('/:id/leave', roomsController.leaveRoom);
router.delete('/:id', roomsController.deleteRoom);

module.exports = router;
