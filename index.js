
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

// Serve static assets UNDER the base path (so /usr/417/styles.css works)
app.use(BASE_PATH, express.static(path.join(__dirname, "public")));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "coursework-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Globals for EJS
app.use((req, res, next) => {
  res.locals.basePath = BASE_PATH;
  res.locals.currentUser = req.session.user || null;
  next();
});

// Put all routes on a router and mount it at BASE_PATH
const router = express.Router();

/* Home */
router.get("/", async (req, res) => {
  if (!req.session.user) {
    return res.render("index", { logs: [] });
  }

  try {
    const [logs] = await db.query(
      "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 7",
      [req.session.user.user_id]
    );
    return res.render("index", { logs });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Database error");
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
    const [existing] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
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

    return res.redirect(`${BASE_PATH}/`);
  } catch (err) {
    console.error(err);
    return res.render("register", { error: "Registration failed." });
  }
});

/* Login */
router.get("/login", (req, res) => res.render("login", { error: null }));

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

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

    return res.redirect(`${BASE_PATH}/`);
  } catch (err) {
    console.error(err);
    return res.render("login", { error: "Login failed." });
  }
});

/* Logout */
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect(`${BASE_PATH}/`));
});

/* Recipes */
router.get("/recipes", async (req, res) => {
  const search = req.query.q || "";

  try {
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

    return res.render("recipes", { recipes, search });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Recipe error");
  }
});

// mount router at /usr/417
app.use(BASE_PATH, router);

// Safety: show 404s clearly (keep AFTER mounting routes)
app.use((req, res) => res.status(404).send("Not found"));

// Log crashes (optional)
process.on("unhandledRejection", (err) =>
  console.error("unhandledRejection:", err)
);
process.on("uncaughtException", (err) =>
  console.error("uncaughtException:", err)
);

// IMPORTANT: bind to IPv4 all interfaces (works for both proxy + localhost)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Listening on http://0.0.0.0:${PORT}${BASE_PATH}/`);
});
