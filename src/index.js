require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const timeout = require("connect-timeout");
const http = require("http");
const WebSocket = require("ws");
const swaggerUi = require("swagger-ui-express");
const specs = require("./swagger");

const app = express();
const port = process.env.PORT || 3000;

// Configuration PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT || 5432,
});

// Middleware pour parser les requêtes JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configuration CORS modifiée
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Expose-Headers", "Authorization");
  console.log("Incoming request:", {
    method: req.method,
    path: req.path,
    body: req.body,
    headers: req.headers,
  });
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Middleware de timeout
app.use(timeout("15s"));
app.use(haltOnTimedout);

function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}

// Route racine
app.get("/", (req, res) => {
  res.redirect("/ms-auth");
});

// Ajouter avant la configuration du router
app.use("/ms-auth/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @swagger
 * /ms-auth/register:
 *   post:
 *     summary: Créer un nouvel utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Données invalides
 */

// Configuration du router
const router = express.Router();

// Routes d'API
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "auth",
    timestamp: new Date().toISOString(),
  });
});

router.get("/", (req, res) => {
  res.json({
    message: "Welcome to Auth API",
    version: "1.0.0",
    endpoints: {
      health: {
        path: "/health",
        method: "GET",
        description: "Check API health status",
      },
      register: {
        path: "/register",
        method: "POST",
        description: "Register a new user",
      },
      login: {
        path: "/login",
        method: "POST",
        description: "Authenticate user and get token",
      },
      protected: {
        path: "/protected",
        method: "GET",
        description: "Test protected route (requires token)",
      },
    },
  });
});

// Fonction de génération de token JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

// Route pour l'inscription des utilisateurs
router.post("/register", async (req, res) => {
  console.log("Register request received:", {
    body: req.body,
    headers: req.headers,
    path: req.path,
  });
  const { username, password, role } = req.body;

  // Validation des champs requis
  if (!username || !password || !role) {
    return res.status(400).json({ error: "Tous les champs sont requis" });
  }

  try {
    // Vérifier si l'utilisateur existe déjà
    const userExists = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "Cet utilisateur existe déjà" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, hashedPassword, role]
    );
    const newUser = result.rows[0];
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Erreur d'inscription:", error);
    res.status(500).json({
      error: "Erreur lors de l'inscription",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /ms-auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         headers:
 *           Authorization:
 *             schema:
 *               type: string
 *             description: Bearer token JWT
 */

// Route pour la connexion des utilisateurs
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: "Utilisateur non trouvé" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Mot de passe incorrect" });
    }

    const token = generateToken(user);

    // Ajouter le token dans l'en-tête HTTP
    res.setHeader("Authorization", `Bearer ${token}`);

    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// Middleware de vérification du token JWT
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    console.log("Token manquant dans la requête");
    return res.status(401).json({ error: "Accès refusé, token manquant" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token décodé:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Erreur de vérification du token:", err.message);
    return res.status(403).json({
      error: "Token invalide",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Route protégée nécessitant un token
router.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: "Accès autorisé", user: req.user });
});

/**
 * @swagger
 * /ms-auth/users/me:
 *   get:
 *     summary: Obtenir le profil de l'utilisateur connecté
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *       401:
 *         description: Non autorisé
 */

// Route pour récupérer le profil utilisateur
router.get("/users/me", authenticateToken, async (req, res) => {
  console.log("Requête /users/me reçue pour l'utilisateur:", req.user);
  try {
    const result = await pool.query(
      "SELECT id, username, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error);
    res.status(500).json({
      error: "Erreur serveur",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Monter le router
app.use("/ms-auth", router);

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Erreur serveur",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Gestionnaire pour les requêtes interrompues
app.use((req, res, next) => {
  req.on("close", () => {
    if (!res.finished) {
      console.log("Client a interrompu la requête");
    }
  });
  next();
});

// Créer un serveur HTTP
const server = http.createServer(app);

// Configurer WebSocket
const wss = new WebSocket.Server({
  server,
  path: "/notifications-ws",
});

wss.on("connection", (ws) => {
  console.log("Client WebSocket connecté");

  ws.on("message", (message) => {
    console.log("Message reçu:", message);
  });

  ws.on("close", () => {
    console.log("Client WebSocket déconnecté");
  });
});

// Middleware pour gérer les routes non trouvées
app.use((req, res) => {
  const fullPath = req.originalUrl;
  console.log(
    `Route non trouvée: ${req.method} ${fullPath} (path: ${req.path})`
  );
  res.status(404).json({
    error: "Route non trouvée",
    fullPath: fullPath,
    path: req.path,
    method: req.method,
  });
});

// Démarrer le serveur
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
