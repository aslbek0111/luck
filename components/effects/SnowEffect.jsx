'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';

function subscribeSnow(callback) {
  window.addEventListener('toggle-snow', callback);
  return () => window.removeEventListener('toggle-snow', callback);
}

function getSnowSnapshot() {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('lucky_snow_enabled');
  return saved === null ? true : saved === 'true';
}

function getServerSnowSnapshot() {
  return true;
}

export default function SnowEffect() {
  const canvasRef = useRef(null);
  const isEnabled = useSyncExternalStore(subscribeSnow, getSnowSnapshot, getServerSnowSnapshot);

  useEffect(() => {
    if (!isEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Optimized flake count for ultra-smooth 60-120fps with minimal GPU load
    const flakeCount = Math.min(32, Math.max(16, Math.floor(width / 35)));
    const flakes = [];

    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.0 + 0.8,
        density: Math.random() * flakeCount,
        speedY: Math.random() * 1.0 + 0.5,
        speedX: Math.random() * 0.6 - 0.3,
        opacity: Math.random() * 0.5 + 0.25,
      });
    }

    let angle = 0;
    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);
      angle += 0.01;

      for (let i = 0; i < flakeCount; i++) {
        const flake = flakes[i];
        flake.y += flake.speedY;
        flake.x += Math.sin(angle + flake.density) * 0.5 + flake.speedX;

        // Wrap around screen edges
        if (flake.y > height) {
          flake.y = -10;
          flake.x = Math.random() * width;
        }
        if (flake.x > width + 10) {
          flake.x = -10;
        } else if (flake.x < -10) {
          flake.x = width + 10;
        }

        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 242, 254, ${flake.opacity})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (!isRunning) {
          isRunning = true;
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    render();

    return () => {
      isRunning = false;
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isEnabled]);

  if (!isEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-500"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
      aria-hidden="true"
    />
  );
}
