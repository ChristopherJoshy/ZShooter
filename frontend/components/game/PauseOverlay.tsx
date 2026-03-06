'use client';

interface PauseOverlayProps {
  visible: boolean;
  onReturn?: () => void;
}

export default function PauseOverlay({ visible, onReturn }: PauseOverlayProps) {
  return (
    <div id="pauseOv" className={visible ? 'show' : ''}>
      <div className="pause-t">Paused</div>
      <div className="pause-hint">Press P or Esc to resume</div>
      {onReturn && (
        <button className="pause-return-btn" onClick={onReturn}>
          Return to Garden
        </button>
      )}
    </div>
  );
}
