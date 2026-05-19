// src/prisma.js
//
// This file creates ONE shared Prisma client for the entire app.
//
// Why not just do `new PrismaClient()` in every file?
// Because each PrismaClient opens a connection to the database.
// If you create one in every file, you'll have dozens of open connections — bad!
// By exporting a single instance from here, every file shares the same connection.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
