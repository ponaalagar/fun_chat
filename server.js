import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(join(__dirname, "public")));

// Chat password
const CHAT_PASSWORD = "december";

// Store connected clients
const clients = new Map();

wss.on("connection", (ws) => {
    console.log("New client connected");
    let isAuthenticated = false;

    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case "join":
                    // Verify password
                    if (message.password !== CHAT_PASSWORD) {
                        ws.send(JSON.stringify({
                            type: "error",
                            content: "Invalid password"
                        }));
                        ws.close();
                        return;
                    }
                    isAuthenticated = true;
                    clients.set(ws, message.username);
                    ws.send(JSON.stringify({ type: "authenticated" }));
                    broadcast({
                        type: "system",
                        content: `${message.username} joined the chat`,
                        timestamp: new Date().toISOString()
                    });
                    broadcast({
                        type: "users",
                        users: Array.from(clients.values())
                    });
                    break;

                case "message":
                    broadcast({
                        type: "message",
                        username: clients.get(ws) || "Anonymous",
                        content: message.content,
                        timestamp: new Date().toISOString()
                    });
                    break;

                case "typing":
                    broadcastExcept(ws, {
                        type: "typing",
                        username: clients.get(ws)
                    });
                    break;
            }
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });

    ws.on("close", () => {
        const username = clients.get(ws);
        clients.delete(ws);
        if (username) {
            broadcast({
                type: "system",
                content: `${username} left the chat`,
                timestamp: new Date().toISOString()
            });
            broadcast({
                type: "users",
                users: Array.from(clients.values())
            });
        }
        console.log("Client disconnected");
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
    });
});

function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(data);
        }
    });
}

function broadcastExcept(sender, message) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client !== sender && client.readyState === 1) {
            client.send(data);
        }
    });
}

// Use PORT from environment or default to 3000
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           WebSocket Chat Server Running!                   ║
╠════════════════════════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}                          ║
║  Network:  http://<YOUR_SERVER_IP>:${PORT}                   ║
║                                                            ║
║  Share the Network URL with others to collaborate!         ║
╚════════════════════════════════════════════════════════════╝
    `);
});
