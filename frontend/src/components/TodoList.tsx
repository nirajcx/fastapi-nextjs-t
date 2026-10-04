"use client";
import { useRef, useState } from "react";
import {
  Check, Plus, Search, Pencil, Trash2, ListTodo,
  ArrowRight, RefreshCw, Paperclip, X, FileText,
  Image as ImageIcon, Loader2, Maximize2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { Todo } from "@/lib/types";
import { TodoDetailModal } from "./TodoDetailModal";

// ─── Utilities ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType?: string | null): boolean {
  return !!contentType?.startsWith("image/");
}

// ─── Attachment chip shown on each task row ────────────────────────────────────

function AttachmentChip({ todo, onOpenModal }: { todo: Todo; onOpenModal: () => void }) {
  if (!todo.attachment_key) return null;

  const img = isImage(todo.attachment_content_type);

  return (
    <div className="task-attachment">
      <button
        type="button"
        className="attachment-chip"
        onClick={(e) => {
          e.stopPropagation();
          onOpenModal();
        }}
        title={`Click to view ${img ? "image" : "attachment"} in modal`}
      >
        {img ? <ImageIcon size={13} /> : <FileText size={13} />}
        <span>{todo.attachment_name ?? "attachment"}</span>
        {todo.attachment_size != null && (
          <span className="attachment-size">{formatBytes(todo.attachment_size)}</span>
        )}
      </button>
    </div>
  );
}

// ─── File picker shown inside the composer form ────────────────────────────────

interface FilePickerProps {
  file: File | null;
  onChange: (f: File | null) => void;
}

function FilePicker({ file, onChange }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) onChange(dropped);
  }

  return (
    <div
      className={`file-drop-zone ${file ? "file-drop-zone--filled" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Attach a file"
      onKeyDown={(e) => e.key === "Enter" && !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="file-selected">
          {isImage(file.type) ? <ImageIcon size={16} /> : <FileText size={16} />}
          <span className="file-name">{file.name}</span>
          <span className="attachment-size">{formatBytes(file.size)}</span>
          <button
            type="button"
            className="file-clear"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            aria-label="Remove selected file"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="file-empty">
          <Paperclip size={15} />
          <span>Attach a file or drag &amp; drop</span>
        </div>
      )}
    </div>
  );
}

// ─── Individual task row ───────────────────────────────────────────────────────

function TaskRow({
  todo,
  onOpenModal,
}: {
  todo: Todo;
  onOpenModal: (todo: Todo) => void;
}) {
  const { toggleTodo, deleteTodo, updateTodo } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || "");
  const [busy, setBusy] = useState(false);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch { /* errors shown by toaster */ } finally { setBusy(false); }
  }

  return (
    <li
      className={`task-row ${todo.is_completed ? "task-completed" : ""} task-row--interactive`}
      onClick={(e) => {
        if (editing) return;
        const target = e.target as HTMLElement;
        if (target.closest("button, a, input, textarea")) return;
        onOpenModal(todo);
      }}
    >
      {editing ? (
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await updateTodo(todo.id, title.trim(), description.trim());
              setEditing(false);
            });
          }}
        >
          <label>Task title<input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <div className="form-actions">
            <button type="button" className="text-button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
            <button className="primary-button" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      ) : (
        <>
          {/* Completion toggle */}
          <button
            className="task-check"
            role="checkbox"
            aria-checked={todo.is_completed}
            aria-label={`Mark ${todo.title} ${todo.is_completed ? "active" : "complete"}`}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              void act(() => toggleTodo(todo));
            }}
          >
            {todo.is_completed && <Check size={16} />}
          </button>

          {/* Content — clicking opens modal */}
          <div
            className="task-copy task-copy--clickable"
            onClick={() => onOpenModal(todo)}
            title="Click to view details & attachment"
          >
            <h3>{todo.title}</h3>
            {todo.description && <p>{todo.description}</p>}
            {/* Attachment chip */}
            <AttachmentChip todo={todo} onOpenModal={() => onOpenModal(todo)} />
          </div>

          {/* Actions */}
          <div className="task-actions">
            <button
              type="button"
              aria-label={`View ${todo.title}`}
              title="View details & attachment"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal(todo);
              }}
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              aria-label={`Edit ${todo.title}`}
              title="Edit task"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                setTitle(todo.title);
                setDescription(todo.description || "");
                setEditing(true);
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              aria-label={`Delete ${todo.title}`}
              title="Delete task"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void act(() => deleteTodo(todo.id));
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </>
      )}
    </li>
  );
}

// ─── Main TodoList component ───────────────────────────────────────────────────

export function TodoList() {
  const {
    user, todos, filter, setFilter, searchQuery, setSearchQuery,
    isLoadingTodos, todosError, createTodo, fetchTodos, toggleTodo,
  } = useAppStore();

  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  // Track which phase of the upload we're in for the button label
  const [uploadPhase, setUploadPhase] = useState<"idle" | "signing" | "uploading" | "saving">("idle");

  const completed = todos.filter((t) => t.is_completed).length;
  const visible = todos.filter(
    (todo) =>
      (filter === "all" || (filter === "completed" ? todo.is_completed : !todo.is_completed)) &&
      `${todo.title} ${todo.description || ""}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeModalTodo = selectedTodo
    ? todos.find((t) => t.id === selectedTodo.id) ?? selectedTodo
    : null;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    // Show contextual phase labels when a file is attached
    if (file) setUploadPhase("signing");
    try {
      // The store handles the full 3-step S3 flow transparently
      if (file) {
        // Slight delay for UX — give user feedback during each phase
        setTimeout(() => setUploadPhase("uploading"), 800);
        setTimeout(() => setUploadPhase("saving"), 1600);
      }
      await createTodo(title.trim(), description.trim(), file);
      setTitle("");
      setDescription("");
      setFile(null);
    } catch {
      /* draft preserved on failure */
    } finally {
      setAdding(false);
      setUploadPhase("idle");
    }
  }

  function addButtonLabel(): string {
    if (!adding) return "Add task";
    if (!file) return "Adding task…";
    if (uploadPhase === "signing") return "Securing upload…";
    if (uploadPhase === "uploading") return "Uploading file…";
    if (uploadPhase === "saving") return "Saving task…";
    return "Adding task…";
  }

  return (
    <>
      {/* Attachment styles injected inline — keeps the component self-contained */}
      <style>{`
        .task-attachment { margin-top: 8px; }

        .attachment-chip {
          display: inline-flex; align-items: center; gap: 5px;
          background: #edf2ec; border: 1px solid #d6e0d2; border-radius: 6px;
          padding: 4px 9px; font-size: 11px; color: #4a6b52;
          cursor: pointer; transition: background .15s;
        }
        .attachment-chip:hover { background: #ddebd8; }
        .attachment-size { color: #8a9e82; font-size: 10px; }

        .attachment-preview {
          margin-top: 8px; padding: 10px; background: #f9faf7;
          border: 1px solid #e0e6d9; border-radius: 8px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .attachment-img {
          max-width: 100%; max-height: 260px; border-radius: 6px;
          object-fit: contain; border: 1px solid #e0e6d9;
        }
        .attachment-download {
          display: inline-flex; align-items: center; gap: 6px;
          color: #315e4b; font-size: 12px; text-decoration: none;
          padding: 6px 10px; background: #e8f0e5; border-radius: 6px;
          width: fit-content; transition: background .15s;
        }
        .attachment-download:hover { background: #d4e6ce; }

        .file-drop-zone {
          border: 1.5px dashed #c8d5c0; border-radius: 8px; padding: 12px 14px;
          cursor: pointer; transition: border-color .15s, background .15s;
          background: #fafbf8;
        }
        .file-drop-zone:hover, .file-drop-zone:focus { border-color: #7d9870; background: #f3f6f0; }
        .file-drop-zone--filled { border-style: solid; border-color: #7d9870; background: #f3f6f0; cursor: default; }

        .file-empty { display: flex; align-items: center; gap: 8px; color: #8a9e82; font-size: 12px; }
        .file-selected { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #3d5c44; }
        .file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file-clear {
          background: none; border: none; color: #8a9e82; padding: 2px;
          cursor: pointer; display: flex; align-items: center;
          border-radius: 4px; transition: background .15s;
        }
        .file-clear:hover { background: #fce8e6; color: #b24d46; }

        .btn-uploading { opacity: 0.85; }

        .task-row--interactive {
          cursor: pointer;
          transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
        }
        .task-row--interactive:hover {
          border-color: #c7d4c2;
          box-shadow: 0 4px 16px rgba(35, 60, 42, 0.07);
          transform: translateY(-1px);
        }
        .task-copy--clickable {
          cursor: pointer;
        }
      `}</style>

      <div className="dashboard">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">YOUR EVERYDAY, ORGANIZED</span>
            <h1>Let&apos;s make room for progress{user?.username ? `, ${user.username}` : ""}.</h1>
            <p className="muted">A fresh perspective on everything you want to get done.</p>
          </div>
          <span className="workspace-pill"><span />My workspace</span>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {(
            [
              ["On your list", todos.length, "Every idea starts somewhere."],
              ["Still to do", todos.length - completed, "One step at a time."],
              ["Completed", completed, "Look how far you've come."],
            ] as [string, number, string][]
          ).map(([label, count, caption], i) => (
            <div className={`stat-card stat-${i}`} key={label}>
              <span>{label}</span>
              <strong>{count.toString().padStart(2, "0")}</strong>
              <p>{caption}</p>
            </div>
          ))}
        </div>

        <div className="workspace-grid">
          {/* Task list */}
          <section className="task-section">
            <div className="section-heading">
              <h2>Your tasks <span>{todos.length}</span></h2>
              <button
                className="text-button"
                disabled={isLoadingTodos}
                onClick={() => void fetchTodos()}
                aria-label="Refresh tasks"
              >
                <RefreshCw size={16} className={isLoadingTodos ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="task-toolbar">
              <div className="filter-tabs">
                {(["all", "active", "completed"] as const).map((item) => (
                  <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                    {item === "all" ? "All tasks" : item === "active" ? "To do" : "Completed"}
                  </button>
                ))}
              </div>
              <label className="search-box">
                <Search size={17} />
                <input
                  aria-label="Search tasks"
                  placeholder="Find a task…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>
            </div>

            {todosError && <p className="inline-error" role="alert">{todosError}</p>}

            {isLoadingTodos && !todos.length ? (
              <div className="empty-state" role="status">Loading your tasks…</div>
            ) : visible.length ? (
              <ul className="task-list">
                {visible.map((todo) => (
                  <TaskRow
                    key={todo.id}
                    todo={todo}
                    onOpenModal={(t) => setSelectedTodo(t)}
                  />
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <ListTodo size={32} />
                <h3>
                  {todosError ? "Couldn't load your tasks" : todos.length ? "Nothing here just yet" : "A little space for your next idea"}
                </h3>
                <p>
                  {todosError ? "Refresh to try again." : todos.length ? "Try another filter or search." : "Add your first task and take it from there."}
                </p>
              </div>
            )}

            <div className="list-footer">
              {completed} of {todos.length} tasks completed
              <span>Keep moving at your own pace.</span>
            </div>
          </section>

          {/* Composer sidebar */}
          <aside>
            <section className="panel composer">
              <span className="icon-tile"><Plus size={22} /></span>
              <h2>What&apos;s on your mind?</h2>
              <p className="muted">Give it a name. Make it happen.</p>

              <form onSubmit={add}>
                <label>
                  Task title
                  <input
                    required
                    placeholder="Something you want to do"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={adding}
                  />
                </label>

                <label>
                  A few details <span className="optional">optional</span>
                  <textarea
                    placeholder="Add a little context…"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={adding}
                  />
                </label>

                {/* ── File attachment picker ── */}
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#586353", display: "block", marginBottom: 6 }}>
                    Attachment <span className="optional">optional</span>
                  </span>
                  <FilePicker file={file} onChange={setFile} />
                </div>

                <button
                  className={`primary-button ${adding ? "btn-uploading" : ""}`}
                  disabled={adding || !title.trim()}
                >
                  {adding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                  {addButtonLabel()}
                </button>
              </form>
            </section>

            <div className="focus-note">
              &ldquo;You don&apos;t have to see the whole staircase. Just take the first step.&rdquo;
              <span>A LITTLE REMINDER</span>
            </div>
          </aside>
        </div>
      </div>

      {/* Todo Details & Image Modal */}
      <TodoDetailModal
        isOpen={Boolean(activeModalTodo)}
        todo={activeModalTodo}
        onClose={() => setSelectedTodo(null)}
        onToggleComplete={(t) => {
          void toggleTodo(t);
        }}
      />
    </>
  );
}
