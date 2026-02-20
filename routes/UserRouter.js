const express = require('express');
const UserController = require('../controllers/UserController');
const { Room } = require('../models/RoomModel');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session.userId) next();
  else res.redirect('/login');
}

router.get('/', (req, res) => {
  if (req.session.userId) res.redirect('/join');
  else res.redirect('/login');
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', UserController.login);

router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', UserController.register);

router.get('/join', requireAuth, UserController.getJoinPage);

router.post('/join', requireAuth, async (req, res) => {
  let { roomId } = req.body;
  const generateRoomId = () => Math.random().toString(36).substring(2, 8);
  
  if (!roomId || roomId.trim() === '') roomId = generateRoomId();
  roomId = roomId.trim();
  
  try {
    const existingRoom = await Room.findOne({ roomId });
    if (!existingRoom) {
      const newRoom = new Room({ roomId, code: '', language: 'javascript' });
      await newRoom.save();
    }
  } catch (err) {
    console.error(err);
  }
  
  res.redirect(`/room/${roomId}`);
});

router.get('/logout', UserController.logout);

module.exports = router;
