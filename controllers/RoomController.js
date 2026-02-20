const { Room, MeetingHistory } = require('../models/RoomModel');
const User = require('../models/UserModel');

class RoomController {
  static async getRoomPage(req, res) {
    const roomId = req.params.id;
    const userName = req.session.displayName;
    
    res.render('room', {
      roomId,
      userName
    });
  }

  static async initializeRoom(roomId) {
    const { Room } = require('../models/RoomModel');
    
    try {
      const roomData = await Room.findOne({ roomId });
      if (roomData) {
        return {
          code: roomData.code || '',
          language: roomData.language || 'javascript'
        };
      } else {
        const newRoom = new Room({ roomId, code: '', language: 'javascript' });
        await newRoom.save();
        return { code: '', language: 'javascript' };
      }
    } catch (err) {
      console.error(err);
      return { code: '', language: 'javascript' };
    }
  }

  static async saveRoomData(roomId, code, language) {
    const { Room } = require('../models/RoomModel');
    
    try {
      await Room.updateOne(
        { roomId }, 
        { $set: { code, language } }, 
        { upsert: true }
      );
    } catch (err) {
      console.error(err);
    }
  }

  static async saveMeetingHistory(username, roomId, duration) {
    try {
      const user = await User.findOne({ $or: [{ name: username }, { username: username }] });
      if (user) {
        const durationMin = Math.floor(duration / 60000);
        const durationStr = durationMin > 0 ? `${durationMin} min` : '<1 min';
        const dateStr = new Date().toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const history = new MeetingHistory({
          username: user.username,
          roomId,
          date: dateStr,
          duration: durationStr
        });
        await history.save();
      }
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = RoomController;
