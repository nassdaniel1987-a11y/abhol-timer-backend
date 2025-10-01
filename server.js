const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middleware für statische Dateien und JSON
app.use(express.static(path.join(__dirname, '..'))); // Erlaube Zugriff auf das Hauptverzeichnis
app.use(bodyParser.json());

// --- VAPID KEYS HIER EINTRAGEN ---
const publicVapidKey = 'BBCwU1NChqqlA0-5CGrNIgQOtc5NBQpyznehELP79SU40qRrSQcuHp9Bq0aVHDP941Jnv09JKjTkxUnZ0I7ua7c';
const privateVapidKey = 'GIkIrS0_pXAbQjUUnnlln1uQ16-FaFtb3EyySYRVaZI';

webpush.setVapidDetails(
  'mailto:test@example.com', // Eine Kontakt-E-Mail
  publicVapidKey,
  privateVapidKey
);

// In einer echten App wäre dies eine Datenbank.
// Für unser Beispiel speichern wir die Abonnements im Speicher.
// Format: { childId: { subscription: PushSubscription, name: string } }
let subscriptions = {};

// Route zum Speichern eines Abonnements
app.post('/api/save-subscription', (req, res) => {
  const { childId, subscription, name } = req.body;
  subscriptions[childId] = { subscription, name };
  console.log(`✅ Abonnement gespeichert für: ${name} (${childId})`);
  res.status(201).json({ message: 'Abonnement erfolgreich gespeichert.' });
});

// Route zum Löschen eines Abonnements
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


// Route, um eine Benachrichtigung zu planen
// Das Frontend sagt dem Backend, wann es eine Nachricht senden soll.
app.post('/api/schedule-notification', (req, res) => {
  const { childId, time } = req.body;

  if (!subscriptions[childId]) {
    return res.status(404).json({ message: 'Abonnement nicht gefunden, kann nicht planen.' });
  }
    
  const { subscription, name } = subscriptions[childId];
  const [hours, minutes] = time.split(':');

  const notificationTime = new Date();
  notificationTime.setHours(hours, minutes, 0, 0);
  notificationTime.setMinutes(notificationTime.getMinutes() - 1); // 1 Minute vorher

  const now = new Date();
  if (notificationTime <= now) {
      // Wenn die Zeit schon vorbei ist, nicht planen (oder auf morgen setzen, je nach Logik)
      console.log(`⏰ Planungszeit für ${name} liegt in der Vergangenheit. Überspringe.`);
      return res.status(200).json({ message: 'Zeit liegt in der Vergangenheit, nichts geplant.' });
  }

  const delay = notificationTime.getTime() - now.getTime();

  console.log(`📅 Benachrichtigung für "${name}" geplant in ${Math.round(delay / 1000 / 60)} Minuten.`);

  setTimeout(() => {
    // Prüfen, ob das Abo noch existiert, bevor wir senden
    if (subscriptions[childId]) {
        const payload = JSON.stringify({
            title: '🔔 Gleich abholen!',
            body: `${name} muss gleich abgeholt werden.`
        });

        console.log(`🚀 Sende Benachrichtigung an ${name}...`);
        webpush.sendNotification(subscription, payload)
            .catch(error => {
                console.error(`Fehler beim Senden an ${name}:`, error.statusCode);
                // Wenn das Abo abgelaufen ist (Code 410), löschen wir es
                if (error.statusCode === 410) {
                    delete subscriptions[childId];
                }
            });
    }
  }, delay);

  res.status(202).json({ message: 'Benachrichtigung erfolgreich geplant.' });
});

// Route, um den Public Key für das Frontend bereitzustellen
app.get('/api/vapid-public-key', (req, res) => {
    res.send(publicVapidKey);
});


const port = 3000;
app.listen(port, () => {
  console.log(`Push-Server läuft auf http://localhost:${port}`);
});