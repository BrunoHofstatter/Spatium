import { memo, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../model/store';
import { childrenIndex, matches } from '../model/selectors';
import { displayHeight, headingScale } from '../model/geometry';
import { AreaBox } from './AreaBox';
import { TaskCard } from './TaskCard';
import { NoteBlock } from './NoteBlock';
import { ResizeHandles } from './ResizeHandles';
export const ItemRenderer = memo(function ItemRenderer({ id }: { id: string }) {
  const item = useStore((s) => s.doc.items[id]),
    selected = useStore((s) => s.selection.includes(id));
  const settings = useStore((s) => s.doc.settings),
    highlights = useStore((s) => s.highlights);
  const children = useStore(
    useShallow((s) => childrenIndex(s.doc.items).get(id) ?? []),
  );
  const zoom = useStore((s) =>
    item?.type === 'area'
      ? (s.doc.panels[item.panelId]?.viewport.zoom ?? 1)
      : 1,
  );
  if (
    !item ||
    (item.type === 'task' && item.state === 'done' && !settings.showDone)
  )
    return null;
  const match = item.type === 'task' && matches(item, highlights);
  const color =
    item.type === 'task'
      ? settings.stateColors[item.state]
      : item.type === 'area'
        ? item.color || '#7770bd'
        : '#8c92a4';
  const style = {
    left: item.x,
    top: item.y,
    width: item.w,
    height: displayHeight(item, settings.showDone, settings.taskTitleSize),
    zIndex: item.z,
    '--item-color': color,
    ...(item.type === 'area'
      ? {
          '--area-font-size': `${item.fontSize}px`,
          '--heading-scale': headingScale(zoom),
        }
      : {}),
    '--glow-color':
      item.type === 'task' && item.important && highlights.includes('important')
        ? settings.importantColor
        : color,
  } as CSSProperties;
  return (
    <div
      data-item-id={id}
      data-item-type={item.type}
      className={`canvasItem ${item.type} ${item.type === 'area' && item.collapsed ? 'areaCollapsed' : ''} ${selected ? 'selected' : ''} ${item.type === 'task' && item.state === 'done' ? 'done' : ''} ${item.type === 'task' && highlights.length ? (match ? 'matched' : 'dimmed') : ''}`}
      style={style}
    >
      {item.type === 'area' ? (
        <AreaBox item={item}>
          {children.map((child) => (
            <ItemRenderer id={child} key={child} />
          ))}
        </AreaBox>
      ) : item.type === 'task' ? (
        <TaskCard item={item} />
      ) : (
        <NoteBlock item={item} />
      )}
      {selected && !(item.type === 'area' && item.collapsed) && (
        <ResizeHandles horizontalOnly={item.type === 'task'} />
      )}
    </div>
  );
});
