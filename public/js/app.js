const state = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    rooms: [],
    currentRoom: null,
    ws: null,
    gameState: null
};

// UI Elements
const views = {
    login: document.getElementById('login-view'),
    register: document.getElementById('register-view'),
    app: document.getElementById('app-view')
};

// Init
function init() {
    if (state.token && state.user) {
        showView('app');
        setupApp();
    } else {
        showView('login');
    }
}

function showView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

// --- Auth ---

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('token', state.token);
            localStorage.setItem('user', JSON.stringify(state.user));
            showView('app');
            setupApp();
        } else {
            alert(data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Login failed');
    }
}

async function register() {
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            showView('login');
        } else {
            alert(data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Registration failed');
    }
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (state.ws) state.ws.close();
    showView('login');
}

// --- App Logic ---

async function setupApp() {
    document.getElementById('current-username').textContent = state.user.username;
    // Check if Admin
    if (state.user.role === 'admin') {
        // Show admin controls (could add specific UI logic here)
    }

    await fetchRooms();
    connectWS();
}

async function fetchRooms() {
    try {
        const res = await fetch('/api/rooms', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            state.rooms = await res.json();
            renderRooms();
        }
    } catch (e) { console.error(e); }
}

async function createRoom() {
    const name = prompt("Enter room name:");
    const type = confirm("Is this a Tic-Tac-Toe game room?") ? "game" : "chat";

    if (name) {
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({ name, type })
            });
            if (res.ok) fetchRooms();
            else alert((await res.json()).error);
        } catch (e) { console.error(e); }
    }
}

function renderRooms() {
    const list = document.getElementById('room-list');
    list.innerHTML = state.rooms.map(r => `
        <div class="room-item ${state.currentRoom?.id === r.id ? 'active' : ''}" 
             onclick="joinRoom('${r.id}')">
            <span>${r.type === 'game' ? '🎮' : '💬'}</span>
            <span>${r.name}</span>
        </div>
    `).join('');
}

function joinRoom(roomId) {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return;

    state.currentRoom = room;
    renderRooms();

    // Clear Main Area
    document.getElementById('chat-messages').innerHTML = '';

    // Toggle Views
    if (room.type === 'game') {
        document.getElementById('chat-view').classList.add('hidden');
        document.getElementById('game-view').classList.remove('hidden');
        document.getElementById('room-title-game').textContent = room.name;
    } else {
        document.getElementById('game-view').classList.add('hidden');
        document.getElementById('chat-view').classList.remove('hidden');
        document.getElementById('room-title-chat').textContent = room.name;
    }

    // WS Action
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ type: 'join_room', roomId }));
        if (room.type === 'game') {
            state.ws.send(JSON.stringify({ type: 'game_join', roomId }));
        }
    }
}


// --- WebSocket ---

function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.ws = new WebSocket(`${protocol}//${location.host}`);

    state.ws.onopen = () => {
        // Authenticate
        state.ws.send(JSON.stringify({ type: 'auth', token: state.token }));
    };

    state.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWSEvent(data);
    };

    state.ws.onclose = () => {
        // Reconnect logic if needed
    };
}

function handleWSEvent(data) {
    switch (data.type) {
        case 'authenticated':
            console.log('WS Authenticated');
            // Auto join default if exists?
            break;
        case 'message':
            appendMessage(data);
            break;
        case 'system':
            appendSystemMessage(data.content);
            break;
        case 'game_state':
            updateGame(data.state);
            break;
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (content && state.ws) {
        state.ws.send(JSON.stringify({ type: 'chat_message', content }));
        input.value = '';
    }
}

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    const isOwn = msg.username === state.user.username;

    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-info">${isOwn ? 'You' : msg.username}</div>
            ${msg.content}
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendSystemMessage(text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.color = 'var(--text-muted)';
    div.style.fontSize = '0.8rem';
    div.style.margin = '10px 0';
    div.textContent = text;
    container.appendChild(div);
}

// --- Game Logic ---

function updateGame(gameState) {
    state.gameState = gameState;
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    gameState.board.forEach((cell, index) => {
        const el = document.createElement('div');
        el.className = `cell ${cell ? cell.toLowerCase() : ''}`;
        el.textContent = cell || '';
        el.onclick = () => makeMove(index);
        board.appendChild(el);
    });

    const status = document.getElementById('game-status');
    if (gameState.winner) {
        if (gameState.winner === 'draw') status.textContent = "It's a Draw!";
        else status.textContent = `Winner: ${gameState.winner}!`;
    } else {
        status.textContent = `Turn: ${gameState.turn} (${gameState.turn === 'X' ? gameState.xPlayer : gameState.oPlayer})`;
    }
}

function makeMove(index) {
    if (state.ws) {
        state.ws.send(JSON.stringify({ type: 'game_move', index, roomId: state.currentRoom.id }));
    }
}

function restartGame() {
    if (state.ws && state.currentRoom) {
        state.ws.send(JSON.stringify({ type: 'game_restart', roomId: state.currentRoom.id }));
    }
}

// Event Listeners for inputs
document.getElementById('message-input')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});


// Start
init();
