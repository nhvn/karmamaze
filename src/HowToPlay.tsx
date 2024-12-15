import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay = ({ onBack }: HowToPlayProps) => {
  return (
    <vstack padding="medium" gap="medium" grow backgroundColor="#2a2a2a">
      {/* Header - Matching leaderboard style */}
      <vstack alignment="middle center" padding="small">
        <hstack width="100%" alignment="middle center">
          <hstack width="10%" />
          <text size="xlarge" weight="bold" grow alignment="middle center" color="white">How to Play</text>
          <hstack 
            width="10%" 
            alignment="end" 
            onPress={onBack}
            padding="small"
          >
            <text size="large" weight="bold" color="white">✕</text>
          </hstack>
        </hstack>
      </vstack>

      {/* Main Content Container */}
      <vstack 
        backgroundColor="#4a4a4a" 
        padding="large" 
        gap="medium"
        // cornerRadius="small"
      >
        {/* Objective Section */}
        <vstack gap="small">
          <text weight="bold" size="large" color="white">Objective</text>
          <text color="white" wrap={true}>
          Navigate the maze, collect karma, and avoid traps to find the real exit.
          </text>
        </vstack>

        {/* Power-Ups Section */}
        <vstack gap="small">
          <text weight="bold" size="large" color="white">Power-Ups</text>
          
          <hstack gap="small">
            <image url="map.png" imageWidth={20} imageHeight={20} />
            <text color="white" wrap={true}>Map: Expand your visible radius to plan your path.</text>
          </hstack>

          <hstack gap="small">
            <image url="crystal.png" imageWidth={20} imageHeight={20} />
            <text color="white" wrap={true}>Crystal Ball: Reveal the real exit and dangerous areas.</text>
          </hstack>

          <hstack gap="small">
            <image url="karma.png" imageWidth={20} imageHeight={20} />
            <text color="white" wrap={true}>Karma: Unlock doors and escape traps to stay alive.</text>
          </hstack>
        </vstack>

        {/* Scoring Section */}
        <vstack gap="small">
          <text weight="bold" size="large" color="white">Scoring</text>
          <text color="white" wrap={true}>
            Finish quickly and efficiently to earn points and climb the leaderboard!
          </text>
        </vstack>
      </vstack>
    </vstack>
  );
};

export default HowToPlay;