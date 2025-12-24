import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export const db = {
    users: path.join(DATA_DIR, 'users.json'),
    rooms: path.join(DATA_DIR, 'rooms.json'),

    async read(file) {
        await ensureDataDir();
        try {
            const data = await fs.readFile(file, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, return empty array/object
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    },

    async write(file, data) {
        await ensureDataDir();
        await fs.writeFile(file, JSON.stringify(data, null, 2));
    },

    async getUsers() {
        return this.read(this.users);
    },

    async saveUsers(users) {
        return this.write(this.users, users);
    },

    async getRooms() {
        return this.read(this.rooms);
    },

    async saveRooms(rooms) {
        return this.write(this.rooms, rooms);
    },

    // Initialize default data if missing
    async init() {
        await ensureDataDir();
        let users = [];
        try {
            users = await this.read(this.users);
        } catch {
            await this.saveUsers([]);
        }

        // Static Admin Check
        const adminWait = await import('bcryptjs');
        const bcrypt = adminWait.default;

        if (!users.find(u => u.username === 'admin')) {
            const hashedPassword = await bcrypt.hash('12345678', 10);
            users.push({
                id: 'static-admin-id',
                username: 'admin',
                password: hashedPassword,
                role: 'admin',
                status: 'active',
                isBlocked: false,
                createdAt: new Date().toISOString(),
                ip: '127.0.0.1'
            });
            await this.saveUsers(users);
            console.log("Static Admin created");
        }

        try {
            await fs.access(this.rooms);
        } catch {
            // Initial default room
            await this.saveRooms([
                {
                    id: 'default-room-1',
                    name: 'General Chat',
                    type: 'chat',
                    createdBy: 'system',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'tic-tac-toe-1',
                    name: 'Tic Tac Toe Lounge',
                    type: 'game',
                    createdBy: 'system',
                    createdAt: new Date().toISOString()
                }
            ]);
        }
    }
};
