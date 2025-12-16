const BASE_PATH = "/usr/417";

const express = require("express");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcrypt");
require("dotenv").config();

const db = require("./db");

const app = express();
const PORT = 8000;

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));

// ✅ Static MUST be under BASE_PATH on Goldsmiths
app.use(BASE_PATH, express.static(path.join(__dirname, "public")));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "coursework-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// ✅ Globals for EJS links
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.basePath = BASE_PATH;
  next();
});

// ✅ Put ALL routes under BASE_PATH
const router = express.Router();

/* Home */
router.get("/", async (req, res) => {
  if (!req.session.user) return res.render("index", { logs: [] });

  try {
    const [logs] = await db.query(
      "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 7",
      [req.session.user.user_id]
    );
    res.render("index", { logs });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

/* About */
router.get("/about", (req, res) => res.render("about"));

/* Register */
router.get("/register", (req, res) => res.render("register", { error: null }));

router.post("/register", async (req, res) => {
  const { username, display_name, password } = req.body;
  if (!username || !display_name || !password) {
    return res.render("register", { error: "All fields required." });
  }

  try {
    const [existing] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (existing.length) {
      return res.render("register", { error: "Username already taken." });
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      "INSERT INTO users (username, password_hash, display_name, created_at_
