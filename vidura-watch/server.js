// server.js
// Entry point. Serves the static frontend from /public and mounts the
// three API route groups. Run with: npm start (see README.md).

require("dotenv").config();
console.log(
  "Anthropic key check:",
  !!process.env.ANTHROPIC_API_KEY,
  "prefix:",
  process.env.ANTHROPIC_API_KEY?.slice(0, 12),
  "length:",
  process.env.ANTHROPIC_API_KEY?.length
);
const express = require("express");
const cors = require("cors");
const path = require("path");

const usersRouter = require("./routes/users");
const reportsRouter = require("./routes/reports");
const votesRouter = require("./routes/votes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/votes", votesRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Vidura's Watch running at http://localhost:${PORT}`);
});
