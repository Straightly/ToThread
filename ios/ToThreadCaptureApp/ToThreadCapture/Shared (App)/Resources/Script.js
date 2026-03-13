// ===== Platform & Extension Setup =====

function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);

    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('platform-mac state-on')[0].innerText = "ToThreadCapture's extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac state-off')[0].innerText = "ToThreadCapture's extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac state-unknown')[0].innerText = "You can turn on ToThreadCapture's extension in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

const openPreferencesBtn = document.querySelector("button.platform-mac.open-preferences");
if (openPreferencesBtn) {
    openPreferencesBtn.addEventListener("click", openPreferences);
}

// ===== Plan Viewer Setup (iOS) =====

let authToken = null;
let currentPlanData = null;
let showFinishedTasks = true;
const BACKEND_BASE = "https://tothread-webapp.zhian-job.workers.dev";
const planIndex = new Map();
let navigationStack = [];
const DEBUG = false;
let emptyLoadRetry = false;
let lastLoadState = "idle"; // idle | loading | loaded | error
let lastLoadMessage = "";

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.oauthHandler) {
        document.body.classList.add("platform-ios");
        const planSection = document.getElementById("plan-section");
        if (planSection) {
            planSection.style.display = "block";
        }
    }

    if (document.body.classList.contains("platform-ios")) {
        retrieveStoredToken();
    }
    wirePlanUiHandlers();
    updateUIForAuth();
});

// ===== Google OAuth & Token Management =====

function startGoogleLogin() {
    // Signal native code to start Google OAuth flow
    webkit.messageHandlers.oauthHandler.postMessage("startGoogleLogin");
}

function setStoredToken(token) {
    authToken = token;
    updateUIForAuth();
}

function onTokenRetrieved(token) {
    if (token) {
        authToken = token;
        updateUIForAuth();
    }
}

function retrieveStoredToken() {
    webkit.messageHandlers.oauthHandler.postMessage("getStoredToken");
}

function updateUIForAuth() {
    const loginSection = document.getElementById("plan-login");
    const viewSection = document.getElementById("plan-view");
    const planSection = document.getElementById("plan-section");

    if (!loginSection || !viewSection || !planSection) {
        setTimeout(updateUIForAuth, 50);
        return;
    }

    if (authToken) {
        loginSection.style.display = "none";
        viewSection.style.display = "block";
        planSection.style.display = "block";
        loadPlanData();
    } else {
        loginSection.style.display = "block";
        viewSection.style.display = "none";
        planSection.style.display = "block";
    }
}

function logout() {
    authToken = null;
    webkit.messageHandlers.oauthHandler.postMessage("clearToken");
    document.getElementById("plan-login").style.display = "block";
    document.getElementById("plan-view").style.display = "none";
}

function onTokenCleared() {
    // UI already updated in logout()
}

// ===== Plan API Calls =====

async function apiCall(endpoint, method = "GET", body = null) {
    if (!authToken) {
        throw new Error("Not authenticated");
    }

    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${authToken}`,
            "Content-Type": "application/json"
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BACKEND_BASE}${endpoint}`, options);

    if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error("Authentication failed");
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    if (endpoint === "/plan") {
        return response.text();
    }

    return response.json();
}

async function loadPlanData() {
    if (!authToken) {
        return;
    }

    const container = document.getElementById("tasks-container");
    const loading = document.getElementById("loading");
    const errorDiv = document.getElementById("plan-error");

    if (!container || !loading || !errorDiv) {
        setTimeout(loadPlanData, 50);
        return;
    }

    try {
        lastLoadState = "loading";
        lastLoadMessage = "";
        errorDiv.style.display = "none";
        loading.style.display = "block";
        container.innerHTML = "";

        const raw = await promiseWithTimeout(apiCall("/plan"), 6000, "Load timed out");
        const data = parseYaml(raw);
        currentPlanData = data;
        planIndex.clear();
        navigationStack = [];
        const rootTasks = getRootTasksFromData(data);
        indexTasks(rootTasks);
        const hasTasksMarker = /(^|\n)(tasks|sections):/m.test(raw);
        if (!rootTasks.length && hasTasksMarker) {
            lastLoadState = "error";
            lastLoadMessage = "Load incomplete. Tap Refresh.";
            showError(lastLoadMessage);
        } else {
            lastLoadState = "loaded";
            renderCurrentLevel();
        }
        updateLastSyncTime();
        updatePlanStatus(rootTasks, data, raw);
        if (!rootTasks.length && !emptyLoadRetry && /(^|\\n)(tasks|sections):/m.test(raw)) {
            emptyLoadRetry = true;
            setTimeout(() => {
                loadPlanData();
            }, 400);
        }
    } catch (error) {
        if (error.message === "Authentication failed") {
            return;
        }
        lastLoadState = "error";
        lastLoadMessage = error.message || "Load failed";
        showError(error.message);
    } finally {
        loading.style.display = "none";
    }
}

function renderCurrentLevel() {
    const container = document.getElementById("tasks-container");
    const taskList = document.getElementById("task-list") || container;
    const backBtn = document.getElementById("back-btn");
    const levelLabel = document.getElementById("current-level");

    taskList.innerHTML = "";

    const { tasks, parent } = getTasksAtCurrentLevel();

    if (backBtn) {
        backBtn.disabled = navigationStack.length === 0;
    }

    if (levelLabel) {
        levelLabel.textContent = parent ? parent.title : "Root";
    }

    if (lastLoadState === "loading") {
        const loadingRow = document.createElement("div");
        loadingRow.style.cssText = "padding: 12px; color: #777; text-align: center;";
        loadingRow.textContent = "Loading tasks...";
        taskList.appendChild(loadingRow);
        return;
    }

    if (lastLoadState === "error" && lastLoadMessage) {
        const errorRow = document.createElement("div");
        errorRow.style.cssText = "padding: 12px; color: #b42318; text-align: center;";
        errorRow.textContent = lastLoadMessage;
        taskList.appendChild(errorRow);
        return;
    }

    if (!tasks.length) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding: 12px; color: #777; text-align: center;";
        empty.textContent = "No tasks at this level.";
        taskList.appendChild(empty);
        return;
    }

    tasks.forEach(task => {
        if (!task) return;
        if (!showFinishedTasks && isDone(task)) return;

        const row = document.createElement("div");
        row.style.cssText = `
            padding: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const titleSpan = document.createElement("span");
        titleSpan.textContent = task.title || task.name || task.id || "(Untitled)";
        titleSpan.style.flex = "1";
        if (isDone(task)) {
            titleSpan.style.textDecoration = "line-through";
            titleSpan.style.color = "#999";
        }
        titleSpan.style.cursor = "pointer";
        titleSpan.addEventListener("click", (event) => {
            event.stopPropagation();
            showTaskDetails(task);
        });
        row.appendChild(titleSpan);

        const children = Array.isArray(task.tasks) ? task.tasks : (Array.isArray(task.subtasks) ? task.subtasks : []);
        const childCount = children.length;
        const unfinishedCount = children.filter(t => !isDone(t)).length;
        if (childCount > 0) {
            const childBadge = document.createElement("span");
            childBadge.textContent = `${unfinishedCount}/${childCount}`;
            const badgeColor = unfinishedCount > 0 ? "#b42318" : "#175cd3";
            childBadge.style.cssText = `font-size: 12px; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: ${badgeColor};`;
            row.appendChild(childBadge);
        }

        if (!isDone(task) && unfinishedCount === 0 && !isContinuous(task)) {
            const doneBtn = document.createElement("button");
            doneBtn.textContent = "Done";
            doneBtn.style.cssText = "padding: 4px 8px; font-size: 12px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;";
            doneBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                markTaskDone(task.id);
            });
            row.appendChild(doneBtn);
        }

        attachSwipeHandlers(row, task, childCount);

        row.addEventListener("click", () => {
            // Row click is reserved for future selection behavior.
        });

        taskList.appendChild(row);
    });
}

async function markTaskDone(taskId) {
    try {
        const task = planIndex.get(taskId);
        if (!task) throw new Error("Task not found locally");
        const next = { ...task, status: "Done" };
        await apiCall(`/plan/tasks/${taskId}`, "PUT", { task: next });
        loadPlanData();
    } catch (error) {
        showError(`Failed to mark task done: ${error.message}`);
    }
}

function showTaskDetails(task) {
    alert(`Task: ${task.title}\nStatus: ${task.status}\nID: ${task.id}\n\nFull details editing coming soon.`);
}

async function addTopLevelTask() {
    const title = prompt("Enter task title:");
    if (!title) return;

    try {
        const result = await apiCall("/plan/tasks", "POST", { parentId: null, task: { title, status: "Pending" } });
        if (result && result.task) {
            insertTaskIntoPlan(null, result.task);
            navigationStack = [];
            renderCurrentLevel();
            updateLastSyncTime();
        } else {
            loadPlanData();
        }
    } catch (error) {
        showError(`Failed to add task: ${error.message}`);
    }
}

async function addSubtask(parentId) {
    const title = prompt("Enter subtask title:");
    if (!title) return;

    try {
        const result = await apiCall("/plan/tasks", "POST", { parentId, task: { title, status: "Pending" } });
        if (result && result.task) {
            insertTaskIntoPlan(parentId, result.task);
            renderCurrentLevel();
            updateLastSyncTime();
        } else {
            loadPlanData();
        }
    } catch (error) {
        showError(`Failed to add subtask: ${error.message}`);
    }
}

async function deleteTask(taskId) {
    const confirmed = confirm("Delete this task?");
    if (!confirmed) return;

    try {
        await apiCall(`/plan/tasks/${taskId}`, "DELETE");
        loadPlanData();
    } catch (error) {
        showError(`Failed to delete task: ${error.message}`);
    }
}

async function refreshPlan() {
    loadPlanData();
}

function toggleShowFinished() {
    showFinishedTasks = document.getElementById("show-finished-toggle").checked;
    if (currentPlanData) {
        renderCurrentLevel();
    }
}

function updateLastSyncTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    document.getElementById("last-sync").textContent = timeStr;
}

function promiseWithTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(message));
        }, ms);
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

function updatePlanStatus(rootTasks, data, raw) {
    if (!DEBUG) return;
    const statusEl = document.getElementById("plan-status");
    if (!statusEl) return;
    if (!Array.isArray(rootTasks)) {
        statusEl.textContent = "No root task list found";
        return;
    }
    const keys = data && typeof data === "object" ? Object.keys(data) : [];
    const rawPreview = typeof raw === "string" ? raw.split(/\r?\n/).slice(0, 2).join(" | ") : "";
    const rawLen = typeof raw === "string" ? raw.length : 0;
    statusEl.textContent = `Loaded ${rootTasks.length} root tasks (keys: ${keys.join(", ")}; rawLen: ${rawLen}; preview: ${rawPreview})`;
}

function showError(message) {
    const errorDiv = document.getElementById("plan-error");
    const errorMsg = document.getElementById("error-message");
    if (errorMsg) {
        errorMsg.textContent = message;
    }
    if (errorDiv) {
        errorDiv.style.display = "block";
    }
    const loading = document.getElementById("loading");
    if (loading) {
        loading.textContent = message;
    }
    if (DEBUG) {
        const statusEl = document.getElementById("plan-status");
        if (statusEl) {
            statusEl.textContent = message;
        }
    }
}

function indexTasks(tasks) {
    for (const task of tasks) {
        if (!task || !task.id) continue;
        planIndex.set(task.id, task);
        const children = Array.isArray(task.tasks) ? task.tasks : (Array.isArray(task.subtasks) ? task.subtasks : []);
        if (children.length) {
            indexTasks(children);
        }
    }
}

function attachSwipeHandlers(row, task, childCount) {
    let startX = 0;
    let startY = 0;
    let handled = false;
    const threshold = 40;

    row.addEventListener("touchstart", (event) => {
        if (!event.touches || event.touches.length !== 1) return;
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        handled = false;
    }, { passive: true });

    row.addEventListener("touchend", (event) => {
        if (handled || !event.changedTouches || event.changedTouches.length !== 1) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) {
            return;
        }
        handled = true;
        if (dx > 0) {
            // Swipe right: open subtasks if any, otherwise add a subtask.
            if (childCount > 0) {
                navigateToTask(task);
            } else {
                addSubtask(task.id);
            }
        } else {
            // Swipe left: delete task.
            deleteTask(task.id);
        }
    }, { passive: true });
}

function getRootTaskList() {
    if (!currentPlanData || typeof currentPlanData !== "object") {
        currentPlanData = {};
    }
    const root = getRootTasksFromData(currentPlanData);
    if (Array.isArray(currentPlanData.sections)) return currentPlanData.sections;
    if (Array.isArray(currentPlanData.tasks)) return currentPlanData.tasks;
    currentPlanData.tasks = root;
    return currentPlanData.tasks;
}

function insertTaskIntoPlan(parentId, task) {
    if (!task || !task.id) return;
    planIndex.set(task.id, task);

    if (!parentId) {
        const root = getRootTaskList();
        root.push(task);
        return;
    }

    const parent = planIndex.get(parentId);
    if (!parent) {
        loadPlanData();
        return;
    }
    if (!Array.isArray(parent.tasks)) parent.tasks = [];
    parent.tasks.push(task);
}

function getTasksAtCurrentLevel() {
    const rootTasks = getRootTasksFromData(currentPlanData);
    if (!navigationStack.length) {
        return { tasks: Array.isArray(rootTasks) ? rootTasks : [], parent: null };
    }

    let tasks = Array.isArray(rootTasks) ? rootTasks : [];
    let parent = null;

    for (const taskId of navigationStack) {
        parent = tasks.find(t => t && t.id === taskId) || planIndex.get(taskId);
        tasks = Array.isArray(parent?.tasks)
            ? parent.tasks
            : (Array.isArray(parent?.subtasks) ? parent.subtasks : []);
    }

    return { tasks, parent };
}

function isTaskLike(value) {
    if (!value || typeof value !== "object") return false;
    return (
        "title" in value ||
        "id" in value ||
        "status" in value ||
        "tasks" in value ||
        "subtasks" in value
    );
}

function getRootTasksFromData(data) {
    if (!data || typeof data !== "object") return [];
    const candidates = ["sections", "tasks"];
    for (const key of candidates) {
        const value = data[key];
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") {
            const values = Object.values(value).filter(isTaskLike);
            if (values.length) return values;
        }
    }
    return [];
}

function navigateToTask(task) {
    if (!task || !task.id) return;
    navigationStack.push(task.id);
    renderCurrentLevel();
}

function navigateBack() {
    if (navigationStack.length === 0) return;
    navigationStack.pop();
    renderCurrentLevel();
}

function isDone(task) {
    return String(task?.status || "").toLowerCase() === "done";
}

function isContinuous(task) {
    return String(task?.status || "").toLowerCase() === "continuous";
}

function parseInlineArray(value) {
    const inner = value.trim().slice(1, -1);
    if (!inner.trim()) return [];
    return inner.split(",").map((part) => parseScalar(part));
}

function nextNonEmptyLine(lines, startIndex) {
    for (let i = startIndex; i < lines.length; i += 1) {
        const line = lines[i];
        if (line && line.trim() && !line.trim().startsWith("#")) return line;
    }
    return null;
}

function parseYaml(text) {
    const lines = text.split(/\r?\n/);
    const root = {};
    const stack = [{ indent: -1, container: root, type: "object" }];

    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i];
        if (!raw) continue;
        if (!raw.trim() || raw.trim().startsWith("#")) continue;
        const indent = raw.match(/^ */)[0].length;
        const line = raw.trim();

        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
            stack.pop();
        }

        const ctx = stack[stack.length - 1];

        if (line.startsWith("- ")) {
            if (ctx.type !== "array") {
                ctx.container = [];
                ctx.type = "array";
                if (stack.length > 1) {
                    const parent = stack[stack.length - 2];
                    const key = parent.pendingKey;
                    if (key) {
                        parent.container[key] = ctx.container;
                        delete parent.pendingKey;
                    }
                }
            }
            const itemText = line.slice(2);
            if (itemText.includes(":")) {
                const [k, ...rest] = itemText.split(":");
                const key = k.trim();
                const value = rest.join(":").trim();
                const obj = {};
                if (value) {
                    obj[key] = value.startsWith("[") && value.endsWith("]")
                        ? parseInlineArray(value)
                        : parseScalar(value);
                } else {
                    obj[key] = {};
                    obj.pendingKey = key;
                }
                ctx.container.push(obj);
                stack.push({ indent, container: obj, type: "object" });
            } else {
                ctx.container.push(parseScalar(itemText));
            }
            continue;
        }

        const [k, ...rest] = line.split(":");
        const key = k.trim();
        const value = rest.join(":").trim();
        if (value) {
            ctx.container[key] = value.startsWith("[") && value.endsWith("]")
                ? parseInlineArray(value)
                : parseScalar(value);
        } else {
            const lookahead = nextNonEmptyLine(lines, i + 1);
            const willBeArray = lookahead ? lookahead.trim().startsWith("- ") : false;
            ctx.container[key] = willBeArray ? [] : {};
            ctx.pendingKey = key;
            stack.push({ indent, container: ctx.container[key], type: willBeArray ? "array" : "object" });
        }
    }

    return root;
}

function parseScalar(value) {
    const trimmed = value.trim();
    if (trimmed === "") return "";
    if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
    }
    return trimmed;
}

function wirePlanUiHandlers() {
    const loginBtn = document.getElementById("google-login-btn");
    const refreshBtn = document.getElementById("refresh-btn");
    const addBtn = document.getElementById("add-task-btn");
    const showFinished = document.getElementById("show-finished-toggle");
    const logoutBtn = document.getElementById("logout-btn");
    const backBtn = document.getElementById("back-btn");

    if (loginBtn) loginBtn.addEventListener("click", startGoogleLogin);
    if (refreshBtn) refreshBtn.addEventListener("click", refreshPlan);
    if (addBtn) addBtn.addEventListener("click", addTopLevelTask);
    if (showFinished) showFinished.addEventListener("change", toggleShowFinished);
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
    if (backBtn) backBtn.addEventListener("click", navigateBack);
}
