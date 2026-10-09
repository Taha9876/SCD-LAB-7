const express = require('express');
const { validateCourse, validateAssignment } = require('../validators');
const { COURSE_STATUSES, summarize } = require('../utils/progress');

module.exports = function coursesRouter(store) {
  const router = express.Router();

  const assignmentsOf = (course) => store.find('assignments', (a) => a.courseId === course.id);
  const withProgress = (course) => ({ ...course, progress: summarize(assignmentsOf(course)) });
  const codeTaken = (userId, code, exceptId) =>
    store.findOne('courses', (c) => c.userId === userId && c.code === code && c.id !== exceptId) !== null;

  // Students only ever see their own courses; anyone else's id is a 404.
  router.param('courseId', (req, res, next, id) => {
    const course = store.findOne('courses', (c) => c.id === id && c.userId === req.user.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    req.course = course;
    next();
  });

  // GET /api/courses?code=CS&instructor=ahmed&status=completed
  router.get('/', (req, res) => {
    const { code, instructor, status } = req.query;
    if (status !== undefined && !COURSE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${COURSE_STATUSES.join(', ')}` });
    }

    let courses = store.find('courses', (c) => c.userId === req.user.id).map(withProgress);
    if (code) {
      const wanted = String(code).trim().toUpperCase();
      courses = courses.filter((c) => c.code.includes(wanted));
    }
    if (instructor) {
      const wanted = String(instructor).trim().toLowerCase();
      courses = courses.filter((c) => c.instructor.toLowerCase().includes(wanted));
    }
    if (status) courses = courses.filter((c) => c.progress.status === status);

    res.json(courses);
  });

  router.post('/', (req, res) => {
    const { errors, value } = validateCourse(req.body || {});
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });
    if (codeTaken(req.user.id, value.code)) {
      return res.status(409).json({ error: `You already have a course with code ${value.code}` });
    }

    const course = store.insert('courses', { userId: req.user.id, ...value });
    res.status(201).json(withProgress(course));
  });

  router.get('/:courseId', (req, res) => {
    res.json(withProgress(req.course));
  });

  router.put('/:courseId', (req, res) => {
    const { errors, value } = validateCourse(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });
    if (value.code && codeTaken(req.user.id, value.code, req.course.id)) {
      return res.status(409).json({ error: `You already have a course with code ${value.code}` });
    }

    res.json(withProgress(store.update('courses', req.course.id, value)));
  });

  router.delete('/:courseId', (req, res) => {
    store.remove('assignments', (a) => a.courseId === req.course.id);
    store.remove('courses', (c) => c.id === req.course.id);
    res.status(204).end();
  });

  router.get('/:courseId/progress', (req, res) => {
    const { id, name, code } = req.course;
    res.json({ courseId: id, name, code, ...summarize(assignmentsOf(req.course)) });
  });

  router.get('/:courseId/assignments', (req, res) => {
    res.json(assignmentsOf(req.course));
  });

  router.post('/:courseId/assignments', (req, res) => {
    const { errors, value } = validateAssignment(req.body || {});
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    const status = value.status || 'pending';
    const assignment = store.insert('assignments', {
      userId: req.user.id,
      courseId: req.course.id,
      description: '',
      ...value,
      status,
      submittedAt: status === 'submitted' ? new Date().toISOString() : null,
    });
    res.status(201).json(assignment);
  });

  return router;
};
