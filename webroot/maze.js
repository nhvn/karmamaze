let initializationAttempts = 0;
const MAX_ATTEMPTS = 5;

let gameState = {
    username: '',
    karma: 0,
    maze: [],
    playerPosition: { x: 0, y: 0 },
    isGameOver: false
};

const DOOR_COST = 50;

function log(message, data = null) {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(logMessage);
    const debug = document.getElementById('debug');
    if (debug) {
        debug.textContent = logMessage;
    }
}

// DEVELOPMENT MODE - show everything
function updateVisibility() {
    gameState.maze.forEach((row, y) => {
        row.forEach((_, x) => {
            const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                cell.classList.remove('fog', 'explored');
                cell.classList.add('visible');
                gameState.visibleTiles.add(`${x},${y}`);
            }
        });
    });
}

// PRODUCTION MODE - fog activated
// function updateVisibility() {
//     const { x, y } = gameState.playerPosition;
//     const newVisible = new Set();
    
//     // Add current position and adjacent tiles to visible set
//     [
//         [0, 0],   // Current tile
//         [0, 1],   // Right
//         [0, -1],  // Left
//         [1, 0],   // Down
//         [-1, 0],  // Up
//         [1, 1],   // Bottom-right
//         [1, -1],  // Bottom-left
//         [-1, 1],  // Top-right
//         [-1, -1]  // Top-left
//     ].forEach(([dx, dy]) => {
//         const newX = x + dx;
//         const newY = y + dy;
//         if (newX >= 0 && newX < gameState.maze[0].length && 
//             newY >= 0 && newY < gameState.maze.length) {
//             newVisible.add(`${newX},${newY}`);
//         }
//     });


//     gameState.maze.forEach((row, y) => {
//         row.forEach((_, x) => {
//             const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
//             if (cell) {
//                 const key = `${x},${y}`;
//                 cell.classList.remove('fog', 'explored', 'visible');
//                 if (newVisible.has(key)) {
//                     cell.classList.add('visible');
//                 } else {
//                     cell.classList.add('fog');
//                 }
//             }
//         });
//     });

//     gameState.visibleTiles = newVisible;
// }

function sendReadyMessage() {
    if (initializationAttempts >= MAX_ATTEMPTS) {
        log('Max initialization attempts reached');
        return;
    }

    log('Sending ready message, attempt:', initializationAttempts + 1);
    window.parent.postMessage({ type: 'ready' }, '*');
    
    // Try again in a second if we haven't received data
    setTimeout(() => {
        if (!gameState.maze || gameState.maze.length === 0) {
            initializationAttempts++;
            sendReadyMessage();
        }
    }, 1000);
}

window.addEventListener('message', (event) => {
    log('Received message:', event.data);
    
    const message = event.data?.data?.message || event.data;
    if (!message || !message.type) {
        log('Invalid message received:', message);
        return;
    }
    
    switch (message.type) {
        case 'initialData':
            if (!message.data || !message.data.maze) {
                log('No maze data in message:', message);
                return;
            }
            log('Initializing game with data:', message.data);
            initializeGame(message.data);
            break;
        case 'updateKarma':
            log('Updating karma:', message.data);
            updateKarma(message.data.karma);
            break;
        default:
            log('Unknown message type:', message.type);
    }
});

// Add to initializeGame function
function initializeGame(data) {
    log('Initializing game with data:', data);

    if (!data.maze) {
        log('No maze data received');
        return;
    }

    // Clear any existing win message
    const messageEl = document.getElementById('message');
    messageEl.style.display = 'none';
    messageEl.textContent = '';

    gameState = {
        username: data.username || 'Developer',
        karma: data.karma || 1000,
        maze: data.maze,
        playerPosition: findStartPosition(data.maze),
        isGameOver: false,
        exploredTiles: new Set(),
        visibleTiles: new Set()
    };

    document.getElementById('username').textContent = gameState.username;
    document.getElementById('karma').textContent = gameState.karma;
    
    renderMaze();
    updateVisibility();
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
        log('No maze data available to render');
        return;
    }

    log('Rendering maze');
    grid.style.gridTemplateColumns = `repeat(${gameState.maze[0].length}, 40px)`;
    grid.innerHTML = '';

    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.createElement('div');
            cellElement.className = `cell ${cell} fog`; // Start with fog
            cellElement.dataset.x = x;
            cellElement.dataset.y = y;
            
            if (y === gameState.playerPosition.y && x === gameState.playerPosition.x) {
                cellElement.classList.add('player');
            }

            cellElement.onclick = () => handleCellClick(x, y);
            grid.appendChild(cellElement);
        });
    });

    // Update visibility after rendering
    updateVisibility();
}

function handleCellClick(x, y) {
    if (gameState.isGameOver) return;
    
    const key = `${x},${y}`;
    if (!gameState.visibleTiles.has(key)) return; // Can't click fog of war tiles

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
    updateVisibility();

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

function retryGame() {
    // Send retry message to parent
    window.parent.postMessage({
        type: 'retry'
    }, '*');
}

function handleWin() {
    gameState.isGameOver = true;
    showMessage('Congratulations! You reached the exit!', 'success');
    document.getElementById('retryButton').style.display = 'block';

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

function updateKarma(newKarma) {
    gameState.karma = newKarma;
    document.getElementById('karma').textContent = newKarma;
}



// Add this with your other initialization code
window.addEventListener('load', () => {
    log('Page loaded, sending ready message');
    sendReadyMessage();
    renderMaze();

    // Add retry button event listener
    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            window.parent.postMessage({
                type: 'retry'
            }, '*');
        });
    }
});