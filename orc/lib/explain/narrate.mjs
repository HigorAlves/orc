// narrate.mjs <segments.json> <outDir> — one WAV per segment with narration,
// via kokoro-js (82M ONNX, CPU, downloads the model once into the HF cache).
// Prints one JSON line per file: {id, file, seconds}. Voice: segments.voice,
// else ORC_EXPLAIN_VOICE, else af_heart (English). pf_dora / pm_alex are pt-BR.
import { KokoroTTS } from 'kokoro-js';
import fs from 'node:fs';
import path from 'node:path';

const [, , segmentsPath, outDir] = process.argv;
if (!segmentsPath || !outDir) { console.error('usage: narrate.mjs <segments.json> <outDir>'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(segmentsPath, 'utf8'));
const voice = doc.voice ?? process.env.ORC_EXPLAIN_VOICE ?? 'af_heart';
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' });
fs.mkdirSync(outDir, { recursive: true });
for (const s of doc.segments) {
  if (!s.narration) continue;
  const audio = await tts.generate(s.narration, { voice });
  const file = path.join(outDir, `${s.id}.wav`);
  await audio.save(file);
  console.log(JSON.stringify({ id: s.id, file, seconds: audio.audio.length / audio.sampling_rate }));
}
