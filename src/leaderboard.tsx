import { Devvit, useState } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

// Types
type LeaderboardEntry = {
  username: string;
  score: number;
  averageRating: number;
  gamesPlayed: number;
  lastUpdated: number;
};

// Constants
const LEADERBOARD_KEY = 'maze_leaderboard';
const MAX_ENTRIES = 10;

// Leaderboard Component
export const Leaderboard = ({ context, onBack }: { context: Context; onBack: () => void }) => {
  const [entries] = useState<LeaderboardEntry[]>(async () => {
    try {
      const leaderboardData = await context.redis.get(LEADERBOARD_KEY);
      return leaderboardData ? JSON.parse(leaderboardData) : [];
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      return [];
    }
  });

  return (
    <vstack padding="medium" gap="medium" grow>
      {/* Header */}
      <vstack alignment="middle center" padding="small">
        <text size="xlarge" weight="bold">Top Maze Masters</text>
        <text size="small" color="secondary">Top 10 Players</text>
      </vstack>

      {/* Leaderboard Table */}
      <vstack 
        border="thin" 
        cornerRadius="medium"
        padding="none"
        gap="none"
      >
        {/* Table Header */}
        <hstack 
          padding="small" 
          gap="medium" 
          backgroundColor="accent" 
          cornerRadius="small"
        >
          <text width="10%" weight="bold">#</text>
          <text width="30%" weight="bold">Player</text>
          <text width="20%" weight="bold" alignment="end">Score</text>
          <text width="20%" weight="bold" alignment="end">Rating</text>
          <text width="20%" weight="bold" alignment="end">Games</text>
        </hstack>

        {/* Table Body */}
        {entries && entries.length > 0 ? (
          entries.map((entry, index) => (
            <hstack 
              key={`${entry.username}-${index}`}
              padding="small"
              gap="medium"
              backgroundColor={index % 2 === 0 ? "transparent" : "secondary"}
            >
              <text width="10%">{index + 1}</text>
              <text width="30%">{entry.username}</text>
              <text width="20%" alignment="end">{entry.score.toLocaleString()}</text>
              <text width="20%" alignment="end">{entry.averageRating.toFixed(1)}⭐</text>
              <text width="20%" alignment="end">{entry.gamesPlayed}</text>
            </hstack>
          ))
        ) : (
          <vstack padding="large" alignment="middle center">
            <text>No scores yet. Be the first!</text>
          </vstack>
        )}
      </vstack>

      {/* Back Button */}
      <button onPress={onBack}>
        Back to Menu
      </button>
    </vstack>
  );
};

// Leaderboard Management Functions
export const LeaderboardManager = {
  async updateLeaderboard(
    context: Context,
    newEntry: Omit<LeaderboardEntry, 'lastUpdated'>
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
        ...newEntry,
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