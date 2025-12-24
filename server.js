import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./utils/db.js";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const JWT_SECRET = "super-secret-key-change-this-in-prod"; // In prod use .env

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// Ensure uploads directory exists
const uploadsDir = join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${crypto.randomUUID()}${getExtension(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mp3|wav|ogg|pdf|doc|docx|txt|zip|rar/;
        const ext = getExtension(file.originalname).toLowerCase().replace('.', '');
        cb(null, allowed.test(ext));
    }
});

function getExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot) : '';
}

// Initialize DB
db.init();

// --- API Routes ---

// Register
app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Missing fields" });

        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Check Blocked IP
        const blockedIps = await db.getBlockedIps();
        if (blockedIps.includes(userIp)) {
            return res.status(403).json({ error: "Access denied from this IP address" });
        }

        const users = await db.getUsers();
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: "Username taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: crypto.randomUUID(),
            username,
            password: hashedPassword,
            role: "user", // Always user, admin is static
            status: "pending", // Always pending
            isBlocked: false,
            createdAt: new Date().toISOString(),
            ip: userIp
        };

        users.push(newUser);
        await db.saveUsers(users);

        res.json({ message: "Registration successful! logical Please wait for admin approval.", status: newUser.status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Login
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Check Blocked IP
        const blockedIps = await db.getBlockedIps();
        if (blockedIps.includes(userIp)) {
            return res.status(403).json({ error: "Access denied from this IP address" });
        }

        const users = await db.getUsers();
        const user = users.find(u => u.username === username);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (user.isBlocked) return res.status(403).json({ error: "Account has been blocked by Admin" });
        if (user.status !== "active") return res.status(403).json({ error: "Account pending Admin approval" });

        // Update Login IP
        user.lastLoginIp = userIp;
        await db.saveUsers(users);

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Middleware for Auth
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Admin Routes
app.get("/api/users", authenticateToken, async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const users = await db.getUsers();
    // Send safe info + IP
    res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        status: u.status,
        isBlocked: u.isBlocked,
        ip: u.ip,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt
    })));
});

app.put("/api/users/:id/approve", authenticateToken, async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const users = await db.getUsers();
    const user = users.find(u => u.id === req.params.id);
    if (user) {
        user.status = "active";
        await db.saveUsers(users);
        res.json({ message: "User approved" });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

app.put("/api/users/:id/block", authenticateToken, async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const users = await db.getUsers();
    const user = users.find(u => u.id === req.params.id);
    if (user) {
        user.isBlocked = !user.isBlocked;
        await db.saveUsers(users);
        // Disconnect if blocking
        if (user.isBlocked) disconnectUser(user.username);
        res.json({ message: user.isBlocked ? "User blocked" : "User unblocked", isBlocked: user.isBlocked });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

app.delete("/api/users/:id", authenticateToken, async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);
    let users = await db.getUsers();
    const initialLength = users.length;
    users = users.filter(u => u.id !== req.params.id);

    if (users.length !== initialLength) {
        await db.saveUsers(users);
        res.json({ message: "User declined/deleted" });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

app.post("/api/blocked-ips", authenticateToken, async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });

    const blocked = await db.getBlockedIps();
    if (!blocked.includes(ip)) {
        blocked.push(ip);
        await db.saveBlockedIps(blocked);
    }
    res.json({ message: "IP Blocked" });
});

// Rooms
app.get("/api/rooms", authenticateToken, async (req, res) => {
    const rooms = await db.getRooms();
    res.json(rooms);
});

app.post("/api/rooms", authenticateToken, async (req, res) => {
    const { name, type } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const rooms = await db.getRooms();
    if (rooms.find(r => r.name === name)) return res.status(400).json({ error: "Room exists" });

    const newRoom = {
        id: crypto.randomUUID(),
        name,
        type: type || 'chat',
        createdBy: req.user.username,
        createdAt: new Date().toISOString()
    };
    rooms.push(newRoom);
    await db.saveRooms(rooms);
    res.json(newRoom);
});

// File Upload
app.post("/api/upload", authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded or file type not allowed" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = getFileType(req.file.mimetype);

    res.json({
        url: fileUrl,
        fileName: req.file.originalname,
        fileType: fileType,
        mimeType: req.file.mimetype,
        fileSize: req.file.size
    });
});

function getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
}

// --- WebSocket Logic ---

const clients = new Map(); // ws -> { username, roomId }
const rooms = new Map(); // roomId -> Set(ws)
const gameStates = new Map(); // roomId -> { board, turn, xPlayer, oPlayer, winner }

function disconnectUser(username) {
    for (const [ws, data] of clients.entries()) {
        if (data.username === username) {
            ws.close();
        }
    }
}

wss.on("connection", (ws, req) => {
    // Basic Auth via protocol or query param is tricky with standard WS client in browser
    // We'll expect an 'auth' message first
    let isAuthenticated = false;
    let currentUser = null;

    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === "auth") {
                jwt.verify(message.token, JWT_SECRET, (err, decoded) => {
                    if (err) {
                        ws.send(JSON.stringify({ type: "error", content: "Invalid token" }));
                        ws.close();
                    } else {
                        isAuthenticated = true;
                        currentUser = decoded;
                        clients.set(ws, { username: currentUser.username, roomId: null });
                        ws.send(JSON.stringify({ type: "authenticated", user: currentUser }));
                    }
                });
                return;
            }

            if (!isAuthenticated) return;

            const clientData = clients.get(ws);

            switch (message.type) {
                case "join_room":
                    handleJoinRoom(ws, clientData, message.roomId);
                    break;
                case "leave_room":
                    handleLeaveRoom(ws, clientData);
                    break;
                case "chat_message":
                    handleChatMessage(ws, clientData, message.content);
                    break;
                case "file_message":
                    handleFileMessage(ws, clientData, message.file);
                    break;
                case "sticker_message":
                    handleStickerMessage(ws, clientData, message.sticker);
                    break;
                case "message_reaction":
                    handleMessageReaction(ws, clientData, message.messageId, message.reaction);
                    break;
                case "game_join":
                    handleGameJoin(ws, clientData, message.roomId);
                    break;
                case "game_move":
                    handleGameMove(ws, clientData, message.index);
                    break;
                case "game_restart":
                    handleGameRestart(ws, clientData.roomId);
                    break;
            }
        } catch (error) {
            console.error("WS Error", error);
        }
    });

    ws.on("close", () => {
        handleLeaveRoom(ws, clients.get(ws));
        clients.delete(ws);
    });
});

function handleJoinRoom(ws, clientData, roomId) {
    if (clientData.roomId) handleLeaveRoom(ws, clientData); // Leave current first

    clientData.roomId = roomId;
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);

    // Broadcast user joined
    broadcastToRoom(roomId, {
        type: "system",
        content: `${clientData.username} joined the room`
    });

    // Send room history or user list if needed
    broadcastRoomUsers(roomId);

    // If game room, send state
    if (gameStates.has(roomId)) {
        ws.send(JSON.stringify({ type: "game_state", state: gameStates.get(roomId) }));
    }
}

function handleLeaveRoom(ws, clientData) {
    if (!clientData || !clientData.roomId) return;
    const roomId = clientData.roomId;

    // Handle Game Leave
    const gameState = gameStates.get(roomId);
    if (gameState) {
        if (gameState.xPlayer === clientData.username) gameState.xPlayer = null;
        if (gameState.oPlayer === clientData.username) gameState.oPlayer = null;
        broadcastToRoom(roomId, { type: "game_state", state: gameState });
    }

    if (rooms.has(roomId)) {
        rooms.get(roomId).delete(ws);
        if (rooms.get(roomId).size === 0) {
            rooms.delete(roomId);
            // Optionally clean up empty dynamic game states, but keep persistent ones?
            // For now, keep state in memory until server restart or explicit clear
        } else {
            broadcastToRoom(roomId, {
                type: "system",
                content: `${clientData.username} left the room`
            });
            broadcastRoomUsers(roomId);
        }
    }
    clientData.roomId = null;
}

function handleChatMessage(ws, clientData, content) {
    if (!clientData.roomId) return;
    broadcastToRoom(clientData.roomId, {
        type: "message",
        username: clientData.username,
        content,
        timestamp: new Date().toISOString()
    });
}

function handleFileMessage(ws, clientData, file) {
    if (!clientData.roomId || !file) return;
    broadcastToRoom(clientData.roomId, {
        type: "file_message",
        username: clientData.username,
        file: {
            url: file.url,
            fileName: file.fileName,
            fileType: file.fileType,
            mimeType: file.mimeType,
            fileSize: file.fileSize
        },
        timestamp: new Date().toISOString()
    });
}

function handleStickerMessage(ws, clientData, sticker) {
    if (!clientData.roomId || !sticker) return;
    broadcastToRoom(clientData.roomId, {
        type: "sticker_message",
        id: crypto.randomUUID(),
        username: clientData.username,
        sticker: sticker,
        timestamp: new Date().toISOString()
    });
}

function handleMessageReaction(ws, clientData, messageId, reaction) {
    if (!clientData.roomId || !messageId || !reaction) return;
    broadcastToRoom(clientData.roomId, {
        type: "message_reaction",
        messageId: messageId,
        username: clientData.username,
        reaction: reaction,
        timestamp: new Date().toISOString()
    });
}

function broadcastToRoom(roomId, message) {
    if (!rooms.has(roomId)) return;
    const data = JSON.stringify(message);
    rooms.get(roomId).forEach(client => {
        if (client.readyState === 1) client.send(data);
    });
}

function broadcastRoomUsers(roomId) {
    if (!rooms.has(roomId)) return;
    const userList = Array.from(rooms.get(roomId)).map(c => clients.get(c).username);
    broadcastToRoom(roomId, { type: "room_users", users: userList });
}

// --- Game Logic ---

function handleGameJoin(ws, clientData, roomId) {
    if (!gameStates.has(roomId)) {
        gameStates.set(roomId, {
            board: Array(9).fill(null),
            turn: 'X',
            xPlayer: null,
            oPlayer: null,
            winner: null
        });
    }

    const state = gameStates.get(roomId);
    if (!state.xPlayer) {
        state.xPlayer = clientData.username;
    } else if (!state.oPlayer && state.xPlayer !== clientData.username) {
        state.oPlayer = clientData.username;
    }

    broadcastToRoom(roomId, { type: "game_state", state });
}

function handleGameMove(ws, clientData, index) {
    const roomId = clientData.roomId;
    const state = gameStates.get(roomId);
    if (!state || state.winner || state.board[index]) return;

    // Check turn
    const isX = clientData.username === state.xPlayer;
    const isO = clientData.username === state.oPlayer;
    if (state.turn === 'X' && !isX) return;
    if (state.turn === 'O' && !isO) return;

    // Make move
    state.board[index] = state.turn;

    // Check win
    if (checkWin(state.board)) {
        state.winner = state.turn;
    } else if (state.board.every(cell => cell)) {
        state.winner = 'draw';
    } else {
        state.turn = state.turn === 'X' ? 'O' : 'X';
    }

    broadcastToRoom(roomId, { type: "game_state", state });
}

function handleGameRestart(ws, roomId) {
    const state = gameStates.get(roomId);
    if (state) {
        state.board = Array(9).fill(null);
        state.turn = 'X';
        state.winner = null;
        broadcastToRoom(roomId, { type: "game_state", state });
    }
}

function checkWin(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    return lines.some(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
}

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
