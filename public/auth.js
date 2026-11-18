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

// Exposed for the README's direct server checks in the browser console.
window.wellspring = { supabase, api, getToken };
