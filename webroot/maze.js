// 1. CONSTRAINTS & INITIAL STATES
let initializationAttempts = 0;
let timerInterval;
let isPaused = false;
let savedTimeLeft = null;
let initialKeys = 3;
let initialMaze = null; 
let gameState = {
    cameraOffset: { x: 0, y: 0 },
    username: '',
    keys: 2,
    initialKeysForMaze: 2,
    maze: [],
    playerPosition: { x: 0, y: 0 },
    isGameOver: false,
    visibleTiles: new Set(),
    exploredTiles: new Set(),
    crystalBallUsed: false,
    doorHits: new Map(),
    doorOpacity: new Map(),
    isDisarming: false,
    moveCount: 0,        // Track number of moves
    retryCount: 0,       // Track retries
    winStreak: 0,        // Track consecutive wins
    totalScore: 0,        // Track total score
    lives: 3
};
const MAX_KEYS = 12;
const MAX_ATTEMPTS = 5;
const GAME_TIME = 90;
const SCORING_CONFIG = {
    // Base points
    BASE_COMPLETION_POINTS: 1000,
    
    // Time bonuses (for 30 second game)
    TIME_BRACKETS: [
        { threshold: 10, bonus: 500 },  // Completed in under 10s
        { threshold: 15, bonus: 300 },  // Completed in under 15s
        { threshold: 20, bonus: 200 },  // Completed in under 20s
        { threshold: 25, bonus: 100 },  // Completed in under 25s
    ],
    
    // Move efficiency (percentage of minimal path length)
    MOVE_EFFICIENCY_MULTIPLIERS: [
        { threshold: 1.1, multiplier: 1.5 },    // Within 110% of optimal
        { threshold: 1.25, multiplier: 1.25 },  // Within 125% of optimal
        { threshold: 1.5, multiplier: 1.0 },    // Within 150% of optimal
        { threshold: 2.0, multiplier: 0.75 },   // Within 200% of optimal
        { threshold: Infinity, multiplier: 0.5 } // More than 200% of optimal
    ],
    
    // Retry penalties
    RETRY_PENALTY_MULTIPLIER: 0.75,  // 25% penalty per retry
    
    // Win streak bonuses
    STREAK_BONUSES: [
        { threshold: 2, bonus: 1.1 },   // 2 wins: 10% bonus
        { threshold: 5, bonus: 1.2 },   // 5 wins: 20% bonus
        { threshold: 10, bonus: 1.5 },  // 10 wins: 50% bonus
        { threshold: 20, bonus: 2.0 },  // 20 wins: 100% bonus
    ]
};

// 2. CORE GAME LOGIC
function initializeGame(data) {
    showLoading();
    log('Initializing game with data:', data);

    gameState.level = data.level;

    if (!data.maze) {
        log('No maze data received');
        return;
    }

    initialMaze = JSON.parse(JSON.stringify(data.maze));

    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.style.display = 'none';
        messageEl.textContent = '';
    }

    // Get start position first
    const startPosition = findStartPosition(data.maze);

    // Initialize game state
    gameState = {
        ...gameState,
        username: data.username || 'Developer',
        keys: playerStats.currentKeys || 3,
        initialKeysForMaze: playerStats.currentKeys || 3,
        maze: data.maze,
        playerPosition: startPosition,
        isGameOver: false,
        visibleTiles: new Set(),
        exploredTiles: new Set(),
        crystalBallUsed: false,
        mapUsed: false,
        doorHits: new Map(),
        doorOpacity: new Map(),
        moveCount: 0,
        retryCount: 0,
        winStreak: gameState.winStreak,
        totalScore: gameState.totalScore,
        lives: playerStats.currentLives || 3
    };

    // Setup basic grid
    const grid = document.getElementById('maze-grid');
    grid.style.gridTemplateColumns = `repeat(${data.maze[0].length}, 40px)`;

    updateLives(gameState.lives);

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

    // Reset powerup indicators
    const mapIndicator = document.getElementById('map-indicator');
    const crystalIndicator = document.getElementById('crystal-indicator');
    if (mapIndicator) {
        mapIndicator.style.display = 'none';
    }
    if (crystalIndicator) {
        crystalIndicator.style.display = 'none';
    }

    // Initial render
    renderMaze();
    
    // Trigger a "fake" move to the starting position to force centering
    requestAnimationFrame(() => {
        movePlayer(startPosition.x, startPosition.y);
        
        // Add a second move after a short delay
        setTimeout(() => {
            movePlayer(startPosition.x, startPosition.y);
            
            // And a third one just to be extra sure
            setTimeout(() => {
                movePlayer(startPosition.x, startPosition.y);
                updateVisibility();
                hideLoading();
            }, 50);
        }, 50);
    });

    startTimer();

    // Add focus to game container for immediate keyboard control
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.focus();
    }
}
function renderMaze(movementClass = '') {
    const grid = document.getElementById('maze-grid');
    if (!gameState.maze || !gameState.maze[0]) return;

    const cellSize = 40;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Use Math.round for precise pixel values
    gameState.cameraOffset = { // Had to manually make the player in center
        x: Math.round((viewportWidth / 2) - (gameState.playerPosition.x * cellSize) - (cellSize / 2) - 7),
        y: Math.round((viewportHeight / 2) - (gameState.playerPosition.y * cellSize) - (cellSize / 2) - 32)
    };

    // Important: Apply transform before rendering cells
    grid.style.transform = `translate(${gameState.cameraOffset.x}px, ${gameState.cameraOffset.y}px)`;
    grid.style.gridTemplateColumns = `repeat(${gameState.maze[0].length}, ${cellSize}px)`;
    grid.innerHTML = '';

    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.createElement('div');
            cellElement.className = `cell ${cell} fog`;
            cellElement.dataset.x = x;
            cellElement.dataset.y = y;

            if (cell === 'trap' && gameState.crystalBallUsed) {
                cellElement.classList.add('revealed');
                cellElement.classList.remove('fog');
                cellElement.classList.add('visible');
            }

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
function movePlayer(x, y) {
    const oldX = gameState.playerPosition.x;
    const oldY = gameState.playerPosition.y;
    
    gameState.moveCount++;
    
    let direction = '';
    if (x > oldX) direction = 'move-right';
    else if (x < oldX) direction = 'move-left';
    else if (y > oldY) direction = 'move-down';
    else if (y < oldY) direction = 'move-up';

    gameState.playerPosition = { x, y };
    
    renderMaze(direction);
    updateVisibility();
    markAdjacentCells();

    window.parent.postMessage({
        type: 'movePlayer',
        data: { position: { x, y } }
    }, '*');
}
function handleCellClick(x, y) { // MOVE PLAYER (click)
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
    
        if (targetCell === 'trap') {
            if (gameState.isDisarming) return;  // Exit early if already disarming
        
            if (gameState.keys >= 2) {
                // Set disarming state to true
                gameState.isDisarming = true;
                
                // Stay in place but use 2 keys
                gameState.keys -= 2;
        
                showTopRightMessage('Used 2 keys to disarm trap!');
                
                // Start disarm animation
                const trapElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                if (trapElement) {
                    trapElement.classList.add('disarming');
                    
                    // Convert to path in game state immediately but keep visual until animation ends
                    gameState.maze[y][x] = 'path';
                    
                    // Remove the trap visually after animation
                    setTimeout(() => {
                        gameState.isDisarming = false;  // Reset the flag after animation completes
                        
                        // Only update the specific cell instead of full re-render
                        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                        if (cell) {
                            cell.className = 'cell path';
                            if (gameState.visibleTiles.has(`${x},${y}`)) {
                                cell.classList.add('visible');
                            } else if (gameState.exploredTiles.has(`${x},${y}`)) {
                                cell.classList.add('explored');
                            } else {
                                cell.classList.add('fog');
                            }
                        }
                    }, 500);
                }
                
                // Update key display
                const keyStat = document.querySelector('.key-stat');
                if (keyStat) {
                    keyStat.dataset.count = gameState.keys;
                    const keysEl = keyStat.querySelector('#keys');
                    if (keysEl) {
                        keysEl.textContent = gameState.keys;
                    }
                }
            } else {
                // Game over - fell into trap
                handleTrap();
            }
            return;  // Don't move - stay in current position
        } else if (targetCell === 'crystal-ball') {
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
window.addEventListener('keydown', (event) => { // MOVE PLAYER (wasd)
    if (gameState.isGameOver) return;
    if (isPaused && event.key !== 'Escape') return;
    
    if (event.key === 'Escape') {
        if (isPaused) {
            resumeGame();
        } else {
            pauseGame();
        }
        return;
    }

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
    
        if (targetCell === 'trap') {
            if (gameState.isDisarming) return;  // Exit early if already disarming
        
            if (gameState.keys >= 2) {
                // Set disarming state to true
                gameState.isDisarming = true;
                
                // Stay in place but use 2 keys
                gameState.keys -= 2;
        
                showTopRightMessage('Used 2 keys to disarm trap!');
                
                // Start disarm animation
                const trapElement = document.querySelector(`[data-x="${newX}"][data-y="${newY}"]`);
                if (trapElement) {
                    trapElement.classList.add('disarming');
                    
                    // Convert to path in game state immediately but keep visual until animation ends
                    gameState.maze[newY][newX] = 'path';
                    
                    // Remove the trap visually after animation
                    setTimeout(() => {
                        gameState.isDisarming = false;  // Reset the flag after animation completes
                        
                        // Only update the specific cell instead of full re-render
                        const cell = document.querySelector(`[data-x="${newX}"][data-y="${newY}"]`);
                        if (cell) {
                            cell.className = 'cell path';
                            if (gameState.visibleTiles.has(`${newX},${newY}`)) {
                                cell.classList.add('visible');
                            } else if (gameState.exploredTiles.has(`${newX},${newY}`)) {
                                cell.classList.add('explored');
                            } else {
                                cell.classList.add('fog');
                            }
                        }
                    }, 500);
                }
                
                // Update key display
                const keyStat = document.querySelector('.key-stat');
                if (keyStat) {
                    keyStat.dataset.count = gameState.keys;
                    const keysEl = keyStat.querySelector('#keys');
                    if (keysEl) {
                        keysEl.textContent = gameState.keys;
                    }
                }
            } else {
                // Game over - fell into trap
                handleTrap();
            }
            return;  // Don't move - stay in current position
        } else if (targetCell === 'crystal-ball') {
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
function isWalkable(cellType) {
    return ['path', 'door', 'crystal-ball', 'map', 'key-powerup', 'exit', 'fake-exit', 'trap'].includes(cellType);
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

// 3. POWERUPS & MECHANICS
function activateMap() {
    gameState.mapUsed = true;
    
    // Show map indicator
    const mapIndicator = document.getElementById('map-indicator');
    if (mapIndicator) {
        mapIndicator.style.display = 'flex';
    }

    const { x, y } = gameState.playerPosition;
    const viewRadius = 3;

    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const newX = x + dx;
            const newY = y + dy;

            if (newX >= 0 && newX < gameState.maze[0].length &&
                newY >= 0 && newY < gameState.maze.length) {
                const key = `${newX},${newY}`;
                gameState.visibleTiles.add(key);

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

    // Reveal both exits and traps
    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (!cellElement) return;
            
            if (cell === 'exit') {
                cellElement.classList.add('revealed-exit');
                gameState.visibleTiles.add(`${x},${y}`);
            } else if (cell === 'trap') {
                cellElement.classList.add('revealed');
                cellElement.classList.remove('fog');
                cellElement.classList.add('visible');
                gameState.visibleTiles.add(`${x},${y}`);
            }
        });
    });

    showTopRightMessage('Found a crystal ball!');
}
function activateKeyPowerup() {
    if (gameState.keys >= MAX_KEYS) {
        showTopRightMessage('Bag full!');
        return;
    }
    
    // Determine number of keys based on games played
    let keysFound;
    if (gameState.gamesPlayed < 10) {
        // Games 1-9: Random 1-2 keys
        keysFound = Math.floor(Math.random() * 2) + 1;
    } else {
        // Games 10+: Random 1-3 keys
        keysFound = Math.floor(Math.random() * 3) + 1;
    }
    
    // Add the keys
    gameState.keys += keysFound;
    if (gameState.keys > MAX_KEYS) {
        // If we would exceed MAX_KEYS, adjust keysFound to show actual amount added
        keysFound -= (gameState.keys - MAX_KEYS);
        gameState.keys = MAX_KEYS;
    }
    
    updateKeys(gameState.keys);
    showTopRightMessage(`Found ${keysFound} key${keysFound > 1 ? 's' : ''}!`);
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
    const opacity = 1 - ((hits + 1) / 10) * 0.7;
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

    // Break door after 10 hits
    if (hits + 1 >= 10) {
        gameState.maze[y][x] = 'path';
        gameState.doorHits.delete(doorKey);
        gameState.doorOpacity.delete(doorKey);
        showTopRightMessage('Door broken!');
        renderMaze();
    } 
}
function unlockDoor(x, y) {
    if (gameState.keys <= 0) {
        showMessage('No keys remaining!', 'error');
        return;
    }

    const doorElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (!doorElement) return;

    showTopRightMessage('Used 1 key to unlock door!');

    const doorRect = doorElement.getBoundingClientRect();
    const mazeGrid = document.getElementById('maze-grid');
    const mazeRect = mazeGrid.getBoundingClientRect();

    const relativeLeft = doorRect.left - mazeRect.left;
    const relativeTop = doorRect.top - mazeRect.top;

    // Get player position
    const { x: playerX, y: playerY } = gameState.playerPosition;

    // Flip the logic: if dx > dy, split vertically (top/bottom); else split horizontally (left/right)
    const dx = Math.abs(x - playerX);
    const dy = Math.abs(y - playerY);
    const isHorizontal = dx < dy; 

    const animContainer = document.createElement('div');
    animContainer.className = `door-animation ${isHorizontal ? 'horizontal' : 'vertical'}`;
    animContainer.style.left = `${relativeLeft}px`;
    animContainer.style.top = `${relativeTop}px`;
    animContainer.style.pointerEvents = 'none'; // Prevent interaction
    mazeGrid.appendChild(animContainer);

    if (isHorizontal) {
        const leftPiece = document.createElement('div');
        leftPiece.className = 'door-piece left';
        const rightPiece = document.createElement('div');
        rightPiece.className = 'door-piece right';
        animContainer.appendChild(leftPiece);
        animContainer.appendChild(rightPiece);
    } else {
        const topPiece = document.createElement('div');
        topPiece.className = 'door-piece top';
        const bottomPiece = document.createElement('div');
        bottomPiece.className = 'door-piece bottom';
        animContainer.appendChild(topPiece);
        animContainer.appendChild(bottomPiece);
    }

    gameState.keys--;
    updateKeys(gameState.keys);
    gameState.maze[y][x] = 'path';

    renderMaze();

    mazeGrid.appendChild(animContainer); // Append again to ensure it persists

    setTimeout(() => {
        if (animContainer) {
            animContainer.remove();
        }
    }, 1300); // Slightly longer than animation duration
}

// 4. GAME STATE MANAGEMENT
function updateVisibility() {
    const { x, y } = gameState.playerPosition;
    const newVisible = new Set();
    const viewRadius = gameState.mapUsed ? 3 : 1;
    
    // Add current position and adjacent tiles to visible set
    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX < gameState.maze[0].length && 
                newY >= 0 && newY < gameState.maze.length) {
                newVisible.add(`${newX},${newY}`);
                // Always add to explored tiles
                gameState.exploredTiles.add(`${newX},${newY}`);
            }
        }
    }

    // Update visibility classes for all tiles
    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cellElement) {
                const key = `${x},${y}`;
                const isPowerup = cell === 'crystal-ball' || cell === 'map' || cell === 'key-powerup';
                
                if (isPowerup) {
                    // Ensure we have a powerup icon element
                    let powerupIcon = cellElement.querySelector('.powerup-icon');
                    if (!powerupIcon) {
                        // Create powerup icon if it doesn't exist
                        powerupIcon = document.createElement('div');
                        powerupIcon.className = 'powerup-icon';
                        cellElement.appendChild(powerupIcon);
                    }
                    
                    // Keep the powerup icon visible and glowing
                    powerupIcon.classList.add('powerup-glow');
                }

                // Handle base tile visibility
                if (newVisible.has(key)) {
                    // Currently visible tiles
                    cellElement.classList.remove('fog', 'explored');
                    cellElement.classList.add('visible');
                } else if (gameState.exploredTiles.has(key)) {
                    if (isPowerup) {
                        // For powerup tiles: dim the background but keep powerup visible
                        cellElement.classList.remove('fog');
                        cellElement.classList.add('explored');
                        // Don't add to newVisible set anymore - let background be dimmed
                    } else {
                        // Normal explored tile behavior
                        cellElement.classList.remove('fog', 'visible');
                        cellElement.classList.add('explored');
                    }
                } else {
                    // Unexplored tiles
                    cellElement.classList.remove('visible', 'explored');
                    cellElement.classList.add('fog');
                }
            }
        });
    });

    gameState.visibleTiles = newVisible;
}
// function updateVisibility() { // [DEVELOPMENT MODE]
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
function updateLives(newLives) {
    gameState.lives = newLives;
    const hearts = document.querySelectorAll('.heart-icon');
    hearts.forEach((heart, index) => {
        heart.setAttribute('data-filled', index < newLives ? 'true' : 'false');
    });
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
    }
}
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

// 5. SCORING & STATS
function calculateGameScore(gameData) { // Score for single game
    const {
        timeRemaining,
        movesUsed,
        optimalMoves,
        retryCount,
        winStreak
    } = gameData;
    
    // Start with base points
    let baseScore = SCORING_CONFIG.BASE_COMPLETION_POINTS;
    
    // Add time bonus
    const timeUsed = 30 - timeRemaining;
    for (const bracket of SCORING_CONFIG.TIME_BRACKETS) {
        if (timeUsed <= bracket.threshold) {
            baseScore += bracket.bonus;
            break;
        }
    }
    
    // Apply move efficiency multiplier
    const moveEfficiency = movesUsed / optimalMoves;
    for (const tier of SCORING_CONFIG.MOVE_EFFICIENCY_MULTIPLIERS) {
        if (moveEfficiency <= tier.threshold) {
            baseScore *= tier.multiplier;
            break;
        }
    }
    
    // Apply retry penalty
    baseScore *= Math.pow(SCORING_CONFIG.RETRY_PENALTY_MULTIPLIER, retryCount);
    baseScore = Math.round(baseScore);
    
    // Calculate streak bonus separately
    let streakBonus = 0;
    let finalScore = baseScore;
    
    // Current win streak includes the current win
    const currentStreak = winStreak + 1;
    
    // Check for streak bonus
    for (const streakTier of SCORING_CONFIG.STREAK_BONUSES.slice().reverse()) {
        if (currentStreak >= streakTier.threshold) {
            streakBonus = Math.round(baseScore * (streakTier.bonus - 1));
            finalScore = baseScore + streakBonus;
            break;
        }
    }

    return {
        baseScore,
        streakBonus,
        totalScore: finalScore,
        currentStreak
    };
}
function calculateStarRating(gameData) { // Rating out of 5 stars
    const {
        timeRemaining,
        movesUsed,
        optimalMoves,
        retryCount
    } = gameData;
    
    let ratingPoints = 0; // Out of 100 points

    // Time component (up to 50 points) - More generous time brackets
    const timeUsed = 30 - timeRemaining;
    if (timeUsed <= 17) ratingPoints += 50;      // More time allowed for max points
    else if (timeUsed <= 22) ratingPoints += 40; // Still high points for good completion
    else if (timeUsed <= 26) ratingPoints += 30; // Decent points for slower completion
    else ratingPoints += 20;                     // Base points for finishing
    
    // Move efficiency (up to 50 points) - More lenient thresholds
    const moveEfficiency = movesUsed / optimalMoves;
    if (moveEfficiency <= 1.6) ratingPoints += 50;      // 60% over optimal for max points
    else if (moveEfficiency <= 1.85) ratingPoints += 40;
    else if (moveEfficiency <= 2.1) ratingPoints += 30;
    else if (moveEfficiency <= 2.6) ratingPoints += 20;
    else ratingPoints += 10;                           
    
    // Retry penalty (up to -20 points) - Keep this the same
    ratingPoints -= Math.min(20, retryCount * 10);
    
    // Convert to star rating (0-5 stars, can have half stars)
    const starRating = Math.max(1.0, Math.round((ratingPoints / 100) * 10) / 2);
    
    return starRating;
}
const playerStats = { 
    totalScore: 0,
    gamesPlayed: 0,
    totalStars: 0,
    winStreak: 0,
    highestStreak: 0,
    averageRating: 0,
    currentKeys: 3, 
    levelStats: new Map(),
    
    addGameResult(levelId, gameData) {
        const scores = calculateGameScore(gameData);
        const rating = calculateStarRating(gameData);
        
        // Update keys after maze completion
        this.currentKeys = Math.min(gameState.keys + (gameState.keys < MAX_KEYS ? 1 : 0), MAX_KEYS);
        this.currentLives = gameState.lives;
        
        this.totalScore += scores.totalScore;
        this.gamesPlayed++;
        this.totalStars += rating;
        this.averageRating = this.totalStars / this.gamesPlayed;
        
        // Update win streak - include current win
        this.winStreak = gameData.winStreak + 1;
        this.highestStreak = Math.max(this.highestStreak, this.winStreak);
        
        if (!this.levelStats.has(levelId)) {
            this.levelStats.set(levelId, {
                highScore: 0,
                bestRating: 0,
                timesPlayed: 0
            });
        }
        
        const levelStat = this.levelStats.get(levelId);
        levelStat.highScore = Math.max(levelStat.highScore, scores.totalScore);
        levelStat.bestRating = Math.max(levelStat.bestRating, rating);
        levelStat.timesPlayed++;
        
        return {
            ...scores,
            rating,
            totalScore: this.totalScore,
            averageRating: this.averageRating,
            currentStreak: this.winStreak,
            currentKeys: this.currentKeys
        };
    }
};

// 6. GAME FLOW CONTROL
function startTimer() {
    let timeLeft = GAME_TIME;
    
    function updateTimer() {
        const timerDisplay = document.getElementById('timer');
        if (timerDisplay) {
            timerDisplay.textContent = `${timeLeft}`;
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

    // Reduce lives
    const newLives = gameState.lives - 1;
    gameState.lives = newLives;
    playerStats.currentLives = newLives;
    updateLives(newLives);

    // Show life reduction message
    showTopRightMessage('Lost 1 life!');

    // Check for game over
    if (newLives > 0) {
        // Still has lives left
        showMessage("Time's up! You've been caught!", 'error', true);
    } else {
        // No lives left - Game Over
        const finalScore = playerStats.totalScore;
        const avgRating = playerStats.averageRating;
        const gamesPlayed = playerStats.gamesPlayed;
        
        const gameOverMessage = [
            'Game Over!',
            `Final Score: ${finalScore}`,
            `Average Rating: ${avgRating.toFixed(1)}⭐`,
            `Games Played: ${gamesPlayed}\n`
        ].join('\n');

        showMessage(gameOverMessage, 'error no-lives', true, true);
    }
}
function handleWin() {
    gameState.isGameOver = true;
    stopTimer();

    const timeRemaining = parseInt(document.getElementById('timer').textContent);
    const gameData = {
        timeRemaining,
        movesUsed: gameState.moveCount,
        optimalMoves: calculateOptimalMoves(gameState.maze),
        retryCount: gameState.retryCount,
        winStreak: gameState.winStreak,
        lives: gameState.lives
    };

    const result = playerStats.addGameResult(`level${gameState.level}`, gameData);
    gameState.winStreak++;

    const messageLines = [
        'You win!',
        `Total Score: ${result.totalScore}`,
        `Score: +${result.baseScore}`
    ];

    if (result.streakBonus > 0) {
        messageLines.push(`Win Streak Bonus: +${result.streakBonus} (${result.currentStreak} wins)`);
    }

    messageLines.push(
        `Average Rating: ${result.averageRating.toFixed(1)}⭐`,
        `Games Played: ${playerStats.gamesPlayed}`
    );

    const winMessage = messageLines.join('\n');
    showMessage(winMessage, 'success');

    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
        retryButton.style.display = 'block';
    }

    window.parent.postMessage({
        type: 'gameOver',
        data: { 
            won: true,
            remainingKeys: gameState.keys,
            baseScore: result.baseScore,
            streakBonus: result.streakBonus,
            totalScore: result.totalScore,
            rating: result.averageRating,
            gamesPlayed: playerStats.gamesPlayed,
            winStreak: playerStats.winStreak,
            lives: gameState.lives,
            shouldShowBonusKey: gameState.keys < MAX_KEYS
        }
    }, '*');
}
function handleTrap() {
    gameState.isGameOver = true;
    stopTimer();
    
    // Decrease lives and store in playerStats
    const newLives = gameState.lives - 1;
    gameState.lives = newLives;
    playerStats.currentLives = newLives;
    updateLives(newLives);
    
    showTopRightMessage('Lost 1 life!');

    if (newLives > 0) {
        // Still has lives left
        showMessage('Oh no! You fell into a trap!\nBe more careful next time!', 'error', true);
    } else {
        // Game over - no lives left
        const finalScore = playerStats.totalScore;
        const avgRating = playerStats.averageRating;
        const gamesPlayed = playerStats.gamesPlayed;
        
        const gameOverMessage = [
            'Game Over!',
            `Final Score: ${finalScore}`,
            `Average Rating: ${avgRating.toFixed(1)}⭐`,
            `Games Played: ${gamesPlayed}\n`
        ].join('\n');

        showMessage(gameOverMessage, 'error no-lives', true, true); 
    }
}
function retryLevel() {
    gameState.retryCount++;
    gameState.winStreak = 0;
    showLoading();
    clearGameEndState();
    const messageEl = document.getElementById('message');

    if (messageEl) {
        messageEl.style.display = 'none';
    }

    gameState = {
        ...gameState,
        keys: gameState.initialKeysForMaze,
        maze: JSON.parse(JSON.stringify(initialMaze)),
        playerPosition: findStartPosition(initialMaze),
        isGameOver: false,
        visibleTiles: new Set(),
        exploredTiles: new Set(),
        crystalBallUsed: false,
        mapUsed: false,
        doorHits: new Map(),
        doorOpacity: new Map()
    };

    // Reset powerup UI indicators
    const crystalIndicator = document.getElementById('crystal-indicator');
    const mapIndicator = document.getElementById('map-indicator');
    if (crystalIndicator) crystalIndicator.style.display = 'none';
    if (mapIndicator) mapIndicator.style.display = 'none';

    // Update UI
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
            keysEl.style.color = gameState.keys >= MAX_KEYS ? '#FFA500' : '';
        }
    }

    renderMaze();
    updateVisibility();
    startTimer();
    hideLoading();

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.focus();
    }
}
function handleNextGame() {
    // Hide message and overlay first
    const messageEl = document.getElementById('message');
    const messageOverlay = document.getElementById('message-overlay');
    if (messageEl) messageEl.style.display = 'none';
    if (messageOverlay) messageOverlay.style.display = 'none';

    showLoading();
    if (gameState.keys < MAX_KEYS) {
        showTopRightMessage('Found a bonus key!');
    }
    window.parent.postMessage({
        type: 'nextGame',
        data: { 
            lives: gameState.lives
        }
    }, '*');
}
function newGame() {
    console.log('New Game button clicked');
    showLoading(); // Show loading indicator before sending the new game request
    window.parent.postMessage({
        type: 'newGame'
    }, '*');
}
function retryGame() {
    // Send retry message to parent
    window.parent.postMessage({
        type: 'retry'
    }, '*');
}

// 7. UI & MESSAGES
function showMessage(text, type, permanent = false, showQuitOnly = false) {
    // Get or create the message overlay
    let messageOverlay = document.getElementById('message-overlay');
    if (!messageOverlay) {
        messageOverlay = document.createElement('div');
        messageOverlay.id = 'message-overlay';
        document.body.appendChild(messageOverlay);
    }

    // Get or create the message element
    const messageEl = document.getElementById('message');
    messageEl.innerHTML = '';
    messageEl.dataset.gameWon = 'false';
    messageEl.dataset.gameRetry = 'false';
    
    // Split text by newlines and create separate divs
    text.split('\n').forEach(line => {
        const textDiv = document.createElement('div');
        textDiv.textContent = line;
        textDiv.style.marginBottom = '8px';
        messageEl.appendChild(textDiv);
    });

    if (showQuitOnly) {
        const quitButton = document.createElement('button');
        quitButton.textContent = 'Quit Game';
        quitButton.onclick = newGame;
        quitButton.style.marginTop = '10px';
        messageEl.appendChild(quitButton);
    } else if (type === 'success') {
        const spacerDiv = document.createElement('div');
        messageEl.appendChild(spacerDiv);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next Game';
        nextButton.onclick = handleNextGame;
        messageEl.appendChild(nextButton);
        messageEl.dataset.gameWon = 'true';
    } else if (type === 'error' && permanent && !showQuitOnly) {
        const spacerDiv = document.createElement('div');
        messageEl.appendChild(spacerDiv);

        const retryButton = document.createElement('button');
        retryButton.textContent = 'Try Again';
        retryButton.onclick = () => {
            retryLevel();
            messageEl.style.display = 'none';
            messageOverlay.style.display = 'none';
            clearGameEndState();
        };
        messageEl.appendChild(retryButton);
        messageEl.dataset.gameRetry = 'true';
    }
    
    messageEl.className = type;
    messageEl.style.display = 'block';
    messageOverlay.style.display = 'flex';
}
function clearGameEndState() {
    const messageEl = document.getElementById('message');
    const messageOverlay = document.getElementById('message-overlay');
    
    if (messageEl) {
        messageEl.style.display = 'none';
        messageEl.innerHTML = '';
    }
    
    if (messageOverlay) {
        messageOverlay.style.display = 'none';
    }

    gameState.isGameOver = false;
    console.log('Game end state cleared.');
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
    }, 3000); // Show message for x seconds

    // Remove the message completely after fade-out transition
    setTimeout(() => {
        messageEl.remove();
    }, 4000); // Matches fade-out duration (2s display + 0.3s fade)
}
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

// 8. PAUSE MENU
function pauseGame() {
    if (!isPaused) {
        // Stop timer
        if (timerInterval) {
            clearInterval(timerInterval);
            savedTimeLeft = parseInt(document.getElementById('timer').textContent);
        }
        
        // Update pause menu stats
        document.getElementById('pauseTotalScore').textContent = playerStats.totalScore;
        document.getElementById('pauseAverageRating').textContent = playerStats.averageRating.toFixed(1);
        document.getElementById('pauseGamesPlayed').textContent = playerStats.gamesPlayed;
        
        // Show overlay
        const overlay = document.getElementById('pause-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
        
        isPaused = true;

        // Ensure game container loses focus to prevent keyboard input
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.blur();
        }
    }
}
function resumeGame() {
    if (isPaused) {
        // Hide overlay
        const overlay = document.getElementById('pause-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // Resume timer
        if (savedTimeLeft !== null) {
            let timeLeft = savedTimeLeft;
            
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
        
        isPaused = false;

        // Restore focus to game container for keyboard input
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.focus();
        }
    }
}

// 9. EVENT HANDLERS
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
            // Add isNewGame flag based on whether it's a retry
            initializeGame({
                ...message.data,
                isNewGame: !message.data.isRetry
            });
            break;
        default:
            log('Unknown message type:', message.type);
    }
});
window.addEventListener('keydown', (event) => { // 'Enter' to go next game
    if (event.key === 'Enter') {
        const messageEl = document.getElementById('message');
        if (!messageEl || messageEl.style.display === 'none') return;
        
        if (gameState.isGameOver) {
            if (messageEl.dataset.gameWon === 'true') {
                handleNextGame();
                return;
            }
            
            if (messageEl.dataset.gameRetry === 'true' && gameState.lives > 0) {
                retryLevel();
                messageEl.style.display = 'none';
                return;
            }
        }
    }
});
window.addEventListener('load', () => {
    log('Page loaded, sending ready message');
    sendReadyMessage();
    renderMaze();

    // Pause button handler
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseGame();
        });
    }

    // Resume button handler
    const resumeButton = document.getElementById('resumeButton');
    if (resumeButton) {
        resumeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            resumeGame();
        });
    }

    // Quit button handler
    const quitButton = document.getElementById('quitButton');
    if (quitButton) {
        quitButton.addEventListener('click', (e) => {
            e.stopPropagation();
            newGame(); // This will take you back to the main menu
        });
    }
});

// 10. HELPER FUNCTIONS
function log(message, data = null) {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    const debug = document.getElementById('debug');
    if (debug) {
        debug.textContent = logMessage;
    }
}
function interpolateColor(startColor, endColor, percentage) { // Help with color interpolation
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
function calculateOptimalMoves(maze) { // Helps calculate optimal moves
    // Simple estimate - manhattan distance from start to exit
    const start = findStartPosition(maze);
    let exit;
    
    // Find exit position
    for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[0].length; x++) {
            if (maze[y][x] === 'exit') {
                exit = { x, y };
                break;
            }
        }
        if (exit) break;
    }

    // Manhattan distance plus some buffer for doors/obstacles
    return Math.abs(exit.x - start.x) + Math.abs(exit.y - start.y) + 2;
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