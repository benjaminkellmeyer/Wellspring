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
 
const TABLE = 'event_requests';
 
// Allowed values (must match the <option value="..."> entries in the form)
const CATEGORIES = ['public', 'private', 'tenant'];
const TYPES = ['wedding', 'birthday_party', 'corporate', 'community', 'non-profit', 'other'];
const FURNITURE = ['tables', 'chairs', 'podium', 'stage', 'linens'];
const TECH = ['projector', 'microphone', 'speakers', 'wifi', 'screen'];
 
// Set to false if events in different rooms may overlap in time ---------------------------------------------------- NOT SURE WHAT TO DO HERE ---------
const CHECK_OVERLAP = false;
 
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
 
  const category = String(body.category ?? '');
  if (!CATEGORIES.includes(category)) errors.push('Choose a valid category.');
 
  const type = String(body.type ?? '');
  if (!TYPES.includes(type)) errors.push('Choose a valid event type.');
 
  const name = String(body.name ?? '').trim();
  if (!name) errors.push('Event name is required.');
  if (name.length > 200) errors.push('Event name must be 200 characters or fewer.');
 
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
 
  const attendance = Number(body.attendance);
  if (!Number.isInteger(attendance) || attendance < 2 || attendance > 350) {
    errors.push('Attendance must be a whole number between 2 and 350.');
  }
 
  const furniture = toList(body['furniture[]'] ?? body.furniture);
  if (!furniture.every((f) => FURNITURE.includes(f))) errors.push('Invalid furniture selection.');
 
  const tech = toList(body['tech[]'] ?? body.tech);
  if (!tech.every((t) => TECH.includes(t))) errors.push('Invalid tech selection.');
 
  const catering = String(body.catering ?? '').trim();
  if (catering.length > 200) errors.push('Catering notes must be 200 characters or fewer.');
 
  const notes = String(body.notes ?? '').trim();
  if (notes.length > 2000) errors.push('Notes must be 2000 characters or fewer.');
 
  // Only these fields ever reach the database. Column names are on the left; rename to match your table.
  const clean = {
    e_category,
    e_type,
    e_name,
    e_start_time: body.start,
    e_end_time: body.end,
    e_attendance,
    e_furniture: [...new Set(furniture)],
    e_tech: [...new Set(tech)],
    e_catering: catering || null,
    e_notes: notes || null,
  };
 
  return { errors, clean };
}


//UPDATE THIS WITH AIDEN CODE -----------------------------------------------------------------------------------------------
 
function errorPage(res, status, messages) {
  const items = messages.map((m) => `<li>${m.replace(/</g, '&lt;')}</li>`).join('');
  res
    .status(status)
    .send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Request Error</title></head>` +
        `<body><h1>We couldn't submit your request</h1><ul>${items}</ul>` +
        `<p><a href="javascript:history.back()">Go back and fix the form</a></p></body></html>`
    );
}

//UPDATE THIS WITH AIDEN CODE -----------------------------------------------------------------------------------------------
 
// CREATE an event request (the form posts here)
app.post('/api/event-requests', async (req, res) => {
  const { errors, clean } = validateEventRequest(req.body);
  if (errors.length) return errorPage(res, 400, errors);
 
  // Reject requests that overlap an existing booking.
  // Overlap rule: existing.start < new.end AND existing.end > new.start
  if (CHECK_OVERLAP) {
    const { data: conflicts, error: conflictError } = await supabase
      .from(TABLE)
      .select('id')
      .lt('start_time', clean.end_time)
      .gt('end_time', clean.start_time)
      .limit(1);
 
    if (conflictError) {
      console.error(conflictError);
      return errorPage(res, 500, ['Something went wrong. Please try again.']);
    }
    if (conflicts.length) {
      return errorPage(res, 409, ['That time is not available. Please choose a different time.']);
    }
  }
 
  const { error } = await supabase.from(TABLE).insert(clean);
  if (error) {
    console.error(error);
    return errorPage(res, 500, ['Something went wrong. Please try again.']);
  }
 
  res.redirect(303, '/eventSuccess.html');
});
 
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
