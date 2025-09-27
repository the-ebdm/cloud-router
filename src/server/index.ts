import express from "express";
import db from "@/lib/database";

import { runMigrations } from "@/lib/database/migration";

await runMigrations(db);

const app = express();

app.get('/status', (req, res) => {
  res.send("OK");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port " + (process.env.PORT || 3000));
});