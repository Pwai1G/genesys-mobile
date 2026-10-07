const C = window.GENESYS_CONFIG;
const $ = id => document.getElementById(id);

let conversations = [];
let selected = new Set();
let busy = false;

function log(msg) {
  const t = new Date().toLocaleTimeString("th-TH");
  $("log").textContent += `\n[${t}] ${msg}`;
  $("log").scrollTop = $("log").scrollHeight;
}
function status(msg) { $("status").textContent = msg; }
function setBusy(v, msg) {
  busy = v;
  ["loadBtn","refreshBtn","disconnectBtn"].forEach(id => {
    if ($(id)) $(id).disabled = v || (id === "disconnectBtn" && selected.size === 0);
  });
  if (msg) status(msg);
}
function accessToken() { return sessionStorage.getItem("genesys_access_token") || ""; }

function parseOAuthHash() {
  if (!location.hash) return;
  const p = new URLSearchParams(location.hash.substring(1));
  const token = p.get("access_token");
  const error = p.get("error");

  if (error) {
    const desc = p.get("error_description") || error;
    log(`OAuth error: ${desc}`);
    alert(`Genesys OAuth Error\n${desc}`);
  }

  if (token) {
    sessionStorage.setItem("genesys_access_token", token);
    sessionStorage.setItem("genesys_token_time", String(Date.now()));
  }

  if (token || error) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function login() {
  if (!C.CLIENT_ID || C.CLIENT_ID.includes("PUT_YOUR")) {
    alert("ยังไม่ได้ใส่ Genesys OAuth Client ID ใน config.js");
    return;
  }
  const url = new URL(C.LOGIN_HOST + "/oauth/authorize");
  url.searchParams.set("client_id", C.CLIENT_ID);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("redirect_uri", C.REDIRECT_URI);
  location.href = url.toString();
}

function logout() {
  sessionStorage.removeItem("genesys_access_token");
  sessionStorage.removeItem("genesys_token_time");
  conversations = [];
  selected.clear();
  render();
  showLoggedOut();
}

async function apiFetch(path, opts = {}) {
  const token = accessToken();
  if (!token) throw new Error("Not logged in");

  const r = await fetch(C.API_HOST + path, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });

  if (r.status === 401) {
    sessionStorage.removeItem("genesys_access_token");
  }

  if (!r.ok) {
    let msg = "";
    try {
      const j = await r.json();
      msg = j.message || JSON.stringify(j);
    } catch {
      msg = await r.text();
    }
    throw new Error(`HTTP ${r.status}: ${msg || r.statusText}`);
  }
  return r;
}

async function validateSession() {
  if (!accessToken()) {
    showLoggedOut();
    return;
  }

  try {
    status("Checking Genesys session...");
    const r = await apiFetch("/api/v2/users/me");
    const u = await r.json();
    const who = u.name || u.email || u.id || "Genesys User";
    $("userBox").textContent = `🟢 Connected: ${who}`;
    $("userBox").style.display = "block";
    $("loginArea").style.display = "none";
    $("controls").style.display = "block";
    $("logoutBtn").style.display = "inline-block";
    status("Connected");
    log(`Connected as ${who}`);
  } catch (e) {
    log(`Session error: ${e.message}`);
    showLoggedOut();
    if (e.message.includes("401")) alert("Genesys session หมดอายุ กรุณา Login ใหม่");
  }
}

function showLoggedOut() {
  $("loginArea").style.display = "block";
  $("controls").style.display = "none";
  $("userBox").style.display = "none";
  $("logoutBtn").style.display = "none";
  status("Not logged in");
  $("disconnectBtn").disabled = true;
}

function getInfo(c) {
  const media = new Set(), names = [], queues = new Set();
  for (const p of (c.participants || [])) {
    const n = p.participantName || p.name;
    if (n) names.push(n);
    else if (p.purpose === "agent" && p.userId) names.push(p.userId);

    for (const s of (p.sessions || [])) {
      if (s.mediaType) media.add(s.mediaType);
      for (const seg of (s.segments || [])) {
        if (seg.queueId) queues.add(seg.queueId);
      }
    }
  }

  return {
    id: c.conversationId || "",
    start: c.conversationStart || "",
    direction: c.originatingDirection || "-",
    media: [...media],
    names: [...new Set(names)],
    queues: [...queues]
  };
}

function ageText(start) {
  if (!start) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);
}

function visibleConversations() {
  const q = $("search").value.trim().toLowerCase();
  if (!q) return conversations;

  return conversations.filter(c => {
    const i = getInfo(c);
    return [i.id, i.direction, i.media.join(" "), i.names.join(" "), i.queues.join(" ")]
      .join(" ").toLowerCase().includes(q);
  });
}

function updateCounters() {
  $("totalCount").textContent = conversations.length;
  $("selectedCount").textContent = selected.size;
  $("voiceCount").textContent =
    conversations.filter(c => getInfo(c).media.includes("voice")).length;
  $("outboundCount").textContent =
    conversations.filter(c => getInfo(c).direction === "outbound").length;
  $("disconnectBtn").textContent = `Disconnect Selected (${selected.size})`;
  $("disconnectBtn").disabled = busy || selected.size === 0 || !accessToken();
}

function render() {
  const items = visibleConversations();

  if (!items.length) {
    $("list").innerHTML = `<div class="empty">${
      conversations.length ? "ไม่พบรายการจาก Search" : "ไม่พบ Active Conversations"
    }</div>`;
  } else {
    $("list").innerHTML = items.map(c => {
      const i = getInfo(c);
      const checked = selected.has(i.id);
      return `
        <div class="card ${checked ? "selected" : ""}">
          <div class="top">
            <input class="check rowCheck" type="checkbox"
              data-id="${esc(i.id)}" ${checked ? "checked" : ""}>
            <div class="grow">
              <div>
                <span class="badge">${esc(i.direction)}</span>
                ${i.media.map(x => `<span class="badge">${esc(x)}</span>`).join("")}
              </div>
              <div class="cid">${esc(i.id)}</div>
              <div class="meta">
                <div><b>Age:</b> ${esc(ageText(i.start))}</div>
                <div><b>Start:</b> <span class="muted">${esc(i.start || "-")}</span></div>
                <div><b>Agent / Participant:</b> ${esc(i.names.join(", ") || "-")}</div>
                <div><b>Queue ID:</b> ${esc(i.queues.join(", ") || "-")}</div>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");
  }

  document.querySelectorAll(".rowCheck").forEach(ch => {
    ch.addEventListener("change", e => {
      const id = e.target.dataset.id;
      if (e.target.checked) selected.add(id);
      else selected.delete(id);
      render();
    });
  });

  updateCounters();
}

async function loadActive() {
  if (!accessToken() || busy) return;

  try {
    setBusy(true, "Loading active conversations...");

    const days = Number($("days").value || 7);
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    const interval = `${start.toISOString()}/${now.toISOString()}`;

    let page = 1;
    let all = [];

    while (true) {
      const body = {
        interval,
        order: "asc",
        orderBy: "conversationStart",
        paging: { pageSize: 100, pageNumber: page },
        conversationFilters: [{
          type: "and",
          predicates: [{
            type: "dimension",
            dimension: "conversationEnd",
            operator: "notExists"
          }]
        }]
      };

      if ($("media").value) {
        body.segmentFilters = [{
          type: "and",
          predicates: [{
            type: "dimension",
            dimension: "mediaType",
            operator: "matches",
            value: $("media").value
          }]
        }];
      }

      const r = await apiFetch("/api/v2/analytics/conversations/details/query", {
        method: "POST",
        body: JSON.stringify(body)
      });
      const d = await r.json();
      const batch = d.conversations || [];
      all.push(...batch);

      if (
        batch.length < 100 ||
        (Number.isInteger(d.totalHits) && all.length >= d.totalHits) ||
        page >= 100
      ) break;

      page++;
    }

    conversations = all.filter(c => !c.conversationEnd);
    selected.clear();
    render();
    log(`Loaded ${conversations.length} active conversation(s).`);
    status(`Loaded ${conversations.length} active conversation(s)`);
  } catch (e) {
    log(`Load failed: ${e.message}`);
    alert(e.message);
    status("Load failed");
    if (e.message.includes("401")) showLoggedOut();
  } finally {
    setBusy(false);
  }
}

async function disconnectSelected() {
  const ids = [...selected];
  if (!ids.length || busy) return;

  if (!confirm(
    `คุณกำลังจะ Force Disconnect ${ids.length} interaction(s).\n\n` +
    `สายจะถูกตัดทันที ต้องการดำเนินการต่อหรือไม่?`
  )) return;

  if (!confirm("ยืนยันอีกครั้ง: Disconnect interaction ที่เลือกทั้งหมด?")) return;

  setBusy(true, `Disconnecting ${ids.length} conversation(s)...`);

  let success = 0;
  const failed = [];

  for (let i = 0; i < ids.length; i++) {
    const cid = ids[i];
    try {
      await apiFetch(`/api/v2/conversations/${encodeURIComponent(cid)}/disconnect`, {
        method: "POST"
      });
      success++;
      log(`DISCONNECTED: ${cid}`);
    } catch (e) {
      failed.push([cid, e.message]);
      log(`FAILED: ${cid} - ${e.message}`);
    }
    status(`Disconnecting ${i + 1}/${ids.length}...`);
  }

  setBusy(false, `Completed: ${success} success, ${failed.length} failed`);
  alert(`Disconnect Completed\nSuccess: ${success}\nFailed: ${failed.length}`);
  await loadActive();
}

$("loginBtn").onclick = login;
$("logoutBtn").onclick = logout;
$("loadBtn").onclick = loadActive;
$("refreshBtn").onclick = loadActive;
$("disconnectBtn").onclick = disconnectSelected;
$("search").addEventListener("input", render);

$("selectAllBtn").onclick = () => {
  visibleConversations().forEach(c => selected.add(c.conversationId));
  render();
};

$("clearBtn").onclick = () => {
  selected.clear();
  render();
};

parseOAuthHash();
validateSession();
render();
