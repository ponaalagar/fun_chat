const user = checkAuth();
const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const roomName = urlParams.get('name');

if (!roomId) window.location.href = 'dashboard.html';

document.getElementById('room-name').textContent = roomName;

let ws;

function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
        document.getElementById('status-text').textContent = 'Authenticating...';
        ws.send(JSON.stringify({ type: 'auth', token: token }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onclose = () => {
        document.getElementById('status-text').textContent = 'Disconnected';
        document.getElementById('status-dot').classList.remove('connected');
        setTimeout(connect, 3000); // Auto reconnect
    };
}

function handleMessage(data) {
    if (data.type === 'authenticated') {
        document.getElementById('status-text').textContent = 'Connected';
        document.getElementById('status-dot').classList.add('connected');
        ws.send(JSON.stringify({ type: 'join_room', roomId }));
    } else if (data.type === 'message') {
        appendMessage(data);
    } else if (data.type === 'system') {
        appendSystemMessage(data.content);
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (content && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat_message', content }));
        input.value = '';
    }
}

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    const isOwn = msg.username === user.username;

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

document.getElementById('message-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

connect();
