/* Personal Website — shared interactions */

(function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      navToggle.classList.toggle("active", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Current year in footer ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ---------- Contact form (front-end only) ---------- */
  var form = document.getElementById("contactForm");
  var success = document.getElementById("formSuccess");

  if (form) {
    var name = form.querySelector("#name");
    var email = form.querySelector("#email");
    var message = form.querySelector("#message");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var valid = true;

      [name, email, message].forEach(function (field) {
        if (!field.value.trim()) {
          valid = false;
          field.style.borderColor = "var(--c-primary)";
        } else {
          field.style.borderColor = "";
        }
      });

      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRe.test(email.value.trim())) {
        valid = false;
        email.style.borderColor = "var(--c-primary)";
      }

      if (!valid) return;

      if (success) success.classList.add("show");
      form.reset();

      setTimeout(function () {
        if (success) success.classList.remove("show");
      }, 5000);
    });
  }

  /* ---------- Resume download button (demo) ---------- */
  var downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", function (e) {
      e.preventDefault();
      var original = downloadBtn.innerHTML;
      downloadBtn.innerHTML = "&#9989; Coming soon!";
      downloadBtn.style.pointerEvents = "none";
      setTimeout(function () {
        downloadBtn.innerHTML = original;
        downloadBtn.style.pointerEvents = "";
      }, 1800);
    });
  }

  /* ---------- Scroll reveal for sections ---------- */
  var revealEls = document.querySelectorAll(
    ".section-head, .highlight-card, .timeline-item, .project-card, .skill-group, .summary-card, .contact-form, .contact-aside"
  );

  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.animation = "fadeUp 0.6s ease both";
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach(function (el) {
      if (!el.classList.contains("reveal")) {
        el.style.opacity = "0";
        io.observe(el);
      }
    });
  }

  /* ---------- To-Do List App (Supabase) ---------- */
  var todoApp = document.getElementById("todoList");
  if (todoApp) {
    var STORAGE_KEY = "portfolio-todos-v1";
    var dateInput = document.getElementById("todoDate");
    var textInput = document.getElementById("todoInput");
    var addBtn = document.getElementById("todoAddBtn");
    var emptyEl = document.getElementById("todoEmpty");
    var counterEl = document.getElementById("todoCounter");
    var emojiBtn = document.getElementById("todoEmojiBtn");
    var emojiPicker = document.getElementById("todoEmojiPicker");

    var EMOJIS = ["📝","💼","🏠","🛒","💪","📚","🎓","💻","🎨","🎯","⏰","💡","🔧","🚗","🏃","💧","📞","💰","🎉","❤️","🔥","⭐","✅","📌","🍔","☕","🧹","🌱","🎁","📅","🔔","📦"];
    var selectedEmoji = "📝";

    // Supabase client (loaded via CDN script on projects.html)
    var SUPABASE_URL = "https://dxutyskppwadhqfffhhp.supabase.co";
    var SUPABASE_KEY = "sb_publishable_KXBNKQ9xEnG-wJrNbpGPnQ_GkEEeR1D";
    var supabase =
      window.supabase && window.supabase.createClient
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;

    var todos = [];

    // Default the date picker to today
    var today = new Date();
    var todayStr =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    if (dateInput) dateInput.value = todayStr;

    /* ---- localStorage helpers (offline fallback) ---- */
    function saveLocal() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      } catch (e) {
        /* ignore quota errors */
      }
    }

    function loadLocal() {
      try {
        var saved = localStorage.getItem(STORAGE_KEY);
        todos = saved ? JSON.parse(saved) || [] : [];
      } catch (e) {
        todos = [];
      }
    }

    /* ---- formatting ---- */
    function formatDate(iso) {
      if (!iso) return "";
      var d = new Date(iso + "T00:00:00");
      if (isNaN(d.getTime())) return iso;
      var opts = { month: "short", day: "numeric" };
      return d.toLocaleDateString(undefined, opts);
    }

    /* ---- render ---- */
    function render() {
      todoApp.innerHTML = "";

      // Task counter: "3 of 5 tasks completed"
      var done = todos.filter(function (t) { return t.is_complete; }).length;
      if (counterEl) {
        if (todos.length === 0) {
          counterEl.textContent = "";
        } else {
          counterEl.textContent = done + " of " + todos.length + " task" + (todos.length === 1 ? "" : "s") + " completed";
        }
      }

      if (todos.length === 0) {
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
      }
      if (emptyEl) emptyEl.classList.add("hidden");

      todos.forEach(function (todo, index) {
        var li = document.createElement("li");
        li.className = "todo-item" + (todo.is_complete ? " done" : "");

        var check = document.createElement("input");
        check.type = "checkbox";
        check.className = "todo-check";
        check.checked = !!todo.is_complete;
        check.setAttribute("aria-label", "Mark task done");
        check.addEventListener("change", function () {
          todos[index].is_complete = check.checked;
          render();
          persistToggle(todo, check.checked);
        });

        var text = document.createElement("span");
        text.className = "todo-text";
        text.textContent = todo.task;

        var badge = document.createElement("span");
        badge.className = "todo-date-badge";
        badge.textContent = formatDate(todo.date);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "todo-delete";
        del.setAttribute("aria-label", "Delete task");
        del.innerHTML = "&times;";
        del.addEventListener("click", function () {
          todos.splice(index, 1);
          render();
          persistDelete(todo);
        });

        li.appendChild(check);
        li.appendChild(text);
        li.appendChild(badge);
        li.appendChild(del);
        todoApp.appendChild(li);
      });
    }

    /* ---- persistence ---- */
    async function loadTodos() {
      if (supabase) {
        try {
          var res = await supabase
            .from("todos")
            .select("*")
            .order("created_at", { ascending: false });
          if (res.error) throw res.error;
          todos = res.data || [];
          // If Supabase returns empty but localStorage has data
          // (e.g. table/RLS not set up yet), fall back to local data.
          if (todos.length === 0) {
            var local = [];
            try {
              var saved = localStorage.getItem(STORAGE_KEY);
              local = saved ? JSON.parse(saved) || [] : [];
            } catch (e) {
              local = [];
            }
            if (local.length > 0) todos = local;
          }
        } catch (e) {
          loadLocal();
        }
      } else {
        loadLocal();
      }
      render();
    }

    async function addTodo() {
      var text = textInput.value.trim();
      var date = dateInput ? dateInput.value : null;
      if (!text) {
        textInput.focus();
        return;
      }

      var fullTask = selectedEmoji + " " + text;
      var newTodo = { id: Date.now(), task: fullTask, date: date, is_complete: false };

      if (supabase) {
        try {
          var res = await supabase
            .from("todos")
            .insert([{ task: fullTask, date: date || null, is_complete: false }])
            .select();
          if (res.error) throw res.error;
          if (res.data && res.data[0]) {
            newTodo = res.data[0];
          }
        } catch (e) {
          /* keep local fallback todo */
        }
      }

      todos.unshift(newTodo);
      saveLocal();
      textInput.value = "";
      render();
      textInput.focus();
    }

    async function persistToggle(todo, done) {
      if (supabase && typeof todo.id === "number") {
        try {
          var res = await supabase.from("todos").update({ is_complete: done }).eq("id", todo.id);
          if (res.error) throw res.error;
        } catch (e) {
          /* fall through to local save */
        }
      }
      saveLocal();
    }

    async function persistDelete(todo) {
      if (supabase && typeof todo.id === "number") {
        try {
          var res = await supabase.from("todos").delete().eq("id", todo.id);
          if (res.error) throw res.error;
        } catch (e) {
          /* fall through to local save */
        }
      }
      saveLocal();
    }

    /* ---- wire up events ---- */
    if (addBtn) addBtn.addEventListener("click", addTodo);
    if (textInput) {
      textInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addTodo();
        }
      });
    }

    /* ---- emoji picker ---- */
    if (emojiPicker && EMOJIS.length) {
      EMOJIS.forEach(function (em) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = em;
        btn.addEventListener("click", function () {
          selectedEmoji = em;
          if (emojiBtn) emojiBtn.textContent = em;
          emojiPicker.hidden = true;
          if (textInput) textInput.focus();
        });
        emojiPicker.appendChild(btn);
      });
    }

    if (emojiBtn && emojiPicker) {
      emojiBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        emojiPicker.hidden = !emojiPicker.hidden;
      });
      document.addEventListener("click", function (e) {
        if (!emojiPicker.hidden && !emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
          emojiPicker.hidden = true;
        }
      });
    }

    loadTodos();
  }
})();
