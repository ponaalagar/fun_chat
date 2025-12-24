// Admin Page Logic
const user = checkAuth();
const token = localStorage.getItem('token');

// Redirect non-admin users
if (user.role !== 'admin') {
    alert('Access Denied: Admins only');
    window.location.href = 'dashboard.html';
}

async function initAdminPanel() {
    await fetchAllUsers();
}

async function fetchAllUsers() {
    try {
        const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const users = await res.json();
            renderPendingUsers(users.filter(u => u.status === 'pending'));
            renderAllUsers(users.filter(u => u.status === 'active' && u.role !== 'admin'));
        }
    } catch (e) { console.error(e); }
}

function renderPendingUsers(pending) {
    const list = document.getElementById('pending-users-list');

    if (pending.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i> No pending requests</div>';
        return;
    }

    list.innerHTML = pending.map(u => `
        <div class="user-card">
            <div class="user-info">
                <div class="user-avatar">${u.username.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">${u.username}</div>
                    <div class="user-meta">
                        <span><i class="fas fa-network-wired"></i> ${u.ip || 'Unknown'}</span>
                        <span><i class="fas fa-clock"></i> ${new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            <div class="user-actions">
                <button class="action-btn accept" onclick="approveUser('${u.id}')" title="Accept User">
                    <i class="fas fa-check"></i> Accept
                </button>
                <button class="action-btn decline" onclick="declineUser('${u.id}')" title="Decline User">
                    <i class="fas fa-times"></i> Decline
                </button>
                <button class="action-btn block-ip" onclick="blockIp('${u.ip}')" title="Block IP">
                    <i class="fas fa-ban"></i> Block IP
                </button>
            </div>
        </div>
    `).join('');
}

function renderAllUsers(users) {
    const list = document.getElementById('all-users-list');

    if (users.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i> No registered users</div>';
        return;
    }

    list.innerHTML = users.map(u => `
        <div class="user-card ${u.isBlocked ? 'blocked' : ''}">
            <div class="user-info">
                <div class="user-avatar ${u.isBlocked ? 'blocked' : ''}">${u.username.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">
                        ${u.username}
                        ${u.isBlocked ? '<span class="status-badge blocked"><i class="fas fa-ban"></i> Blocked</span>' : '<span class="status-badge active"><i class="fas fa-check"></i> Active</span>'}
                    </div>
                    <div class="user-meta">
                        <span><i class="fas fa-network-wired"></i> ${u.ip || 'Unknown'}</span>
                        <span><i class="fas fa-sign-in-alt"></i> Last: ${u.lastLoginIp || 'N/A'}</span>
                    </div>
                </div>
            </div>
            <div class="user-actions">
                <button class="action-btn ${u.isBlocked ? 'unblock' : 'block'}" onclick="toggleBlockUser('${u.id}', ${u.isBlocked})">
                    <i class="fas ${u.isBlocked ? 'fa-unlock' : 'fa-lock'}"></i> 
                    ${u.isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button class="action-btn block-ip" onclick="blockIp('${u.ip}')" title="Block IP">
                    <i class="fas fa-ban"></i> Block IP
                </button>
            </div>
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
        if (res.ok) fetchAllUsers();
    } catch (e) { console.error(e); }
}

async function declineUser(id) {
    if (!confirm('Decline and remove this user request?')) return;
    try {
        const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchAllUsers();
    } catch (e) { console.error(e); }
}

async function toggleBlockUser(id, currentlyBlocked) {
    const action = currentlyBlocked ? 'Unblock' : 'Block';
    if (!confirm(`${action} this user?`)) return;
    try {
        const res = await fetch(`/api/users/${id}/block`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchAllUsers();
    } catch (e) { console.error(e); }
}

async function blockIp(ip) {
    if (!ip || ip === 'Unknown') return alert('No valid IP to block');
    if (!confirm(`Block IP ${ip}? No one from this IP will be able to access the site.`)) return;
    try {
        const res = await fetch(`/api/blocked-ips`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ip })
        });
        if (res.ok) {
            alert('IP Blocked Successfully');
            fetchAllUsers();
        }
    } catch (e) { console.error(e); }
}

initAdminPanel();
