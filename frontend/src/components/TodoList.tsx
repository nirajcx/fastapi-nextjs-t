"use client";
import { useState } from "react";
import { Check, Plus, Search, Pencil, Trash2, ListTodo, ArrowRight, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { Todo } from "@/lib/types";

function TaskRow({ todo }: { todo: Todo }) {
  const { toggleTodo, deleteTodo, updateTodo } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || "");
  const [busy, setBusy] = useState(false);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch { /* Action errors are shown by the toaster. */ } finally { setBusy(false); }
  }
  return <li className={`task-row ${todo.is_completed ? "task-completed" : ""}`}>
    {editing ? <form className="edit-form" onSubmit={(event) => { event.preventDefault(); void act(async () => { await updateTodo(todo.id, title.trim(), description.trim()); setEditing(false); }); }}>
      <label>Task title<input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-actions"><button type="button" className="text-button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save changes"}</button></div>
    </form> : <>
      <button className="task-check" role="checkbox" aria-checked={todo.is_completed} aria-label={`Mark ${todo.title} ${todo.is_completed ? "active" : "complete"}`} disabled={busy} onClick={() => void act(() => toggleTodo(todo))}>{todo.is_completed && <Check size={16} />}</button>
      <div className="task-copy"><h3>{todo.title}</h3>{todo.description && <p>{todo.description}</p>}</div>
      <div className="task-actions"><button aria-label={`Edit ${todo.title}`} title="Edit task" disabled={busy} onClick={() => { setTitle(todo.title); setDescription(todo.description || ""); setEditing(true); }}><Pencil size={17} /></button><button aria-label={`Delete ${todo.title}`} title="Delete task" disabled={busy} onClick={() => void act(() => deleteTodo(todo.id))}><Trash2 size={17} /></button></div>
    </>}
  </li>;
}
export function TodoList() {
  const { user, todos, filter, setFilter, searchQuery, setSearchQuery, isLoadingTodos, todosError, createTodo, fetchTodos } = useAppStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const completed = todos.filter((todo) => todo.is_completed).length;
  const visible = todos.filter((todo) => (filter === "all" || (filter === "completed" ? todo.is_completed : !todo.is_completed)) && `${todo.title} ${todo.description || ""}`.toLowerCase().includes(searchQuery.toLowerCase()));
  async function add(event: React.FormEvent) {
    event.preventDefault(); setAdding(true);
    try { await createTodo(title.trim(), description.trim()); setTitle(""); setDescription(""); } catch { /* Preserve the draft on failure. */ } finally { setAdding(false); }
  }
  return <div className="dashboard">
    <div className="dashboard-heading"><div><span className="eyebrow">YOUR EVERYDAY, ORGANIZED</span><h1>Let’s make room for progress{user?.username ? `, ${user.username}` : ""}.</h1><p className="muted">A fresh perspective on everything you want to get done.</p></div><span className="workspace-pill"><span />My workspace</span></div>
    <div className="stats-grid">{[["On your list", todos.length, "Every idea starts somewhere."], ["Still to do", todos.length - completed, "One step at a time."], ["Completed", completed, "Look how far you’ve come."]].map(([label, count, caption], i) => <div className={`stat-card stat-${i}`} key={label}><span>{label}</span><strong>{count.toString().padStart(2, "0")}</strong><p>{caption}</p></div>)}</div>
    <div className="workspace-grid"><section className="task-section"><div className="section-heading"><h2>Your tasks <span>{todos.length}</span></h2><button className="text-button" disabled={isLoadingTodos} onClick={() => void fetchTodos()} aria-label="Refresh tasks"><RefreshCw size={16} className={isLoadingTodos ? "animate-spin" : ""} /></button></div>
      <div className="task-toolbar"><div className="filter-tabs">{(["all", "active", "completed"] as const).map((item) => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All tasks" : item === "active" ? "To do" : "Completed"}</button>)}</div><label className="search-box"><Search size={17} /><input aria-label="Search tasks" placeholder="Find a task…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></label></div>
      {todosError && <p className="inline-error" role="alert">{todosError}</p>}
      {isLoadingTodos && !todos.length ? <div className="empty-state" role="status">Loading your tasks…</div> : visible.length ? <ul className="task-list">{visible.map((todo) => <TaskRow key={todo.id} todo={todo} />)}</ul> : <div className="empty-state"><ListTodo size={32} /><h3>{todosError ? "Couldn’t load your tasks" : todos.length ? "Nothing here just yet" : "A little space for your next idea"}</h3><p>{todosError ? "Refresh to try again." : todos.length ? "Try another filter or search." : "Add your first task and take it from there."}</p></div>}
      <div className="list-footer">{completed} of {todos.length} tasks completed<span>Keep moving at your own pace.</span></div>
    </section><aside><section className="panel composer"><span className="icon-tile"><Plus size={22} /></span><h2>What’s on your mind?</h2><p className="muted">Give it a name. Make it happen.</p><form onSubmit={add}><label>Task title<input required placeholder="Something you want to do" value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>A few details <span className="optional">optional</span><textarea placeholder="Add a little context…" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label><button className="primary-button" disabled={adding || !title.trim()}>{adding ? "Adding task…" : "Add task"}<ArrowRight size={17} /></button></form></section><div className="focus-note">“You don’t have to see the whole staircase. Just take the first step.”<span>A LITTLE REMINDER</span></div></aside></div>
  </div>;
}
