// engine/audio/wav.js — AudioBuffer (or channel arrays) → 16-bit PCM WAV bytes / base64. Deterministic TPDF dither.
//   const bytes = encodeWav(buffer);  const b64 = toBase64(bytes);
import { hash } from '../core/rng.js';

export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, n = buffer.length, sr = buffer.sampleRate;
  const data = [...Array(ch)].map((_, c) => buffer.getChannelData(c));
  const bytes = new Uint8Array(44 + n * ch * 2);
  const v = new DataView(bytes.buffer);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const d = (hash(i, c, 1) - hash(i, c, 2)) / 32768;
    const s = Math.max(-1, Math.min(1, data[c][i] + d));
    v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2;
  }
  return bytes;
}

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
