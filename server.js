// server.js — Login + JWT (cookie) + Dashboard con Métricas
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

// ---------- Middlewares ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ---------- DB ----------
(async () => {
  try {
    if (!MONGO_URI) throw new Error('Falta MONGO_URI');
    await mongoose.connect(MONGO_URI);
    console.log('DB conectada ✅');
  } catch (err) {
    console.error('Error conectando a DB:', err.message);
  }
})();

// ---------- Modelo ----------
const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'admin' },
    lastLogin: { type: Date } // 👈 para métricas
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

// ---------- Helpers ----------
function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,      // Render sirve HTTPS
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  });
}
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/'
  });
}
function getUserFromReq(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function authRequired(req, res, next) {
  const payload = getUserFromReq(req);
  if (!payload) return res.redirect('/login');
  req.user = payload;
  next();
}

// ---------- Rutas básicas ----------
app.get('/', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// ---------- Login (GET) ----------
app.get('/login', (req, res) => {
  if (getUserFromReq(req)) return res.redirect('/dashboard');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Login</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 48px auto; padding: 0 16px; }
    h2 { margin: 0 0 16px; font-weight: 700; }
    form { display: grid; gap: 12px; }
    label { font-size: 14px; opacity: .8; }
    input { padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; width: 100%; }
    button { padding: 10px 14px; border: 0; border-radius: 10px; cursor: pointer; background: #4f46e5; color: white; font-weight: 600; }
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
</body>
</html>`);
});

// ---------- Login (POST) ----------
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

    // 👇 guardamos último login
    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user);
    setAuthCookie(res, token);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).send('Error del servidor');
  }
});

// ---------- Dashboard protegido ----------
app.get('/dashboard', authRequired, (req, res) => {
  const { username, role } = req.user;
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 980px; margin: 48px auto; padding: 0 16px; }
    header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
    .grid { display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card { border:1px solid #3a3a3a55; border-radius:14px; padding:16px; }
    .card h3 { margin:0 0 8px; font-size:16px; opacity:.9 }
    .big { font-size:28px; font-weight:700; }
    button { padding: 8px 12px; border-radius:10px; border:0; background:#ef4444; color:white; cursor:pointer; }
    .muted { opacity:.7 }
    code { padding:2px 6px; border-radius:8px; border:1px solid #3a3a3a55; }
    pre { white-space:pre-wrap; word-break:break-word; }
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
    <p>Bienvenido al panel admin básico. Acá abajo ya tenés <b>métricas en vivo</b>.</p>
  </div>

  <div class="grid">
    <div class="card"><h3>Total usuarios</h3><div id="totalUsers" class="big">—</div></div>
    <div class="card"><h3>Admins</h3><div id="admins" class="big">—</div></div>
    <div class="card"><h3>Último login (tuyo)</h3><div id="lastLogin">—</div></div>
    <div class="card"><h3>Uptime (server)</h3><div id="uptime">—</div></div>
    <div class="card"><h3>DB State</h3><div id="dbState">—</div></div>
  </div>

  <div class="card">
    <h3>Tu sesión</h3>
    <pre id="me" class="muted">Cargando...</pre>
  </div>

  <script>
    function fmtDate(s){
      if(!s) return '—';
      const d = new Date(s);
      return d.toLocaleString();
    }
    function fmtUptime(sec){
      const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60);
      return \`\${h}h \${m}m \${s}s\`;
    }

    Promise.all([
      fetch('/me').then(r=>r.json()).catch(()=>null),
      fetch('/api/metrics').then(r=>r.json()).catch(()=>null)
    ]).then(([me, metrics])=>{
      document.getElementById('me').textContent = JSON.stringify(me, null, 2);
      if(metrics){
        document.getElementById('totalUsers').textContent = metrics.userCount ?? '—';
        document.getElementById('admins').textContent = metrics.adminCount ?? '—';
        document.getElementById('uptime').textContent = fmtUptime(metrics.uptimeSec ?? 0);
        document.getElementById('dbState').textContent = metrics.dbStateText ?? metrics.dbState;
        document.getElementById('lastLogin').textContent = fmtDate(metrics.myLastLogin);
      }
    });
  </script>
</body>
</html>`);
});

// ---------- API: quién soy (protegida) ----------
app.get('/me', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ---------- API: métricas (protegida) ----------
app.get('/api/metrics', authRequired, async (req, res) => {
  try {
    const [userCount, adminCount, meDoc] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'admin' }),
      User.findById(req.user.sub).select('lastLogin')
    ]);

    const dbState = mongoose.connection.readyState; // 0=disc,1=connected,2=connecting,3=disconnecting
    const states = {0:'disconnected',1:'connected',2:'connecting',3:'disconnecting'};
    res.json({
      ok: true,
      userCount,
      adminCount,
      myLastLogin: meDoc?.lastLogin || null,
      uptimeSec: Math.floor(process.uptime()),
      dbState,
      dbStateText: states[dbState] || String(dbState),
      now: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error /api/metrics', e);
    res.status(500).json({ ok:false, error: 'metrics_failed' });
  }
});

// ---------- Logout ----------
app.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.redirect('/login');
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Servidor escuchando en ${PORT}`);
});
