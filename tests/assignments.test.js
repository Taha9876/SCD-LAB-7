const request = require('supertest');
const { setup, registerUser, bearer, daysFromNow, createCourse, createAssignment } = require('./helpers');

describe('assignment management', () => {
  let app;
  let token;
  let course;

  beforeEach(async () => {
    ({ app } = setup());
    ({ token } = await registerUser(app));
    course = await createCourse(app, token);
  });

  test('creates an assignment for a course, pending by default', async () => {
    const res = await request(app)
      .post(`/api/courses/${course.id}/assignments`)
      .set(bearer(token))
      .send({ title: 'Lab 7', description: 'CI with GitHub Actions', dueDate: '2026-12-01' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      courseId: course.id,
      title: 'Lab 7',
      description: 'CI with GitHub Actions',
      dueDate: '2026-12-01T00:00:00.000Z',
      status: 'pending',
      submittedAt: null,
    });
  });

  test('rejects an assignment with missing or invalid fields', async () => {
    const res = await request(app)
      .post(`/api/courses/${course.id}/assignments`)
      .set(bearer(token))
      .send({ dueDate: 'next week sometime', status: 'done' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        'title is required',
        'dueDate must be a valid date',
        'status must be one of: pending, submitted',
      ])
    );
  });

  test('cannot create an assignment for a course that does not exist', async () => {
    const res = await request(app)
      .post('/api/courses/no-such-id/assignments')
      .set(bearer(token))
      .send({ title: 'Orphan', dueDate: daysFromNow(3) });

    expect(res.status).toBe(404);
  });

  test('lists the assignments of one course', async () => {
    const other = await createCourse(app, token, { code: 'CS-220' });
    await createAssignment(app, token, course.id, { title: 'A1' });
    await createAssignment(app, token, course.id, { title: 'A2' });
    await createAssignment(app, token, other.id, { title: 'B1' });

    const res = await request(app).get(`/api/courses/${course.id}/assignments`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.map((a) => a.title)).toEqual(['A1', 'A2']);
  });

  test('lists all assignments soonest-due first and filters by status', async () => {
    await createAssignment(app, token, course.id, { title: 'Later', dueDate: daysFromNow(10) });
    await createAssignment(app, token, course.id, { title: 'Soon', dueDate: daysFromNow(2) });
    await createAssignment(app, token, course.id, { title: 'Late', dueDate: daysFromNow(-3) });
    await createAssignment(app, token, course.id, {
      title: 'Done',
      dueDate: daysFromNow(-5),
      status: 'submitted',
    });

    const titles = async (query) => {
      const res = await request(app).get('/api/assignments').query(query).set(bearer(token));
      expect(res.status).toBe(200);
      return res.body.map((a) => a.title);
    };

    expect(await titles({})).toEqual(['Done', 'Late', 'Soon', 'Later']);
    expect(await titles({ status: 'pending' })).toEqual(['Late', 'Soon', 'Later']);
    expect(await titles({ status: 'submitted' })).toEqual(['Done']);
    expect(await titles({ status: 'overdue' })).toEqual(['Late']);
    expect(await titles({ courseId: 'some-other-course' })).toEqual([]);
  });

  test('rejects an unknown status filter', async () => {
    const res = await request(app).get('/api/assignments').query({ status: 'late' }).set(bearer(token));
    expect(res.status).toBe(400);
  });

  test('marks an assignment as submitted and back to pending', async () => {
    const assignment = await createAssignment(app, token, course.id);
    const url = `/api/assignments/${assignment.id}`;

    const submitted = await request(app).put(url).set(bearer(token)).send({ status: 'submitted' });
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('submitted');
    expect(submitted.body.submittedAt).toEqual(expect.any(String));

    const reopened = await request(app).put(url).set(bearer(token)).send({ status: 'pending' });
    expect(reopened.body.status).toBe('pending');
    expect(reopened.body.submittedAt).toBeNull();
  });

  test('updates assignment details without touching the status', async () => {
    const assignment = await createAssignment(app, token, course.id, { status: 'submitted' });
    const res = await request(app)
      .put(`/api/assignments/${assignment.id}`)
      .set(bearer(token))
      .send({ title: 'Lab Report v2', dueDate: '2026-11-15' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Lab Report v2',
      dueDate: '2026-11-15T00:00:00.000Z',
      status: 'submitted',
      submittedAt: assignment.submittedAt,
    });
  });

  test('deletes an assignment', async () => {
    const assignment = await createAssignment(app, token, course.id);
    const url = `/api/assignments/${assignment.id}`;

    const del = await request(app).delete(url).set(bearer(token));
    const after = await request(app).get(url).set(bearer(token));

    expect(del.status).toBe(204);
    expect(after.status).toBe(404);
  });

  test('a student cannot see or change another student\'s assignments', async () => {
    const assignment = await createAssignment(app, token, course.id);
    const { token: otherToken } = await registerUser(app, { name: 'Sara', email: 'sara@example.com' });
    const url = `/api/assignments/${assignment.id}`;

    const list = await request(app).get('/api/assignments').set(bearer(otherToken));
    const read = await request(app).get(url).set(bearer(otherToken));
    const update = await request(app).put(url).set(bearer(otherToken)).send({ status: 'submitted' });
    const del = await request(app).delete(url).set(bearer(otherToken));
    const add = await request(app)
      .post(`/api/courses/${course.id}/assignments`)
      .set(bearer(otherToken))
      .send({ title: 'Sneaky', dueDate: daysFromNow(1) });
    const mine = await request(app).get(url).set(bearer(token));

    expect(list.body).toEqual([]);
    expect([read.status, update.status, del.status, add.status]).toEqual([404, 404, 404, 404]);
    expect(mine.body.status).toBe('pending');
  });
});
