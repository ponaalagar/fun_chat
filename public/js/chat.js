const user = checkAuth();
const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const roomName = urlParams.get('name');

if (!roomId) window.location.href = 'dashboard.html';

document.getElementById('room-name').textContent = roomName;

let ws;
const messageReactions = new Map(); // messageId -> { reaction: [usernames] }
let currentReactionTarget = null;

// Sticker list
const STICKERS = [
    '😀', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤔',
    '😢', '😭', '😡', '🤯', '🥳', '🎉', '👍', '👎',
    '❤️', '🔥', '💯', '🙌', '👏', '🤝', '💪', '🙏',
    '🎮', '🏆', '⚡', '✨', '🌟', '💎', '🎵', '🎶'
];

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
        setTimeout(connect, 3000);
    };
}

function handleMessage(data) {
    if (data.type === 'authenticated') {
        document.getElementById('status-text').textContent = 'Connected';
        document.getElementById('status-dot').classList.add('connected');
        ws.send(JSON.stringify({ type: 'join_room', roomId }));
        initStickerPicker();
    } else if (data.type === 'message') {
        appendMessage(data);
    } else if (data.type === 'file_message') {
        appendFileMessage(data);
    } else if (data.type === 'sticker_message') {
        appendStickerMessage(data);
    } else if (data.type === 'message_reaction') {
        handleReactionUpdate(data);
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

// ========== STICKER PICKER ==========
function initStickerPicker() {
    const grid = document.getElementById('sticker-grid');
    grid.innerHTML = STICKERS.map(s =>
        `<span class="sticker-item" onclick="sendSticker('${s}')">${s}</span>`
    ).join('');
}

function toggleStickerPicker() {
    const picker = document.getElementById('sticker-picker');
    picker.classList.toggle('hidden');
}

function sendSticker(sticker) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'sticker_message', sticker }));
    }
    document.getElementById('sticker-picker').classList.add('hidden');
}

// Close sticker picker when clicking outside
document.addEventListener('click', (e) => {
    const picker = document.getElementById('sticker-picker');
    const btn = document.querySelector('.sticker-btn');
    if (!picker.contains(e.target) && !btn.contains(e.target)) {
        picker.classList.add('hidden');
    }
});

// ========== REACTIONS ==========
function showReactionPicker(messageId, element) {
    currentReactionTarget = messageId;
    const picker = document.getElementById('reaction-picker');
    const rect = element.getBoundingClientRect();
    picker.style.top = (rect.top - 50) + 'px';
    picker.style.left = rect.left + 'px';
    picker.classList.remove('hidden');
}

function hideReactionPicker() {
    document.getElementById('reaction-picker').classList.add('hidden');
    currentReactionTarget = null;
}

// Setup reaction picker click handlers
document.querySelectorAll('.reaction-option').forEach(opt => {
    opt.addEventListener('click', () => {
        if (currentReactionTarget && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'message_reaction',
                messageId: currentReactionTarget,
                reaction: opt.dataset.reaction
            }));
        }
        hideReactionPicker();
    });
});

// Hide picker when clicking elsewhere
document.addEventListener('click', (e) => {
    const picker = document.getElementById('reaction-picker');
    if (!picker.contains(e.target) && !e.target.classList.contains('react-btn')) {
        hideReactionPicker();
    }
});

function handleReactionUpdate(data) {
    const { messageId, username, reaction } = data;

    if (!messageReactions.has(messageId)) {
        messageReactions.set(messageId, {});
    }

    const reactions = messageReactions.get(messageId);
    if (!reactions[reaction]) {
        reactions[reaction] = [];
    }

    // Toggle reaction
    const idx = reactions[reaction].indexOf(username);
    if (idx === -1) {
        reactions[reaction].push(username);
    } else {
        reactions[reaction].splice(idx, 1);
        if (reactions[reaction].length === 0) {
            delete reactions[reaction];
        }
    }

    updateReactionDisplay(messageId);
}

function updateReactionDisplay(messageId) {
    const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!msgElement) return;

    let reactionsDiv = msgElement.querySelector('.message-reactions');
    if (!reactionsDiv) {
        reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'message-reactions';
        msgElement.querySelector('.message-bubble').appendChild(reactionsDiv);
    }

    const reactions = messageReactions.get(messageId) || {};
    reactionsDiv.innerHTML = Object.entries(reactions).map(([emoji, users]) =>
        `<span class="reaction-badge" title="${users.join(', ')}">${emoji} ${users.length}</span>`
    ).join('');
}

// ========== FILE UPLOAD ==========
document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = '';
});

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    appendSystemMessage(`Uploading ${file.name}...`);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            const fileData = await res.json();
            ws.send(JSON.stringify({ type: 'file_message', file: fileData }));
        } else {
            const err = await res.json();
            appendSystemMessage(`Upload failed: ${err.error}`);
        }
    } catch (e) {
        console.error(e);
        appendSystemMessage('Upload failed: Network error');
    }
}

// ========== MESSAGE RENDERING ==========
function generateMessageId() {
    return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    const isOwn = msg.username === user.username;
    const msgId = msg.id || generateMessageId();

    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.dataset.messageId = msgId;
    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-info">${isOwn ? 'You' : msg.username}</div>
            <div class="message-content">${escapeHtml(msg.content)}</div>
            <button class="react-btn" onclick="showReactionPicker('${msgId}', this)" title="React">
                <i class="fas fa-smile"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendStickerMessage(msg) {
    const container = document.getElementById('chat-messages');
    const isOwn = msg.username === user.username;
    const msgId = msg.id || generateMessageId();

    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.dataset.messageId = msgId;
    div.innerHTML = `
        <div class="message-bubble sticker-bubble">
            <div class="message-info">${isOwn ? 'You' : msg.username}</div>
            <div class="sticker-display">${msg.sticker}</div>
            <button class="react-btn" onclick="showReactionPicker('${msgId}', this)" title="React">
                <i class="fas fa-smile"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendFileMessage(msg) {
    const container = document.getElementById('chat-messages');
    const isOwn = msg.username === user.username;
    const file = msg.file;
    const msgId = msg.id || generateMessageId();

    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.dataset.messageId = msgId;

    let fileContent = '';
    switch (file.fileType) {
        case 'image':
            fileContent = `<div class="file-message file-image" onclick="openLightbox('${file.url}')"><img src="${file.url}" alt="${escapeHtml(file.fileName)}" loading="lazy"></div>`;
            break;
        case 'video':
            fileContent = `<div class="file-message file-video"><video controls preload="metadata"><source src="${file.url}" type="${file.mimeType}"></video></div>`;
            break;
        case 'audio':
            fileContent = `<div class="file-message file-audio"><div class="audio-info"><i class="fas fa-music"></i> ${escapeHtml(file.fileName)}</div><audio controls preload="metadata"><source src="${file.url}" type="${file.mimeType}"></audio></div>`;
            break;
        default:
            fileContent = `<div class="file-message file-document"><a href="${file.url}" download="${escapeHtml(file.fileName)}" class="file-download"><i class="fas fa-file-download"></i><div class="file-info"><span class="file-name">${escapeHtml(file.fileName)}</span><span class="file-size">${formatFileSize(file.fileSize)}</span></div></a></div>`;
    }

    div.innerHTML = `
        <div class="message-bubble file-bubble">
            <div class="message-info">${isOwn ? 'You' : msg.username}</div>
            ${fileContent}
            <button class="react-btn" onclick="showReactionPicker('${msgId}', this)" title="React">
                <i class="fas fa-smile"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendSystemMessage(text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ========== UTILITIES ==========
function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    document.getElementById('lightbox-image').src = src;
    lightbox.classList.remove('hidden');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

document.getElementById('message-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

// Drag and drop
const chatContainer = document.querySelector('.main-content');
chatContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatContainer.classList.add('drag-over');
});

chatContainer.addEventListener('dragleave', () => {
    chatContainer.classList.remove('drag-over');
});

chatContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    chatContainer.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
});

connect();


