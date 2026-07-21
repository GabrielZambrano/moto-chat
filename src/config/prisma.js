'use strict';
// Cliente Prisma singleton (reemplaza a src/config/firebase.js)
const { PrismaClient } = require('@prisma/client');

const prisma = global.__mototaxiPrisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV === 'development') {
  global.__mototaxiPrisma = prisma;
}

module.exports = { prisma };
