let initializationAttempts = 0;
const MAX_ATTEMPTS = 5;

let gameState = {
    username: '',
    keys: 1,
    maze: [],
    playerPosition: { x: 0, y: 0 },
    isGameOver: false,
    visibleTiles: new Set(),
    exploredTiles: new Set(),
    crystalBallUsed: false,
    doorHits: new Map(),
    doorOpacity: new Map()
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

    switch (event.key.toLowerCase()) {
        case 'w':
            newY--;
            break;
        case 's':
            newY++;
            break;
        case 'a':
            newX--;
            break;
        case 'd':
            newX++;
            break;
        default:
            return;
    }

    if (newX >= 0 && newX < gameState.maze[0].length && 
        newY >= 0 && newY < gameState.maze.length) {
        const targetCell = gameState.maze[newY][newX];

        if (targetCell === 'crystal-ball') {
            movePlayer(newX, newY);
            activateCrystalBall();
            gameState.maze[newY][newX] = 'path';
            renderMaze();
        } else if (targetCell === 'path' || targetCell === 'start' || targetCell === 'exit' || targetCell === 'fake-exit') {
            movePlayer(newX, newY);
            // Check if we should trigger end game after moving to exit
            if ((targetCell === 'exit' || targetCell === 'fake-exit') && 
                newX === gameState.maze[0].length - 1) { // Only trigger if at rightmost edge
                if (targetCell === 'exit') {
                    handleWin();
                } else {
                    handleTrap();
                }
            }
        } else if (targetCell === 'door') {
            handleDoor(newX, newY);
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

    // Update existing gameState instead of creating new one
    gameState.username = data.username || 'Developer';
    gameState.keys = 1;
    gameState.maze = data.maze;
    gameState.playerPosition = findStartPosition(data.maze);
    gameState.isGameOver = false;
    gameState.visibleTiles = new Set();
    gameState.exploredTiles = new Set();
    gameState.crystalBallUsed = false;
    gameState.doorHits = new Map();
    gameState.doorOpacity = new Map();

    document.getElementById('username').textContent = gameState.username;
    document.getElementById('keys').textContent = gameState.keys;
    
    renderMaze();
    updateVisibility();
}

function retryLevel() {
    gameState = {
        ...gameState,
        keys: 1,
        maze: JSON.parse(JSON.stringify(initialMaze)),
        playerPosition: findStartPosition(initialMaze),
        isGameOver: false,
        visibleTiles: new Set(),
        exploredTiles: new Set(),
        crystalBallUsed: false,
        doorHits: new Map(),  // Reset door hits
        doorOpacity: new Map(),
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
            
            // Apply stored opacity for doors
            if (cell === 'door') {
                const doorKey = `${x},${y}`;
                const opacity = gameState.doorOpacity.get(doorKey);
                if (opacity !== undefined) {
                    cellElement.style.opacity = opacity;
                }
            }
            
            // Rest of your existing render logic...
            if (cell === 'exit' && gameState.crystalBallUsed) {
                cellElement.classList.add('exit1');
                cellElement.classList.add('revealed-exit');
            }

            if (cell === 'fake-exit' && gameState.crystalBallUsed) {
                cellElement.classList.add('fake-exit1');
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

function handleDoor(x, y) {
    if (gameState.keys > 0) {
        unlockDoor(x, y);
        return;
    }

    // Get or initialize hit count for this door
    const doorKey = `${x},${y}`;
    const hits = gameState.doorHits.get(doorKey) || 0;
    gameState.doorHits.set(doorKey, hits + 1);

    // Calculate opacity (from 1 to 0.3)
    const opacity = 1 - ((hits + 1) / 12) * 0.7;
    gameState.doorOpacity.set(doorKey, opacity);

    // Shake the door
    const doorElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (doorElement) {
        doorElement.classList.add('shaking');
        doorElement.style.opacity = opacity;
        
        setTimeout(() => {
            doorElement.classList.remove('shaking');
        }, 100);
    }

    // Break door after 12 hits
    if (hits + 1 >= 12) {
        gameState.maze[y][x] = 'path';
        gameState.doorHits.delete(doorKey);
        gameState.doorOpacity.delete(doorKey);
        // showMessage('Door broken!', 'success');
        renderMaze();
    } else {
        // showMessage(`Door weakening... (${12 - (hits + 1)} more hits needed)`, 'error');
    }
}

// Add this helper function for color interpolation
function interpolateColor(startColor, endColor, percentage) {
    // Convert hex to RGB
    const start = {
        r: parseInt(startColor.slice(1,3), 16),
        g: parseInt(startColor.slice(3,5), 16),
        b: parseInt(startColor.slice(5,7), 16)
    };
    
    const end = {
        r: parseInt(endColor.slice(1,3), 16),
        g: parseInt(endColor.slice(3,5), 16),
        b: parseInt(endColor.slice(5,7), 16)
    };

    // Interpolate
    const r = Math.round(start.r + (end.r - start.r) * percentage);
    const g = Math.round(start.g + (end.g - start.g) * percentage);
    const b = Math.round(start.b + (end.b - start.b) * percentage);

    // Convert back to hex
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

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

    // Update existing gameState instead of creating new one
    gameState.username = data.username || 'Developer';
    gameState.keys = 1;
    gameState.maze = data.maze;
    gameState.playerPosition = findStartPosition(data.maze);
    gameState.isGameOver = false;
    gameState.visibleTiles = new Set();
    gameState.exploredTiles = new Set();
    gameState.crystalBallUsed = false;
    gameState.doorHits = new Map();
    gameState.doorOpacity = new Map();

    document.getElementById('username').textContent = gameState.username;
    document.getElementById('keys').textContent = gameState.keys;
    
    renderMaze();
    updateVisibility();
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