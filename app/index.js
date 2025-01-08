// Simple Node.js app for managing Pi-hole group memberships
const express = require('express');
const axios = require('axios');
const app = express();
const bodyParser = require('body-parser');

// Constants from environment variables
const PIHOLE_API_KEY = process.env.PIHOLE_API_KEY;
const PIHOLE_URL = process.env.PIHOLE_URL; // e.g., 'http://192.168.1.100'
const PIHOLE_GROUP = process.env.PIHOLE_GROUP; // e.g., '3'

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Helper to get the client IP address
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

// Helper to check if an IP is in the group
async function isIPInGroup(ip) {
    try {
        const response = await axios.get(`${PIHOLE_URL}/admin/api.php`, {
            params: {
                auth: PIHOLE_API_KEY,
                action: 'list_clients',
                group_id: PIHOLE_GROUP
            }
        });
        const clients = response.data;
        return clients.some(client => client.ip === ip);
    } catch (error) {
        console.error('Error checking group status:', error);
        return false;
    }
}

// Helper to toggle group membership
async function toggleGroupMembership(ip, add) {
    try {
        const action = add ? 'add_client' : 'remove_client';
        await axios.post(`${PIHOLE_URL}/admin/api.php`, null, {
            params: {
                auth: PIHOLE_API_KEY,
                action,
                group_id: PIHOLE_GROUP,
                client_ip: ip
            }
        });
        return true;
    } catch (error) {
        console.error('Error toggling group membership:', error);
        return false;
    }
}

// Helper to render HTML
function renderHTML(clientIP, inGroup) {
    return `
        <html>
        <body>
            <h1>Adblocking Management</h1>
            <p>Your IP: ${clientIP}</p>
            <p>Status: ${inGroup ? 'Adblocking is enabled for your device.' : 'Adblocking is disabled for your device.'}</p>
            <form method="POST">
                <button type="submit" name="action" value="${inGroup ? 'leave' : 'join'}">
                    ${inGroup ? 'Disable Adblocking' : 'Enable Adblocking'}
                </button>
            </form>
        </body>
        </html>
    `;
}

// Routes
app.get('/', async (req, res) => {
    const clientIP = getClientIP(req);
    const inGroup = await isIPInGroup(clientIP);
    res.send(renderHTML(clientIP, inGroup));
});

app.post('/', async (req, res) => {
    const clientIP = getClientIP(req);
    const action = req.body.action;

    const inGroup = await isIPInGroup(clientIP);
    if ((action === 'join' && !inGroup) || (action === 'leave' && inGroup)) {
        await toggleGroupMembership(clientIP, action === 'join');
    }

    const updatedGroupStatus = await isIPInGroup(clientIP);
    res.send(renderHTML(clientIP, updatedGroupStatus));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
