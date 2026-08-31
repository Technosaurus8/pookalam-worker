export default {
  async fetch(request, env) {
    // CORS + Origin gate
    const ALLOWED_ORIGINS = [
      "https://pookalam-ai.web.app",       // your Hosting domain, once deployed
      "http://localhost:5000",             // adjust to your actual local dev port
      "http://localhost:8080",
    ];
    const origin = request.headers.get("Origin") || "";
    const originOk = ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      "Access-Control-Allow-Origin": originOk ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST" || !originOk) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = await request.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are judging a freehand-drawn pookalam (a traditional Onam flower rangoli) made on a digital canvas, using only a pencil tool — no shapes, stamps, or symmetry guides. Score it 0-100 against this rubric: symmetry, color harmony (use of traditional Onam palette), creativity, and resemblance to a traditional pookalam. Be honest with the score. However, keep the comment warm and specific even for rough or simple attempts — celebrate effort and color choice over technical precision, since this is freehand output from a first-time player, not a stamped or template-based drawing. Respond with ONLY strict JSON, no markdown, no extra text: {"score": <int 0-100>, "comment": "<one warm, specific sentence>"}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/png", data: imageBase64 } },
            ],
          }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      result = { score: 0, comment: "Scoring failed — please try again." };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};