import { CanvasTexture, SRGBColorSpace } from "three";

const cache = new Map<string, CanvasTexture>();

const FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

/** An emoji drawn onto a canvas texture, optionally inside a white speech-bubble circle. */
export function emojiTexture(emoji: string, bubble = false): CanvasTexture {
  const key = `${emoji}:${bubble}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  if (bubble) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 + 5, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `${bubble ? 60 : 96}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + (bubble ? 3 : 6));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}
