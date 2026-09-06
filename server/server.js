const app = require('./app');
const { initSchema } = require('./db/database');

const PORT = process.env.PORT || 3000;

// Ensure database tables exist
initSchema();

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Full-Stack Blog Application Server is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`👤 Admin: admin@blog.com / Admin@123456`);
  console.log(`📖 Reader: john@reader.com / Reader@123`);
  console.log(`====================================================`);
});
