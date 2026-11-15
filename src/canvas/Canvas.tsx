import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../model/store';
import { childrenIndex } from '../model/selectors';
import { ItemRenderer } from './ItemRenderer';
import { useGestures } from './gestures';
import type { Point } from '../model/types';
import type { AlignmentGuide } from '../model/snapping';
import { headingScale } from '../model/geometry';
export function Canvas({
  panelId,
  onContext,
}: {
  panelId: string;
  onContext: (point: Point, screen: Point, taskIds?: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    crossing: boolean;
  } | null>(null);
  const view = useStore((s) => s.doc.panels[panelId].viewport);
  const selectionMode = useStore((s) => s.selectionMode);
  const roots = useStore(
    useShallow((s) =>
      (childrenIndex(s.doc.items).get(null) ?? []).filter(
        (id) => s.doc.items[id].panelId === panelId,
      ),
    ),
  );
  useGestures(ref, panelId, setBox, onContext, setGuides);
  return (
    <div
      ref={ref}
      className={`canvas ${selectionMode ? 'selectingItems' : ''}`}
      aria-label="Panel canvas"
    >
      <div
        className="world"
        style={
          {
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            '--canvas-zoom': view.zoom,
            '--handle-size': `${Math.min(80, 32 / view.zoom)}px`,
            '--title-handle-size': `${Math.min(80, 32 / (view.zoom * headingScale(view.zoom)))}px`,
          } as React.CSSProperties
        }
      >
        {roots.map((id) => (
          <ItemRenderer key={id} id={id} />
        ))}
      </div>
      {!roots.length && (
        <div className="canvasEmpty">
          <span className="emptyMark">✧</span>
          <h2>Room for your next idea</h2>
          <p>
            Double-click anywhere to create a task.
            <br />
            Use + to add an area or a note.
          </p>
        </div>
      )}
      {box && (
        <div
          className={`selectionBox ${box.crossing ? 'crossingSelection' : ''}`}
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      )}
      {guides.map((guide) => (
        <div
          key={guide.axis}
          className={`alignmentGuide guide-${guide.axis}`}
          style={
            guide.axis === 'x'
              ? { left: view.x + guide.value * view.zoom }
              : { top: view.y + guide.value * view.zoom }
          }
        />
      ))}
      <div className="canvasHint">
        <span>Wheel to zoom · Middle-drag to pan · Drag to select</span>
        <b>{Math.round(view.zoom * 100)}%</b>
      </div>
    </div>
  );
}
