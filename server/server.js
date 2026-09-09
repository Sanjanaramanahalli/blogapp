require('dotenv').config();
const app = require('./app');
const { initSchema } = require('./db/database');

const PORT = process.env.PORT || 3000;

// Ensure database tables exist
initSchema();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 TownTalk Platform Server is running!`);
  console.log(`📡 URL: http://127.0.0.1:${PORT}`);
  console.log(`🔒 Dynamic, validated user authentication active (Database verified)`);
  console.log(`====================================================`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

module.exports = server;
