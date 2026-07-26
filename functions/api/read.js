// Cloudflare Pages Function: GET/POST /api/read
// Stores the set of "read" email IDs in a Cloudflare KV namespace so read
// status can sync across devices/browsers, on top of the localStorage copy
// the frontend already keeps for instant offline reads.
//
// Requires a KV binding named READ_KV on the Pages project.

const KV_KEY = "read_ids";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    ...init,
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.READ_KV) {
    return json({ ok: false, error: "READ_KV binding not configured" }, { status: 500 });
  }
  const raw = await env.READ_KV.get(KV_KEY);
  let ids = [];
  try {
    ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) ids = [];
  } catch (e) {
    ids = [];
  }
  return json({ ok: true, ids });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.READ_KV) {
    return json({ ok: false, error: "READ_KV binding not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const incoming = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];

  // Merge with whatever is already stored so concurrent devices don't clobber
  // each other's read state.
  const raw = await env.READ_KV.get(KV_KEY);
  let existing = [];
  try {
    existing = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(existing)) existing = [];
  } catch (e) {
    existing = [];
  }

  const merged = Array.from(new Set([...existing, ...incoming]));
  await env.READ_KV.put(KV_KEY, JSON.stringify(merged));

  return json({ ok: true, ids: merged });
}
