// Cloudflare Pages Function: POST /api/readwise
// Proxies "save highlight" requests to the Readwise API so the Readwise
// access token never has to reach the browser. The token is configured as
// an encrypted environment variable (secret) named READWISE_TOKEN on the
// Pages project — set it in the Cloudflare dashboard, never commit it.
//
// This whole site sits behind Cloudflare Access (restricted to the owner's
// email), so this endpoint is not separately authenticated — only the
// owner can reach it in the first place.

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    ...init,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.READWISE_TOKEN) {
    return json(
      { ok: false, error: "READWISE_TOKEN not configured on this Pages project" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text || "").toString().trim();
  const title = (body.title || "").toString().trim();
  const url = (body.url || "").toString().trim();

  if (!text) {
    return json({ ok: false, error: "Missing highlight text" }, { status: 400 });
  }

  const payload = {
    highlights: [
      {
        text,
        title: title || undefined,
        source_url: url || undefined,
        source_type: "learning-digest",
        category: "articles",
      },
    ],
  };

  let resp;
  try {
    resp = await fetch("https://readwise.io/api/v2/highlights/", {
      method: "POST",
      headers: {
        Authorization: `Token ${env.READWISE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ ok: false, error: "Failed to reach Readwise API: " + String(e) }, { status: 502 });
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return json({ ok: false, error: `Readwise API error (${resp.status}): ${errText}` }, { status: 502 });
  }

  return json({ ok: true });
}
