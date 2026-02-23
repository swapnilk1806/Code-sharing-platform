# CodeMeet - Real-time Collaborative Coding Platform

A modern web application for real-time collaborative coding with video chat, AI code analysis, and file sharing.

## Features

- 🚀 Real-time collaborative code editing
- 📹 Video/audio chat with WebRTC
- 🤖 AI-powered code analysis (Google Gemini)
- 💬 Real-time chat
- 📁 File sharing
- 🎯 Priority speaker functionality
- 📊 Meeting history tracking
- 🌐 Multi-language support (JavaScript, Python, C++, Java)

## Project Structure

```
├── controllers/
│   └── UserController.js          # User authentication logic
├── models/
│   ├── UserModel.js               # User schema and model
│   └── RoomModel.js              # Room and MeetingHistory models
├── public/
│   ├── images/                    # Static images
│   ├── javascripts/               # Client-side JS files
│   └── stylesheets/               # CSS files
├── routes/
│   └── UserRouter.js              # Authentication routes
├── views/                         # Template files (if using view engine)
├── app.js                         # Main application file
├── config.js                      # Configuration and environment variables
├── package.json                   # Dependencies and scripts
└── server.js                      # Legacy server file (can be removed)
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis (optional, for session storage)
- Kafka (optional, for event streaming)

## Installation

1. **Clone or setup the project:**
   ```bash
   # Navigate to your project directory
   cd c:/Users/swapn/OneDrive/Desktop/DEsktop/1st
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/codemeet

   # AI Services
   GEMINI_API_KEY=your_google_gemini_api_key_here

   # Redis (optional)
   REDIS_URL=redis://localhost:6379

   # Kafka (optional)
   KAFKA_BROKERS=localhost:9092
   KAFKA_ENABLED=false

   # Security
   JWT_SECRET=your_secret_key_here

   # Server
   PORT=4000
   ```

4. **Start MongoDB:**
   ```bash
   # On Windows
   mongod

   # On macOS/Linux
   sudo systemctl start mongod
   # or
   mongod
   ```

5. **Start Redis (optional):**
   ```bash
   # On Windows
   redis-server

   # On macOS/Linux
   redis-server
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will start on `http://localhost:4000`

## Usage

1. **Register a new account:**
   - Visit `http://localhost:4000`
   - Click "Register"
   - Fill in your details

2. **Login:**
   - Use your credentials to login

3. **Join or create a room:**
   - Enter a room ID to join an existing room
   - Leave empty to create a new room

4. **Collaborate:**
   - Start coding in the editor
   - Use video/audio chat
   - Share files
   - Use AI analysis for code feedback

### Static Files & Photo Uploads

#### Application Screenshots

**Register Page:**
![Register Page](http://localhost:4000/images/1.png)

**Login Page:**
![Login Page](http://localhost:4000/images/2.png)

**Dashboard:**
![Dashboard](http://localhost:4000/images/3.png)

**Final Page:**
![Final Page](http://localhost:4000/images/4.png)

#### Image Directory Structure
```
public/
└── images/
    ├── 1.png    # Register page screenshot
    ├── 2.png    # Login page screenshot
    ├── 3.png    # Dashboard screenshot
    └── 4.png    # Final page screenshot
```

#### Photo Upload URLs
Photos uploaded to the platform are accessible via the following URL pattern:
```
http://localhost:4000/images/[filename]
```

**Example URLs:**
- `http://localhost:4000/images/1.png` - Register Page
- `http://localhost:4000/images/2.png` - Login Page
- `http://localhost:4000/images/3.png` - Dashboard
- `http://localhost:4000/images/4.png` - Final Page

#### File Upload Features
- Support for image file uploads (PNG, JPG, JPEG, GIF)
- Automatic file storage in `/public/images/` directory
- Public URL generation for uploaded images
- File size and type validation

## API Endpoints

### Authentication
- `GET /` - Home/redirect
- `GET /login` - Login page
- `POST /login` - Login authentication
- `GET /register` - Registration page
- `POST /register` - User registration
- `GET /join` - Join room page (requires auth)
- `POST /join` - Join/create room
- `GET /logout` - Logout

### Room
- `GET /room/:id` - Room interface (requires auth)

### Socket.IO Events
- `join-room` - Join a collaborative room
- `code-change` - Real-time code editing
- `language-change` - Change programming language
- `chat` - Send chat messages
- `file-share` - Share files
- `ai-analyze` - Analyze code with AI
- `priority-user` - Set priority speaker
- WebRTC events for video/audio

## Configuration

### MongoDB
The application uses MongoDB for storing:
- User accounts
- Room data
- Meeting history

### Redis
Redis is used for:
- Session storage
- Socket.IO adapter for multi-instance scaling

### Kafka
Kafka is used for:
- Event streaming and analytics
- Optional feature (can be disabled)

## Development Notes

- The application follows MVC architecture
- Uses Express.js for the backend
- Socket.IO for real-time communication
- WebRTC for peer-to-peer video/audio
- CodeMirror for the code editor
- Google Gemini API for AI analysis

## Troubleshooting

### Common Issues

1. **MongoDB connection failed:**
   - Ensure MongoDB is running
   - Check the MONGODB_URI in your .env file

2. **Redis connection failed:**
   - Redis is optional, app will work without it
   - Check REDIS_URL if using Redis

3. **AI analysis not working:**
   - Ensure GEMINI_API_KEY is set in .env
   - Check your API key validity

4. **Camera/mic not working:**
   - Ensure browser permissions are granted
   - Use HTTPS in production for camera access

### Port Issues
If port 4000 is in use, change it in your .env file:
```env
PORT=3001
```

## License

MIT License
