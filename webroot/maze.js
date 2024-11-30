let gameState = {
    username: '',
    karma: 0,
    maze: [],
    playerPosition: { x: 0, y: 0 },
    isGameOver: false
};

const DOOR_COST = 50;

function debugLog(message, data = null) {
    const debug = document.getElementById('debug');
    const text = data ? `${message}: ${JSON.stringify(data)}` : message;
    console.log(text);
    if (debug) {
        debug.textContent = text;
    }
}

window.addEventListener('message', (event) => {
    debugLog('Received message event', event.data);
    
    const message = event.data;
    if (!message || !message.type) {
        debugLog('Invalid message received');
        return;
    }
    
    switch (message.type) {
        case 'initialData':
            if (!message.data) {
                debugLog('No data in initialData message');
                return;
            }
            debugLog('Initializing game with data', message.data);
            initializeGame(message.data);
            break;
        case 'updateKarma':
            debugLog('Updating karma', message.data);
            updateKarma(message.data.karma);
            break;
        default:
            debugLog('Unknown message type', message.type);
    }
});

function initializeGame(data) {
    debugLog('InitializeGame called with:', data);

    if (!data.maze) {
        debugLog('No maze data received');
        return;
    }

    gameState = {
        username: data.username || 'Developer',
        karma: data.karma || 1000,
        maze: data.maze,
        playerPosition: findStartPosition(data.maze),
        isGameOver: false
    };

    debugLog('Game state initialized:', gameState);

    document.getElementById('username').textContent = gameState.username;
    document.getElementById('karma').textContent = gameState.karma;
    
    renderMaze();
}

function findStartPosition(maze) {
    for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
            if (maze[y][x] === 'start') {
                return { x, y };
            }
        }
    }
    return { x: 0, y: 0 };
}

function renderMaze() {
    const grid = document.getElementById('maze-grid');
    if (!gameState.maze || !gameState.maze[0]) {
        debugLog('No maze data available to render');
        return;
    }

    grid.style.gridTemplateColumns = `repeat(${gameState.maze[0].length}, 40px)`;
    grid.innerHTML = '';

    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.createElement('div');
            cellElement.className = `cell ${cell}`;
            
            if (y === gameState.playerPosition.y && x === gameState.playerPosition.x) {
                cellElement.classList.add('player');
            }

            cellElement.onclick = () => handleCellClick(x, y);
            grid.appendChild(cellElement);
        });
    });
}

function handleCellClick(x, y) {
    if (gameState.isGameOver) return;

    const dx = Math.abs(x - gameState.playerPosition.x);
    const dy = Math.abs(y - gameState.playerPosition.y);
    
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        const targetCell = gameState.maze[y][x];

        if (targetCell === 'path' || targetCell === 'start') {
            movePlayer(x, y);
        } else if (targetCell === 'door' && gameState.karma >= DOOR_COST) {
            unlockDoor(x, y);
        } else if (targetCell === 'exit') {
            handleWin();
        }
    }
}

function movePlayer(x, y) {
    gameState.playerPosition = { x, y };
    renderMaze();

    window.parent.postMessage({
        type: 'movePlayer',
        data: { position: { x, y } }
    }, '*');
}

function unlockDoor(x, y) {
    gameState.karma -= DOOR_COST;
    gameState.maze[y][x] = 'path';
    document.getElementById('karma').textContent = gameState.karma;
    renderMaze();

    window.parent.postMessage({
        type: 'unlockDoor',
        data: { 
            position: { x, y },
            karmaSpent: DOOR_COST
        }
    }, '*');
}

function handleWin() {
    gameState.isGameOver = true;
    showMessage('Congratulations! You reached the exit!', 'success');

    window.parent.postMessage({
        type: 'gameOver',
        data: { 
            won: true,
            remainingKarma: gameState.karma
        }
    }, '*');
}

function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = type;
    messageEl.style.display = 'block';
}

// Initialize once the page is loaded
window.addEventListener('load', () => {
    debugLog('Page loaded and ready');
    renderMaze();
    window.parent.postMessage({ type: 'ready' }, '*');
});