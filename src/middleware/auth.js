const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// Resolves the Bearer token to a user and puts it on req.user.
function requireAuth(store) {
  return (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = store.findOne('users', (u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

    req.user = user;
    next();
  };
}

module.exports = requireAuth;
