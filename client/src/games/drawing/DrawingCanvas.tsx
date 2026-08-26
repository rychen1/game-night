import { useEffect, useRef, type PointerEvent } from "react";
import type { Stroke, StrokePoint } from "../../network/messages.ts";

const COLORS = [
  "#7c3aed",
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#4f46e5",
];

function colorForPlayer(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i += 1) {
    hash = (hash + playerId.charCodeAt(i) * (i + 1)) % COLORS.length;
  }
  return COLORS[hash] ?? COLORS[0];
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  for (const stroke of strokes) {
    if (stroke.points.length === 0) {
      continue;
    }
    ctx.strokeStyle = colorForPlayer(stroke.playerId);
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }
}

type DrawingCanvasProps = {
  strokes: Stroke[];
  enabled: boolean;
  playerId: string;
  onStroke: (points: StrokePoint[]) => void;
};

export function DrawingCanvas({
  strokes,
  enabled,
  playerId,
  onStroke,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const localPoints = useRef<StrokePoint[]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    drawStrokes(ctx, strokes, canvas.width, canvas.height);
  }, [strokes]);

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>): StrokePoint | null {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function redrawWithLocal(points: StrokePoint[]): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    drawStrokes(
      ctx,
      [...strokes, { playerId, points }],
      canvas.width,
      canvas.height,
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={enabled ? "drawing-canvas" : "drawing-canvas disabled"}
      width={640}
      height={400}
      onPointerDown={(event) => {
        if (!enabled) {
          return;
        }
        const point = pointFromEvent(event);
        if (!point) {
          return;
        }
        drawing.current = true;
        localPoints.current = [point];
        event.currentTarget.setPointerCapture(event.pointerId);
        redrawWithLocal(localPoints.current);
      }}
      onPointerMove={(event) => {
        if (!enabled || !drawing.current) {
          return;
        }
        const point = pointFromEvent(event);
        if (!point) {
          return;
        }
        localPoints.current = [...localPoints.current, point];
        redrawWithLocal(localPoints.current);
      }}
      onPointerUp={() => {
        if (!enabled || !drawing.current) {
          return;
        }
        drawing.current = false;
        const points = localPoints.current;
        localPoints.current = [];
        if (points.length > 0) {
          onStroke(points);
        }
      }}
    />
  );
}
