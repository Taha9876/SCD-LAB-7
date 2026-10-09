const express = require('express');
const { ASSIGNMENT_STATUSES, validateAssignment } = require('../validators');
const { isOverdue } = require('../utils/progress');

const LIST_STATUSES = [...ASSIGNMENT_STATUSES, 'overdue'];

module.exports = function assignmentsRouter(store) {
  const router = express.Router();

  router.param('assignmentId', (req, res, next, id) => {
    const assignment = store.findOne('assignments', (a) => a.id === id && a.userId === req.user.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    req.assignment = assignment;
    next();
  });

  // GET /api/assignments?status=pending|submitted|overdue&courseId=...  (soonest due first)
  router.get('/', (req, res) => {
    const { status, courseId } = req.query;
    if (status !== undefined && !LIST_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${LIST_STATUSES.join(', ')}` });
    }

    let assignments = store.find('assignments', (a) => a.userId === req.user.id);
    if (courseId) assignments = assignments.filter((a) => a.courseId === courseId);
    if (status === 'overdue') assignments = assignments.filter((a) => isOverdue(a));
    else if (status) assignments = assignments.filter((a) => a.status === status);

    assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    res.json(assignments);
  });

  router.get('/:assignmentId', (req, res) => {
    res.json(req.assignment);
  });

  router.put('/:assignmentId', (req, res) => {
    const { errors, value } = validateAssignment(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    if (value.status && value.status !== req.assignment.status) {
      value.submittedAt = value.status === 'submitted' ? new Date().toISOString() : null;
    }
    res.json(store.update('assignments', req.assignment.id, value));
  });

  router.delete('/:assignmentId', (req, res) => {
    store.remove('assignments', (a) => a.id === req.assignment.id);
    res.status(204).end();
  });

  return router;
};
