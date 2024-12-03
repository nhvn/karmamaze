let initializationAttempts = 0;
const MAX_ATTEMPTS = 5;
let timerInterval;
const GAME_TIME = 30;

let gameState = {
    username: '',
    keys: 2,
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
//     const viewRadius = gameState.mapUsed ? 2 : 1; // 2 gives 5x5, 1 gives 3x3
    
//     // Add current position and adjacent tiles to visible set
//     for (let dy = -viewRadius; dy <= viewRadius; dy++) {
//         for (let dx = -viewRadius; dx <= viewRadius; dx++) {
//             const newX = x + dx;
//             const newY = y + dy;
//             if (newX >= 0 && newX < gameState.maze[0].length && 
//                 newY >= 0 && newY < gameState.maze.length) {
//                 newVisible.add(`${newX},${newY}`);
//                 // Only add to explored tiles if map is active
//                 if (gameState.level === 1 || gameState.mapUsed) {
//                     gameState.exploredTiles.add(`${newX},${newY}`);
//                 }
//             }
//         }
//     }

//     // Update visibility classes for all tiles
//     gameState.maze.forEach((row, y) => {
//         row.forEach((cell, x) => {
//             const cellElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
//             if (cellElement) {
//                 const key = `${x},${y}`;
                
//                 // Always show powerups with glow
//                 if (cell === 'crystal-ball' || cell === 'map' || cell === 'key-powerup') {
//                     cellElement.classList.add('powerup-glow');
//                 }

//                 if (newVisible.has(key)) {
//                     cellElement.classList.remove('fog', 'explored');
//                     cellElement.classList.add('visible');
//                 } else if ((gameState.level === 1 || gameState.mapUsed) && gameState.exploredTiles.has(key)) {
//                     // Show explored tiles if in Level 1 or if map is active in Level 2
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
    showLoading();
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
    gameState.keys = 2;
    gameState.maze = data.maze;
    gameState.playerPosition = findStartPosition(data.maze);
    gameState.isGameOver = false;
    gameState.visibleTiles = new Set();
    gameState.exploredTiles = new Set();
    gameState.crystalBallUsed = false;
    gameState.mapUsed = false;
    gameState.doorHits = new Map();
    gameState.doorOpacity = new Map();

    // Update UI elements safely
    const usernameEl = document.getElementById('username');
    const keyStat = document.querySelector('.key-stat');
    
    if (usernameEl) {
        usernameEl.textContent = gameState.username;
    }
    
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
        }
    }
    
    renderMaze();
    updateVisibility();
    startTimer();
    hideLoading();
}

// Add loading functions
function showLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Add timer functionality
function startTimer() {
    let timeLeft = GAME_TIME;
    
    function updateTimer() {
        const timerDisplay = document.getElementById('timer');
        if (timerDisplay) {
            timerDisplay.textContent = timeLeft.toString();
        }
        
        if (timeLeft === 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
        timeLeft--;
    }
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
}

function handleTimeUp() {
    gameState.isGameOver = true;
    const messageEl = document.getElementById('message');
    messageEl.innerHTML = '';
    messageEl.dataset.gameWon = 'false';
    messageEl.dataset.gameRetry = 'true';
    
    const textDiv = document.createElement('div');
    textDiv.textContent = "Time's up! You've been caught!";
    messageEl.appendChild(textDiv);
    
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Try Again (Or Press Enter)';
    retryButton.onclick = () => {
        retryLevel();
        clearGameEndState();
    };
    messageEl.appendChild(retryButton);
    
    messageEl.className = 'error';
    messageEl.style.display = 'block';
}

// Add keyboard listener for Enter key
window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const messageEl = document.getElementById('message');
        if (!messageEl || messageEl.style.display === 'none') return;
        
        if (gameState.isGameOver && messageEl.dataset.gameWon === 'true') {
            handleNextGame();
            return;
        }
        
        if (gameState.isGameOver && messageEl.dataset.gameRetry === 'true') {
            retryLevel();
            messageEl.style.display = 'none';
            return;
        }
    }
});

function clearGameEndState() {
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.style.display = 'none'; // Hide the game-over message
        messageEl.innerHTML = ''; // Clear its content
    }

    // Reset other game-related states if needed
    gameState.isGameOver = false; 
    console.log('Game end state cleared.');
}

function retryLevel() {
    showLoading();
    clearGameEndState();
    const messageEl = document.getElementById('message');

    if (messageEl) {
        messageEl.style.display = 'none';
    }

    gameState = {
        ...gameState,
        keys: 2,
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

    // Update UI
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
        }
    }

    renderMaze();
    updateVisibility();
    startTimer();
    hideLoading();
}

function newGame() {
    console.log('New Game button clicked');
    showLoading(); // Show loading indicator before sending the new game request
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
    markAdjacentCells();
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

    showTopRightMessage('Found a map!');
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

    showTopRightMessage('Found a crystal ball!');
}

function activateKeyPowerup() {
    gameState.keys += 5; 
    
    // Update the keys display
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;  // Update data attribute for visibility
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
        }
    }
    
    showTopRightMessage('Found keys!');
}

function handleTrap() {
    gameState.isGameOver = true;
    stopTimer();
    showMessage('Oh no, it\'s a trap!', 'error', true);
}

function movePlayer(x, y) {
    const oldX = gameState.playerPosition.x;
    const oldY = gameState.playerPosition.y;
    
    // Determine direction
    let direction = '';
    if (x > oldX) direction = 'move-right';
    else if (x < oldX) direction = 'move-left';
    else if (y > oldY) direction = 'move-down';
    else if (y < oldY) direction = 'move-up';

    // Update position
    gameState.playerPosition = { x, y };
    
    // Render the maze with the movement class
    renderMaze(direction);
    updateVisibility();
    markAdjacentCells();

    window.parent.postMessage({
        type: 'movePlayer',
        data: { position: { x, y } }
    }, '*');
}

function handleCellClick(x, y) {
    // Don't allow moves if game is over
    if (gameState.isGameOver) return;

    // Get current player position
    const { x: playerX, y: playerY } = gameState.playerPosition;
    
    // Check if clicked cell is adjacent to player (including diagonals)
    const dx = Math.abs(x - playerX);
    const dy = Math.abs(y - playerY);
    
    // Only allow clicks on directly adjacent cells (not diagonal)
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        const targetCell = gameState.maze[y][x];

        // Use the same logic as keyboard movement
        if (targetCell === 'crystal-ball') {
            movePlayer(x, y);
            activateCrystalBall();
            gameState.maze[y][x] = 'path';
            renderMaze();
        } else if (targetCell === 'map') {
            movePlayer(x, y);
            activateMap();
            gameState.maze[y][x] = 'path';
            renderMaze();
        } else if (targetCell === 'key-powerup') {
            movePlayer(x, y);
            activateKeyPowerup();
            gameState.maze[y][x] = 'path';
            renderMaze();
        } else if (targetCell === 'path' || targetCell === 'start' || targetCell === 'exit' || targetCell === 'fake-exit') {
            movePlayer(x, y);
            // Check if we should trigger end game after moving to exit
            if ((targetCell === 'exit' || targetCell === 'fake-exit') && 
                x === gameState.maze[0].length - 1) {
                if (targetCell === 'exit') {
                    handleWin();
                } else {
                    handleTrap();
                }
            }
        } else if (targetCell === 'door') {
            handleDoor(x, y);
        }
    }
}

function renderMaze(movementClass = '') {
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
            
            if (cell === 'door') {
                const doorKey = `${x},${y}`;
                const opacity = gameState.doorOpacity.get(doorKey);
                if (opacity !== undefined) {
                    cellElement.style.opacity = opacity;
                }
            }
            
            if (cell === 'exit' && gameState.crystalBallUsed) {
                cellElement.classList.add('exit1');
                cellElement.classList.add('revealed-exit');
            }

            if (cell === 'fake-exit' && gameState.crystalBallUsed) {
                cellElement.classList.add('fake-exit1');
            }

            if (y === gameState.playerPosition.y && x === gameState.playerPosition.x) {
                cellElement.classList.add('player');
                if (movementClass) {
                    cellElement.classList.add(movementClass);
                    setTimeout(() => {
                        cellElement.classList.remove(movementClass);
                    }, 200);
                }
            }

            cellElement.onclick = () => handleCellClick(x, y);
            grid.appendChild(cellElement);
        });
    });

    updateVisibility();
}

function unlockDoor(x, y) {
    if (gameState.keys <= 0) {
        showMessage('No keys remaining!', 'error');
        return;
    }

    gameState.keys--;
    gameState.maze[y][x] = 'path';
    
    // Update the key display
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;  // Update data attribute for visibility
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
        }
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
    stopTimer();
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

function markAdjacentCells() {
    const { x: playerX, y: playerY } = gameState.playerPosition;
    
    // Remove adjacent class from all cells first
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('adjacent');
    });
    
    // Add adjacent class to cells next to player
    const adjacentPositions = [
        [playerX, playerY - 1],  // Up
        [playerX, playerY + 1],  // Down
        [playerX - 1, playerY],  // Left
        [playerX + 1, playerY]   // Right
    ];
    
    adjacentPositions.forEach(([x, y]) => {
        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cell && isWalkable(gameState.maze[y]?.[x])) {
            cell.classList.add('adjacent');
        }
    });
}

function isWalkable(cellType) {
    return ['path', 'door', 'crystal-ball', 'map', 'key-powerup', 'exit', 'fake-exit'].includes(cellType);
}

function showMessage(text, type, permanent = false) {
    const messageEl = document.getElementById('message');
    messageEl.innerHTML = '';
    messageEl.dataset.gameWon = 'false';
    messageEl.dataset.gameRetry = 'false';
    
    const textDiv = document.createElement('div');
    textDiv.textContent = text;
    messageEl.appendChild(textDiv);
    
    if (type === 'success') {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next Game (Or Press Enter)';
        nextButton.onclick = handleNextGame;
        messageEl.appendChild(nextButton);
        messageEl.dataset.gameWon = 'true';
    } else if (type === 'error' && permanent) {
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Try Again (Or Press Enter)';
        retryButton.onclick = () => {
            console.log('Enter key pressed:', event.key);
            retryLevel();
            messageEl.style.display = 'none';
            clearGameEndState(); 
        };
        messageEl.appendChild(retryButton);
        messageEl.dataset.gameRetry = 'true';
    }
    
    messageEl.className = type;
    messageEl.style.display = 'block';
}

// Add next game handler
function handleNextGame() {
    showLoading();
    window.parent.postMessage({
        type: 'retry',
        data: { sameLevel: true }
    }, '*');
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

    // Only keep the new game button handler
    const newGameButton = document.getElementById('newGameButton');
    if (newGameButton) {
        newGameButton.replaceWith(newGameButton.cloneNode(true));
        const newGameBtn = document.getElementById('newGameButton');
        newGameBtn.addEventListener('click', newGame);
    }
});