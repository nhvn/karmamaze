import './createPost.js';
import { Devvit, useState } from '@devvit/public-api';

// Define message types for game state communication
type WebViewMessage =
  | {
      type: 'initialData';
      data: { username: string; karma: number; maze: MazeCell[][] };
    }
  | {
      type: 'movePlayer';
      data: { position: Position };
    }
  | {
      type: 'unlockDoor';
      data: { position: Position; karmaSpent: number };
    }
  | {
      type: 'gameOver';
      data: { won: boolean; remainingKarma: number };
    }
  | {
      type: 'retry';
    };

// Define types for maze structure
type MazeCell = 'path' | 'wall' | 'door' | 'start' | 'exit';
type Position = { x: number; y: number };
type GameState = {
  maze: MazeCell[][];
  playerPosition: Position;
  unlockedDoors: Position[];
};
type UserData = {
  username: string;
  karma: number;
};

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
      
      if (Math.random() < 0.35) { // 35% chance for walls
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
        
        if (wallCount >= 2 && Math.random() < 0.15) {
          maze[y][x] = 'door';
        }
      }
    }
  }

  // Ensure path to exit exists
  let pathExists = isPathReachable(maze, { x: 1, y: startY }, { x: width - 2, y: exitY });
  while (!pathExists) {
    // Clear a path if none exists
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

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add the Karma Maze game as a custom post type
Devvit.addCustomPostType({
  name: 'Karma Maze',
  height: 'tall',
  render: (context) => {
    // Get current user and their karma
    const [userData, setUserData] = useState<UserData | null>(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return {
        username: currUser?.username ?? 'developer',
        karma: 1000 // Default karma for testing
      };
    });

    // Load or initialize game state
    const [gameState, setGameState] = useState<GameState>(() => ({
      maze: generateMaze(16, 8), 
      playerPosition: { x: 1, y: 1 },
      unlockedDoors: []
    }));

    // Track webview visibility
    const [webviewVisible, setWebviewVisible] = useState(false);

    const onMessage = async (msg: WebViewMessage) => {
      console.log('Received message from webview:', msg);
      
      // Handle devvit message wrapper
      const message = ('data' in msg && 'message' in msg.data) 
          ? (msg.data as any).message 
          : msg;
      
      if (message.type === 'retry') {
          // Generate new maze
          const newMaze = generateMaze(16, 8);
          setGameState({
              maze: newMaze,
              playerPosition: { x: 1, y: 1 },
              unlockedDoors: []
          });
  
          // Send new game data
          const initMessage: WebViewMessage = {
              type: 'initialData',
              data: {
                  username: userData?.username ?? 'Developer',
                  karma: userData?.karma ?? 1000,
                  maze: newMaze
              }
          };
          context.ui.webView.postMessage('mazeGame', initMessage);
          return;
      }
  
      if (!gameState || !userData) {
          console.error('Missing game state or user data');
          return;
      }
  
      switch (message.type) {
          case 'movePlayer':
              const newMoveState = {
                  ...gameState,
                  playerPosition: message.data.position
              };
              setGameState(newMoveState);
              await context.redis.set(`maze_${context.postId}`, JSON.stringify(newMoveState));
              break;
          
          case 'unlockDoor':
              if (userData.karma >= message.data.karmaSpent) {
                  const newUnlockState = {
                      ...gameState,
                      unlockedDoors: [...gameState.unlockedDoors, message.data.position]
                  };
                  setGameState(newUnlockState);
                  await context.redis.set(`maze_${context.postId}`, JSON.stringify(newUnlockState));
              }
              break;
          
          case 'gameOver':
              await context.redis.del(`maze_${context.postId}`);
              break;
  
          default:
              console.log('Unknown message type:', message.type);
              break;
      }
  };

    // Initialize and show the game
    const onStartGame = () => {
      if (!userData) {
        console.error('No user data available');
        return;
      }
    
      console.log('Starting game...');
      
      // Generate a new maze
      const newMaze = generateMaze(16, 8);
      console.log('Generated new maze:', newMaze);
      
      // Update game state
      setGameState({
        maze: newMaze,
        playerPosition: { x: 1, y: 1 },
        unlockedDoors: []
      });
    
      // Make webview visible immediately
      setWebviewVisible(true);
      
      // Send initial data immediately
      const message: WebViewMessage = {
        type: 'initialData',
        data: {
          username: userData.username,
          karma: userData.karma,
          maze: newMaze
        }
      };
    
      try {
        console.log('Sending initial data:', message);
        context.ui.webView.postMessage('mazeGame', message);
      } catch (error) {
        console.error('Error sending data:', error);
      }
    };

    // Render the game interface
    return (
      <vstack grow padding="small">
        <vstack
          grow={!webviewVisible}
          height={webviewVisible ? '0%' : '100%'}
          alignment="middle center"
        >
          <text size="xlarge" weight="bold">
            Karma Maze
          </text>
          <spacer />
          <vstack alignment="start middle">
            <hstack>
              <text size="medium">Username:</text>
              <text size="medium" weight="bold">
                {' '}
                {userData?.username ?? 'anon'}
              </text>
            </hstack>
            <hstack>
              <text size="medium">Available Karma:</text>
              <text size="medium" weight="bold">
                {' '}
                {userData?.karma ?? 0}
              </text>
            </hstack>
          </vstack>
          <spacer />
          <text size="medium">
            Navigate through the maze using your karma to unlock doors. Can you reach the exit?
          </text>
          <spacer />
          <button onPress={onStartGame}>Start Game</button>
        </vstack>
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
      </vstack>
    );
  },
});

// Add menu item to create new game
Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Start Karma Maze',
  onPress: async (_, context) => {
    const currentSubreddit = await context.reddit.getCurrentSubreddit();
    await context.reddit.submitPost({
      title: 'Karma Maze Challenge',
      subredditName: currentSubreddit.name,
      preview: (
        <vstack>
          <text>Loading Karma Maze...</text>
        </vstack>
      ),
    });
    context.ui.showToast(`Created new Karma Maze in ${currentSubreddit.name}`);
  },
});

export default Devvit;