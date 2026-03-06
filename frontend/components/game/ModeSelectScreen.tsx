'use client';
import { useState, useCallback } from 'react';
import { STORY_CHAPTERS } from '@/lib/game/waves';
import type { StoryDifficulty } from '@/lib/game/types';
import { sfx } from '@/lib/game/audio';

interface ModeSelectScreenProps {
  visible: boolean;
  storyProgress: Array<{ chapterId: number; difficulty: StoryDifficulty }>;
  onArcade: () => void;
  onRanked: () => void;
  onStory: (chapterId: number, difficulty: StoryDifficulty) => void;
  onBack: () => void;
}

type Panel = 'root' | 'story';

const DIFFICULTIES: { id: StoryDifficulty; label: string; desc: string; color: string }[] = [
  { id: 'calm',     label: 'Calm',     desc: '0.7× HP · 0.8× speed',  color: '#7ab89e' },
  { id: 'balanced', label: 'Balanced', desc: '1.0× HP · 1.0× speed',  color: '#c8a850' },
  { id: 'tempest',  label: 'Tempest',  desc: '1.4× HP · 1.25× speed', color: '#e08070' },
];

export default function ModeSelectScreen({
  visible, storyProgress, onArcade, onRanked, onStory, onBack,
}: ModeSelectScreenProps) {
  const [panel, setPanel] = useState<Panel>('root');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [selectedDifficulty, setSelectedDifficulty] = useState<StoryDifficulty>('balanced');

  const handleArcade = useCallback(() => {
    sfx('menuClick');
    onArcade();
  }, [onArcade]);

  const handleRanked = useCallback(() => {
    sfx('menuClick');
    onRanked();
  }, [onRanked]);

  const handleOpenStory = useCallback(() => {
    sfx('menuClick');
    setPanel('story');
  }, []);

  const handleBack = useCallback(() => {
    sfx('menuClick');
    if (panel === 'story') {
      setPanel('root');
    } else {
      onBack();
    }
  }, [panel, onBack]);

  const handleStartStory = useCallback(() => {
    sfx('menuClick');
    onStory(selectedChapter, selectedDifficulty);
  }, [selectedChapter, selectedDifficulty, onStory]);

  const isChapterCompleted = useCallback((id: number, diff?: StoryDifficulty) => {
    return storyProgress.some((p) => p.chapterId === id && (!diff || p.difficulty === diff));
  }, [storyProgress]);

  return (
    <div id="modeSelectScreen" className={'fullscreen' + (visible ? '' : ' hidden')}>
      <div className="ms-wrap">
        {panel === 'root' && (
          <>
            <div className="ms-header">
              <div className="ms-title">Choose Your Path</div>
              <div className="ms-sub">Select a game mode to begin your session</div>
            </div>

            <div className="ms-cards">
              {/* Arcade */}
              <button className="ms-card ms-card-arcade" onClick={handleArcade} onMouseEnter={() => sfx('menuHover')}>
                <div className="ms-card-icon">◉</div>
                <div className="ms-card-name">Arcade</div>
                <div className="ms-card-desc">Endless waves. No rank on the line. Play freely and experiment.</div>
                <div className="ms-card-tag">Free Play</div>
              </button>

              {/* Ranked */}
              <button className="ms-card ms-card-ranked" onClick={handleRanked} onMouseEnter={() => sfx('menuHover')}>
                <div className="ms-card-icon">⚡</div>
                <div className="ms-card-name">Ranked</div>
                <div className="ms-card-desc">Compete against others. Earn RP, climb tiers, prove your skill.</div>
                <div className="ms-card-tag">Competitive</div>
              </button>

              {/* Story */}
              <button className="ms-card ms-card-story" onClick={handleOpenStory} onMouseEnter={() => sfx('menuHover')}>
                <div className="ms-card-icon">✦</div>
                <div className="ms-card-name">Story</div>
                <div className="ms-card-desc">Three scripted chapters with escalating challenges and a final boss.</div>
                <div className="ms-card-tag">3 Chapters</div>
              </button>
            </div>

            <button className="ms-back-btn" onClick={handleBack}>← Return to Garden</button>
          </>
        )}

        {panel === 'story' && (
          <>
            <div className="ms-header">
              <div className="ms-title">Story Mode</div>
              <div className="ms-sub">Choose a chapter and difficulty</div>
            </div>

            <div className="ms-story-layout">
              {/* Chapter selector */}
              <div className="ms-chapters">
                {STORY_CHAPTERS.map((ch) => {
                  const done = isChapterCompleted(ch.id);
                  const locked = ch.id > 1 && !isChapterCompleted(ch.id - 1);
                  return (
                    <button
                      key={ch.id}
                      className={'ms-chapter-btn' + (selectedChapter === ch.id ? ' ms-chapter-active' : '') + (done ? ' ms-chapter-done' : '') + (locked ? ' ms-chapter-locked' : '')}
                      onClick={() => { if (!locked) { sfx('menuClick'); setSelectedChapter(ch.id); } }}
                      disabled={locked}
                    >
                      <span className="ms-chapter-num">Ch.{ch.id}</span>
                      <span className="ms-chapter-title">{ch.title}</span>
                      {done && <span className="ms-chapter-check">✓</span>}
                      {locked && <span className="ms-chapter-lock">🔒</span>}
                    </button>
                  );
                })}
              </div>

              {/* Chapter info + difficulty */}
              <div className="ms-chapter-detail">
                {STORY_CHAPTERS.filter((c) => c.id === selectedChapter).map((ch) => (
                  <div key={ch.id}>
                    <div className="ms-chapter-detail-title">{ch.title}</div>
                    <div className="ms-chapter-detail-desc">{ch.description}</div>
                    <div className="ms-chapter-waves">
                      {ch.waves.map((w, i) => (
                        <div key={i} className={'ms-wave-pip' + (w.types.includes('boss') ? ' ms-wave-pip-boss' : '')}>
                          {w.label ?? `Wave ${i + 1}`}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="ms-difficulty-label">Difficulty</div>
                <div className="ms-difficulty-row">
                  {DIFFICULTIES.map((d) => {
                    const diffDone = isChapterCompleted(selectedChapter, d.id);
                    return (
                      <button
                        key={d.id}
                        className={'ms-diff-btn' + (selectedDifficulty === d.id ? ' ms-diff-active' : '')}
                        style={{ '--diff-col': d.color } as React.CSSProperties}
                        onClick={() => { sfx('menuClick'); setSelectedDifficulty(d.id); }}
                      >
                        <span className="ms-diff-name">{d.label}</span>
                        <span className="ms-diff-desc">{d.desc}</span>
                        {diffDone && <span className="ms-diff-check">✓</span>}
                      </button>
                    );
                  })}
                </div>

                <button className="zen-btn ms-start-btn" onClick={handleStartStory}>
                  Begin Chapter {selectedChapter}
                </button>
              </div>
            </div>

            <button className="ms-back-btn" onClick={handleBack}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}
