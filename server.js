import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, PORT = 3000 } = process.env;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment');
  process.exit(1);
}

// Server-only client. The secret key bypasses Row Level Security,
// so it must never be sent to the browser.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(express.urlencoded({ extended: true })); // parses the HTML form (and furniture[] / tech[] arrays)
app.use(express.json());
app.use(express.static('public'));

const TABLE = 'event';
const ROOM_TABLE = 'room';
const CLIENT_TABLE = 'client';
const COORDINATOR_TABLE = 'coordinator';

// Allowed values (must match the <option value="..."> entries in the form)
const CATEGORIES = ['public', 'private', 'tenant'];
const TYPES = ['wedding', 'birthday_party', 'corporate', 'community', 'non-profit', 'other'];
const FURNITURE = ['tables', 'chairs', 'podium', 'stage', 'linens'];
const TECH = ['projector', 'microphone', 'speakers', 'wifi', 'screen'];
const STATUSES = ['submitted', 'in_progress', 'scheduled', 'declined', 'cancelled', 'needs_followup', 'completed'];

// category -> co_id (set by the server, never by the browser)
const CO_ID_BY_CATEGORY = { public: 1, private: 2, tenant: 3 };

// Only rooms with this r_status can be booked.
const BOOKABLE_STATUS = 'Available';

// Room overlap is enforced by the database (event_no_room_overlap exclusion constraint),
// so there is no overlap check in this file.

// The venue's time zone. The form's datetime-local values are treated as wall-clock time here.
const VENUE_TZ = 'America/Chicago';

// ---------------------------------------------------------------------------
// Time zone helpers
// ---------------------------------------------------------------------------

// How far (in ms) the venue's clock is from UTC at a given instant (negative for Chicago).
function tzOffsetMs(utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VENUE_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asIfUtc - utcMs;
}

// "2026-11-14T16:00" (Chicago wall-clock) -> "2026-11-14T22:00:00.000Z" (the real instant).
// Two passes so times near a daylight-saving change resolve correctly.
function chicagoToIso(local) {
  const asUtc = Date.parse(local + ':00Z');
  let guess = asUtc;
  for (let i = 0; i < 2; i++) guess = asUtc - tzOffsetMs(guess);
  return new Date(guess).toISOString();
}

// ---------------------------------------------------------------------------
// Validation (create)
// ---------------------------------------------------------------------------

// A form field can arrive as undefined, a string, or an array. Always return a clean array.
function toList(value) {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

// datetime-local sends "2026-11-20T14:30". Validate the shape and that it's a real date.
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function parseLocal(value) {
  if (typeof value !== 'string' || !DATETIME_RE.test(value)) return null;
  const ms = Date.parse(value + 'Z'); // parsed as UTC only so we can compare two values consistently
  return Number.isNaN(ms) ? null : ms;
}

// Validates everything server-side (never trust the browser) and returns { errors, clean }
function validateEventRequest(body = {}) {
  const errors = [];

  const e_category = String(body.category ?? '');
  if (!CATEGORIES.includes(e_category)) errors.push('Choose a valid category.');

  const e_type = String(body.type ?? '');
  if (!TYPES.includes(e_type)) errors.push('Choose a valid event type.');

  const e_name = String(body.name ?? '').trim();
  if (!e_name) errors.push('Event name is required.');
  if (e_name.length > 200) errors.push('Event name must be 200 characters or fewer.');

  const startMs = parseLocal(body.start);
  const endMs = parseLocal(body.end);
  if (startMs === null) errors.push('A valid start time is required.');
  if (endMs === null) errors.push('A valid end time is required.');
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

  // The dropdown's option values are r_id numbers. Anything else is rejected.
  const roomRaw = String(body.room ?? '');
  const roomId = /^\d+$/.test(roomRaw) ? Number(roomRaw) : null;
  if (roomId === null) errors.push('Choose a room.');

  // The dropdown's option values are c_id numbers. Anything else is rejected.
  const clientRaw = String(body.client ?? '');
  const clientId = /^\d+$/.test(clientRaw) ? Number(clientRaw) : null;
  if (clientId === null) errors.push('Choose a client.');

  const e_furniture = toList(body['e_furniture[]'] ?? body.e_furniture);
  if (!e_furniture.every((f) => FURNITURE.includes(f))) errors.push('Invalid furniture selection.');

  const e_tech = toList(body['tech[]'] ?? body.tech);
  if (!e_tech.every((t) => TECH.includes(t))) errors.push('Invalid tech selection.');

  const e_catering = String(body.catering ?? '').trim();
  if (e_catering.length > 200) errors.push('Catering notes must be 200 characters or fewer.');

  const e_notes = String(body.notes ?? '').trim();
  if (e_notes.length > 2000) errors.push('Notes must be 2000 characters or fewer.');

  // Only these fields ever reach the database.
  const clean = {
    c_id: clientId,
    co_id: CO_ID_BY_CATEGORY[e_category], // 1 = public, 2 = private, 3 = tenant
    r_id: roomId,
    e_category,
    e_type,
    e_name,
    // CHANGED: form times are Chicago wall-clock time, converted to the real instant before saving
    e_start: startMs !== null ? chicagoToIso(body.start) : null,
    e_end: endMs !== null ? chicagoToIso(body.end) : null,
    e_attendance,
    e_furniture: [...new Set(e_furniture)],
    e_tech: [...new Set(e_tech)],
    e_catering: e_catering || null,
    e_notes: e_notes || null,
    e_status: 'submitted', // ADDED: e_status is NOT NULL with no database default
  };

  return { errors, clean };
}

// ---------------------------------------------------------------------------
// Database error translation
// ---------------------------------------------------------------------------

// Turns a Postgres error from the room trigger / constraints into something a person can read.
function dbErrorInfo(error) {
  if (error?.code === '23P01') {
    // event_no_room_overlap exclusion constraint
    return { status: 409, message: 'That room is already scheduled for another event during this time.' };
  }
  if (error?.code === '23514') {
    // The room trigger raises readable messages ("Room 3 is unavailable", "Attendance (...) exceeds capacity ...").
    // Table check constraints produce "new row for relation ..." messages, which are not readable.
    if (error.message && !error.message.startsWith('new row')) {
      return { status: 409, message: error.message };
    }
    return { status: 400, message: 'That change breaks one of the database rules. Check the values and try again.' };
  }
  return { status: 500, message: 'Something went wrong. Please try again.' };
}

//UPDATE THIS WITH AIDEN CODE -----------------------------------------------------------------------------------------------

function errorPage(res, status, messages) {
  const params = new URLSearchParams();
  messages.forEach((m) => params.append('error', m));
  res.redirect(303, `/eventFailure.html?${params.toString()}`);
}

//UPDATE THIS WITH AIDEN CODE -----------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// READ: lookups for the dropdowns and name maps
// ---------------------------------------------------------------------------
app.get('/api/lookups', async (req, res) => {
  const [clients, coordinators, rooms] = await Promise.all([
    supabase.from(CLIENT_TABLE).select('c_id, c_name').order('c_name'),
    supabase.from(COORDINATOR_TABLE).select('co_id, co_name').order('co_name'),
    supabase.from(ROOM_TABLE).select('r_id, r_name').order('r_id'),
  ]);

  const failed = clients.error || coordinators.error || rooms.error;
  if (failed) {
    console.error(failed);
    return res.status(500).json({ error: 'Could not load lookup lists.' });
  }

  res.json({ clients: clients.data, coordinators: coordinators.data, rooms: rooms.data });
});

// ---------------------------------------------------------------------------
// READ: events, with the related client / coordinator / room names attached
// ---------------------------------------------------------------------------
const EVENT_SELECT = '*, client(c_name), coordinator(co_name), room(r_name)';

app.get('/api/events', async (req, res) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(EVENT_SELECT)
    .order('e_start', { ascending: true });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load events.' });
  }

  res.json({ events: data });
});

// ---------------------------------------------------------------------------
// UPDATE: status only for now. To allow more fields later, add them to the
// whitelist below with their own validation.
// ---------------------------------------------------------------------------
app.patch('/api/events/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid event id.' });
  }
  const id = Number(req.params.id);

  const updates = {};

  if (req.body?.status !== undefined) {
    const status = String(req.body.status);
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Choose a valid status.' });
    }
    updates.e_status = status;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('e_id', id)
    .select(EVENT_SELECT)
    .maybeSingle();

  if (error) {
    console.error(error);
    const info = dbErrorInfo(error);
    return res.status(info.status).json({ error: info.message });
  }
  if (!data) return res.status(404).json({ error: 'That event request does not exist.' });

  res.json({ ok: true, event: data });
});

// ---------------------------------------------------------------------------
// CREATE an event request (the form posts here)
// ---------------------------------------------------------------------------
app.post('/api/event-requests', async (req, res) => {
  const { errors, clean } = validateEventRequest(req.body);
  if (errors.length) return errorPage(res, 400, errors);

  // Confirm the chosen client exists in the database
  const { data: client, error: clientError } = await supabase
    .from(CLIENT_TABLE)
    .select('c_id')
    .eq('c_id', clean.c_id)
    .maybeSingle();

  if (clientError) {
    console.error(clientError);
    return errorPage(res, 500, ['Something went wrong. Please try again.']);
  }
  if (!client) return errorPage(res, 400, ['That client does not exist.']);

  // Look up the chosen room in the database so we trust its real capacity and status,
  // not anything the browser sent.
  const { data: room, error: roomError } = await supabase
    .from(ROOM_TABLE)
    .select('r_id, r_name, r_capacity, r_status')
    .eq('r_id', clean.r_id)
    .maybeSingle();

  if (roomError) {
    console.error(roomError);
    return errorPage(res, 500, ['Something went wrong. Please try again.']);
  }
  if (!room) return errorPage(res, 400, ['That room does not exist.']);
  if (room.r_status !== BOOKABLE_STATUS) {
    return errorPage(res, 409, [`${room.r_name} is not available for booking (${room.r_status}).`]);
  }
  // FIXED: was clean.attendance (undefined), so this check never ran
  if (clean.e_attendance > room.r_capacity) {
    return errorPage(res, 400, [
      `${room.r_name} holds up to ${room.r_capacity} people. Choose a larger room or lower the attendance.`,
    ]);
  }

  const { error } = await supabase.from(TABLE).insert(clean);
  if (error) {
    console.error(error);
    const info = dbErrorInfo(error);
    return errorPage(res, info.status, [info.message]);
  }

  // Send the assigned co_id to the results page as a query parameter
  res.redirect(303, `/eventSuccess.html?co_id=${clean.co_id}`);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
