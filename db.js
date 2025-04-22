const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'PassThePages',  // replace with your database name
    password: '1093759',
    port: 5432,
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
