import { config } from "dotenv";
config();
import express from "express";
import cors from "cors";
import pg from "pg";
import sheet from "./sheetsService.mjs";

const { Pool } = pg;
const app = express();
const port = 5555;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (error) => console.error("[v0] Neon database error:", error));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "neon" });
  } catch (error) {
    console.error("[v0] Database health check failed:", error);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

const corsOptions = {
  origin: ["https://hackatank.tech", "http://localhost:4444"],
};
app.use(express.json());
app.post("/api/verify", async (req, res) => {
  const id = Number.parseInt(req.body.id, 10);
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
  const authEmail = typeof req.body.authemail === "string" ? req.body.authemail.trim() : "";

  if (!Number.isInteger(id) || !code || !authEmail) {
    return res.status(400).json({ error: "Invalid verification request" });
  }

  try {
    const result = await pool.query(
      "SELECT id, name FROM qr_details WHERE id = $1",
      [id]
    );
    const response = result.rows[0];

    if (!response) {
      return res.status(404).json({ error: "Not found", id });
    }

    const timestamp = new Date().toISOString();
    await pool.query(
      "INSERT INTO attendance_logs (qr_id, name, code, auth_email, created_at) VALUES ($1, $2, $3, $4, $5)",
      [id, response.name, code, authEmail, timestamp]
    );

    await sheet([[id, timestamp, response.name, code, authEmail]]);
    return res.status(200).json({ name: response.name, id, code });
  } catch (error) {
    console.error("[v0] Verification request failed:", error);
    return res.status(500).json({ error: "Verification service unavailable" });
  }
});

app.listen(port, () => console.log("Server Started on port: ", port));
