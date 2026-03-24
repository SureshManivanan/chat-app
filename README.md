# Real-Time Chat Application

A complete real-time chat application built with Node.js, Express, Socket.io, and MySQL.

## 🔐 Authentication (Updated to OTP-Based)

**NEW:** This app now uses **Email OTP (One-Time Password) verification** instead of passwords!

✅ **Authentication**
- Email-based OTP verification (no passwords!)
- 6-digit verification codes sent to email
- 120-second expiry on OTP
- Automatic user creation on first login
- JWT token-based sessions
- Gmail SMTP integration with Nodemailer

✅ **Real-Time Messaging**
- Private chats between users
- Group chats with multiple users
- Text messages
- Voice message support
- Image sharing

✅ **User Status**
- Online/offline status indicators
- Real-time status updates

✅ **Typing Indicators**
- Real-time typing indicators in private chats
- Group chat typing indicators

✅ **User Profiles**
- Custom avatar upload
- Bio/description
- User profile viewing

✅ **Chat History**
- Previous messages loaded on login
- Private chat history
- Group chat history

✅ **Group Management**
- Create new groups
- Add members to groups
- View group members
- Group descriptions

## Tech Stack

- **Backend:** Node.js, Express.js
- **Real-Time:** Socket.io
- **Database:** MySQL
- **Authentication:** JWT (jsonwebtoken)
- **Security:** bcryptjs
- **File Uploads:** Multer
- **Frontend:** HTML5, CSS3, Vanilla JavaScript

## Project Structure

```
chat-app/
├── config/
│   ├── database.js       # Database connection pool
│   └── schema.js         # Database schema initialization
├── routes/
│   ├── auth.js          # Authentication routes
│   └── users.js         # User and chat routes
├── middleware/
│   └── auth.js          # JWT authentication middleware
├── models/
│   └── index.js         # Database models
├── public/
│   ├── index.html       # Main HTML page
│   ├── style.css        # Stylesheet
│   └── app.js           # Frontend JavaScript
├── uploads/             # File storage
├── server.js            # Main server file
├── .env                 # Environment variables
└── package.json         # Dependencies
```

## Installation

1. **Clone or download the project**
```bash
cd chat-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure MySQL Database**
   - Create a new MySQL database
   - Update `.env` file with your database credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=chat_app_db
   JWT_SECRET=your_secret_key
   PORT=3000
   ```

4. **Start the server**
```bash
npm start
```

The server will run on `http://localhost:3000`

## Usage

1. **Register/Login**
   - Open `http://localhost:3000` in your browser
   - Create a new account or login with existing credentials

2. **Chat Features**
   - Browse online users in the sidebar
   - Click on a user to start a private chat
   - Create groups using the "+" button
   - Send text messages, images, or voice messages
   - View typing indicators in real-time
   - Check user online/offline status

3. **User Profile**
   - Click the profile icon (👤) to view and edit your profile
   - Upload an avatar and add a bio

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/me` - Get current user info
- `GET /api/users/all` - Get all users
- `GET /api/users/private-messages/:otherUserId` - Get private chat history
- `PUT /api/users/profile` - Update user profile

### Groups
- `GET /api/users/groups` - Get user's groups
- `POST /api/users/groups` - Create new group
- `GET /api/users/groups/:groupId/members` - Get group members
- `POST /api/users/groups/:groupId/members` - Add member to group
- `GET /api/users/groups/:groupId/messages` - Get group message history

### Files
- `POST /api/upload` - Upload file (image/voice)

## Socket Events

**Client → Server:**
- `user-login` - User logs in
- `private-message` - Send private message
- `group-message` - Send group message
- `typing` - User typing indicator
- `group-typing` - Group typing indicator

**Server → Client:**
- `receive-private-message` - Receive private message
- `receive-group-message` - Receive group message
- `user-online` - User comes online
- `user-offline` - User goes offline
- `user-typing` - User typing indicator
- `group-user-typing` - Group typing indicator

## Database Schema

### users
- id (INT, Primary Key)
- username (VARCHAR, Unique)
- email (VARCHAR, Unique)
- password (VARCHAR)
- avatar (VARCHAR)
- bio (VARCHAR)
- status (ENUM: online/offline)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### groups
- id (INT, Primary Key)
- name (VARCHAR)
- description (VARCHAR)
- avatar (VARCHAR)
- creator_id (INT, Foreign Key)
- created_at (TIMESTAMP)

### private_messages
- id (INT, Primary Key)
- sender_id (INT, Foreign Key)
- receiver_id (INT, Foreign Key)
- message (TEXT)
- message_type (ENUM: text/image/voice)
- file_path (VARCHAR)
- created_at (TIMESTAMP)

### group_messages
- id (INT, Primary Key)
- group_id (INT, Foreign Key)
- sender_id (INT, Foreign Key)
- message (TEXT)
- message_type (ENUM: text/image/voice)
- file_path (VARCHAR)
- created_at (TIMESTAMP)

### group_members
- id (INT, Primary Key)
- group_id (INT, Foreign Key)
- user_id (INT, Foreign Key)
- added_at (TIMESTAMP)

## Features in Detail

### 1. Authentication System
- Users can register with username, email, and password
- Passwords are hashed using bcryptjs
- JWT tokens are issued upon login/registration
- Token is stored in localStorage for persistence

### 2. Real-Time Chat
- Socket.io maintains persistent WebSocket connections
- Messages are saved to database and delivered in real-time
- Chat history is loaded when selecting a conversation

### 3. Online Status
- User status is updated to 'online' when they connect
- Status changes to 'offline' when they disconnect
- Status is broadcast to all connected clients

### 4. Typing Indicators
- When a user starts typing, a "typing..." indicator appears
- Indicator disappears after 2 seconds of inactivity
- Works in both private and group chats

### 5. File Uploads
- Images are uploaded and stored in `/uploads` folder
- Voice messages are stored as audio files
- Files are referenced by path in the database

### 6. Group Chat
- Users can create groups
- Add members to existing groups
- View all group members with their online status
- Group chat history is available to all members

## Error Handling

The application handles:
- Invalid login credentials
- Missing required fields
- Database errors
- File upload errors
- JWT validation errors
- Network errors

## Security Features

- JWT authentication for API routes
- Password hashing with bcryptjs
- CORS enabled for cross-origin requests
- SQL parameterized queries to prevent injection
- Input validation on frontend and backend

## Future Enhancements

- User blocking/muting
- Message reactions (emoji)
- Message editing/deletion
- End-to-end encryption
- Video calls
- Message search functionality
- User presence (last seen)
- Push notifications
- Admin panel for group management

## Troubleshooting

**Database Connection Error:**
- Ensure MySQL is running
- Check DB credentials in `.env` file
- Verify database exists

**Socket.io Connection Error:**
- Check if server is running on correct port
- Verify CORS settings
- Check browser console for errors

**File Upload Error:**
- Ensure `/uploads` folder exists
- Check file size limits
- Verify file permissions

## License

ISC
