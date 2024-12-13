import './createPost.js';
import { Devvit, useState } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import { Leaderboard, LeaderboardManager, checkPersonalHighScore } from './leaderboard.js';  // Note: use .js even though file is .tsx
import { HowToPlay } from './howToPlay.js';

// 1. TYPES & INTERFACES
type WebViewMessage =
  | {
      type: 'initialData';
      data: { 
        username: string; 
        keys: number; 
        maze: MazeCell[][]; 
        level: number;
        lives: number;
        gamesPlayed?: number;
        isRetry?: boolean; 
        isNewGame?: boolean;
        shouldShowBonusKey?: boolean;
        isCasualMode?: boolean;
        playerImageUrl?: string;
        keyPowerupImageUrl?: string;
        mapImageUrl?: string;
        crystalBallImageUrl?: string;
      };
    }
  | {
      type: 'movePlayer';
      data: { position: Position };
    }
  | {
      type: 'unlockDoor';
      data: { position: Position };
    }
  | {
      type: 'gameOver';
      data: { 
        won: boolean;
        lives?: number;
        isCasualMode?: boolean; // Add this field
      };
    }
  | {
      type: 'retry';
    }
  | {
      type: 'newGame';
    };
type MazeCell = 'path' | 'wall' | 'door' | 'start' | 'exit' | 'fake-exit' | 'crystal-ball' | 'map' | 'key-powerup' | 'trap';
type Position = { x: number; y: number };
type GameState = {
  maze: MazeCell[][];
  playerPosition: Position;
  unlockedDoors: Position[];
  gamesPlayed: number;
  winStreak: number;
  totalScore: number;
};
type UserData = {
  username: string;
};
type PlayerStats = {
  gamesPlayed: number;
  currentKeys: number;
  currentLives: number;
};

// 2. MAZE GENERATION
function isPathReachable(maze: MazeCell[][], start: Position, end: Position): boolean {
  const queue: Position[] = [start];
  const visited = new Set<string>();
  const width = maze[0].length;
  const height = maze.length;

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    if (x === end.x && y === end.y) return true;

    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
      const newX = x + dx;
      const newY = y + dy;
      const key = `${newX},${newY}`;

      if (
        newX >= 0 &&
        newY >= 0 &&
        newX < width &&
        newY < height &&
        !visited.has(key) &&
        (maze[newY][newX] === 'path' || maze[newY][newX] === 'door' || maze[newY][newX] === 'exit')
      ) {
        visited.add(key);
        queue.push({ x: newX, y: newY });
      }
    });
  }
  return false;
}
function generateMaze(width: number, height: number): MazeCell[][] {
  // Initialize maze with paths
  const maze: MazeCell[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill('path') as MazeCell[]);

  // Create only the outer border walls
  for (let x = 0; x < width; x++) {
    maze[0][x] = 'wall';
    maze[height - 1][x] = 'wall';
  }
  for (let y = 0; y < height; y++) {
    maze[y][0] = 'wall';
    maze[y][width - 1] = 'wall';
  }

  // Place the start and exit
  const startY = Math.floor(Math.random() * (height - 2)) + 1;
  maze[startY][0] = 'start';
  maze[startY][1] = 'path';

  const exitY = Math.floor(Math.random() * (height - 2)) + 1;
  maze[exitY][width - 1] = 'exit';
  maze[exitY][width - 2] = 'path';

  // Create walls throughout the maze, including near edges
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Skip start and exit areas
      if ((x === 1 && y === startY) || (x === width - 2 && y === exitY)) continue;
      
      if (Math.random() < 0.35) {
        maze[y][x] = 'wall';
      }
    }
  }

  // Add doors throughout, including near edges
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (maze[y][x] === 'path') {
        let wallCount = 0;
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
          if (maze[y + dy]?.[x + dx] === 'wall') wallCount++;
        });
        
        if (wallCount >= 1 && Math.random() < 0.30) {
          maze[y][x] = 'door';
        }
      }
    }
  }

  // Ensure path to exit exists
  let pathExists = isPathReachable(maze, { x: 1, y: startY }, { x: width - 2, y: exitY });
  while (!pathExists) {
    let x = width - 2;
    let y = exitY;
    
    while (x > 1) {
      maze[y][x] = Math.random() < 0.2 ? 'door' : 'path';
      if (y > startY && Math.random() < 0.3) y--;
      if (y < startY && Math.random() < 0.3) y++;
      x--;
    }
    
    pathExists = isPathReachable(maze, { x: 1, y: startY }, { x: width - 2, y: exitY });
  }

  return maze;
}
function generateLevel2Maze(width: number, height: number, gamesPlayed: number = 0, isCasualMode: boolean = false): MazeCell[][] {
  console.log('Generating Level 2 maze with games played:', gamesPlayed);
  console.log('Casual Mode:', isCasualMode);
  const maze = generateMaze(width, height);

  // Find existing exit and start positions
  let startPos = { x: 0, y: 0 };
  let exitPos = { x: 0, y: 0 };

  // Clear all outer walls (except leftmost and rightmost columns)
  for (let y = 0; y < height; y++) {
    if (y === 0 || y === height - 1) {
      for (let x = 1; x < width - 1; x++) {
        maze[y][x] = 'path';
      }
    }
  }

  // Find start and exit positions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (maze[y][x] === 'start') {
        startPos = { x, y };
      } else if (maze[y][x] === 'exit') {
        exitPos = { x, y };
      }
    }
  }

  // Skip special elements if in casual mode
  if (isCasualMode) {
    return maze;
  }

  // Add first fake exit (if path exists)
  let fakeExitPlaced = false;
  let attempts = 0;
  const maxAttempts = 50;

  if (gamesPlayed >= 3) {
    while (!fakeExitPlaced && attempts < maxAttempts) {
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      if (y !== exitPos.y && maze[y][width - 1] === 'wall') {
        if (maze[y][width - 2] === 'path') {
          maze[y][width - 1] = 'fake-exit';
          fakeExitPlaced = true;
          console.log('Placed first fake exit with connected path at:', y);
        }
      }
      attempts++;
    }
  }

  // Add second fake exit only if games played is 10 or more
  if (gamesPlayed >= 10) {
    console.log('Attempting to add second fake exit (10+ games played)');
    let secondFakeExitPlaced = false;
    attempts = 0;

    while (!secondFakeExitPlaced && attempts < maxAttempts) {
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      if (
        y !== exitPos.y &&
        maze[y][width - 1] === 'wall' &&
        maze[y][width - 1] !== 'fake-exit'
      ) {
        if (maze[y][width - 2] === 'path') {
          maze[y][width - 1] = 'fake-exit';
          secondFakeExitPlaced = true;
          console.log('Placed second fake exit with connected path at:', y);
        }
      }
      attempts++;
    }
  }

  // Place crystal ball in a valid, reachable path location only if games played >= 3
  if (gamesPlayed >= 3) {
    let crystalBallPlaced = false;
    while (!crystalBallPlaced) {
      const x = Math.floor(Math.random() * (width - 2)) + 1;
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      
      if (
        maze[y][x] === 'path' &&
        !(x === startPos.x && y === startPos.y) &&
        !(x === exitPos.x && y === exitPos.y)
      ) {
        const isReachable = isPathReachable(maze, startPos, { x, y });
        
        if (isReachable) {
          maze[y][x] = 'crystal-ball';
          crystalBallPlaced = true;
          console.log('Placed crystal ball at reachable position:', x, y);
        }
      }
    }
  }

  // Place map in a valid, reachable path location
  let mapPlaced = false;
  while (!mapPlaced) {
    const x = Math.floor(Math.random() * (width - 2)) + 1;
    const y = Math.floor(Math.random() * (height - 2)) + 1;
    
    if (
      maze[y][x] === 'path' &&
      !(x === startPos.x && y === startPos.y) &&
      !(x === exitPos.x && y === exitPos.y)
    ) {
      const isReachable = isPathReachable(maze, startPos, { x, y });
      
      if (isReachable) {
        maze[y][x] = 'map';
        mapPlaced = true;
        console.log('Placed map at reachable position:', x, y);
      }
    }
  }

  // Place key powerup(s) in valid, reachable path locations
  const placeKeyPowerup = (maze: MazeCell[][], startPos: Position, exitPos: Position) => {
    let position = { x: 0, y: 0 };
    let placed = false;
    
    while (!placed) {
      const x = Math.floor(Math.random() * (width - 2)) + 1;
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      
      if (
        maze[y][x] === 'path' &&
        !(x === startPos.x && y === startPos.y) &&
        !(x === exitPos.x && y === exitPos.y)
      ) {
        const isReachable = isPathReachable(maze, startPos, { x, y });
        
        if (isReachable) {
          maze[y][x] = 'key-powerup';
          position = { x, y };
          placed = true;
          console.log('Placed key powerup at reachable position:', x, y);
        }
      }
    }
    return position;
  };

  // Determine number of key powerups based on games played
  let numKeyPowerups;
  if (gamesPlayed < 10) {
    // 70% chance of 1, 30% chance of 2
    numKeyPowerups = Math.random() < 0.7 ? 1 : 2;
    console.log(`Games played ${gamesPlayed} (< 10): Placing ${numKeyPowerups} powerup(s)`);
  } else {
    // 70% chance of 2, 30% chance of 3
    numKeyPowerups = Math.random() < 0.7 ? 2 : 3;
    console.log(`Games played ${gamesPlayed} (>= 10): Placing ${numKeyPowerups} powerup(s)`);
  }

  // Place powerups
  const keyPowerupPositions = [];
  for (let i = 0; i < numKeyPowerups; i++) {
    const position = placeKeyPowerup(maze, startPos, exitPos);
    keyPowerupPositions.push(position);
  }

  // Store key powerup rewards
  const keyPowerupRewards = keyPowerupPositions.map(() => {
    if (gamesPlayed < 10) {
      // Games 1-9: Each powerup gives 1-2 keys randomly
      return Math.floor(Math.random() * 2 + 1); // Will give either 1 or 2
    } else {
      // Games 10+: Each powerup gives 1-3 keys randomly
      return Math.floor(Math.random() * 3 + 1); // Will give 1, 2, or 3
    }
  });

  // Update trap frequency based on games played
  let trapFrequency = 0;
  if (gamesPlayed >= 20) {
    trapFrequency = 0.18;
    console.log('20+ games: Setting trap frequency to 18%');
  } else if (gamesPlayed >= 10) {
    trapFrequency = 0.12;
    console.log('10+ games: Setting trap frequency to 12%');
  } else if (gamesPlayed >= 3) {
    trapFrequency = 0.05;
    console.log('3+ games: Setting trap frequency to 5%');
  }
  console.log('Final trap frequency:', trapFrequency);

  // Only add traps if win streak is 3 or more
  if (gamesPlayed >= 3) {
    let trapCount = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (maze[y][x] === 'path') {
          const isNearStart = x <= 2;
          const isNearExit = x === width - 2 && y === exitPos.y;
          const hasAdjacentDoor = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => 
            maze[y + dy]?.[x + dx] === 'door'
          );

          if (!isNearStart && !isNearExit && !hasAdjacentDoor && Math.random() < trapFrequency) {
            maze[y][x] = 'trap';
            trapCount++;
          }
        }
      }
    }
    console.log(`Placed ${trapCount} traps in the maze`);
  }

  return maze;
}

// 3. DEVVIT CONFIGURATION
Devvit.configure({
  redditAPI: true,
  redis: true,
});

// 4. GAME COMPONENT
Devvit.addCustomPostType({
  name: 'Key Maze',
  height: 'tall',
  render: (context: Context) => {
    const [currentLevel, setCurrentLevel] = useState(2);
    const [webviewVisible, setWebviewVisible] = useState(false);
    const [currentView, setCurrentView] = useState<'menu' | 'game' | 'leaderboard' | 'howToPlay'>('menu');
    const [userData] = useState<UserData | null>(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return {
        username: currUser?.username ?? 'developer'
      };
    });

    const [playerStats, setPlayerStats] = useState<PlayerStats>(() => ({
      gamesPlayed: 0,
      currentKeys: 3,
      currentLives: 3
    }));

    const [gameState, setGameState] = useState<GameState>(() => ({
      maze: generateMaze(18, 9),
      playerPosition: { x: 1, y: 1 },
      unlockedDoors: [],
      gamesPlayed: 0,
      winStreak: 0,
      totalScore: 0
  }));

    const onMessage = async (msg: WebViewMessage) => {
      const message = ('data' in msg && 'message' in msg.data) 
        ? (msg.data as any).message 
        : msg;
      
      if (!gameState || !userData) {
        console.error('Missing game state or user data');
        return;
      }    
    
      switch (message.type) {
        case 'newGame':
          setGameState(prevState => ({
            ...prevState,
            gamesPlayed: 0
          }));
          setWebviewVisible(false);
          setCurrentView('menu');  // Add this line
          return;

        case 'movePlayer':
          const newMoveState = {
            ...gameState,
            playerPosition: message.data.position
          };
          setGameState(newMoveState);
          await context.redis.set(`maze_${context.postId}`, JSON.stringify(newMoveState));
          break;
        
        case 'unlockDoor':
          const newUnlockState = {
            ...gameState,
            unlockedDoors: [...gameState.unlockedDoors, message.data.position]
          };
          setGameState(newUnlockState);
          await context.redis.set(`maze_${context.postId}`, JSON.stringify(newUnlockState));
          break;
        
          case 'gameOver': {
            // Increment games played immediately
            const newGamesPlayed = gameState.gamesPlayed + 1;
            
            // Update game state with new count
            setGameState(prevState => ({
                ...prevState,
                gamesPlayed: newGamesPlayed
            }));
        
            if (message.data.won && message.data.totalScore) {
                try {
                    const username = userData?.username ?? 'Developer';
                    const newScore = message.data.totalScore;
                    
                    const isPersonalBest = await checkPersonalHighScore(context, username, newScore);
                    
                    await LeaderboardManager.updateLeaderboard(context, {
                        username,
                        score: newScore
                    });
              
                    context.ui.webView.postMessage('mazeGame', {
                        type: 'highScoreResult',
                        isPersonalBest
                    });
                } catch (error) {
                    console.error('Error in game over:', error);
                    context.ui.webView.postMessage('mazeGame', {
                        type: 'highScoreResult',
                        isPersonalBest: false
                    });
                }
            }
            
            const gameOverPlayerImageUrl = await context.assets.getURL('snoo.png');
            const gameOverKeyPowerupImageUrl = await context.assets.getURL('karma.png');
            const gameOverMapImageUrl = await context.assets.getURL('map.png');
            const gameOverCrystalBallImageUrl = await context.assets.getURL('crystal.png');
            
            setPlayerStats(prevStats => ({
                ...prevStats,
                currentLives: message.data.lives || prevStats.currentLives
            }));
            
            await context.redis.set(`maze_${context.postId}`, JSON.stringify({
                ...gameState,
                gamesPlayed: newGamesPlayed
            }));
          
            if (!message.data.won) {
                const newMaze = currentLevel === 1 
                    ? generateMaze(18, 9) 
                    : generateLevel2Maze(18, 9, newGamesPlayed);
              
                const updateMessage: WebViewMessage = {
                    type: 'initialData',
                    data: {
                        username: userData?.username ?? 'Developer',
                        keys: playerStats.currentKeys || 3,
                        maze: newMaze,
                        level: currentLevel,
                        gamesPlayed: newGamesPlayed,
                        lives: playerStats.currentLives,
                        isRetry: true,
                        playerImageUrl: gameOverPlayerImageUrl,
                        keyPowerupImageUrl: gameOverKeyPowerupImageUrl,
                        mapImageUrl: gameOverMapImageUrl,
                        crystalBallImageUrl: gameOverCrystalBallImageUrl
                    }
                };
                context.ui.webView.postMessage('mazeGame', updateMessage);
            }
            break;
        }
        case 'nextGame':
          // Calculate new count
          const updatedGamesPlayed = gameState.gamesPlayed + 1;
      
          // Generate maze immediately with new count
          const nextMaze = currentLevel === 1 
              ? generateMaze(18, 9) 
              : generateLevel2Maze(18, 9, updatedGamesPlayed);  // Use new count directly
          
          // Get image URLs concurrently
          const [
              nextGamePlayerImageUrl,
              nextGameKeyPowerupImageUrl,
              nextGameMapImageUrl,
              nextGameCrystalBallImageUrl
          ] = await Promise.all([
              context.assets.getURL('snoo.png'),
              context.assets.getURL('karma.png'),
              context.assets.getURL('map.png'),
              context.assets.getURL('crystal.png')
          ]);
          
          // Show bonus message if needed
          if (message.data.won && message.data.shouldShowBonusKey) {
              context.ui.webView.postMessage('mazeGame', {
                  type: 'showMessage',
                  data: { 
                      message: currentLevel === 1 
                          ? 'Restored to 12 karma!' 
                          : 'Found 1 bonus karma!'
                  }
              });
          }        
      
          // Send next game message
          const nextGameMessage: WebViewMessage = {
              type: 'initialData',
              data: {
                  username: userData?.username ?? 'Developer',
                  keys: currentLevel === 1 ? Infinity : (playerStats.currentKeys || 3),
                  maze: nextMaze,
                  level: currentLevel,
                  gamesPlayed: updatedGamesPlayed,
                  lives: playerStats.currentLives,
                  playerImageUrl: nextGamePlayerImageUrl,
                  keyPowerupImageUrl: nextGameKeyPowerupImageUrl,
                  mapImageUrl: nextGameMapImageUrl,
                  crystalBallImageUrl: nextGameCrystalBallImageUrl,
                  isCasualMode: currentLevel === 1
              }
          };
          context.ui.webView.postMessage('mazeGame', nextGameMessage);
      
          // Update state after sending the message
          setGameState(prevState => ({
              ...prevState,
              gamesPlayed: updatedGamesPlayed
          }));
          break;
            
        case 'retry':
          // Don't reset games played on retry
          const retryMaze = currentLevel === 1 
              ? generateMaze(18, 9) 
              : generateLevel2Maze(18, 9, gameState.gamesPlayed);
          
          // Get the image URLs for retry
          const retryPlayerImageUrl = await context.assets.getURL('snoo.png');
          const retryKeyPowerupImageUrl = await context.assets.getURL('karma.png');
          const retryMapImageUrl = await context.assets.getURL('map.png');
          const retryCrystalBallImageUrl = await context.assets.getURL('crystal.png');
          
          const retryState = {
              ...gameState,
              lives: playerStats.currentLives,
              maze: retryMaze,
              playerPosition: { x: 1, y: 1 },
              unlockedDoors: []
          };
          
          setGameState(retryState);
          
          const retryMessage: WebViewMessage = {
              type: 'initialData',
              data: {
                  username: userData?.username ?? 'Developer',
                  lives: playerStats.currentLives,
                  keys: currentLevel === 1 ? Infinity : 3,
                  maze: retryMaze,
                  level: currentLevel,
                  gamesPlayed: gameState.gamesPlayed,
                  playerImageUrl: retryPlayerImageUrl,
                  keyPowerupImageUrl: retryKeyPowerupImageUrl,
                  mapImageUrl: retryMapImageUrl,
                  crystalBallImageUrl: retryCrystalBallImageUrl
              }
          };
          
          context.ui.webView.postMessage('mazeGame', retryMessage);
          break;
      }
    };

    const toggleMode = () => {
      setCurrentLevel(prev => prev === 1 ? 2 : 1);
    };

    const onStartGame = async () => {
      if (!userData) {
          console.error('No user data available');
          return;
      }
      
      const isCasualMode = currentLevel === 1;
      const newMaze = currentLevel === 1 
          ? generateMaze(18, 9) 
          : generateLevel2Maze(18, 9, gameState?.gamesPlayed || 0, isCasualMode);
      
      // Get the player image URL
      const playerImageUrl = await context.assets.getURL('snoo.png');
      const keyPowerupImageUrl = await context.assets.getURL('karma.png');
      const mapImageUrl = await context.assets.getURL('map.png');
      const crystalBallImageUrl = await context.assets.getURL('crystal.png');
      
      setWebviewVisible(true);
      setCurrentView('game');
      
      const message: WebViewMessage = {
          type: 'initialData',
          data: {
              username: userData.username,
              lives: playerStats.currentLives,
              keys: currentLevel === 1 ? Infinity : 3,
              maze: newMaze,
              level: currentLevel,
              gamesPlayed: gameState?.gamesPlayed || 0,
              isNewGame: true,
              isCasualMode: isCasualMode,
              playerImageUrl: playerImageUrl,
              keyPowerupImageUrl: keyPowerupImageUrl,
              mapImageUrl: mapImageUrl,
              crystalBallImageUrl: crystalBallImageUrl
          }
      };
      
      try {
          context.ui.webView.postMessage('mazeGame', message);
      } catch (error) {
          console.error('Error sending data:', error);
      }
  };

  return (
<zstack width="100%" height="100%" alignment="middle center">
  {/* Background Image */}
  <image
    url="menuBg.jpg"
    imageHeight={1024}
    imageWidth={1024}
    height="100%"
    width="100%"
    resizeMode="cover"
    description="Menu background"
  />

  {/* Content Container */}
  <vstack grow alignment="middle center" padding="small">
    {currentView === 'menu' ? (
      // Menu View
      <vstack
        grow={!webviewVisible}
        height={webviewVisible ? '0%' : '100%'}
        alignment="middle center"
      >
        {/* Logo/Title */}
        <image
          url="kmazeCover.png"
          imageWidth={300}
          imageHeight={150}
        />
        <spacer size="medium" />

        {/* Mode Selection */}
        <hstack alignment="middle center" gap="medium">
          <hstack
            onPress={toggleMode}
            padding="medium" // Added padding for larger touch target
            alignment="middle center"
          >
            <text size="large" weight="bold">{'<'}</text>
          </hstack>

          <text size="large" weight="bold">
            {currentLevel === 1 ? 'Casual' : 'Normal'}
          </text>

          <hstack
            onPress={toggleMode}
            padding="medium" // Added padding for larger touch target
            alignment="middle center"
          >
            <text size="large" weight="bold">{'>'}</text>
          </hstack>
        </hstack>

        {/* Mode Description */}
        <vstack alignment="middle center" padding="small" width="100%">
          <vstack alignment="middle center" width="80%" maxWidth="100%">
            <text size="medium">
              {currentLevel === 2
                ? 'Race against time in the unknown!'
                : 'Chill experience for a chill guy.'}
            </text>
          </vstack>
        </vstack>
        <spacer size="medium" />

        {/* Main Buttons */}
        <vstack gap="small">
          <button onPress={onStartGame}>Play</button>
          <button onPress={() => setCurrentView('leaderboard')}>Leaderboard</button>
          <button onPress={() => setCurrentView('howToPlay')}>How to Play</button>
        </vstack>
      </vstack>
    ) : currentView === 'leaderboard' ? (
      // Leaderboard View
      <Leaderboard
        context={context}
        onBack={() => setCurrentView('menu')}
      />
    ) : currentView === 'game' ? (
      // Game View
      <vstack grow={webviewVisible} height={webviewVisible ? '100%' : '0%'}>
        <vstack border="thick" borderColor="black" height={webviewVisible ? '100%' : '0%'}>
          <webview
            id="mazeGame"
            url="maze.html"
            onMessage={(msg) => onMessage(msg as WebViewMessage)}
            grow
            height={webviewVisible ? '100%' : '0%'}
          />
        </vstack>
      </vstack>
    ) : currentView === 'howToPlay' ? (
      <HowToPlay onBack={() => setCurrentView('menu')} />
    ) : null}
  </vstack>
</zstack>

  );
  
  }
});

// 5. MENU ITEMS (outside of the CustomPostType)
Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Start Key Maze',
  onPress: async (_, context) => {
    const currentSubreddit = await context.reddit.getCurrentSubreddit();
    if (!currentSubreddit) {
      console.error('No subreddit found');
      return;
    }
    
    await context.reddit.submitPost({
      title: 'Key Maze Challenge',
      subredditName: currentSubreddit.name,
      preview: (
        <vstack>
          <text>Loading Key Maze...</text>
        </vstack>
      ),
    });
    context.ui.showToast(`Created new Key Maze in ${currentSubreddit.name}`);
  },
});
Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Reset Maze Leaderboard',
  onPress: async (_, context) => {
    await LeaderboardManager.resetLeaderboard(context);
    context.ui.showToast('Leaderboard has been reset');
  },
});



export default Devvit;