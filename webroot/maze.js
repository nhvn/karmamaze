// 1. CONSTRAINTS & INITIAL STATES
let initializationAttempts = 0;
let timerInterval;
let isPaused = false;
let savedTimeLeft = null;
let initialKeys = 3;
let initialMaze = null; 
let playerImageUrl = '';
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
    isDisarming: false,
    moveCount: 0,        // Track number of moves
    retryCount: 0,       // Track retries
    winStreak: 0,        // Track consecutive wins
    totalScore: 0,        // Track total score
    lives: 3,
    isCasualMode: false,
    playerOrientation: 'face-right',
    animatingCells: new Set(),
    lastMoveTime: Date.now(),
    idlePromptVisible: false,
    isPlayerIdle: false,
    idleAnimationTimeout: null,
};
const MAX_KEYS = 12;
const MAX_ATTEMPTS = 5;
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
function getGameTime(gamesPlayed) {
    console.log('Getting game time for games played:', gamesPlayed);  // Add this line
    if (gamesPlayed >= 20) {
        return 30;  // 30 seconds after 20 games
    } else if (gamesPlayed >= 10) {
        return 60;  // 60 seconds after 10 games
    } else {
        return 90;  // Default 90 seconds for first 10 games
    }
}
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

    const gamesPlayedCount = document.getElementById('gamesPlayedCount');
    if (gamesPlayedCount) {
        gamesPlayedCount.textContent = data.gamesPlayed || '';
    }

    // Get start position first
    const startPosition = findStartPosition(data.maze);

    // Initialize game state
    gameState = {
        ...gameState,
        username: data.username || 'Developer',
        keys: data.isCasualMode ? 99999 : (playerStats.currentKeys || 3),
        initialKeysForMaze: data.isCasualMode ? 99999 : (playerStats.currentKeys || 3),
        maze: data.maze,
        playerPosition: startPosition,
        isGameOver: false,
        visibleTiles: new Set(),  
        exploredTiles: new Set(), 
        crystalBallUsed: false,
        mapUsed: false,
        doorHits: new Map(),
        moveCount: 0,
        retryCount: 0,
        winStreak: gameState.winStreak,
        totalScore: gameState.totalScore,
        lives: playerStats.currentLives || 3,
        playerOrientation: 'face-right',
        gamesPlayed: data.gamesPlayed || 0,
        isCasualMode: data.isCasualMode
    };
    
    // Setup grid before rendering
    const grid = document.getElementById('maze-grid');
    grid.style.gridTemplateColumns = `repeat(${data.maze[0].length}, 40px)`;
    grid.innerHTML = '';  // Clear the grid

    // Initial render with everything in fog
    renderMaze();

    // Create a promise to handle the sequence
    const initSequence = async () => {
        // First move to center - everything still in fog
        movePlayer(startPosition.x, startPosition.y);
        
        // Wait a frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Apply initial visibility
        updateVisibility();
        
        // Wait another frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Final position and visibility update
        movePlayer(startPosition.x, startPosition.y);
        updateVisibility();
        
        // Hide loading after everything is set
        hideLoading();
    };

    // Start the sequence
    initSequence();

    // Show prompt only for new games (not retries or next games)
    if (data.isFirstGame && !data.isCasualMode) {
        showGamePrompt("Escape the maze!");
    }

    if (data.isFirstGame && data.isCasualMode) {
        showGamePrompt("Breeze through the maze with endless karma.");
    }

    updateLives(gameState.lives);
    const usernameEl = document.getElementById('username');
    
    if (usernameEl) {
        usernameEl.textContent = gameState.username;
    }
    
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        if (data.isCasualMode) {
            keyStat.dataset.count = 'infinity';
            const keysEl = keyStat.querySelector('#keys');
            if (keysEl) {
                keysEl.textContent = '∞';
            }
        } else {
            keyStat.dataset.count = gameState.keys.toString();
            const keysEl = keyStat.querySelector('#keys');
            if (keysEl) {
                keysEl.textContent = gameState.keys.toString();
            }
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

    // Force all cells to start with fog
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('visible', 'explored');
        cell.classList.add('fog');
    });
    
    // Trigger a "fake" move to the starting position to force centering
    requestAnimationFrame(() => {
        const startPosition = findStartPosition(data.maze);
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

    // Handle timer based on game mode
    if (!gameState.isCasualMode) {
        startTimer();
    } else {
        const timerDisplay = document.getElementById('timer');
        if (timerDisplay) {
            timerDisplay.style.display = 'none';
        }
    }

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

    gameState.cameraOffset = { 
        x: Math.round((viewportWidth / 2) - (gameState.playerPosition.x * cellSize) - (cellSize / 2) - 7),
        y: Math.round((viewportHeight / 2) - (gameState.playerPosition.y * cellSize) - (cellSize / 2) - 32)
    };

    grid.style.transform = `translate(${gameState.cameraOffset.x}px, ${gameState.cameraOffset.y}px)`;
    grid.style.gridTemplateColumns = `repeat(${gameState.maze[0].length}, ${cellSize}px)`;
    grid.innerHTML = '';

    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.createElement('div');
            let baseClass = `cell ${cell} fog`;
            
            // Handle traps revealed by crystal ball
            if (cell.startsWith('trap') && gameState.crystalBallUsed) {
                baseClass += ' crystal-ball-revealed';
            }

            // Handle doors with cracks
            if (cell === 'door') {
                const doorKey = `${x},${y}`;
                const hits = gameState.doorHits.get(doorKey) || 0;

                if (hits + 1 >= 8) {
                    baseClass += ' cracked3';
                } else if (hits + 1 >= 5) {
                    baseClass += ' cracked2';
                } else if (hits + 1 >= 3) {
                    baseClass += ' cracked1';
                }
            }

            // Handle exits and fake exits with crystal ball
            if (cell === 'exit' && gameState.crystalBallUsed) {
                baseClass += ' exit1 revealed-exit';
            }
            if (cell === 'fake-exit' && gameState.crystalBallUsed) {
                baseClass += ' fake-exit1';
            }

            cellElement.className = baseClass;
            cellElement.classList.add('fog');  // Extra insurance
            cellElement.classList.remove('visible', 'explored');  // Make sure these are removed
            cellElement.dataset.x = x;
            cellElement.dataset.y = y;

            // Handle player position
            if (y === gameState.playerPosition.y && x === gameState.playerPosition.x) {
                cellElement.classList.add('player');
                if (gameState.playerOrientation) {
                    cellElement.classList.add(gameState.playerOrientation);
                }
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

    // Add idle animation if player is idle
    if (gameState.isPlayerIdle) {
        const playerCell = document.querySelector('.cell.player');
        if (playerCell) {
            playerCell.classList.add('idle-animation');
        }
    }

    updateVisibility();
}

function movePlayer(x, y) {
    gameState.lastMoveTime = Date.now();
    if (gameState.isPlayerIdle) {
        stopPlayerIdleAnimation();
    }
    if (gameState.idlePromptVisible) {
        hideIdlePrompt();
        gameState.idlePromptVisible = false;
    }
    const oldX = gameState.playerPosition.x;
    const oldY = gameState.playerPosition.y;
    
    gameState.moveCount++;
    
    let direction = '';
    let orientation = '';
    
    // Determine movement direction and orientation
    if (x > oldX) {
        direction = 'move-right';
        orientation = 'face-right';
    }
    else if (x < oldX) {
        direction = 'move-left';
        orientation = 'face-left';
    }
    else if (y > oldY) {
        direction = 'move-down';
        orientation = 'face-down';
    }
    else if (y < oldY) {
        direction = 'move-up';
        orientation = 'face-up';
    }
    // Only update position and orientation if we actually moved
    if (direction) {
        gameState.playerPosition = { x, y };
    }

    gameState.playerPosition = { x, y };
    
    // Store the current orientation in gameState
    gameState.playerOrientation = orientation;
    
    renderMaze(direction);
    updateVisibility();
    markAdjacentCells();

    window.parent.postMessage({
        type: 'movePlayer',
        data: { position: { x, y } }
    }, '*');
}
function handleCellClick(x, y) { // MOVE PLAYER (click)
    // Check if target cell is animating using gameState
    if (gameState.animatingCells.has(`${x},${y}`)) {
        return;
    }

    // Don't allow moves if game is over
    if (gameState.isGameOver) return;

    // Get current player position
    const { x: playerX, y: playerY } = gameState.playerPosition;
    
    // Check if clicked cell is adjacent to player (including diagonals)
    const dx = Math.abs(x - playerX);
    const dy = Math.abs(y - playerY);
    
    // Determine orientation based on click position
    const setPlayerOrientation = (newX, newY) => {
        if (newX > playerX) gameState.playerOrientation = 'face-right';
        else if (newX < playerX) gameState.playerOrientation = 'face-left';
        else if (newY > playerY) gameState.playerOrientation = 'face-down';
        else if (newY < playerY) gameState.playerOrientation = 'face-up';
    };
    
    // Only allow clicks on directly adjacent cells (not diagonal)
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        const targetCell = gameState.maze[y][x];
    
        if (targetCell.startsWith('trap')) {
            if (gameState.isDisarming) return;  // Exit early if already disarming
        
            if (gameState.keys >= 2) {
                // Set orientation even when disarming
                setPlayerOrientation(x, y);  // For click handler only
                
                // Set disarming state to true
                gameState.isDisarming = true;
                
                // Stay in place but use 2 keys
                gameState.keys -= 2;
        
                // Show trap-specific message
                showTopRightMessage(getTrapDisarmMessage(targetCell));
                
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
                handleTrap(targetCell);
            }
            return;  // Don't move - stay in current position
        } else if (targetCell === 'crystal-ball') {
            setPlayerOrientation(x, y);
            movePlayer(x, y);
            activateCrystalBall();
            gameState.maze[y][x] = 'path';
            renderMaze();
        } else if (targetCell === 'map') {
            setPlayerOrientation(x, y);
            movePlayer(x, y);
            activateMap();
            gameState.maze[y][x] = 'path';
            renderMaze();
        } else if (targetCell === 'key-powerup') {
            setPlayerOrientation(x, y);
            movePlayer(x, y);
            activateKeyPowerup();
            gameState.maze[y][x] = 'path';
            renderMaze();
        } else if (targetCell === 'path' || targetCell === 'start' || targetCell === 'exit' || targetCell === 'fake-exit') {
            setPlayerOrientation(x, y);
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
            setPlayerOrientation(x, y);
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

    // Check if target cell is animating using gameState
    if (gameState.animatingCells.has(`${newX},${newY}`)) {
        return;
    }

    if (newX >= 0 && newX < gameState.maze[0].length && 
        newY >= 0 && newY < gameState.maze.length) {
        const targetCell = gameState.maze[newY][newX];
    
        if (targetCell.startsWith('trap')) {
            if (gameState.isDisarming) return;  // Exit early if already disarming
        
            if (gameState.keys >= 2) {
                // Set disarming state to true
                gameState.isDisarming = true;
                
                // Stay in place but use 2 keys
                gameState.keys -= 2;
        
                // Show trap-specific message
                showTopRightMessage(getTrapDisarmMessage(targetCell));
                
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
                handleTrap(targetCell);
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
    return ['path', 'door', 'crystal-ball', 'map', 'key-powerup', 'exit', 'fake-exit', 'trap1', 'trap2', 'trap3'].includes(cellType);
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
function handlePlayerIdle() {
    const idleThreshold = 2000; // Start idle animation after 2 seconds
    const now = Date.now();
    
    if (!gameState.isGameOver && !isPaused && (now - gameState.lastMoveTime > idleThreshold)) {
        if (!gameState.isPlayerIdle) {
            startPlayerIdleAnimation();
        }
    } else if (gameState.isPlayerIdle) {
        stopPlayerIdleAnimation();
    }
}

function startPlayerIdleAnimation() {
    const playerCell = document.querySelector('.cell.player');
    if (playerCell) {
        playerCell.classList.add('idle-animation');
        gameState.isPlayerIdle = true;
    }
}

function stopPlayerIdleAnimation() {
    const playerCell = document.querySelector('.cell.player');
    if (playerCell) {
        playerCell.classList.remove('idle-animation');
        gameState.isPlayerIdle = false;
    }
}

// 3. POWERUPS & MECHANICS
function activateMap() {
    // Set map used flag to enable expanded radius
    gameState.mapUsed = true;
    
    // Show map indicator
    const mapIndicator = document.getElementById('map-indicator');
    if (mapIndicator) {
        mapIndicator.style.display = 'flex';
    }

    // We still need to call updateVisibility() to apply the expanded radius
    // updateVisibility() checks gameState.mapUsed to determine radius size (1 vs 2)
    updateVisibility();

    showTopRightMessage('Found a map!');
}
function activateCrystalBall() {
    gameState.crystalBallUsed = true;

    // Display crystal ball indicator
    const crystalIndicator = document.getElementById('crystal-indicator');
    if (crystalIndicator) {
        crystalIndicator.style.display = 'flex';
    }

    // Reveal traps using crystal ball
    gameState.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (!cellElement) {
                console.warn(`No DOM element found for cell at (${x}, ${y})`);
                return;
            }

            // Check if cell is a trap and reveal it
            if (typeof cell === 'string' && cell.startsWith('trap')) {
                console.log(`Trap at (${x}, ${y}):`, cellElement.classList.toString());
                cellElement.classList.add('crystal-ball-revealed');
            }
        });
    });

    // Show message and re-render the maze
    showTopRightMessage('Found a crystal ball!');
    renderMaze();
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
    showTopRightMessage(`Found ${keysFound} karma!`);
}
function handleDoor(x, y) {
    // First determine orientation based on door position relative to player
    const { x: playerX, y: playerY } = gameState.playerPosition;
    if (x > playerX) {
        gameState.playerOrientation = 'face-right';
    } else if (x < playerX) {
        gameState.playerOrientation = 'face-left';
    } else if (y > playerY) {
        gameState.playerOrientation = 'face-down';
    } else if (y < playerY) {
        gameState.playerOrientation = 'face-up';
    }

    // Update orientation first
    renderMaze();

    // Then handle the door interaction
    if (gameState.isCasualMode || (typeof gameState.keys === 'number' && gameState.keys > 0)) {
        unlockDoor(x, y);
} else {
    const doorKey = `${x},${y}`;
    const hits = gameState.doorHits.get(doorKey) || 0;
    gameState.doorHits.set(doorKey, hits + 1);

    const doorElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (doorElement) {
        // Remove previous crack classes first
        doorElement.classList.remove('cracked1', 'cracked2', 'cracked3');
        
        // Then add appropriate crack class based on hits
        if (hits + 1 >= 8) {
            doorElement.classList.add('cracked3');
        } else if (hits + 1 >= 5) {
            doorElement.classList.add('cracked2');
        } else if (hits + 1 >= 3) {
            doorElement.classList.add('cracked1');
        }

        doorElement.classList.add('shaking');
        
        setTimeout(() => {
            doorElement.classList.remove('shaking');
            
            // Break door after 10 hits
            if (hits + 1 >= 10) {
                gameState.maze[y][x] = 'path';
                gameState.doorHits.delete(doorKey);
                showTopRightMessage('Door broken!');
                renderMaze();
            }
        }, 150);
    }
}
}
function unlockDoor(x, y) {
    if (!gameState.isCasualMode && gameState.keys <= 0) {
        showMessage('No keys remaining!', 'error');
        return;
    }

    const doorElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (!doorElement) return;

    showTopRightMessage('Used 1 karma to unlock door!');

    const doorRect = doorElement.getBoundingClientRect();
    const mazeGrid = document.getElementById('maze-grid');
    const mazeRect = mazeGrid.getBoundingClientRect();

    const relativeLeft = doorRect.left - mazeRect.left;
    const relativeTop = doorRect.top - mazeRect.top;

    const { x: playerX, y: playerY } = gameState.playerPosition;
    const dx = Math.abs(x - playerX);
    const dy = Math.abs(y - playerY);
    const isHorizontal = dx < dy;

    gameState.keys--;
    updateKeys(gameState.keys);
    gameState.maze[y][x] = 'path';
    
    const animContainer = document.createElement('div');
    animContainer.className = `door-animation ${isHorizontal ? 'horizontal' : 'vertical'}`;
    animContainer.style.left = `${relativeLeft}px`;
    animContainer.style.top = `${relativeTop}px`;
    animContainer.style.pointerEvents = 'none';
    animContainer.style.zIndex = '1000';

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

    mazeGrid.appendChild(animContainer);

    requestAnimationFrame(() => {
        setTimeout(() => {
            gameState.maze[y][x] = 'path';
            renderMaze();
            mazeGrid.appendChild(animContainer);
        }, 50);

        setTimeout(() => {
            if (animContainer && animContainer.parentNode) {
                animContainer.remove();
            }
            // Remove cell from animating set using gameState
            gameState.animatingCells.delete(`${x},${y}`);
        }, 400);
    });
}

// 4. GAME STATE MANAGEMENT
function updateVisibility() {
    const { x: playerX, y: playerY } = gameState.playerPosition;
    const newVisible = new Set();
    const viewRadius = gameState.mapUsed ? 2 : 1;

    // Helper to check if a cell blocks vision
    const isBlocker = (cell) => cell === 'wall' || cell === 'door';

    // First pass: Check all cells in square radius
    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const newX = playerX + dx;
            const newY = playerY + dy;

            // Check bounds
            if (newX >= 0 && newX < gameState.maze[0].length &&
                newY >= 0 && newY < gameState.maze.length) {

                const cell = gameState.maze[newY][newX];
                const key = `${newX},${newY}`;

                // If it's in box radius (using Math.abs for square pattern)
                if (Math.abs(dx) <= viewRadius && Math.abs(dy) <= viewRadius) {
                    // For direct adjacent cells or player position, always visible
                    if ((Math.abs(dx) <= 1 && Math.abs(dy) <= 1) && (dx === 0 || dy === 0 || (dx === 0 && dy === 0))) {
                        newVisible.add(key);
                        gameState.exploredTiles.add(key);
                        continue;
                    }

                    // Calculate path to this cell from player
                    let isVisible = true;
                    let currX = playerX;
                    let currY = playerY;

                    // Determine the primary path to check
                    const useHorizontalFirst = Math.abs(dx) > Math.abs(dy);

                    if (useHorizontalFirst) {
                        // Move horizontally first
                        while (currX !== newX) {
                            currX += dx > 0 ? 1 : -1;
                            if (isBlocker(gameState.maze[currY][currX])) {
                                isVisible = false;
                                break;
                            }
                        }
                        if (isVisible) {
                            // Then vertically
                            while (currY !== newY) {
                                currY += dy > 0 ? 1 : -1;
                                if (isBlocker(gameState.maze[currY][currX])) {
                                    isVisible = false;
                                    break;
                                }
                            }
                        }
                    } else {
                        // Move vertically first
                        while (currY !== newY) {
                            currY += dy > 0 ? 1 : -1;
                            if (isBlocker(gameState.maze[currY][currX])) {
                                isVisible = false;
                                break;
                            }
                        }
                        if (isVisible) {
                            // Then horizontally
                            while (currX !== newX) {
                                currX += dx > 0 ? 1 : -1;
                                if (isBlocker(gameState.maze[currY][currX])) {
                                    isVisible = false;
                                    break;
                                }
                            }
                        }
                    }

                    // If the cell is visible, add it
                    if (isVisible) {
                        newVisible.add(key);
                        gameState.exploredTiles.add(key);
                    }
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
                const isPowerup = cell === 'crystal-ball' || cell === 'map' || cell === 'key-powerup';

                if (isPowerup) {
                    let powerupIcon = cellElement.querySelector('.powerup-icon');
                    if (!powerupIcon) {
                        powerupIcon = document.createElement('div');
                        powerupIcon.className = 'powerup-icon';
                        cellElement.appendChild(powerupIcon);
                    }
                    powerupIcon.classList.add('powerup-glow');
                }

                // Handle visibility states
                if (newVisible.has(key)) {
                    cellElement.classList.remove('fog', 'explored');
                    cellElement.classList.add('visible');
                } else if (gameState.exploredTiles.has(key)) {
                    if (isPowerup) {
                        cellElement.classList.remove('fog');
                        cellElement.classList.add('explored');
                    } else {
                        cellElement.classList.remove('fog', 'visible');
                        cellElement.classList.add('explored');
                    }
                } else {
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
        if (gameState.isCasualMode) {
            keyStat.dataset.count = 'infinity';
            const keysEl = keyStat.querySelector('#keys');
            if (keysEl) {
                keysEl.textContent = '∞';
            }
        } else {
            keyStat.dataset.count = newKeys.toString();
            const keysEl = keyStat.querySelector('#keys');
            if (keysEl) {
                keysEl.textContent = newKeys.toString();
            }
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
        winStreak,
        gamesPlayed
    } = gameData;
    
    // Start with base points
    let baseScore = SCORING_CONFIG.BASE_COMPLETION_POINTS;
    
    // Add time bonus adjusted for total game time
    const totalGameTime = getGameTime(gamesPlayed);
    const timeUsed = totalGameTime - timeRemaining;
    const timePercentageUsed = (timeUsed / totalGameTime) * 30; // Normalize to 30 seconds for scoring

    for (const bracket of SCORING_CONFIG.TIME_BRACKETS) {
        if (timePercentageUsed <= bracket.threshold) {
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
const playerStats = { 
    totalScore: 0,
    gamesPlayed: 0,
    winStreak: 0,
    highestStreak: 0,
    currentKeys: 3, 
    levelStats: new Map(),
    
    addGameResult(levelId, gameData) {
        const scores = calculateGameScore(gameData);
        
        // Update keys after maze completion
        this.currentKeys = Math.min(gameState.keys + (gameState.keys < MAX_KEYS ? 1 : 0), MAX_KEYS);
        this.currentLives = gameState.lives;
        
        this.totalScore += scores.totalScore;
        this.gamesPlayed++;
        console.log('Updated games played:', this.gamesPlayed);
        
        // Update win streak - include current win
        this.winStreak = gameData.winStreak + 1;
        this.highestStreak = Math.max(this.highestStreak, this.winStreak);
        
        if (!this.levelStats.has(levelId)) {
            this.levelStats.set(levelId, {
                highScore: 0,
                timesPlayed: 0
            });
        }
        
        const levelStat = this.levelStats.get(levelId);
        levelStat.highScore = Math.max(levelStat.highScore, scores.totalScore);
        levelStat.timesPlayed++;
        
        return {
            ...scores,
            totalScore: this.totalScore,
            currentStreak: this.winStreak,
            currentKeys: this.currentKeys
        };
    }
};

// 6. GAME FLOW CONTROL
function startTimer() {
    let timeLeft = getGameTime(gameState.gamesPlayed);
    
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
        const messageLines = [
            "💔 Time's up!",
            "Watch the timer next time!"
        ];
        showMessage(messageLines.join('\n'), 'error', true);
    } else {
        // No lives left - Game Over
        const messageLines = [
            'Game Over!',
            `Final Score: ${playerStats.totalScore}`,
            `Games Played: ${playerStats.gamesPlayed}`
        ];
        showMessage(messageLines.join('\n'), 'error no-lives', true, true);
    }
}
function handleWin() {
    gameState.isGameOver = true;
    stopTimer();

    if (gameState.isCasualMode) {
        // Increment the counter immediately when winning in casual mode
        playerStats.gamesPlayed++;
        document.getElementById('pauseGamesPlayedCasual').textContent = playerStats.gamesPlayed;
        document.getElementById('gamesPlayedCount').textContent = playerStats.gamesPlayed;

        const messageLines = [
            'Nice work!',
            `Games Played: ${playerStats.gamesPlayed}`
        ];
        showMessage(messageLines.join('\n'), 'success');
    } else {
        // Full stats for normal mode
        const timeRemaining = parseInt(document.getElementById('timer').textContent);
        const gameData = {
            timeRemaining,
            movesUsed: gameState.moveCount,
            optimalMoves: calculateOptimalMoves(gameState.maze),
            retryCount: gameState.retryCount,
            winStreak: gameState.winStreak,
            lives: gameState.lives,
            gamesPlayed: playerStats.gamesPlayed
        };

        const result = playerStats.addGameResult(`level${gameState.level}`, gameData);
        gameState.winStreak++;

        // Update games played display
        document.getElementById('gamesPlayedCount').textContent = playerStats.gamesPlayed;
        document.getElementById('pauseGamesPlayed').textContent = playerStats.gamesPlayed;

        const messageLines = [
            'Nice job!',
            `Total Score: ${result.totalScore}`,
            `Score: +${result.baseScore}`
        ];

        const gamesPlayedCount = document.getElementById('gamesPlayedCount');
        if (gamesPlayedCount) {
            gamesPlayedCount.textContent = playerStats.gamesPlayed;
        }
    
        if (result.streakBonus > 0) {
            messageLines.push(
                `Win Streak Bonus: +${result.streakBonus} (${result.currentStreak} wins)`
            );
        }
    
        messageLines.push(
            `Games Played: ${playerStats.gamesPlayed}`
        );
    
        showMessage(messageLines.join('\n'), 'success');
        
        // Your existing postMessage code remains the same
        window.parent.postMessage({
            type: 'gameOver',
            data: { 
                won: true,
                remainingKeys: gameState.keys,
                shouldShowBonusKey: gameState.keys < MAX_KEYS,
                lives: gameState.lives,
                isCasualMode: gameState.isCasualMode,
                totalScore: result.totalScore,
                baseScore: result.baseScore,
                streakBonus: result.streakBonus,
                gamesPlayed: playerStats.gamesPlayed,
                winStreak: playerStats.winStreak
            }
        }, '*');
    }

    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
        retryButton.style.display = 'block';
    }
}
function handleTrap(trapType = '') {
    gameState.isGameOver = true;
    stopTimer();
    
    // Decrease lives and store in playerStats
    const newLives = gameState.lives - 1;
    gameState.lives = newLives;
    playerStats.currentLives = newLives;
    updateLives(newLives);
    
    showTopRightMessage('Lost 1 life!');

    // Get trap-specific message
    function getTrapLoseMessage(type) {
        switch (type) {
            case 'trap1':
                return ['💔 You fell into a hole!', 'Watch your step next time!'];
            case 'trap2':
                return ['💔 The snake bit you!', 'Be more careful around snakes!'];
            case 'trap3':
                return ['💔 The spider bit you!', 'Keep an eye out for webs!'];
            default:
                return ['Oh no! You fell into a trap!', 'Be more careful next time!'];
        }
    }

    if (newLives > 0) {
        // Still has lives left
        const messageLines = getTrapLoseMessage(trapType);
        showMessage(messageLines.join('\n'), 'error', true);
    } else {
        // Game over - no lives left
        const messageLines = [
            'Game Over!',
            `Final Score: ${playerStats.totalScore}`,
            `Games Played: ${playerStats.gamesPlayed}`
        ];
        showMessage(messageLines.join('\n'), 'error no-lives', true, true);
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
        showTopRightMessage('Gained bonus karma!');
    }

    window.parent.postMessage({
        type: 'nextGame',
        data: { 
            lives: gameState.lives,
            isFirstGame: false,
            gamesPlayed: playerStats.gamesPlayed
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
    let messageOverlay = document.getElementById('message-overlay');
    if (!messageOverlay) {
        messageOverlay = document.createElement('div');
        messageOverlay.id = 'message-overlay';
        document.body.appendChild(messageOverlay);
    }

    const messageEl = document.getElementById('message');
    messageEl.innerHTML = '';
    messageEl.dataset.gameWon = 'false';
    messageEl.dataset.gameRetry = 'false';
    
    // Create stats container with win announcement
    const statsContainer = document.createElement('div');
    statsContainer.className = 'pause-stats';
    
    // Split message into lines
    const lines = text.split('\n');
    
    // First line styling based on message type
    const announcementText = document.createElement('div');
    if (type === 'success') {
        announcementText.className = 'stat-item win-announcement';
    } else if (type === 'error no-lives') {
        announcementText.className = 'stat-item gameover-announcement';
    } else {
        announcementText.className = 'stat-item error-announcement';
    }
    announcementText.textContent = lines[0];
    statsContainer.appendChild(announcementText);
    
    // Rest of the lines as smaller stats
    const statsElements = [];  // Store elements for animation
    lines.slice(1).forEach(line => {
        const textDiv = document.createElement('div');
        textDiv.className = 'stat-item smaller';
        textDiv.textContent = line;
        statsElements.push(textDiv);
        statsContainer.appendChild(textDiv);
    });
    
    messageEl.appendChild(statsContainer);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'pause-buttons';

    // Create buttons based on message type, with initial disabled state
    const createButtons = () => {
        if (showQuitOnly) {
            const quitButton = document.createElement('button');
            quitButton.className = 'pause-button disabled';
            quitButton.textContent = 'Quit Game';
            quitButton.onclick = newGame;
            quitButton.disabled = true;
            buttonContainer.appendChild(quitButton);
        } else if (type === 'success') {
            const nextButton = document.createElement('button');
            nextButton.className = 'pause-button disabled';
            nextButton.textContent = 'Next Game';
            nextButton.onclick = handleNextGame;
            nextButton.disabled = true;
            buttonContainer.appendChild(nextButton);
            messageEl.dataset.gameWon = 'true';

            const quitButton = document.createElement('button');
            quitButton.className = 'pause-button disabled';
            quitButton.textContent = 'Quit Game';
            quitButton.onclick = newGame;
            quitButton.disabled = true;
            buttonContainer.appendChild(quitButton);
        } else if (type === 'error' && permanent && !showQuitOnly) {
            const retryButton = document.createElement('button');
            retryButton.className = 'pause-button disabled';
            retryButton.textContent = 'Try Again';
            retryButton.disabled = true;
            retryButton.onclick = () => {
                retryLevel();
                messageEl.style.display = 'none';
                messageOverlay.style.display = 'none';
                clearGameEndState();
            };
            buttonContainer.appendChild(retryButton);
            messageEl.dataset.gameRetry = 'true';

            const quitButton = document.createElement('button');
            quitButton.className = 'pause-button disabled';
            quitButton.textContent = 'Quit Game';
            quitButton.onclick = newGame;
            quitButton.disabled = true;
            buttonContainer.appendChild(quitButton);
        }
    };

    createButtons();
    messageEl.appendChild(buttonContainer);
    messageEl.style.display = 'block';
    messageOverlay.style.display = 'flex';

    // Function to enable buttons
    const enableButtons = () => {
        buttonContainer.querySelectorAll('button').forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');
        });
    };

    // Handle score animation for success messages
    if (type === 'success') {
        const totalScoreEl = statsElements.find(el => el.textContent.startsWith('Total Score:'));
        const baseScoreEl = statsElements.find(el => el.textContent.startsWith('Score: +'));

        if (totalScoreEl && baseScoreEl) {
            const totalScore = parseInt(totalScoreEl.textContent.split(': ')[1]);
            const baseScore = parseInt(baseScoreEl.textContent.split('+')[1]);
            const startScore = totalScore - baseScore;

            // Start with initial score
            totalScoreEl.textContent = `Total Score: ${startScore}`;

            // Animate score increment
            let currentScore = startScore;
            const fps = 60;
            const duration = 1500; // 1.5 seconds
            const increment = baseScore / (fps * (duration / 1000));

            const scoreInterval = setInterval(() => {
                currentScore += increment;
                if (currentScore >= totalScore) {
                    currentScore = totalScore;
                    clearInterval(scoreInterval);
                    
                    // Enable buttons after score animation
                    setTimeout(enableButtons, 500);
                }
                totalScoreEl.textContent = `Total Score: ${Math.floor(currentScore)}`;
            }, 1000 / fps);
        } else {
            // No score to animate, enable buttons after delay
            setTimeout(enableButtons, 1000);
        }
    } else {
        // For non-success messages, enable buttons after delay
        setTimeout(enableButtons, 1000);
    }
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
function handleIdlePrompt() {
    // Different threshold for first time vs subsequent times
    const initialIdleThreshold = 5000; // 5 seconds for first idle
    const subsequentIdleThreshold = 2000; // 2 seconds for subsequent idles
    const now = Date.now();
    
    // Determine which threshold to use based on whether player has moved
    const currentThreshold = gameState.hasPlayerMoved ? subsequentIdleThreshold : initialIdleThreshold;
    
    if (!gameState.isGameOver && !isPaused && (now - gameState.lastMoveTime > currentThreshold)) {
        if (!gameState.idlePromptVisible) {
            showIdlePrompt();
            gameState.idlePromptVisible = true;
        }
    } else if (gameState.idlePromptVisible) {
        hideIdlePrompt();
        gameState.idlePromptVisible = false;
    }
}
function showIdlePrompt() {
    // Create prompt with same styling as game prompt
    const existingPrompt = document.getElementById('idle-prompt');
    if (existingPrompt) {
        existingPrompt.remove();
    }

    const promptElement = document.createElement('div');
    promptElement.id = 'idle-prompt';
    promptElement.style.position = 'fixed';
    promptElement.style.top = '90px';  // Below timer
    promptElement.style.left = '50%';
    promptElement.style.transform = 'translateX(-50%)';
    promptElement.style.color = 'white';
    promptElement.style.fontSize = '17px';
    promptElement.style.padding = '10px';
    promptElement.style.zIndex = '1000';
    promptElement.style.textAlign = 'center';
    promptElement.style.opacity = '1';
    promptElement.style.transition = 'opacity 0.5s ease-in-out';
    promptElement.style.backgroundColor = '#1a1a1a';
    promptElement.style.borderRadius = '8px';
    promptElement.textContent = 'Interact to move!';

    document.body.appendChild(promptElement);

    // Add pulse effect to adjacent cells
    document.querySelectorAll('.adjacent').forEach(cell => {
        cell.classList.add('adjacent-pulse');
    });
}

function hideIdlePrompt() {
    const promptContainer = document.getElementById('idle-prompt');
    const textContainer = document.querySelector('#idle-prompt + div');  // Get the text container
    
    if (promptContainer) {
        promptContainer.style.opacity = '0';
        if (textContainer) textContainer.style.opacity = '0';
        setTimeout(() => {
            promptContainer.remove();
            if (textContainer) textContainer.remove();
        }, 500);
    }
    
    document.querySelectorAll('.adjacent').forEach(cell => {
        cell.classList.remove('adjacent-pulse');
    });
}
function showGamePrompt(message) {
    const existingPrompt = document.getElementById('game-prompt');
    if (existingPrompt) {
        existingPrompt.remove();
    }

    const promptElement = document.createElement('div');
    promptElement.id = 'game-prompt';
    promptElement.style.position = 'fixed';
    promptElement.style.top = '90px';  // Below timer
    promptElement.style.left = '50%';
    promptElement.style.transform = 'translateX(-50%)';
    promptElement.style.color = 'white';
    promptElement.style.fontSize = '17px';
    promptElement.style.padding = '10px';
    promptElement.style.zIndex = '1000';
    promptElement.style.textAlign = 'center';
    promptElement.style.opacity = '1';
    promptElement.style.transition = 'opacity 0.5s ease-in-out';
    promptElement.style.backgroundColor = '#1a1a1a';
    promptElement.style.borderRadius = '8px';
    promptElement.textContent = message;

    document.body.appendChild(promptElement);

    // Fade out and remove after 5 seconds
    setTimeout(() => {
        promptElement.style.opacity = '0';
        setTimeout(() => promptElement.remove(), 500);
    }, 4000);
}

// 8. PAUSE MENU
function pauseGame() {
    if (!isPaused) {
        if (!gameState.isCasualMode && timerInterval) {
            clearInterval(timerInterval);
            savedTimeLeft = parseInt(document.getElementById('timer').textContent);
        }
        
        const normalStats = document.querySelector('.normal-mode-stats');
        const casualStats = document.querySelector('.casual-mode-stats');
        
        if (gameState.isCasualMode) {
            normalStats.style.display = 'none';
            casualStats.style.display = 'block';
            document.getElementById('pauseGamesPlayedCasual').textContent = playerStats.gamesPlayed;
            document.getElementById('gamesPlayedCount').textContent = playerStats.gamesPlayed;  // Update top-right counter too
        } else {
            normalStats.style.display = 'block';
            casualStats.style.display = 'none';
            document.getElementById('pauseTotalScore').textContent = playerStats.totalScore;
            document.getElementById('pauseGamesPlayed').textContent = playerStats.gamesPlayed;
            document.getElementById('gamesPlayedCount').textContent = playerStats.gamesPlayed;  // Update top-right counter too
        }

        document.getElementById('pause-overlay').style.display = 'flex';
        isPaused = true;
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
            
            // Store all image URLs
            playerImageUrl = message.data.playerImageUrl || '';
            keyPowerupImageUrl = message.data.keyPowerupImageUrl || '';
            mapImageUrl = message.data.mapImageUrl || '';
            crystalBallImageUrl = message.data.crystalBallImageUrl || '';
            
            // Set CSS variables for all images
            document.documentElement.style.setProperty('--player-image-url', `url('${playerImageUrl}')`);
            document.documentElement.style.setProperty('--key-powerup-image-url', `url('${keyPowerupImageUrl}')`);
            document.documentElement.style.setProperty('--map-image-url', `url('${mapImageUrl}')`);
            document.documentElement.style.setProperty('--crystal-ball-image-url', `url('${crystalBallImageUrl}')`);
            document.documentElement.style.setProperty('--trap1-image-url', `url('${message.data.trap1ImageUrl}')`);
            document.documentElement.style.setProperty('--trap2-image-url', `url('${message.data.trap2ImageUrl}')`);
            document.documentElement.style.setProperty('--trap3-image-url', `url('${message.data.trap3ImageUrl}')`);
            document.documentElement.style.setProperty('--door-crack1-url', `url('${message.data.doorCrack1ImageUrl}')`);
            document.documentElement.style.setProperty('--door-crack2-url', `url('${message.data.doorCrack2ImageUrl}')`);
            document.documentElement.style.setProperty('--door-crack3-url', `url('${message.data.doorCrack3ImageUrl}')`);
            
            // Initialize game with combined data
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

    // Start the idle prompt checker
    setInterval(handleIdlePrompt, 1000);

    // Check for player idle state every 500ms
    setInterval(handlePlayerIdle, 500);

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
function getTrapDisarmMessage(trapType) {
    switch (trapType) {
        case 'trap1':
            return 'Used 2 karma to cover the hole!';
        case 'trap2':
            return 'Used 2 karma to charm the snake!';
        case 'trap3':
            return 'Used 2 karma to shoo the spider away!';
        default:
            return 'Used 2 karma to disarm trap!';
    }
}