const BASE_PATH = "/usr/417";   // deployed path required by brief
// ... middleware, sessions, etc ...

const router = express.Router();

// ✅ basePath will automatically be "" when mounted at "/" and "/usr/417" when mounted there
router.use((req, res, next) => {
  res.locals.basePath = req.baseUrl || "";
  res.locals.currentUser = req.session.user || null;
  next();
});

// define routes on router using "/" like normal:
router.get("/", ...);
router.get("/about", ...);
router.get("/login", ...);
router.post("/login", ...);
router.get("/register", ...);
router.post("/register", ...);
router.get("/daily-check-in", ...);
router.post("/daily-check-in", ...);
router.get("/recipes", ...);

// ✅ mount router both ways (this removes the doc.gold 404 pain completely)
app.use("/", router);
app.use(BASE_PATH, router);

// ✅ static assets both ways too
app.use(express.static(path.join(__dirname, "public")));
app.use(BASE_PATH, express.static(path.join(__dirname, "public")));
