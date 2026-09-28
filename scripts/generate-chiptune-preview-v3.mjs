import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sampleRate = 44_100;
const tempo = 108;
const beat = 60 / tempo;
const eighth = beat / 2;
const bars = 16;
const duration = bars * beat * 4;
const frames = Math.ceil(duration * sampleRate);
const left = new Float64Array(frames);
const right = new Float64Array(frames);

const notes = {
  C3: 130.81, D3: 146.83, F3: 174.61, G3: 196, A3: 220, Bb3: 233.08,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, Bb4: 466.16,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, Bb5: 932.33,
  C6: 1046.5,
};

const melody = [
  ["A4", null, "C5", "A4", null, "G4", "F4", null],
  ["F4", null, "A4", null, "C5", "A4", null, null],
  ["D5", null, "C5", "A4", null, "F4", "G4", null],
  ["G4", null, "E4", "G4", null, "C5", null, null],
  ["A4", "C5", null, "F5", null, "E5", "C5", null],
  ["A4", null, "F4", "A4", "C5", null, "D5", null],
  ["F5", null, "D5", "C5", null, "A4", "G4", null],
  ["E4", "G4", null, "C5", null, "G4", null, null],
  ["C5", null, "A4", "F4", null, "G4", "A4", null],
  ["D5", null, "A4", null, "F4", "A4", null, null],
  ["Bb4", null, "D5", "F5", null, "D5", "C5", null],
  ["G4", null, "C5", null, "E5", "D5", "C5", null],
  ["A4", null, "C5", "F5", null, "E5", "C5", null],
  ["F4", "A4", null, "D5", null, "C5", "A4", null],
  ["Bb4", null, "A4", "F4", null, "G4", "D5", null],
  ["E5", null, "C5", "G4", null, "E4", "G4", null],
];

const chords = [
  ["F4", "A4", "C5", "E5"], ["D4", "F4", "A4", "C5"], ["Bb4", "D5", "F5", "A5"], ["C4", "E4", "G4", "D5"],
  ["F4", "A4", "C5", "E5"], ["D4", "F4", "A4", "C5"], ["Bb4", "D5", "F5", "A5"], ["C4", "E4", "G4", "D5"],
  ["F4", "A4", "C5", "E5"], ["D4", "F4", "A4", "C5"], ["Bb4", "D5", "F5", "A5"], ["C4", "E4", "G4", "D5"],
  ["F4", "A4", "C5", "E5"], ["D4", "F4", "A4", "C5"], ["Bb4", "D5", "F5", "A5"], ["C4", "E4", "G4", "D5"],
];
const roots = ["F3", "D3", "Bb3", "C3", "F3", "D3", "Bb3", "C3", "F3", "D3", "Bb3", "C3", "F3", "D3", "Bb3", "C3"];
const fifths = ["C4", "A3", "F3", "G3", "C4", "A3", "F3", "G3", "C4", "A3", "F3", "G3", "C4", "A3", "F3", "G3"];

let randomState = 0x3c411a5e;
const noise = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0xffffffff * 2 - 1;
};
const pan = value => [Math.sqrt((1 - value) / 2), Math.sqrt((1 + value) / 2)];

function addVoice(start, length, frequency, volume, wave, stereo = 0, duty = .5, attack = .012, release = .16) {
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(frames, Math.ceil((start + length) * sampleRate));
  const [gainL, gainR] = pan(stereo);
  for (let frame = from; frame < to; frame++) {
    const time = frame / sampleRate - start;
    const phase = time * frequency % 1;
    const envelope = Math.min(1, time / attack) * Math.min(1, (length - time) / release);
    let value = 0;
    if (wave === "pulse") value = phase < duty ? 1 : -1;
    else if (wave === "triangle") value = 1 - 4 * Math.abs(Math.round(phase) - phase);
    else if (wave === "sine") value = Math.sin(phase * Math.PI * 2);
    else if (wave === "noise") value = noise();
    const sample = value * volume * Math.max(0, envelope);
    left[frame] += sample * gainL; right[frame] += sample * gainR;
  }
}

function addEchoedLead(start, frequency, length) {
  addVoice(start, length, frequency, .13, "triangle", -.22, .5, .015, .18);
  addVoice(start, length, frequency * .997, .045, "pulse", .15, .25, .02, .2);
  addVoice(start + beat * .7, length * .72, frequency, .032, "triangle", .34, .5, .02, .2);
}

for (let bar = 0; bar < bars; bar++) {
  const barStart = bar * beat * 4;
  melody[bar].forEach((name, index) => {
    if (name) addEchoedLead(barStart + index * eighth, notes[name], eighth * 1.32);
  });

  for (let step = 0; step < 8; step++) {
    const chord = chords[bar], name = chord[step % chord.length];
    addVoice(barStart + step * eighth, eighth * .7, notes[name], .037, "pulse", .28, .125, .01, .12);
  }

  addVoice(barStart, beat * 1.7, notes[roots[bar]], .12, "triangle", -.08, .5, .025, .28);
  addVoice(barStart + beat * 2, beat * 1.7, notes[fifths[bar]], .095, "triangle", -.08, .5, .025, .28);

  for (let step = 0; step < 8; step++) {
    const at = barStart + step * eighth;
    addVoice(at, .028, 1, step % 2 ? .016 : .026, "noise", .2, .5, .001, .025);
  }
  [0, 2.5].forEach(position => {
    addVoice(barStart + position * beat, .12, 58, .11, "sine", 0, .5, .004, .11);
    addVoice(barStart + position * beat, .035, 1, .035, "noise", 0, .5, .001, .03);
  });
  [1, 3].forEach(position => addVoice(barStart + position * beat, .09, 1, .055, "noise", .08, .5, .001, .08));
  if (bar % 4 === 3) {
    addVoice(barStart + beat * 3.5, beat * .75, notes.C6, .042, "triangle", .35, .5, .01, .2);
    addVoice(barStart + beat * 3.5 + .16, beat * .5, notes.G5, .025, "triangle", -.3, .5, .01, .18);
  }
}

for (let frame = 0; frame < frames; frame++) {
  const time = frame / sampleRate;
  const fade = Math.min(1, time / .16, (duration - time) / .6);
  left[frame] *= Math.max(0, fade); right[frame] *= Math.max(0, fade);
}
let peak = .001;
for (let frame = 0; frame < frames; frame++) peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
const scale = .88 / peak;
const dataBytes = frames * 4;
const wav = Buffer.alloc(44 + dataBytes);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + dataBytes, 4); wav.write("WAVE", 8);
wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(dataBytes, 40);
for (let frame = 0; frame < frames; frame++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[frame] * scale)) * 32767), 44 + frame * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[frame] * scale)) * 32767), 46 + frame * 4);
}

const output = resolve("previews/sky-parcel-panic-chiptune-v3-chill.wav");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, wav);
console.log(`${output}\n${duration.toFixed(2)} seconds · 108 BPM · stereo PCM WAV · ${sampleRate} Hz`);
