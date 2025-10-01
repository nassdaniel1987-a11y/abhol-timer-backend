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

webpush.setVapidDetails('mailto:test@example.com', publicVapidKey, privateVapidKey);

let subscriptions = {};

app.post('/api/save-subscription', (req, res) => {
  try {
    const { childId, subscription, name } = req.body;
    if (!childId || !subscription || !name) {
      console.error("Fehlerhafte Anfrage bei save-subscription:", req.body);
      return res.status(400).json({ message: "Fehlende Daten für das Abonnement." });
    }
    subscriptions[childId] = { subscription, name };
    console.log(`✅ Abonnement gespeichert für: ${name} (${childId})`);
    res.status(201).json({ message: 'Abonnement erfolgreich gespeichert.' });
  } catch (error) {
    console.error("Schwerer Fehler in /api/save-subscription:", error);
    res.status(500).json({ message: "Interner Serverfehler." });
  }
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
  try {
    console.log("--> Anfrage für /api/schedule-notification erhalten. Body:", req.body);
    const { childId, timeISO } = req.body;

    if (!childId || !timeISO) {
      console.error("Fehlerhafte Anfrage bei schedule-notification:", req.body);
      return res.status(400).json({ message: "Fehlende Daten für die Benachrichtigungsplanung." });
    }

    if (!subscriptions[childId]) {
      console.warn(`Planung für ${childId} fehlgeschlagen: Kein Abonnement gefunden.`);
      return res.status(404).json({ message: 'Abonnement nicht gefunden, kann nicht planen.' });
    }
    
    const { subscription, name } = subscriptions[childId];
    const pickupTime = new Date(timeISO);
    const notificationTime = new Date(pickupTime.getTime() - (60 * 1000));
    const now = new Date();
    const delay = notificationTime.getTime() - now.getTime();

    if (delay <= 0) {
        console.log(`⏰ Planungszeit für ${name} liegt in der Vergangenheit. Überspringe.`);
        return res.status(200).json({ message: 'Zeit liegt in der Vergangenheit, nichts geplant.' });
    }

    const minutesLeft = Math.round(delay / 1000 / 60);
    console.log(`📅 Benachrichtigung für "${name}" geplant in ${minutesLeft} Minuten.`);

    setTimeout(() => {
      if (subscriptions[childId]) {
          const payload = JSON.stringify({ title: '🔔 Gleich abholen!', body: `${name} muss gleich abgeholt werden.` });
          console.log(`🚀 Sende Benachrichtigung an ${name}...`);
          webpush.sendNotification(subscription, payload)
              .catch(error => console.error(`Fehler beim Senden an ${name}:`, error.statusCode));
      } else {
          console.log(`🔔 Senden an ${name} abgebrochen, Abonnement wurde zwischenzeitlich gelöscht.`);
      }
    }, delay);

    res.status(202).json({ message: 'Benachrichtigung erfolgreich geplant.' });
  } catch(error) {
      console.error("Schwerer Fehler in /api/schedule-notification:", error);
      res.status(500).json({ message: "Interner Serverfehler." });
  }
});

app.get('/api/vapid-public-key', (req, res) => {
    res.send(publicVapidKey);
});

const port = 3000;
app.listen(port, () => {
  console.log(`Push-Server läuft auf http://localhost:${port}`);
});