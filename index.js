// index.js
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();

// --- Config (matches brief) ---
const PORT = parseInt(process.env.PORT || "8000", 10);

// IMPORTANT: for markers PC, BASE_PATH should be blank.
// On doc.gold you set BASE_PATH=/usr/417 in your .env (or export it).
let BASE_PATH = (process.env.BASE_PATH || "").trim();
if (BASE_PATH === "/") BASE_PATH = "";
if (BASE_PATH && !BASE_PATH.startsWith("/")) BASE_PATH = `/${BASE_PATH}`;

// tiny helper so redirects/links work with or without a base path
const url = (p) => `${BASE_PATH}${p.startsWith("/") ? p : `/${p}`}`;

// --- View engine ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Behind Apache proxy (doc.gold) this helps with sessions/redirects
app.set("trust proxy", 1);

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));

// Static assets
// - if BASE_PATH = "/usr/417" -> /usr/417/styles.css
// - if BASE_PATH = ""        -> /styles.css
if (BASE_PATH) {
  app.use(BASE_PATH, express.static(path.join(__dirname, "public")));
} else {
  app.use(express.static(path.join(__dirname, "public")));
}

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
  res.locals.basePath = BASE_PATH; // use in EJS like: <%= basePath %>/login
  res.locals.currentUser = req.session.user || null;
  next();
});

// Safe render helper (prevents “view not found” from killing the app)
function renderSafe(res, view, data, fallbackHtml) {
  res.render(view, data, (err, html) => {
    if (err) return res.status(200).send(fallbackHtml);
    return res.send(html);
  });
}

// --- Router mounted at BASE_PATH ---
const router = express.Router();

/* Home (required) */
router.get("/", async (req, res) => {
  if (!req.session.user) {
    return renderSafe(
      res,
      "index",
      { logs: [] },
      `<h1>Home</h1><p><a href="${url("/login")}">Login</a> | <a href="${url(
        "/register"
      )}">Register</a> | <a href="${url("/about")}">About</a> | <a href="${url(
        "/recipes"
      )}">Recipes</a></p>`
    );
  }

  try {
    const [logs] = await db.query(
      "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 7",
      [req.session.user.user_id]
    );

    return renderSafe(
      res,
      "index",
      { logs },
      `<h1>Home</h1><p>Logged in as ${req.session.user.display_name}</p><pre>${JSON.stringify(
        logs,
        null,
        2
      )}</pre>`
    );
  } catch (err) {
    console.error(err);
    return res.status(500).send("Database error");
  }
});

/* About (required) */
router.get("/about", (req, res) => {
  return renderSafe(
    res,
    "about",
    {},
    `<h1>About</h1><p><a href="${url("/")}">Home</a></p>`
  );
});

/* Register */
router.get("/register", (req, res) =>
  renderSafe(
    res,
    "register",
    { error: null },
    `<h1>Register</h1><form method="POST" action="${url(
      "/register"
    )}"><input name="username" placeholder="username" required><input name="display_name" placeholder="display name" required><input name="password" type="password" placeholder="password" required><button>Register</button></form>`
  )
);

router.post("/register", async (req, res) => {
  const { username, display_name, password } = req.body;

  if (!username || !display_name || !password) {
    return renderSafe(
      res,
      "register",
      { error: "All fields required." },
      "All fields required."
    );
  }

  try {
    const [existing] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (existing.length) {
      return renderSafe(
        res,
        "register",
        { error: "Username already taken." },
        "Username already taken."
      );
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      "INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?, ?, ?, NOW())",
      [username, hash, display_name]
    );

    req.session.user = { user_id: result.insertId, username, display_name };
    return res.redirect(url("/"));
  } catch (err) {
    console.error(err);
    return renderSafe(
      res,
      "register",
      { error: "Registration failed." },
      "Registration failed."
    );
  }
});

/* Login (required if you use login) */
router.get("/login", (req, res) =>
  renderSafe(
    res,
    "login",
    { error: null },
    `<h1>Login</h1><form method="POST" action="${url(
      "/login"
    )}"><input name="username" required><input name="password" type="password" required><button>Login</button></form><p>Demo user: gold / smiths123ABC$</p>`
  )
);

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (!users.length) {
      return renderSafe(
        res,
        "login",
        { error: "Invalid credentials." },
        "Invalid credentials."
      );
    }

    const user = users[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return renderSafe(
        res,
        "login",
        { error: "Invalid credentials." },
        "Invalid credentials."
      );
    }

    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      display_name: user.display_name,
    };

    return res.redirect(url("/"));
  } catch (err) {
    console.error(err);
    return renderSafe(res, "login", { error: "Login failed." }, "Login failed.");
  }
});

/* Logout */
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect(url("/")));
});

/* Form to enter data + store in DB (required) */
router.get("/daily-check-in", (req, res) => {
  if (!req.session.user) return res.redirect(url("/login"));

  return renderSafe(
    res,
    "daily-check-in",
    { error: null },
    `<h1>Daily Check-In</h1>
     <form method="POST" action="${url("/daily-check-in")}">
       <label>Date <input type="date" name="log_date" /></label><br/>
       <label>Sleep hours <input type="number" step="0.1" name="sleep_hours" /></label><br/>
       <label>Movement minutes <input type="number" name="movement_minutes" /></label><br/>
       <label>Mood (1-10) <input type="number" name="mood_score" /></label><br/>
       <label>Energy (1-10) <input type="number" name="energy_score" /></label><br/>
       <label>Craving (1-10) <input type="number" name="craving_level" /></label><br/>
       <label>Cycle day <input type="number" name="cycle_day" /></label><br/>
       <label>Notes <textarea name="notes"></textarea></label><br/>
       <button type="submit">Save</button>
     </form>
     <p><a href="${url("/")}">Back home</a></p>`
  );
});

router.post("/daily-check-in", async (req, res) => {
  if (!req.session.user) return res.redirect(url("/login"));

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

  try {
    await db.query(
      `INSERT INTO daily_logs
        (user_id, log_date, sleep_hours, movement_minutes, mood_score, energy_score, craving_level, cycle_day, notes)
       VALUES (?, COALESCE(?, CURDATE()), ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.user_id,
        log_date || null,
        sleep_hours || null,
        movement_minutes || null,
        mood_score || null,
        energy_score || null,
        craving_level || null,
        cycle_day || null,
        notes || null,
      ]
    );

    return res.redirect(url("/"));
  } catch (err) {
    console.error(err);
    return renderSafe(
      res,
      "daily-check-in",
      { error: "Could not save log." },
      "Could not save log."
    );
  }
});

/* Search against database (required) */
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

    return renderSafe(
      res,
      "recipes",
      { recipes, search },
      `<h1>Recipes</h1>
       <form method="GET" action="${url("/recipes")}">
         <input name="q" value="${search.replace(/"/g, "&quot;")}" />
         <button>Search</button>
       </form>
       <pre>${JSON.stringify(recipes, null, 2)}</pre>`
    );
  } catch (err) {
    console.error(err);
    return res.status(500).send("Recipe error");
  }
});

// Mount router
app.use(BASE_PATH || "/", router);

// 404
app.use((req, res) => res.status(404).send("Not found"));

// Crash logs
process.on("unhandledRejection", (err) =>
  console.error("unhandledRejection:", err)
);
process.on("uncaughtException", (err) =>
  console.error("uncaughtException:", err)
);

// IMPORTANT: listen in a way that works for Apache proxy (IPv6 ::1) and local
const server = app.listen(PORT, "::", () => {
  console.log(`Listening on port ${PORT} (base: "${BASE_PATH || "/"}")`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} already in use. Kill old node: pkill -u "$USER" -f "node"`
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
