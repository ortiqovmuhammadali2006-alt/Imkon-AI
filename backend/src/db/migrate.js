require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const connection = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

async function ensureDatabase() {
  const client = new Client({ ...connection, database: "postgres" });
  await client.connect();
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    process.env.DB_NAME,
  ]);
  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
    console.log(`Baza yaratildi: ${process.env.DB_NAME}`);
  }
  await client.end();
}

async function run() {
  await ensureDatabase();

  const client = new Client({ ...connection, database: process.env.DB_NAME });
  await client.connect();

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await client.query(schema);
  console.log("Jadvallar tayyor");

  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  const { rowCount } = await client.query("SELECT 1 FROM users WHERE role = 'admin'");
  if (rowCount === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await client.query(
      "INSERT INTO users (full_name, username, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      ["Administrator", ADMIN_USERNAME, hash]
    );
    console.log(`Admin yaratildi: ${ADMIN_USERNAME}`);
  }

  await client.end();
}

run().catch((err) => {
  console.error("Migratsiya xatosi:", err.message);
  process.exit(1);
});
