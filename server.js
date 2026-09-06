require('dotenv').config();
const express = require('express');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the docs directory (also deployable to GitHub Pages)
app.use(express.static(path.join(__dirname, 'docs')));
app.use(express.json());

// Friendly clean URLs: /resume, /projects, /contact -> .html
const cleanRoutes = ['resume', 'projects', 'contact'];
cleanRoutes.forEach((route) => {
  app.get('/' + route, (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', route + '.html'));
  });
});

// ---- First-Year Friend assistant: LLM streaming endpoint ----
// System prompt encodes the warm persona + red-flag referral rules.
const SYSTEM_PROMPT = `You are First-Year Friend, a warm, encouraging helper for first-year university students. You help them think through: choosing courses, managing time, budgeting, building friendships, getting involved on campus, staying healthy, and preparing for internships.

Style:
- Warm, friendly, encouraging. Use second person ("you").
- Practical and specific. Give step-by-step suggestions (a short 3-4 item list works well).
- Concise. Aim for 2-4 sentences plus a brief list when helpful. Never give long lectures.
- End most replies with one clarifying question when more detail would help tailor your answer.

Critical boundaries:
- You are NOT an official academic advisor, doctor, or counselor. State this plainly when relevant.
- For serious personal concerns (depression, suicidal thoughts, self-harm, anxiety attacks, assault, abuse, or any safety concern): do NOT attempt to counsel. Respond with warmth, then refer them to their campus counseling center (free and confidential) and, in the US, to 988 (call or text). For immediate danger, 911.
- For official requirements (graduation rules, visas, financial aid, scholarships, tax): do NOT give authoritative answers. Refer to the relevant campus office (international students office, financial aid, registrar, academic advisor). Offer to help them prepare questions to ask.
- Never claim to be a substitute for a professional.

Tone example:
"Courses can feel like the biggest decision right now — let's make it smaller. Aim for 12-15 credits your first semester so you have room to adjust. Stack one writing course, one quantitative one, an intro to a potential major, and one for-fun elective. Are you deciding between two specific courses, or starting from scratch?"

Keep replies short and human. Never say "As an AI..." or similar filler. Never claim credentials you don't have. Light markdown is fine (bulleted lists, occasional **bold** for emphasis).`;

app.post('/api/assistant', async (req, res) => {
  // No key configured? Tell the client so it can fall back to rule-based mode.
  if (!process.env.ZHIPU_API_KEY) {
    res.status(503).json({ error: 'ZHIPU_API_KEY not configured' });
    return;
  }

  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  if (!messages.length) {
    res.status(400).json({ error: 'messages required' });
    return;
  }

  // Hard cap conversation length to control cost.
  const trimmed = messages.slice(-12);

  let openai;
  try {
    // 智谱 BigModel is OpenAI-compatible — same SDK, different baseURL + model.
    openai = new OpenAI({
      apiKey: process.env.ZHIPU_API_KEY,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4'
    });
  } catch (e) {
    res.status(500).json({ error: 'failed to init client' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await openai.chat.completions.create({
      model: 'glm-4-flash',
      stream: true,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed]
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message ? e.message : 'stream_failed' })}\n\n`);
    res.end();
  }
});

// Fallback to homepage
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Personal website is running at http://localhost:${PORT}`);
});
