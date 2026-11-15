import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { AreaItem } from '../model/types';
import { areaTasks, useStore } from '../model/store';
export function AreaPreview({ area }: { area: AreaItem }) {
  const doc = useStore((s) => s.doc),
    highlights = useStore((s) => s.highlights);
  const outer = useRef<HTMLDivElement>(null),
    inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.45, height: 0 });
  useLayoutEffect(() => {
    const update = () => {
      if (outer.current && inner.current) {
        const scale = outer.current.clientWidth / 360,
          height = inner.current.offsetHeight * scale;
        setSize((old) =>
          old.scale === scale && old.height === height
            ? old
            : { scale, height },
        );
      }
    };
    const observer = new ResizeObserver(update);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    update();
    return () => observer.disconnect();
  }, []);
  const tasks = areaTasks(doc, area.id, true);
  return (
    <div
      ref={outer}
      className="areaMini"
      style={{ height: size.height }}
      aria-hidden="true"
    >
      <div
        ref={inner}
        className={`previewInner taskGrid taskColumns${area.taskColumns}`}
        style={{ transform: `scale(${size.scale})` }}
      >
        {Array.from({ length: area.taskColumns }, (_, column) => (
          <div className="taskColumn" key={column}>
            {tasks
              .filter((t) => area.taskColumns === 1 || t.column === column)
              .map((task) => {
                const match =
                  highlights.includes(task.state) ||
                  (task.important && highlights.includes('important'));
                return (
                  <div
                    className={`gridTask previewTask ${highlights.length ? (match ? 'matched' : 'dimmed') : ''} ${task.state === 'done' ? 'done' : ''}`}
                    key={task.id}
                    style={
                      {
                        '--item-color': doc.settings.stateColors[task.state],
                      } as CSSProperties
                    }
                  >
                    <div
                      className="previewTitle"
                      style={{
                        fontSize:
                          task.titleFontSize ?? doc.settings.taskTitleSize,
                      }}
                    >
                      <i
                        style={{
                          background: doc.settings.stateColors[task.state],
                        }}
                      />
                      {task.title}
                      {task.important ? ' ★' : ''}
                    </div>
                    {!task.collapsed && (
                      <>
                        <p>{task.description}</p>
                        {task.subtasksExpanded &&
                          task.subtasks
                            .filter(
                              (s) =>
                                doc.settings.showDone || s.state !== 'done',
                            )
                            .map((sub) => (
                              <p key={sub.id}>
                                <i
                                  style={{
                                    background:
                                      doc.settings.stateColors[sub.state],
                                  }}
                                />
                                {sub.title}
                              </p>
                            ))}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
