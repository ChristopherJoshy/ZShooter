// Procedural Web Audio API sound effects
let AC: AudioContext | null = null;
let AUDIO_MIX = {
  audioLevel: 80,
  sfxEnabled: true,
};

export function setAudioMix(mix: { audioLevel: number; sfxEnabled: boolean }): void {
  AUDIO_MIX = {
    audioLevel: Math.max(0, Math.min(100, mix.audioLevel)),
    sfxEnabled: mix.sfxEnabled,
  };
}

export function startAudio(): void {
  if (!AC) {
    AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
}

// Global volume scale
const getVol = (base: number) => base * (AUDIO_MIX.audioLevel / 100);

// Basic tone with exponential decay
function tone(freq: number, type: OscillatorType, dur: number, vol = 0.06, delay = 0): void {
  if (!AC || !AUDIO_MIX.sfxEnabled || AUDIO_MIX.audioLevel <= 0) return;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.connect(g);
  g.connect(AC.destination);
  o.type = type;
  o.frequency.value = freq;
  const s = AC.currentTime + delay;
  g.gain.setValueAtTime(getVol(vol), s);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  o.start(s);
  o.stop(s + dur);
}

// Frequency sweep tone (e.g. for lasers, drops, impacts)
function oscSweep(f1: number, f2: number, type: OscillatorType, dur: number, vol: number, delay = 0): void {
  if (!AC || !AUDIO_MIX.sfxEnabled || AUDIO_MIX.audioLevel <= 0) return;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.connect(g);
  g.connect(AC.destination);
  o.type = type;
  
  const s = AC.currentTime + delay;
  o.frequency.setValueAtTime(f1, s);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), s + dur);
  
  g.gain.setValueAtTime(getVol(vol), s);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  
  o.start(s);
  o.stop(s + dur);
}

// White noise burst for percussion, impacts, and gunshots
function noiseBurst(dur: number, vol: number, delay = 0, lowpassFreq = 4000): void {
  if (!AC || !AUDIO_MIX.sfxEnabled || AUDIO_MIX.audioLevel <= 0) return;
  const bufferSize = AC.sampleRate * dur;
  const buffer = AC.createBuffer(1, bufferSize, AC.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = AC.createBufferSource();
  noise.buffer = buffer;
  
  const filter = AC.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpassFreq;
  
  const g = AC.createGain();
  noise.connect(filter);
  filter.connect(g);
  g.connect(AC.destination);
  
  const s = AC.currentTime + delay;
  g.gain.setValueAtTime(getVol(vol), s);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  
  noise.start(s);
}

// Vibrato helper
function toneVibrato(freq: number, type: OscillatorType, dur: number, vol: number, delay: number, vibratoRate: number, vibratoDepth: number): void {
  if (!AC || !AUDIO_MIX.sfxEnabled || AUDIO_MIX.audioLevel <= 0) return;
  const o = AC.createOscillator();
  const lfo = AC.createOscillator();
  const lfoGain = AC.createGain();
  const g = AC.createGain();
  lfo.connect(lfoGain);
  lfoGain.connect(o.frequency);
  o.connect(g);
  g.connect(AC.destination);
  o.type = type;
  o.frequency.value = freq;
  lfo.type = 'sine';
  lfo.frequency.value = vibratoRate;
  lfoGain.gain.value = vibratoDepth;
  const s = AC.currentTime + delay;
  g.gain.setValueAtTime(getVol(vol), s);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  lfo.start(s); lfo.stop(s + dur);
  o.start(s); o.stop(s + dur);
}

export function sfx(n: string): void {
  switch (n) {
    // Basic single shot: punchy noise + quick sine drop
    case 'shoot':
      noiseBurst(0.08, 0.08, 0, 3000);
      oscSweep(800, 200, 'sine', 0.1, 0.06);
      break;
      
    // Petal: chorusing high notes
    case 'shootPetal': 
      tone(880, 'sine', 0.1, 0.04); 
      tone(880 * 1.02, 'sine', 0.12, 0.035, 0.01); 
      tone(880 * 0.98, 'sine', 0.14, 0.04, 0.02); 
      break;
      
    // Thorn: harsh metallic scatter
    case 'shootThorn': 
      noiseBurst(0.1, 0.1, 0, 8000);
      for (let i = 0; i < 3; i++) {
        oscSweep(600 + i * 200, 100, 'square', 0.15, 0.02, i * 0.01);
      }
      break;
      
    // Lotus Beam: piercing harmonic sweep
    case 'shootLotus': 
      oscSweep(440, 1200, 'sine', 0.3, 0.05); 
      oscSweep(220, 600, 'triangle', 0.35, 0.04, 0.02);
      tone(1200, 'sine', 0.4, 0.03, 0.05);
      break;
      
    // Pulse Blossom: rapid-fire deep pop
    case 'shootPulse': 
      oscSweep(600, 150, 'square', 0.06, 0.04);
      noiseBurst(0.04, 0.06, 0, 1500);
      break;
      
    // Twin Petal: Wide stereo-like detune (even though it's mono mix, the beating sounds wide)
    case 'shootTwin':  
      tone(740, 'triangle', 0.1, 0.04); 
      tone(740 * 1.015, 'triangle', 0.12, 0.04, 0.01); 
      break;
      
    // Mist Arc: Deep wobbling echo
    case 'shootMist':  
      toneVibrato(520, 'sine', 0.25, 0.05, 0, 8, 20); 
      toneVibrato(260, 'sine', 0.3, 0.03, 0.05, 8, 10);
      break;
      
    // Root Cannon: Huge bass heavy explosion
    case 'shootRoot':  
      noiseBurst(0.4, 0.15, 0, 1200);
      oscSweep(200, 40, 'sine', 0.4, 0.12);
      oscSweep(100, 30, 'square', 0.3, 0.05);
      break;

    // Hit marker
    case 'hit':
      noiseBurst(0.04, 0.06, 0, 6000);
      tone(440, 'square', 0.05, 0.03); 
      break;
      
    // Enemy death explosion
    case 'die':
      noiseBurst(0.3, 0.12, 0, 2500);
      oscSweep(300, 50, 'square', 0.25, 0.06);
      oscSweep(150, 40, 'sine', 0.35, 0.08, 0.05);
      break;
      
    // Player hurt
    case 'hurt':
      noiseBurst(0.4, 0.15, 0, 4000);
      oscSweep(300, 80, 'sawtooth', 0.3, 0.1); 
      break;

    case 'pick':       
      tone(880, 'sine', 0.12, 0.06); 
      tone(1320, 'sine', 0.18, 0.05, 0.05); 
      break;
      
    case 'reload':     
      oscSweep(800, 400, 'sine', 0.1, 0.04); 
      oscSweep(600, 300, 'sine', 0.1, 0.04, 0.05); 
      break;
      
    case 'dash':       
      noiseBurst(0.2, 0.08, 0, 5000);
      oscSweep(400, 800, 'sine', 0.15, 0.05); 
      break;
      
    case 'shield':     
      oscSweep(200, 800, 'sine', 0.2, 0.06); 
      tone(800, 'sine', 0.3, 0.05, 0.1); 
      break;
      
    case 'pulse':      
      noiseBurst(0.4, 0.1, 0, 1000);
      oscSweep(100, 400, 'square', 0.2, 0.05); 
      oscSweep(400, 100, 'sine', 0.4, 0.08, 0.1); 
      break;
      
    case 'seed':       
      tone(1200, 'sine', 0.05, 0.02); 
      break;

    case 'menuHover':
      tone(1200, 'sine', 0.03, 0.02);
      break;

    case 'start':      
      oscSweep(440, 880, 'sine', 0.15, 0.05); 
      oscSweep(880, 1320, 'sine', 0.2, 0.05, 0.1); 
      break;
      
    case 'waveComplete':
      tone(660,  'sine', 0.15, 0.06);
      tone(880,  'sine', 0.2, 0.06, 0.10);
      tone(1100, 'sine', 0.30, 0.08, 0.25);
      break;
      
    case 'newHighScore':
      tone(660,  'sine', 0.12, 0.06);
      tone(880,  'sine', 0.12, 0.06, 0.10);
      tone(1100, 'sine', 0.12, 0.06, 0.20);
      tone(1320, 'sine', 0.15, 0.06, 0.30);
      tone(1760, 'sine', 0.4, 0.08, 0.42);
      break;
      
    case 'menuClick':  
      oscSweep(880, 440, 'sine', 0.08, 0.05); 
      break;

    // Chaser death: fast high-pitched pop — noise burst (highpass) + short sine sweep down
    case 'dieChaser':
      noiseBurst(0.08, 0.1, 0, 8000);
      oscSweep(600, 150, 'sine', 0.12, 0.07);
      break;

    // Shooter death: ammo scatter — 3 rapid metallic clicks + downward sweep
    case 'dieShooter':
      tone(400, 'square', 0.06, 0.05, 0);
      tone(320, 'square', 0.06, 0.05, 0.03);
      tone(200, 'square', 0.06, 0.04, 0.06);
      oscSweep(400, 80, 'sine', 0.18, 0.06, 0.02);
      break;

    // Tank death: deep resonant thud — heavy low noise + very low sine sweep
    case 'dieTank':
      noiseBurst(0.5, 0.14, 0, 600);
      oscSweep(120, 25, 'sine', 0.5, 0.12);
      break;

    // Speeder death: high-freq whine + noise — sawtooth sweep + highpass burst
    case 'dieSpeeder':
      oscSweep(1800, 400, 'sawtooth', 0.18, 0.08);
      noiseBurst(0.1, 0.09, 0, 9000);
      break;

    // Splitter death: wet organic pop + two rising tones
    case 'dieSplitter':
      noiseBurst(0.2, 0.1, 0, 1200);
      noiseBurst(0.15, 0.06, 0.02, 800);
      oscSweep(200, 600, 'sine', 0.22, 0.06);
      oscSweep(250, 700, 'sine', 0.22, 0.05, 0.04);
      break;

    // Stalker death: ethereal phase-shift — vibrato + sine sweep
    case 'dieStalker':
      toneVibrato(440, 'triangle', 0.4, 0.08, 0, 14, 60);
      oscSweep(800, 200, 'sine', 0.25, 0.07);
      break;

    // Boss death: massive layered explosion — 3 noise bursts + long low sweep + overtone sweeps
    case 'dieBoss':
      noiseBurst(0.6, 0.18, 0, 400);
      noiseBurst(0.4, 0.12, 0.05, 2000);
      noiseBurst(0.25, 0.08, 0.1, 8000);
      oscSweep(200, 20, 'sine', 0.8, 0.15);
      oscSweep(400, 60, 'square', 0.5, 0.07, 0.08);
      oscSweep(600, 100, 'sine', 0.35, 0.05, 0.15);
      break;

    // Stalker teleport: phase-shift whoosh
    case 'stalkerTeleport':
      oscSweep(1200, 300, 'sine', 0.18, 0.06);
      noiseBurst(0.08, 0.05, 0, 5000);
      break;

    // Heavy contact hit (tank/boss): deeper pain — low noise + slow sawtooth sweep
    case 'hurtHeavy':
      noiseBurst(0.5, 0.18, 0, 2000);
      oscSweep(200, 40, 'sawtooth', 0.35, 0.12);
      break;
  }
}
