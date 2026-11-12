import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Check your .env file.");
  process.exit(1);
}

const app = express();
const TABLE = "maintenance_requests";
const STATUSES = ["submitted", "in_progress", "completed"];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});