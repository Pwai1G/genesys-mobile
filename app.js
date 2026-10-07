const $ = id => document.getElementById(id);

let conversations = [];
let selected = new Set();
let busy = false;

function log(msg) {
  const t = new Date().toLocaleTimeString("th-TH");
  $("log").textContent += `\n[${t}] ${msg}`;
  $("log").scrollTop = $("log").scrollHeight;
}

function status(msg) {
  $("status").textContent = msg;
}

function host() {
  return $("apiHost").value.trim().replace(/\/+$/, "");
}

function inputToken() {
  return $("token").value.trim().replace(/^Bearer\s+/i, "");
}

function storedToken() {
  return sessionStorage.getItem("genesys_bearer_token") || "";
}

function token() {
  return inputToken() || storedToken();
}

function saveToken() {
  const t = inputToken();
  if (!t) {
    alert("กรุณาใส่ Bearer Token");
    return;
  }
  sessionStorage.setItem("genesys_bearer_token", t);
  status("Token saved for this browser session");
  log("Bearer token saved to sessionStorage");
}

function clearToken() {
  sessionStorage.removeItem("genesys_bearer_token");
  $("token").value = "";
  status("Token cleared");
  log("Bearer token cleared");
}

function setBusy(v, msg) {
  busy = v;
  ["testBtn","loadBtn","refreshBtn","disconnectBtn"].forEach(id => {
    if ($(id)) $(id).disabled = v || (id === "disconnectBtn" && selected.size === 0);
  });
  if (msg) status(msg);
}

function validate() {
  if (!token()) {
    alert("กรุณาใส่ Bearer Token ก่อนใช้งาน");
    return false;
  }
  if (!/^https?:\/\//i.test(host())) {
    alert("API Host ไม่ถูกต้อง");
    return false;
  }
  return true;
}

async function apiFetch(path, opts = {}) {
  const r = await fetch(host() + path, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token()}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });

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

async function testToken() {
  if (!validate() || busy) return;

  try {
    setBusy(true, "Testing token...");
    const r = await apiFetch("/api/v2/users/me");
    const u = await r.json();
    const who = u.name || u.email || u.id || "Genesys User";
    sessionStorage.setItem("genesys_bearer_token", token());
    status(`Token OK - ${who}`);
    log(`Token OK - user: ${who}`);
    alert(`Token OK\nConnected as: ${who}`);
  } catch (e) {
    status("Token test failed");
    log(`ERROR: ${e.message}`);
    alert(e.message);
  } finally {
    setBusy(false);
  }
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

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(start).getTime()) / 1000)
  );

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  })[c]);
}

function visibleConversations() {
  const q = $("search").value.trim().toLowerCase();

  if (!q) return conversations;

  return conversations.filter(c => {
    const i = getInfo(c);

    return [
      i.id,
      i.direction,
      i.media.join(" "),
      i.names.join(" "),
      i.queues.join(" ")
    ].join(" ").toLowerCase().includes(q);
  });
}

function updateCounters() {
  $("totalCount").textContent = conversations.length;
  $("selectedCount").textContent = selected.size;

  $("voiceCount").textContent =
    conversations.filter(c => getInfo(c).media.includes("voice")).length;

  $("outboundCount").textContent =
    conversations.filter(c => getInfo(c).direction === "outbound").length;

  $("disconnectBtn").textContent =
    `Disconnect Selected (${selected.size})`;

  $("disconnectBtn").disabled =
    busy || selected.size === 0 || !token();
}

function render() {
  const items = visibleConversations();

  if (!items.length) {
    $("list").innerHTML =
      `<div class="empty">${
        conversations.length
          ? "ไม่พบรายการจาก Search"
          : "ไม่พบ Active Conversations"
      }</div>`;
  } else {
    $("list").innerHTML = items.map(c => {
      const i = getInfo(c);
      const checked = selected.has(i.id);

      return `
        <div class="card ${checked ? "selected" : ""}">
          <div class="top">
            <input class="check rowCheck"
                   type="checkbox"
                   data-id="${esc(i.id)}"
                   ${checked ? "checked" : ""}>
            <div class="grow">
              <div>
                <span class="badge">${esc(i.direction)}</span>
                ${i.media.map(x =>
                  `<span class="badge">${esc(x)}</span>`
                ).join("")}
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
  if (!validate() || busy) return;

  try {
    setBusy(true, "Loading active conversations...");

    sessionStorage.setItem("genesys_bearer_token", token());

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
        paging: {
          pageSize: 100,
          pageNumber: page
        },
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

      const r = await apiFetch(
        "/api/v2/analytics/conversations/details/query",
        {
          method: "POST",
          body: JSON.stringify(body)
        }
      );

      const d = await r.json();
      const batch = d.conversations || [];

      all.push(...batch);

      if (
        batch.length < 100 ||
        (Number.isInteger(d.totalHits) && all.length >= d.totalHits) ||
        page >= 100
      ) {
        break;
      }

      page++;
    }

    conversations = all.filter(c => !c.conversationEnd);
    selected.clear();

    render();

    log(`Loaded ${conversations.length} active conversation(s).`);
    status(`Loaded ${conversations.length} active conversation(s)`);

  } catch (e) {
    log(`Load failed: ${e.message}`);
    status("Load failed");
    alert(e.message);
  } finally {
    setBusy(false);
  }
}

async function disconnectSelected() {
  if (!validate() || busy) return;

  const ids = [...selected];

  if (!ids.length) {
    alert("กรุณาเลือก Conversation ที่ต้องการ Disconnect");
    return;
  }

  if (!confirm(
    `คุณกำลังจะ Force Disconnect ${ids.length} interaction(s).\n\n` +
    `สายจะถูกตัดทันที ต้องการดำเนินการต่อหรือไม่?`
  )) return;

  if (!confirm(
    "ยืนยันอีกครั้ง: Disconnect interaction ที่เลือกทั้งหมด?"
  )) return;

  setBusy(
    true,
    `Disconnecting ${ids.length} conversation(s)...`
  );

  let success = 0;
  const failed = [];

  for (let i = 0; i < ids.length; i++) {
    const cid = ids[i];

    try {
      await apiFetch(
        `/api/v2/conversations/${encodeURIComponent(cid)}/disconnect`,
        { method: "POST" }
      );

      success++;
      log(`DISCONNECTED: ${cid}`);

    } catch (e) {
      failed.push([cid, e.message]);
      log(`FAILED: ${cid} - ${e.message}`);
    }

    status(
      `Disconnecting ${i + 1}/${ids.length}...`
    );
  }

  setBusy(
    false,
    `Completed: ${success} success, ${failed.length} failed`
  );

  alert(
    `Disconnect Completed\n` +
    `Success: ${success}\n` +
    `Failed: ${failed.length}`
  );

  await loadActive();
}

$("showTokenBtn").onclick = () => {
  $("token").type =
    $("token").type === "password"
      ? "text"
      : "password";
};

$("saveTokenBtn").onclick = saveToken;
$("clearTokenBtn").onclick = clearToken;
$("testBtn").onclick = testToken;
$("loadBtn").onclick = loadActive;
$("refreshBtn").onclick = loadActive;
$("disconnectBtn").onclick = disconnectSelected;

$("search").addEventListener("input", render);

$("selectAllBtn").onclick = () => {
  visibleConversations().forEach(
    c => selected.add(c.conversationId)
  );
  render();
};

$("clearBtn").onclick = () => {
  selected.clear();
  render();
};

const existing = storedToken();

if (existing) {
  $("token").value = existing;
  status("Bearer Token loaded from this browser session");
}

render();
