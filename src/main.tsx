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
    };

// Define types for maze structure
type MazeCell = 'path' | 'wall' | 'door' | 'start' | 'exit';
type Position = { x: number; y: number };

// Maze generation function
function generateMaze(width: number, height: number): MazeCell[][] {
    // Initialize maze with walls
    const maze: MazeCell[][] = Array(height).fill(null)
        .map(() => Array(width).fill('wall'));
    
    // Create a random path using depth-first search
    const stack: [number, number][] = [];
    const start: [number, number] = [1, 1];
    
    maze[start[1]][start[0]] = 'start';
    stack.push(start);

    while (stack.length > 0) {
        const [x, y] = stack[stack.length - 1];
        const neighbors: [number, number][] = [
            [x + 2, y],
            [x - 2, y],
            [x, y + 2],
            [x, y - 2]
        ].filter(([nx, ny]) => 
            nx > 0 && nx < width - 1 && 
            ny > 0 && ny < height - 1 && 
            maze[ny][nx] === 'wall'
        );

        if (neighbors.length === 0) {
            stack.pop();
            continue;
        }

        const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
        maze[ny][nx] = 'path';
        maze[y + Math.sign(ny - y)][x + Math.sign(nx - x)] = 'path';
        stack.push([nx, ny]);
    }

    // Add doors (convert some paths to doors)
    const doorCount = Math.floor((width * height) * 0.1); // 10% of cells become doors
    let doorsPlaced = 0;
    
    while (doorsPlaced < doorCount) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        
        if (maze[y][x] === 'path') {
            maze[y][x] = 'door';
            doorsPlaced++;
        }
    }

    // Place exit (find the furthest point from start)
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
    const [userData] = useState(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return {
        username: currUser?.username ?? 'anon',
        karma: currUser?.totalKarma ?? 0
      };
    });

    // Load or initialize game state
    const [gameState, setGameState] = useState(async () => {
      const savedState = await context.redis.get(`maze_${context.postId}`);
      return savedState ? JSON.parse(savedState) : {
        maze: generateMaze(8, 8),
        playerPosition: { x: 1, y: 1 },
        unlockedDoors: []
      };
    });

    // Track webview visibility
    const [webviewVisible, setWebviewVisible] = useState(false);

    // Handle messages from the webview
    const onMessage = async (msg: WebViewMessage) => {
      switch (msg.type) {
        case 'movePlayer':
          // Update player position in game state
          const newState = {
            ...gameState,
            playerPosition: msg.data.position
          };
          setGameState(newState);
          await context.redis.set(`maze_${context.postId}`, JSON.stringify(newState));
          break;
        
        case 'unlockDoor':
          // Handle door unlocking with karma
          if (userData.karma >= msg.data.karmaSpent) {
            const newState = {
              ...gameState,
              unlockedDoors: [...gameState.unlockedDoors, msg.data.position]
            };
            setGameState(newState);
            await context.redis.set(`maze_${context.postId}`, JSON.stringify(newState));
          }
          break;
        
        case 'gameOver':
          // Handle game completion
          await context.redis.del(`maze_${context.postId}`);
          break;

        default:
          throw new Error(`Unknown message type: ${msg satisfies never}`);
      }
    };

    // Initialize and show the game
    const onStartGame = () => {
      setWebviewVisible(true);
      // Send initial game data to webview
      context.ui.webView.postMessage('mazeGame', {
        type: 'initialData',
        data: {
          username: userData.username,
          karma: userData.karma,
          maze: gameState.maze
        },
      });
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
                {userData.username}
              </text>
            </hstack>
            <hstack>
              <text size="medium">Available Karma:</text>
              <text size="medium" weight="bold">
                {' '}
                {userData.karma}
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