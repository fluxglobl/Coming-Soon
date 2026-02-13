/**
 * Vercel serverless function: waitlist signup
 * POST /api/waitlist — accepts email, country, state (form-urlencoded or JSON)
 */
const { parse } = require("querystring");

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const contentType = (req.headers["content-type"] || "").split(";")[0].trim();
      if (contentType === "application/json") {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      } else {
        resolve(parse(raw));
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    res.status(400).json({ ok: false, error: "Invalid request body" });
    return;
  }

  const email = (body.email || "").trim();
  const country = (body.country || "").trim();
  const state = (body.state || "").trim();

  if (!email) {
    res.status(400).json({ ok: false, error: "Email is required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ ok: false, error: "Invalid email address" });
    return;
  }

  if (!country) {
    res.status(400).json({ ok: false, error: "Country is required" });
    return;
  }

  const entry = { email, country, state: state || "", ts: new Date().toISOString() };

  // Persist if Redis/KV is configured (add KV store in Vercel project → Storage)
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const payload = ["RPUSH", "waitlist", JSON.stringify(entry)];
      const kvRes = await fetch(kvUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kvToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!kvRes.ok) {
        console.error("KV store failed", await kvRes.text());
      }
    } catch (err) {
      console.error("KV store error", err);
    }
  }

  res.status(200).json({
    ok: true,
    message: "You're on the list. We'll be in touch.",
  });
};
