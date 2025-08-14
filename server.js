// Backend con login + sesión JWT en cookie y dashboard básico
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-no-usar-en-prod';
const COOKIE_NAME = 'auth';

// middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

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

// Modelo User (igual que seed)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// helpers
function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
function setAuthCookie(res, token) {
  // Render sirve por HTTPS, así que podemos usar secure:true
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  });
}
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
}
function getUserFromReq(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function authRequired(req, res, next) {
  const payload = getUserFromReq(req);
  if (!payload) return res.redirect('/login');
  req.user = payload;
  next();
}

// Rutas básicas
app.get('/', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// Login (si ya estás logueado, te mando al dashboard)
app.get('/login', (req, res) => {
  if (getUserFromReq(req)) return res.redirect('/dashboard');
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
      .msg { margin: 12px 0; color: #ef4444; }
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

// Login POST → setea cookie y redirige al dashboard
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

    const token = signToken(user);
    setAuthCookie(res, token);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).send('Error del servidor');
  }
});

// Dashboard (protegido)
app.get('/dashboard', authRequired, (req, res) => {
  const { username, role } = req.user;
  res.send(`<!doctype html>
  <html lang="es"><head>
    <meta charset="utf-8" />
    <title>Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 16px; }
      header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
      .card { border:1px solid #ccc; border-radius:14px; padding:16px; margin-bottom:16px; }
      button { padding: 8px 12px; border-radius:10px; border:0; background:#ef4444; color:white; cursor:pointer; }
      .muted { opacity:.7 }
      code { padding:2px 6px; border-radius:8px; border:1px solid #ccc; }
    </style>
  </head>
  <body>
    <header>
      <h2>Dashboard</h2>
      <form method="POST" action="/logout"><button>Salir</button></form>
    </header>

    <div class="card">
      <h3>Hola, ${username} 👋</h3>
      <p class="muted">Rol: <code>${role}</code></p>
      <p>Bienvenido al panel admin básico. Acá vamos a sumar tarjetas con métricas, usuarios, etc.</p>
    </div>

    <div class="card">
      <h3>Tu sesión</h3>
      <pre id="me" class="muted">Cargando...</pre>
    </div>

    <script>
      fetch('/me').then(r => r.json()).then(d => {
        document.getElementById('me').textContent = JSON.stringify(d, null, 2);
      }).catch(() => {
        document.getElementById('me').textContent = 'No se pudo obtener la sesión.';
      });
    </script>
  </body></html>`);
});

// API para ver quién soy (protegida)
app.get('/me', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// Logout → limpia cookie y vuelve al login
app.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en ${PORT}`);
});
