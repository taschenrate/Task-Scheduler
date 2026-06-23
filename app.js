const STORAGE_KEY = "taskflow_planner_v2";

const state = {
  data: loadData(),
  filter: "all",
  selectedBranch: "all",
  editing: null
};

const $ = (id) => document.getElementById(id);

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }

  const now = Date.now();
  return {
    branches: [
      {
        id: uid(),
        name: "Сервер Minecraft",
        emoji: "🎮",
        createdAt: now,
        topics: [
          {
            id: uid(),
            name: "Сайт и донат",
            createdAt: now,
            tasks: [
              createTask("Подключить домен", "Проверить DNS, www, почту, Cloudflare.", "high"),
              createTask("Подготовить магазин", "Tebex / CraftingStore / своя платежка.", "mid")
            ]
          },
          {
            id: uid(),
            name: "Сборка",
            createdAt: now,
            tasks: [
              createTask("Проверить моды", "Проверить на ESP, инвиз, опасные функции и краши.", "high")
            ]
          }
        ]
      },
      {
        id: uid(),
        name: "Учеба",
        emoji: "📚",
        createdAt: now,
        topics: [
          {
            id: uid(),
            name: "Повторение",
            createdAt: now,
            tasks: [
              createTask("Повторить физику", "Термины, формулы, типовые задания.", "mid")
            ]
          }
        ]
      }
    ]
  };
}

function createTask(title, note = "", priority = "mid", date = "") {
  return {
    id: uid(),
    title,
    note,
    priority,
    date,
    done: false,
    createdAt: Date.now()
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  render();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function allTasks() {
  return state.data.branches.flatMap(branch =>
    branch.topics.flatMap(topic =>
      topic.tasks.map(task => ({ branch, topic, task }))
    )
  );
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

function matchesFilter(item) {
  const { task, branch } = item;
  if (state.selectedBranch !== "all" && branch.id !== state.selectedBranch) return false;
  if (state.filter === "today") return isToday(task.date);
  if (state.filter === "active") return !task.done;
  if (state.filter === "done") return task.done;
  if (state.filter === "important") return task.priority === "high";
  return true;
}

function matchesSearch(item) {
  const q = $("searchInput").value.trim().toLowerCase();
  if (!q) return true;
  const { branch, topic, task } = item;
  return [branch.name, topic.name, task.title, task.note, task.priority, task.date]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function sortedItems(items) {
  const mode = $("sortSelect").value;
  const score = { high: 3, mid: 2, low: 1 };

  return [...items].sort((a, b) => {
    if (mode === "priority") return score[b.task.priority] - score[a.task.priority];
    if (mode === "date") return (a.task.date || "9999-99-99").localeCompare(b.task.date || "9999-99-99");
    if (mode === "branch") return a.branch.name.localeCompare(b.branch.name);
    return b.task.createdAt - a.task.createdAt;
  });
}

function groupedData() {
  const visibleItems = sortedItems(allTasks().filter(matchesFilter).filter(matchesSearch));
  const branchMap = new Map();

  for (const item of visibleItems) {
    if (!branchMap.has(item.branch.id)) {
      branchMap.set(item.branch.id, { branch: item.branch, topics: new Map() });
    }
    const branchGroup = branchMap.get(item.branch.id);
    if (!branchGroup.topics.has(item.topic.id)) {
      branchGroup.topics.set(item.topic.id, { topic: item.topic, tasks: [] });
    }
    branchGroup.topics.get(item.topic.id).tasks.push(item.task);
  }

  return [...branchMap.values()].map(group => ({
    branch: group.branch,
    topics: [...group.topics.values()]
  }));
}

function render() {
  renderHeader();
  renderSidebar();
  renderWorkspace();
}

function renderHeader() {
  const items = allTasks();
  $("dateLine").textContent = new Date().toLocaleDateString("ru-RU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  $("pageTitle").textContent = ({
    all: "Все задачи",
    today: "Задачи на сегодня",
    active: "Активные задачи",
    done: "Выполненные задачи",
    important: "Важные задачи"
  })[state.filter] || "Планировщик";

  $("totalCount").textContent = items.length;
  $("activeCount").textContent = items.filter(x => !x.task.done).length;
  $("doneCount").textContent = items.filter(x => x.task.done).length;
  $("importantCount").textContent = items.filter(x => x.task.priority === "high").length;

  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === state.filter);
  });
}

function renderSidebar() {
  $("branchList").innerHTML = `
    <button class="branch-chip ${state.selectedBranch === "all" ? "active" : ""}" data-branch="all">
      <span>🌐 Все ветки</span><span>${allTasks().length}</span>
    </button>
    ${state.data.branches.map(branch => {
      const count = branch.topics.reduce((s, t) => s + t.tasks.length, 0);
      return `
        <button class="branch-chip ${state.selectedBranch === branch.id ? "active" : ""}" data-branch="${branch.id}">
          <span>${escapeHtml(branch.emoji || "🌿")} ${escapeHtml(branch.name)}</span>
          <span>${count}</span>
        </button>
      `;
    }).join("")}
  `;

  document.querySelectorAll("[data-branch]").forEach(btn => {
    btn.onclick = () => {
      state.selectedBranch = btn.dataset.branch;
      closeSidebar();
      render();
    };
  });
}

function renderWorkspace() {
  const groups = groupedData();

  if (!groups.length) {
    $("workspace").innerHTML = `
      <div class="empty">
        Ничего не найдено. Создай новую ветку, тему или задачу.
      </div>
    `;
    return;
  }

  $("workspace").innerHTML = groups.map(({ branch, topics }) => `
    <article class="branch-card">
      <div class="branch-head">
        <div class="branch-name">
          <div class="emoji">${escapeHtml(branch.emoji || "🌿")}</div>
          <div>
            <h3>${escapeHtml(branch.name)}</h3>
            <p>${topics.reduce((s, t) => s + t.tasks.length, 0)} задач · ${topics.length} тем</p>
          </div>
        </div>
        <div class="branch-actions">
          <button class="ghost" onclick="openTopicModal('${branch.id}')">+ Тема</button>
          <button class="ghost" onclick="openBranchModal('${branch.id}')">Изм.</button>
          <button class="ghost danger" onclick="deleteBranch('${branch.id}')">Удалить</button>
        </div>
      </div>

      <div class="topics">
        ${topics.map(({ topic, tasks }) => `
          <section class="topic-card">
            <div class="topic-head">
              <h4>📁 ${escapeHtml(topic.name)}</h4>
              <div class="topic-actions">
                <button class="ghost" onclick="openTaskModal('${branch.id}','${topic.id}')">+ Задача</button>
                <button class="ghost" onclick="openTopicModal('${branch.id}','${topic.id}')">Изм.</button>
                <button class="ghost danger" onclick="deleteTopic('${branch.id}','${topic.id}')">×</button>
              </div>
            </div>

            <div class="tasks">
              ${tasks.map(task => renderTask(branch, topic, task)).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderTask(branch, topic, task) {
  return `
    <div class="task ${task.done ? "done" : ""}">
      <button class="check" onclick="toggleTask('${branch.id}','${topic.id}','${task.id}')">✓</button>
      <div class="task-main">
        <b>${escapeHtml(task.title)}</b>
        ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ""}
        <div class="meta">
          <span class="badge ${task.priority}">${priorityLabel(task.priority)}</span>
          ${task.date ? `<span class="badge">до ${escapeHtml(task.date)}</span>` : ""}
          <span class="badge">${escapeHtml(branch.name)}</span>
          <span class="badge">${escapeHtml(topic.name)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="tiny" onclick="openTaskModal('${branch.id}','${topic.id}','${task.id}')">Изм.</button>
        <button class="tiny danger" onclick="deleteTask('${branch.id}','${topic.id}','${task.id}')">×</button>
      </div>
    </div>
  `;
}

function priorityLabel(p) {
  return p === "high" ? "Важно" : p === "low" ? "Легко" : "Средне";
}

function setFilter(filter) {
  state.filter = filter;
  render();
}

function showModal(title, formHtml) {
  $("modalTitle").textContent = title;
  $("modalForm").innerHTML = formHtml;
  $("modal").classList.add("show");
}

function hideModal() {
  $("modal").classList.remove("show");
  $("modalForm").innerHTML = "";
  state.editing = null;
}

function openBranchModal(branchId = null) {
  const branch = branchId ? state.data.branches.find(b => b.id === branchId) : null;
  state.editing = { type: "branch", branchId };

  showModal(branch ? "Редактировать ветку" : "Новая ветка", `
    <input name="emoji" placeholder="Эмодзи" value="${escapeHtml(branch?.emoji || "🌿")}" />
    <input name="name" placeholder="Название ветки" value="${escapeHtml(branch?.name || "")}" required />
    <div class="form-actions">
      <button type="button" class="ghost full" onclick="hideModal()">Отмена</button>
      <button class="primary full">Сохранить</button>
    </div>
  `);
}

function openTopicModal(branchId, topicId = null) {
  const branch = state.data.branches.find(b => b.id === branchId) || state.data.branches[0];
  const topic = topicId ? branch.topics.find(t => t.id === topicId) : null;
  state.editing = { type: "topic", branchId: branch.id, topicId };

  showModal(topic ? "Редактировать тему" : "Новая тема", `
    <select name="branchId">
      ${state.data.branches.map(b => `<option value="${b.id}" ${b.id === branch.id ? "selected" : ""}>${escapeHtml(b.emoji)} ${escapeHtml(b.name)}</option>`).join("")}
    </select>
    <input name="name" placeholder="Название темы" value="${escapeHtml(topic?.name || "")}" required />
    <div class="form-actions">
      <button type="button" class="ghost full" onclick="hideModal()">Отмена</button>
      <button class="primary full">Сохранить</button>
    </div>
  `);
}

function openTaskModal(branchId = null, topicId = null, taskId = null) {
  let branch = state.data.branches.find(b => b.id === branchId) || state.data.branches[0];
  if (!branch) {
    toast("Сначала создай ветку");
    return;
  }
  let topic = branch.topics.find(t => t.id === topicId) || branch.topics[0];
  if (!topic) {
    toast("Сначала создай тему");
    return;
  }

  const task = taskId ? topic.tasks.find(t => t.id === taskId) : null;
  state.editing = { type: "task", branchId: branch.id, topicId: topic.id, taskId };

  showModal(task ? "Редактировать задачу" : "Новая задача", `
    <select name="branchId" id="formBranch" onchange="refreshTopicOptions()">
      ${state.data.branches.map(b => `<option value="${b.id}" ${b.id === branch.id ? "selected" : ""}>${escapeHtml(b.emoji)} ${escapeHtml(b.name)}</option>`).join("")}
    </select>
    <select name="topicId" id="formTopic" data-selected="${topic.id}"></select>
    <input name="title" placeholder="Название задачи" value="${escapeHtml(task?.title || "")}" required />
    <textarea name="note" placeholder="Описание / детали">${escapeHtml(task?.note || "")}</textarea>
    <div class="form-row">
      <select name="priority">
        <option value="low" ${task?.priority === "low" ? "selected" : ""}>Легко</option>
        <option value="mid" ${!task || task.priority === "mid" ? "selected" : ""}>Средне</option>
        <option value="high" ${task?.priority === "high" ? "selected" : ""}>Важно</option>
      </select>
      <input name="date" type="date" value="${escapeHtml(task?.date || "")}" />
    </div>
    <div class="form-actions">
      <button type="button" class="ghost full" onclick="hideModal()">Отмена</button>
      <button class="primary full">Сохранить</button>
    </div>
  `);

  refreshTopicOptions();
}

function refreshTopicOptions() {
  const branchId = $("formBranch").value;
  const branch = state.data.branches.find(b => b.id === branchId);
  const selected = $("formTopic").dataset.selected;
  $("formTopic").innerHTML = branch.topics.map(t => `
    <option value="${t.id}" ${t.id === selected ? "selected" : ""}>${escapeHtml(t.name)}</option>
  `).join("");
}

function handleFormSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const edit = state.editing;

  if (edit.type === "branch") {
    const existing = edit.branchId ? state.data.branches.find(b => b.id === edit.branchId) : null;
    if (existing) {
      existing.name = fd.get("name").trim();
      existing.emoji = fd.get("emoji").trim() || "🌿";
    } else {
      state.data.branches.push({
        id: uid(),
        name: fd.get("name").trim(),
        emoji: fd.get("emoji").trim() || "🌿",
        createdAt: Date.now(),
        topics: []
      });
    }
  }

  if (edit.type === "topic") {
    const oldBranch = state.data.branches.find(b => b.id === edit.branchId);
    const newBranch = state.data.branches.find(b => b.id === fd.get("branchId"));
    const existing = edit.topicId ? oldBranch.topics.find(t => t.id === edit.topicId) : null;

    if (existing) {
      existing.name = fd.get("name").trim();
      if (oldBranch.id !== newBranch.id) {
        oldBranch.topics = oldBranch.topics.filter(t => t.id !== existing.id);
        newBranch.topics.push(existing);
      }
    } else {
      newBranch.topics.push({
        id: uid(),
        name: fd.get("name").trim(),
        createdAt: Date.now(),
        tasks: []
      });
    }
  }

  if (edit.type === "task") {
    const oldBranch = state.data.branches.find(b => b.id === edit.branchId);
    const oldTopic = oldBranch.topics.find(t => t.id === edit.topicId);
    const newBranch = state.data.branches.find(b => b.id === fd.get("branchId"));
    const newTopic = newBranch.topics.find(t => t.id === fd.get("topicId"));

    const payload = {
      id: edit.taskId || uid(),
      title: fd.get("title").trim(),
      note: fd.get("note").trim(),
      priority: fd.get("priority"),
      date: fd.get("date"),
      done: false,
      createdAt: Date.now()
    };

    if (edit.taskId) {
      const idx = oldTopic.tasks.findIndex(t => t.id === edit.taskId);
      const previous = oldTopic.tasks[idx];
      payload.done = previous.done;
      payload.createdAt = previous.createdAt;
      oldTopic.tasks.splice(idx, 1);
    }

    newTopic.tasks.push(payload);
  }

  hideModal();
  persist();
  toast("Сохранено");
}

function toggleTask(branchId, topicId, taskId) {
  const task = findTask(branchId, topicId, taskId);
  task.done = !task.done;
  persist();
}

function deleteTask(branchId, topicId, taskId) {
  if (!confirm("Удалить задачу?")) return;
  const topic = findTopic(branchId, topicId);
  topic.tasks = topic.tasks.filter(t => t.id !== taskId);
  persist();
}

function deleteTopic(branchId, topicId) {
  if (!confirm("Удалить тему со всеми задачами?")) return;
  const branch = state.data.branches.find(b => b.id === branchId);
  branch.topics = branch.topics.filter(t => t.id !== topicId);
  persist();
}

function deleteBranch(branchId) {
  if (!confirm("Удалить ветку со всеми темами и задачами?")) return;
  state.data.branches = state.data.branches.filter(b => b.id !== branchId);
  if (state.selectedBranch === branchId) state.selectedBranch = "all";
  persist();
}

function findTopic(branchId, topicId) {
  return state.data.branches.find(b => b.id === branchId).topics.find(t => t.id === topicId);
}

function findTask(branchId, topicId, taskId) {
  return findTopic(branchId, topicId).tasks.find(t => t.id === taskId);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `taskflow-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.branches || !Array.isArray(imported.branches)) throw new Error("bad format");
      state.data = imported;
      persist();
      toast("Импортировано");
    } catch {
      toast("Не удалось импортировать файл");
    }
  };
  reader.readAsText(file);
}

function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 1800);
}

function openSidebar() {
  document.querySelector(".sidebar").classList.add("open");
}

function closeSidebar() {
  document.querySelector(".sidebar").classList.remove("open");
}

function initEvents() {
  $("quickAddTask").onclick = () => openTaskModal();
  $("addTaskBtn").onclick = () => openTaskModal();
  $("mobileAdd").onclick = () => openTaskModal();
  $("addBranchBtn").onclick = () => openBranchModal();
  $("closeModal").onclick = hideModal;
  $("modal").onclick = (e) => { if (e.target.id === "modal") hideModal(); };
  $("modalForm").onsubmit = handleFormSubmit;
  $("searchInput").oninput = render;
  $("sortSelect").onchange = render;
  $("exportBtn").onclick = exportData;
  $("importFile").onchange = (e) => e.target.files[0] && importData(e.target.files[0]);
  $("mobileMenuBtn").onclick = openSidebar;

  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.onclick = () => {
      setFilter(btn.dataset.filter);
      closeSidebar();
    };
  });
}

initEvents();
render();
