const request = require('supertest');
const { setup, registerUser, bearer, createCourse, createAssignment } = require('./helpers');

describe('course management', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = setup());
    ({ token } = await registerUser(app));
  });

  test('adds a course', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set(bearer(token))
      .send({ name: ' Software Construction ', code: 'cs-301', instructor: 'Dr. Ahmed', creditHours: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Software Construction',
      code: 'CS-301',
      instructor: 'Dr. Ahmed',
      creditHours: 3,
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.progress.status).toBe('not-started');
  });

  test('rejects a course with missing or invalid fields', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set(bearer(token))
      .send({ name: 'No Code', creditHours: 0 });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        'code is required',
        'instructor is required',
        'creditHours must be a positive integer',
      ])
    );
  });

  test('rejects a second course with the same code', async () => {
    await createCourse(app, token);
    const res = await request(app)
      .post('/api/courses')
      .set(bearer(token))
      .send({ name: 'Duplicate', code: 'cs-301', instructor: 'Dr. Sara', creditHours: 3 });

    expect(res.status).toBe(409);
  });

  test('lists and fetches courses', async () => {
    const course = await createCourse(app, token);
    await createCourse(app, token, { name: 'Databases', code: 'CS-220' });

    const list = await request(app).get('/api/courses').set(bearer(token));
    const one = await request(app).get(`/api/courses/${course.id}`).set(bearer(token));

    expect(list.status).toBe(200);
    expect(list.body.map((c) => c.code)).toEqual(['CS-301', 'CS-220']);
    expect(one.status).toBe(200);
    expect(one.body.id).toBe(course.id);
  });

  test('updates only the fields that were sent', async () => {
    const course = await createCourse(app, token);
    const res = await request(app)
      .put(`/api/courses/${course.id}`)
      .set(bearer(token))
      .send({ instructor: 'Dr. Sara', creditHours: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Software Construction',
      code: 'CS-301',
      instructor: 'Dr. Sara',
      creditHours: 4,
    });
  });

  test('rejects an update that would clash with another course code', async () => {
    const course = await createCourse(app, token);
    await createCourse(app, token, { code: 'CS-220' });

    const clash = await request(app)
      .put(`/api/courses/${course.id}`)
      .set(bearer(token))
      .send({ code: 'CS-220' });
    const sameCode = await request(app)
      .put(`/api/courses/${course.id}`)
      .set(bearer(token))
      .send({ code: 'CS-301' });

    expect(clash.status).toBe(409);
    expect(sameCode.status).toBe(200);
  });

  test('deletes a course together with its assignments', async () => {
    const course = await createCourse(app, token);
    await createAssignment(app, token, course.id);

    const del = await request(app).delete(`/api/courses/${course.id}`).set(bearer(token));
    const after = await request(app).get(`/api/courses/${course.id}`).set(bearer(token));
    const assignments = await request(app).get('/api/assignments').set(bearer(token));

    expect(del.status).toBe(204);
    expect(after.status).toBe(404);
    expect(assignments.body).toEqual([]);
  });

  test('returns 404 for a course that does not exist', async () => {
    const res = await request(app).get('/api/courses/no-such-id').set(bearer(token));
    expect(res.status).toBe(404);
  });

  describe('filtering', () => {
    let se;
    let db;

    beforeEach(async () => {
      se = await createCourse(app, token);
      db = await createCourse(app, token, { name: 'Databases', code: 'CS-220', instructor: 'Dr. Sara Malik' });
      await createCourse(app, token, { name: 'Calculus', code: 'MATH-101', instructor: 'Dr. Ahmed' });

      // se: fully submitted, db: half submitted, calculus: nothing yet
      await createAssignment(app, token, se.id, { status: 'submitted' });
      await createAssignment(app, token, db.id, { status: 'submitted' });
      await createAssignment(app, token, db.id);
    });

    const codesFor = async (query) => {
      const res = await request(app).get('/api/courses').query(query).set(bearer(token));
      expect(res.status).toBe(200);
      return res.body.map((c) => c.code).sort();
    };

    test('by course code', async () => {
      expect(await codesFor({ code: 'cs' })).toEqual(['CS-220', 'CS-301']);
      expect(await codesFor({ code: 'MATH-101' })).toEqual(['MATH-101']);
    });

    test('by instructor', async () => {
      expect(await codesFor({ instructor: 'ahmed' })).toEqual(['CS-301', 'MATH-101']);
      expect(await codesFor({ instructor: 'Sara' })).toEqual(['CS-220']);
    });

    test('by completion status', async () => {
      expect(await codesFor({ status: 'completed' })).toEqual(['CS-301']);
      expect(await codesFor({ status: 'in-progress' })).toEqual(['CS-220']);
      expect(await codesFor({ status: 'not-started' })).toEqual(['MATH-101']);
    });

    test('by several filters at once', async () => {
      expect(await codesFor({ instructor: 'ahmed', status: 'completed' })).toEqual(['CS-301']);
      expect(await codesFor({ code: 'MATH', status: 'completed' })).toEqual([]);
    });

    test('rejects an unknown completion status', async () => {
      const res = await request(app).get('/api/courses').query({ status: 'done' }).set(bearer(token));
      expect(res.status).toBe(400);
    });
  });

  describe('multiple students', () => {
    let course;
    let otherToken;

    beforeEach(async () => {
      course = await createCourse(app, token);
      ({ token: otherToken } = await registerUser(app, { name: 'Sara', email: 'sara@example.com' }));
    });

    test('a student only sees their own courses', async () => {
      const res = await request(app).get('/api/courses').set(bearer(otherToken));
      expect(res.body).toEqual([]);
    });

    test('a student cannot read, change or delete another student\'s course', async () => {
      const url = `/api/courses/${course.id}`;
      const read = await request(app).get(url).set(bearer(otherToken));
      const update = await request(app).put(url).set(bearer(otherToken)).send({ name: 'Hijacked' });
      const del = await request(app).delete(url).set(bearer(otherToken));
      const stillThere = await request(app).get(url).set(bearer(token));

      expect([read.status, update.status, del.status]).toEqual([404, 404, 404]);
      expect(stillThere.body.name).toBe('Software Construction');
    });

    test('two students can use the same course code', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set(bearer(otherToken))
        .send({ name: 'Software Construction', code: 'CS-301', instructor: 'Dr. Ahmed', creditHours: 3 });

      expect(res.status).toBe(201);
    });
  });
});
