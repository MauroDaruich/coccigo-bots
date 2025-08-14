// Crea usuario admin si no existe
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'aaronshawn6512@gmail.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'AaronShawn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1168492150Mau';

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

(async () => {
  try {
    if (!MONGO_URI) throw new Error('Falta MONGO_URI');

    await mongoose.connect(MONGO_URI);
    console.log('Conectado a MongoDB');

    const exists = await User.findOne({ email: ADMIN_EMAIL });
    if (exists) {
      console.log('Admin ya existe:', exists.email);
      await mongoose.disconnect();
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      email: ADMIN_EMAIL,
      username: ADMIN_USERNAME,
      passwordHash,
      role: 'admin'
    });

    console.log('✅ Admin creado:', ADMIN_EMAIL);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en seed_admin:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
