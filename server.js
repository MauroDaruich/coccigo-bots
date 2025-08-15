// CocciGO — Backend real (auth + privado/admin + requests/offers + bots reales)
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'aaronshawn6512@gmail.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'AaronShawn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1168492150Mau';

const PROVIDER_VUELOS_URL   = process.env.PROVIDER_VUELOS_URL   || '';
const PROVIDER_HOTELES_URL  = process.env.PROVIDER_HOTELES_URL  || '';
const PROVIDER_PAQUETES_URL = process.env.PROVIDER_PAQUETES_URL || '';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

(async () => {
  if (!MONGO_URI) { console.error('Falta MONGO_URI'); process.exit(1); }
  await mongoose.connect(MONGO_URI);
  console.log('DB conectada ✅');
})();

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','user'], default: 'user' },
  banned: { type: Boolean, default: false }
},{timestamps:true});

const requestSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId,
  modalidad: { type:String, enum:['vuelos','hospedajes','paquetes'], required:true },
  origen: String, destino: String, sorprendeme: Boolean,
  ingreso: String, egreso: String, pax: Number, clase: String, estrellas: String,
  budget: String, email: String, modo: String,
  status: { type:String, enum:['pendiente','buscando','finalizado','cancelado'], default:'pendiente' }
},{timestamps:true});

const offerSchema = new mongoose.Schema({
  requestId: { type: mongoose.Types.ObjectId, index:true },
  modalidad: String, rutaODestino: String, fecha: String, clase: String, pax: Number,
  precioUSD: Number,
  estado: { type:String, enum:['Disponible','Reservado','Cancelado'], default:'Disponible' }
},{timestamps:true});

const botRunSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId, requestId: mongoose.Types.ObjectId,
  provider: String, start: Date, end: Date,
  status: { type:String, enum:['running','stopped','done','error'], default:'running' },
  error: String
},{timestamps:true});

const User   = mongoose.model('User', userSchema);
const Request= mongoose.model('Request', requestSchema);
const Offer  = mongoose.model('Offer', offerSchema);
const BotRun = mongoose.model('BotRun', botRunSchema);

(async () => {
  const exists = await User.findOne({ email: ADMIN_EMAIL });
  if (!exists) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({ email:ADMIN_EMAIL, username:ADMIN_USERNAME, passwordHash, role:'admin' });
    console.log('✅ Admin creado:', ADMIN_EMAIL);
  }
})();

function authRequired(req, res, next){
  try{
    const token = req.cookies?.token;
    if(!token) return res.redirect('/login');
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    if (payload.banned) return res.status(403).send('Cuenta baneada.');
    next();
  }catch{ return res.redirect('/login'); }
}
function adminOnly(req,res,next){
  if(req.user?.role !== 'admin') return res.status(403).send('Forbidden');
  next();
}

function layout({ title='CocciGO', body='' }){
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#0f1217;--panel:#171b22;--muted:#9aa4b2;--text:#e7ecf3;--brand:#62e3ff;--brand2:#ff5b8a;--stroke:#2a3240;--chip:#1d232f;--ok:#22c55e;--bad:#ef4444}
*{box-sizing:border-box}body{margin:0;background:#0c1015;color:var(--text);font-family:Inter,system-ui,Segoe UI,Arial}
.wrap{max-width:1100px;margin:0 auto;padding:28px 18px 80px}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:12px}
.brand img{height:26px}
.brand .sr{position:absolute;left:-9999px}
nav a{color:var(--muted);text-decoration:none;margin-left:14px;padding:8px 10px;border-radius:10px}
nav a.active,nav a:hover{background:var(--chip);color:var(--text)}
.card{background:var(--panel);border:1px solid var(--stroke);border-radius:16px;padding:18px}
.grid{display:grid;gap:16px}.g2{grid-template-columns:1fr 1fr}
label{font-size:12px;color:var(--muted);display:block;margin-bottom:6px}
input,select,button{width:100%;background:#0f141c;color:var(--text);border:1px solid var(--stroke);border-radius:12px;padding:10px 12px}
.btn{cursor:pointer;font-weight:600}
.btnp{background:linear-gradient(90deg,var(--brand),var(--brand2));border:0;color:#0a0e14}
.btng{background:var(--chip)}
.btnd{background:#2a1216;border-color:#4d1d22;color:#ff9aa8}
.tabs{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.tab{padding:8px 12px;border:1px solid var(--stroke);border-radius:999px;background:var(--chip);color:var(--muted);cursor:pointer;font-size:13px}
.tab.on{color:#0a0e14;background:linear-gradient(90deg,var(--brand),var(--brand2));border:0}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:12px;border-bottom:1px solid var(--stroke);text-align:left}
.status.ok{color:var(--ok)}.status.bad{color:var(--bad)}.status.idle{color:#eab308}
@media(max-width:900px){.g2{grid-template-columns:1fr}}
</style>
</head><body>
<div class="wrap">
<header>
  <div class="brand">
    <img src="/logo.png" alt="CocciGO"><span class="sr">CocciGO</span>
  </div>
  <nav>
    <a href="/" data-k="home">Inicio</a>
    <a href="/privado" data-k="priv">Usuario Privado</a>
  </nav>
</header>
${body}
</div>
<script>(function(){const p=(location.pathname||"/").toLowerCase();const m={"/":"home","/inicio":"home","/privado":"priv","/admin":"priv"};const k=m[p]||"home";document.querySelectorAll('nav a').forEach(a=>{if(a.dataset.k===k)a.classList.add("active")});})();</script>
</body></html>`;
}

function viewHome(){ return layout({ title:'CocciGO — Inicio', body: `
  <div class="card">
    <h2 style="margin:6px 0 8px 0">Inicio</h2>
    <p style="color:#9aa4b2;margin:0 0 10px 0">Esto queda en blanco por ahora. Después le metemos mensajes lindos 🙂</p>
    <a class="btng btn" style="width:auto" href="/login">Entrar (Usuario Privado)</a>
  </div>`});
}

function viewLogin(){ return layout({ title:'CocciGO — Login', body: `
  <div class="card" style="max-width:560px">
    <h2 style="margin:6px 0 8px 0">Login</h2>
    <form method="post" action="/login" style="display:grid;gap:10px">
      <div><label>Usuario o Email</label><input name="usernameOrEmail" autocomplete="username" required></div>
      <div><label>Contraseña</label><input type="password" name="password" autocomplete="current-password" required></div>
      <button class="btn btnp" style="width:auto">Entrar</button>
    </form>
  </div>`});
}

function viewPrivado(){ return layout({ title:'CocciGO — Privado', body: `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 style="margin:6px 0 8px 0">Panel privado</h2>
      <form method="post" action="/logout"><button class="btng btn" style="width:auto">Salir</button></form>
    </div>

    <div class="tabs" id="tabs">
      <button class="tab on" data-m="vuelos">Vuelos</button>
      <button class="tab" data-m="hospedajes">Hospedajes</button>
      <button class="tab" data-m="paquetes">Paquetes</button>
    </div>

    <form id="f" class="g2" style="display:grid">
      <input type="hidden" name="modalidad" value="vuelos">
      <div><label>Origen (opcional)</label><input name="origen" placeholder="Ciudad/país/continente"></div>
      <div data-f="dest"><label>Destino (o activá Sorprendeme)</label><input name="destino" placeholder="Madrid, París..."></div>
      <div><label>Fecha ingreso</label><input type="date" name="ingreso"></div>
      <div><label>Fecha egreso</label><input type="date" name="egreso"></div>
      <div><label>Personas</label><input type="number" name="pax" min="1" placeholder="2"></div>
      <div data-f="clase"><label>Clase (vuelos/paquetes)</label>
        <select name="clase"><option value="">Cualquiera</option><option>turista</option><option>business</option><option>first</option></select>
      </div>
      <div data-only="hospedajes" style="display:none"><label>Tipo hospedaje</label>
        <select name="tipoHospedaje"><option value="">Cualquiera</option><option>Hotel</option><option>Departamento</option><option>Casa</option><option>Quinta</option></select>
      </div>
      <div data-only="hospedajes" style="display:none"><label>Estrellas</label>
        <select name="estrellas"><option value="">Cualquiera</option><option>1★</option><option>2★</option><option>3★</option><option>4★</option><option>5★</option></select>
      </div>
      <div><label>Budget (USD, opcional)</label><input name="budget" placeholder="600"></div>
      <div><label>Correo</label><input type="email" name="email" placeholder="tu@mail.com"></div>
      <div><label>Modo</label><select name="modo"><option value="normal">Normal</option><option value="sorprendeme">Sorprendeme</option></select></div>
      <div><label>—</label><label style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" name="sorprendeme"> Sorprendeme ✨</label></div>
      <div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btnp" style="width:auto">Enviar pedido</button>
      </div>
    </form>
  </div>

  <div class="card" style="margin-top:16px">
    <h2 style="margin:6px 0 8px 0">Agentes trabajando</h2>
    <div style="overflow:auto">
      <table id="tbl"><thead>
        <tr><th>Estado</th><th>Tipo</th><th>Ruta / Destino</th><th>Fecha</th><th>Clase</th><th>Pax</th><th>Precio</th><th></th></tr>
      </thead><tbody></tbody></table>
    </div>
  </div>

  <script>
  (function(){
    const tabs=document.querySelectorAll('#tabs .tab');
    const f=document.getElementById('f');
    const dest=f.querySelector('[data-f="dest"]');
    const clase=f.querySelector('[data-f="clase"]');
    function apply(mode){
      f.modalidad.value=mode;
      const showFly=(mode==='vuelos'||mode==='paquetes');
      dest.style.display=showFly?'':'none';
      clase.style.display=showFly?'':'none';
      document.querySelectorAll('[data-only]').forEach(el=>{
        el.style.display=(el.getAttribute('data-only')===mode)?'':'none';
      });
    }
    tabs.forEach(t=>t.addEventListener('click',()=>{tabs.forEach(x=>x.classList.remove('on'));t.classList.add('on');apply(t.dataset.m);}));
    apply('vuelos');

    f.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data=Object.fromEntries(new FormData(f).entries());
      data.sorprendeme = data.sorprendeme==='on';
      const r = await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(!r.ok){alert('Error creando pedido');return;}
      loadOffers();
    });

    async function loadOffers(){
      const r = await fetch('/api/offers'); if(!r.ok)return;
      const rows = await r.json(); const tb=document.querySelector('#tbl tbody'); tb.innerHTML='';
      rows.forEach(o=>{
        const tr=document.createElement('tr');
        tr.innerHTML=\`
          <td><span class="status \${o.estado==='Disponible'?'ok':(o.estado==='Cancelado'?'bad':'idle')}">\${o.estado}</span></td>
          <td>\${o.modalidad}</td>
          <td>\${o.rutaODestino||'—'}</td>
          <td>\${o.fecha||'—'}</td>
          <td>\${o.clase||'—'}</td>
          <td>\${o.pax||'—'}</td>
          <td>\${o.precioUSD?('USD '+o.precioUSD):'—'}</td>
          <td>
            \${o.estado==='Disponible'
              ? '<button class="btng btn" data-a="reserve" data-id="'+o._id+'" style="width:auto">Reservar</button>'
              : '<button class="btnd btn" data-a="cancel" data-id="'+o._id+'" style="width:auto">Cancelar</button>'}
          </td>\`;
        tb.appendChild(tr);
      });
    }
    loadOffers(); setInterval(loadOffers, 5000);

    document.getElementById('tbl').addEventListener('click', async (e)=>{
      const b=e.target.closest('button'); if(!b) return;
      const id=b.getAttribute('data-id'); const a=b.getAttribute('data-a');
      const r=await fetch('/api/offers/'+id+'/'+(a==='reserve'?'reserve':'cancel'),{method:'POST'}); loadOffers();
    });
  })();
  </script>
`});}

function viewAdmin(){
  const priv = viewPrivado();
  const bodyOnly = priv.replace(/^.*?<div class="wrap">/s,'').replace(/<\/div>\s*<script>[\s\S]*$/s,'');
  return layout({ title:'CocciGO — Admin', body: `
  ${bodyOnly}
  <div class="card" style="margin-top:16px">
    <h2>Admin</h2>
    <div class="grid g2">
      <div class="card">
        <h3>Crear usuario</h3>
        <form id="cu" style="display:grid;gap:10px">
          <div><label>mail</label><input name="mail" type="email" required></div>
          <div><label>usuario</label><input name="user" required></div>
          <div><label>contraseña</label><input name="pass" type="password" required></div>
          <button class="btn btnp" style="width:auto">Crear</button>
        </form>
      </div>
      <div class="card">
        <h3>Banear usuario</h3>
        <form id="bu" style="display:grid;gap:10px">
          <div><label>mail</label><input name="mail" type="email" required></div>
          <button class="btn btnd" style="width:auto">Banear</button>
        </form>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Bots</h3>
      <div id="bots" class="small" style="color:#9aa4b2">Cargando…</div>
    </div>
  </div>
  <script>
    document.getElementById('cu').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target).entries());const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});alert(r.ok?'Creado':'Error');});
    document.getElementById('bu').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target).entries());const r=await fetch('/api/admin/ban',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});alert(r.ok?'Baneado':'Error');});
    async function loadBots(){const r=await fetch('/api/admin/bots'); if(!r.ok)return; const a=await r.json(); document.getElementById('bots').textContent= a.length? a.map(b=>\`\${b.provider} — \${b.status} — \${new Date(b.start).toLocaleString()}\`).join('\\n') : 'Sin bots activos';}
    loadBots(); setInterval(loadBots,4000);
  </script>
`});
}

app.get('/', (req,res)=>res.send(viewHome()));
app.get('/login', (req,res)=>res.send(viewLogin()));
app.post('/login', async (req,res)=>{
  const { usernameOrEmail, password } = req.body||{};
  const user = await User.findOne({ $or:[{email:usernameOrEmail},{username:usernameOrEmail}] });
  if(!user) return res.send(viewLogin());
  if(user.banned) return res.status(403).send('Cuenta baneada');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if(!ok) return res.send(viewLogin());
  const token = jwt.sign({ sub:user._id.toString(), username:user.username, role:user.role, banned:user.banned }, JWT_SECRET, { expiresIn:'6h' });
  res.cookie('token', token, { httpOnly:true, sameSite:'lax', secure:true });
  return res.redirect(user.role==='admin'?'/admin':'/privado');
});
app.post('/logout', (req,res)=>{res.clearCookie('token');res.redirect('/login');});
app.get('/dashboard', authRequired, (req,res)=>res.redirect(req.user.role==='admin'?'/admin':'/privado'));
app.get('/privado', authRequired, (req,res)=>res.send(viewPrivado()));
app.get('/admin', authRequired, adminOnly, (req,res)=>res.send(viewAdmin()));

app.post('/api/requests', authRequired, async (req,res)=>{
  const r = await Request.create({
    userId:req.user.sub, modalidad:req.body.modalidad,
    origen:req.body.origen||'', destino:req.body.destino||'',
    sorprendeme:!!req.body.sorprendeme, ingreso:req.body.ingreso||'', egreso:req.body.egreso||'',
    pax:Number(req.body.pax||0)||null, clase:req.body.clase||'', estrellas:req.body.estrellas||'',
    budget:req.body.budget||'', email:req.body.email||'', modo:req.body.modo||'normal', status:'buscando'
  });
  runBotForRequest(r).catch(err=>console.error('Bot error:',err));
  res.json({ ok:true, requestId:r._id });
});

app.get('/api/offers', authRequired, async (req,res)=>{
  const reqs = await Request.find({ userId:req.user.sub }).select('_id modalidad');
  const ids = reqs.map(x=>x._id);
  const rows = await Offer.find({ requestId:{$in:ids} }).sort({createdAt:-1}).limit(300);
  res.json(rows);
});
app.post('/api/offers/:id/reserve', authRequired, async (req,res)=>{
  await Offer.findByIdAndUpdate(req.params.id, { estado:'Reservado' }); res.json({ ok:true });
});
app.post('/api/offers/:id/cancel',  authRequired, async (req,res)=>{
  await Offer.findByIdAndUpdate(req.params.id, { estado:'Cancelado'  }); res.json({ ok:true });
});

app.post('/api/admin/users', authRequired, adminOnly, async (req,res)=>{
  const { mail, user, pass } = req.body||{};
  const exists = await User.findOne({ $or:[{email:mail},{username:user}] });
  if(exists) return res.status(409).json({ ok:false, msg:'Ya existe' });
  const passwordHash = await bcrypt.hash(pass,10);
  await User.create({ email:mail, username:user, passwordHash, role:'user' });
  res.json({ ok:true });
});
app.post('/api/admin/ban', authRequired, adminOnly, async (req,res)=>{
  const { mail } = req.body||{}; await User.findOneAndUpdate({ email:mail }, { banned:true }); res.json({ ok:true });
});
app.get('/api/admin/bots', authRequired, adminOnly, async (req,res)=>{
  const rows = await BotRun.find({}).sort({createdAt:-1}).limit(50); res.json(rows);
});

async function runBotForRequest(reqDoc){
  const { modalidad } = reqDoc;
  let url = modalidad==='vuelos' ? PROVIDER_VUELOS_URL
          : modalidad==='hospedajes' ? PROVIDER_HOTELES_URL
          : PROVIDER_PAQUETES_URL;
  const providerName = modalidad.toUpperCase();

  const bot = await BotRun.create({ userId:reqDoc.userId, requestId:reqDoc._id, provider:providerName, start:new Date(), status:'running' });

  if(!url){
    await BotRun.findByIdAndUpdate(bot._id, { status:'error', end:new Date(), error:'URL de proveedor no configurada' });
    await Request.findByIdAndUpdate(reqDoc._id, { status:'cancelado' });
    return;
  }

  try{
    const payload = {
      modalidad:reqDoc.modalidad, origen:reqDoc.origen, destino:reqDoc.destino, sorprendeme:reqDoc.sorprendeme,
      ingreso:reqDoc.ingreso, egreso:reqDoc.egreso, pax:reqDoc.pax, clase:reqDoc.clase, estrellas:reqDoc.estrellas,
      budget:reqDoc.budget, email:reqDoc.email, modo:reqDoc.modo,
      requestId:String(reqDoc._id), userId:String(reqDoc.userId)
    };

    const resp = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    if(!resp.ok){ throw new Error('Proveedor ' + providerName + ' status ' + resp.status); }
    const data = await resp.json();
    const offers = Array.isArray(data) ? data : (Array.isArray(data.offers) ? data.offers : []);

    for(const o of offers){
      await Offer.create({
        requestId: reqDoc._id,
        modalidad,
        rutaODestino: o.rutaODestino || o.ruta || o.destino || '',
        fecha: o.fecha || '',
        clase: o.clase || '',
        pax: Number(o.pax||reqDoc.pax||1),
        precioUSD: Number(o.precioUSD||o.precio||0) || null,
        estado: o.estado || 'Disponible'
      });
    }

    await Request.findByIdAndUpdate(reqDoc._id, { status:'finalizado' });
    await BotRun.findByIdAndUpdate(bot._id, { status:'done', end:new Date() });
  }catch(err){
    await BotRun.findByIdAndUpdate(bot._id, { status:'error', end:new Date(), error:String(err.message||err) });
    await Request.findByIdAndUpdate(reqDoc._id, { status:'cancelado' });
  }
}

app.listen(PORT, ()=>console.log(`Servidor escuchando en ${PORT}`));
