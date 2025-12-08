const express = require('express');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = (AppDataSource) => {
  const router = require('express').Router();

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const userRepo = AppDataSource.getRepository('User');
    const user = await userRepo.findOneBy({ email: email });
    if (!user) {
      return res.status(401).json({ success: false, data: null, message: 'Email หรือ Password ไม่ถูกต้อง' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, data: null, message: 'Email หรือ Password ไม่ถูกต้อง' });
    }
    // Use the same secret as ProfileController
    const token = jwt.sign({ userId: user.id, role: user.role }, config.server.jwtSecret, { expiresIn: config.server.jwtExpiresIn });
    // Save token to unified users table
    user.token = token;
    await userRepo.save(user);
    res.json({ success: true, data: { token, role: user.role, userId: user.id }, message: 'Login successful' });
  });
  return router;
};
