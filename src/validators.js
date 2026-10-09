const ASSIGNMENT_STATUSES = ['pending', 'submitted'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

// Each validator returns { errors, value }. With partial: true, missing fields are
// allowed (used for updates) and value only holds the fields that were sent.
function requiredString(body, field, { partial, errors, value }) {
  if (body[field] === undefined) {
    if (!partial) errors.push(`${field} is required`);
  } else if (!isNonEmptyString(body[field])) {
    errors.push(`${field} must be a non-empty string`);
  } else {
    value[field] = body[field].trim();
  }
}

function validateRegistration(body) {
  const ctx = { partial: false, errors: [], value: {} };
  requiredString(body, 'name', ctx);

  if (!isNonEmptyString(body.email) || !EMAIL_RE.test(body.email.trim())) {
    ctx.errors.push('email must be a valid email address');
  } else {
    ctx.value.email = body.email.trim().toLowerCase();
  }

  if (typeof body.password !== 'string' || body.password.length < 6) {
    ctx.errors.push('password must be at least 6 characters');
  } else {
    ctx.value.password = body.password;
  }

  return { errors: ctx.errors, value: ctx.value };
}

function validateCourse(body, { partial = false } = {}) {
  const ctx = { partial, errors: [], value: {} };
  requiredString(body, 'name', ctx);
  requiredString(body, 'code', ctx);
  requiredString(body, 'instructor', ctx);
  if (ctx.value.code) ctx.value.code = ctx.value.code.toUpperCase();

  if (body.creditHours === undefined) {
    if (!partial) ctx.errors.push('creditHours is required');
  } else {
    const raw = body.creditHours;
    const hours = typeof raw === 'number' || isNonEmptyString(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(hours) || hours < 1) {
      ctx.errors.push('creditHours must be a positive integer');
    } else {
      ctx.value.creditHours = hours;
    }
  }

  return { errors: ctx.errors, value: ctx.value };
}

function validateAssignment(body, { partial = false } = {}) {
  const ctx = { partial, errors: [], value: {} };
  requiredString(body, 'title', ctx);

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') ctx.errors.push('description must be a string');
    else ctx.value.description = body.description.trim();
  }

  if (body.dueDate === undefined) {
    if (!partial) ctx.errors.push('dueDate is required');
  } else {
    const due = isNonEmptyString(body.dueDate) ? new Date(body.dueDate) : new Date(NaN);
    if (Number.isNaN(due.getTime())) ctx.errors.push('dueDate must be a valid date');
    else ctx.value.dueDate = due.toISOString();
  }

  if (body.status !== undefined) {
    if (!ASSIGNMENT_STATUSES.includes(body.status)) {
      ctx.errors.push(`status must be one of: ${ASSIGNMENT_STATUSES.join(', ')}`);
    } else {
      ctx.value.status = body.status;
    }
  }

  return { errors: ctx.errors, value: ctx.value };
}

module.exports = { ASSIGNMENT_STATUSES, validateRegistration, validateCourse, validateAssignment };
