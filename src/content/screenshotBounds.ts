import type { DOMRectLike } from "../shared/types";

export function toDOMRectLike(rect: DOMRect): DOMRectLike {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left
  };
}

export function isUsefulBoardRect(rect: DOMRect): boolean {
  if (rect.width < 120 || rect.height < 120) {
    return false;
  }

  const ratio = rect.width / rect.height;
  return ratio > 0.82 && ratio < 1.18;
}

export function rectVisibleArea(rect: DOMRect): number {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, window.innerWidth);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}
