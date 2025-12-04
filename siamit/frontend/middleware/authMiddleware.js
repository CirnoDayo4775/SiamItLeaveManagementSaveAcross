const jwt = require('jsonwebtoken');
const config = require('../config');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log(authHeader);
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('Auth Middleware Debug:');
  console.log('Authorization header:', authHeader);
  console.log('Token:', token ? 'Present' : 'Missing');
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, config.server.jwtSecret, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('Token verified successfully, user:', user);
    req.user = user;
    next();
  });
};

module.exports = authMiddleware; 