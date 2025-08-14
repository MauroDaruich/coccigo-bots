// Backend principal (keep-alive)
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// endpoint simple para chequear salud
app.get('/', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Servidor escuchando en ${PORT}`);
});
