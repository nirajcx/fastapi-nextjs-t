import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const requireProject = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function setup() {
  const cache = new Map();
  const requests = [];
  const responses = [];
  const storage = new Map();
  const fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    const next = responses.shift();
    assert.ok(next, `Unexpected request: ${url}`);
    return new Response(next.raw ?? JSON.stringify(next.body), { status: next.status || 200 });
  };
  function load(relative) {
    const filename = path.resolve(testDirectory, '../src', relative + '.ts');
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiled = { exports: {} };
    cache.set(filename, compiled);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: (id) => id.startsWith('@/') ? load(id.slice(2)) : requireProject(id), process, console, Error, fetch, Headers, URLSearchParams, localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } }, { filename });
    return compiled.exports;
  }
  return { store: load('store/useAppStore').useAppStore, toast: load('store/useToastStore').useToastStore, responses, requests };
}
const profile = { id: 'user-1', username: 'Sample', email: 'sample@example.com', is_active: true };
const todo = { id: 'task-1', title: 'Read a chapter', description: '', is_completed: false };

test('direct login uses nested profile through verified cookie and never sends the session token as JWT', async () => {
  const { store, toast, responses, requests } = setup();
  store.getState().setAuthMode('direct');
  responses.push({ body: { session_token: 'opaque-secret', user: profile } }, { body: profile }, { body: [] });
  await store.getState().loginDirect(profile.email, 'test-password');
  assert.equal(store.getState().user.username, 'Sample');
  assert.equal(store.getState().token, null);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.credentials, 'include');
    assert.equal(new Headers(request.headers).has('Authorization'), false);
  }
  assert.match(toast.getState().toasts.at(-1).message, /signed in/);
});

test('CRUD updates state and reports success; failed edit preserves prior task and reports an error', async () => {
  const { store, toast, responses } = setup();
  store.setState({ authMode: 'direct', user: profile });
  responses.push({ body: todo });
  await store.getState().createTodo(todo.title);
  assert.equal(store.getState().todos.length, 1);
  responses.push({ body: { ...todo, title: 'Read two chapters' } });
  await store.getState().updateTodo(todo.id, 'Read two chapters', '');
  assert.equal(store.getState().todos[0].title, 'Read two chapters');
  responses.push({ status: 500, body: { detail: 'Save failed' } });
  await assert.rejects(store.getState().updateTodo(todo.id, 'Lost edit', ''), /HTTP 500/);
  assert.equal(store.getState().todos[0].title, 'Read two chapters');
  assert.equal(toast.getState().toasts.at(-1).kind, 'error');
  responses.push({ body: { ...todo, is_completed: true } });
  await store.getState().toggleTodo(todo);
  assert.equal(store.getState().todos[0].is_completed, true);
  responses.push({ body: { message: 'Deleted' } });
  await store.getState().deleteTodo(todo.id);
  assert.equal(store.getState().todos.length, 0);
  assert.equal(toast.getState().toasts.at(-1).message, 'Task deleted.');
});

test('failed logout clears local state but never reports server revocation as successful', async () => {
  const { store, toast, responses } = setup();
  store.setState({ authMode: 'keycloak', user: profile, token: 'test-jwt', todos: [todo] });
  responses.push({ status: 503, body: {} });
  await store.getState().logout();
  assert.equal(store.getState().user, null);
  assert.equal(store.getState().token, null);
  assert.equal(toast.getState().toasts.at(-1).kind, 'error');
});

test('Keycloak logout explicitly distinguishes local sign-out from identity-provider logout', async () => {
  const { store, toast, responses } = setup();
  store.setState({ authMode: 'keycloak', user: profile, token: 'test-jwt' });
  responses.push({ body: { message: 'Logged out' } });
  await store.getState().logout();
  assert.equal(toast.getState().toasts.at(-1).kind, 'info');
  assert.match(toast.getState().toasts.at(-1).message, /Keycloak session may still be active/);
});

for (const status of [502, 503, 504]) {
  test(`HTML ${status} login failure reports service unavailability, not wrong credentials`, async () => {
    const { store, toast, responses, requests } = setup();
    responses.push({ status, raw: '<html><h1>Bad Gateway</h1></html>' });
    await assert.rejects(store.getState().loginDirect('sample@example.com', 'test-password'), /Service temporarily unavailable/);
    assert.equal(store.getState().user, null);
    assert.equal(store.getState().isLoadingAuth, false);
    assert.equal(requests.length, 1);
    assert.match(toast.getState().toasts.at(-1).message, new RegExp(`HTTP ${status}`));
    assert.doesNotMatch(store.getState().authError, /password|<html>/);
  });
}

test('401 login retains the backend credential error', async () => {
  const { store, responses } = setup();
  responses.push({ status: 401, body: { detail: 'Invalid email or password' } });
  await assert.rejects(store.getState().loginDirect('sample@example.com', 'test-password'), /Invalid email or password/);
});

test('registration and task loading classify HTML proxy failures', async () => {
  const { store, responses } = setup();
  responses.push({ status: 502, raw: '<html>Bad Gateway</html>' });
  await assert.rejects(store.getState().registerDirect('sample@example.com', 'Sample', 'test-password'), /Service temporarily unavailable/);
  store.setState({ authMode: 'direct', user: profile });
  responses.push({ status: 502, raw: '<html>Bad Gateway</html>' });
  await store.getState().fetchTodos();
  assert.match(store.getState().todosError, /Service temporarily unavailable/);
});
