import React, { useRef, useEffect, useState } from 'react';

interface Star {
  x: number;
  y: number;
}

interface SpaceBackgroundCanvasProps {
  score: number;
  distance: number;
  onIncrement: () => void;
}

const SpaceBackgroundCanvas: React.FC<SpaceBackgroundCanvasProps> = ({ score, distance, onIncrement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const [spaceshipX, setSpaceshipX] = useState<number>(window.innerWidth / 2);
  const [asteroidY, setAsteroidY] = useState<number>(0);
  const [asteroidX, setAsteroidX] = useState<number>(Math.random() * window.innerWidth);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const lastTimeRef = useRef<string>("0");

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const numStars = 100;

    const generateStars = () => {
      const stars = Array.from({ length: numStars }).map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
      }));
      starsRef.current = stars;
    };

    const drawStars = () => {
      if (!context || !canvas) return;

      context.clearRect(0, 0, canvas.width, canvas.height);

      starsRef.current.forEach((star) => {
        context.beginPath();
        context.arc(star.x, star.y, 2, 0, Math.PI * 2);
        context.fillStyle = 'white';
        context.fill();
      });
    };

    const updateStars = (deltaTime: number) => {
      starsRef.current = starsRef.current.map((star) => {
        const newY = star.y + 0.05 * deltaTime; // Slower speed for stars
        return {
          x: newY > window.innerHeight ? Math.random() * window.innerWidth : star.x,
          y: newY > window.innerHeight ? 0 : newY,
        };
      });
    };

    const drawSpaceship = () => {
      if (!context || !canvas) return;

      const spaceshipWidth = 50;
      const spaceshipHeight = 100;
      const centerY = canvas.height / 2;

      // Draw the cone top
      context.fillStyle = 'silver';
      context.beginPath();
      context.moveTo(spaceshipX, centerY - spaceshipHeight / 2);
      context.lineTo(spaceshipX - spaceshipWidth / 2, centerY - spaceshipHeight / 4);
      context.lineTo(spaceshipX + spaceshipWidth / 2, centerY - spaceshipHeight / 4);
      context.closePath();
      context.fill();

      // Create gradient for the cylindrical body
      const gradient = context.createLinearGradient(
        spaceshipX - spaceshipWidth / 2,
        centerY - spaceshipHeight / 4,
        spaceshipX + spaceshipWidth / 2,
        centerY - spaceshipHeight / 4
      );
      gradient.addColorStop(0, 'darkgray');
      gradient.addColorStop(0.5, 'lightgray');
      gradient.addColorStop(1, 'darkgray');

      // Draw the cylindrical body with gradient
      context.fillStyle = gradient;
      context.fillRect(spaceshipX - spaceshipWidth / 2, centerY - spaceshipHeight / 4, spaceshipWidth, spaceshipHeight / 2);

      // Draw the fire
      context.fillStyle = 'orange';
      context.beginPath();
      context.moveTo(spaceshipX, centerY + spaceshipHeight / 4);
      context.lineTo(spaceshipX - spaceshipWidth / 4, centerY + spaceshipHeight / 2);
      context.lineTo(spaceshipX + spaceshipWidth / 4, centerY + spaceshipHeight / 2);
      context.closePath();
      context.fill();

      context.fillStyle = 'red';
      context.beginPath();
      context.moveTo(spaceshipX, centerY + spaceshipHeight / 4);
      context.lineTo(spaceshipX - spaceshipWidth / 8, centerY + spaceshipHeight / 2);
      context.lineTo(spaceshipX + spaceshipWidth / 8, centerY + spaceshipHeight / 2);
      context.closePath();
      context.fill();
    };

    const drawAsteroid = () => {
      if (!context || !canvas) return;

      const asteroidRadius = 30;

      context.fillStyle = 'brown';
      context.beginPath();
      context.arc(asteroidX, asteroidY, asteroidRadius, 0, Math.PI * 2);
      context.fill();
    };

    const drawText = () => {
      if (!context || !canvas) return;

      context.fillStyle = 'white';
      context.font = '20px Arial';
      context.fillText(`Score: ${score}`, 20, 30);
      context.fillText(`Distance: ${distance}`, 20, 60);

      if (gameOver) {
        context.fillStyle = 'red';
        context.font = '40px Arial';
        context.fillText('Game Over', canvas.width / 2 - 100, canvas.height / 2);
      }
    };

    const drawButton = () => {
      if (!context || !canvas) return;

      const buttonX = canvas.width - 120;
      const buttonY = canvas.height - 60;
      const buttonWidth = 100;
      const buttonHeight = 40;

      context.fillStyle = 'blue';
      context.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

      context.fillStyle = 'white';
      context.font = '20px Arial';
      context.fillText('Fly!', buttonX + 25, buttonY + 25);
    };

    const handleCanvasClick = (event: MouseEvent) => {
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;

      if (x < canvas.width / 2) {
        setSpaceshipX((prevX) => Math.max(prevX - 50, 0));
      } else {
        setSpaceshipX((prevX) => Math.min(prevX + 50, canvas.width));
      }
    };

    const checkCollision = () => {
      const spaceshipWidth = 50;
      const spaceshipHeight = 100;
      const centerY = canvas.height / 2;
      const asteroidRadius = 30;

      const spaceshipLeft = spaceshipX - spaceshipWidth / 2;
      const spaceshipRight = spaceshipX + spaceshipWidth / 2;
      const spaceshipTop = centerY - spaceshipHeight / 2;
      const spaceshipBottom = centerY + spaceshipHeight / 2;

      const asteroidLeft = asteroidX - asteroidRadius;
      const asteroidRight = asteroidX + asteroidRadius;
      const asteroidTop = asteroidY - asteroidRadius;
      const asteroidBottom = asteroidY + asteroidRadius;

      if (
        spaceshipRight > asteroidLeft &&
        spaceshipLeft < asteroidRight &&
        spaceshipBottom > asteroidTop &&
        spaceshipTop < asteroidBottom
      ) {
        setGameOver(true);
      }
    };

    const animate = (time: DOMHighResTimeStamp) => {
      if (gameOver) return;

      const deltaTime = time - Number(lastTimeRef.current);

      if(deltaTime < 16) {
        return; // Skip frame if too fast
      }
      lastTimeRef.current = time.toString();

      updateStars(deltaTime);

      drawStars();
      
      drawSpaceship();
      drawAsteroid();
      drawText();
      drawButton();
      setAsteroidY((prevY) => (prevY > canvas.height ? 0 : prevY + 0.05 * deltaTime)); // Slower speed for asteroid
      checkCollision();
      requestAnimationFrame(animate);
    };

    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', resizeCanvas);
    canvas?.addEventListener('click', handleCanvasClick);
    resizeCanvas();
    generateStars();
    requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas?.removeEventListener('click', handleCanvasClick);
    };
  }, [score, distance, onIncrement, spaceshipX, asteroidY, asteroidX, gameOver]);

  return <canvas ref={canvasRef} className="space-background-canvas" />;
};

export default SpaceBackgroundCanvas;