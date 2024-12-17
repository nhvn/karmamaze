import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay = ({ onBack }: HowToPlayProps) => (
  <vstack padding="medium" gap="medium" grow backgroundColor="#2a2a2a" width="100%">
    {/* Header - match leaderboard styling exactly */}
    <vstack alignment="middle center" padding="small">
      <hstack width="100%" alignment="middle center">
        <hstack width="10%" />
        <text size="xlarge" weight="bold" color="white" grow alignment="middle center">
          How to Play
        </text>
        <hstack
          width="10%"
          alignment="end"
          onPress={onBack}
          padding="small"
        >
          <text size="large" weight="bold" color="white">✕</text>
        </hstack>
      </hstack>
      <text size="small" color="#888888">Game Guide</text>
    </vstack>

    {/* Main Content Container */}
    <vstack alignment="center middle" backgroundColor="#4a4a4a" cornerRadius="small">
      <vstack
        padding="none"
        gap="none"
        maxWidth="600px"
      >
        <vstack padding="medium" gap="medium">
          {/* Game Modes */}
          <vstack gap="small" width="100%">
            <text color="white" wrap={true} grow>
              Play as an adventurous Snoo navigating through mysterious mazes, using karma to unlock doors, discover secrets, and find the exit.
            </text>
          </vstack>

          <vstack>
            <text color="white" wrap={true} grow>
                Controls: Move using WASD keys or tap/click adjacent tiles.
                </text>
          </vstack>

          <vstack gap="none" width="100%">
            <hstack gap="small" alignment="start" grow>
              <text color="white" wrap={true} grow>
                Casual Mode: Unlimited karma, no time pressure, perfect for learning.
              </text>
            </hstack>
            <hstack gap="small" alignment="start" grow>
              <text color="white" wrap={true} grow>
              Challenge Mode: Race against time, manage karma wisely, compete for high scores.
              </text>
            </hstack>
          </vstack>

          {/* Power-Ups Section */}
          <vstack gap="none" width="100%">
            <hstack gap="small" alignment="start" grow>
              <image url="karma.png" imageWidth={16} imageHeight={16} />
              <text color="white" wrap={true} grow>
                Karma: Collect karma to unlock doors or escape traps.
              </text>
            </hstack>

            <hstack gap="small" alignment="start" grow>
              <image url="map.png" imageWidth={16} imageHeight={16} />
              <text color="white" wrap={true} grow>
                Map: Expand your visible radius to plan your path.
              </text>
            </hstack>

            <hstack gap="small" alignment="start" grow>
              <image url="crystal.png" imageWidth={16} imageHeight={16} />
              <text color="white" wrap={true} grow>
                Crystal Ball: Reveal the true exit and dangerous areas.
              </text>
            </hstack>
          </vstack>
        </vstack>
      </vstack>
    </vstack>
  </vstack>
);


export default HowToPlay;