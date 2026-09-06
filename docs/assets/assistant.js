/* First-Year Friend — warm helper for first-year students.
   LLM-backed (智谱 GLM-4-Flash, streaming) with rule-based fallback
   if the API is unavailable or no key is configured. Not a substitute
   for official advisors, doctors, or counselors. */

(function () {
  "use strict";

  var form = document.getElementById("assistantForm");
  if (!form) return; // not on the projects page

  var chat = document.getElementById("assistantChat");
  var input = document.getElementById("assistantInput");
  var chips = document.getElementById("assistantChips");

  // session-only conversation memory for the LLM
  var history = [];
  var llmAvailable = true; // set false after first 503, then skip retries

  // ============================ LLM path ============================

  async function streamLLM(userText, userBubble) {
    // Build the message list to send: just the running history + this turn.
    var payload = history.concat([{ role: "user", content: userText }]);

    var botBubble = document.createElement("div");
    botBubble.className = "msg bot";
    botBubble.textContent = "";
    chat.appendChild(botBubble);
    chat.scrollTop = chat.scrollHeight;

    var full = "";
    try {
      var res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload })
      });

      if (res.status === 503) {
        // No key on the server — disable LLM for the session and fall back.
        llmAvailable = false;
        chat.removeChild(botBubble);
        return false;
      }
      if (!res.ok || !res.body) {
        chat.removeChild(botBubble);
        return false;
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        var parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (var i = 0; i < parts.length; i++) {
          var line = parts[i];
          if (line.indexOf("data: ") !== 0) continue;
          var data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            var parsed = JSON.parse(data);
            if (parsed.delta) {
              full += parsed.delta;
              botBubble.textContent = full;
              chat.scrollTop = chat.scrollHeight;
            } else if (parsed.error) {
              chat.removeChild(botBubble);
              return false;
            }
          } catch (e) { /* ignore parse hiccups */ }
        }
      }

      if (!full.trim()) {
        chat.removeChild(botBubble);
        return false;
      }

      // Render minimal markdown once streaming ends.
      botBubble.innerHTML = renderMarkdown(full);
      chat.scrollTop = chat.scrollHeight;
      history.push({ role: "user", content: userText });
      history.push({ role: "assistant", content: full });
      return true;
    } catch (e) {
      if (botBubble.parentNode) chat.removeChild(botBubble);
      return false;
    }
  }

  // Tiny markdown renderer: **bold**, *italics*, - /* bullet lines, blank-line paragraphs.
  function renderMarkdown(text) {
    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    var lines = esc(text).replace(/\r/g, "").split("\n");
    var html = "";
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var bullet = line.match(/^\s*[-*]\s+(.*)$/);
      if (bullet) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += "<li>" + inlineMd(bullet[1]) + "</li>";
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        if (line.trim() === "") {
          html += "<br>";
        } else {
          html += inlineMd(line);
          if (i < lines.length - 1) html += "<br>";
        }
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  function inlineMd(s) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<em>$1</em>");
  }

  // ============================ Rule-based fallback ============================

  var TOPICS = {
    courses: {
      label: "Choosing courses",
      ack: "Courses can feel like the biggest decision right now. Let's make it smaller.",
      steps: [
        "Aim for 12–15 credits your first semester — room to adjust to college pace.",
        "Stack one writing/reasoning course, one quantitative one, an intro to a potential major, and one for-fun elective.",
        "Before enrolling, check RateMyProfessors or ask upperclass students about workload and teaching style.",
        "Don't stack 8 a.m. classes five days a week — protect a consistent sleep rhythm."
      ],
      question: "Are you deciding between two specific courses, or starting from scratch? Tell me and I'll tailor this.",
      branches: [
        { match: ["between", "two", "deciding", "vs", "or "], reply: "For choosing between two courses, weigh four things: (1) which feeds a major you're considering, (2) workload vs your other classes, (3) the professor's reputation, (4) whether it unlocks a prerequisite you'll need. If they're close, pick the one that sparks more curiosity — you'll work harder when it matters to you." },
        { match: ["scratch", "don't know", "no idea", "where do", "start"], reply: "Starting from scratch: pick one writing/quantitative course (often a university requirement), one intro to a major you're curious about even loosely, and one elective purely for joy. Drop/swap is your friend — first week is for test-driving." }
      ]
    },
    time: {
      label: "Time management",
      ack: "Time is the quiet thing that runs first year. Let's get a handle on it.",
      steps: [
        "Pick ONE planner (paper or app) and put every class, deadline, and commitment there — one source of truth.",
        "Try 25-minute focused sprints with 5-minute breaks (Pomodoro).",
        "Use the 2-minute rule: anything under 2 minutes, do it now.",
        "Schedule a 20-minute weekly review each Sunday to plan the week ahead."
      ],
      question: "What's piling up most right now — readings, assignments, or just feeling scattered?",
      branches: [
        { match: ["reading", "read"], reply: "For readings: skim first (intro, headings, conclusion), then read with questions in the margins. Form a study group of three — you'll cover more in less time and remember it longer." },
        { match: ["assignment", "deadline", "due", "project"], reply: "For assignments: break them into tiny steps, put each step on your calendar with a fake deadline 2 days before the real one, and start the easiest piece today. Momentum beats motivation." },
        { match: ["scatter", "overwhelm", "all over", "lost"], reply: "When scattered: brain-dump everything on paper, pick the ONE most urgent thing, work on it for 25 minutes, then re-plan. A small finished thing beats a big unfinished one." }
      ]
    },
    budget: {
      label: "Budgeting",
      ack: "Money in college is tight for almost everyone. A few habits make a real difference.",
      steps: [
        "Track every expense for two weeks — apps like YNAB, or just a notebook. You can't fix what you can't see.",
        "Sort spending into needs (food, books, transport) vs wants (eating out, subscriptions).",
        "Cook staples in bulk — rice, beans, pasta — and use the meal plan if you have one.",
        "Buy used textbooks or rent from the library, Chegg, or Amazon Rentals."
      ],
      question: "Are you trying to figure out where your money's going, or looking for ways to save?",
      branches: [
        { match: ["where", "going", "track", "spend"], reply: "Track for two weeks first. Apps: YNAB (paid, powerful), your bank's app (free), or just Notes. Sort into needs/wants/savings. The act of tracking usually changes behavior more than the numbers do." },
        { match: ["save", "saving", "cheap", "broke"], reply: "Top saves: cook staples in bulk, used/rented textbooks, free campus events (films, talks, concerts), student discounts (Spotify, Amazon Prime, transit), and cancel subscriptions you haven't used in 30 days." }
      ]
    },
    friends: {
      label: "Making friends",
      ack: "Friendships in first year feel urgent but usually find their footing slowly. That's normal.",
      steps: [
        "The first month, say yes to more invitations than feels comfortable — everyone is new and looking.",
        "Join 2–3 clubs around real interests; recurring contact is how friendships actually form.",
        "Start small conversations: a compliment, a question about class, an invite to grab coffee.",
        "Be the one who follows up — \"want to study together Thursday?\" turns an acquaintance into a friend."
      ],
      question: "Is loneliness the hard part, or is it more about how to start a conversation?",
      branches: [
        { match: ["lonely", "alone", "isolated", "no friends"], reply: "Loneliness in first year is more common than it looks — most people just hide it. Push into one recurring commitment this week (study group, club, intramural). Familiarity grows into friendship. Give it 6 weeks before you decide you 'don't fit.'" },
        { match: ["conversation", "talk", "start", "say"], reply: "Conversation starters that work: compliment something specific (\"love your tote\"), ask about the class or professor, invite to coffee after class. People remember the one who made the first move — they were nervous too." }
      ]
    },
    involved: {
      label: "Getting involved",
      ack: "Getting involved is one of the best parts of campus — and easy to overdo.",
      steps: [
        "Pick no more than 2–3 commitments so you can go deep, not wide.",
        "Mix three types: career-related (professional society), fun (intramural, a cappella), and service-oriented.",
        "Attend the activities fair, then go to the first two meetings of any club before committing.",
        "Ask about leadership pipelines — most clubs need a first-year to shadow a senior."
      ],
      question: "Are you weighing which clubs to join, or worried you've already said yes to too many?",
      branches: [
        { match: ["which", "join", "find", "pick"], reply: "Go to the activities fair with a list: one career-related, one fun, one service. Trial two meetings of each before committing. Commit only when you'd genuinely miss it if you stopped going." },
        { match: ["too many", "overcommit", "overwhelm", "spread"], reply: "It's okay to step back. List your commitments, rank by what energizes you, and drop the lowest one this week with a kind message. Depth in 2 beats surface in 5 — for you and for them." }
      ]
    },
    health: {
      label: "Staying healthy",
      ack: "Health is the foundation everything else sits on. Let's keep it simple.",
      steps: [
        "Sleep: aim for 7–9 hours with a consistent wake time — even weekends.",
        "Move: 150 minutes a week. Walk to class, intramurals, gym, dance — whatever you'll actually do.",
        "Eat: build plates around protein + vegetables; don't skip breakfast before early classes.",
        "Stress: try 4-7-8 breathing (in 4s, hold 7s, out 8s) when overwhelmed. The counseling center is free — use it early, not just in crisis."
      ],
      question: "What's feeling hardest right now — sleep, food, movement, or stress?",
      branches: [
        { match: ["sleep", "tired", "insomnia", "awake"], reply: "Sleep: pick one consistent wake time (yes, weekends too). No screens in the 30 minutes before bed. If you can't fall asleep in 20 minutes, get up and read under dim light — don't toss. All-nighters lower the grade they're trying to save." },
        { match: ["food", "eat", "hungry", "meal"], reply: "Keep easy protein on hand: yogurt, nuts, eggs, canned beans. Build plates around protein + veg. Skipping breakfast before an 8 a.m. class means your brain runs on empty — even a banana + peanut butter helps." },
        { match: ["move", "exercise", "active", "fit"], reply: "150 minutes a week, any way you'll actually do. Walk to class instead of the bus, join intramurals, find a gym buddy, follow dance videos in your room — consistency beats intensity every time." },
        { match: ["stress", "anxious", "overwhelm", "anxiety", "panic"], reply: "When overwhelmed: 4-7-8 breathing (in 4s, hold 7s, out 8s, four rounds). Step outside for 10 minutes. And — really — book a first session at the counseling center. Free, confidential, and you don't need to be in crisis to go." }
      ]
    },
    internships: {
      label: "Internships",
      ack: "First year isn't too early — you're building the foundation internships later will need.",
      steps: [
        "Build a one-page résumé: classes, projects, clubs, part-time jobs, volunteer work.",
        "Visit your campus career center for a free résumé review in your first semester.",
        "Set up a Handshake or LinkedIn profile and connect with 20 alumni in fields you're curious about.",
        "Attend one career fair just to practice talking to recruiters — no pressure to land one yet."
      ],
      question: "Are you starting your résumé from scratch, or looking for where to find opportunities?",
      branches: [
        { match: ["resume", "résumé", "cv"], reply: "One page, reverse-chronological. Sections: Education, Projects, Experience (incl. part-time and volunteer), Skills. Use verbs, not \"responsibilities\": \"Built,\" \"Organized,\" \"Improved.\" The career center will review it free — book them in your first semester." },
        { match: ["where", "find", "search", "look", "opportunit"], reply: "Handshake (campus-first), LinkedIn (alumni search by major), and your department's undergrad newsletter. Go to one career fair this semester just to practice — recruiters are friendly to nervous first-years, and the reps at low-traffic tables will give you the most time." }
      ]
    }
  };

  var RED_FLAGS = [
    {
      match: ["suicide", "suicidal", "kill myself", "end it", "self-harm", "self harm", "cut myself", "hopeless", "want to die", "ending my life"],
      reply: "That sounds really hard, and I'm glad you said it out loud. I'm not a substitute for a mental health professional. Please reach out to your campus counseling center — they're free and confidential. If you're in the US and in crisis right now, call or text 988. You don't have to carry this alone."
    },
    {
      match: ["depress", "can't cope", "cant cope", "breakdown", "panic attack", "mental health"],
      reply: "That sounds heavy. I'm not a substitute for a counselor — and you deserve a real one. Your campus counseling center is free and confidential; many offer same-week first appointments. In the US, you can also call or text 988 anytime. Reaching out is a strength, not a weakness."
    },
    {
      match: ["assault", "raped", "rape", "abused", "abuse", "unsafe", "harass", "stalker", "stalking", "hit me", "threaten", "hurt me"],
      reply: "Your safety comes first. I'm not the right helper for this. Please contact your campus Title IX office, campus security, or call 911 if you're in immediate danger. There are people trained to help you with care and confidentiality — please reach out to them today."
    },
    {
      match: ["visa", "f-1", "f1", "i-20", "i20", "opt", "cpt", "international student", "immigration", "deport"],
      reply: "For visa and immigration questions, the authoritative answer comes from your campus International Students office — please contact them directly. I'm not a substitute for them. Want help thinking through what questions to ask? I can help you prepare those."
    },
    {
      match: ["graduation requirement", "graduation", "financial aid", "scholarship", "tax", "tution", "tuition", "bill", "registration hold", "academic probation"],
      reply: "For official requirements like graduation rules, financial aid, or holds, the authoritative answer comes from your campus office (financial aid, registrar, or academic advisor). I can help you think through what to ask them, but they have the final word. Want help preparing those questions?"
    }
  ];

  function detectTopic(text) {
    var t = text.toLowerCase();
    for (var i = 0; i < RED_FLAGS.length; i++) {
      for (var j = 0; j < RED_FLAGS[i].match.length; j++) {
        if (t.indexOf(RED_FLAGS[i].match[j]) !== -1) return { type: "red", reply: RED_FLAGS[i].reply };
      }
    }
    var map = {
      courses: ["course", "class", "schedule", "credit", "register", "enroll", "major", "minor", "professor", "syllabus"],
      time:    ["time", "procrastinat", "deadline", "overwhelm", "busy", "schedule", "productiv", "focus", "distract"],
      budget:  ["money", "budget", "spend", "broke", "save", "cheap", "rent", "textbook", "tuition", "cost", "afford"],
      friends: ["friend", "lonely", "alone", "social", "talk to", "roommate", "meet people", "isolat"],
      involved:["club", "involved", "societ", "intramural", "volunteer", "leadership", "activities", "group"],
      health:  ["sleep", "tired", "anxious", "anxiety", "stress", "exercise", "eat", "food", "health", "sick", "mental"],
      internships: ["internship", "career", "resume", "résumé", "job", "handshake", "linkedin", "fair", "major"]
    };
    var keys = Object.keys(map);
    var best = null;
    for (var k = 0; k < keys.length; k++) {
      var list = map[keys[k]];
      for (var m = 0; m < list.length; m++) {
        if (t.indexOf(list[m]) !== -1) { best = keys[k]; break; }
      }
      if (best) break;
    }
    return best ? { type: "topic", topic: best } : null;
  }

  function matchBranch(topicObj, text) {
    var t = text.toLowerCase();
    for (var i = 0; i < topicObj.branches.length; i++) {
      var b = topicObj.branches[i];
      for (var j = 0; j < b.match.length; j++) {
        if (t.indexOf(b.match[j]) !== -1) return b.reply;
      }
    }
    return null;
  }

  function stepsList(steps) {
    var html = "<ul>";
    for (var i = 0; i < steps.length; i++) html += "<li>" + steps[i] + "</li>";
    return html + "</ul>";
  }

  function composeAck(topicObj) {
    return topicObj.ack + "\n\n" + stepsList(topicObj.steps) + "\n\n" + topicObj.question;
  }

  var ctx = { lastTopic: null, awaitingAnswer: false };

  function ruleBasedRespond(text) {
    var det = detectTopic(text);
    if (det && det.type === "red") {
      ctx.awaitingAnswer = false;
      return det.reply;
    }
    if (ctx.awaitingAnswer && ctx.lastTopic) {
      var branchReply = matchBranch(TOPICS[ctx.lastTopic], text);
      ctx.awaitingAnswer = false;
      if (branchReply) {
        return branchReply + "\n\nWant to dig into another area — courses, time, money, friends, getting involved, health, or internships?";
      }
    }
    if (det && det.type === "topic") {
      ctx.lastTopic = det.topic;
      ctx.awaitingAnswer = true;
      return composeAck(TOPICS[det.topic]);
    }
    ctx.awaitingAnswer = false;
    return "Happy to think that through with you. I'm best on courses, time, money, friends, getting involved, health, and internships — anything within first-year life. Which of those feels closest to what's on your mind? Or tell me a bit more about your situation.";
  }

  // ============================ Render helpers ============================

  function addMessage(escapedHtml, who) {
    var div = document.createElement("div");
    div.className = "msg " + who;
    div.innerHTML = escapedHtml;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function botReply(escapedHtml) {
    return addMessage(escapedHtml, "bot");
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ============================ Orchestration ============================

  async function handleUserTurn(userText) {
    addMessage(escapeHtml(userText), "user");

    // Try the LLM first (only if we haven't already discovered it's unavailable).
    if (llmAvailable) {
      var typing = document.createElement("div");
      typing.className = "msg bot";
      typing.textContent = "…";
      chat.appendChild(typing);
      chat.scrollTop = chat.scrollHeight;

      var ok = await streamLLM(userText);
      if (typing.parentNode) chat.removeChild(typing);
      if (ok) return;
    }

    // Fallback: rule-based reply.
    var reply = ruleBasedRespond(userText);
    botReply(reply);
  }

  // ============================ Event handlers ============================

  chips.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    var topic = btn.getAttribute("data-topic");
    handleUserTurn(TOPICS[topic].label);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    handleUserTurn(text);
  });

  // ============================ Greeting on load ============================
  botReply("Hey, welcome in. First year is a lot — courses, time, money, friends, getting involved, health, internships. I can help you think through any of it. Tap a topic above or just tell me what's on your mind. <strong>(I'm a friendly helper, not an official advisor or counselor — for the big official stuff, I'll point you to the right professional.)</strong>");
})();
