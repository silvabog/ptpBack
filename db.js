const { Pool } = require('pg');

// Use hardcoded connection string
const pool = new Pool({
  connectionString: 'postgresql://passthepages_user:I7Xq1n3p9JPhXgdOaCgmnmU9iN8NcXwn@dpg-d0422pbuibrs73amejhg-a.oregon-postgres.render.com/passthepages',
  ssl: {
    rejectUnauthorized: false, // required for Render PostgreSQL
  },
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Successfully connected to the database');
  }
  release();
});

module.exports = pool;
