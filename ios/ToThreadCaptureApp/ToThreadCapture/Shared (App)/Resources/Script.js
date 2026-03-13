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

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("platform-ios")) {
        retrieveStoredToken();
    }
    wirePlanUiHandlers();
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
    const container = document.getElementById("tasks-container");
    const loading = document.getElementById("loading");
    const errorDiv = document.getElementById("plan-error");

    try {
        errorDiv.style.display = "none";
        loading.style.display = "block";
        container.innerHTML = "";

        const raw = await apiCall("/plan");
        const data = parseYaml(raw);
        currentPlanData = data;
        planIndex.clear();
        const rootTasks = data.sections || data.tasks || [];
        indexTasks(rootTasks);
        renderTaskTree(rootTasks, 0);
        updateLastSyncTime();
    } catch (error) {
        showError(error.message);
    } finally {
        loading.style.display = "none";
    }
}

function renderTaskTree(tasks, level = 0) {
    const container = document.getElementById("tasks-container");
    const taskList = document.getElementById("task-list") || container;

    tasks.forEach(task => {
        if (!task) return;
        if (!showFinishedTasks && String(task.status || "").toLowerCase() === "done") return;
        const row = document.createElement("div");
        row.style.cssText = `
            padding: 10px;
            border-bottom: 1px solid #eee;
            margin-left: ${level * 20}px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const children = Array.isArray(task.tasks) ? task.tasks : [];
        const childCount = children.length;
        const doneCount = children.filter(t => String(t.status || "").toLowerCase() === "done").length;

        const titleSpan = document.createElement("span");
        titleSpan.textContent = task.title;
        titleSpan.style.flex = "1";
        if (String(task.status || "").toLowerCase() === "done") {
            titleSpan.style.textDecoration = "line-through";
            titleSpan.style.color = "#999";
        }

        row.appendChild(titleSpan);

        if (childCount > 0) {
            const childBadge = document.createElement("span");
            childBadge.textContent = `${childCount - doneCount}/${childCount}`;
            childBadge.style.cssText = "font-size: 12px; background: #f0f0f0; padding: 2px 6px; border-radius: 3px;";
            row.appendChild(childBadge);
        }

        if (String(task.status || "").toLowerCase() !== "done" && childCount === 0) {
            const doneBtn = document.createElement("button");
            doneBtn.textContent = "✓";
            doneBtn.style.cssText = "padding: 4px 8px; font-size: 14px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;";
            doneBtn.onclick = () => markTaskDone(task.id);
            row.appendChild(doneBtn);
        }

        const detailsBtn = document.createElement("button");
        detailsBtn.textContent = "…";
        detailsBtn.style.cssText = "padding: 4px 8px; font-size: 14px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;";
        detailsBtn.onclick = () => showTaskDetails(task);
        row.appendChild(detailsBtn);

        taskList.appendChild(row);

        // Recursively render child tasks
        if (childCount > 0) {
            renderTaskTree(children, level + 1);
        }
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
        await apiCall("/plan/tasks", "POST", { parentId: null, task: { title, status: "Pending" } });
        loadPlanData();
    } catch (error) {
        showError(`Failed to add task: ${error.message}`);
    }
}

async function refreshPlan() {
    loadPlanData();
}

function toggleShowFinished() {
    showFinishedTasks = document.getElementById("show-finished-toggle").checked;
    if (currentPlanData) {
        document.getElementById("task-list").innerHTML = "";
        renderTaskTree(currentPlanData.sections || currentPlanData.tasks || [], 0);
    }
}

function updateLastSyncTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    document.getElementById("last-sync").textContent = timeStr;
}

function showError(message) {
    const errorDiv = document.getElementById("plan-error");
    const errorMsg = document.getElementById("error-message");
    errorMsg.textContent = message;
    errorDiv.style.display = "block";
}

function indexTasks(tasks) {
    for (const task of tasks) {
        if (!task || !task.id) continue;
        planIndex.set(task.id, task);
        if (Array.isArray(task.tasks) && task.tasks.length) {
            indexTasks(task.tasks);
        }
    }
}

function parseYaml(text) {
    const lines = text.split(/\\r?\\n/);
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
                    obj[key] = parseScalar(value);
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
            ctx.container[key] = parseScalar(value);
        } else {
            ctx.container[key] = {};
            ctx.pendingKey = key;
            stack.push({ indent, container: ctx.container[key], type: "object" });
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
    if (!Number.isNaN(Number(trimmed)) && /^-?\\d+(\\.\\d+)?$/.test(trimmed)) {
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

    if (loginBtn) loginBtn.addEventListener("click", startGoogleLogin);
    if (refreshBtn) refreshBtn.addEventListener("click", refreshPlan);
    if (addBtn) addBtn.addEventListener("click", addTopLevelTask);
    if (showFinished) showFinished.addEventListener("change", toggleShowFinished);
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
}
