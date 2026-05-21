// Script para criar o primeiro usuário admin e registrar o dispositivo Android
// Uso: npx ts-node src/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // ── Criar usuário admin ────────────────────────────────────────────
  const adminEmail = 'admin@suaempresa.com.br';
  const adminPassword = 'TroqueEssaSenha@2024'; // ALTERE ANTES DE USAR

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        id: uuidv4(),
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`✅ Usuário admin criado: ${adminEmail}`);
    console.log(`   Senha: ${adminPassword}`);
    console.log(`   ⚠️  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!`);
  } else {
    console.log(`ℹ️  Usuário admin já existe: ${adminEmail}`);
  }

  // ── Registrar dispositivo Android ──────────────────────────────────
  const deviceToken = process.env.DEVICE_API_TOKEN;

  if (!deviceToken) {
    console.error('❌ DEVICE_API_TOKEN não definido no .env');
    process.exit(1);
  }

  const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

  const existingDevice = await prisma.device.findFirst({ where: { tokenHash } });

  if (!existingDevice) {
    await prisma.device.create({
      data: {
        id: uuidv4(),
        name: 'android-01',
        tokenHash,
        active: true,
      },
    });
    console.log(`✅ Dispositivo android-01 registrado`);
    console.log(`   Token: ${deviceToken}`);
  } else {
    console.log(`ℹ️  Dispositivo já registrado`);
  }

  console.log('\n🚀 Setup concluído! Inicie a API com: npm start');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
