const fs = require('fs');
const os = require('os');
const path = require('path');
const Store = require('../src/store');

describe('Store', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-store-'));
    file = path.join(dir, 'nested', 'db.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('assigns ids and timestamps on insert', () => {
    const store = new Store();
    const record = store.insert('courses', { name: 'Databases' });

    expect(record.id).toEqual(expect.any(String));
    expect(record.createdAt).toBe(record.updatedAt);
    expect(store.findOne('courses', (c) => c.id === record.id)).toBe(record);
  });

  test('updates and removes records', () => {
    const store = new Store();
    const record = store.insert('courses', { name: 'Databases' });

    expect(store.update('courses', record.id, { name: 'Databases II' }).name).toBe('Databases II');
    expect(store.update('courses', 'missing', { name: 'x' })).toBeNull();
    expect(store.remove('courses', (c) => c.id === record.id)).toBe(1);
    expect(store.find('courses')).toEqual([]);
  });

  test('persists to disk and reloads', () => {
    const first = new Store(file);
    const course = first.insert('courses', { name: 'Databases' });
    first.update('courses', course.id, { name: 'Databases II' });

    const reloaded = new Store(file);

    expect(reloaded.find('courses')).toHaveLength(1);
    expect(reloaded.findOne('courses', (c) => c.id === course.id).name).toBe('Databases II');
    expect(reloaded.find('users')).toEqual([]);
  });

  test('does not touch the disk when no file is given', () => {
    new Store().insert('courses', { name: 'Databases' });
    expect(fs.existsSync(file)).toBe(false);
  });
});
