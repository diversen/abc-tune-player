const player = document.querySelector('audio');
const loopControl = document.querySelector('#loop');
player.loop = loopControl.checked;
loopControl.addEventListener('change', () => { player.loop = loopControl.checked; });
const instrument = document.querySelector('#instrument');
const key = document.querySelector('#key');
const verse = document.querySelector('#verse');
let source;
let original;
let tracks;
let scoreTempo;
let secondsPerWholeNote;
let verseCount;
let verseDuration;
const rate = 22050;
const decoded = new Map();
let timings;
let scoreEndMs;
let active = -1;
let frame;
let pending;
let generatedUrl;

function drawScore() {
  const steps = Number(key.value);
  const abc = steps ? ABCJS.strTranspose(source, original, steps) : source;
  const [tune] = ABCJS.renderAbc(document.querySelector('.score'), abc, {
    responsive: 'resize', staffwidth: 760, add_classes: true,
    format: { titlefont: 'serif 0' }, paddingtop: 8
  });
  const events = tune.setTiming(scoreTempo / (4 * tune.getBeatLength()), 0);
  scoreEndMs = events.at(-1)?.milliseconds || 0;
  timings = events.filter(event => event.type === 'event');
  active = -1;
}

function highlight() {
  const index = Math.min(verseCount - 1, Math.floor(player.currentTime / verseDuration));
  const label = 'Verse ' + (index + 1) + ' of ' + verseCount;
  if (verse.value !== label) verse.value = label;
  const ms = (player.currentTime - index * verseDuration) * 1000;
  const next = player.ended ? -1 : timings.findLastIndex(event => event.milliseconds <= ms);
  if (active === next) return;
  for (const element of timings[active]?.elements.flat() ?? []) element?.classList.remove('playing');
  for (const element of timings[next]?.elements.flat() ?? []) element?.classList.add('playing');
  active = next;
}

function follow() {
  highlight();
  if (!player.paused) frame = requestAnimationFrame(follow);
}

function sampleFor(bank, pitch) {
  const notes = Object.keys(instrumentSamples[bank]).map(Number);
  const root = notes.reduce((a, b) => Math.abs(b - pitch) < Math.abs(a - pitch) ? b : a);
  const id = bank + root;
  if (!decoded.has(id)) {
    const bytes = Uint8Array.from(atob(instrumentSamples[bank][root]), c => c.charCodeAt(0));
    decoded.set(id, new Int16Array(bytes.buffer));
  }
  return { samples: decoded.get(id), speed: 2 ** ((pitch - root) / 12) };
}

// Render a verse once, then repeat its PCM data in one seekable audio file.
function makeAudio(steps) {
  const period = Math.round(rate * verseDuration);
  const mix = new Float32Array(period);
  const melodyBank = instrument.value;
  tracks.forEach((track, voice) => {
    const bank = voice === 0 ? melodyBank : 'piano';
    const sustainedInstrument = ['choir', 'flute', 'clarinet', 'violin'].includes(bank);
    for (const note of track) {
      if (note.cmd !== 'note') continue;
      const { samples, speed } = sampleFor(bank, note.pitch + steps);
      const start = Math.round(note.start * secondsPerWholeNote * rate);
      const held = Math.round(note.duration * secondsPerWholeNote * rate);
      const sampleLength = Math.floor((samples.length - 1) / speed);
      const sustain = sustainedInstrument && held > sampleLength;
      const length = Math.min(held + Math.round(0.12 * rate), period - start,
        sustain ? Infinity : sampleLength);
      const loopStart = Math.floor(samples.length * 0.35);
      const loopLength = Math.floor(samples.length * 0.3);
      const fade = Math.min(512, loopLength);
      const gain = (note.volume / 100) ** 1.5;
      for (let i = 0; i < length; i++) {
        let pos = i * speed;
        if (sustain && pos >= loopStart + loopLength) {
          pos = loopStart + (pos - loopStart) % loopLength;
        }
        const j = Math.floor(pos);
        let value = samples[j] + (samples[j + 1] - samples[j]) * (pos - j);
        if (sustain && pos >= loopStart + loopLength - fade) {
          const blend = (pos - (loopStart + loopLength - fade)) / fade;
          value += (samples[j - loopLength] - value) * blend;
        }
        const release = i < held ? 1 : (length - i) / (length - held);
        mix[start + i] += value * gain * release;
      }
    }
  });
  let peak = 1;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  const pcm = Int16Array.from(mix, (value, i) =>
    value * (29000 / peak) * Math.min(1, (period - i) / (0.015 * rate)));
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const tag = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  const bytes = pcm.byteLength * verseCount;
  tag(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  tag(36, 'data'); view.setUint32(40, bytes, true);
  return URL.createObjectURL(new Blob([header, ...Array(verseCount).fill(pcm)], { type: 'audio/wav' }));
}

function changeAudio() {
  pending ??= { time: player.currentTime, resume: !player.paused };
  const oldUrl = generatedUrl;
  const steps = Number(key.value);
  generatedUrl = makeAudio(steps);
  player.src = generatedUrl;
  player.load();
  if (oldUrl) URL.revokeObjectURL(oldUrl);
}

key.addEventListener('change', () => { changeAudio(); drawScore(); highlight(); });
instrument.addEventListener('change', changeAudio);
const tempo = document.querySelector('#tempo');
function applyTempo() {
  const bpm = tempo.valueAsNumber;
  player.preservesPitch = true;
  player.defaultPlaybackRate = bpm / scoreTempo;
  player.playbackRate = bpm / scoreTempo;
  tempo.setAttribute('aria-valuetext', bpm + ' beats per minute');
  document.querySelector('#tempo-value').value = bpm + ' BPM';
}
function resetTempo(bpm) {
  tempo.min = Math.min(40, Math.floor(bpm));
  tempo.max = Math.max(160, Math.ceil(bpm));
  tempo.value = Math.round(bpm);
  applyTempo();
}
tempo.addEventListener('input', applyTempo);
player.addEventListener('loadedmetadata', () => {
  applyTempo();
  if (!pending) return;
  const { time, resume } = pending;
  pending = null;
  player.currentTime = Math.min(time, player.duration);
  if (resume) player.play().catch(() => {});
});
player.addEventListener('play', follow);
player.addEventListener('pause', () => cancelAnimationFrame(frame));
player.addEventListener('seeked', highlight);
player.addEventListener('ended', highlight);

const fileInput = document.querySelector('#abc-file');
const tuneSelect = document.querySelector('#tune');
const status = document.querySelector('#file-status');
let book;
let readId = 0;

const warnings = document.querySelector('#abc-warnings');

function showWarnings(messages = []) {
  const list = warnings.querySelector('ul');
  list.replaceChildren();
  for (const message of messages) {
    const item = document.createElement('li');
    item.textContent = message
      .replace(/^Music Line:(\d+):(\d+): /, 'Music line $1, column $2 — ')
      .replace(/<span style="[^"]*">([\s\S]*?)<\/span>/g, '⟦$1⟧')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    list.append(item);
  }
  warnings.hidden = list.childElementCount === 0;
}

function prepareTune(abc) {
  status.classList.remove('error');
  showWarnings();
  if (!/^K:/m.test(abc)) {
    throw new Error('Missing key. Add a key field such as K:C on its own line before the notes.');
  }
  const parsed = ABCJS.parseOnly(abc);
  const tune = parsed[0];
  showWarnings(tune?.warnings);
  const audio = tune?.setUpAudio({ chordsOff: Boolean(tune.formatting.midi?.gchordoff) });
  if (!audio?.tracks.some(track => track.some(event => event.cmd === 'note'))) {
    throw new Error('This tune contains no playable notes.');
  }
  const bpm = audio.tempo * tune.getBeatLength() * 4;
  if (!(bpm > 0 && Number.isFinite(bpm))) throw new Error('The file contains an invalid tempo.');
  return { abc, parsed, audio, bpm };
}

function openTune({ abc, parsed, audio, bpm }, filename) {
  const tune = parsed[0];
  const title = tune.metaText.title || filename;
  player.pause();
  pending = { time: 0, resume: false };
  source = abc;
  original = parsed;
  tracks = audio.tracks;
  verseCount = title === 'Dirty Old Town' && /^w:.*(?:\nw:.*){3}/m.test(abc) ? 4 : 1;
  scoreTempo = bpm;
  secondsPerWholeNote = 240 / scoreTempo;
  key.value = '0';
  document.querySelector('#playback').hidden = false;
  drawScore();
  // The rendered end event also includes trailing rests and written repeats.
  verseDuration = Math.max(audio.totalDuration * secondsPerWholeNote,
    scoreEndMs / 1000);
  for (const option of key.options) {
    const steps = Number(option.value);
    const shifted = steps ? ABCJS.strTranspose(abc, parsed, steps) : abc;
    const name = shifted.match(/^K:\s*([^\s%\n]+)/m)?.[1] || '';
    option.textContent = steps ? name + ' (' + (steps > 0 ? '+' : '') + steps + ')' : name + ' (original)';
  }
  verse.hidden = verseCount === 1;
  document.querySelector('h1').textContent = title;
  document.title = title + ' · ABC Player';
  player.setAttribute('aria-label', 'Play ' + title);
  resetTempo(bpm);
  changeAudio();
  highlight();
}

function openBook(input, fallbackTitle, libraryFile = '') {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const tunes = new ABCJS.TuneBook(text).tunes;
  const first = prepareTune(tunes[0]?.abc || '');
  openTune(first, fallbackTitle);
  book = tunes;
  library.value = libraryFile;
  const download = document.querySelector('#download');
  download.hidden = !libraryFile;
  if (libraryFile) download.querySelector('a').href = tuneUrl(libraryFile);
  tuneSelect.replaceChildren(...tunes.map((entry, i) =>
    new Option(entry.title || 'Tune ' + (i + 1), i)));
  tuneSelect.hidden = tuneSelect.labels[0].hidden = tunes.length < 2;
  status.textContent = '';
}

document.querySelector('#paste-form').addEventListener('submit', event => {
  event.preventDefault();
  ++readId;
  try {
    const input = document.querySelector('#abc-text').value.replace(/\r\n?/g, '\n');
    const block = input.match(/^`{3}(?:abc)?[^\S\n]*\n([\s\S]*?)^`{3}[^\S\n]*$/im);
    // TuneBook ends a tune at a blank line, even between its header and notes.
    const text = (block?.[1] ?? input).split('\n').map(line => line.trimStart())
      .filter(Boolean).join('\n');
    openBook(text, 'Pasted tune');
    document.querySelector('#paste-form').closest('details').open = !warnings.hidden;
    const title = document.querySelector('h1').textContent;
    status.textContent = 'Opened: ' + title;
    const openedSource = player.src;
    player.play().catch(error => {
      if (player.src !== openedSource || error.name === 'AbortError') return;
      status.textContent = error.name === 'NotAllowedError'
        ? title + ' is ready. Press play to listen.'
        : 'Could not play ' + title + '. ' + error.message;
    });
  } catch (error) {
    status.classList.add('error');
    status.textContent = 'Could not open the pasted ABC notation. ' + error.message;
  }
});

fileInput.addEventListener('change', async () => {
  const id = ++readId;
  const file = fileInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    if (id !== readId) return;
    openBook(text, file.name);
  } catch (error) {
    status.classList.add('error');
    status.textContent = 'Could not open the file. ' + error.message;
  }
  fileInput.value = '';
});

tuneSelect.addEventListener('change', () => {
  ++readId;
  try {
    openTune(prepareTune(book[tuneSelect.value].abc), tuneSelect.selectedOptions[0].text);
    status.textContent = '';
  } catch (error) {
    tuneSelect.value = book.findIndex(entry => entry.abc === source);
    status.classList.add('error');
    status.textContent = 'Could not open the tune. ' + error.message;
  }
});

const library = document.querySelector('#library');
function tuneUrl(file) {
  return 'tunes/' + file.split('/').map(encodeURIComponent).join('/');
}

async function refreshLibrary() {
  try {
    const response = await fetch('api/tunes', { cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
    const entries = await response.json();
    entries.sort((a, b) => a.title.localeCompare(b.title, 'en'));
    const selected = library.value;
    library.replaceChildren(library.options[0], ...entries.map(({ file, title }) => new Option(title, file)));
    library.value = entries.some(entry => entry.file === selected) ? selected : '';
    library.disabled = entries.length === 0;
  } catch {
    // Static hosts use the bundled filenames listed in the selector.
  }
}

if (location.protocol === 'file:') {
  library.hidden = library.labels[0].hidden = true;
  status.textContent = 'Choose an ABC file from the tunes folder to play it.';
} else if (!location.hostname.endsWith('.github.io')) {
  refreshLibrary();
}

library.addEventListener('change', async () => {
  const id = ++readId;
  const file = library.value;
  try {
    const response = await fetch(tuneUrl(file), { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    if (id === readId) openBook(text, file, file);
  } catch (error) {
    if (id !== readId) return;
    library.value = '';
    status.classList.add('error');
    status.textContent = 'Could not open ' + file + '. ' + error.message;
  }
});
