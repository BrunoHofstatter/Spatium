import { useRef, useState } from 'react';
import { useStore } from '../model/store';
import { PanelThumbnail } from './PanelThumbnail';
import { Editable } from '../canvas/Editable';
import { HistoryButtons } from '../panel/TopBar';
import { SyncStatus } from '../sync/SyncStatus';
import { useTouchReorder } from '../ui/useTouchReorder';
export function HomeScreen() {
  const panels = useStore((s) => s.doc.panels),
    order = useStore((s) => s.doc.panelOrder);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);
  const reorder = (from: string, to: string, after?: boolean) => {
    const ids = [...useStore.getState().doc.panelOrder];
    const a = ids.indexOf(from),
      b = ids.indexOf(to);
    if (a >= 0 && b >= 0 && a !== b) {
      ids.splice(a, 1);
      ids.splice(
        after === undefined ? b : ids.indexOf(to) + Number(after),
        0,
        from,
      );
      useStore.getState().reorderPanels(ids);
    }
  };
  const beginReorder = useTouchReorder({
    rows: () => [
      ...document.querySelectorAll<HTMLElement>('.panelCard[data-panel-id]'),
    ],
    attribute: 'data-panel-id',
    drop: reorder,
  });
  return (
    <main className="homeScreen">
      <header className="homeHeader">
        <h1>my Spatium</h1>
        <div className="homeActions">
          <SyncStatus />
          <HistoryButtons />
          <a href="#/settings" className="iconButton" aria-label="Settings">
            ⚙
          </a>
        </div>
      </header>
      <div className="panelGrid">
        {order.map((id) => (
          <article
            key={id}
            className="panelCard"
            data-panel-id={id}
            draggable={
              !window.matchMedia('(pointer: coarse)').matches &&
              renaming !== id &&
              editingPanel !== id
            }
            onFocusCapture={(e) => {
              if ((e.target as HTMLElement).closest('input,textarea'))
                setEditingPanel(id);
            }}
            onBlurCapture={() => setEditingPanel(null)}
            onDragStart={(e) => {
              dragging.current = id;
              e.dataTransfer.setData('spatium-panel', id);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              reorder(e.dataTransfer.getData('spatium-panel'), id);
              dragging.current = null;
            }}
          >
            <div className="panelBoardHeader">
              <span
                className="panelGrip"
                title="Drag to reorder panels"
                aria-label="Drag to reorder panel"
                onPointerDown={(e) => beginReorder(e, id)}
              >
                ⠿
              </span>
              <h2>
                {renaming === id ? (
                  <Editable
                    value={panels[id].title}
                    label="Panel name"
                    editing={renaming === id}
                    onFinish={() => setRenaming(null)}
                    onCommit={(title) =>
                      useStore.getState().renamePanel(id, title)
                    }
                  />
                ) : (
                  <a
                    href={`#/panel/${id}`}
                    aria-label={`Open panel ${panels[id].title}`}
                  >
                    {panels[id].title}
                  </a>
                )}
              </h2>
              <details className="panelMenu">
                <summary aria-label={`Actions for ${panels[id].title}`}>
                  ⋯
                </summary>
                <div>
                  <button
                    disabled={order.indexOf(id) === 0}
                    onClick={(e) => {
                      reorder(id, order[order.indexOf(id) - 1], false);
                      e.currentTarget
                        .closest('details')
                        ?.removeAttribute('open');
                    }}
                  >
                    Move up
                  </button>
                  <button
                    disabled={order.indexOf(id) === order.length - 1}
                    onClick={(e) => {
                      reorder(id, order[order.indexOf(id) + 1], true);
                      e.currentTarget
                        .closest('details')
                        ?.removeAttribute('open');
                    }}
                  >
                    Move down
                  </button>
                  <button
                    onClick={(e) => {
                      e.currentTarget
                        .closest('details')
                        ?.removeAttribute('open');
                      setRenaming(id);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete “${panels[id].title}” and everything inside? You can undo this.`,
                        )
                      )
                        useStore.getState().deletePanel(id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </details>
            </div>
            <a
              className="thumbnailLink"
              href={`#/panel/${id}`}
              aria-label={`Open ${panels[id].title}`}
            >
              <PanelThumbnail panelId={id} />
            </a>
          </article>
        ))}
      </div>
      <button
        aria-label="New panel"
        className="addButton homeAddButton"
        onClick={() => {
          const id = useStore.getState().createPanel('Untitled panel');
          setRenaming(id);
        }}
      >
        +
      </button>
    </main>
  );
}
