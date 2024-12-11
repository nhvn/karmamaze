import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay = ({ onBack }: HowToPlayProps) => {
  return (
    <vstack padding="medium" gap="medium" grow>
      {/* Header */}
      <vstack alignment="middle center" padding="small">
        <hstack width="100%">
          <text size="xlarge" weight="bold" grow alignment="middle center">How to Play</text>
          <text size="large" weight="bold" onPress={onBack}>✕</text>
        </hstack>
      </vstack>

      {/* Content Grid */}
      <vstack gap="large" grow>
        {/* Row 1: Game Modes */}
        <hstack gap="medium" width="100%" alignment="middle center">
          <vstack gap="small" width="45%">
            <text weight="bold" size="medium">🎮 Casual Mode</text>
            <text alignment="start">• No time pressure</text>
            <text alignment="start">• No traps or fake exits</text>
            <text alignment="start">• Simple maze layouts</text>
          </vstack>

          <vstack gap="small" width="45%">
            <text weight="bold" size="medium">⚔️ Normal Mode</text>
            <text alignment="start">• 90-second time limit</text>
            <text alignment="start">• Complex mazes with traps</text>
            <text alignment="start">• Competitive leaderboard</text>
          </vstack>
        </hstack>

        {/* Row 2: Items & Hazards */}
        <hstack gap="medium" width="100%" alignment="middle center">
          <vstack gap="small" width="45%">
            <text weight="bold">Power-ups</text>
            <hstack gap="small" alignment="center">
              <image url="karma.png" imageWidth={20} imageHeight={20} />
              <text alignment="start">• Karma unlocks doors (1 karma)</text>
            </hstack>
            <hstack gap="small">
              <spacer size="medium" />
              <text alignment="start">• Disarm traps (2 karma)</text>
            </hstack>
            <hstack gap="small" alignment="center">
              <image url="map.png" imageWidth={20} imageHeight={20} />
              <text alignment="start">• Map reveals larger area</text>
            </hstack>
            <hstack gap="small" alignment="center">
              <image url="crystal.png" imageWidth={20} imageHeight={20} />
              <text alignment="start">• Crystal Ball shows traps</text>
            </hstack>
          </vstack>

          <vstack gap="small" width="45%">
            <text weight="bold">⚠️ Hazards</text>
            <text alignment="start">• Traps cost 2 keys or 1 life</text>
            <text alignment="start">• Real Exit leads to victory</text>
            <text alignment="start">• Fake Exits cost you a life</text>
          </vstack>
        </hstack>

        {/* Row 3: Scoring */}
        <hstack gap="medium" width="100%" alignment="middle center">
          <vstack gap="small" width="45%">
            <text weight="bold">🏆 Base Score</text>
            <text alignment="start">• Base: 1000 points</text>
            <text alignment="start">• Time bonus: up to +500</text>
            <text alignment="start">• Move bonus: up to +50%</text>
          </vstack>

          <vstack gap="small" width="45%">
            <text weight="bold">💫 Multipliers</text>
            <text alignment="start">• Win Streak: up to 2x</text>
            <text alignment="start">• Retry: -25% penalty</text>
            <text alignment="start">• Top scores → leaderboard!</text>
          </vstack>
        </hstack>
      </vstack>
    </vstack>
  );
};

export default HowToPlay;