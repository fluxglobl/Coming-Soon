/**
 * Vercel serverless function: waitlist signup
 * POST /api/waitlist — accepts email, country, state (form-urlencoded or JSON)
 */
const { parse } = require("querystring");
const { createClient } = require("redis");

// Lazily-initialized Redis client using REDIS_URL
let redisClient;
async function getRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (redisClient && redisClient.isOpen) return redisClient;

  redisClient = createClient({ url });
  redisClient.on("error", (err) => {
    console.error("Redis client error", err);
  });
  await redisClient.connect();
  return redisClient;
}

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

  // Persist to Redis if REDIS_URL is configured in the Vercel project
  try {
    const client = await getRedisClient();
    if (client) {
      await client.rPush("waitlist", JSON.stringify(entry));
    } else {
      console.warn("REDIS_URL not set; skipping Redis persistence");
    }
  } catch (err) {
    console.error("Redis write error", err);
  }

  res.status(200).json({
    ok: true,
    message: "You're on the list. We'll be in touch.",
  });
};
