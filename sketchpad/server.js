// server.js

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Store users and sketchpad state
let users = [];
let sketchpad = [];

wss.on('connection', function connection(ws) {
  ws.user = { name: 'Anonymous', color: '#000000' };

  // Send current sketchpad state to new client
  ws.send(JSON.stringify({ type: 'sketchpad', data: sketchpad }));

  ws.on('message', function incoming(message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (data.type === 'user') {
      ws.user = { name: data.name, color: data.color };
      // Update users list
      users = Array.from(wss.clients)
        .filter(client => client.readyState === WebSocket.OPEN)
        .map(client => client.user);
      // Broadcast user list
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'users', list: users }));
        }
      });
    } else if (data.type === 'start' || data.type === 'draw') {
      sketchpad.push(data); // Save start/draw action
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } else if (data.type === 'clear') {
      sketchpad = []; // Clear sketchpad state
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  ws.on('close', function() {
    // Remove user and broadcast updated list
    users = Array.from(wss.clients)
      .filter(client => client.readyState === WebSocket.OPEN)
      .map(client => client.user);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'users', list: users }));
      }
    });
  });
});

