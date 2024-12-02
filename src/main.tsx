import './createPost.js';
import { Devvit, useState } from '@devvit/public-api';

// Define message types for game state communication
type WebViewMessage =
  | {
      type: 'initialData';
      data: { 
        username: string; 
        keys: number; 
        maze: MazeCell[][]; 
        level: number;
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
      data: { won: boolean };
    }
  | {
      type: 'retry';
    }
  | {
      type: 'newGame';
    };

// Define types for maze structure
type MazeCell = 'path' | 'wall' | 'door' | 'start' | 'exit' | 'fake-exit' | 'crystal-ball' | 'map' | 'key-powerup';
type Position = { x: number; y: number };
type GameState = {
  maze: MazeCell[][];
  playerPosition: Position;
  unlockedDoors: Position[];
};
type UserData = {
  username: string;
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

function generateLevel2Maze(width: number, height: number): MazeCell[][] {
  const maze = generateMaze(width, height); // Use existing maze generator as base
  
  // Find existing exit and start positions
  let startPos = { x: 0, y: 0 };
  let exitPos = { x: 0, y: 0 };

  // Clear all outer walls (except leftmost and rightmost columns)
  for (let y = 0; y < height; y++) {
      if (y === 0 || y === height - 1) {
          for (let x = 1; x < width - 1; x++) {
              maze[y][x] = 'path'; // Convert outer walls to paths except edges
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

  // Add fake exit
  let fakeExitPlaced = false;
  while (!fakeExitPlaced) {
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      if (y !== exitPos.y && maze[y][width-1] === 'wall') {
          maze[y][width-1] = 'fake-exit';
          fakeExitPlaced = true;
      }
  }

  // Place crystal ball in a valid path location
  let crystalBallPlaced = false;
  while (!crystalBallPlaced) {
      const x = Math.floor(Math.random() * (width - 2)) + 1;
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      // Only place on path tiles, not walls or doors
      if (maze[y][x] === 'path' && 
          // Make sure it's not right next to the start
          !(x === startPos.x && y === startPos.y) && 
          // Make sure it's not right next to the exit
          !(x === exitPos.x && y === exitPos.y)) {
          maze[y][x] = 'crystal-ball';
          crystalBallPlaced = true;
      }
  }

  let mapPlaced = false;
  while (!mapPlaced) {
      const x = Math.floor(Math.random() * (width - 2)) + 1;
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      const currentCell = maze[y][x];
      
      // Only place on path tiles, not walls or doors
      if (currentCell === 'path' && 
          // Make sure it's not right next to the start
          !(x === startPos.x && y === startPos.y) && 
          // Make sure it's not right next to the exit
          !(x === exitPos.x && y === exitPos.y)) {
          maze[y][x] = 'map';
          mapPlaced = true;
      }
  }

  // Place key powerup in a valid path location
  let keyPowerupPlaced = false;
  while (!keyPowerupPlaced) {
      const x = Math.floor(Math.random() * (width - 2)) + 1;
      const y = Math.floor(Math.random() * (height - 2)) + 1;
      const currentCell = maze[y][x];
      
      // Only place on path tiles, not walls or doors
      if (currentCell === 'path' && 
          // Make sure it's not right next to the start
          !(x === startPos.x && y === startPos.y) && 
          // Make sure it's not right next to the exit
          !(x === exitPos.x && y === exitPos.y)) {
          maze[y][x] = 'key-powerup';
          keyPowerupPlaced = true;
      }
  }

  return maze;
}

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Then your custom post type and other code follows
Devvit.addCustomPostType({
  name: 'Key Maze',
  height: 'tall',
  render: (context) => {
    const [currentLevel, setCurrentLevel] = useState(1);  // Add it here
    const [userData, setUserData] = useState<UserData | null>(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return {
        username: currUser?.username ?? 'developer'
      };
    });

    const [gameState, setGameState] = useState<GameState>(() => ({
      maze: generateMaze(14, 8), 
      playerPosition: { x: 1, y: 1 },
      unlockedDoors: []
    }));

    const [webviewVisible, setWebviewVisible] = useState(false);

    const onMessage = async (msg: WebViewMessage) => {
      console.log('Received message from webview:', msg);
      
      const message = ('data' in msg && 'message' in msg.data) 
          ? (msg.data as any).message 
          : msg;
      
      if (message.type === 'newGame') {
          setWebviewVisible(false);  // Return to level selection
          return;
      }
      
      if (message.type === 'retry') {
          const newMaze = generateMaze(14, 8);
          setGameState({
              maze: newMaze,
              playerPosition: { x: 1, y: 1 },
              unlockedDoors: []
          });
  
          const initMessage: WebViewMessage = {
              type: 'initialData',
              data: {
                  username: userData?.username ?? 'Developer',
                  keys: 1,
                  maze: newMaze,
                  level: 2
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
              const newUnlockState = {
                  ...gameState,
                  unlockedDoors: [...gameState.unlockedDoors, message.data.position]
              };
              setGameState(newUnlockState);
              await context.redis.set(`maze_${context.postId}`, JSON.stringify(newUnlockState));
              break;
          
          case 'gameOver':
              await context.redis.del(`maze_${context.postId}`);
              break;
      }
    };

    const onStartGame = () => {
      if (!userData) {
        console.error('No user data available');
        return;
      }
    
      console.log('Starting game... Level:', currentLevel);
      
      // Generate maze based on level
      const newMaze = currentLevel === 1 ? generateMaze(14, 8) : generateLevel2Maze(14, 8);
      console.log('Generated new maze:', newMaze);
      
      setGameState({
        maze: newMaze,
        playerPosition: { x: 1, y: 1 },
        unlockedDoors: []
      });
    
      setWebviewVisible(true);
      
      const message: WebViewMessage = {
        type: 'initialData',
        data: {
          username: userData.username,
          keys: currentLevel === 1 ? 3 : 1,  // Start with 3 keys in Level 1
          maze: newMaze,
          level: currentLevel
        }
      };
    
      try {
        console.log('Sending initial data:', message);
        context.ui.webView.postMessage('mazeGame', message);
      } catch (error) {
        console.error('Error sending data:', error);
      }
    };

    return (
      <vstack grow padding="small">
        <vstack
          grow={!webviewVisible}
          height={webviewVisible ? '0%' : '100%'}
          alignment="middle center"
        >
          <text size="xlarge" weight="bold">
            Key Maze
          </text>
          <spacer />
          <vstack alignment="start middle">
            <hstack>
              <text size="medium" weight="bold">
                {' '}
                {userData?.username ?? 'anon'}
              </text>
            </hstack>
          </vstack>
          <spacer />
          <text size="medium">
            {currentLevel === 1 
              ? 'Navigate through the maze using keys to unlock doors. Can you reach the exit?' 
              : 'Find the crystal ball to reveal the true exit! Watch out for traps!'}
          </text>
          <spacer />
          <button onPress={onStartGame}>Start Game</button>
          <hstack>
              <text size="medium">Current Level: {currentLevel}</text>
            </hstack>
        <hstack>
              {/* <text size="medium">Select Level:</text> */}
              <button onPress={() => setCurrentLevel(1)}>Level 1</button>
              <button onPress={() => setCurrentLevel(2)}>Level 2</button>
            </hstack>
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

Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Start Key Maze',
  onPress: async (_, context) => {
    const currentSubreddit = await context.reddit.getCurrentSubreddit(); // Not getCurrentUser
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

export default Devvit;