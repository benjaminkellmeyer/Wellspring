import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, PORT = 3000 } = process.env;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SECRET_KEY in .env');
  process.exit(1);
}

// Server-only client. The secret key bypasses Row Level Security, so it must never be
// sent to the browser. Because it bypasses RLS, EVERY route below checks who the user
// is and what they are allowed to do before it touches the database.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ---------------------------------------------------------------------------
// Allowed values (must match the database CHECK constraints)
// ---------------------------------------------------------------------------
const CATEGORIES = ['public', 'private', 'tenant'];
const TYPES = ['wedding', 'birthday_party', 'corporate', 'community', 'non-profit', 'other'];
const FURNITURE = ['tables', 'chairs', 'podium', 'stage', 'linens'];
const TECH = ['projector', 'microphone', 'speakers', 'wifi', 'screen'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['submitted', 'in_progress', 'scheduled', 'declined', 'cancelled', 'needs_followup', 'completed'];
const CLIENT_TYPES = ['commercial', 'non_profit', 'tenant', 'individual', 'other'];

// category -> co_id (set by the server, never by the browser)
const CO_ID_BY_CATEGORY = { public: 1, private: 2, tenant: 3 };

// Only rooms with this r_status can be booked.
const BOOKABLE_STATUS = 'Available';

// Columns returned for an event, including the related client, room, and coordinator rows.
const EVENT_SELECT = `
  e_id, e_name, e_category, e_type, e_start, e_end, e_attendance,
  e_furniture, e_tech, e_catering, e_notes, e_priority, e_status,
  e_created_at, e_archived_at, c_id, co_id, r_id,
  client ( c_id, c_name, c_type, c_email, c_phone ),
  room ( r_id, r_name, r_capacity ),
  coordinator ( co_id, co_name )
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const isPositiveInt = (v) => /^\d+$/.test(String(v ?? '')) && Number(v) > 0;

function toList(value) {
  if (value === undefined || value === null || value === '') return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

// The browser sends ISO timestamps that include the user's time zone, e.g. "2026-12-05T20:30:00.000Z".
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
function parseTime(value) {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

// Turn a database error into a message the user can act on.
function dbError(res, error) {
  console.error(error);
  if (error.code === '23P01') {
    return res.status(409).json({ error: 'That room is already scheduled during that time.' });
  }
  if (error.code === '23514') {
    return res.status(400).json({ error: `The database rejected this change: ${error.message}` });
  }
  if (error.code === '23503') {
    return res.status(400).json({ error: 'A related record (client, room, or coordinator) does not exist.' });
  }
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// ---------------------------------------------------------------------------
// Authentication and authorization middleware
// ---------------------------------------------------------------------------

// 1. Who is this? Reads "Authorization: Bearer <access token>", asks Supabase Auth to
//    verify it, then loads the user's roles from user_roles. Never trusts a role sent by the browser.
async function requireUser(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ error: 'Please sign in first.' });

  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Your session is invalid or has expired. Please sign in again.' });
  }

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('roles ( name )')
    .eq('user_id', data.user.id);
  if (roleError) return dbError(res, roleError);

  req.user = data.user;
  req.roles = (roleRows ?? []).map((r) => r.roles?.name).filter(Boolean);
  req.isStaff = req.roles.includes('staff');
  next();
}

// 2. Is this person staff? Must run after requireUser.
function requireStaff(req, res, next) {
  if (!req.isStaff) return res.status(403).json({ error: 'Only Wellspring staff can do this.' });
  next();
}

// Looks up the client record linked to the signed-in user (null if they haven't made one).
async function getOwnClient(userId) {
  return supabase.from('client').select('c_id, c_name, c_type, c_email, c_phone').eq('user_id', userId).maybeSingle();
}

// ---------------------------------------------------------------------------
// Public routes (no sign-in needed)
// ---------------------------------------------------------------------------

// The browser needs the project URL and PUBLISHABLE key to sign in. Both are safe to share.
app.get('/api/config', (req, res) => {
  res.json({ supabaseUrl: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY });
});

// Room names and capacities are not private.
app.get('/api/rooms', async (req, res) => {
  const { data, error } = await supabase.from('room').select('r_id, r_name, r_capacity, r_status').order('r_name');
  if (error) return dbError(res, error);
  res.json(data);
});

// ---------------------------------------------------------------------------
// Signed-in routes
// ---------------------------------------------------------------------------

// Who am I, what role do I have, and do I have a client profile?
app.get('/api/me', requireUser, async (req, res) => {
  const { data: client, error } = await getOwnClient(req.user.id);
  if (error) return dbError(res, error);
  res.json({ email: req.user.email, roles: req.roles, isStaff: req.isStaff, client });
});

// A new client creates their profile (one per account). user_id comes from the verified token.
app.post('/api/me/client', requireUser, async (req, res) => {
  const body = req.body ?? {};
  const errors = [];

  const c_name = String(body.c_name ?? '').trim();
  if (c_name.length < 1 || c_name.length > 50) errors.push('Name is required (50 characters or fewer).');

  const c_type = String(body.c_type ?? '');
  if (!CLIENT_TYPES.includes(c_type)) errors.push('Choose a valid client type.');

  const c_email = String(body.c_email ?? '').trim();
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(c_email)) errors.push('Enter a valid contact email.');

  const c_phone = String(body.c_phone ?? '').replace(/\D/g, '');
  if (!/^[0-9]{7,15}$/.test(c_phone)) errors.push('Phone must be 7 to 15 digits.');

  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const { data: existing, error: lookupError } = await getOwnClient(req.user.id);
  if (lookupError) return dbError(res, lookupError);
  if (existing) return res.status(409).json({ error: 'You already have a client profile.' });

  const { data, error } = await supabase
    .from('client')
    .insert({ c_name, c_type, c_email, c_phone, user_id: req.user.id })
    .select('c_id, c_name, c_type, c_email, c_phone')
    .single();
  if (error) return dbError(res, error);
  res.status(201).json(data);
});

// Staff need the coordinator list to reassign events.
app.get('/api/coordinators', requireUser, requireStaff, async (req, res) => {
  const { data, error } = await supabase.from('coordinator').select('co_id, co_name').order('co_name');
  if (error) return dbError(res, error);
  res.json(data);
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function validateEventRequest(body = {}) {
  const errors = [];

  const e_category = String(body.category ?? '');
  if (!CATEGORIES.includes(e_category)) errors.push('Choose a valid category.');

  const e_type = String(body.type ?? '');
  if (!TYPES.includes(e_type)) errors.push('Choose a valid event type.');

  const e_name = String(body.name ?? '').trim();
  if (!e_name) errors.push('Event name is required.');
  if (e_name.length > 200) errors.push('Event name must be 200 characters or fewer.');

  const startMs = parseTime(body.start);
  const endMs = parseTime(body.end);
  if (startMs === null) errors.push('A valid start time is required.');
  if (endMs === null) errors.push('A valid end time is required.');
  if (startMs !== null && startMs < Date.now()) errors.push('Start time must be in the future.');
  if (startMs !== null && endMs !== null) {
    const minutes = (endMs - startMs) / 60000;
    if (minutes < 30 || minutes > 480) {
      errors.push('End time must be between 30 minutes and 8 hours after the start time.');
    }
  }

  const e_attendance = Number(body.attendance);
  if (!Number.isInteger(e_attendance) || e_attendance < 2 || e_attendance > 350) {
    errors.push('Attendance must be a whole number between 2 and 350.');
  }

  if (!isPositiveInt(body.room)) errors.push('Choose a room.');

  const e_furniture = toList(body.furniture);
  if (!e_furniture.every((f) => FURNITURE.includes(f))) errors.push('Invalid furniture selection.');

  const e_tech = toList(body.tech);
  if (!e_tech.every((t) => TECH.includes(t))) errors.push('Invalid tech selection.');

  const e_catering = String(body.catering ?? '').trim();
  if (e_catering.length > 200) errors.push('Catering notes must be 200 characters or fewer.');

  const e_notes = String(body.notes ?? '').trim();
  if (e_notes.length > 2000) errors.push('Notes must be 2000 characters or fewer.');

  // Only these fields ever reach the database. c_id is added by the route from the signed-in user.
  const clean = {
    co_id: CO_ID_BY_CATEGORY[e_category],
    r_id: Number(body.room),
    e_category,
    e_type,
    e_name,
    e_start: startMs === null ? null : new Date(startMs).toISOString(),
    e_end: endMs === null ? null : new Date(endMs).toISOString(),
    e_attendance,
    e_furniture: [...new Set(e_furniture)],
    e_tech: [...new Set(e_tech)],
    e_catering: e_catering || null,
    e_notes: e_notes || null,
    e_status: 'submitted',
    e_priority: 'medium',
  };

  return { errors, clean };
}

// CREATE: a signed-in client submits an event request for THEIR OWN client record.
app.post('/api/events', requireUser, async (req, res) => {
  const { data: client, error: clientError } = await getOwnClient(req.user.id);
  if (clientError) return dbError(res, clientError);
  if (!client) {
    return res.status(403).json({ error: 'Create your client profile before requesting an event.' });
  }

  const { errors, clean } = validateEventRequest(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  // Trust the room's real capacity and status from the database, not the browser.
  const { data: room, error: roomError } = await supabase
    .from('room')
    .select('r_id, r_name, r_capacity, r_status')
    .eq('r_id', clean.r_id)
    .maybeSingle();
  if (roomError) return dbError(res, roomError);
  if (!room) return res.status(400).json({ error: 'That room does not exist.' });
  if (room.r_status !== BOOKABLE_STATUS) {
    return res.status(409).json({ error: `${room.r_name} is not available for booking (${room.r_status}).` });
  }
  if (clean.e_attendance > room.r_capacity) {
    return res.status(400).json({
      error: `${room.r_name} holds up to ${room.r_capacity} people. Choose a larger room or lower the attendance.`,
    });
  }

  const { data, error } = await supabase
    .from('event')
    .insert({ ...clean, c_id: client.c_id })
    .select(EVENT_SELECT)
    .single();
  if (error) return dbError(res, error);
  res.status(201).json(data);
});

// READ: staff see every event; clients see only events linked to their own client record.
// Optional filter: ?status=in_progress   Optional: ?archived=1 to include archived events.
app.get('/api/events', requireUser, async (req, res) => {
  let query = supabase.from('event').select(EVENT_SELECT).order('e_start', { ascending: true });

  if (!req.isStaff) {
    const { data: client, error } = await getOwnClient(req.user.id);
    if (error) return dbError(res, error);
    if (!client) return res.json([]); // no profile yet = no events
    query = query.eq('c_id', client.c_id);
  }

  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) return res.status(400).json({ error: 'Unknown status filter.' });
    query = query.eq('e_status', req.query.status);
  }
  if (req.query.archived !== '1') query = query.is('e_archived_at', null);

  const { data, error } = await query;
  if (error) return dbError(res, error);
  res.json(data);
});

// UPDATE: staff only. Allowed fields: status, priority, co_id, r_id, archived.
app.patch('/api/events/:id', requireUser, requireStaff, async (req, res) => {
  if (!isPositiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid event id.' });
  const body = req.body ?? {};
  const changes = {};
  const errors = [];

  if ('status' in body) {
    if (!STATUSES.includes(body.status)) errors.push(`Status must be one of: ${STATUSES.join(', ')}.`);
    else changes.e_status = body.status;
  }
  if ('priority' in body) {
    if (!PRIORITIES.includes(body.priority)) errors.push(`Priority must be one of: ${PRIORITIES.join(', ')}.`);
    else changes.e_priority = body.priority;
  }
  if ('co_id' in body) {
    if (!isPositiveInt(body.co_id)) errors.push('Choose a valid coordinator.');
    else changes.co_id = Number(body.co_id);
  }
  if ('r_id' in body) {
    if (body.r_id === null || body.r_id === '') changes.r_id = null;
    else if (!isPositiveInt(body.r_id)) errors.push('Choose a valid room.');
    else changes.r_id = Number(body.r_id);
  }
  if ('archived' in body) {
    if (typeof body.archived !== 'boolean') errors.push('archived must be true or false.');
    else changes.e_archived_at = body.archived ? new Date().toISOString() : null;
  }

  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  if (!Object.keys(changes).length) return res.status(400).json({ error: 'Nothing to update.' });

  const { data, error } = await supabase
    .from('event')
    .update(changes)
    .eq('e_id', Number(req.params.id))
    .select(EVENT_SELECT)
    .maybeSingle();
  if (error) return dbError(res, error);
  if (!data) return res.status(404).json({ error: 'Event not found.' });
  res.json(data);
});

// Unknown API routes and malformed JSON return JSON (not an HTML error page).
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
