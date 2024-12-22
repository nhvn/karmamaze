import { Devvit, useState } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay = ({ onBack }: HowToPlayProps) => {
  const [currentPage, setCurrentPage] = useState<number>(0);
  
  const pages = [
    // Page 1 - Introduction
    <vstack key="page-1" padding="medium" gap="medium" alignment="middle center">
      <image url="move.gif" imageWidth={180} imageHeight={180} />
      <text color="white" weight="bold" size="large" alignment="center">Explore The Maze</text>
      <vstack maxWidth="420px">
        <text color="white" wrap={true} alignment='center' grow>
          Play as an adventurous Snoo navigating through mysterious mazes, discover secrets and escape. Move by tapping on adjacent tiles or using the WASD keys when on a desktop.
        </text>
      </vstack>
    </vstack>,

    // Page 2 - Game Modes
    <vstack key="page-2" padding="medium" gap="medium" alignment="middle center">
      <image url="temp.png" imageWidth={180} imageHeight={180} />
      <text color="white" weight="bold" size="large" alignment="center">Game Modes</text>
      <vstack maxWidth="420px">
        <text color="white" wrap={true} alignment='center' grow>
          Choose Casual Mode for unlimited karma and no time pressure, perfect for learning, or Challenge Mode to race against time, manage karma wisely, and compete for high scores.
        </text>
      </vstack>
    </vstack>,

    // Page 3 - Power-Ups
    <vstack key="page-3" padding="medium" gap="medium" alignment="middle center">
      <image url="temp.png" imageWidth={180} imageHeight={180} />
      <text color="white" weight="bold" size="large" alignment="center">Power-Ups</text>
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
  ];

  const nextPage = () => {
    setCurrentPage((prevPage: number) => (prevPage + 1) % pages.length);
  };

  const prevPage = () => {
    setCurrentPage((prevPage: number) => (prevPage - 1 + pages.length) % pages.length);
  };

  return (
    <vstack padding="medium" gap="medium" grow backgroundColor="#2a2a2a" width="100%">
      {/* Header */}
      <vstack alignment="middle center" padding="small">
        <hstack width="100%" alignment="middle center">
          <hstack width="10%" />
          <text size="xlarge" weight="bold" color="white" grow alignment="middle center">
            How to Play
          </text>
          <hstack width="10%" alignment="end" onPress={onBack} padding="small">
            <text size="large" weight="bold" color="white">✕</text>
          </hstack>
        </hstack>
        <text size="small" color="#888888">Game Guide</text>
      </vstack>

      {/* Main Content Container with Navigation */}
      <hstack grow>
        {/* Left Arrow */}
        <hstack
          backgroundColor="#2a2a2a"
          width="32px"
          alignment="middle center"
          onPress={prevPage}
        >
          <text color="white" size="large">‹</text>
        </hstack>

        {/* Content with Page Indicators */}
        <vstack alignment="center middle" backgroundColor="#4a4a4a" cornerRadius="small" grow>
          {/* Content */}
          <vstack padding="none" gap="none" maxWidth="600px">
            {pages[currentPage]}
          </vstack>
          {/* Page Indicators */}
          <hstack padding="small" alignment="middle center" gap="small">
            {pages.map((_, index) => (
              <hstack 
                key={`dot-${index}`}
                backgroundColor={currentPage === index ? "white" : "#666666"}
                width="5px"
                height="5px"
                // cornerRadius="full"
              />
            ))}
          </hstack>         
        </vstack>

        {/* Right Arrow */}
        <hstack
          backgroundColor="#2a2a2a"
          width="32px"
          alignment="middle center"
          onPress={nextPage}
        >
          <text color="white" size="large">›</text>
        </hstack>
      </hstack>
    </vstack>
  );
};

export default HowToPlay;