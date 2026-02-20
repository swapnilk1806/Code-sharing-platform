require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codemeet';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_ENABLED = process.env.KAFKA_ENABLED === 'true';
const JWT_SECRET = process.env.JWT_SECRET || 'code-meet-secret-change-this';
const PORT = process.env.PORT || 4000;

module.exports = {
  MONGODB_URI,
  GEMINI_API_KEY,
  REDIS_URL,
  KAFKA_BROKERS,
  KAFKA_ENABLED,
  JWT_SECRET,
  PORT
};
