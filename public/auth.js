// Shared sign-in helper for every page.
// The browser only ever gets the PUBLISHABLE key (from /api/config). The secret key stays in .env on the server.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

const config = await fetch('/api/config').then((r) => r.json());
export const supabase = createClient(config.supabaseUrl, config.publishableKey);

// The signed-in user's access token, or null when signed out.
export async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// Calls our Express API and attaches "Authorization: Bearer <token>" when signed in.
// Always resolves to { ok, status, data } so pages can show the server's error message.
export async function api(method, url, body) {
  const token = await getToken();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the server. Is it running?' } };
  }
  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: `Unexpected response (${res.status}).` };
  }
  return { ok: res.ok, status: res.status, data };
}

// Loads the current user from the server, or sends them to the sign-in page.
export async function requireSignIn() {
  const { ok, data } = await api('GET', '/api/me');
  if (!ok) {
    location.href = '/login.html?next=' + encodeURIComponent(location.pathname);
    return new Promise(() => {}); // stop the page while it redirects
  }
  return data; // { email, roles, isStaff, client }
}

export async function signOut() {
  await supabase.auth.signOut();
  location.href = '/login.html';
}

// Fills the staff header's signed-in block (StaffHeader.astro) and wires its Sign out button.
// Pass null to hide the block (signed out). Does nothing on pages without the header.
export function showStaffHeader(me) {
  const who = document.getElementById('who');
  if (!who) return;
  who.hidden = !me;
  if (!me) return;
  const name = me.client?.c_name ?? me.email;
  const words = String(name).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  document.getElementById('whoName').textContent = name;
  document.getElementById('whoInitials').textContent =
    ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
  document.getElementById('whoRole').textContent = me.isStaff ? 'Staff' : 'Client';
  document.getElementById('signOut').onclick = signOut;
}

// Marks invalid required fields in a form (aria-invalid) and returns a list of
// "Label: problem" messages. Empty list = valid. Uses the browser's own checks.
export function formProblems(form) {
  const problems = [];
  form.querySelectorAll('input:not([type="checkbox"]), select, textarea').forEach((el) => {
    const bad = !el.checkValidity();
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    const label = form.querySelector(`label[for="${el.id}"]`)?.textContent.trim() ?? el.name;
    if (bad) problems.push(`${label}: ${el.validationMessage}`);
  });
  return problems;
}

// Shows a message in an element as a design-system alert.
// kind: 'error' | 'success' | 'info'. items: optional list shown under the text.
// Uses textContent only, so server text cannot inject HTML.
export function showAlert(el, kind, text, items = []) {
  el.hidden = !text;
  el.className = text ? `alert alert-${kind}` : '';
  el.textContent = '';
  if (!text) return;
  const strong = document.createElement(items.length ? 'strong' : 'span');
  strong.textContent = text;
  el.append(strong);
  if (items.length) {
    const ul = document.createElement('ul');
    ul.style.margin = '4px 0 0';
    items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
    el.append(ul);
  }
}

// Exposed for the README's direct server checks in the browser console.
window.wellspring = { supabase, api, getToken };
