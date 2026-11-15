export function ResizeHandles({
  horizontalOnly = false,
}: {
  horizontalOnly?: boolean;
}) {
  return (
    <>
      {(horizontalOnly
        ? ['e', 'w']
        : ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
      ).map((edge) => (
        <div
          key={edge}
          className={`resizeHandle handle-${edge}`}
          data-resize={edge}
          title="Drag to resize"
        />
      ))}
    </>
  );
}
