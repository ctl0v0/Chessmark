import type { DOMRectLike } from "./types";

export type CropResult = {
  dataUrl: string;
  width: number;
  height: number;
};

const MAX_SAVED_SCREENSHOT_EDGE = 520;
const SAVED_SCREENSHOT_QUALITY = 0.72;

export async function cropVisibleTabImage(
  screenshotDataUrl: string,
  rect: DOMRectLike,
  viewport: { width: number; height: number }
): Promise<CropResult> {
  const image = await loadImage(screenshotDataUrl);
  const scaleX = image.naturalWidth / viewport.width;
  const scaleY = image.naturalHeight / viewport.height;

  const sourceX = clamp(rect.left * scaleX, 0, image.naturalWidth);
  const sourceY = clamp(rect.top * scaleY, 0, image.naturalHeight);
  const sourceRight = clamp(rect.right * scaleX, 0, image.naturalWidth);
  const sourceBottom = clamp(rect.bottom * scaleY, 0, image.naturalHeight);
  const sourceWidth = Math.max(1, Math.round(sourceRight - sourceX));
  const sourceHeight = Math.max(1, Math.round(sourceBottom - sourceY));

  const outputScale = Math.min(1, MAX_SAVED_SCREENSHOT_EDGE / Math.max(sourceWidth, sourceHeight));
  const outputWidth = Math.max(1, Math.round(sourceWidth * outputScale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * outputScale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create image crop context.");
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", SAVED_SCREENSHOT_QUALITY),
    width: outputWidth,
    height: outputHeight
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load captured tab image."));
    image.src = dataUrl;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
