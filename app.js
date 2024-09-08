const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
    console.log("snnn")
  ws.on('message', function incoming(message) {
    console.log("snnnk")

    const data = JSON.parse(message);
    const orderId = data.orderId;

    // Broadcast the signaling data to the correct client based on orderId
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN && client.orderId === orderId) {
        client.send(JSON.stringify(data));
      }
    });

    // Store the orderId for this connection
    ws.orderId = orderId;
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket signaling server running on wss://localhost:8080');
