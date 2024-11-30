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
      type: 'ready';
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

let hasStarted = false;

// Maze generation function
function generateMaze(width: number, height: number): MazeCell[][] {
    // Initialize maze with walls
    const maze: MazeCell[][] = Array(height).fill(null)
        .map(() => Array(width).fill('wall') as MazeCell[]);
    
    // Create a random path using depth-first search
    const stack: Array<[number, number]> = [];
    const start: [number, number] = [1, 1];
    
    maze[start[1]][start[0]] = 'start';
    stack.push(start);

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        if (!current) break;
        
        const [x, y] = current;
        const neighbors: Array<[number, number]> = [];
        
        if (x + 2 < width - 1) neighbors.push([x + 2, y]);
        if (x - 2 > 0) neighbors.push([x - 2, y]);
        if (y + 2 < height - 1) neighbors.push([x, y + 2]);
        if (y - 2 > 0) neighbors.push([x, y - 2]);

        const validNeighbors = neighbors.filter(([nx, ny]) => maze[ny][nx] === 'wall');

        if (validNeighbors.length === 0) {
            stack.pop();
            continue;
        }

        const [nx, ny] = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
        maze[ny][nx] = 'path';
        maze[y + Math.sign(ny - y)][x + Math.sign(nx - x)] = 'path';
        stack.push([nx, ny]);
    }

    // Add doors
    const doorCount = Math.floor((width * height) * 0.1);
    let doorsPlaced = 0;
    
    while (doorsPlaced < doorCount) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        
        if (maze[y][x] === 'path') {
            maze[y][x] = 'door';
            doorsPlaced++;
        }
    }

    // Place exit
    let maxDistance = 0;
    let exitPos: [number, number] = [width - 2, height - 2];
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (maze[y][x] === 'path') {
                const distance = Math.abs(x - start[0]) + Math.abs(y - start[1]);
                if (distance > maxDistance) {
                    maxDistance = distance;
                    exitPos = [x, y];
                }
            }
        }
    }
    
    maze[exitPos[1]][exitPos[0]] = 'exit';
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
      maze: generateMaze(8, 8),
      playerPosition: { x: 1, y: 1 },
      unlockedDoors: []
    }));

    // Track webview visibility
    const [webviewVisible, setWebviewVisible] = useState(false);

    // Handle messages from the webview
    const onMessage = async (msg: WebViewMessage) => {
      console.log('Received message from webview:', msg);
    
      if (msg.type === 'ready') {
        console.log('Webview is ready, sending initial data');
        if (!userData) {
          console.error('No user data available');
          return;
        }
    
        const message: WebViewMessage = {
          type: 'initialData',
          data: {
            username: userData.username,
            karma: userData.karma,
            maze: gameState.maze
          }
        };
    
        try {
          console.log('Sending initial data to webview:', message);
          context.ui.webView.postMessage('mazeGame', message);
        } catch (error) {
          console.error('Error sending data:', error);
        }
        return;
      }
    
      if (!gameState || !userData) {
        console.error('Missing game state or user data');
        return;
      }
    
      switch (msg.type) {
        case 'movePlayer':
          const newMoveState = {
            ...gameState,
            playerPosition: msg.data.position
          };
          setGameState(newMoveState);
          await context.redis.set(`maze_${context.postId}`, JSON.stringify(newMoveState));
          break;
        
        case 'unlockDoor':
          if (userData.karma >= msg.data.karmaSpent) {
            const newUnlockState = {
              ...gameState,
              unlockedDoors: [...gameState.unlockedDoors, msg.data.position]
            };
            setGameState(newUnlockState);
            await context.redis.set(`maze_${context.postId}`, JSON.stringify(newUnlockState));
          }
          break;
        
        case 'gameOver':
          await context.redis.del(`maze_${context.postId}`);
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
      const newMaze = generateMaze(8, 8);
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