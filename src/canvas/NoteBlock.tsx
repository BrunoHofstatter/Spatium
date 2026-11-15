import type { NoteItem } from '../model/types';
import { useStore } from '../model/store';
import { Editable } from './Editable';
export function NoteBlock({ item }: { item: NoteItem }) {
  const editing = useStore((s) => s.editingId === item.id);
  return (
    <Editable
      multiline
      className="noteText"
      label="Note"
      value={item.text}
      placeholder="Write a note…"
      editing={editing}
      onFinish={() => useStore.getState().setEditing(null)}
      onCommit={(text) => useStore.getState().updateItem(item.id, { text })}
    />
  );
}
