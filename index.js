const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
require("dotenv").config();

const pool = require("./db");

const app = express();

const basePath = process.env.BASE_PATH || ""; // e.g. "/usr/147" on Gold, "" locally

// EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Parse forms
app.use(express.urlencoded({ extended: false }));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretchangeme",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Gold doc site is https, but your app may be behind proxy; keep false for coursework
    },
  })
);

// Make basePath + currentUser available to ALL templates
app.use((req, res, next) => {
  res.locals.basePath = basePath;
  res.locals.currentUser = req.session.user || null;
  next();
});

// Static files must also be under basePath
app.use(basePath, express.static(path.join(__dirname, "public")));

// Helper for redirects that respect basePath
const to = (p) => `${basePath}${p.startsWith("/") ? p : "/" + p}`;

// ROUTES (mounted under basePath manually for simplicity)
app.get(to("/"), async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("index", { logs: [] });
    }

    // If your table/columns differ, tell me and I’ll adjust.
    const [rows] = await pool.query(
      `
      SELECT log_date, sleep_hours, movement_minutes, mood_score, energy_score, craving_level
      FROM daily_logs
      WHERE user_id = ?
      ORDER BY log_date DESC
      LIMIT 7
      `,
      [req.session.user.id]
    );

    res.render("index", { logs: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get(to("/about"), (req, res) => res.render("about"));

app.get(to("/recipes"), async (req, res) => {
  try {
    const search = (req.query.q || "").trim();
    let rows;

    if (search) {
      [rows] = await pool.query(
        `
        SELECT id, title, summary, difficulty, prep_time_minutes, main_tag
        FROM recipes
        WHERE is_pcos_friendly = TRUE
          AND (title LIKE ? OR summary LIKE ? OR main_tag LIKE ?)
        ORDER BY id DESC
        `,
        [`%${search}%`, `%${search}%`, `%${search}%`]
      );
    } else {
      [rows] = await pool.query(
        `
        SELECT id, title, summary, difficulty, prep_time_minutes, main_tag
        FROM recipes
        WHERE is_pcos_friendly = TRUE
        ORDER BY id DESC
        `
      );
    }

    res.render("recipes", { recipes: rows, search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Auth pages
app.get(to("/register"), (req, res) => res.render("register", { error: null }));
app.get(to("/login"), (req, res) => res.render("login", { error: null }));

app.post(to("/register"), async (req, res) => {
  try {
    const { username, display_name, password } = req.body;

    if (!username || !display_name || !password) {
      return res.status(400).render("register", { error: "All fields are required." });
    }
    if (password.length < 8) {
      return res.status(400).render("register", { error: "Password must be at least 8 characters." });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length) {
      return res.status(400).render("register", { error: "Username already taken." });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?, ?, ?, NOW())",
      [username, password_hash, display_name]
    );

    req.session.user = { id: result.insertId, username, display_name };
    res.redirect(to("/"));
  } catch (err) {
    console.error(err);
    res.status(500).render("register", { error: "Server error. Try again." });
  }
});

app.post(to("/login"), async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await pool.query(
      "SELECT id, username, password_hash, display_name FROM users WHERE username = ?",
      [username]
    );

    if (!users.length) {
      return res.status(400).render("login", { error: "Invalid username or password." });
    }

    const user = users[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(400).render("login", { error: "Invalid username or password." });
    }

    req.session.user = { id: user.id, username: user.username, display_name: user.display_name };
    res.redirect(to("/"));
  } catch (err) {
    console.error(err);
    res.status(500).render("login", { error: "Server error. Try again." });
  }
});

app.get(to("/logout"), (req, res) => {
  req.session.destroy(() => res.redirect(to("/")));
});

// Daily check-in
app.get(to("/daily-check-in"), async (req, res) => {
  if (!req.session.user) return res.redirect(to("/login"));
  res.render("daily_check_in", { error: null, success: null });
});

app.post(to("/daily-check-in"), async (req, res) => {
  try {
    if (!req.session.user) return res.redirect(to("/login"));

    const userId = req.session.user.id;
    const {
      log_date,
      sleep_hours,
      movement_minutes,
      mood_score,
      energy_score,
      craving_level,
      cycle_day,
      notes,
    } = req.body;

    if (!log_date) {
      return res.status(400).render("daily_check_in", { error: "Date is required.", success: null });
    }

    // Upsert pattern (insert or update same date)
    await pool.query(
      `
      INSERT INTO daily_logs
        (user_id, log_date, sleep_hours, movement_minutes, mood_score, energy_score, craving_level, cycle_day, notes)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        sleep_hours = VALUES(sleep_hours),
        movement_minutes = VALUES(movement_minutes),
        mood_score = VALUES(mood_score),
        energy_score = VALUES(energy_score),
        craving_level = VALUES(craving_level),
        cycle_day = VALUES(cycle_day),
        notes = VALUES(notes)
      `,
      [
        userId,
        log_date,
        sleep_hours || null,
        movement_minutes || null,
        mood_score || null,
        energy_score || null,
        craving_level || null,
        cycle_day || null,
        notes || null,
      ]
    );

    res.render("daily_check_in", { error: null, success: "Saved successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).render("daily_check_in", { error: "Server error saving check-in.", success: null });
  }
});

// Start (important: listen on provided PORT if Gold sets it)
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Running on port ${PORT} (basePath="${basePath}")`));
