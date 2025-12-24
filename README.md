# WebSocket Network Chat

A simple real-time chat application for network collaboration.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Access the chat:**
   - Local: http://localhost:3000
   - Network: http://YOUR_SERVER_IP:3000

## Deployment to College Server

1. Copy this entire `deploy_socket` folder to your server
2. Run `npm install` to install dependencies
3. Run `npm start` or `node server.js`
4. Share the server IP with others: `http://SERVER_IP:3000`

### Running in Background (Linux)
```bash
# Using nohup
nohup node server.js &

# Or using pm2 (recommended)
npm install -g pm2
pm2 start server.js --name "chat"
```

### Custom Port
```bash
PORT=8080 node server.js
```

## Features
- Real-time messaging
- Online user list
- Typing indicators
- Join/leave notifications
- Mobile responsive
