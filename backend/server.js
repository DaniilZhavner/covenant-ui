/**
 * server.js — minimal Fastify + SQLite backend for Covenant
 * Run: cd backend && npm install && node server.js
 */
const path = require('path');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');

const fastify = Fastify({ logger: true });

fastify.register(cors, { origin: true, credentials: true });
fastify.register(jwt, { secret: JWT_SECRET });

// Initialize DB
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

const uid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;

// Auth: register
fastify.post('/api/auth/register', async (req, reply) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return reply.code(400).send({ error: 'name,email,password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return reply.code(409).send({ error: 'email_taken' });
  const hash = await bcrypt.hash(password, 10);
  const id = uid();
  const now = Date.now();
  db.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run(id, name, email.toLowerCase(), hash, now);
  const token = fastify.jwt.sign({ sub: id, email: email.toLowerCase() });
  return reply.send({ user: { id, name, email }, token });
});

// Auth: login
fastify.post('/api/auth/login', async (req, reply) => {
  const { email, password } = req.body || {};
  if (!email || !password) return reply.code(400).send({ error: 'email,password required' });
  const user = db.prepare('SELECT id,name,email,password_hash FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return reply.code(401).send({ error: 'invalid_credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });
  const token = fastify.jwt.sign({ sub: user.id, email: user.email });
  return reply.send({ user: { id: user.id, name: user.name, email: user.email }, token });
});

// authenticate decorator
fastify.decorate('authenticate', async function (request, reply) {
  try {
    const auth = request.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'missing_authorization' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return reply.code(401).send({ error: 'invalid_authorization' });
    const decoded = await fastify.jwt.verify(parts[1]);
    const user = db.prepare('SELECT id,name,email FROM users WHERE id = ?').get(decoded.sub);
    if (!user) return reply.code(401).send({ error: 'user_not_found' });
    request.user = user;
  } catch (e) {
    request.log.warn(e);
    return reply.code(401).send({ error: 'unauthenticated' });
  }
});

// GET /api/me
fastify.get('/api/me', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  return { user: req.user };
});

// Tasks table
db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT,
  text TEXT NOT NULL,
  difficulty TEXT,
  due INTEGER,
  recur TEXT,
  done INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
`);

// Goals table
db.exec(`
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  increment INTEGER DEFAULT 5,
  done INTEGER DEFAULT 0,
  deadline INTEGER,
  created_at INTEGER NOT NULL
);
`);

// helper to parse rows -> iso strings
function rowToTask(r){
  if(!r) return null;
  return { ...r, due: r.due? new Date(r.due).toISOString() : undefined, done: !!r.done };
}
function rowToGoal(r){
  if(!r) return null;
  return { ...r, deadline: r.deadline? new Date(r.deadline).toISOString(): undefined, done: !!r.done };
}

// list tasks
fastify.get('/api/tasks', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  return { tasks: rows.map(rowToTask) };
});

// create task
fastify.post('/api/tasks', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const { category, text, difficulty, due, recur } = req.body || {};
  if (!text) return reply.code(400).send({ error: 'text required' });
  const id = uid();
  db.prepare('INSERT INTO tasks (id,user_id,category,text,difficulty,due,recur,done,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, category || null, text, difficulty || null, due ? new Date(due).getTime() : null, recur || null, 0, Date.now());
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return reply.code(201).send({ task: rowToTask(row) });
});

// toggle task (and compute next due for recurring)
fastify.post('/api/tasks/:id/toggle', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const id = req.params.id;
  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!row) return reply.code(404).send({ error: 'not_found' });
  const done = row.done ? 0 : 1;
  db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(done, id);
  if (done && row.recur && row.due) {
    const next = nextIsoFromMillis(row.due, row.recur);
    if (next) db.prepare('UPDATE tasks SET due = ? WHERE id = ?').run(next, id);
  }
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return { task: rowToTask(updated) };
});

function nextIsoFromMillis(ms, recur){
  if (!ms || !recur || recur === 'none') return null;
  const d = new Date(ms);
  if (recur === 'daily') d.setDate(d.getDate()+1);
  else if (recur === 'weekdays'){ d.setDate(d.getDate()+1); if (d.getDay()===6) d.setDate(d.getDate()+2); if (d.getDay()===0) d.setDate(d.getDate()+1); }
  else if (recur === 'weekly') d.setDate(d.getDate()+7);
  else if (recur === 'monthly') d.setMonth(d.getMonth()+1);
  return d.getTime();
}

// goals endpoints
fastify.get('/api/goals', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const rows = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  return { goals: rows.map(rowToGoal) };
});

fastify.post('/api/goals', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const { category, title, increment, deadline } = req.body || {};
  if (!title) return reply.code(400).send({ error: 'title required' });
  const id = uid();
  db.prepare('INSERT INTO goals (id,user_id,category,title,increment,done,deadline,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, category || null, title, Number(increment) || 5, 0, deadline ? new Date(deadline).getTime() : null, Date.now());
  const row = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  return reply.code(201).send({ goal: rowToGoal(row) });
});

fastify.post('/api/goals/:id/complete', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const id = req.params.id;
  const row = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!row) return reply.code(404).send({ error: 'not_found' });
  if (row.done) return reply.send({ goal: rowToGoal(row), applied: false });
  db.prepare('UPDATE goals SET done = 1 WHERE id = ?').run(id);
  const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  return reply.send({ goal: rowToGoal(updated), applied: true, increment: updated.increment });
});

// health
fastify.get('/health', async () => ({ ok: true }));

fastify.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  fastify.log.info(`server listening on ${PORT}`);
});
