const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const COLLECTIONS = ['users', 'courses', 'assignments'];

// JSON-backed store. Without a file path it lives in memory only (used by the tests).
class Store {
  constructor(filePath) {
    this.filePath = filePath || null;
    this.data = { users: [], courses: [], assignments: [] };

    if (this.filePath && fs.existsSync(this.filePath)) {
      const saved = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      for (const name of COLLECTIONS) this.data[name] = saved[name] || [];
    }
  }

  save() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  find(collection, predicate = () => true) {
    return this.data[collection].filter(predicate);
  }

  findOne(collection, predicate) {
    return this.data[collection].find(predicate) || null;
  }

  insert(collection, doc) {
    const now = new Date().toISOString();
    const record = { id: randomUUID(), ...doc, createdAt: now, updatedAt: now };
    this.data[collection].push(record);
    this.save();
    return record;
  }

  update(collection, id, changes) {
    const record = this.findOne(collection, (r) => r.id === id);
    if (!record) return null;
    Object.assign(record, changes, { updatedAt: new Date().toISOString() });
    this.save();
    return record;
  }

  remove(collection, predicate) {
    const before = this.data[collection].length;
    this.data[collection] = this.data[collection].filter((r) => !predicate(r));
    this.save();
    return before - this.data[collection].length;
  }
}

module.exports = Store;
