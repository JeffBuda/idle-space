import React, { useRef, useEffect } from 'react';

interface Star {
  x: number;
  y: number;
}

const SpaceBackgroundCanvas: React.FC = () => {
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

    const animate = () => {
      updateStars();
      drawStars();
      requestAnimationFrame(animate);
    };

    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    generateStars();
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <canvas ref={canvasRef} className="space-background-canvas" />;
};

export default SpaceBackgroundCanvas;