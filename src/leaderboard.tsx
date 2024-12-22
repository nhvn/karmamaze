import { Devvit, useState } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

// Types
type LeaderboardEntry = {
  username: string;
  score: number;
  lastUpdated: number;
};

// Constants
export const LEADERBOARD_KEY = 'maze_leaderboard';
const MAX_ENTRIES = 10;

// Leaderboard Component
export const Leaderboard = ({ context, onBack }: { context: Context; onBack: () => void }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(async () => {
    try {
      const data = await LeaderboardManager.getLeaderboard(context);
      return data;
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      return [];
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reloadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await LeaderboardManager.getLeaderboard(context);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <vstack padding="medium" gap="medium" grow backgroundColor="#2a2a2a">
      {/* Header */}
      <vstack alignment="middle center" padding="small">
        <hstack width="100%" alignment="middle center">
          <hstack width="10%" />
          <text size="xlarge" weight="bold" color="white" grow alignment="middle center">Legendary Adventurers</text>
          <hstack 
            width="10%" 
            alignment="end" 
            onPress={onBack}
            padding="small"
          >
            <text size="large" weight="bold" color="white">✕</text>
          </hstack>
        </hstack>
        <text size="small" color="#888888">Top 10 Players</text>
      </vstack>

      {/* Error Message */}
      {error && (
        <vstack padding="medium" alignment="middle center">
          <text color="red">{error}</text>
          <button 
            onPress={reloadLeaderboard}
            appearance="secondary"
          >
            Retry
          </button>
        </vstack>
      )}

      {/* Loading State */}
      {loading ? (
        <vstack padding="large" alignment="middle center">
          <text color="white">Loading scores...</text>
        </vstack>
      ) : (
        /* Leaderboard Table */
        <vstack 
          border="thin"
          borderColor="#4a4a4a"
          padding="none"
          gap="none"
          cornerRadius="small"
        >
          {/* Table Header */}
          <hstack
            padding="small"
            gap="medium"
            backgroundColor="#57b0e5"
          >
            <text width="8%" weight="bold" color="white">#</text>
            <text width="62%" weight="bold" color="white">Player</text>
            <text width="30%" weight="bold" alignment="end" color="white">Score</text>
          </hstack>

          {/* Table Body */}
          {entries && entries.length > 0 ? (
            entries.map((entry, index) => (
              <hstack 
                key={`${entry.username}-${index}`}
                padding="small"
                gap="medium"
                backgroundColor={index % 2 === 0 ? '#333333' : '#2a2a2a'}
              >
                <text width="8%" color="white">{index + 1}</text>
                <text width="62%" color="white">{entry.username}</text>
                <text width="30%" alignment="end" color="white">{entry.score.toLocaleString()}</text>
              </hstack>
            ))
          ) : (
            <vstack padding="large" alignment="middle center" backgroundColor="#2a2a2a">
              <text color="white">No scores yet. Be the first!</text>
            </vstack>
          )}
        </vstack>
      )}
    </vstack>
  );
};

// Leaderboard Manager
export const LeaderboardManager = {
  async updateLeaderboard(
    context: Context,
    newEntry: { username: string; score: number }
  ): Promise<void> {
    const leaderboardData = await context.redis.get(LEADERBOARD_KEY);
    let entries: LeaderboardEntry[] = leaderboardData ? JSON.parse(leaderboardData) : [];

    const existingIndex = entries.findIndex(
      entry => entry.username === newEntry.username
    );

    const updatedEntry = {
      username: newEntry.username,
      score: newEntry.score,
      lastUpdated: Date.now()
    };

    if (existingIndex !== -1) {
      if (newEntry.score > entries[existingIndex].score) {
        entries[existingIndex] = updatedEntry;
        entries.sort((a, b) => b.score - a.score);
      }
    } else {
      entries.push(updatedEntry);
      entries.sort((a, b) => b.score - a.score);
      entries = entries.slice(0, MAX_ENTRIES);
    }

    await context.redis.set(LEADERBOARD_KEY, JSON.stringify(entries));
  },

  async getLeaderboard(context: Context): Promise<LeaderboardEntry[]> {
    const leaderboardData = await context.redis.get(LEADERBOARD_KEY);
    if (!leaderboardData) return [];
    return JSON.parse(leaderboardData);
  },

  async resetLeaderboard(context: Context): Promise<void> {
    await context.redis.del(LEADERBOARD_KEY);
  }
};