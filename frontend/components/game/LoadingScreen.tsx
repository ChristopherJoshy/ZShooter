'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface LoadingScreenProps {
  isMobile?: boolean;
  onTimeout?: () => void;
  timeoutMs?: number;
}

export default function LoadingScreen({ isMobile = false, onTimeout, timeoutMs = 8000 }: LoadingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const handleContinue = useCallback(() => {
    if (onTimeout) {
      onTimeout();
    }
  }, [onTimeout]);

  useEffect(() => {
    if (isMobile) return;

    const timeoutId = setTimeout(() => {
      setTimedOut(true);
      setShowContinue(true);
    }, timeoutMs);

    return () => clearTimeout(timeoutId);
  }, [isMobile, timeoutMs]);

  useEffect(() => {
    if (isMobile) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 400;
    const height = 266;
    canvas.width = width;
    canvas.height = height;

    const cx = ctx;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      life: number;
    }> = [];

    const colors = ['#7aab8a', '#c4956a', '#d4a030', '#a07ab4', '#e89090'];

    let animationId: number;
    let lastTime = 0;

    function spawnParticle() {
      if (particles.length < 30) {
        particles.push({
          x: Math.random() * width,
          y: height + 10,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 3 - 1,
          size: Math.random() * 4 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1,
        });
      }
    }

    function animate(time: number) {
      const dt = time - lastTime;
      lastTime = time;

      cx.fillStyle = '#f7f2ea';
      cx.fillRect(0, 0, width, height);

      cx.strokeStyle = 'rgba(180,155,130,0.1)';
      cx.lineWidth = 1;
      for (let x = 0; x < width; x += 20) {
        cx.beginPath();
        cx.moveTo(x, 0);
        cx.lineTo(x, height);
        cx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        cx.beginPath();
        cx.moveTo(0, y);
        cx.lineTo(width, y);
        cx.stroke();
      }

      if (Math.random() < 0.1) spawnParticle();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.005;

        if (p.life <= 0 || p.y < -10) {
          particles.splice(i, 1);
          continue;
        }

        cx.globalAlpha = p.life;
        cx.fillStyle = p.color;
        cx.beginPath();
        cx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        cx.fill();
      }
      cx.globalAlpha = 1;

      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);

    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 200);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(progressInterval);
    };
  }, [isMobile]);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        {!isMobile && (
          <div className="loading-canvas-wrap">
            <canvas ref={canvasRef} className="loading-canvas" />
          </div>
        )}
        
        <div className="loading-logo">
          <div className="loading-logo-mark">Z</div>
          <div className="loading-logo-text">ZShooter</div>
        </div>

        <div className="loading-progress">
          <div className="loading-progress-bar">
            <div 
              className="loading-progress-fill" 
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="loading-progress-text">
            {timedOut ? 'Connection timeout' : (progress < 100 ? 'Loading...' : 'Ready!')}
          </div>
          {showContinue && (
            <button className="loading-continue-btn" onClick={handleContinue}>
              Continue anyway →
            </button>
          )}
        </div>

        {isMobile && (
          <div className="loading-mobile-hint">
            Tap to start
          </div>
        )}
      </div>
    </div>
  );
}
