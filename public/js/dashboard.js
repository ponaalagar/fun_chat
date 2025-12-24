const user = checkAuth();
const token = localStorage.getItem('token');

async function initDashboard() {
    document.getElementById('current-username').textContent = user.username;
    document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('user-role').textContent = user.role.toUpperCase();

    if (user.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
        fetchPendingUsers();
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

// Admin Functions
async function fetchPendingUsers() {
    try {
        const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const users = await res.json();
            renderPendingUsers(users);
        }
    } catch (e) { console.error(e); }
}

function renderPendingUsers(users) {
    const list = document.getElementById('pending-users-list');
    const pending = users.filter(u => u.status === 'pending');

    if (pending.length === 0) {
        list.innerHTML = '<div style="padding:10px; opacity:0.5; font-size:0.9rem;">No pending requests</div>';
        return;
    }

    list.innerHTML = pending.map(u => `
        <div class="room-item" style="cursor: default;">
            <div style="flex:1;">
                <div>${u.username}</div>
                <div style="font-size:0.7rem; opacity:0.6">IP: ${u.ip || 'Unknown'}</div>
            </div>
            <button class="admin-badge" style="border:none; cursor:pointer;" onclick="approveUser('${u.id}')">Accept</button>
        </div>
    `).join('');
}

async function approveUser(id) {
    if (!confirm('Approve this user?')) return;
    try {
        const res = await fetch(`/api/users/${id}/approve`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchPendingUsers();
    } catch (e) { console.error(e); }
}

initDashboard();
