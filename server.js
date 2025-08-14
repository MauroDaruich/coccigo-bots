// Backend principal con login simple para probar
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Conexión a Mongo
(async () => {
  try {
    if (!MONGO_URI) throw new Error('Falta MONGO_URI');
    await mongoose.connect(MONGO_URI);
    console.log('DB conectada ✅');
  } catch (err) {
    console.error('Error conectando a DB:', err.message);
  }
})();

// Modelo User (mismo esquema que seed)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Rutas básicas
app.get('/', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// Pantalla de login (HTML ultra simple)
app.get('/login', (req, res) => {
  res.send(`<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 48px auto; padding: 0 16px; }
      h2 { margin: 0 0 16px; font-weight: 700; }
      form { display: grid; gap: 12px; }
      label { font-size: 14px; opacity: .8; }
      input { padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; width: 100%; }
      button { padding: 10px 14px; border: 0; border-radius: 10px; cursor: pointer; }
      button { background: #4f46e5; color: white; font-weight: 600; }
      .hint { margin-top: 10px; font-size: 12px; opacity: .7; }
    </style>
  </head>
  <body>
    <h2>Login</h2>
    <form method="POST" action="/login" autocomplete="off">
      <div>
        <label for="identifier">Usuario o Email</label>
        <input id="identifier" name="identifier" placeholder="Tu usuario o mail" required />
      </div>
      <div>
        <label for="password">Contraseña</label>
        <input id="password" name="password" type="password" placeholder="••••••••" required />
      </div>
      <button type="submit">Entrar</button>
    </form>
    <p class="hint">Si no recordás tus credenciales, pedilas al admin.</p>
  </body></html>`);
});

// Login POST (valida contra MongoDB)
app.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).send('Faltan datos');

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) return res.status(401).send('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).send('Credenciales inválidas');

    res.send(`✅ Bienvenido, ${user.username}`);
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).send('Error del servidor');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en ${PORT}`);
});
