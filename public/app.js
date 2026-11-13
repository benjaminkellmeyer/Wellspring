const form = document.getElementById("request-form");
const list = document.getElementById("list");
const log = document.getElementById("log");

const nextStatus = { submitted: "in_progress", in_progress: "completed" };

// One helper sends every request and shows the reply
app.use(express.urlencoded({ extended: true }));

async function send(method, url, body, showLog = true) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    log.textContent = "Could not reach the server. Is it running?";
    return { ok: false, data: null };
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = { error: "The response was not JSON. Check the path and method." };
  }

  if (showLog) {
    log.textContent =
      `${method} ${url}\nStatus: ${res.status}\n\n` + JSON.stringify(data, null, 2);
  }
  return { ok: res.ok, data };
}

function addButton(li, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.onclick = onClick;
  li.append(" ", button);
}

async function loadRequests(showLog = true) {
  const { ok, data } = await send("GET", "/api/requests", undefined, showLog);
  if (!ok) return;

  list.innerHTML = "";
  for (const item of data) {
    const li = document.createElement("li");
    li.textContent = `${item.title} (${item.location}) - ${item.status}`;

    if (nextStatus[item.status]) {
      addButton(li, "Move to " + nextStatus[item.status], async () => {
        await send("PATCH", `/api/requests/${item.id}`, { status: nextStatus[item.status] });
        loadRequests(false);
      });
    }

    addButton(li, "Archive", async () => {
      await send("PATCH", `/api/requests/${item.id}/archive`);
      loadRequests(false);
    });

    addButton(li, "Delete", async () => {
      await send("DELETE", `/api/requests/${item.id}`);
      loadRequests(false);
    });

    list.append(li);
  }
}

form.onsubmit = async (event) => {
  event.preventDefault();
  const { ok } = await send("POST", "/api/requests", {
    title: document.getElementById("title").value,
    location: document.getElementById("location").value,
    description: document.getElementById("description").value
  });
  if (ok) form.reset();
  loadRequests(false);
};

loadRequests();