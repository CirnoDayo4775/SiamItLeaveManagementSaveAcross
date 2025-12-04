require('dotenv').config();
require('reflect-metadata');

// --- Imports: Core & Third Party ---
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');
const express = require('express');
const cors = require('cors');
const { DataSource } = require('typeorm');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// --- Imports: Local Config & Utils ---
const config = require('./config');
const scheduler = require('./utils/scheduler.js');
const initializeRoutes = require('./routes');

// --- App Setup ---
const app = express();
const httpServer = createServer(app);
const port = config.server.port;

// --- Socket.io Setup ---
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket Event Handlers
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('joinRoom', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined room: user_${userId}`);
  });

  socket.on('joinAdminRoom', () => {
    socket.join('admin_room');
    console.log('🛡️ Admin joined admin room');
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// Expose IO globally
global.io = io;

// --- Database Configuration ---
const AppDataSource = new DataSource({
  type: config.database.type,
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  synchronize: false, // Set to false for production safety
  logging: false,
  dropSchema: false,
  migrationsRun: false,
  entities: [
    require('./EnityTable/User.entity.js'),
    require('./EnityTable/leaveRequest.entity.js'),
    require('./EnityTable/position.js'),
    require('./EnityTable/leaveType.js'),
    require('./EnityTable/department.js'),
    require('./EnityTable/leaveQuota.js'),
    require('./EnityTable/announcements.js'),
    require('./EnityTable/customHoliday.js'),
    require('./EnityTable/lineUser.js'),
    require('./EnityTable/LeaveUsed.js'),
  ],
});

// Expose DataSource globally
global.AppDataSource = AppDataSource;

// --- Middleware Setup ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optimized CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowedPatterns = [
      ...config.cors.origins,
      /^https:\/\/.*\.ngrok-free\.app$/,
      /^https:\/\/.*\.ngrok\.io$/,
      /^https:\/\/.*\.loca\.lt$/,
      /^http:\/\/localhost:\d{2,5}$/,
      /^http:\/\/127\.0\.0\.1:\d{2,5}$/,
      /^http:\/\/192\.168\.[0-9]{1,3}\.[0-9]{1,3}:\d{2,5}$/
    ];

    const isAllowed = allowedPatterns.some(pattern =>
      typeof pattern === "string" ? origin === pattern : pattern.test(origin)
    );

    if (isAllowed) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400
}));

// --- Directory Initialization ---
const requiredDirs = [
  config.getUploadsPath(),
  config.getAnnouncementsUploadPath(),
  config.getLeaveUploadsPath()
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// --- Static Files ---
app.use('/uploads', express.static(config.getUploadsPath()));

// Secure Static Files Middleware
const authenticateStaticFiles = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, config.server.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.use('/leave-uploads', authenticateStaticFiles, express.static(config.getLeaveUploadsPath()));
try {
    const swaggerFile = require('./swagger_output.json'); // อ่านไฟล์ที่ Gen มา
    
    // เปิด Route /api-docs
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));
    
    console.log('📄 Swagger UI is available at /api-docs');
} catch (err) {
    console.error('⚠️ Could not load swagger_output.json. Did you run "node swagger.js"?');
}
// --- Legacy Routes (Kept as per instruction) ---
// Note: It is recommended to move these to controller files in the future.

app.get('/', (req, res) => {
  res.send(`<html><head><title>System Status</title></head><body><p style="color:green; font-weight:bold;">BACKEND IS OPERATIONAL</p></body></html>`);
});

app.get('/users', async (req, res) => {
  try {
    const users = await AppDataSource.getRepository('User').find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { name, position, department, Email, Password } = req.body;
    const userRepo = AppDataSource.getRepository('User');

    // Check duplicate
    const exist = await userRepo.findOneBy({ Email });
    if (exist) return res.status(400).json({ error: 'Email already exists' });

    // Create User
    const hashedPassword = await bcrypt.hash(Password, 10);
    const user = userRepo.create({
      name,
      position,
      department,
      Email,
      Password: hashedPassword,
      Role: 'user'
    });
    
    await userRepo.save(user);

    // Generate Token
    const token = jwt.sign(
      { userId: user.id, email: Email },
      config.server.jwtSecret,
      { expiresIn: config.server.jwtExpiresIn }
    );

    // Save token (Optional: depending on your auth flow requirements)
    user.Token = token;
    await userRepo.save(user);

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Server Initialization ---
const startServer = async () => {
  try {
    // 1. Initialize Database
    await AppDataSource.initialize();
    console.log('✅ TypeORM Data Source initialized!');

    // 2. Load Routes
    const routes = initializeRoutes(AppDataSource);
    app.use('/api', routes);

    // 3. Start Scheduler
    scheduler.registerScheduledJobs(config);
    scheduler.scheduleLeaveTypeCleanup(AppDataSource);

    // 4. Start HTTP Server
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on ${config.server.apiBaseUrl}`);
      console.log(`🔌 Socket.io server ready`);
    });

  } catch (err) {
    console.error('❌ Error during server startup:', err);
    process.exit(1);
  }
};

startServer();