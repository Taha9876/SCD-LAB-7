const express = require('express');
const requireAuth = require('./middleware/auth');
const authRouter = require('./routes/auth');
const coursesRouter = require('./routes/courses');
const assignmentsRouter = require('./routes/assignments');
const progressRouter = require('./routes/progress');

// The store is injected so the tests can run each suite against a fresh in-memory one.
function createApp({ store }) {
  const app = express();
  const auth = requireAuth(store);

  app.set('json spaces', 2);
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ service: 'student-course-manager', status: 'ok' });
  });

  app.use('/api/auth', authRouter(store, auth));
  app.use('/api/courses', auth, coursesRouter(store));
  app.use('/api/assignments', auth, assignmentsRouter(store));
  app.use('/api/progress', auth, progressRouter(store));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Express only treats this as an error handler if it declares all four arguments.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
