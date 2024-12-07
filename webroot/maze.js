let initializationAttempts = 0;
const MAX_ATTEMPTS = 5;
let timerInterval;
const GAME_TIME = 30;
let isPaused = false;
let savedTimeLeft = null;
let initialKeys = 3;

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

console.log(gameState); // Ensure it has a `keys` property

// Constants for scoring
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

// Calculate score for a single game
function calculateGameScore(gameData) {
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

// Calculate rating out of 5 stars
function calculateStarRating(gameData) {
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

// Track overall player stats
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

// Update life display function
function updateLives(newLives) {
    gameState.lives = newLives;
    const hearts = document.querySelectorAll('.heart-icon');
    hearts.forEach((heart, index) => {
        heart.setAttribute('data-filled', index < newLives ? 'true' : 'false');
    });
}

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
    const viewRadius = gameState.mapUsed ? 3 : 1; // 2 gives 5x5, 1 gives 3x3
    
    // Add current position and adjacent tiles to visible set
    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX < gameState.maze[0].length && 
                newY >= 0 && newY < gameState.maze.length) {
                newVisible.add(`${newX},${newY}`);
                // Always add to explored tiles since that's the default behavior now
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
                
                // Always show powerups with glow
                if (cell === 'crystal-ball' || cell === 'map' || cell === 'key-powerup') {
                    cellElement.classList.add('powerup-glow');
                }

                if (newVisible.has(key)) {
                    cellElement.classList.remove('fog', 'explored');
                    cellElement.classList.add('visible');
                } else if (gameState.exploredTiles.has(key)) {
                    // Show explored tiles as the default now
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

// Add keyboard controls
window.addEventListener('keydown', (event) => {
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

let initialMaze = null; // Store initial maze for retry

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

    // Initialize game state
    gameState = {
        ...gameState,
        username: data.username || 'Developer',
        keys: playerStats.currentKeys || 3,
        initialKeysForMaze: playerStats.currentKeys || 3, // Store initial keys
        maze: data.maze,
        playerPosition: findStartPosition(data.maze),
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

    const grid = document.getElementById('maze-grid');
    const cellSize = 40;
    
    // Set the grid size explicitly (to ensure stable dimensions)
    grid.style.gridTemplateColumns = `repeat(${data.maze[0].length}, ${cellSize}px)`;
    grid.style.gridTemplateRows = `repeat(${data.maze.length}, ${cellSize}px)`;

    const viewportWidth = grid.clientWidth;
    const viewportHeight = grid.clientHeight;

    // Set initial camera offset
    gameState.cameraOffset = {
        x: Math.floor(viewportWidth / 2) - (gameState.playerPosition.x * cellSize),
        y: Math.floor(viewportHeight / 2) - (gameState.playerPosition.y * cellSize)
    };
    grid.style.transform = `translate(${gameState.cameraOffset.x}px, ${gameState.cameraOffset.y}px)`;

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

    renderMaze(); // Call renderMaze after camera offset is applied
    updateVisibility();
    startTimer();
    hideLoading();

    // Add focus to game container for immediate keyboard control
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.focus();
    }
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


window.addEventListener('keydown', (event) => {
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

    // Get door position and create animation first
    const doorElement = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (!doorElement) return;

    showTopRightMessage('Used 1 key to unlock door!');

    const rect = doorElement.getBoundingClientRect();

    // Determine split direction
    const { x: playerX, y: playerY } = gameState.playerPosition;
    const dx = Math.abs(x - playerX);
    const dy = Math.abs(y - playerY);
    const isVertical = dy > dx; // This logic is fine and remains the same

    // Create animation container
    const animContainer = document.createElement('div');
    animContainer.className = `door-animation ${isVertical ? 'horizontal' : 'vertical'}`; // Swap 'horizontal' and 'vertical'
    animContainer.style.left = `${rect.left}px`;
    animContainer.style.top = `${rect.top}px`;

    // Create split pieces
    if (isVertical) {
        // When dy > dx, the door splits left/right
        const leftPiece = document.createElement('div');
        leftPiece.className = 'door-piece left';
        const rightPiece = document.createElement('div');
        rightPiece.className = 'door-piece right';
        animContainer.appendChild(leftPiece);
        animContainer.appendChild(rightPiece);
    } else {
        // When dx > dy, the door splits top/bottom
        const topPiece = document.createElement('div');
        topPiece.className = 'door-piece top';
        const bottomPiece = document.createElement('div');
        bottomPiece.className = 'door-piece bottom';
        animContainer.appendChild(topPiece);
        animContainer.appendChild(bottomPiece);
    }

    // Add to overlay
    const overlay = document.getElementById('animation-overlay');
    if (overlay) {
        overlay.appendChild(animContainer);
    }

    // Update game state
    gameState.keys--;
    gameState.maze[y][x] = 'path';
    
    // Update the key display
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
        }
    }
    
    // Render maze after state update
    renderMaze();

    // Clean up animation after it completes
    setTimeout(() => {
        if (animContainer) {
            animContainer.remove();
        }
    }, 500);

    // Send message
    window.parent.postMessage({
        type: 'unlockDoor',
        data: { position: { x, y } }
    }, '*');
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
    }, 3000); // Show message for x seconds

    // Remove the message completely after fade-out transition
    setTimeout(() => {
        messageEl.remove();
    }, 4000); // Matches fade-out duration (2s display + 0.3s fade)
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

// Add key capacity limit
const MAX_KEYS = 12;

function activateKeyPowerup() {
    if (gameState.keys >= MAX_KEYS) {
        showTopRightMessage('Bag full!');
        return;
    }
    
    gameState.keys += 3;
    if (gameState.keys > MAX_KEYS) {
        gameState.keys = MAX_KEYS;
    }
    
    // Update the keys display
    const keyStat = document.querySelector('.key-stat');
    if (keyStat) {
        keyStat.dataset.count = gameState.keys;
        const keysEl = keyStat.querySelector('#keys');
        if (keysEl) {
            keysEl.textContent = gameState.keys;
        }
    }
    
    showTopRightMessage('Found 3 keys!');
}

function handleTrap() {
    gameState.isGameOver = true;
    stopTimer();
    
    // Decrease lives and store in playerStats
    const newLives = gameState.lives - 1;
    gameState.lives = newLives;
    playerStats.currentLives = newLives; // Add this line to persist lives
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

// Also update the renderMaze function to maintain the revealed state
function renderMaze(movementClass = '') {
    const grid = document.getElementById('maze-grid');
    if (!gameState.maze || !gameState.maze[0]) return;

    // Calculate and apply camera offset
    const viewportWidth = grid.clientWidth;
    const viewportHeight = grid.clientHeight;
    const cellSize = 40;
    
    gameState.cameraOffset = {
        x: Math.floor(viewportWidth/2) - (gameState.playerPosition.x * cellSize),
        y: Math.floor(viewportHeight/2) - (gameState.playerPosition.y * cellSize)
    };
    grid.style.transform = `translate(${gameState.cameraOffset.x}px, ${gameState.cameraOffset.y}px)`;

    grid.style.gridTemplateColumns = `repeat(${gameState.maze[0].length}, 40px)`;
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

function retryGame() {
    // Send retry message to parent
    window.parent.postMessage({
        type: 'retry'
    }, '*');
}

// Add this helper function to calculate optimal moves:
function calculateOptimalMoves(maze) {
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
    return ['path', 'door', 'crystal-ball', 'map', 'key-powerup', 'exit', 'fake-exit', 'trap'].includes(cellType);
}

function showMessage(text, type, permanent = false, showQuitOnly = false) {
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
        // Add quit button below Games Played
        const quitButton = document.createElement('button');
        quitButton.textContent = 'Quit Game';
        quitButton.onclick = newGame;
        quitButton.style.marginTop = '10px';  // Add some space above the button
        messageEl.appendChild(quitButton);
    } else if (type === 'success') {
        // Normal success message handling
        const spacerDiv = document.createElement('div');
        messageEl.appendChild(spacerDiv);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next Game (Or Press Enter)';
        nextButton.onclick = handleNextGame;
        messageEl.appendChild(nextButton);
        messageEl.dataset.gameWon = 'true';
    } else if (type === 'error' && permanent && !showQuitOnly) {
        // Normal error message handling with retry option
        const spacerDiv = document.createElement('div');
        messageEl.appendChild(spacerDiv);

        const retryButton = document.createElement('button');
        retryButton.textContent = 'Try Again (Or Press Enter)';
        retryButton.onclick = () => {
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

function handleNextGame() {
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