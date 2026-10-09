const request = require('supertest');
const { createApp } = require('../src/app');
const Store = require('../src/store');

// Fresh app on an empty in-memory store, so suites never share data.
function setup() {
  const store = new Store();
  return { store, app: createApp({ store }) };
}

async function registerUser(app, overrides = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Ali Khan', email: 'ali@example.com', password: 'secret123', ...overrides });
  return { user: res.body.user, token: res.body.token };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

async function createCourse(app, token, overrides = {}) {
  const res = await request(app)
    .post('/api/courses')
    .set(bearer(token))
    .send({
      name: 'Software Construction',
      code: 'CS-301',
      instructor: 'Dr. Ahmed',
      creditHours: 3,
      ...overrides,
    });
  return res.body;
}

async function createAssignment(app, token, courseId, overrides = {}) {
  const res = await request(app)
    .post(`/api/courses/${courseId}/assignments`)
    .set(bearer(token))
    .send({
      title: 'Lab Report',
      description: 'Write up the lab',
      dueDate: daysFromNow(7),
      ...overrides,
    });
  return res.body;
}

module.exports = { setup, registerUser, bearer, daysFromNow, createCourse, createAssignment };
