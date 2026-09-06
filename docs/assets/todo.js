/* To-Do List app — only runs on the Projects page.
   Stores tasks in Supabase with a localStorage cache and a graceful
   offline fallback (if Supabase is unavailable, edits stay local). */

(function () {
  "use strict";

  var STORAGE_KEY = "jordan-todo";
  var form = document.getElementById("todoForm");
  if (!form) return; // not on the projects page

  var input = document.getElementById("todoInput");
  var dateInput = document.getElementById("todoDate");
  var list = document.getElementById("todoList");
  var empty = document.getElementById("todoEmpty");
  var footer = document.getElementById("todoFooter");
  var countEl = document.getElementById("todoCount");
  var clearBtn = document.getElementById("todoClear");
  var statusEl = document.getElementById("todoStatus");

  var TABLE = "tasks";
  var sb = null;
  if (window.supabase && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
    try {
      sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    } catch (e) { sb = null; }
  }

  var tasks = loadCached();

  function loadCached() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function cacheTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) { /* storage may be unavailable; fail silently */ }
  }

  function setStatus(state, label) {
    if (!statusEl) return;
    statusEl.setAttribute("data-state", state);
    statusEl.textContent = label;
  }

  function formatDate(s) {
    if (!s) return "";
    var d = new Date(s + "T00:00:00");
    if (isNaN(d)) return "";
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[d.getMonth()] + " " + d.getDate();
  }

  function isOverdue(s) {
    if (!s) return false;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var d = new Date(s + "T00:00:00");
    return d < today;
  }

  // Incomplete first, then by date ascending (tasks with no date sink to the bottom of each group)
  function sortTasks(arr) {
    return arr.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function render() {
    list.innerHTML = "";
    var sorted = sortTasks(tasks);

    if (!sorted.length) {
      empty.style.display = "";
      footer.hidden = true;
      return;
    }
    empty.style.display = "none";
    footer.hidden = false;

    sorted.forEach(function (task) {
      var li = document.createElement("li");
      li.className = "todo-item" +
        (task.done ? " done" : "") +
        (isOverdue(task.date) && !task.done ? " todo-overdue" : "");

      var check = document.createElement("input");
      check.type = "checkbox";
      check.className = "todo-check";
      check.checked = task.done;
      check.setAttribute("aria-label", "Mark task done");
      check.addEventListener("change", function () { toggleTask(task.id); });

      var span = document.createElement("span");
      span.className = "todo-text";
      span.textContent = task.text;

      li.appendChild(check);
      li.appendChild(span);

      if (task.date) {
        var badge = document.createElement("span");
        badge.className = "todo-date";
        badge.textContent = formatDate(task.date);
        li.appendChild(badge);
      }

      var del = document.createElement("button");
      del.type = "button";
      del.className = "todo-delete";
      del.setAttribute("aria-label", "Delete task");
      del.innerHTML = "&times;";
      del.addEventListener("click", function () { deleteTask(task.id); });
      li.appendChild(del);

      list.appendChild(li);
    });

    var remaining = tasks.filter(function (t) { return !t.done; }).length;
    countEl.textContent = remaining + " of " + tasks.length + " left";
  }

  // ---- Supabase row <-> task mapping ----
  function toRow(task) {
    return { id: task.id, text: task.text, date: task.date || null, done: task.done };
  }
  function fromRow(row) {
    return { id: row.id, text: row.text, date: row.date || "", done: !!row.done };
  }

  function syncDone(res) {
    if (res && res.error) setStatus("error", "Offline");
    else setStatus("synced", "Synced");
  }

  // ---- load from Supabase ----
  function loadRemote() {
    if (!sb) return;
    setStatus("syncing", "Syncing");
    sb.from(TABLE).select("id,text,date,done").then(function (res) {
      if (res.error) { setStatus("error", "Offline"); return; }
      tasks = (res.data || []).map(fromRow);
      cacheTasks();
      render();
      setStatus("synced", "Synced");
    }, function () { setStatus("error", "Offline"); });
  }

  // ---- CRUD ----
  function newId() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (e) {}
    return "tmp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addTask(text, date) {
    var task = { id: newId(), text: text, date: date, done: false };
    tasks.push(task);
    cacheTasks();
    render();
    if (sb) {
      setStatus("syncing", "Syncing");
      sb.from(TABLE).insert(toRow(task)).then(syncDone, function () { setStatus("error", "Offline"); });
    }
  }

  function toggleTask(id) {
    var t = tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    t.done = !t.done;
    cacheTasks();
    render();
    if (sb) {
      setStatus("syncing", "Syncing");
      sb.from(TABLE).update({ done: t.done }).eq("id", id).then(syncDone, function () { setStatus("error", "Offline"); });
    }
  }

  function deleteTask(id) {
    tasks = tasks.filter(function (x) { return x.id !== id; });
    cacheTasks();
    render();
    if (sb) {
      setStatus("syncing", "Syncing");
      sb.from(TABLE).delete().eq("id", id).then(syncDone, function () { setStatus("error", "Offline"); });
    }
  }

  function clearDone() {
    var doneIds = tasks.filter(function (t) { return t.done; }).map(function (t) { return t.id; });
    tasks = tasks.filter(function (t) { return !t.done; });
    cacheTasks();
    render();
    if (sb && doneIds.length) {
      setStatus("syncing", "Syncing");
      sb.from(TABLE).delete().in("id", doneIds).then(syncDone, function () { setStatus("error", "Offline"); });
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    addTask(text, dateInput.value);
    input.value = "";
    dateInput.value = "";
    input.focus();
  });

  clearBtn.addEventListener("click", clearDone);

  // initial render from cache, then sync from Supabase
  render();
  if (sb) {
    setStatus("syncing", "Syncing");
    loadRemote();
  } else {
    setStatus("local", "Local");
  }
})();
