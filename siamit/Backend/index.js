require('dotenv').config();
require('reflect-metadata');
const { DataSource } = require('typeorm');
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cors = require('cors');
const path = require('path');
const leaveQuota = require('./EnityTable/leaveQuota.js');
const fs = require('fs');
const { createServer } = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const scheduler = require('./utils/scheduler.js');


const app = express();
const port = config.server.port;

// Create HTTP server for Socket.io
const server = createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: config.cors.origins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join user to their personal room
  socket.on('joinRoom', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room: user_${userId}`);
  });
  
  // Handle admin joining admin room
  socket.on('joinAdminRoom', () => {
    socket.join('admin_room');
    console.log('Admin joined admin room');
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available globally
global.io = io;

// TypeORM DataSource config
const AppDataSource = new DataSource({
  type: config.database.type,
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  synchronize: false, // dev only! จะสร้าง/อัปเดต table อัตโนมัติ
  logging: false, // Disable database query logging
  dropSchema: false, // Don't drop schema on restart
  migrationsRun: false, // Don't run migrations automatically
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
        // require('./EnityTable/LeaveUsed.js'),
  ],
});

app.use(express.json());

AppDataSource.initialize()
  .then(() => {
    console.log('TypeORM Data Source has been initialized!');
  })
  .catch((err) => {
    console.error('Error during Data Source initialization:', err);
  });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      ...config.cors.origins,
      /^https:\/\/.*\.ngrok-free\.app$/,
      /^https:\/\/.*\.ngrok\.io$/,
      /^https:\/\/.*\.loca\.lt$/,
      /^http:\/\/localhost:\d{2,5}$/,
      /^http:\/\/127\.0\.0\.1:\d{2,5}$/,
      /^http:\/\/192\.168\.[0-9]{1,3}\.[0-9]{1,3}:\d{2,5}$/
    ];

    const isAllowed = allowedOrigins.some(pattern =>
      typeof pattern === "string"
        ? origin === pattern
        : pattern.test(origin)
    );

    if (isAllowed) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400 // cache preflight 24 ชั่วโมง
}));


// Ensure uploads directories exist
const uploadsDir = config.getUploadsPath();
const announcementsDir = config.getAnnouncementsUploadPath();
const leaveUploadsDir = config.getLeaveUploadsPath();

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(announcementsDir)) {
  fs.mkdirSync(announcementsDir, { recursive: true });
}
if (!fs.existsSync(leaveUploadsDir)) {
  fs.mkdirSync(leaveUploadsDir, { recursive: true });
}

// Serve static files for uploaded images
app.use('/uploads', express.static(uploadsDir));
// Serve static files for leave request attachments stored under public/leave-uploads
app.use('/leave-uploads', express.static(config.getLeaveUploadsPath()));

// Serve leave uploads with authentication
app.use('/leave-uploads', (req, res, next) => {
  // Check if user is authenticated
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, config.server.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}, express.static(leaveUploadsDir));

app.get('/', (req, res) => {
  res.send('Hello from Express + TypeORM!');
});

// ตัวอย่าง route ดึงข้อมูลจากฐานข้อมูล
app.get('/users', async (req, res) => {
  try {
    const userRepo = AppDataSource.getRepository('User');
    const users = await userRepo.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// สมัครสมาชิก
app.post('/register', async (req, res) => {
  try {
    const { name, position, department, Email, Password } = req.body;
    const userRepo = AppDataSource.getRepository('User');

    // ตรวจสอบ email ซ้ำ
    const exist = await userRepo.findOneBy({ Email });
    if (exist) {
      return res.status(400).json({ error: 'Email นี้ถูกใช้ไปแล้ว' });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(Password, 10);

    // สร้าง User
    const user = userRepo.create({ 
      name, 
      position, 
      department, 
      Email, 
      Password: hashedPassword,
      Role: 'user'
    });
    await userRepo.save(user);

    // สร้าง JWT
    const token = jwt.sign(
      { userId: user.id, email: Email },
      config.server.jwtSecret,
      { expiresIn: config.server.jwtExpiresIn }
    );

    // อัปเดต token ใน User
    user.Token = token;
    await userRepo.save(user);

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Swagger config
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: config.app.title,
      version: config.app.version,
    },
    tags: [ 
      {
        name: 'Departments',
        description: 'จัดการข้อมูล Departments'
      },
      {
        name: 'LeaveQuota',
        description: 'จัดการโควต้าการลาตามตำแหน่ง'
      },
      {
        name: 'Users',
        description: 'จัดการข้อมูล User'
      },
      {
        name: 'Admins',
        description: 'จัดการข้อมูล Admin'
      },
      {
        name: 'Employees',
        description: 'จัดการข้อมูล Employees'
      },
      {
        name: 'Positions',
        description: 'จัดการข้อมูล Positions'
      },
      {
        name: 'Profile',
        description: 'จัดการข้อมูล Profile'
      },
      {
        name: 'LeaveTypes',
        description: 'จัดการข้อมูลประเภทการลา'
      }
    ]
  },
  apis: ['./api/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Initialize centralized routes
const initializeRoutes = require('./routes');
const routes = initializeRoutes(AppDataSource);
app.use('/api', routes);

// Make AppDataSource globally available
global.AppDataSource = AppDataSource;

server.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on ${config.server.apiBaseUrl}`);
  console.log('Socket.io server is ready');
  // Register scheduled jobs (yearly quota reset)
  scheduler.registerScheduledJobs(config);
  // Schedule leave type cleanup
  scheduler.scheduleLeaveTypeCleanup(AppDataSource);
}); 