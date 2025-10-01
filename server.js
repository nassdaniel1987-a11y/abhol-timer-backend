const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// --- DEINE VAPID KEYS HIER EINTRAGEN ---
const publicVapidKey = 'BCk200YLYo1f3N0kmnXFE5OmIZujsSsP_SUpJfLrNgW7iwFdY2cxaPt34qi4IslHC2Yt85CJM3nSpPLLSgJIo2M';
const privateVapidKey = 'O0Z0WqTWYg3q2cDyzP2gR9Ai64sYgGnMEEODhpDSzs8';

webpush.setVapidDetails(
  'mailto:test@example.com',
  publicVapidKey,
  privateVapidKey
);

let subscriptions = {};

app.post('/api/save-subscription', (req, res) => {
  const { childId, subscription, name } = req.body;
  subscriptions[childId] = { subscription, name };
  console.log(`✅ Abonnement gespeichert für: ${name} (${childId})`);
  res.status(201).json({ message: 'Abonnement erfolgreich gespeichert.' });
});

app.post('/api/delete-subscription', (req, res) => {
    const { childId } = req.body;
    if (subscriptions[childId]) {
        delete subscriptions[childId];
        console.log(`🗑️ Abonnement gelöscht für: ${childId}`);
        res.status(200).json({ message: 'Abonnement erfolgreich gelöscht.' });
    } else {
        res.status(404).json({ message: 'Abonnement nicht gefunden.' });
    }
});

app.post('/api/schedule-notification', (req, res) => {
  // GEÄNDERT: Wir empfangen jetzt einen ISO-String (universelle Zeit)
  const { childId, timeISO } = req.body;

  if (!subscriptions[childId]) {
    return res.status(404).json({ message: 'Abonnement nicht gefunden, kann nicht planen.' });
  }
    
  const { subscription, name } = subscriptions[childId];

  // GEÄNDERT: Wir erstellen die Zieldaten direkt aus dem ISO-String
  const pickupTime = new Date(timeISO);
  
  // Wir planen die Benachrichtigung 1 Minute vorher
  const notificationTime = new Date(pickupTime.getTime() - (60 * 1000));

  const now = new Date(); // Aktuelle Server-Zeit in UTC
  
  // GEÄNDERT: Die Berechnung ist jetzt immer korrekt
  const delay = notificationTime.getTime() - now.getTime();

  if (delay <= 0) {
      console.log(`⏰ Planungszeit für ${name} liegt in der Vergangenheit. Überspringe.`);
      return res.status(200).json({ message: 'Zeit liegt in der Vergangenheit, nichts geplant.' });
  }

  const minutesLeft = Math.round(delay / 1000 / 60);
  console.log(`📅 Benachrichtigung für "${name}" geplant in ${minutesLeft} Minuten.`);

  setTimeout(() => {
    if (subscriptions[childId]) {
        const payload = JSON.stringify({
            title: '🔔 Gleich abholen!',
            body: `${name} muss gleich abgeholt werden.`
        });

        console.log(`🚀 Sende Benachrichtigung an ${name}...`);
        webpush.sendNotification(subscription, payload)
            .catch(error => {
                console.error(`Fehler beim Senden an ${name}:`, error.statusCode);
                if (error.statusCode === 410) {
                    delete subscriptions[childId];
                }
            });
    }
  }, delay);

  res.status(202).json({ message: 'Benachrichtigung erfolgreich geplant.' });
});

app.get('/api/vapid-public-key', (req, res) => {
    res.send(publicVapidKey);
});

const port = 3000;
app.listen(port, () => {
  console.log(`Push-Server läuft auf http://localhost:${port}`);
});