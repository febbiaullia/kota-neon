// All sound is synthesised with WebAudio: no audio files. An engine hum that follows the
// car's speed, a two-tone police siren, and short effects for pickups, crashes, punches and
// mission jingles. Everything is silent until the player first interacts (browser policy).

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      // Engine: two detuned saws through a lowpass, pitched by speed.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'square';
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: a sine that alternates between two tones.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
    } catch {
      started = false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!started || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq = 800) {
    if (!started || muted) return;
    const t0 = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    /** Call on the first user gesture so the context is allowed to sound. */
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine pitch and volume follow the car's speed (0 when on foot). */
    engine(speed, maxSpeed) {
      if (!started || muted) return;
      const ratio = Math.max(0, Math.min(1, speed / maxSpeed));
      engineOsc.frequency.value = 55 + ratio * 130;
      engineOsc2.frequency.value = 28 + ratio * 66;
      engineFilter.frequency.value = 320 + ratio * 900;
      engineGain.gain.value = speed > 5 ? 0.05 + ratio * 0.05 : 0;
    },
    /** Two-tone siren while the police are after the player. */
    siren(dt, wanted) {
      if (!started || muted) return;
      if (wanted <= 0) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenTimer += dt;
      const high = Math.floor(sirenTimer * 1.6) % 2 === 0;
      sirenOsc.frequency.value = high ? 920 : 700;
      sirenGain.gain.value = 0.035;
    },
    blip() {
      tone(880, 0.12, 'sine', 0.25);
      tone(1320, 0.14, 'sine', 0.2, 0.07);
    },
    crash(strength) {
      noise(0.22, Math.min(0.5, 0.15 + strength * 0.001), 500);
      tone(70, 0.2, 'sine', 0.4);
    },
    punch() {
      noise(0.08, 0.3, 1200);
    },
    honk() {
      tone(233, 0.18, 'square', 0.2);
      tone(294, 0.18, 'square', 0.15);
    },
    /** The taxi chime: a bright two-note ding when a passenger boards or pays. */
    taxi() {
      tone(660, 0.12, 'triangle', 0.25);
      tone(880, 0.2, 'triangle', 0.25, 0.1);
    },
    /** The nitro whoosh: a short rush of filtered noise as the boost catches.
     * Cut at 1800 Hz so it reads bright over the engine, not muddy under it. */
    nitro() {
      noise(0.3, 0.35, 1800);
      tone(180, 0.25, 'sawtooth', 0.12);
    },
    /** The dash swish: a quick high swish as the player bursts forward. */
    dash() {
      noise(0.12, 0.3, 2600);
    },
    steal() {
      tone(520, 0.1, 'triangle', 0.25);
      tone(392, 0.16, 'triangle', 0.25, 0.08);
    },
    jingle() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.25, i * 0.11));
    },
    busted() {
      const notes = [392, 330, 262, 196];
      notes.forEach((freq, i) => tone(freq, 0.3, 'sawtooth', 0.16, i * 0.16));
    },
  };
}
