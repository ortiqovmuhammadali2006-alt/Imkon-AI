const { Pool, types } = require("pg");

// DATE ustunlarini "YYYY-MM-DD" satr ko'rinishida qaytarish (vaqt zonasi siljishining oldini oladi)
types.setTypeParser(1082, (value) => value);
// NUMERIC (pul summalari) ni son sifatida qaytarish
types.setTypeParser(1700, (value) => parseFloat(value));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Bir nechta so'rovni bitta tranzaksiyada bajarish
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.withTransaction = withTransaction;
