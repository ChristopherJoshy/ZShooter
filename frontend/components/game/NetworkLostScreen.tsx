'use client';

import { useEffect, useState } from 'react';
import GameIcon from '@/components/ui/GameIcon';

interface NetworkLostScreenProps {
  isReconnecting: boolean;
  serverAvailable: boolean;
  onReturnToGarden: () => void;
  onRetry: () => void;
}

export default function NetworkLostScreen({ 
  isReconnecting, 
  serverAvailable, 
  onReturnToGarden,
  onRetry,
}: NetworkLostScreenProps) {
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    if (isReconnecting) {
      setRetryCount(c => c + 1);
    }
  }, [isReconnecting]);

  // When connected, don't render anything
  if (!isReconnecting && serverAvailable) return null;

  const isServerUnavailable = !serverAvailable;
  const showRetry = !isReconnecting;

  return (
    <div className="netlost-screen">
      <div className={`netlost-icon ${isReconnecting ? 'spinning' : ''}`}>
        <GameIcon name={isReconnecting ? 'refresh' : isServerUnavailable ? 'alert' : 'wifiOff'} className="netlost-icon-svg" />
      </div>
      <div className="netlost-title">
        {isReconnecting 
          ? 'Reconnecting...' 
          : isServerUnavailable 
            ? 'Server Unavailable'
            : 'Connection Lost'}
      </div>
      <div className="netlost-text">
        {isReconnecting
          ? `Attempting to connect... (attempt ${retryCount})`
          : isServerUnavailable
            ? 'The game server is currently unavailable. Please try again later.'
            : 'Your connection to the server has been lost. Please check your internet connection.'}
      </div>
      {showRetry && (
        <div className="netlost-actions">
          <button className="zen-btn" onClick={onRetry}>
            {isServerUnavailable ? 'Check Again' : 'Reconnect'}
          </button>
          <button className="zen-btn zen-btn-secondary" onClick={onReturnToGarden}>
            Continue Offline
          </button>
        </div>
      )}
      {isReconnecting && (
        <div className="netlost-auto-retry">
          Will automatically retry...
        </div>
      )}
    </div>
  );
}
