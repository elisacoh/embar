"use client";

interface DeleteModalProps {
  itemTitle: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteModal({ itemTitle, deleting, onCancel, onConfirm }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !deleting && onCancel()}
      />
      <div className="relative w-full max-w-xs rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <p className="text-sm font-semibold text-foreground">Delete this task?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          &ldquo;{itemTitle}&rdquo; will be permanently removed. This cannot be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
