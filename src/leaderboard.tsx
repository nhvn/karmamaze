import { Devvit, useState } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

// Types
type LeaderboardEntry = {
  username: string;
  score: number;
  lastUpdated: number;
};

// Constants
const LEADERBOARD_KEY = 'maze_leaderboard';
const MAX_ENTRIES = 10;

// Helper function to check personal high scores
export async function checkPersonalHighScore(
  context: Context,
  username: string,
  newScore: number
): Promise<boolean> {
  try {
    const leaderboardData = await context.redis.get(LEADERBOARD_KEY);
    if (!leaderboardData) return true; // First score is always a personal best
    
    const entries: LeaderboardEntry[] = JSON.parse(leaderboardData);
    const personalBest = entries.find(entry => entry.username === username);
    
    return !personalBest || newScore > personalBest.score;
  } catch (error) {
    console.error('Error checking personal high score:', error);
    return false;
  }
}

// Leaderboard Component
export const Leaderboard = ({ context, onBack }: { context: Context; onBack: () => void }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(async () => {
    try {
      const leaderboardData = await context.redis.get(LEADERBOARD_KEY);
      const parsedData = leaderboardData ? JSON.parse(leaderboardData) : [];
      console.log('Loaded leaderboard data:', parsedData); // Debug log
      return parsedData;
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      return [];
    }
  });

  return (
    <vstack padding="medium" gap="medium" grow>
      {/* Header */}
      <vstack alignment="middle center" padding="small">
        <hstack width="100%" alignment="middle center">
          <hstack width="10%" />
          <text size="xlarge" weight="bold" grow alignment="middle center">Top Maze Masters</text>
          <hstack 
            width="10%" 
            alignment="end" 
            onPress={onBack}
            padding="small"
          >
            <text size="large" weight="bold">✕</text>
          </hstack>
        </hstack>
        <text size="small" color="#888888">Top 10 Players</text>
      </vstack>

      {/* Leaderboard Table */}
      <vstack 
        border="thin" 
        padding="none"
        gap="none"
      >
        {/* Table Header */}
        <hstack
          padding="small"
          gap="medium"
          backgroundColor="black"
        >
          <text width="5%" weight="bold" color="white">#</text>
          <text width="65%" weight="bold" color="white">Player</text>
          <text width="30%" weight="bold" alignment="end" color="white">Score</text>
        </hstack>

        {/* Table Body */}
        {entries && entries.length > 0 ? (
          entries.map((entry, index) => (
            <hstack 
              key={`${entry.username}-${index}`}
              padding="small"
              gap="medium"
              backgroundColor="white"
            >
              <text width="5%" color="black">{index + 1}</text>
              <text width="65%" color="black">{entry.username}</text>
              <text width="30%" alignment="end" color="black">{entry.score.toLocaleString()}</text>
            </hstack>
          ))
        ) : (
          <vstack padding="large" alignment="middle center">
            <text>No scores yet. Be the first!</text>
          </vstack>
        )}
      </vstack>
    </vstack>
  );
};

// Simplified Leaderboard Management Functions
export const LeaderboardManager = {
  async updateLeaderboard(
    context: Context,
    newEntry: { username: string; score: number }
  ): Promise<void> {
    try {
      // Get current leaderboard
      const leaderboardData = await context.redis.get(LEADERBOARD_KEY);
      let entries: LeaderboardEntry[] = leaderboardData 
        ? JSON.parse(leaderboardData) 
        : [];

      // Check if player already exists
      const existingIndex = entries.findIndex(
        entry => entry.username === newEntry.username
      );

      const updatedEntry = {
        username: newEntry.username,
        score: newEntry.score,
        lastUpdated: Date.now()
      };

      if (existingIndex !== -1) {
        // Update existing entry if new score is higher
        if (newEntry.score > entries[existingIndex].score) {
          entries[existingIndex] = updatedEntry;
          entries.sort((a, b) => b.score - a.score);
        }
      } else {
        // Add new entry
        entries.push(updatedEntry);
        entries.sort((a, b) => b.score - a.score);
        // Keep only top MAX_ENTRIES
        entries = entries.slice(0, MAX_ENTRIES);
      }

      // Save updated leaderboard
      await context.redis.set(LEADERBOARD_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      throw error;
    }
  },

  async getLeaderboard(context: Context): Promise<LeaderboardEntry[]> {
    try {
      const leaderboardData = await context.redis.get(LEADERBOARD_KEY);
      return leaderboardData ? JSON.parse(leaderboardData) : [];
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  },

  async resetLeaderboard(context: Context): Promise<void> {
    try {
      await context.redis.del(LEADERBOARD_KEY);
    } catch (error) {
      console.error('Error resetting leaderboard:', error);
      throw error;
    }
  }
};