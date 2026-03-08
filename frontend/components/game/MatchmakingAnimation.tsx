'use client';

import { useEffect, useRef, useState } from 'react';
import type { MatchmakingWaiting, MatchmakingLobby } from '@/hooks/useSocket';

interface MatchmakingAnimationProps {
  status: 'idle' | 'queuing' | 'found';
  waiting: MatchmakingWaiting | null;
  lobby: MatchmakingLobby | null;
  onCancel: () => void;
}

export default function MatchmakingAnimation({
  status,
  waiting,
  lobby,
  onCancel,
}: MatchmakingAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [matchFound, setMatchFound] = useState(false);

  useEffect(() => {
    if (status !== 'queuing') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 200;

    const particles: Array<{
      angle: number;
      radius: number;
      speed: number;
      size: number;
      color: string;
    }> = [];

    for (let i = 0; i < 8; i++) {
      particles.push({
        angle: (i / 8) * Math.PI * 2,
        radius: 60 + Math.random() * 20,
        speed: 0.02 + Math.random() * 0.01,
        size: 3 + Math.random() * 3,
        color: ['#c4956a', '#7aab8a', '#a07ab4', '#d4a030'][i % 4],
      });
    }

    let animationId: number;
    let time = 0;

    function animate() {
      if (!canvas || !ctx) return;
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, 80
      );
      gradient.addColorStop(0, 'rgba(196, 149, 106, 0.3)');
      gradient.addColorStop(1, 'rgba(196, 149, 106, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      particles.forEach((p) => {
        p.angle += p.speed;
        const x = centerX + Math.cos(p.angle) * p.radius;
        const y = centerY + Math.sin(p.angle) * p.radius;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          centerX + Math.cos(p.angle - 0.2) * (p.radius - 10),
          centerY + Math.sin(p.angle - 0.2) * (p.radius - 10)
        );
        ctx.strokeStyle = p.color + '40';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      ctx.beginPath();
      ctx.arc(centerX, centerY, 15 + Math.sin(time * 0.05) * 3, 0, Math.PI * 2);
      ctx.fillStyle = '#c4956a';
      ctx.fill();

      for (let r = 1; r <= 3; r++) {
        const ringRadius = 30 + r * 25 + Math.sin(time * 0.03 * r) * 5;
        const alpha = 0.3 - r * 0.08;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(196, 149, 106, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(animate);
    }

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [status]);

  useEffect(() => {
    if (status === 'found' && !matchFound) {
      setMatchFound(true);
    }
  }, [status, matchFound]);

  if (status === 'idle') return null;

  return (
    <div className="mm-animation-screen">
      <div className="mm-animation-content">
        {status === 'queuing' && (
          <>
            <div className="mm-animation-canvas-wrap">
              <canvas ref={canvasRef} className="mm-animation-canvas" />
            </div>
            <div className="mm-animation-title">Finding Match</div>
            <div className="mm-animation-stats">
              {waiting && (
                <>
                  <div className="mm-stat">
                    <span className="mm-stat-label">Position</span>
                    <span className="mm-stat-value">#{waiting.position}</span>
                  </div>
                  <div className="mm-stat">
                    <span className="mm-stat-label">Est. Wait</span>
                    <span className="mm-stat-value">{waiting.estimatedWaitSeconds}s</span>
                  </div>
                  {waiting.expandedRange && (
                    <div className="mm-stat-expanded">Searching wider...</div>
                  )}
                </>
              )}
            </div>
            <button className="mm-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          </>
        )}

        {status === 'found' && matchFound && (
          <div className="mm-found-animation">
            <div className="mm-found-icon">✓</div>
            <div className="mm-found-title">Match Found!</div>
            <div className="mm-found-lobby">
              {lobby?.players.map((p) => (
                <div key={p.userId} className="mm-lobby-player">
                  {p.username}
                </div>
              ))}
              {lobby?.bots.map((b) => (
                <div key={b.botId} className="mm-lobby-bot">
                  {b.name}
                </div>
              ))}
            </div>
            {lobby && lobby.countdownSeconds !== null && (
              <div className="mm-countdown">
                {lobby.countdownSeconds}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
