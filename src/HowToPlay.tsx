import { Devvit, useState } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay = ({ onBack }: HowToPlayProps) => {
  const [currentPage, setCurrentPage] = useState<number>(0);
  
  const pages = [

    // Page 1
    <vstack key="page-1" padding="medium" gap="medium" alignment="middle center">
      <image url="modes.png" imageWidth={180} imageHeight={150} />
      <text color="white" weight="bold" size="large" alignment="center">Choose Game Modes</text>
      <vstack maxWidth="420px">
        <text color="white" wrap={true} alignment='center' grow>
          Casual Mode: Enjoy a chill experience with unlimited karma and no time constraints.
        </text>
        <text color="white" wrap={true} alignment='center' grow>
          Challenge Mode: Embark on an adventure, uncover hidden secrets, and prove your mastery.
        </text>
      </vstack>
    </vstack>,

    // Page 2
    <vstack key="page-2" padding="medium" gap="medium" alignment="middle center">
      <image url="move.gif" imageWidth={150} imageHeight={150} />
      <text color="white" weight="bold" size="large" alignment="center">Escape The Maze</text>
      <vstack maxWidth="420px">
        <text color="white" wrap={true} alignment='center' grow>
          Navigate through the maze to find the exit. Move by tapping on adjacent tiles or using the WASD keys when on a desktop.
        </text>
      </vstack>
    </vstack>,

    // Page 3     
    <vstack key="page-3" padding="medium" gap="medium" alignment="middle center">
      <image url="powerups.png" imageWidth={250} imageHeight={150} />
      <text color="white" weight="bold" size="large" alignment="center">Use Power-Ups</text>
      <vstack gap="none" width="100%" alignment='center'>
        <hstack gap="small" alignment="middle start" grow>
          <image url="karma.png" imageWidth={16} imageHeight={16} />
          <text color="white" wrap={true} size='small' grow>
            Karma: Spend karma to unlock doors and escape traps.
          </text>
        </hstack>
        <hstack gap="small" alignment="middle start" grow>
          <image url="map.png" imageWidth={16} imageHeight={16} />
          <text color="white" wrap={true} size='small' grow>
            Map: Expand your visible radius to plan your path.
          </text>
        </hstack>
        <hstack gap="small" alignment="middle start" grow>
          <image url="crystal.png" imageWidth={16} imageHeight={16} />
          <text color="white" wrap={true} size='small' grow>
            Crystal Ball: Reveal the true exit and dangerous areas.
          </text>
        </hstack>
        <text color="white" wrap={true} size='small' grow>
          Note: In-game Karma doesn't affect Reddit Karma.
        </text>
      </vstack>
    </vstack>,

    // Page 4
    <vstack key="page-4" padding="medium" gap="medium" alignment="middle center">
      <image url="traps.png" imageWidth={220} imageHeight={150} />
      <text color="white" weight="bold" size="large" alignment="center">Avoid Traps</text>
      <vstack gap="none" maxWidth="420px" alignment='center'>
        <text color="white" wrap={true} alignment='center' grow>
          Keep an eye out for hidden pitfalls and traps as they'll slow your journey through the maze.
          </text>
        <text color="white" wrap={true} alignment='center' grow>
          Tip: Use karma to escape traps instead of unlocking doors.
        </text>
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
        <vstack alignment="center middle" backgroundColor="#4a4a4a" grow>
          {/* Content */}
          <vstack padding="none" gap="none" maxWidth="600px">
            {pages[currentPage]}
          </vstack>       
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
  );
};

export default HowToPlay;