const User = require('../models/UserModel');
const { MeetingHistory } = require('../models/RoomModel');

class UserController {
  static async login(req, res) {
    const { username, password } = req.body;
    try {
      const user = await User.findOne({ username });
      if (user && user.password === password) {
        req.session.userId = user.username;
        req.session.username = user.username;
        req.session.displayName = user.name || user.username;
        res.redirect('/join');
      } else {
        res.render('error', {
          message: 'Invalid username or password',
          link: '/login',
          linkText: '← Try again'
        });
      }
    } catch (err) {
      console.error(err);
      res.redirect('/login');
    }
  }

  static async register(req, res) {
    const { username, password, name } = req.body;
    try {
      const existing = await User.findOne({ username });
      if (existing) {
        res.render('error', {
          message: 'Username already exists',
          link: '/register',
          linkText: '← Try again'
        });
      } else {
        const newUser = new User({ username, password, name: name || username });
        await newUser.save();
        req.session.userId = username;
        req.session.username = username;
        req.session.displayName = name || username;
        res.redirect('/join');
      }
    } catch (err) {
      console.error(err);
      res.redirect('/register');
    }
  }

  static async getJoinPage(req, res) {
    const username = req.session.username;
    const user = await User.findOne({ username });
    const displayName = user?.name || username;

    const historyRows = await MeetingHistory.find({ username }).sort({ _id: -1 }).limit(10);
    const historyHtml = historyRows.map(entry => `
      <div style="background:rgba(48,76,110,0.3); padding:1rem; border-radius:16px; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; backdrop-filter:blur(4px);">
        <span style="color:#b3d9ff; font-weight:500;">🆔 ${entry.roomId}</span>
        <span style="color:#aac7e0; font-size:0.9rem;">${entry.date}</span>
        <span style="background:#1f3a5a; padding:6px 16px; border-radius:40px; font-size:0.85rem; color:#e0f0ff;">${entry.duration}</span>
      </div>
    `).join('');

    res.render('join', {
      displayName: displayName,
      username: username,
      history: historyRows
    });
  }

  static logout(req, res) {
    req.session.destroy();
    res.redirect('/login');
  }
}

module.exports = UserController;
