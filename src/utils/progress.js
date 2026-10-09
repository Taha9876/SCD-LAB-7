const COURSE_STATUSES = ['not-started', 'in-progress', 'completed'];

const isOverdue = (assignment, now = new Date()) =>
  assignment.status !== 'submitted' && new Date(assignment.dueDate) < now;

// Completion summary for a set of assignments (one course, or everything a student has).
function summarize(assignments, now = new Date()) {
  const total = assignments.length;
  const submitted = assignments.filter((a) => a.status === 'submitted').length;

  let status = 'in-progress';
  if (submitted === 0) status = 'not-started';
  else if (submitted === total) status = 'completed';

  return {
    totalAssignments: total,
    submittedAssignments: submitted,
    pendingAssignments: total - submitted,
    overdueAssignments: assignments.filter((a) => isOverdue(a, now)).length,
    percentComplete: total === 0 ? 0 : Math.round((submitted / total) * 100),
    status,
  };
}

module.exports = { COURSE_STATUSES, isOverdue, summarize };
