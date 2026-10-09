const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { validateRegistration } = require('../validators');

const publicUser = ({ passwordHash, ...user }) => user;
const signToken = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

module.exports = function authRouter(store, requireAuth) {
  const router = express.Router();

  router.post('/register', async (req, res, next) => {
    try {
      const { errors, value } = validateRegistration(req.body || {});
      if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

      if (store.findOne('users', (u) => u.email === value.email)) {
        return res.status(409).json({ error: 'Email is already registered' });
      }

      const passwordHash = await bcrypt.hash(value.password, 10);
      const user = store.insert('users', { name: value.name, email: value.email, passwordHash });
      res.status(201).json({ user: publicUser(user), token: signToken(user) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'email and password are required' });
      }

      const user = store.findOne('users', (u) => u.email === email.trim().toLowerCase());
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      res.json({ user: publicUser(user), token: signToken(user) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  return router;
};
