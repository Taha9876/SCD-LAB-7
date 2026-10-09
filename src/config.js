const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  // Set JWT_SECRET in the environment for anything other than local lab use.
  JWT_SECRET: process.env.JWT_SECRET || 'lab7-dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  DB_FILE: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json'),
};
