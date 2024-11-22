import React, { useRef, useEffect } from 'react';

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

    const updateStars = () => {
      starsRef.current = starsRef.current.map((star) => {
        const newY = star.y + 1;
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
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw the cone top
      context.fillStyle = 'silver';
      context.beginPath();
      context.moveTo(centerX, centerY - spaceshipHeight / 2);
      context.lineTo(centerX - spaceshipWidth / 2, centerY - spaceshipHeight / 4);
      context.lineTo(centerX + spaceshipWidth / 2, centerY - spaceshipHeight / 4);
      context.closePath();
      context.fill();

      // Create gradient for the cylindrical body
      const gradient = context.createLinearGradient(
        centerX - spaceshipWidth / 2,
        centerY - spaceshipHeight / 4,
        centerX + spaceshipWidth / 2,
        centerY - spaceshipHeight / 4
      );
      gradient.addColorStop(0, 'darkgray');
      gradient.addColorStop(0.5, 'lightgray');
      gradient.addColorStop(1, 'darkgray');

      // Draw the cylindrical body with gradient
      context.fillStyle = gradient;
      context.fillRect(centerX - spaceshipWidth / 2, centerY - spaceshipHeight / 4, spaceshipWidth, spaceshipHeight / 2);

      // Draw the fire
      context.fillStyle = 'orange';
      context.beginPath();
      context.moveTo(centerX, centerY + spaceshipHeight / 4);
      context.lineTo(centerX - spaceshipWidth / 4, centerY + spaceshipHeight / 2);
      context.lineTo(centerX + spaceshipWidth / 4, centerY + spaceshipHeight / 2);
      context.closePath();
      context.fill();

      context.fillStyle = 'red';
      context.beginPath();
      context.moveTo(centerX, centerY + spaceshipHeight / 4);
      context.lineTo(centerX - spaceshipWidth / 8, centerY + spaceshipHeight / 2);
      context.lineTo(centerX + spaceshipWidth / 8, centerY + spaceshipHeight / 2);
      context.closePath();
      context.fill();
    };

    const drawText = () => {
      if (!context || !canvas) return;

      context.fillStyle = 'white';
      context.font = '20px Arial';
      context.fillText(`Score: ${score}`, 20, 30);
      context.fillText(`Distance: ${distance}`, 20, 60);
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
      const y = event.clientY - rect.top;

      const buttonX = canvas.width - 120;
      const buttonY = canvas.height - 60;
      const buttonWidth = 100;
      const buttonHeight = 40;

      if (x >= buttonX && x <= buttonX + buttonWidth && y >= buttonY && y <= buttonY + buttonHeight) {
        onIncrement();
      }
    };

    const animate = () => {
      updateStars();
      drawStars();
      drawSpaceship();
      drawText();
      drawButton();
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
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas?.removeEventListener('click', handleCanvasClick);
    };
  }, [score, distance, onIncrement]);

  return <canvas ref={canvasRef} className="space-background-canvas" />;
};

export default SpaceBackgroundCanvas;