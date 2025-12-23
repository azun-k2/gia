const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
const STATIC_DIR = path.join(__dirname, "public");
app.use(express.static(STATIC_DIR));

const ADMIN_KEY = process.env.ADMIN_KEY || "123456";
const DATA_DIR = process.env.GOLD_TV_DATA_DIR || (process.pkg ? process.cwd() : __dirname);
fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, "data.json");

/* ---------- helpers ---------- */
function decodeData(raw) {
  try {
    // try plain JSON first (backward compatible)
    return JSON.parse(raw);
  } catch (_) {
    // fallback to base64 encoded JSON
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    return JSON.parse(decoded);
  }
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = decodeData(raw);
      return {
        updatedAt: new Date().toISOString(),
        ...data
      };
    }
  } catch (err) {
    console.error("❌ Failed to load data.json:", err);
  }

  // fallback default
  return {
    updatedAt: new Date().toISOString(),
    company: "DNTN KINH DOANH VÀNG",
    title: "BẢNG GIÁ VÀNG",
    unit: "VND/chi",
    note: "Kính Chào Quý Khách !",
    rightImage: "/assets/right-logo.jpg",
    items: []
  };
}

function saveData(state) {
  const { updatedAt, ...toSave } = state;
  const json = JSON.stringify(toSave, null, 2);
  const encoded = Buffer.from(json, "utf-8").toString("base64");
  fs.writeFileSync(DATA_FILE, encoded, "utf-8");
}

/* ---------- state ---------- */
let goldState = loadData();

/* ---------- realtime ---------- */
function broadcast() {
  io.emit("gold:update", goldState);
}

/* ---------- API ---------- */
app.get("/api/state", (req, res) => {
  res.json({ ok: true, data: goldState });
});

app.post("/api/update", (req, res) => {
  const { key, ...payload } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  goldState = {
    ...goldState,
    ...payload,
    updatedAt: new Date().toISOString()
  };

  saveData(goldState);
  broadcast();

  res.json({ ok: true, data: goldState });
});

/* ---------- socket ---------- */
io.on("connection", (socket) => {
  socket.emit("gold:update", goldState);
});

/* ---------- start ---------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("✅ Gold TV running");
  console.log(`📺 TV:    http://localhost:${PORT}/tv.html`);
  console.log(`📱 Admin: http://localhost:${PORT}/admin.html`);
});
