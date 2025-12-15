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
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "coursework-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Globals for EJS
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.basePath = BASE_PATH;
  next();
});

/* =========================
   ROUTES (ALL UNDER /usr/147)
   ========================= */

// Home
app.get(`${BASE_PATH}/`, async (req, res) => {
  if (!req.session.user) {
    return res.render("index", { logs: [] });
  }

  const [logs] = await db.query(
    "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 7",
    [req.session.user.user_id]
  );

  res.render("index", { logs });
});

// About
app.get(`${BASE_PATH}/about`, (req, res) => {
  res.render("about");
});

// Register
app.get(`${BASE_PATH}/register`, (req, res) => {
  res.render("register", { error: null });
});

app.post(`${BASE_PATH}/register`, async (req, res) => {
  const { username, display_name, password } = req.body;

  if (!username || !display_name || !password) {
    return res.render("register", { error: "All fields required." });
  }

  const [existing] = await db.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );

  if (existing.length) {
    return res.render("register", { error: "Username already taken." });
  }

  const hash = await bcrypt.hash(password, 12);

  const [result] = await db.query(
    "INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?, ?, ?, NOW())",
    [username, hash, display_name]
  );

  req.session.user = {
    user_id: result.insertId,
    username,
    display_name,
  };

  res.redirect(`${BASE_PATH}/`);
});

// Login
app.get(`${BASE_PATH}/login`, (req, res) => {
  res.render("login", { error: null });
});

app.post(`${BASE_PATH}/login`, async (req, res) => {
  const { username, password } = req.body;

  const [users] = await db.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );

  if (!users.length) {
    return res.render("login", { error: "Invalid credentials." });
  }

  const user = users[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    return res.render("login", { error: "Invalid credentials." });
  }

  req.session.user = {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
  };

  res.redirect(`${BASE_PATH}/`);
});

// Logout
app.get(`${BASE_PATH}/logout`, (req, res) => {
  req.session.destroy(() => res.redirect(`${BASE_PATH}/`));
});

// Recipes
app.get(`${BASE_PATH}/recipes`, async (req, res) => {
  const search = req.query.q || "";

  let recipes;
  if (search) {
    const like = `%${search}%`;
    [recipes] = await db.query(
      "SELECT * FROM recipes WHERE title LIKE ? OR summary LIKE ? OR main_tag LIKE ?",
      [like, like, like]
    );
  } else {
    [recipes] = await db.query("SELECT * FROM recipes");
  }

  res.render("recipes", { recipes, search });
});

// Start server (Apache proxy compatible)
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Running on http://127.0.0.1:${PORT}`);
});
