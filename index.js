require('dotenv').config();

const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
// ---------- Official Google GenAI SDK ----------
const { GoogleGenAI } = require('@google/genai');

// ---------- Redis & Kafka Imports ----------
const Redis = require('ioredis');
const RedisStore = require('connect-redis')(session);
const { createAdapter } = require('@socket.io/redis-adapter');
const { Kafka } = require('kafkajs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ---------- Environment Variables ----------
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codemeet';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_ENABLED = process.env.KAFKA_ENABLED === 'true';

// ---------- Check for Gemini API key ----------
if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set. AI analysis will not work.');
} else {
  console.log('✅ GEMINI_API_KEY loaded');
}

// ---------- Redis Clients with Error Handlers ----------
const redisClient = new Redis(REDIS_URL);
redisClient.on('error', (err) => {
  console.error('❌ Redis client error (sessions):', err.message);
});

const pubClient = new Redis(REDIS_URL);
pubClient.on('error', (err) => {
  console.error('❌ Redis pubClient error (Socket.IO):', err.message);
});

const subClient = pubClient.duplicate();
subClient.on('error', (err) => {
  console.error('❌ Redis subClient error (Socket.IO):', err.message);
});

// ---------- Kafka Setup (optional) ----------
let producer;
if (KAFKA_ENABLED) {
  const kafka = new Kafka({
    clientId: 'codemeet-app',
    brokers: KAFKA_BROKERS
  });
  producer = kafka.producer();

  (async () => {
    try {
      await producer.connect();
      console.log('✅ Kafka producer connected');
    } catch (err) {
      console.error('❌ Kafka connection error:', err);
    }
  })();
}

async function emitKafkaEvent(topic, eventType, data) {
  if (!KAFKA_ENABLED || !producer) return;
  try {
    await producer.send({
      topic,
      messages: [
        {
          key: data.roomId || 'general',
          value: JSON.stringify({
            eventType,
            timestamp: new Date().toISOString(),
            ...data
          })
        }
      ]
    });
  } catch (err) {
    console.error('Kafka produce error:', err);
  }
}

// ---------- MongoDB Connection ----------
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// ---------- Schemas ----------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

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

// ---------- In-memory active rooms ----------
const rooms = {};

const generateRoomId = () => Math.random().toString(36).substring(2, 8);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- Session Store with Redis ----------
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.JWT_SECRET || 'code-meet-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

io.adapter(createAdapter(pubClient, subClient));

function requireAuth(req, res, next) {
  if (req.session.userId) next();
  else res.redirect('/login');
}

// ---------- AUTH ROUTES ----------
app.get('/', (req, res) => {
  if (req.session.userId) res.redirect('/join');
  else res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login · CodeMeet</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
      body { min-height:100vh; background:radial-gradient(circle at 10% 30%, #1a2639, #0b0e14); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
      .glass-card { background:rgba(20,25,35,0.75); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.15); border-radius:32px; padding:2.5rem; width:100%; max-width:400px; color:#f0f3fa; }
      h1 { font-size:2.2rem; margin-bottom:0.5rem; background:linear-gradient(145deg,#b1c3df,#e0e7ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
      .sub { color:#a1b2cd; margin-bottom:2rem; }
      input { width:100%; padding:0.9rem 1.2rem; background:rgba(10,15,25,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:18px; font-size:1rem; color:white; outline:none; margin-bottom:1.2rem; }
      input:focus { border-color:#5f9ef0; }
      button { width:100%; padding:0.9rem; background:linear-gradient(145deg,#2f4b9e,#1f3a7a); border:none; border-radius:24px; color:white; font-weight:600; font-size:1.1rem; cursor:pointer; border:1px solid rgba(255,255,255,0.2); box-shadow:0 8px 0 #0e1a2f; }
      button:hover { transform:translateY(-2px); box-shadow:0 10px 0 #0e1a2f; }
      .link { margin-top:1.5rem; text-align:center; }
      .link a { color:#aac7e0; text-decoration:none; }
      .error { color:#ffa5a5; margin-bottom:1rem; }
    </style>
  </head>
  <body>
    <div class="glass-card">
      <h1>CodeMeet</h1>
      <div class="sub">sign in to continue</div>
      <form method="POST" action="/login">
        <input type="text" name="username" placeholder="Username" required autofocus>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">🔐 Login</button>
      </form>
      <div class="link">No account? <a href="/register">Register</a></div>
    </div>
  </body>
  </html>`);
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      req.session.userId = user.username;
      req.session.username = user.username;
      req.session.displayName = user.name || user.username;
      res.redirect('/join');
    } else {
      res.send(`<!DOCTYPE html><html><head><style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        body { min-height:100vh; background:radial-gradient(circle at 10% 30%, #1a2639, #0b0e14); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
        .glass-card { background:rgba(20,25,35,0.75); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.15); border-radius:32px; padding:2.5rem; width:100%; max-width:400px; color:#f0f3fa; }
        .error { color:#ffa5a5; margin-bottom:1rem; }
        a { color:#aac7e0; text-decoration:none; }
      </style></head>
      <body><div class="glass-card"><h1>CodeMeet</h1><div class="error">Invalid username or password</div>
      <a href="/login">← Try again</a></div></body></html>`);
    }
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// ---------- REGISTER PAGE ----------
app.get('/register', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register · CodeMeet</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
      body { min-height:100vh; background:radial-gradient(circle at 10% 30%, #1a2639, #0b0e14); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
      .glass-card { background:rgba(20,25,35,0.75); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.15); border-radius:32px; padding:2.5rem; width:100%; max-width:400px; color:#f0f3fa; }
      h1 { font-size:2.2rem; margin-bottom:0.5rem; background:linear-gradient(145deg,#b1c3df,#e0e7ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
      .sub { color:#a1b2cd; margin-bottom:2rem; }
      input { width:100%; padding:0.9rem 1.2rem; background:rgba(10,15,25,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:18px; font-size:1rem; color:white; outline:none; margin-bottom:1.2rem; }
      input:focus { border-color:#5f9ef0; }
      button { width:100%; padding:0.9rem; background:linear-gradient(145deg,#2f4b9e,#1f3a7a); border:none; border-radius:24px; color:white; font-weight:600; font-size:1.1rem; cursor:pointer; border:1px solid rgba(255,255,255,0.2); box-shadow:0 8px 0 #0e1a2f; }
      button:hover { transform:translateY(-2px); box-shadow:0 10px 0 #0e1a2f; }
      .link { margin-top:1.5rem; text-align:center; }
      .link a { color:#aac7e0; text-decoration:none; }
      .error { color:#ffa5a5; margin-bottom:1rem; }
    </style>
  </head>
  <body>
    <div class="glass-card">
      <h1>CodeMeet</h1>
      <div class="sub">create new account</div>
      <form method="POST" action="/register">
        <input type="text" name="username" placeholder="Username" required autofocus>
        <input type="password" name="password" placeholder="Password" required>
        <input type="text" name="name" placeholder="Display name (optional)">
        <button type="submit">📝 Register</button>
      </form>
      <div class="link">Already have an account? <a href="/login">Login</a></div>
    </div>
  </body>
  </html>`);
});

app.post('/register', async (req, res) => {
  const { username, password, name } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) {
      res.send(`<!DOCTYPE html><html><head><style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        body { min-height:100vh; background:radial-gradient(circle at 10% 30%, #1a2639, #0b0e14); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
        .glass-card { background:rgba(20,25,35,0.75); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.15); border-radius:32px; padding:2.5rem; width:100%; max-width:400px; color:#f0f3fa; }
        .error { color:#ffa5a5; margin-bottom:1rem; }
        a { color:#aac7e0; text-decoration:none; }
      </style></head>
      <body><div class="glass-card"><h1>CodeMeet</h1><div class="error">Username already exists</div>
      <a href="/register">← Try again</a></div></body></html>`);
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
});

// ---------- JOIN/CREATE PAGE ----------
app.get('/join', requireAuth, async (req, res) => {
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

  res.send(`<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join / Create · CodeMeet</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
      body {
        background: radial-gradient(circle at 20% 30%, #0e1419, #030507);
        color: #edf2fb;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .navbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 2.5rem;
        background: rgba(8, 20, 30, 0.7);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #2a4c6e;
      }
      .logo {
        font-size: 1.8rem;
        font-weight: 700;
        background: linear-gradient(145deg, #b1c3df, #e0e7ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .user-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #1f3345;
        padding: 0.6rem 1.5rem;
        border-radius: 40px;
        border: 1px solid #4f7a9e;
      }
      .avatar {
        background: #2f4b9e;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 1.2rem;
      }
      .logout-btn {
        background: #3a3f5e;
        border: 1px solid #7f8fb2;
        padding: 0.6rem 1.5rem;
        border-radius: 40px;
        color: white;
        text-decoration: none;
        font-weight: 500;
        transition: 0.2s;
      }
      .logout-btn:hover {
        background: #4f5580;
      }
      .main {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        padding: 2.5rem;
        max-width: 1400px;
        margin: 0 auto;
        width: 100%;
      }
      .panel {
        background: rgba(12, 25, 40, 0.65);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(80, 140, 200, 0.3);
        border-radius: 32px;
        padding: 2.2rem;
        box-shadow: 0 20px 40px -10px black;
      }
      .panel h2 {
        font-size: 2rem;
        margin-bottom: 1rem;
        font-weight: 600;
        color: #d6e6ff;
      }
      .panel p {
        color: #aac3d0;
        margin-bottom: 2rem;
        font-size: 1.1rem;
      }
      .form-group {
        margin-bottom: 1.8rem;
      }
      .form-group label {
        display: block;
        margin-bottom: 0.6rem;
        color: #c6d9f0;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 0.8rem;
      }
      .form-group input {
        width: 100%;
        padding: 1rem 1.5rem;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid #3a6990;
        border-radius: 50px;
        font-size: 1rem;
        color: white;
        outline: none;
        transition: 0.2s;
      }
      .form-group input:focus {
        border-color: #80b5ff;
        background: rgba(20, 40, 70, 0.6);
      }
      .btn-primary {
        background: linear-gradient(145deg, #2f4b9e, #1f3a7a);
        border: none;
        border-radius: 50px;
        padding: 1rem 2rem;
        font-size: 1.2rem;
        font-weight: 600;
        color: white;
        width: 100%;
        cursor: pointer;
        box-shadow: 0 10px 0 #0e1a2f;
        transition: 0.1s;
        border: 1px solid rgba(255,255,255,0.2);
      }
      .btn-primary:hover {
        transform: translateY(-3px);
        box-shadow: 0 13px 0 #0e1a2f;
      }
      .history-list {
        max-height: 400px;
        overflow-y: auto;
        padding-right: 0.5rem;
      }
      .history-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.3rem;
        margin-bottom: 1.5rem;
        color: #c3dbff;
      }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-thumb { background: #3e6a8a; border-radius: 10px; }
      @media (max-width: 900px) {
        .main { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="navbar">
      <span class="logo">CodeMeet</span>
      <div style="display:flex; align-items:center; gap:1.5rem;">
        <div class="user-badge">
          <div class="avatar">${displayName.charAt(0).toUpperCase()}</div>
          <span><strong>${displayName}</strong> <span style="color:#aac7e0;">@${username}</span></span>
        </div>
        <a href="/logout" class="logout-btn">Logout</a>
      </div>
    </div>

    <div class="main">
      <div class="panel">
        <h2>🚀 Join or create</h2>
        <p>Start a new session instantly – share the room ID with your team.</p>
        <form action="/join" method="POST">
          <div class="form-group">
            <label>Room ID (optional)</label>
            <input type="text" name="roomId" placeholder="e.g. a1b2c3 – leave empty to create new">
          </div>
          <button type="submit" class="btn-primary">▶ Continue</button>
        </form>
        <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid #2a4a6a;">
          <span style="color:#aac7e0;">✨ Your new room will be automatically generated.</span>
        </div>
      </div>

      <div class="panel">
        <div class="history-title">
          <span>📋 Meeting history</span>
          <span style="font-size:0.9rem; background:#1a2c3c; padding:4px 14px; border-radius:30px;">last 10</span>
        </div>
        <div class="history-list">
          ${historyHtml || '<div style="color:#aac7e0; text-align:center; padding:2rem;">✨ No meetings yet. Create one to get started!</div>'}
        </div>
      </div>
    </div>
  </body>
  </html>`);
});

app.post('/join', requireAuth, async (req, res) => {
  let { roomId } = req.body;
  if (!roomId || roomId.trim() === '') roomId = generateRoomId();
  roomId = roomId.trim();
  if (!rooms[roomId]) {
    rooms[roomId] = { 
      id: roomId, 
      code: '', 
      language: 'javascript', 
      participants: {},
      priorityUser: null
    };
    try {
      const existingRoom = await Room.findOne({ roomId });
      if (!existingRoom) {
        const newRoom = new Room({ roomId, code: '', language: 'javascript' });
        await newRoom.save();
      }
    } catch (err) {
      console.error(err);
    }
  }
  res.redirect(`/room/${roomId}`);
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ---------- ROOM PAGE (with AI analysis white box) ----------
app.get('/room/:id', requireAuth, async (req, res) => {
  const roomId = req.params.id;
  const userName = req.session.displayName;
  if (!rooms[roomId]) {
    rooms[roomId] = { 
      id: roomId, 
      code: '', 
      language: 'javascript', 
      participants: {},
      priorityUser: null
    };
    try {
      const roomData = await Room.findOne({ roomId });
      if (roomData) {
        rooms[roomId].code = roomData.code || '';
        rooms[roomId].language = roomData.language || 'javascript';
      } else {
        const newRoom = new Room({ roomId, code: '', language: 'javascript' });
        await newRoom.save();
      }
    } catch (err) {
      console.error(err);
    }
  }

  const html = `<!DOCTYPE html>
  <html>
  <head><title>Room ${roomId} · CodeMeet</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/dracula.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/python/python.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/clike/clike.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/htmlmixed/htmlmixed.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/xml/xml.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/css/css.min.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
    body { background:radial-gradient(circle at 20% 30%, #1b212e, #0c0f15); min-height:100vh; padding:16px; color:#edf2fb; }
    .dashboard { display:grid; grid-template-columns:80% 20%; gap:16px; height:calc(100vh - 32px); }
    .editor-panel { background:rgba(18,25,40,0.65); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.08); border-radius:28px; padding:20px; display:flex; flex-direction:column; box-shadow:0 20px 35px -8px black; }
    .editor-container { flex:1; border-radius:16px; overflow:hidden; border:1px solid #2e3a55; }
    .CodeMirror { height:100%; font-size:14px; }
    .run-area { margin-top:16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    .run-btn, .ai-btn { background:#1e3b5c; border:1px solid #4080c0; padding:10px 20px; border-radius:40px; font-weight:600; color:white; cursor:pointer; backdrop-filter:blur(4px); }
    .ai-btn { background:#2a4f5a; border-color:#5fa5b5; }
    .timer { background:#0e1a2a; border:1px solid #5f7f9f; padding:10px 20px; border-radius:40px; font-weight:600; color:#c3e0ff; display:flex; align-items:center; gap:8px; }
    .output-frame { background:#0f1117; border-radius:16px; flex:1; border:1px solid #3a4a62; }
    iframe { width:100%; height:180px; border:none; border-radius:12px; background:white; }
    /* White box for AI analysis output */
    .ai-output-box {
      background: white;
      color: black;
      border-radius: 12px;
      padding: 16px;
      margin-top: 12px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 200px;
      overflow-y: auto;
      border: 2px solid #5fa5b5;
      display: none; /* hidden by default */
    }
    .right-panel { background:rgba(12,20,30,0.7); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.1); border-radius:28px; padding:20px 16px; display:flex; flex-direction:column; gap:20px; overflow-y:auto; }
    .room-header { background:rgba(16,30,50,0.8); border-radius:18px; padding:12px 16px; border-left:6px solid #5f9ef0; margin-bottom:8px; }
    .room-header span { font-size:0.9rem; color:#c0d4ff; display:flex; align-items:center; gap:8px; }
    .room-header strong { background:#1f3a5a; padding:4px 12px; border-radius:30px; font-family:monospace; font-size:1rem; color:white; }
    .leave-btn { background:#3a3f5e; border:1px solid #7f8fb2; padding:6px 16px; border-radius:30px; color:white; font-size:0.8rem; text-decoration:none; margin-left:10px; }
    .self-camera { background:#0f1a24; border-radius:20px; padding:12px; border:1px solid #3d5975; backdrop-filter:blur(4px); }
    .self-video { width:100%; border-radius:14px; background:#0a0e14; transform:scaleX(-1); max-height:140px; object-fit:cover; }
    .cam-controls { display:flex; justify-content:center; gap:16px; margin-top:10px; }
    .cam-btn { background:#1e2a3a; border:none; padding:8px 16px; border-radius:30px; color:white; font-size:0.8rem; font-weight:600; cursor:pointer; border:1px solid #4f6f8f; }
    .cam-btn.off { background:#4a2f3a; border-color:#b55a5a; }
    .cam-btn.priority-active { background: gold; color: black; border-color: darkgoldenrod; }
    /* Remote videos */
    .remote-videos {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      background: rgba(0,0,0,0.2);
      border-radius: 16px;
      padding: 12px;
      max-height: 300px;
      overflow-y: auto;
    }
    .remote-video-container {
      position: relative;
      width: 120px;
      height: 90px;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid transparent;
      transition: all 0.2s;
      background: #111;
    }
    .remote-video-container.priority {
      width: 240px;
      height: 180px;
      border-color: gold;
      order: -1;
    }
    .remote-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .video-label {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.6);
      color: white;
      font-size: 10px;
      padding: 2px 4px;
      text-align: center;
    }
    /* Language selector */
    .lang-select {
      background: #1e3b5c;
      border: 1px solid #4080c0;
      padding: 8px 16px;
      border-radius: 40px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      margin-left: auto;
    }
    .lang-select option {
      background: #1e3b5c;
      color: white;
    }
    /* Chat and files */
    .chat-section, .files-section { background:rgba(8,16,26,0.5); border-radius:20px; padding:16px; border:1px solid #2a4055; }
    .section-title { font-size:0.8rem; text-transform:uppercase; color:#aac3e0; margin-bottom:12px; letter-spacing:1.5px; }
    .messages { max-height:200px; overflow-y:auto; margin-bottom:12px; display:flex; flex-direction:column; gap:8px; }
    .msg { background:rgba(48,76,110,0.4); padding:8px 12px; border-radius:18px; font-size:0.85rem; word-break:break-word; color:#edf2fb; }
    .msg strong { color:#b3d9ff; }
    .chat-input { display:flex; gap:8px; }
    .chat-input input { flex:1; background:#101c28; border:1px solid #365874; border-radius:30px; padding:10px 16px; color:white; outline:none; }
    .chat-input button { background:#2f515e; border:none; border-radius:30px; padding:10px 16px; color:white; font-weight:bold; cursor:pointer; }
    .file-list { max-height:130px; overflow-y:auto; font-size:0.8rem; }
    .file-item { background:#142433; padding:8px 12px; border-radius:12px; margin-bottom:6px; border-left:4px solid #3f98c9; }
    .file-item a { color:#bbdbff; text-decoration:none; font-weight:500; }
    .upload-btn { background:#1e364a; color:white; padding:8px 12px; border-radius:24px; font-size:0.8rem; border:1px dashed #6f9fcf; cursor:pointer; display:inline-block; margin-top:8px; }
    .error-message { color:#ffb3b3; background:#4a1e2c; padding:8px; border-radius:12px; font-size:0.8rem; margin-top:8px; }
    ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-thumb { background:#3e5a77; border-radius:10px; }
  </style>
  </head>
  <body><div class="dashboard">
    <div class="editor-panel">
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <select id="languageSelect" class="lang-select">
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="text">Plain Text</option>
        </select>
      </div>
      <div class="editor-container"><textarea id="code-editor"></textarea></div>
      <div class="run-area">
        <button class="run-btn" id="runCode">▶ Run</button>
        <button class="ai-btn" id="aiAnalyze">🤖 AI Analyze</button>
        <div class="timer" id="timerDisplay">⏱️ 00:00</div>
        <div class="output-frame">
          <iframe id="preview" sandbox="allow-scripts allow-same-origin allow-forms" title="output"></iframe>
          <!-- AI output white box (part of output area) -->
          <div id="aiOutput" class="ai-output-box"></div>
        </div>
      </div>
    </div>
    <div class="right-panel">
      <div class="room-header"><span>🆔 You are in room: <strong>${roomId}</strong> <a href="/join" class="leave-btn" id="leaveBtn">Leave</a></span></div>
      <div class="self-camera">
        <video id="selfVideo" autoplay muted playsinline class="self-video"></video>
        <div class="cam-controls">
          <button id="micToggle" class="cam-btn">🎤 Mic on</button>
          <button id="camToggle" class="cam-btn">📹 Cam on</button>
          <button id="priorityBtn" class="cam-btn">⭐ Priority</button>
        </div>
        <div id="cameraError" class="error-message" style="display:none;"></div>
      </div>
      <div class="remote-videos" id="remoteVideos"></div>
      <div class="chat-section">
        <div class="section-title">💬 Chat</div>
        <div id="chatMessages" class="messages"></div>
        <div class="chat-input"><input type="text" id="chatInput" placeholder="Message..."><button id="sendChat">Send</button></div>
      </div>
      <div class="files-section">
        <div class="section-title">📁 Shared documents</div>
        <div id="fileList" class="file-list"></div>
        <input type="file" id="fileUpload" style="display:none;">
        <button class="upload-btn" id="uploadTrigger">+ Upload file</button>
      </div>
    </div>
  </div>
  <script>
    (function(){
      const roomId = '${roomId}';
      const userName = '${userName}';
      const socket = io();

      // ---------- Code Editor ----------
      const editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        lineNumbers: true, theme: 'dracula', mode: 'javascript', indentUnit: 2,
        autoCloseTags: true, autoCloseBrackets: true, lineWrapping: true
      });
      let ignoreCodeChange = false;
      editor.on('change', () => { if (!ignoreCodeChange) socket.emit('code-change', { roomId, code: editor.getValue() }); });

      // Language selector
      const langSelect = document.getElementById('languageSelect');
      langSelect.addEventListener('change', () => {
        const lang = langSelect.value;
        socket.emit('language-change', { roomId, language: lang });
      });

      function setEditorLanguage(lang) {
        let mode = 'javascript';
        if (lang === 'python') mode = 'python';
        else if (lang === 'cpp') mode = 'text/x-c++src';
        else if (lang === 'java') mode = 'text/x-java';
        else if (lang === 'text') mode = null; // plain text
        editor.setOption('mode', mode);
      }

      // ---------- Socket Events ----------
      socket.emit('join-room', { roomId, userName });
      socket.on('init-code', (code) => { ignoreCodeChange = true; editor.setValue(code || ''); ignoreCodeChange = false; });
      socket.on('init-language', (lang) => { 
        langSelect.value = lang; 
        setEditorLanguage(lang);
      });
      socket.on('code-change', (code) => { if (code !== editor.getValue()) { ignoreCodeChange = true; editor.setValue(code); ignoreCodeChange = false; } });
      socket.on('language-change', (lang) => {
        langSelect.value = lang;
        setEditorLanguage(lang);
      });

      // ---------- Timer ----------
      const startTime = Date.now();
      const timerDisplay = document.getElementById('timerDisplay');
      function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timerDisplay.textContent = \`⏱️ \${mins.toString().padStart(2,'0')}:\${secs.toString().padStart(2,'0')}\`;
      }
      updateTimer();
      setInterval(updateTimer, 1000);

      // ---------- Leave ----------
      document.getElementById('leaveBtn').addEventListener('click', (e) => {
        e.preventDefault();
        socket.emit('leave-room', { roomId, userName });
        window.location.href = '/join';
      });

      // ---------- Camera & Mic ----------
      let localStream;
      let micEnabled = true, camEnabled = true;
      const video = document.getElementById('selfVideo');
      const cameraErrorDiv = document.getElementById('cameraError');
      function startMedia() {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => { localStream = stream; video.srcObject = stream; video.onloadedmetadata = () => video.play(); cameraErrorDiv.style.display = 'none'; })
          .catch(err => { console.warn(err); cameraErrorDiv.style.display = 'block'; cameraErrorDiv.textContent = '⚠️ Camera/mic access denied.'; });
      }
      startMedia();

      document.getElementById('micToggle').addEventListener('click', () => { if(localStream) { localStream.getAudioTracks().forEach(t=>t.enabled=!t.enabled); micEnabled=!micEnabled; const btn=document.getElementById('micToggle'); btn.textContent=micEnabled?'🎤 Mic on':'🔇 Mic off'; btn.classList.toggle('off',!micEnabled); } });
      document.getElementById('camToggle').addEventListener('click', () => { if(localStream) { localStream.getVideoTracks().forEach(t=>t.enabled=!t.enabled); camEnabled=!camEnabled; const btn=document.getElementById('camToggle'); btn.textContent=camEnabled?'📹 Cam on':'🚫 Cam off'; btn.classList.toggle('off',!camEnabled); } });

      // ---------- Priority Button ----------
      const priorityBtn = document.getElementById('priorityBtn');
      let amIPriority = false;

      priorityBtn.addEventListener('click', () => {
        socket.emit('priority-user', { roomId });
      });

      socket.on('priority-user', ({ socketId, userName }) => {
        document.querySelectorAll('.remote-video-container').forEach(el => el.classList.remove('priority'));
        const priorityEl = document.getElementById(\`remote-\${socketId}\`);
        if (priorityEl) priorityEl.classList.add('priority');

        if (socketId === socket.id) {
          amIPriority = true;
          priorityBtn.classList.add('priority-active');
        } else {
          if (amIPriority) {
            amIPriority = false;
            priorityBtn.classList.remove('priority-active');
          }
        }
      });

      socket.on('priority-cleared', () => {
        document.querySelectorAll('.remote-video-container').forEach(el => el.classList.remove('priority'));
        if (amIPriority) {
          amIPriority = false;
          priorityBtn.classList.remove('priority-active');
        }
      });

      // ---------- Chat ----------
      const chatMessages = document.getElementById('chatMessages');
      function escapeHTML(s) { return String(s).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[m]); }
      function addChatMessage(username, text) {
        const d = document.createElement('div');
        d.className = 'msg';
        d.innerHTML = '<strong>' + escapeHTML(username) + '</strong> ' + escapeHTML(text);
        chatMessages.appendChild(d);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
      document.getElementById('sendChat').addEventListener('click', () => {
        const i = document.getElementById('chatInput'); const m = i.value.trim(); if(m) { socket.emit('chat', { roomId, userName, message: m }); i.value = ''; }
      });
      document.getElementById('chatInput').addEventListener('keypress', e => { if(e.key==='Enter') document.getElementById('sendChat').click(); });
      socket.on('chat', ({ userName, message }) => addChatMessage(userName, message));

      // ---------- File Sharing ----------
      const fileListDiv = document.getElementById('fileList');
      document.getElementById('uploadTrigger').addEventListener('click', () => document.getElementById('fileUpload').click());
      document.getElementById('fileUpload').addEventListener('change', function(e) {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = ev => socket.emit('file-share', { roomId, userName, fileName: file.name, fileData: ev.target.result });
        reader.readAsDataURL(file); this.value = '';
      });
      socket.on('file-share', ({ userName, fileName, fileData }) => {
        const item = document.createElement('div'); item.className = 'file-item';
        item.innerHTML = \`<span style="color:#9ac7ff;">\${escapeHTML(userName)}</span> shared <a href="\${fileData}" download="\${fileName}">📎 \${escapeHTML(fileName)}</a>\`;
        fileListDiv.appendChild(item); fileListDiv.scrollTop = fileListDiv.scrollHeight;
      });

      // ---------- AI Analysis (white box) ----------
      const aiOutputDiv = document.getElementById('aiOutput');
      document.getElementById('aiAnalyze').addEventListener('click', () => {
        // Clear previous output and show a loading message
        aiOutputDiv.style.display = 'block';
        aiOutputDiv.textContent = '⏳ Analyzing code...';
        socket.emit('ai-analyze', { roomId, code: editor.getValue() });
      });

      // Listen for AI response and display in white box
      socket.on('ai-response', ({ analysis }) => {
        aiOutputDiv.style.display = 'block';
        aiOutputDiv.textContent = analysis;
      });

      socket.on('ai-error', ({ error }) => {
        aiOutputDiv.style.display = 'block';
        aiOutputDiv.textContent = '❌ Error: ' + error;
      });

      // ---------- WebRTC: Peer management ----------
      const peers = {};
      const remoteStreams = {};
      const remoteVideosDiv = document.getElementById('remoteVideos');

      function addRemoteVideo(socketId, userName, stream) {
        const container = document.createElement('div');
        container.id = \`remote-\${socketId}\`;
        container.className = 'remote-video-container';

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;
        video.className = 'remote-video';

        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = userName;

        container.appendChild(video);
        container.appendChild(label);
        remoteVideosDiv.appendChild(container);
      }

      function removeRemoteVideo(socketId) {
        const el = document.getElementById(\`remote-\${socketId}\`);
        if (el) el.remove();
        delete remoteStreams[socketId];
      }

      function createPeerConnection(targetSocketId, targetUserName) {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peers[targetSocketId] = pc;

        if (localStream) {
          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        pc.ontrack = (event) => {
          if (!remoteStreams[targetSocketId]) {
            remoteStreams[targetSocketId] = event.streams[0];
            addRemoteVideo(targetSocketId, targetUserName, event.streams[0]);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { to: targetSocketId, candidate: event.candidate });
          }
        };

        return pc;
      }

      socket.on('existing-users', (users) => {
        users.forEach(u => {
          if (u.socketId !== socket.id) {
            const pc = createPeerConnection(u.socketId, u.userName);
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                socket.emit('offer', { to: u.socketId, offer: pc.localDescription, fromUserName: userName });
              });
          }
        });
      });

      socket.on('user-joined', ({ userName, socketId }) => {
        const pc = createPeerConnection(socketId, userName);
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('offer', { to: socketId, offer: pc.localDescription, fromUserName: userName });
          });
      });

      socket.on('user-left', ({ socketId }) => {
        if (peers[socketId]) {
          peers[socketId].close();
          delete peers[socketId];
        }
        removeRemoteVideo(socketId);
      });

      socket.on('offer', async ({ from, fromUserName, offer }) => {
        if (!localStream) return;
        const pc = createPeerConnection(from, fromUserName);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer, fromUserName: userName });
      });

      socket.on('answer', async ({ from, answer }) => {
        const pc = peers[from];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on('ice-candidate', ({ from, candidate }) => {
        const pc = peers[from];
        if (pc) {
          pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      // Run code button (unchanged)
      document.getElementById('runCode').addEventListener('click', () => {
        document.getElementById('preview').srcdoc = editor.getValue();
        // Optionally hide AI output when running code
        aiOutputDiv.style.display = 'none';
      });
    })();
  </script>
  </body></html>`;
  res.send(html);
});

// ---------- SOCKET.IO (server) ----------
io.on('connection', (socket) => {
  socket.on('join-room', async ({ roomId, userName }) => {
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.userName = userName;
    socket.joinTime = Date.now();

    if (!rooms[roomId]) {
      rooms[roomId] = { 
        id: roomId, 
        code: '', 
        language: 'javascript', 
        participants: {},
        priorityUser: null
      };
      try {
        const roomData = await Room.findOne({ roomId });
        if (roomData) {
          rooms[roomId].code = roomData.code || '';
          rooms[roomId].language = roomData.language || 'javascript';
        } else {
          const newRoom = new Room({ roomId, code: '', language: 'javascript' });
          await newRoom.save();
        }
      } catch (err) {
        console.error(err);
      }
    }

    rooms[roomId].participants[socket.id] = { userName, joinTime: socket.joinTime, socketId: socket.id };

    const existingUsers = Object.values(rooms[roomId].participants)
      .filter(p => p.socketId !== socket.id)
      .map(p => ({ userName: p.userName, socketId: p.socketId }));
    socket.emit('existing-users', existingUsers);

    socket.to(roomId).emit('user-joined', { userName, socketId: socket.id });

    socket.emit('init-code', rooms[roomId].code || '');
    socket.emit('init-language', rooms[roomId].language || 'javascript');

    if (rooms[roomId].priorityUser) {
      const prioritySocketId = rooms[roomId].priorityUser;
      const priorityUserName = rooms[roomId].participants[prioritySocketId]?.userName;
      if (priorityUserName) {
        socket.emit('priority-user', { socketId: prioritySocketId, userName: priorityUserName });
      }
    }

    emitKafkaEvent('meeting-events', 'USER_JOINED', {
      roomId,
      userName,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('code-change', async ({ roomId, code }) => {
    if (rooms[roomId]) {
      rooms[roomId].code = code;
      try {
        await Room.updateOne({ roomId }, { $set: { code } }, { upsert: true });
      } catch (err) {
        console.error(err);
      }
      socket.to(roomId).emit('code-change', code);
      emitKafkaEvent('meeting-events', 'CODE_CHANGE', { roomId, userName: socket.userName, codeLength: code.length });
    }
  });

  socket.on('language-change', async ({ roomId, language }) => {
    if (rooms[roomId]) {
      rooms[roomId].language = language;
      try {
        await Room.updateOne({ roomId }, { $set: { language } }, { upsert: true });
      } catch (err) {
        console.error(err);
      }
      io.to(roomId).emit('language-change', language);
      emitKafkaEvent('meeting-events', 'LANGUAGE_CHANGE', { roomId, userName: socket.userName, language });
    }
  });

  socket.on('chat', ({ roomId, userName, message }) => {
    io.to(roomId).emit('chat', { userName, message });
    emitKafkaEvent('meeting-events', 'CHAT_MESSAGE', { roomId, userName, message });
  });

  socket.on('file-share', ({ roomId, userName, fileName, fileData }) => {
    socket.to(roomId).emit('file-share', { userName, fileName, fileData });
    emitKafkaEvent('meeting-events', 'FILE_SHARE', { roomId, userName, fileName, fileSize: fileData.length });
  });

  socket.on('leave-room', async ({ roomId, userName }) => {
    const participant = rooms[roomId]?.participants[socket.id];
    if (participant) {
      const joinTime = participant.joinTime;
      const durationMs = Date.now() - joinTime;
      const durationMin = Math.floor(durationMs / 60000);
      const durationStr = durationMin > 0 ? `${durationMin} min` : '<1 min';
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      try {
        const user = await User.findOne({ $or: [{ name: userName }, { username: userName }] });
        if (user) {
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

      emitKafkaEvent('meeting-events', 'USER_LEFT', { roomId, userName, duration: durationStr });
    }

    if (rooms[roomId] && rooms[roomId].priorityUser === socket.id) {
      rooms[roomId].priorityUser = null;
      io.to(roomId).emit('priority-cleared');
    }

    socket.to(roomId).emit('user-left', { socketId: socket.id, userName });
    socket.leave(roomId);
    if (rooms[roomId]?.participants[socket.id]) {
      delete rooms[roomId].participants[socket.id];
    }
  });

  socket.on('offer', ({ to, offer, fromUserName }) => {
    socket.to(to).emit('offer', { from: socket.id, fromUserName, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    socket.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('priority-user', ({ roomId }) => {
    if (!rooms[roomId]) return;

    if (rooms[roomId].priorityUser === socket.id) {
      rooms[roomId].priorityUser = null;
      io.to(roomId).emit('priority-cleared');
      emitKafkaEvent('meeting-events', 'PRIORITY_CLEARED', { roomId, userName: socket.userName });
    } else {
      rooms[roomId].priorityUser = socket.id;
      io.to(roomId).emit('priority-user', { socketId: socket.id, userName: socket.userName });
      emitKafkaEvent('meeting-events', 'PRIORITY_USER', { roomId, userName: socket.userName });
    }
  });

  // ✅ AI analysis using official @google/genai SDK – result sent to white box
  socket.on('ai-analyze', async ({ roomId, code }) => {
    try {
      if (!GEMINI_API_KEY) {
        socket.emit('ai-error', { error: 'Gemini API key not set. AI analysis unavailable.' });
        return;
      }
      // Initialize the client
      const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      
      const prompt = `Analyze the following code. Provide concise feedback: bugs, improvements, or best practices. Code:\n${code}`;
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash', // or 'gemini-1.5-pro' if you prefer
        contents: prompt,
        generationConfig: {
          temperature: 0.3,
        },
      });
      
      const output = response.text; // plain text result

      io.to(roomId).emit('ai-response', { analysis: output });
      emitKafkaEvent('meeting-events', 'AI_ANALYSIS', { roomId, userName: socket.userName, codeLength: code.length });
    } catch (err) {
      console.error('❌ AI analysis error:', err.message);
      io.to(roomId).emit('ai-error', { error: 'Failed to analyze code: ' + err.message });
    }
  });

  socket.on('disconnect', async () => {
    for (const roomId in rooms) {
      if (rooms[roomId].participants[socket.id]) {
        const participant = rooms[roomId].participants[socket.id];
        const joinTime = participant.joinTime;
        const durationMs = Date.now() - joinTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationStr = durationMin > 0 ? `${durationMin} min` : '<1 min';
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const userName = participant.userName;
        
        try {
          const user = await User.findOne({ $or: [{ name: userName }, { username: userName }] });
          if (user) {
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

        emitKafkaEvent('meeting-events', 'USER_DISCONNECTED', { roomId, userName, duration: durationStr });

        if (rooms[roomId].priorityUser === socket.id) {
          rooms[roomId].priorityUser = null;
          io.to(roomId).emit('priority-cleared');
        }

        socket.to(roomId).emit('user-left', { socketId: socket.id, userName });
        delete rooms[roomId].participants[socket.id];
        break;
      }
    }
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing Kafka producer...');
  if (producer) await producer.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing Kafka producer...');
  if (producer) await producer.disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`CodeMeet running on http://localhost:${PORT}`));