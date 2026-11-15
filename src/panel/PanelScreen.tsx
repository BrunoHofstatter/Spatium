import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../model/store';
import { screenToWorld } from '../model/geometry';
import type { Item, Point } from '../model/types';
import { Canvas } from '../canvas/Canvas';
import { SelectionToolbar } from '../canvas/SelectionToolbar';
import { TopBar } from './TopBar';
import { TaskFontMenu } from '../canvas/TaskFontMenu';
import { creationPoint } from '../model/creation';
import { visibleCanvas } from '../canvas/visibleCanvas';
import { revealItem } from '../canvas/focusArea';
import { useMobile } from '../ui/useMobile';
export function PanelScreen({ panelId }: { panelId: string }) {
  const mobile = useMobile();
  const selection = useStore((s) => s.selection);
  const selectionMode = useStore((s) => s.selectionMode);
  const selectedArea = useStore((s) => {
    const item = selection.length === 1 ? s.doc.items[selection[0]] : null;
    return item?.type === 'area' && !item.collapsed ? item : null;
  });
  const [menu, setMenu] = useState<{
    point?: Point;
    screen?: Point;
    fontIds?: string[];
  } | null>(null);
  const openContext = useCallback(
    (point: Point, screen: Point, fontIds?: string[]) =>
      setMenu({ point, screen, fontIds }),
    [],
  );
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [menu]);
  useEffect(() => {
    useStore.getState().select([]);
    useStore.getState().setEditing(null);
    useStore.getState().setSelectionMode(false);
  }, [panelId]);
  const create = (type: Item['type']) => {
    const s = useStore.getState(),
      canvas = document.querySelector<HTMLElement>('.canvas');
    if (!canvas) return;
    const visible = visibleCanvas(canvas),
      view = s.doc.panels[panelId].viewport;
    const selected =
      s.selection.length === 1 ? s.doc.items[s.selection[0]] : null;
    let parent =
      selected?.type === 'area' && !selected.collapsed
        ? selected.id
        : undefined;
    let point = creationPoint(
      s.doc,
      type,
      panelId,
      {
        ...screenToWorld({ x: visible.x, y: visible.y }, view),
        w: visible.w / view.zoom,
        h: visible.h / view.zoom,
      },
      parent ?? null,
    );
    if (menu?.point) {
      point = menu.point;
      parent = undefined;
    }
    const id = s.createItem(type, panelId, point, parent);
    if (mobile) requestAnimationFrame(() => revealItem(id));
    setMenu(null);
  };
  return (
    <main className={`panelScreen ${selection.length ? 'hasSelection' : ''}`}>
      <TopBar panelId={panelId} />
      <Canvas key={panelId} panelId={panelId} onContext={openContext} />
      <SelectionToolbar />
      {!selectionMode && (
        <div className="createControls">
          {menu && (
            <>
              <button
                className="menuScrim"
                aria-label="Close creation menu"
                onClick={() => setMenu(null)}
              />
              <div
                className={`createMenu ${menu.screen ? 'contextCreateMenu' : ''} ${menu.fontIds ? 'fontContextMenu' : ''}`}
                style={
                  menu.screen
                    ? {
                        left: Math.max(
                          8,
                          Math.min(
                            menu.screen.x,
                            window.innerWidth - (menu.fontIds ? 328 : 170),
                          ),
                        ),
                        top: Math.max(
                          8,
                          Math.min(menu.screen.y, window.innerHeight - 166),
                        ),
                      }
                    : undefined
                }
              >
                {menu.fontIds ? (
                  <TaskFontMenu
                    ids={menu.fontIds}
                    close={() => setMenu(null)}
                  />
                ) : (
                  <>
                    {selectedArea && !menu.screen && (
                      <p className="creationContext">
                        Add to{' '}
                        {selectedArea.type === 'area' ? selectedArea.title : ''}
                      </p>
                    )}
                    <button aria-label="Task" onClick={() => create('task')}>
                      <span>▤</span>Task
                    </button>
                    <button aria-label="Area" onClick={() => create('area')}>
                      <span>▧</span>Area
                    </button>
                    <button aria-label="Note" onClick={() => create('note')}>
                      <span>≡</span>Note
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          <button
            className="addButton"
            aria-label="Create item"
            aria-expanded={!!menu}
            onClick={() => setMenu(menu ? null : {})}
          >
            +
          </button>
        </div>
      )}
    </main>
  );
}
