const user = checkAuth();
const token = localStorage.getItem('token');

async function initDashboard() {
    document.getElementById('current-username').textContent = user.username;
    document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('user-role').textContent = user.role.toUpperCase();

    if (user.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
    }

    fetchRooms();
}

async function fetchRooms() {
    try {
        const res = await fetch('/api/rooms', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const rooms = await res.json();
            renderRooms(rooms);
        }
    } catch (e) { console.error(e); }
}

function renderRooms(rooms) {
    const list = document.getElementById('room-list');
    list.innerHTML = rooms.map(r => `
        <div class="room-item" onclick="enterRoom('${r.id}', '${r.type}', '${r.name}')">
            <span>${r.type === 'game' ? '🎮' : '💬'}</span>
            <span>${r.name}</span>
            <span style="margin-left:auto; font-size:0.7rem; opacity:0.6">${r.type}</span>
        </div>
    `).join('');
}

function enterRoom(id, type, name) {
    const page = type === 'game' ? 'game.html' : 'chat.html';
    window.location.href = `${page}?roomId=${id}&name=${encodeURIComponent(name)}`;
}

async function createRoom() {
    const name = prompt("Enter room name:");
    if (!name) return;
    const type = confirm("Is this a Tic-Tac-Toe game room?\nCancel for Chat Room.") ? "game" : "chat";

    try {
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, type })
        });
        if (res.ok) fetchRooms();
        else alert((await res.json()).error);
    } catch (e) { console.error(e); }
}

initDashboard();

