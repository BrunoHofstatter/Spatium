import { useMemo } from 'react';
import { useStore } from '../model/store';
import {
  absolutePosition,
  displayHeight,
  isVisible,
  itemBounds,
} from '../model/geometry';
export function PanelThumbnail({ panelId }: { panelId: string }) {
  const doc = useStore((s) => s.doc);
  const shapes = useMemo(
    () =>
      Object.values(doc.items)
        .filter((i) => i.panelId === panelId && isVisible(doc, i))
        .map((item) => ({
          item,
          ...absolutePosition(doc.items, item.id),
          height: displayHeight(
            item,
            doc.settings.showDone,
            doc.settings.taskTitleSize,
          ),
        }))
        .sort((a, b) => {
          const depth = (id: string): number => {
            const p = doc.items[id].parentId;
            return p ? 1 + depth(p) : 0;
          };
          return depth(a.item.id) - depth(b.item.id) || a.item.z - b.item.z;
        }),
    [doc, panelId],
  );
  const left = shapes.length ? Math.min(...shapes.map((s) => s.x)) - 40 : 0,
    top = shapes.length
      ? Math.min(...shapes.map((s) => itemBounds(doc, s.item).y)) - 40
      : 0;
  const width = shapes.length
      ? Math.max(...shapes.map((s) => s.x + s.item.w)) - left + 40
      : 400,
    height = shapes.length
      ? Math.max(...shapes.map((s) => s.y + s.height)) - top + 40
      : 220;
  return (
    <svg
      className="thumbnail"
      viewBox={`${left} ${top} ${width} ${height}`}
      role="img"
      aria-label="Panel mini-map"
    >
      <rect x={left} y={top} width={width} height={height} fill="none" />
      {shapes.map(({ item, x, y, height }) =>
        item.type === 'area' ? (
          <g key={item.id}>
            <line
              x1={x}
              y1={y - 8}
              x2={x + item.w}
              y2={y - 8}
              stroke={item.color || '#7770bd'}
              strokeWidth="4"
            />
            <text
              x={x}
              y={y - 20}
              fontSize={item.fontSize}
              fill={item.color || '#7770bd'}
            >
              {item.title}
            </text>
          </g>
        ) : item.type === 'task' ? (
          <rect
            key={item.id}
            x={x}
            y={y}
            width={item.w}
            height={height}
            rx="8"
            fill={doc.settings.stateColors[item.state]}
            fillOpacity=".3"
            stroke={doc.settings.stateColors[item.state]}
            strokeOpacity=".5"
          />
        ) : (
          <g key={item.id} opacity=".45">
            {[0, 1, 2].map((n) => (
              <rect
                key={n}
                x={x}
                y={y + n * 12}
                width={item.w * (n === 2 ? 0.6 : 0.9)}
                height="3"
                rx="1"
                fill="#8c92a4"
              />
            ))}
          </g>
        ),
      )}
    </svg>
  );
}
