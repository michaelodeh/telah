import { Client } from "pg";
const db = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: true,
});

const rowCount = (rowCount: number | null): number => {
  if (rowCount == null) return 0;
  return rowCount;
};

export default db;

export { rowCount };
