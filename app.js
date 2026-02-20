const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const RedisStore = require('connect-redis')(session);
const { createAdapter } = require('@socket.io/redis-adapter');
const { Kafka } = require('kafkajs');

const config = require('./config');
const userRouter = require('./routes/UserRouter');
const RoomController = require('./controllers/RoomController');
const SocketHandler = require('./room');
const aiRoutes = require('./ai/ai-routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Check for Gemini API key
if (!config.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set. AI analysis will not work.');
} else {
  console.log('✅ GEMINI_API_KEY loaded');
}

// Redis setup
const redisClient = new Redis(config.REDIS_URL);
redisClient.on('error', (err) => {
  console.error('❌ Redis client error (sessions):', err.message);
});

const pubClient = new Redis(config.REDIS_URL);
pubClient.on('error', (err) => {
  console.error('❌ Redis pubClient error (Socket.IO):', err.message);
});

const subClient = pubClient.duplicate();
subClient.on('error', (err) => {
  console.error('❌ Redis subClient error (Socket.IO):', err.message);
});

// Kafka setup (optional)
let producer;
if (config.KAFKA_ENABLED) {
  const kafka = new Kafka({
    clientId: 'codemeet-app',
    brokers: config.KAFKA_BROKERS
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

  async function emitKafkaEvent(topic, eventType, data) {
    if (!config.KAFKA_ENABLED || !producer) return;
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
}

// MongoDB connection
mongoose.connect(config.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: config.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Socket.IO adapter
io.adapter(createAdapter(pubClient, subClient));

// Routes
app.use('/', userRouter);
app.use('/ai', aiRoutes);
app.get('/room/:id', RoomController.getRoomPage);

// Initialize Socket Handler
const socketHandler = new SocketHandler(io);

// Graceful shutdown
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

// Start server
server.listen(config.PORT, () => {
  console.log(`🚀 CodeMeet running on http://localhost:${config.PORT}`);
});
