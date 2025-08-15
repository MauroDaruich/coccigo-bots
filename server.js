// Backend CocciGO (login + Inicio / Privado / Admin unificados)
// -------------------------------------------------------------

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path'); // <-- agregado para servir estáticos

// ====== ENV ======
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'aaronshawn6512@gmail.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'AaronShawn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1168492150Mau';

// ====== APP ======
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ====== Static (logo, imgs, css/js futuros) ======
// Colocá tus assets en /public (ej: public/logo.svg)
app.use(express.static(path.join(__dirname, 'public')));

// ====== DB ======
(async () => {
  try {
    if (!MONGO_URI) throw new Error('Falta MONGO_URI');
    await mongoose.connect(MONGO_URI);
    console.log('DB conectada ✅');
  } catch (err) {
    console.error('Error conectando DB:', err.message);
  }
})();

// ====== Model ======
const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'admin' }, // admin / user (por ahora admin)
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

// ====== UI helpers ======
function renderLayout({ title = 'CocciGO', content = '' }) {
  return `
<!doctype html><html lang="es"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  :root{--bg:#0f1115;--panel:#161a22;--muted:#9aa4b2;--text:#eaeef3;--brand:#6e7cff;--ok:#2ecc71;--warn:#ffcc00;--bad:#ff6b6b;}
  *{box-sizing:border-box;font-family:Inter,system-ui,Segoe UI,Arial}
  body{margin:0;background:var(--bg);color:var(--text)}
  a{color:var(--brand);text-decoration:none}
  .container{max-width:1040px;margin:24px auto;padding:0 16px}
  .navbar{background:#0b0e13;border-bottom:1px solid #202633}
  .navwrap{max-width:1040px;margin:0 auto;padding:12px 16px;display:flex;gap:16px;align-items:center;justify-content:space-between}
  .brand{display:flex;gap:10px;align-items:center;font-weight:700}
  .brand img{height:28px}
  .navlinks a{margin:0 10px;color:var(--muted)}
  .btn{background:var(--brand);color:#fff;border:0;padding:10px 14px;border-radius:10px;cursor:pointer}
  .btn.outline{background:transparent;border:1px solid #2a3350}
  .card{background:var(--panel);border:1px solid #222a39;border-radius:16px;padding:18px}
  .grid{display:grid;gap:16px}
  .grid.two{grid-template-columns:1fr}
  @media(min-width:900px){.grid.two{grid-template-columns:1.2fr 1fr}}
  .label{display:block;color:var(--muted);font-size:12px;margin:8px 0 6px}
  .input,.select{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a3350;background:#0e1420;color:var(--text)}
  .table{border-collapse:collapse;width:100%}
  .table td,.table th{border-bottom:1px solid #222a39;padding:10px 8px;text-align:left}
  .h1{font-size:28px;margin:6px 0 4px}
  .small{font-size:12px;color:var(--muted)}
  .right{text-align:right}
  .mt8{margin-top:8px}.mt16{margin-top:16px}.mt24{margin-top:24px}
</style>
</head><body>
  <div class="navbar">
    <div class="navwrap">
      <div class="brand">
        <!-- Logo desde /public: poné public/logo.png -->
        <img src="/logo.png" alt="CocciGO"/>
        <span>CocciGO</span>
      </div>
      <div class="navlinks">
        <a href="/">Inicio</a>
        <a href="/privado">Usuario Privado</a>
        <a href="/admin">Admin</a>
      </div>
    </div>
  </div>
  <div class="container">${content}</div>
</body></html>`;
}

function viewPrivado() {
  return `
  <div class="card">
    <div class="h1">CocciGO</div>
    <div class="small">Elegí un destino puntual, una región o activá "Sorprendeme". Después podés enviar el pedido.</div>

    <div class="grid two mt16">
      <div class="card">
        <label class="label">Destino puntual</label>
        <input class="input" placeholder="Ej: Madrid, París, Roma"/>

        <label class="label">Región</label>
        <select class="select">
          <option>— Seleccionar —</option>
          <option>Europa</option><option>América</option><option>Asia</option>
        </select>

        <label class="label">Modo</label>
        <select class="select">
          <option>Sorprendeme 🪄</option><option>Manual</option>
        </select>

        <label class="label">Presupuesto aprox. (USD, opcional)</label>
        <input class="input" type="number" placeholder="Ej: 600"/>

        <label class="label">Correo</label>
        <input class="input" type="email" placeholder="tu@mail.com"/>

        <button class="btn mt16" disabled>OFF — (placeholder) Bot apagado</button>
      </div>

      <div class="card">
        <div class="h1">Opciones (placeholder)</div>
        <div class="small">Faltan: Vuelos · Hospedajes · Paquetes + campos de origen/destino/fechas/clase/estrellas/cantidad…</div>
      </div>
    </div>

    <div class="card mt16">
      <div class="h1">Agentes trabajando (demo)</div>
      <table class="table small">
        <thead><tr><th>Estado</th><th>Ruta</th><th>Precio</th><th class="right">Acción</th></tr></thead>
        <tbody>
          <tr><td style="color:#2ecc71">Disponible</td><td>Buenos Aires → Miami</td><td>USD 560</td><td class="right"><button class="btn">Reservar</button></td></tr>
          <tr><td style="color:#ff6b6b">Cancelado</td><td>Buenos Aires → Miami</td><td>—</td><td class="right"><button class="btn outline" disabled>Cancelar</button></td></tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

function viewAdmin() {
  return `
  <div class="grid two mt24">
    <div class="card">
      <div class="h1">Otorgar usuario y contraseña</div>
      <div class="small">Alta de usuarios privados (placeholder).</div>
      <form class="mt16">
        <label class="label">mail</label><input class="input" placeholder="correo@dominio.com"/>
        <label class="label">contraseña</label><input class="input" placeholder="••••••••"/>
        <button class="btn mt16" disabled>Crear (placeholder)</button>
      </form>
    </div>
    <div class="card">
      <div class="h1">Banear usuario</div>
      <label class="label">mail</label><input class="input" placeholder="correo@dominio.com"/>
      <button class="btn mt16" style="background:#ff6b6b" disabled>Banear (placeholder)</button>
    </div>
  </div>

  <div class="card mt16">
    <div class="h1">Bots en ejecución (demo)</div>
    <table class="table small">
      <thead><tr><th>Usuario</th><th>Inicio</th><th>Fin</th><th class="right">Acción</th></tr></thead>
      <tbody>
        <tr>
          <td>juan@mail.com</td><td>2025-08-14 10:00</td><td>2025-08-14 10:45</td>
          <td class="right"><button class="btn outline" disabled>Detener (placeholder)</button></td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

// ====== Auth helpers ======
function authRequired(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.redirect('/login');
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.redirect('/login');
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).send('Forbidden');
  next();
}

// ====== Rutas ======

// Home / Inicio (placeholder simple)
app.get('/', (req, res) => {
  const content = `
    <div class="card">
      <div class="h1">Inicio</div>
      <div class="small">Esto queda en blanco por ahora. Después le metemos mensajes lindos 😉</div>
      <div class="mt16">
        <a class="btn outline" href="/login">Entrar (Usuario Privado)</a>
      </div>
    </div>
  `;
  res.send(renderLayout({ title: 'CocciGO — Inicio', content }));
});

// Login (GET)
app.get('/login', (req, res) => {
  const content = `
  <div class="grid two">
    <div class="card">
      <div class="h1">Login</div>
      <form method="post" action="/login" class="mt16">
        <label class="label">Usuario o Email</label>
        <input class="input" type="text" name="usernameOrEmail" placeholder="tu usuario o email" autocomplete="username"/>
        <label class="label">Contraseña</label>
        <input class="input" type="password" name="password" placeholder="••••••••" autocomplete="current-password"/>
        <button class="btn mt16" type="submit">Entrar</button>
      </form>
      <div class="small mt16">Si no recordás tus credenciales, pedilas al admin.</div>
    </div>

    <div class="card">
      <div class="h1">Accesos rápidos (demo)</div>
      <div class="small">Usuario Admin (seed):</div>
      <div class="small">usuario/email: <b>${ADMIN_USERNAME}</b> ó <b>${ADMIN_EMAIL}</b></div>
      <div class="small">pass: <b>${ADMIN_PASSWORD}</b></div>
    </div>
  </div>`;
  res.send(renderLayout({ title: 'CocciGO — Login', content }));
});

// Login (POST)
app.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body || {};
  try {
    const user = await User.findOne({
      $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });
    if (!user) return res.send(renderLayout({ title: 'Login', content: `<div class="card">Usuario no encontrado.</div>` }));

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.send(renderLayout({ title: 'Login', content: `<div class="card">Contraseña incorrecta.</div>` }));

    const token = jwt.sign(
      { sub: user._id.toString(), username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    const secureFlag = true; // en Render con HTTPS podemos usar secure
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: secureFlag });

    if (user.role === 'admin') return res.redirect('/admin');
    return res.redirect('/privado');
  } catch (err) {
    console.error('Error en /login:', err);
    return res.status(500).send('Error del servidor');
  }
});

// Logout
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// Redirección “/dashboard” → por rol
app.get('/dashboard', authRequired, (req, res) => {
  if (req.user.role === 'admin') return res.redirect('/admin');
  return res.redirect('/privado');
});

// Usuario Privado
app.get('/privado', authRequired, (req, res) => {
  const content = viewPrivado();
  res.send(renderLayout({ title: 'CocciGO — Usuario Privado', content }));
});

// Panel Admin (incluye Privado + Admin)
app.get('/admin', authRequired, adminOnly, (req, res) => {
  const content = `${viewPrivado()}${viewAdmin()}`;
  res.send(renderLayout({ title: 'CocciGO — Admin', content }));
});

// ====== Seed admin (una vez) ======
(async () => {
  try {
    const exists = await User.findOne({ email: ADMIN_EMAIL });
    if (!exists) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await User.create({
        email: ADMIN_EMAIL,
        username: ADMIN_USERNAME,
        passwordHash,
        role: 'admin',
      });
      console.log('✅ Admin creado:', ADMIN_EMAIL);
    } else {
      console.log('Admin ya existe:', ADMIN_EMAIL);
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
})();

// ====== Start ======
app.listen(PORT, () => {
  console.log(`Servidor escuchando en ${PORT}`);
});
