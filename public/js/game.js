const user = checkAuth();
const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const roomName = urlParams.get('name');

if (!roomId) window.location.href = 'dashboard.html';
document.getElementById('room-name').textContent = roomName;

let ws;
let lastGameState = null;
let celebrationShown = false;

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

    // Check if game just ended (winner changed from null to something)
    const gameJustEnded = gameState.winner && (!lastGameState || !lastGameState.winner);

    if (gameState.winner) {
        if (gameState.winner === 'draw') {
            status.textContent = "It's a Draw!";
            if (gameJustEnded && !celebrationShown) {
                showCelebration('draw');
            }
        } else {
            // Determine if current user won or lost
            const winnerSymbol = gameState.winner;
            const userSymbol = gameState.xPlayer === user.username ? 'X' :
                (gameState.oPlayer === user.username ? 'O' : null);

            status.textContent = `Winner: ${gameState.winner}!`;

            if (gameJustEnded && !celebrationShown) {
                if (userSymbol === winnerSymbol) {
                    // Current user won!
                    showCelebration('win');
                } else if (userSymbol) {
                    // Current user lost
                    showCelebration('lose');
                } else {
                    // Spectator - just show who won
                    showCelebration('spectator', winnerSymbol);
                }
            }
        }
    } else {
        celebrationShown = false; // Reset for next game
        const isMyTurn = (gameState.turn === 'X' && gameState.xPlayer === user.username) ||
            (gameState.turn === 'O' && gameState.oPlayer === user.username);

        status.textContent = isMyTurn ? "Your Turn!" : `Waiting for ${gameState.turn}...`;
    }

    lastGameState = gameState;
}

function showCelebration(type, symbol = null) {
    celebrationShown = true;
    const overlay = document.getElementById('celebration-overlay');
    const icon = document.getElementById('celebration-icon');
    const title = document.getElementById('celebration-title');
    const subtitle = document.getElementById('celebration-subtitle');
    const rainContainer = document.getElementById('rain-container');

    // Clear previous state
    overlay.className = 'celebration-overlay';
    rainContainer.innerHTML = '';

    switch (type) {
        case 'win':
            overlay.classList.add('winner');
            icon.textContent = '🏆';
            title.textContent = 'VICTORY!';
            subtitle.textContent = 'Congratulations, Champion! 🎉';
            // Trigger epic confetti
            triggerWinnerConfetti();
            break;

        case 'lose':
            overlay.classList.add('loser');
            icon.textContent = '😢';
            title.textContent = 'DEFEAT';
            subtitle.textContent = 'Better luck next time...';
            // Create rain effect
            createRainEffect(rainContainer);
            break;

        case 'draw':
            overlay.classList.add('draw');
            icon.textContent = '🤝';
            title.textContent = "IT'S A DRAW!";
            subtitle.textContent = 'A worthy opponent indeed';
            // Mild confetti
            if (window.confetti) {
                confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
            }
            break;

        case 'spectator':
            overlay.classList.add('spectator');
            icon.textContent = '👏';
            title.textContent = `${symbol} WINS!`;
            subtitle.textContent = 'Great match to watch!';
            if (window.confetti) {
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
            }
            break;
    }

    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('show'), 10);
}

function triggerWinnerConfetti() {
    if (!window.confetti) return;

    // Initial burst
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
    });

    // Side cannons
    setTimeout(() => {
        confetti({
            particleCount: 80,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 80,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });
    }, 250);

    // More bursts
    setTimeout(() => {
        confetti({
            particleCount: 100,
            spread: 100,
            origin: { y: 0.7 }
        });
    }, 500);
}

function createRainEffect(container) {
    // Create falling rain drops
    for (let i = 0; i < 50; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = Math.random() * 100 + '%';
        drop.style.animationDelay = Math.random() * 2 + 's';
        drop.style.animationDuration = (1 + Math.random()) + 's';
        container.appendChild(drop);
    }
}

function dismissCelebration() {
    const overlay = document.getElementById('celebration-overlay');
    overlay.classList.remove('show');
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.className = 'celebration-overlay hidden';
    }, 300);
}

function makeMove(index) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'game_move', index, roomId: roomId }));
    }
}

function restartGame() {
    dismissCelebration();
    celebrationShown = false;
    lastGameState = null;
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'game_restart', roomId: roomId }));
    }
}

connect();

