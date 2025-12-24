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
        ws.send(JSON.stringify({ type: 'auth', token: token }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'authenticated') {
            document.getElementById('status-dot').classList.add('connected');
            document.getElementById('status-text').textContent = 'Connected';
            ws.send(JSON.stringify({ type: 'join_room', roomId }));
            ws.send(JSON.stringify({ type: 'game_join', roomId }));
        } else if (data.type === 'game_state') {
            updateGame(data.state);
        }
    };
}

function updateGame(gameState) {
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
        const isMyTurn = (gameState.turn === 'X' && gameState.xPlayer === user.username) ||
            (gameState.turn === 'O' && gameState.oPlayer === user.username);

        status.textContent = isMyTurn ? "Your Turn!" : `Waiting for ${gameState.turn}...`;
    }
}

function makeMove(index) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'game_move', index, roomId: roomId }));
    }
}

function restartGame() {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'game_restart', roomId: roomId }));
    }
}

connect();
