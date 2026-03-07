'use client';

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
  // When connected, don't render anything
  // The parent component should conditionally render this component
  // based on socket connection state
  if (!isReconnecting && serverAvailable) return null;

  const isServerUnavailable = !serverAvailable;

  return (
    <div className="netlost-screen">
      <div className="netlost-icon">
        <GameIcon name="shield" className="netlost-icon-svg" />
      </div>
      <div className="netlost-title">
        {isReconnecting 
          ? 'Reconnecting...' 
          : isServerUnavailable 
            ? 'Offline (Server Unavailable)'
            : 'Connection Lost'}
      </div>
      <div className="netlost-text">
        {isReconnecting
          ? 'Attempting to restore connection to the server...'
          : isServerUnavailable
            ? 'The game server is currently unavailable. You can still play Story or Arcade mode offline.'
            : 'Your connection to the server has been lost.'}
      </div>
      {!isReconnecting && (
        <div className="netlost-actions">
          {isServerUnavailable && (
            <button className="zen-btn" onClick={onRetry}>
              Try Again
            </button>
          )}
          <button className="zen-btn zen-btn-secondary" onClick={onReturnToGarden}>
            Return to Garden
          </button>
        </div>
      )}
    </div>
  );
}
