import { createClient } from "@supabase/supabase-js";

// Tuned for Google's cheap image-gen model (Gemini 2.5 Flash Image, a.k.a.
// "nano-banana"), which prefers a single dense natural-language paragraph
// over comma-separated tag lists or SD-style weighting syntax.
const SYSTEM_PROMPT = `You convert a reference image into a detailed text prompt that a Gemini image generation model can use to recreate something visually similar.

Output format:
- One dense paragraph, 60 to 120 words.
- Plain natural English. No comma-separated tag lists, no parenthetical weights, no negative prompts, no model parameters.
- Lead with the subject and what it is doing. Then describe composition and camera framing, then setting and background, then lighting and color palette, then mood and overall style.
- Be specific about physical detail: materials, textures, body position, expressions, clothing, props.
- Do NOT name real people, copyrighted characters, or specific artist names. If you recognise a person, describe their features generically.
- Do NOT infer or impose a genre. Describe only what you can actually see in the image.
- IGNORE any text overlay, caption, watermark, logo text, or typography in the image. Do not describe it, transcribe it, or reference its placement. Describe only the underlying visual scene as if the text were not there.
- NO INTERPRETATION. Describe what is visually present, not what it means, suggests, evokes, or invites the viewer to feel. Banned moves include: explaining the "significance" of objects, attributing emotions or intentions to the subject, narrating what the composition "draws attention to" or "emphasizes", guessing at backstory, calling the mood "reflective" / "contemplative" / "peaceful" / "mysterious", or any phrase like "suggesting a love for X", "inviting curiosity", "speaks to", "evokes a sense of". Mood and atmosphere may only be conveyed through concrete visual facts (warm afternoon light, soft focus, muted palette), never editorial labels.
- Return only the prompt paragraph. No preamble, no headings, no quote marks.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY not configured" });

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return res.status(500).json({ error: "Server misconfigured" });
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid token" });

  const { imageUrl, imageDataUrl } = req.body || {};
  const image = imageDataUrl || imageUrl;
  if (!image) return res.status(400).json({ error: "imageUrl or imageDataUrl required" });
  if (typeof image !== "string" || image.length > 7_000_000) {
    return res.status(413).json({ error: "Image too large (max ~5MB)" });
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Generate the prompt." },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      return res.status(502).json({ error: `openai ${r.status}: ${body.slice(0, 300)}` });
    }
    const data = await r.json();
    const prompt = data.choices?.[0]?.message?.content?.trim();
    if (!prompt) return res.status(502).json({ error: "Empty response from model" });
    return res.status(200).json({ prompt });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
