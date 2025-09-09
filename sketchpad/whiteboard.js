const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");

let drawing = false;

canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});
canvas.addEventListener("mouseup", () => drawing = false);
canvas.addEventListener("mouseout", () => drawing = false);

const socket = new WebSocket("ws://localhost:8080");

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
  const x = e.offsetX;
  const y = e.offsetY;

  ctx.strokeStyle = color;

  socket.send(JSON.stringify({ type: "draw", x, y, color }));

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
});

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "draw") {
    ctx.strokeStyle = data.color;
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
  }
};

function clearBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.send(JSON.stringify({ type: "clear" }));
}

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "clear") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};

// User identity logic
let username = "Anonymous";
let userColor = "#000000";
const usernameInput = document.getElementById("username");
const userColorInput = document.getElementById("userColor");
const saveUserBtn = document.getElementById("saveUser");
const userList = document.getElementById("userList");

saveUserBtn.addEventListener("click", () => {
  username = usernameInput.value || "Anonymous";
  userColor = userColorInput.value;
  colorPicker.value = userColor;
  ctx.strokeStyle = userColor;
  socket.send(JSON.stringify({ type: "user", name: username, color: userColor }));
});

// Send user info on connect
socket.addEventListener("open", () => {
  socket.send(JSON.stringify({ type: "user", name: username, color: userColor }));
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
