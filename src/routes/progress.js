const express = require('express');
const { summarize } = require('../utils/progress');

module.exports = function progressRouter(store) {
  const router = express.Router();

  // Overall academic progress for the logged-in student, with a per-course breakdown.
  router.get('/', (req, res) => {
    const assignments = store.find('assignments', (a) => a.userId === req.user.id);
    const courses = store.find('courses', (c) => c.userId === req.user.id).map((course) => ({
      id: course.id,
      name: course.name,
      code: course.code,
      creditHours: course.creditHours,
      progress: summarize(assignments.filter((a) => a.courseId === course.id)),
    }));

    const withStatus = (status) => courses.filter((c) => c.progress.status === status);
    const creditHours = (list) => list.reduce((sum, c) => sum + c.creditHours, 0);
    const { status, ...overall } = summarize(assignments);

    res.json({
      totalCourses: courses.length,
      completedCourses: withStatus('completed').length,
      inProgressCourses: withStatus('in-progress').length,
      notStartedCourses: withStatus('not-started').length,
      totalCreditHours: creditHours(courses),
      completedCreditHours: creditHours(withStatus('completed')),
      ...overall,
      courses,
    });
  });

  return router;
};
