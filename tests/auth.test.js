const request = require('supertest');
const { setup, registerUser, bearer } = require('./helpers');

describe('authentication', () => {
  let app;

  beforeEach(() => {
    ({ app } = setup());
  });

  test('registers a student and returns a token without exposing the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ali Khan', email: 'Ali@Example.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Ali Khan', email: 'ali@example.com' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });

  test('stores the password hashed, not in plain text', async () => {
    const { store, app: freshApp } = setup();
    await registerUser(freshApp);

    const [saved] = store.find('users');
    expect(saved.passwordHash).not.toBe('secret123');
    expect(saved.password).toBeUndefined();
  });

  test('rejects registration with missing or invalid fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveLength(3);
  });

  test('rejects a duplicate email regardless of case', async () => {
    await registerUser(app);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Someone Else', email: 'ALI@example.com', password: 'another1' });

    expect(res.status).toBe(409);
  });

  test('logs in with the correct credentials', async () => {
    await registerUser(app);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ali@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('ali@example.com');
  });

  test('rejects a wrong password and an unknown email the same way', async () => {
    await registerUser(app);

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ali@example.com', password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'secret123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  test('rejects login without credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('returns the current student for a valid token', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ali@example.com');
  });

  test.each(['/api/auth/me', '/api/courses', '/api/assignments', '/api/progress'])(
    'blocks %s without a valid token',
    async (url) => {
      const missing = await request(app).get(url);
      const garbage = await request(app).get(url).set(bearer('not-a-real-token'));

      expect(missing.status).toBe(401);
      expect(garbage.status).toBe(401);
    }
  );

  test('answers malformed JSON with 400 instead of crashing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
  });
});
