# Project Context: Nexus Chat & Play

## Overview
This project is a sophisticated real-time chat and gaming application built with **Node.js, Express, and WebSockets (ws)**. It features a multi-page architecture, secure authentication, role-based access control (Admin/User), and local JSON-based persistence (no external database required).

## Architecture
-   **Type**: Multi-Page Application (MPA).
-   **Backend**: Node.js + Express.
-   **Real-time**: WebSocket (`ws`).
-   **Database**: Custom JSON file storage (`utils/db.js` -> `data/*.json`).
-   **Frontend**: Vanilla HTML/CSS/JS with "Glassmorphism" UI.

## File Structure
```
deploy_socket/
├── server.js              # Main server entry point (HTTP + WebSocket)
├── utils/
│   └── db.js              # JSON DB helper (Users, Rooms, Blocked IPs)
├── data/                  # Local storage (Git-ignored content usually, but structure is key)
│   ├── users.json
│   ├── rooms.json
│   └── blocked-ips.json
└── public/
    ├── css/
    │   └── style.css      # Premium dark theme styles + celebration animations
    ├── js/
    │   ├── auth.js        # Shared auth logic (login/register/checkAuth)
    │   ├── dashboard.js   # Dashboard logic (Rooms + Admin Link)
    │   ├── admin.js       # Admin panel logic (User Management)
    │   ├── chat.js        # Chat room logic
    │   └── game.js        # Tic-Tac-Toe logic + Win/Lose celebrations
    ├── index.html         # Login Page
    ├── register.html      # Registration Page
    ├── dashboard.html     # Main Hub (Room List + Admin Button)
    ├── admin.html         # Admin Panel (User Management - Admin Only)
    ├── chat.html          # Chat Interface
    └── game.html          # Game Interface (Tic-Tac-Toe + Celebrations)
```

## Implemented Features

### 1. Authentication & Security
-   **Dependencies**: `bcryptjs`, `jsonwebtoken`.
-   **Flow**: Register -> Pending Status -> Admin Approval -> Login.
-   **Static Admin**: Automatically created on startup if missing (`admin` / `12345678`).
-   **IP Tracking**: User IPs captured on Register/Login.
-   **IP Blocking**: Admins can block specific IPs (stored in `blocked-ips.json`).

### 2. Admin Capabilities
-   **Dedicated Admin Page**: Separate `admin.html` page accessible only by admins.
-   **User Management**: 
    -   Accept pending user requests
    -   Decline/Delete pending user requests  
    -   Block/Unblock active users
    -   Block IP addresses
-   **Route Guard**: Non-admin users redirected to dashboard if they try to access admin page.
-   **Dashboard Link**: "Open Admin Panel" button visible only to admins in dashboard.

### 3. Rooms
-   **Types**: 
    -   `chat`: Standard text chat.
    -   `game`: Tic-Tac-Toe game room.
-   **Persistence**: Stored in `rooms.json`.
-   **Creation**: Users can create named rooms of either type.

### 4. Tic-Tac-Toe Game
-   **Logic**: Server-side validation (`game_state`, `make_move`, `checkWin`).
-   **Multiplayer**: X vs O (assigned to first two joiners).
-   **Spectator**: Others can watch.
-   **Win Celebration**: 
    -   🏆 Golden glowing "VICTORY!" overlay with trophy animation
    -   Massive confetti explosion from multiple angles
-   **Lose Celebration**:
    -   😢 Dark "DEFEAT" overlay with rain effect
    -   Desaturated, gloomy atmosphere
    -   Shake animation on title
-   **Draw Celebration**:
    -   🤝 Neutral "IT'S A DRAW!" overlay
    -   Subtle confetti effect
-   **Spectator View**: Celebrates the winner with applause emoji

### 5. File Sharing & Streaming
-   **Upload**: Files uploaded via `POST /api/upload` (multer, 50MB limit)
-   **Storage**: Files stored in `public/uploads/`
-   **Supported Types**: 
    -   Images (jpeg, png, gif, webp)
    -   Videos (mp4, webm)
    -   Audio (mp3, wav, ogg)
    -   Documents (pdf, doc, docx, txt, zip, rar)
-   **Chat Integration**:
    -   📎 Attachment button in chat input
    -   🖼️ Images display inline with lightbox preview
    -   🎬 Videos play with native controls
    -   🎵 Audio plays with audio player
    -   📄 Documents show download link with file size
-   **Drag & Drop**: Drop files directly into chat to upload

### 6. Stickers & Reactions
-   **Sticker Picker**: 
    -   😊 Button opens emoji grid (32 stickers)
    -   Click to send large sticker in chat
-   **Message Reactions**:
    -   Hover any message → 😊 button appears
    -   Click to react with: 👍 ❤️ 😂 😮 😢 🔥
    -   Reactions displayed as badges under messages
    -   Toggle on/off by clicking same reaction

## Quick Start
1.  Run `npm start`.
2.  Login: `admin` / `12345678`.
3.  Access `http://localhost:3000`.



