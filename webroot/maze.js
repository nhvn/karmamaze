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

console.log(gameState); // Ensure it has a `keys` property



function log(message, data = null) {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(logMessage);
    const debug = document.getElementById('debug');
    if (debug) {
        debug.textContent = logMessage;
    }
}

// DEVELOPMENT MODE - show everything
// function updateVisibility() {
//     if (!gameState.maze || !gameState.visibleTiles) return;  // Add safety check
    
//     gameState.maze.forEach((row, y) => {
//         row.forEach((_, x) => {
//             const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
//             if (cell) {
//                 cell.classList.remove('fog', 'explored');
//                 cell.classList.add('visible');
//                 gameState.visibleTiles.add(`${x},${y}`);
//             }
//         });
//     });
// }

// PRODUCTION MODE - use this instead
function updateVisibility() {
    const { x, y } = gameState.playerPosition;
    const newVisible = new Set();
    const viewRadius = gameState.mapUsed ? 2 : 1; // 2 gives 5x5, 1 gives 3x3
    
    // Add current position and adjacent tiles to visible set
    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX < gameState.maze[0].length && 
                newY >= 0 && newY < gameState.maze.length) {
                newVisible.add(`${newX},${newY}`);
                // Only add to explored tiles if map is active
                if (gameState.level === 1 || gameState.mapUsed) {
                    gameState.exploredTiles.add(`${newX},${newY}`);
                }
            }
        }
    }

    // Update visibility classes for all tiles
    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cellElement) {
                const key = `${x},${y}`;
                
                // Always show powerups with glow
                if (cell === 'crystal-ball' || cell === 'map' || cell === 'key-powerup') {
                    cellElement.classList.add('powerup-glow');
                }

                if (newVisible.has(key)) {
                    cellElement.classList.remove('fog', 'explored');
                    cellElement.classList.add('visible');
                } else if ((gameState.level === 1 || gameState.mapUsed) && gameState.exploredTiles.has(key)) {
                    // Show explored tiles if in Level 1 or if map is active in Level 2
                    cellElement.classList.remove('fog', 'visible');
                    cellElement.classList.add('explored');
                } else {
                    cellElement.classList.remove('visible', 'explored');
                    cellElement.classList.add('fog');
                }
            }
        });
    });

    gameState.visibleTiles = newVisible;
}

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

        // Combine all powerup cases together
        if (targetCell === 'crystal-ball') {
            movePlayer(newX, newY);
            activateCrystalBall();
            gameState.maze[newY][newX] = 'path';
            renderMaze();
        } else if (targetCell === 'map') {
            movePlayer(newX, newY);
            activateMap();
            gameState.maze[newY][newX] = 'path';
            renderMaze();
        } else if (targetCell === 'key-powerup') {
            movePlayer(newX, newY);
            activateKeyPowerup();
            gameState.maze[newY][newX] = 'path';
            renderMaze();
        } else if (targetCell === 'path' || targetCell === 'start' || targetCell === 'exit' || targetCell === 'fake-exit') {
            movePlayer(newX, newY);
            // Check if we should trigger end game after moving to exit
            if ((targetCell === 'exit' || targetCell === 'fake-exit') && 
                newX === gameState.maze[0].length - 1) {
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
    
    gameState.level = data.level;

    if (!data.maze) {
        log('No maze data received');
        return;
    }

    // Store initial maze when first received
    initialMaze = JSON.parse(JSON.stringify(data.maze));

    // Clear any existing win message
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.style.display = 'none';
        messageEl.textContent = '';
    }

    // Update existing gameState instead of creating new one
    gameState.username = data.username || 'Developer';
    gameState.keys = 1;
    gameState.maze = data.maze;
    gameState.playerPosition = findStartPosition(data.maze);
    gameState.isGameOver = false;
    gameState.visibleTiles = new Set();
    gameState.exploredTiles = new Set();
    gameState.crystalBallUsed = false;
    gameState.mapUsed = false;  // Add this line
    gameState.doorHits = new Map();
    gameState.doorOpacity = new Map();

    // Update UI elements safely
    const usernameEl = document.getElementById('username');
    const keysEl = document.getElementById('keys');
    const retryButton = document.getElementById('retryButton');
    
    if (usernameEl) {
        usernameEl.textContent = gameState.username;
    }
    
    if (keysEl) {
        keysEl.textContent = gameState.keys;
    }

    if (retryButton) {
        retryButton.style.display = 'none';
    }
    
    renderMaze();
    updateVisibility();
}

function retryLevel() {
    const messageEl = document.getElementById('message');
    const retryButton = document.getElementById('retryButton');

    const mapIndicator = document.getElementById('map-indicator');
    const crystalIndicator = document.getElementById('crystal-indicator');
    const keyStat = document.querySelector('.key-stat');

    if (mapIndicator) mapIndicator.style.display = 'none';
    if (crystalIndicator) crystalIndicator.style.display = 'none';
    if (keyStat) keyStat.dataset.count = '1';

    if (messageEl) {
        messageEl.style.display = 'none';
    }

    if (retryButton) {
        retryButton.style.display = 'none';
    }

    gameState = {
        ...gameState,
        keys: 1,
        maze: JSON.parse(JSON.stringify(initialMaze)),
        playerPosition: findStartPosition(initialMaze),
        isGameOver: false,
        visibleTiles: new Set(),
        exploredTiles: new Set(),
        crystalBallUsed: false,
        doorHits: new Map(),
        doorOpacity: new Map(),
        mapUsed: false
    };

    const keysEl = document.getElementById('keys');
    if (keysEl) {
        keysEl.textContent = gameState.keys;
    }

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

    gameState.level = data.level;

    if (!data.maze) {
        log('No maze data received');
        return;
    }

    // Store initial maze when first received
    initialMaze = JSON.parse(JSON.stringify(data.maze)); // Deep copy

    // Clear any existing win message
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.style.display = 'none';
        messageEl.textContent = '';
    } else {
        console.warn('Element with ID "message" not found.');
    }

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

    // Add safety checks for DOM elements
    const usernameEl = document.getElementById('username');
    const keysEl = document.getElementById('keys');
    
    if (usernameEl) {
        usernameEl.textContent = gameState.username;
    } else {
        console.warn('Element with ID "username" not found.');
    }
    
    if (keysEl) {
        keysEl.textContent = gameState.keys;
    } else {
        console.warn('Element with ID "keys" not found.');
    }
    
    renderMaze();
    updateVisibility();
}

function showTopRightMessage(message) {
    const messageContainer = document.getElementById('top-right-messages');

    // Create a new message element
    const messageEl = document.createElement('div');
    messageEl.classList.add('top-right-message');
    messageEl.textContent = message;

    // Append the message to the container
    messageContainer.appendChild(messageEl);

    // Start fade-out after a delay
    setTimeout(() => {
        messageEl.classList.add('fade-out');
    }, 2000); // Show message for 2 seconds

    // Remove the message completely after fade-out transition
    setTimeout(() => {
        messageEl.remove();
    }, 2300); // Matches fade-out duration (2s display + 0.3s fade)
}

// Updated functions with the new message display
function activateMap() {
    gameState.mapUsed = true;
    
    // Show map indicator
    const mapIndicator = document.getElementById('map-indicator');
    if (mapIndicator) {
        mapIndicator.style.display = 'flex';
    }
    const { x, y } = gameState.playerPosition;
    const viewRadius = 2;

    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const newX = x + dx;
            const newY = y + dy;

            if (newX >= 0 && newX < gameState.maze[0].length &&
                newY >= 0 && newY < gameState.maze.length) {
                const key = `${newX},${newY}`;
                gameState.visibleTiles.add(key);
                gameState.exploredTiles.add(key);

                const cell = document.querySelector(`[data-x="${newX}"][data-y="${newY}"]`);
                if (cell) {
                    cell.classList.remove('fog');
                    cell.classList.add('visible');
                }
            }
        }
    }

    showTopRightMessage('Map revealed surrounding area!');
}


function activateCrystalBall() {
    gameState.crystalBallUsed = true;
    
    // Show crystal ball indicator
    const crystalIndicator = document.getElementById('crystal-indicator');
    if (crystalIndicator) {
        crystalIndicator.style.display = 'flex';
    }

    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === 'exit') {
                const exitCell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                if (exitCell) {
                    exitCell.classList.add('revealed-exit');
                    gameState.visibleTiles.add(`${x},${y}`);
                }
            }
        });
    });

    showTopRightMessage('Crystal ball revealed the true exit!');
}

function activateKeyPowerup() {
    gameState.keys += 3;  // Add 3 keys
    
    // Update the keys display
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
        }
    }
    
    showTopRightMessage('Found 3 additional keys!');
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
        showMessage('No keys remaining!', 'error');
        return;
    }

    gameState.keys--;
    gameState.maze[y][x] = 'path';
    updateKeys(gameState.keys);  // Update this to use updateKeys function
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
    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
        retryButton.style.display = 'block';
    }

    window.parent.postMessage({
        type: 'gameOver',
        data: { 
            won: true,
            remainingKeys: gameState.keys
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
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        // Update the count
        keyStat.dataset.count = newKeys;
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = newKeys;
        }

        // Show/hide based on key count
        if (newKeys <= 0) {
            keyStat.classList.add('hidden');
        } else {
            keyStat.classList.remove('hidden');
        }
    }
}

window.addEventListener('load', () => {
    log('Page loaded, sending ready message');
    sendReadyMessage();
    renderMaze();

    const retryButton = document.getElementById('retryButton');
    const newGameButton = document.getElementById('newGameButton');

    if (retryButton) {
        // Remove any existing listeners first
        retryButton.replaceWith(retryButton.cloneNode(true));
        const newRetryButton = document.getElementById('retryButton');
        newRetryButton.addEventListener('click', () => {
            retryLevel();
            const messageEl = document.getElementById('message');
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        });
    }

    if (newGameButton) {
        // Remove any existing listeners first
        newGameButton.replaceWith(newGameButton.cloneNode(true));
        const newGameBtn = document.getElementById('newGameButton');
        newGameBtn.addEventListener('click', newGame);
    }
});