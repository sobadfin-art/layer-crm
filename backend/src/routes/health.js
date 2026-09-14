import { Router } from "express";
import { query } from "../lib/db.js";

export const healthRouter = Router();

healthRouter.get("/", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
