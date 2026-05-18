const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend files from a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const wss = new WebSocketServer({ server });

// Store active connections: { socketId: { ws, region, deviceName } }
const clients = new Map();

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'join') {
                // Register the new client details
                clients.set(id, { ws, region: data.region, deviceName: data.deviceName });
                broadcastRegionUpdate(data.region);
            }
        } catch (err) {
            console.error('Invalid message format');
        }
    });

    ws.on('close', () => {
        const client = clients.get(id);
        if (client) {
            const clientRegion = client.region;
            clients.delete(id);
            broadcastRegionUpdate(clientRegion);
        }
    });
});

// Send updated list only to devices sharing the same region
function broadcastRegionUpdate(region) {
    const devicesInRegion = [];
    
    // Gather all device names in this specific region
    clients.forEach((client) => {
        if (client.region === region) {
            devicesInRegion.push(client.deviceName);
        }
    });

    // Send the list to every socket in this region
    clients.forEach((client) => {
        if (client.region === region && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({ type: 'update', devices: devicesInRegion }));
        }
    });
}
