let _ctx = null;
let _keepAliveNode = null;

export function unlockAudio() {
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') {
      _ctx.resume();
    }
    // Play a soft two-note chime — unlocks iOS audio and signals journey start
    const t = _ctx.currentTime;
    note(1047, t,        0.35, 0.15, 'sine');
    note(1319, t + 0.18, 0.45, 0.12, 'sine');

    // Start silent keep-alive oscillator to prevent iOS from suspending the context
    if (_keepAliveNode) {
      _keepAliveNode.stop();
      _keepAliveNode = null;
    }
    const osc = _ctx.createOscillator();
    const gain = _ctx.createGain();
    gain.gain.setValueAtTime(0, _ctx.currentTime); // completely silent
    osc.connect(gain);
    gain.connect(_ctx.destination);
    osc.start();
    _keepAliveNode = osc;
  } catch {}
}

export function stopAudio() {
  try {
    if (_keepAliveNode) {
      _keepAliveNode.stop();
      _keepAliveNode = null;
    }
  } catch {}
}

function note(freq, startTime, duration, peakGain, type) {
  if (!_ctx) return;
  const osc = _ctx.createOscillator();
  const gain = _ctx.createGain();
  osc.type = type || 'sine';
  osc.connect(gain);
  gain.connect(_ctx.destination);
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function playDestinationSound() {
  if (!_ctx) return;
  const t = _ctx.currentTime;
  note(523,  t + 0.0,  1.2, 0.22, 'triangle');
  note(659,  t + 0.08, 1.1, 0.20, 'triangle');
  note(784,  t + 0.16, 1.0, 0.18, 'triangle');
  note(1047, t + 0.24, 0.9, 0.16, 'triangle');
  note(1319, t + 0.32, 0.8, 0.12, 'triangle');
}

export function playArrivalSound(category) {
  if (!_ctx) return;
  const t = _ctx.currentTime;

  if (category === 'park') {
    note(1319, t,        0.8, 0.22, 'sine');
    note(1568, t + 0.12, 0.7, 0.18, 'sine');
    note(2093, t + 0.24, 0.6, 0.14, 'sine');
    note(1760, t + 0.36, 0.5, 0.12, 'sine');
  } else if (category === 'memorial') {
    note(294, t, 2.0, 0.35, 'sine');
    note(370, t, 1.6, 0.12, 'sine');
    note(588, t, 1.2, 0.06, 'sine');
  } else if (category === 'church') {
    note(392, t,       1.5, 0.25, 'triangle');
    note(494, t,       1.5, 0.20, 'triangle');
    note(588, t,       1.5, 0.18, 'triangle');
    note(784, t + 0.1, 1.2, 0.12, 'triangle');
  } else if (category === 'listed') {
    note(523,  t,        0.2, 0.2, 'sawtooth');
    note(659,  t + 0.15, 0.2, 0.2, 'sawtooth');
    note(784,  t + 0.30, 0.4, 0.2, 'sawtooth');
    note(1047, t + 0.45, 0.6, 0.2, 'sawtooth');
  } else {
    note(880,  t,        0.2, 0.3, 'sine');
    note(1174, t + 0.18, 0.35, 0.3, 'sine');
  }
}
