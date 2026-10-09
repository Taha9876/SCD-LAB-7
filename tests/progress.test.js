const request = require('supertest');
const { setup, registerUser, bearer, daysFromNow, createCourse, createAssignment } = require('./helpers');
const { summarize } = require('../src/utils/progress');

describe('summarize', () => {
  const now = new Date('2026-10-09T12:00:00.000Z');
  const assignment = (status, dueDate) => ({ status, dueDate });

  test('reports an empty course as not started at 0%', () => {
    expect(summarize([], now)).toEqual({
      totalAssignments: 0,
      submittedAssignments: 0,
      pendingAssignments: 0,
      overdueAssignments: 0,
      percentComplete: 0,
      status: 'not-started',
    });
  });

  test('counts submitted, pending and overdue assignments', () => {
    const result = summarize(
      [
        assignment('submitted', '2026-10-01T00:00:00.000Z'),
        assignment('pending', '2026-10-01T00:00:00.000Z'),
        assignment('pending', '2026-10-20T00:00:00.000Z'),
      ],
      now
    );

    expect(result).toEqual({
      totalAssignments: 3,
      submittedAssignments: 1,
      pendingAssignments: 2,
      overdueAssignments: 1,
      percentComplete: 33,
      status: 'in-progress',
    });
  });

  test('reports a course as completed once everything is submitted', () => {
    const result = summarize([assignment('submitted', '2026-10-01T00:00:00.000Z')], now);
    expect(result.status).toBe('completed');
    expect(result.percentComplete).toBe(100);
  });
});

describe('progress tracking', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = setup());
    ({ token } = await registerUser(app));
  });

  test('course progress follows assignment submissions', async () => {
    const course = await createCourse(app, token);
    const first = await createAssignment(app, token, course.id);
    const second = await createAssignment(app, token, course.id, { dueDate: daysFromNow(-1) });
    const progress = async () =>
      (await request(app).get(`/api/courses/${course.id}/progress`).set(bearer(token))).body;
    const submit = (assignment) =>
      request(app).put(`/api/assignments/${assignment.id}`).set(bearer(token)).send({ status: 'submitted' });

    expect(await progress()).toMatchObject({
      courseId: course.id,
      code: 'CS-301',
      totalAssignments: 2,
      submittedAssignments: 0,
      overdueAssignments: 1,
      percentComplete: 0,
      status: 'not-started',
    });

    await submit(first);
    expect(await progress()).toMatchObject({ percentComplete: 50, status: 'in-progress' });

    await submit(second);
    expect(await progress()).toMatchObject({
      submittedAssignments: 2,
      pendingAssignments: 0,
      overdueAssignments: 0,
      percentComplete: 100,
      status: 'completed',
    });
  });

  test('overall progress summarises every course', async () => {
    const se = await createCourse(app, token);
    const db = await createCourse(app, token, { name: 'Databases', code: 'CS-220', creditHours: 4 });
    await createCourse(app, token, { name: 'Calculus', code: 'MATH-101', creditHours: 2 });

    await createAssignment(app, token, se.id, { status: 'submitted' });
    await createAssignment(app, token, se.id, { status: 'submitted' });
    await createAssignment(app, token, db.id, { status: 'submitted' });
    await createAssignment(app, token, db.id, { dueDate: daysFromNow(-2) });

    const res = await request(app).get('/api/progress').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalCourses: 3,
      completedCourses: 1,
      inProgressCourses: 1,
      notStartedCourses: 1,
      totalCreditHours: 9,
      completedCreditHours: 3,
      totalAssignments: 4,
      submittedAssignments: 3,
      pendingAssignments: 1,
      overdueAssignments: 1,
      percentComplete: 75,
    });
    expect(res.body.status).toBeUndefined();
    expect(res.body.courses.map((c) => [c.code, c.progress.percentComplete])).toEqual([
      ['CS-301', 100],
      ['CS-220', 50],
      ['MATH-101', 0],
    ]);
  });

  test('a new student starts with empty progress', async () => {
    const res = await request(app).get('/api/progress').set(bearer(token));

    expect(res.body).toMatchObject({
      totalCourses: 0,
      totalAssignments: 0,
      percentComplete: 0,
      courses: [],
    });
  });

  test('progress only counts the logged-in student\'s work', async () => {
    const course = await createCourse(app, token);
    await createAssignment(app, token, course.id, { status: 'submitted' });
    const { token: otherToken } = await registerUser(app, { name: 'Sara', email: 'sara@example.com' });

    const res = await request(app).get('/api/progress').set(bearer(otherToken));

    expect(res.body.totalCourses).toBe(0);
    expect(res.body.totalAssignments).toBe(0);
  });
});
