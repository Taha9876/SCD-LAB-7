const { createApp } = require('./app');
const Store = require('./store');
const { PORT, DB_FILE } = require('./config');

const app = createApp({ store: new Store(DB_FILE) });

app.listen(PORT, () => console.log(`student-course-manager listening on port ${PORT}`));
