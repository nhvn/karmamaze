let initializationAttempts = 0;
const MAX_ATTEMPTS = 5;

let gameState = {
    keys: 0,
    maze: [], // Initialize with an empty maze or appropriate value
    playerPosition: { x: 0, y: 0 }, // Placeholder for the start position
    isGameOver: false,
    visibleTiles: new Set(),
    exploredTiles: new Set(),
    crystalBallUsed: false
};


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
    if (!gameState.maze || !gameState.visibleTiles) return;  // Add safety check
    
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

// PRODUCTION MODE - use this instead
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
//             gameState.exploredTiles.add(`${newX},${newY}`);  // Add to explored tiles
//         }
//     });

//     // Update visibility classes for all tiles
//     gameState.maze.forEach((row, y) => {
//         row.forEach((cell, x) => {
//             const cellElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
//             if (cellElement) {
//                 const key = `${x},${y}`;
                
//                 // Always show powerups with glow
//                 if (cell === 'crystal-ball') {
//                     cellElement.classList.add('powerup-glow');
//                 }

//                 if (newVisible.has(key)) {
//                     cellElement.classList.remove('fog', 'explored');
//                     cellElement.classList.add('visible');
//                 } else if (gameState.exploredTiles.has(key)) {
//                     cellElement.classList.remove('fog', 'visible');
//                     cellElement.classList.add('explored');
//                 } else {
//                     cellElement.classList.remove('visible', 'explored');
//                     cellElement.classList.add('fog');
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
        case 'updateKeys':  // Changed from updateKarma
            log('Updating keys:', message.data);
            updateKeys(message.data.keys);  // Changed from karma
            break;
        default:
            log('Unknown message type:', message.type);
    }
});

// Add keyboard controls
window.addEventListener('keydown', (event) => {
    if (gameState.isGameOver) return;

    let newX = gameState.playerPosition.x;
    let newY = gameState.playerPosition.y;

    // Handle both WASD and arrow keys
    switch (event.key.toLowerCase()) {
        case 'w':
        // case 'arrowup':
            newY--;
            break;
        case 's':
        // case 'arrowdown':
            newY++;
            break;
        case 'a':
        // case 'arrowleft':
            newX--;
            break;
        case 'd':
        // case 'arrowright':
            newX++;
            break;
        default:
            return; // Exit for any other key
    }

    // Check if the new position is valid
    if (newX >= 0 && newX < gameState.maze[0].length && 
        newY >= 0 && newY < gameState.maze.length) {
        const targetCell = gameState.maze[newY][newX];

        if (targetCell === 'crystal-ball') {
            // First move the player
            movePlayer(newX, newY);
            // Then activate the crystal ball and remove it
            activateCrystalBall();
            gameState.maze[newY][newX] = 'path';
            renderMaze();
        } else if (targetCell === 'path' || targetCell === 'start') {
            movePlayer(newX, newY);
        } else if (targetCell === 'door' && gameState.keys > 0) {
            unlockDoor(newX, newY);
        } else if (targetCell === 'exit' || targetCell === 'fake-exit') {
            if (targetCell === 'exit') {
                handleWin();
            } else {
                handleTrap();
            }
        }
    }
});

let initialMaze = null; // Store initial maze for retry

function initializeGame(data) {
    log('Initializing game with data:', data);

    if (!data.maze) {
        log('No maze data received');
        return;
    }

    // Store initial maze when first received
    initialMaze = JSON.parse(JSON.stringify(data.maze)); // Deep copy

    // Clear any existing win message
    const messageEl = document.getElementById('message');
    messageEl.style.display = 'none';
    messageEl.textContent = '';

    gameState = {
        username: data.username || 'Developer',
        keys: 2,
        maze: data.maze,
        playerPosition: findStartPosition(data.maze),
        isGameOver: false,
        visibleTiles: new Set(),
        exploredTiles: new Set(),
        crystalBallUsed: false
    };

    document.getElementById('username').textContent = gameState.username;
    document.getElementById('keys').textContent = gameState.keys;
    
    renderMaze();
    updateVisibility();
}

function retryLevel() {
    // Reset game state with the same maze
    console.log('Retry button clicked');
    gameState = {
        ...gameState,
        keys: 2,
        maze: JSON.parse(JSON.stringify(initialMaze)), // Deep copy of initial maze
        playerPosition: findStartPosition(initialMaze),
        isGameOver: false,
        visibleTiles: new Set(),
        exploredTiles: new Set(),
        crystalBallUsed: false  // Reset crystal ball flag
    };

    // Clear any messages
    const messageEl = document.getElementById('message');
    messageEl.style.display = 'none';
    messageEl.textContent = '';

    // Update display
    document.getElementById('keys').textContent = gameState.keys;
    renderMaze();
    updateVisibility();
}

function newGame() {
    console.log('New Game button clicked');
    window.parent.postMessage({
        type: 'newGame'
    }, '*');
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
            cellElement.className = `cell ${cell} fog`;
            cellElement.dataset.x = x;
            cellElement.dataset.y = y;
            
            // Only show green exit if crystal ball was used
            if (cell === 'exit' && gameState.crystalBallUsed) { // We'll add this flag
                cellElement.classList.add('exit1');
                cellElement.classList.add('revealed-exit');
                // cellElement.classList.add('fake-exit1');
            }

            // Check if it's a fake exit cell
            if (cell === 'fake-exit' && gameState.crystalBallUsed) {
                cellElement.classList.add('fake-exit1'); // Fake exit revealed with red
            }

            if (y === gameState.playerPosition.y && x === gameState.playerPosition.x) {
                cellElement.classList.add('player');
            }

            cellElement.onclick = () => handleCellClick(x, y);
            grid.appendChild(cellElement);
        });
    });

    updateVisibility();
}

function handleCellClick(x, y) {
    // log(`Cell clicked at: x=${x}, y=${y}`);
    if (gameState.isGameOver) return;
    
    const key = `${x},${y}`;
    if (!gameState.visibleTiles.has(key)) return;

    const dx = Math.abs(x - gameState.playerPosition.x);
    const dy = Math.abs(y - gameState.playerPosition.y);
    
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        const targetCell = gameState.maze[y][x];

        if (targetCell === 'crystal-ball') {
            // First move the player
            movePlayer(x, y);
            // Then activate the crystal ball and remove it
            activateCrystalBall();
            gameState.maze[y][x] = 'path';
            renderMaze();
        } else if (targetCell === 'path' || targetCell === 'start') {
            movePlayer(x, y);
        } else if (targetCell === 'door' && gameState.keys > 0) {
            unlockDoor(x, y);
        } else if (targetCell === 'exit' || targetCell === 'fake-exit') {
            if (targetCell === 'exit') {
                handleWin();
            } else {
                handleTrap();
            }
        }
    }
}

function activateCrystalBall() {
    gameState.crystalBallUsed = true;  // Set the flag
    // Find and reveal the true exit
    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === 'exit') {
                const exitCell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                if (exitCell) {
                    // exitCell.style.background = 'rgba(0, 255, 0, 0.9)';
                    exitCell.classList.add('revealed-exit');
                    gameState.visibleTiles.add(`${x},${y}`);
                }
            }
        });
    });

    showMessage('Crystal ball revealed the true exit!', 'success');
    setTimeout(() => {
        document.getElementById('message').style.display = 'none';
    }, 2000);
}

function handleTrap() {
    gameState.isGameOver = true;
    showMessage('Oh no, it\'s a trap!', 'error', true);  // Added true parameter for permanent message
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
    if (gameState.keys <= 0) {
        showMessage('No keys remaining!', 'error');  // Add error message
        return;  // Don't proceed if no keys
    }

    gameState.keys--;
    gameState.maze[y][x] = 'path';
    const keysEl = document.getElementById('keys');  // Changed from karma to keys
    if (keysEl) {
        keysEl.textContent = gameState.keys;
    }
    renderMaze();

    window.parent.postMessage({
        type: 'unlockDoor',
        data: { 
            position: { x, y }
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
    showMessage('You win!', 'success');
    document.getElementById('retryButton').style.display = 'block';

    window.parent.postMessage({
        type: 'gameOver',
        data: { 
            won: true,
            remainingKeys: gameState.keys  // Changed from karma to keys
        }
    }, '*');
}

function showMessage(text, type, permanent = false) {
    const messageEl = document.getElementById('message');
    
    // Clear existing content
    messageEl.innerHTML = '';
    
    // Add text
    const textDiv = document.createElement('div');
    textDiv.textContent = text;
    messageEl.appendChild(textDiv);
    
    // Add button if it's a trap message
    if (type === 'error' && permanent) {
        const button = document.createElement('button');
        button.textContent = 'Try Again';
        button.onclick = () => {
            retryLevel();
            messageEl.style.display = 'none';
        };
        button.style.marginTop = '10px';
        button.style.padding = '8px 16px';
        button.style.background = '#4a4a4a';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        messageEl.appendChild(button);
    }
    
    messageEl.className = type;
    messageEl.style.display = 'block';
    
    // Only auto-hide non-permanent messages
    if (!permanent && type === 'error') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 2000);
    }
}

function updateKeys(newKeys) {
    gameState.keys = newKeys;
    const keysEl = document.getElementById('keys');  // Changed from karma to keys
    if (keysEl) {
        keysEl.textContent = newKeys;
    }
}

// Add this with your other initialization code
window.addEventListener('load', () => {
    log('Page loaded, sending ready message');
    sendReadyMessage();
    renderMaze();

    // Make sure retry button uses retryLevel not retryGame
    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            retryLevel();  // Use retryLevel function
            const messageEl = document.getElementById('message');
            if (messageEl) {
                messageEl.style.display = 'none';  // Hide the message after retry
            }
        });
    }

    const newGameButton = document.getElementById('newGameButton');
    if (newGameButton) {
        newGameButton.addEventListener('click', newGame);
    }
});