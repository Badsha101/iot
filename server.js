const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('WebSocket Server is running\n');
});

const wss = new WebSocket.Server({ server });
const PORT = 3000;

console.log('WebSocket-Server wird gestartet...');

// ----------------------
// Zustand laden
// ----------------------
let blockIndex = 1;
let lastBlockDate = new Date().toDateString();

if (fs.existsSync('state.json')) {
  try {
    const state = JSON.parse(fs.readFileSync('state.json', 'utf8'));
    blockIndex = state.blockIndex || 1;
    lastBlockDate = state.lastBlockDate || new Date().toDateString();
    console.log(`Zustand geladen: Block ${blockIndex}, Datum ${lastBlockDate}`);
  } catch (err) {
    console.error('Fehler beim Laden der state.json:', err);
  }
}

// ----------------------
// Hilfsfunktionen
// ----------------------
function saveState() {
  fs.writeFileSync('state.json', JSON.stringify({ blockIndex, lastBlockDate }));
}

function calcAvg(arr) {
  return arr.length
    ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
    : '0.00';
}

function checkNewDay() {
  const today = new Date().toDateString();
  if (today !== lastBlockDate) {
    blockIndex++;
    lastBlockDate = today;
    saveState();
    console.log(`Neuer Tag erkannt. Blockindex erhöht auf ${blockIndex}`);
  }
}

function isJson(str) {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null;
  } catch (e) {
    return false;
  }
}

// ----------------------
// Messdaten
// ----------------------
let tempData = [];
let humData = [];

// ----------------------
// Alle 60 Minuten: Durchschnitt speichern
// ----------------------
setInterval(() => {
  checkNewDay();

  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const timeKey = `${hour}:${minute}`;

  const avgTemp = calcAvg(tempData);
  const avgHum = calcAvg(humData);

  const tempFilename = `block_${blockIndex}_temp.csv`;
  const humFilename = `block_${blockIndex}_hum.csv`;
  const combinedFilename = `block_${blockIndex}_hum_temp.csv`;

  fs.appendFileSync(tempFilename, `${timeKey},${avgTemp}\n`);
  fs.appendFileSync(humFilename, `${timeKey},${avgHum}\n`);
  fs.appendFileSync(combinedFilename, `${timeKey},${avgTemp},${avgHum}\n`);

  console.log(`[${timeKey}] Durchschnitt gespeichert in Block ${blockIndex}: Temp=${avgTemp}, Hum=${avgHum}`);

  tempData = [];
  humData = [];
}, 60 * 60 * 1000);

// ----------------------
// WebSocket-Events
// ----------------------
wss.on('connection', (ws) => {
  console.log('Neuer Client verbunden');

  ws.on('message', (message) => {
    checkNewDay();

    const msgText = message.toString();
    console.log("Nachricht empfangen:", msgText);

    if (!isJson(msgText)) {
      return; // ignore non-JSON messages
    }

    const data = JSON.parse(msgText);
    if (typeof data.temp === 'number') tempData.push(data.temp);
    if (typeof data.hum === 'number') humData.push(data.hum);

    // Broadcast to all clients (including sender)
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msgText);
      }
    });
  });

  ws.on('close', () => {
    console.log('Client getrennt');
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket-Server läuft auf Port ${PORT}`);
});

