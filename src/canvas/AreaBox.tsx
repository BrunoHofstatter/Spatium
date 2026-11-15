import type { AreaItem } from '../model/types';
import { STATES, STATE_LABELS } from '../model/types';
import { useStore } from '../model/store';
import { areaSummary } from '../model/selectors';
import { Editable } from './Editable';
import { focusArea } from './focusArea';
export function AreaBox({
  item,
  children,
}: {
  item: AreaItem;
  children: React.ReactNode;
}) {
  const items = useStore((s) => s.doc.items),
    highlights = useStore((s) => s.highlights);
  const settings = useStore((s) => s.doc.settings);
  const summary = areaSummary({ items, settings }, item.id, highlights);
  const colors = useStore((s) => s.doc.settings.stateColors),
    showDone = useStore((s) => s.doc.settings.showDone),
    editing = useStore((s) => s.editingId === item.id);
  return (
    <>
      <div className="areaHeader" data-area-header>
        <button
          aria-label={item.collapsed ? 'Expand area' : 'Collapse area'}
          onClick={() =>
            useStore
              .getState()
              .updateItem(item.id, { collapsed: !item.collapsed })
          }
        >
          {item.collapsed ? '▸' : '▾'}
        </button>
        <Editable
          label="Area title"
          value={item.title}
          editing={editing}
          onFinish={() => useStore.getState().setEditing(null)}
          onCommit={(title) =>
            useStore.getState().updateItem(item.id, { title })
          }
        />
        <button
          className="areaFocus"
          aria-label="Focus area"
          title="Focus area (also double middle-click)"
          onClick={() => focusArea(item.id)}
        >
          ⤢
        </button>
        <div className="areaCounts">
          {STATES.filter(
            (s) => (showDone || s !== 'done') && summary.counts[s] > 0,
          ).map((s) => (
            <span key={s} title={`${STATE_LABELS[s]}: ${summary.counts[s]}`}>
              <i style={{ background: colors[s] }} />
              {summary.counts[s]}
            </span>
          ))}
        </div>
        {item.collapsed && summary.highlighted && (
          <span className="matchBadge" title="Contains highlighted tasks">
            ✦
          </span>
        )}
        <div
          className="titleResizeHandle"
          data-title-resize
          title="Drag to change title size"
          aria-label="Resize area title"
        />
      </div>
      {!item.collapsed && <div className="areaContent">{children}</div>}
    </>
  );
}
