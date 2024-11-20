import React, { useEffect } from 'react';
import './SpaceBackground.css';

interface SpaceBackgroundProps {
  stars: { x: string; y: string }[];
  setStars: React.Dispatch<React.SetStateAction<{ x: string; y: string }[]>>;
}

const SpaceBackground: React.FC<SpaceBackgroundProps> = ({ stars, setStars }) => {
  useEffect(() => {
    const interval = setInterval(() => {
      setStars((prevStars) =>
        prevStars.map((star) => {
          const newY = parseFloat(star.y) + 1;
          return {
            x: newY > 100 ? Math.random() * 100 + '%' : star.x,
            y: newY > 100 ? '0%' : `${newY}%`,
          };
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [setStars]);

  return (
    <div className="space-background">
      <svg width="100%" height="100%">
        <defs>
          <circle id="star" cx="2" cy="2" r="2" fill="white" />
        </defs>
        <g>
          {stars.map((star, i) => (
            <use
              key={i}
              href="#star"
              x={star.x}
              y={star.y}
              className="star"
            />
          ))}
        </g>
        <image
          href="spaceship.svg"
          x="50%"
          y="50%"
          width="50"
          height="50"
          transform="translate(-25, -25)"
        />
      </svg>
    </div>
  );
};

export default SpaceBackground;