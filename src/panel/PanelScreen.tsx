import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { areaTasks, ordered, useStore } from '../model/store';
import { TopBar } from './TopBar';
import { Editable } from '../canvas/Editable';
import { TaskCard } from '../canvas/TaskCard';
import { SelectionToolbar } from '../canvas/SelectionToolbar';
import { AreaPreview } from './AreaPreview';
import { ActionSheet } from '../ui/ActionSheet';
import { FontSizeControl } from '../ui/FontSizeControl';
import { ColorInput } from '../settings/ColorInput';
import { useGridDrag } from '../ui/useGridDrag';

function readScroll(key: string) {
  try {
    return Number(sessionStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
export function PanelScreen({
  panelId,
  areaId,
}: {
  panelId: string;
  areaId?: string;
}) {
  const doc = useStore((s) => s.doc),
    mode = useStore((s) => s.selectionMode),
    editingId = useStore((s) => s.editingId);
  const panel = doc.panels[panelId],
    area = areaId ? doc.items[areaId] : undefined;
  const root = useRef<HTMLDivElement>(null),
    returning = useRef(false),
    restoring = useRef(false);
  const [options, setOptions] = useState(false),
    [size, setSize] = useState('24');
  const validArea =
    area?.type === 'area' && area.panelId === panelId ? area : null;
  const viewKey = `spatium-area-scroll-${areaId}`;
  const back = () => {
    if (returning.current) return;
    returning.current = true;
    {
      if (history.state?.spatiumArea === areaId) history.back();
      else {
        history.replaceState(null, '', `#/panel/${panelId}`);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }
  };
  const open = (id: string, edit = false) => {
    window.location.hash = `#/panel/${panelId}/area/${id}`;
    history.replaceState(
      { spatiumArea: id, editArea: edit ? id : null },
      '',
      window.location.href,
    );
  };
  useLayoutEffect(() => {
    returning.current = false;
    restoring.current = true;
    const view = useStore.getState().doc.panels[panelId].viewport;
    const x = areaId ? 0 : view.x,
      y = areaId ? readScroll(`spatium-area-scroll-${areaId}`) : view.y;
    root.current?.scrollTo(x, y);
    let settled = 0;
    const frame = requestAnimationFrame(() => {
      root.current?.scrollTo(x, y);
      settled = requestAnimationFrame(() => {
        restoring.current = false;
      });
    });
    useStore.getState().select([]);
    useStore.getState().setSelectionMode(false);
    if (areaId && history.state?.editArea === areaId) {
      useStore.getState().setEditing(areaId);
      history.replaceState({ spatiumArea: areaId }, '', location.href);
    }
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settled);
    };
  }, [panelId, areaId]);
  useEffect(() => {
    if (areaId && !validArea) {
      history.replaceState(null, '', `#/panel/${panelId}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [areaId, validArea, panelId]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !e.defaultPrevented &&
        areaId &&
        !useStore.getState().selectionMode &&
        !useStore.getState().selection.length &&
        !(e.target as HTMLElement).closest('input,textarea,select') &&
        !document.querySelector('[role="dialog"]')
      )
        back();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useGridDrag(root, areaId ? 'task' : 'area', (id, column, before) => {
    if (areaId) {
      const s = useStore.getState();
      const ids = s.selection.includes(id)
        ? areaTasks(s.doc, areaId)
            .filter((t) => s.selection.includes(t.id))
            .map((t) => t.id)
        : [id];
      useStore
        .getState()
        .moveTasks(
          ids,
          areaId,
          column === 'keep' ? undefined : (Number(column) as 0 | 1),
          before,
        );
    } else useStore.getState().moveArea(id, column, before);
  });
  const tasks = validArea ? areaTasks(doc, validArea.id, true) : [];
  const columns = validArea
    ? Array.from({ length: validArea.taskColumns }, (_, i) => String(i))
    : panel.columns;
  const edge = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      if (edge.current) e.preventDefault();
    };
    const strip = document.querySelector<HTMLElement>('.backSwipe');
    strip?.addEventListener('touchmove', prevent, { passive: false });
    return () => strip?.removeEventListener('touchmove', prevent);
  }, [areaId]);
  return (
    <main
      className={`gridScreen ${areaId ? 'focusedArea' : 'panelBoard'}`}
      style={
        validArea ? { viewTransitionName: `area-${validArea.id}` } : undefined
      }
    >
      <TopBar panelId={panelId} areaId={areaId} back={back} />
      {validArea && (
        <header
          className="focusedHeading"
          style={
            {
              '--area-accent': validArea.color ?? '#7770bd',
              '--area-title-size': `${validArea.fontSize}px`,
            } as CSSProperties
          }
        >
          <Editable
            label="Area title"
            className="areaTitle"
            value={validArea.title}
            editing={editingId === validArea.id}
            onFinish={() => useStore.getState().setEditing(null)}
            onCommit={(title) =>
              useStore.getState().updateItem(validArea.id, { title })
            }
          />
          <div className="areaTools">
            <button
              aria-label="Task column count"
              aria-pressed={validArea.taskColumns === 1}
              onClick={() =>
                useStore.getState().updateItem(validArea.id, {
                  taskColumns: validArea.taskColumns === 1 ? 2 : 1,
                })
              }
            >
              {validArea.taskColumns === 1 ? '1 column' : '2 columns'}
            </button>
            <button
              aria-pressed={mode}
              onClick={() => useStore.getState().setSelectionMode(!mode)}
            >
              Select more
            </button>
            <button
              aria-label="Area options"
              onClick={() => {
                setSize(String(validArea.fontSize));
                setOptions(true);
              }}
            >
              •••
            </button>
          </div>
        </header>
      )}
      <div
        ref={root}
        className={validArea ? 'areaScroll' : 'boardScroll'}
        aria-label={validArea ? 'Area tasks' : 'Panel board'}
        onScroll={(e) => {
          if (restoring.current) return;
          const el = e.currentTarget;
          if (areaId) {
            try {
              sessionStorage.setItem(viewKey, String(el.scrollTop));
            } catch {
              /* Navigation can remain in memory when storage is full. */
            }
          } else
            useStore.getState().setViewport(panelId, {
              x: el.scrollLeft,
              y: el.scrollTop,
              zoom: 1,
            });
        }}
      >
        <div
          className={
            validArea
              ? `taskGrid taskColumns${validArea.taskColumns}`
              : 'areaBoardColumns'
          }
        >
          {columns.map((column, index) => (
            <section
              className={validArea ? 'taskColumn' : 'boardColumn'}
              key={column}
              data-drop-column={
                validArea
                  ? validArea.taskColumns === 1
                    ? 'keep'
                    : column
                  : column
              }
              aria-label={
                validArea
                  ? `Task column ${index + 1}`
                  : `Area column ${index + 1}`
              }
            >
              {validArea
                ? tasks
                    .filter(
                      (t) => validArea.taskColumns === 1 || t.column === index,
                    )
                    .map((task) => <TaskCard key={task.id} item={task} />)
                : ordered(
                    Object.values(doc.items).filter(
                      (i) =>
                        i.type === 'area' &&
                        i.panelId === panelId &&
                        i.columnId === column,
                    ),
                  ).map(
                    (item) =>
                      item.type === 'area' && (
                        <article
                          key={item.id}
                          className="gridArea"
                          data-grid-area={item.id}
                          data-drag-title={item.title}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open area ${item.title}`}
                          style={
                            {
                              viewTransitionName: `area-${item.id}`,
                              '--area-accent': item.color ?? '#7770bd',
                            } as CSSProperties
                          }
                          onClick={() => open(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              open(item.id);
                            }
                          }}
                        >
                          <h2 style={{ fontSize: item.fontSize }}>
                            {item.title}
                          </h2>
                          <AreaPreview area={item} />
                        </article>
                      ),
                  )}
              {!validArea &&
                !Object.values(doc.items).some(
                  (i) =>
                    i.type === 'area' &&
                    i.panelId === panelId &&
                    i.columnId === column,
                ) && (
                  <div className="emptyColumn">
                    <span>Empty column</span>
                    {panel.columns.length > 1 && (
                      <button
                        aria-label={`Remove empty column ${index + 1}`}
                        onClick={() =>
                          useStore.getState().removeColumn(panelId, column)
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
            </section>
          ))}
          {!validArea && (
            <section
              className="newColumnTarget"
              data-drop-column="new"
              aria-label="New column drop target"
            >
              Drop here for a new column
            </section>
          )}
        </div>
        {!validArea &&
          !Object.values(doc.items).some(
            (i) => i.type === 'area' && i.panelId === panelId,
          ) && <p className="boardEmpty">Add an area to get started.</p>}
        {validArea && !tasks.length && (
          <p className="boardEmpty">Add your first task.</p>
        )}
      </div>
      {validArea && (
        <div
          className="backSwipe"
          aria-hidden="true"
          onPointerDown={(e) => {
            if (
              e.pointerType === 'touch' &&
              !document.querySelector('.textEditor:focus')
            )
              edge.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          }}
          onPointerUp={(e) => {
            const start = edge.current;
            edge.current = null;
            if (
              start &&
              start.id === e.pointerId &&
              e.clientX - start.x > 64 &&
              Math.abs(e.clientY - start.y) < 40
            )
              back();
          }}
          onPointerCancel={() => (edge.current = null)}
        />
      )}
      {validArea && <SelectionToolbar areaId={validArea.id} />}
      {!mode && (
        <button
          className="addButton boardAdd"
          aria-label={validArea ? 'Add task' : 'Add area'}
          onClick={() => {
            if (validArea) {
              const id = useStore.getState().createTask(validArea.id);
              requestAnimationFrame(() =>
                document
                  .querySelector(`[data-grid-task="${id}"]`)
                  ?.scrollIntoView({ block: 'nearest' }),
              );
            } else {
              const el = root.current;
              const column = el
                ? [...el.querySelectorAll<HTMLElement>('.boardColumn')].find(
                    (c) =>
                      c.getBoundingClientRect().right >
                      el.getBoundingClientRect().left + 24,
                  )?.dataset.dropColumn
                : undefined;
              const id = useStore.getState().createArea(panelId, column);
              open(id, true);
            }
          }}
        >
          +
        </button>
      )}
      {options && validArea && (
        <ActionSheet title="Area options" close={() => setOptions(false)}>
          <label className="settingRow">
            <span>Title size</span>
            <FontSizeControl
              label="Area title size"
              min={14}
              max={72}
              value={size}
              onChange={setSize}
            />
          </label>
          <button
            onClick={() => {
              if (size && Number.isFinite(Number(size)))
                useStore
                  .getState()
                  .updateItem(validArea.id, { fontSize: Number(size) });
              setOptions(false);
            }}
          >
            Apply title size
          </button>
          <label className="settingRow">
            <span>Area color</span>
            <ColorInput
              label="Area accent color"
              value={validArea.color ?? '#7770bd'}
              onChange={(color) =>
                useStore.getState().updateItem(validArea.id, { color })
              }
            />
          </label>
          <button
            onClick={() =>
              useStore.getState().updateItem(validArea.id, { color: null })
            }
          >
            Reset color
          </button>
          <button
            className="danger"
            onClick={() => {
              if (
                !areaTasks(doc, validArea.id).length ||
                confirm('Delete this area and its tasks? You can undo this.')
              ) {
                useStore.getState().deleteItems([validArea.id]);
                setOptions(false);
                back();
              }
            }}
          >
            Delete area
          </button>
        </ActionSheet>
      )}
    </main>
  );
}
