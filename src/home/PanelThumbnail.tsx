import { useStore, areaTasks, ordered } from '../model/store';
export function PanelThumbnail({ panelId }: { panelId: string }) {
  const doc = useStore((s) => s.doc),
    panel = doc.panels[panelId];
  const columns = panel.columns.map((columnId) =>
    ordered(
      Object.values(doc.items).filter(
        (i) =>
          i.type === 'area' && i.panelId === panelId && i.columnId === columnId,
      ),
    ),
  );
  const areaHeight = (id: string) => {
    const area = doc.items[id],
      tasks = areaTasks(doc, id, true);
    return (
      38 +
      Math.max(
        20,
        (area.type === 'area' && area.taskColumns === 2
          ? Math.max(
              tasks.filter((t) => t.column === 0).length,
              tasks.filter((t) => t.column === 1).length,
            )
          : tasks.length) * 16,
      )
    );
  };
  const heights = columns.map((areas) =>
    areas.reduce((sum, area) => sum + areaHeight(area.id), 0),
  );
  return (
    <svg
      className="thumbnail"
      viewBox={`0 0 ${Math.max(2, columns.length) * 180} ${Math.max(120, ...heights)}`}
      role="img"
      aria-label="Panel mini-map"
    >
      {columns.map((areas, column) => {
        let y = 8;
        return (
          <g key={column}>
            {areas.map((area) => {
              if (area.type !== 'area') return null;
              const top = y,
                tasks = areaTasks(doc, area.id, true);
              y += areaHeight(area.id);
              return (
                <g key={area.id}>
                  <text
                    x={column * 180 + 8}
                    y={top + 14}
                    fontSize="13"
                    fill={area.color ?? '#7770bd'}
                  >
                    {area.title}
                  </text>
                  <line
                    x1={column * 180 + 8}
                    x2={column * 180 + 164}
                    y1={top + 21}
                    y2={top + 21}
                    stroke={area.color ?? '#7770bd'}
                    strokeWidth="2"
                  />
                  {tasks.map((task, index) => (
                    <rect
                      key={task.id}
                      x={
                        column * 180 +
                        8 +
                        (area.taskColumns === 2 ? task.column * 80 : 0)
                      }
                      y={
                        top +
                        28 +
                        (area.taskColumns === 2
                          ? tasks
                              .filter((t) => t.column === task.column)
                              .indexOf(task)
                          : index) *
                          16
                      }
                      width={area.taskColumns === 2 ? 74 : 154}
                      height="11"
                      rx="3"
                      fill={doc.settings.stateColors[task.state]}
                      fillOpacity=".4"
                    />
                  ))}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
