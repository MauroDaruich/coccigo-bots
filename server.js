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
  <html lang="es"><head><meta charset="utf-8"><title>Login</title></head>
  <body style="font-family:sans-serif;max-width:480px;margin:40px auto;">
    <h2>Login de prueba</h2>
    <form method="POST" action="/login">
      <label>Usuario o Email</label><br/>
      <input name="identifier" placeholder="AaronShawn o aaron...@gmail.com" required style="width:100%;padding:8px"/><br/><br/>
      <label>Contraseña</label><br/>
      <input name="password" type="password" required style="width:100%;padding:8px"/><br/><br/>
      <button type="submit" style="padding:8px 12px;">Entrar</button>
    </form>
    <p style="margin-top:16px;color:#666">Probá con:<br/>Usuario: <b>AaronShawn</b> (o email)<br/>Pass: <b>1168492150Mau</b></p>
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
