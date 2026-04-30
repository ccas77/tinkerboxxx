import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey || !openaiKey) {
    return res.status(500).json({ error: "Server misconfigured: missing env vars" });
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid token" });
  const user = userData.user;

  const { appId, name, description } = req.body || {};
  if (!appId || !name) return res.status(400).json({ error: "appId and name required" });

  const { data: app, error: appErr } = await supabaseUser
    .from("apps").select("id").eq("id", appId).single();
  if (appErr || !app) return res.status(403).json({ error: "App not found or not yours" });

  const prompt = `An iOS App Store icon for an app called "${name}". ${description || ""}.
Format: perfectly square with rounded corners, like an iPhone home screen icon.
Background: ONE solid flat color that fills the entire square (no gradients, no scenes, no textures, no shading, no photographic content).
Foreground: ONE simple bold centered pictogram or symbol in a single contrasting color.
Style: minimal flat design in the Apple Human Interface Guidelines / Material Design tradition, similar to icons for apps like GitHub, Notion, Slack, or Spotify. Vibrant but tasteful.
Strict rules: no text, no letters, no numbers, no words, no logotype, no handwritten elements, no 3D rendering, no shadows on the background.`;

  const oaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024", quality: "medium" }),
  });
  if (!oaiRes.ok) {
    const detail = await oaiRes.text();
    return res.status(502).json({ error: "OpenAI request failed", detail });
  }
  const oaiJson = await oaiRes.json();
  const b64 = oaiJson?.data?.[0]?.b64_json;
  if (!b64) return res.status(502).json({ error: "No image in OpenAI response" });
  const imgBuf = Buffer.from(b64, "base64");

  const admin = createClient(supabaseUrl, serviceKey);
  const path = `${user.id}/${appId}-${Date.now()}.png`;
  const { error: upErr } = await admin.storage.from("app-icons")
    .upload(path, imgBuf, { contentType: "image/png", upsert: true });
  if (upErr) return res.status(500).json({ error: "Storage upload failed", detail: upErr.message });

  const { data: pub } = admin.storage.from("app-icons").getPublicUrl(path);
  const iconUrl = pub.publicUrl;

  const { error: updErr } = await admin.from("apps").update({ icon_url: iconUrl }).eq("id", appId);
  if (updErr) return res.status(500).json({ error: "DB update failed", detail: updErr.message });

  return res.status(200).json({ iconUrl });
}
