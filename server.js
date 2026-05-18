const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const geoip = require('geoip-lite'); // Add geoip-lite dependency

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// New HTTP endpoint to get region safely from the server side
app.get('/api/get-region', (req, res) => {
    // Get client IP, accounting for Render's reverse proxy structure
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    // Default fallback for local testing (127.0.0.1 won't return a region)
    if (ip === '127.0.0.1' || ip === '::1') {
        return res.json({ region: "Local Network" });
    }

    const geo = geoip.lookup(ip);
    res.json({ region: geo ? geo.region : "Unknown Region" });
});

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const wss = new WebSocketServer({ server });

const clients = new Map();

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'join') {
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

function broadcastRegionUpdate(region) {
    const devicesInRegion = [];
    clients.forEach((client) => {
        if (client.region === region) {
            devicesInRegion.push(client.deviceName);
        }
    });

    clients.forEach((client) => {
        if (client.region === region && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({ type: 'update', devices: devicesInRegion }));
        }
    });
}
