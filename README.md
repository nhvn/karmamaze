# Key Maze

Key Maze is an interactive maze game built for Reddit using the Devvit platform. Players navigate through procedurally generated mazes while collecting karma points, avoiding traps, and discovering powerups.

## Project Structure
```
karmamaze/
├── src/
│   ├── main.tsx           # Main game component and configuration
│   ├── leaderboard.tsx    # Leaderboard implementation
│   ├── howToPlay.tsx      # Game instructions component
│   └── createPost.tsx     # Post creation utilities
├── webroot/
│   ├── maze.html         # Game interface HTML
│   ├── maze.js          # Core game logic
│   ├── script.js        # Additional game scripts
│   └── style.css        # Game styling
├── assets/
│   ├── karma.png        # Karma powerup image
│   ├── map.png         # Map powerup image
│   ├── crystal.png     # Crystal ball powerup image
│   └── snoo.png        # Player character image
├── package.json
└── README.md
```

## Features

### Game Modes
- **Casual Mode**
  - Relaxed gameplay without time pressure
  - No traps or fake exits
  - Simplified maze layouts
  - Perfect for learning the game mechanics

- **Normal Mode**
  - 90-second time limit per maze
  - Complex maze layouts with traps and fake exits
  - Competitive scoring system
  - Leaderboard integration

### Game Elements

#### Powerups
- **Karma**
  - Used to unlock doors (1 karma)
  - Disarm traps (2 karma)
  - Maximum capacity: 12 karma points

- **Map**
  - Reveals a larger area around the player
  - Shows more of the maze layout

- **Crystal Ball**
  - Reveals all traps in the maze
  - Shows true and fake exits

#### Hazards
- **Doors**: Block paths, require 1 karma to unlock or can be broken after multiple hits
- **Traps**: Cost 2 karma to disarm or lose a life
- **Fake Exits**: Look like real exits but cost a life if used

### Scoring System
- Base Score: 1000 points
- Time Bonuses: Up to +500 points
- Move Efficiency: Up to +50% bonus
- Win Streak Multipliers: Up to 2x
- Retry Penalty: -25% per retry

## Installation & Development

### Prerequisites
- Node.js (v22.2.0+)
- A test subreddit that you moderate (with less than 200 members)
- A code editor (VS Code recommended)
- Reddit account with mod privileges on your test subreddit

### Initial Setup

1. Install the Devvit CLI:
```bash
npm install -g devvit
```

2. Log in to Reddit:
```bash
devvit login
```

3. Clone the repository and install dependencies:
```bash
git clone [repository-url]
cd karmamaze
npm install
```

### Development Workflow

#### Local Development
1. Make your changes to the code
2. Start playtesting with your test subreddit:
```bash
devvit playtest <your-subreddit-name>
```
3. Visit your subreddit and check the changes
4. Refresh the page to see latest changes
5. View realtime logs while playtest is active
6. Press `Ctrl + c` to stop playtest

#### Important Notes
- Turn off the Reputation filter in your subreddit's Safety Filters (mod tools)
  - Visit: https://www.reddit.com/mod/[your_subreddit_name]/safety
- Playtest automatically rebuilds and deploys as you make changes
- You can view logs in real-time during playtest

#### Deployment
When ready to deploy changes:
```bash
devvit upload
```

### Testing Checklist
1. Visit your subreddit
2. Look for "Start Key Maze" in the subreddit menu
3. Create a new maze game post
4. Test all game features:
   - Player movement
   - Powerup collection
   - Door interactions
   - Trap mechanics
   - Scoring system
   - Leaderboard functionality

### Troubleshooting
- If you don't see your post, check the Reputation filter in Safety Filters
- Ensure you're using Node.js v22.2.0 or higher
- Check the realtime logs during playtest for any errors
- Make sure you have mod privileges on the test subreddit

### Additional Resources
- [Reddit Developer Platform Documentation](https://developers.reddit.com/docs)
- [Devvit Platform Guide](https://developers.reddit.com/docs/devvit)
- [Building Interactive Posts](https://developers.reddit.com/docs/devvit/posts)

## Technical Implementation

### Core Components
- `maze.js`: Contains game logic, player movement, and maze generation
- `style.css`: Handles all game styling and animations
- `main.tsx`: Manages game state and Reddit integration
- `leaderboard.tsx`: Handles score tracking and display
- `howToPlay.tsx`: Provides game instructions and tutorials

### Key Features
- Procedurally generated mazes
- Dynamic fog of war system
- Real-time player movement
- Powerup collection and management
- Door unlocking/breaking mechanics
- Trap system with disarming mechanics
- Score tracking and leaderboard system

## Credits
- Platform: Built on Reddit's Devvit platform
- Assets: Custom game assets
- Developer: [Your Name]

## License
MIT License

Copyright (c) 2024 Alan Nhan

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.