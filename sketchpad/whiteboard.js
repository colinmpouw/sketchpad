const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");

let drawing = false;

canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  // Send start event to server
  const color = colorPicker.value;
  const thickness = thicknessPicker.value;
  socket.send(JSON.stringify({ type: "start", x: e.offsetX, y: e.offsetY, color, thickness }));
});
canvas.addEventListener("mouseup", () => drawing = false);
canvas.addEventListener("mouseout", () => drawing = false);

const socket = new WebSocket("ws://192.168.1.5:8080");

const colorPicker = document.getElementById("colorPicker");
const thicknessPicker = document.getElementById("thicknessPicker");
thicknessPicker.addEventListener("input", () => {
  ctx.lineWidth = thicknessPicker.value;
});
ctx.lineWidth = thicknessPicker.value;
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = colorPicker.value;  

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const color = colorPicker.value;
  const thickness = thicknessPicker.value;
  const x = e.offsetX;
  const y = e.offsetY;

  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;

  socket.send(JSON.stringify({ type: "draw", x, y, color, thickness }));

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
});

// Improved remote drawing: track last position and thickness, handle 'start' events
let lastRemote = {};
socket.onmessage = (event) => {
  // If event.data is a Blob, convert to text first
  if (event.data instanceof Blob) {
    const reader = new FileReader();
    reader.onload = function() {
      try {
        const data = JSON.parse(reader.result);
        handleWSData(data);
      } catch (e) {
        console.error('WS JSON parse error:', e, reader.result);
      }
    };
    reader.readAsText(event.data);
  } else {
    try {
      const data = JSON.parse(event.data);
      handleWSData(data);
    } catch (e) {
      console.error('WS JSON parse error:', e, event.data);
    }
  }
};

function handleWSData(data) {
  console.log('[WS INCOMING]', data);
  if (data.type === "start") {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.thickness || thicknessPicker.value;
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
    lastRemote[data.color] = { x: data.x, y: data.y };
  } else if (data.type === "draw") {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.thickness || thicknessPicker.value;
    if (!lastRemote[data.color]) {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
      lastRemote[data.color] = { x: data.x, y: data.y };
    } else {
      ctx.beginPath();
      ctx.moveTo(lastRemote[data.color].x, lastRemote[data.color].y);
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
      lastRemote[data.color] = { x: data.x, y: data.y };
    }
  } else if (data.type === "clear") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastRemote = {};
  } else if (data.type === "sketchpad" && Array.isArray(data.data)) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastRemote = {};
    // Replay all draw actions
    data.data.forEach(draw => {
      console.log('[WS REPLAY]', draw);
      if (draw.type === "start") {
        ctx.strokeStyle = draw.color;
        ctx.lineWidth = draw.thickness || thicknessPicker.value;
        ctx.beginPath();
        ctx.moveTo(draw.x, draw.y);
        lastRemote[draw.color] = { x: draw.x, y: draw.y };
      } else if (draw.type === "draw") {
        ctx.strokeStyle = draw.color;
        ctx.lineWidth = draw.thickness || thicknessPicker.value;
        if (!lastRemote[draw.color]) {
          ctx.beginPath();
          ctx.moveTo(draw.x, draw.y);
          lastRemote[draw.color] = { x: draw.x, y: draw.y };
        } else {
          ctx.beginPath();
          ctx.moveTo(lastRemote[draw.color].x, lastRemote[draw.color].y);
          ctx.lineTo(draw.x, draw.y);
          ctx.stroke();
          lastRemote[draw.color] = { x: draw.x, y: draw.y };
        }
      } else if (draw.type === "clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastRemote = {};
      }
    });
  }
}

function clearBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.send(JSON.stringify({ type: "clear" }));
}

// User identity logic
let username = "Anonymous";
let userColor = "#000000";
const usernameInput = document.getElementById("username");
const userColorInput = document.getElementById("userColor");
const saveUserBtn = document.getElementById("saveUser");
const userList = document.getElementById("userList");

let socketOpened = false;
let pendingUserInfo = false;

function sendUserInfo() {
  if (socketOpened) {
    socket.send(JSON.stringify({ type: "user", name: username, color: userColor }));
    pendingUserInfo = false;
  } else {
    pendingUserInfo = true;
  }
}

saveUserBtn.addEventListener("click", () => {
  username = usernameInput.value || "Anonymous";
  userColor = userColorInput.value;
  colorPicker.value = userColor;
  ctx.strokeStyle = userColor;
  sendUserInfo();
});

// Send user info on connect
socket.addEventListener("open", () => {
  socketOpened = true;
  sendUserInfo();
});

// Maintain user list
let users = [];
socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "users") {
    users = data.list;
    userList.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u.name;
      li.style.color = u.color;
      userList.appendChild(li);
    });
  }
});
