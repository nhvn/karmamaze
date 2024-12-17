# Key Maze
![Karma Maze Cover](assets/Karma%20Maze.png)
Key Maze is an interactive maze game built for Reddit using the Devvit platform. Players navigate through procedurally generated mazes while collecting karma, discovering powerups, and avoiding traps. The game features both a casual mode for practice and a challenge mode for competitive play.

## Game Overview

Players can choose between two distinct game modes. Challenge mode offers a timed experience where players race against the clock, navigating through complex mazes filled with traps and fake exits while competing for high scores on the leaderboard. Casual mode provides a relaxed environment with unlimited karma, perfect for learning the game mechanics or enjoying a stress-free experience.

### Core Mechanics

The game revolves around strategic resource management and exploration. Players collect karma throughout the maze, which serves as a crucial resource for unlocking doors (1 karma) and disarming traps (2 karma). A fog-of-war system limits visibility, encouraging careful exploration and strategic planning.

Three types of powerups can be discovered:
- Karma orbs that help unlock paths and overcome obstacles (max: 12)
- Maps that temporarily expand your visible area
- Crystal balls that reveal the true exit and dangerous areas

### Progression System

As players advance through multiple games, the challenge gradually increases:
- After 3 games: Traps and fake exits begin to appear
- After 10 games: Additional fake exits and powerups
- After 20 games: Maximum maze complexity and shorter time limits

The scoring system rewards efficient play through time bonuses, move efficiency multipliers, and win streak bonuses that can multiply your score up to 2x.

## Getting Started

### Prerequisites
- Node.js (v22.2.0+)
- A test subreddit with mod privileges (under 200 members)
- Reddit account with moderator access
- Git installed on your system

### Development Setup

1. Install the Devvit CLI:
```bash
npm install -g devvit
```

2. Fork and clone the repository:
   - Visit https://github.com/nhvn/karmamaze
   - Click the "Fork" button in the top right
   - Clone your forked repository:
```bash
git clone https://github.com/[YOUR_USERNAME]/karmamaze.git
cd karmamaze
npm install
```

3. Configure Devvit:
```bash
devvit login
```

4. Start development:
```bash
devvit playtest <your-subreddit-name>
```

### Important Configuration

Before testing, ensure you've disabled the Reputation filter in your subreddit's Safety settings:
1. Navigate to: https://www.reddit.com/mod/[your_subreddit_name]/safety
2. Turn off the Reputation filter
3. Save changes

### Project Structure

The project is organized into several key components:
```
karmamaze/
├── src/               # Core React components
├── webroot/           # Game interface and logic
├── assets/           # Game images and resources
└── package.json
```

## Technical Implementation

The game is built using React components for UI and vanilla JavaScript for core game mechanics. The maze generation system creates procedural layouts that scale in complexity based on player progress. A custom fog-of-war system manages visibility while maintaining performance.

The scoring system tracks multiple factors including completion time, move efficiency, and streak bonuses to calculate final scores. All game state is managed through Redis, ensuring reliable leaderboard functionality and progress tracking.

### Development Workflow

During development:
- Changes are automatically detected and rebuilt
- View real-time logs in the terminal
- Refresh your subreddit page to see updates
- Press Ctrl+C to stop the playtest server

To deploy changes:
```bash
devvit upload
```

## Troubleshooting

Common issues and solutions:
- Post not appearing: Check subreddit's Safety Filters settings
- Playtest errors: Ensure Node.js v22.2.0+ is installed
- Build failures: Check real-time logs during playtest
- Permission issues: Verify mod privileges on test subreddit

## Credits and License

Developed by Alan Nhan using Reddit's Devvit platform. Released under the MIT License.

Copyright (c) 2024 Alan Nhan