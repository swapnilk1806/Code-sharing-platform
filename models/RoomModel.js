const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  code: { type: String, default: '' },
  language: { type: String, default: 'javascript' }
});

const Room = mongoose.model('Room', roomSchema);

const meetingHistorySchema = new mongoose.Schema({
  username: { type: String, required: true },
  roomId: { type: String, required: true },
  date: { type: String, required: true },
  duration: { type: String, required: true }
});

const MeetingHistory = mongoose.model('MeetingHistory', meetingHistorySchema);

module.exports = { Room, MeetingHistory };
