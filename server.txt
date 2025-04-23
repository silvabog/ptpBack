const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db'); // import the DB connection

const app = express();
app.use(cors());
app.use(bodyParser.json()); // Middleware to parse JSON requests

const port = 5000; 

// JWT Secret Key
const JWT_SECRET = 'your-secret-key';

// Register route for user sign-up
app.post('/register', async (req, res) => {
    const { username, email, password, first_name, last_name } = req.body;

    if (!email.includes('@kean.edu')) {
        return res.status(400).json({ message: 'Email must be a @kean.edu email' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await pool.query(
            'INSERT INTO users (username, email, password, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [username, email, hashedPassword, first_name, last_name]
        );
        const user = result.rows[0];

        // Generate JWT token for authentication
        const token = jwt.sign({ user_id: user.user_id }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'User registered successfully', token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Login route for user sign-in
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare password with stored hash
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ user_id: user.user_id }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Login successful', token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Middleware to verify JWT token and extract user information
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(403).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid token.' });
    }
};

// Example of a route that requires user to be authenticated
app.get('/profile', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.user.user_id]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Book listing route (for authenticated users)
app.post('/books', async (req, res) => {
    try {
        const { title, author, subject, condition, description } = req.body;
        const newBook = await pool.query(
            "INSERT INTO books (title, author, subject, condition, description) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [title, author, subject, condition, description]
        );

        // Send a success response with the added book details
        res.status(201).json({ 
            message: "Book added successfully!", 
            book: newBook.rows[0] 
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error. Failed to add book." });
    }
});



// Get list of books
app.get('/books', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM books WHERE is_available = TRUE');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Send a message

app.post('/messages', verifyToken, async (req, res) => {
    const { receiver_user_id, message } = req.body;
    const sender_user_id = req.user.user_id; // Get sender's ID from the JWT token

    try {
        // Insert the message into the database
        const result = await pool.query(
            "INSERT INTO messages (sender_user_id, receiver_user_id, message) VALUES ($1, $2, $3) RETURNING *",
            [sender_user_id, receiver_user_id, message]
        );
        
        // Return success message with the new message details
        res.status(201).json({ 
            message: "Message sent successfully!", 
            sentMessage: result.rows[0] 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to send message.' });
    }
});



// Get messages between two users
// Get messages between two users
app.get('/messages', verifyToken, async (req, res) => {
    const { other_user_id } = req.query;
    const current_user_id = req.user.user_id; // Get sender's ID from the JWT token

    try {
        // Fetch messages where the sender and receiver match either combination, and include sender username
        const result = await pool.query(
            `SELECT messages.*, users.username AS sender_username
            FROM messages
            JOIN users ON users.user_id = messages.sender_user_id
            WHERE 
                (sender_user_id = $1 AND receiver_user_id = $2) 
                OR (sender_user_id = $2 AND receiver_user_id = $1)
            ORDER BY sent_at`,
            [current_user_id, other_user_id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to retrieve messages.' });
    }
});


// Fetch all users except the current user
app.get('/users', verifyToken, async (req, res) => {
    try {
        const { user_id } = req.user;

        // Query all users except the current one, return user_id and username
        const result = await pool.query(
            'SELECT user_id, username FROM users WHERE user_id != $1',
            [user_id]
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Failed to fetch users." });
    }
});



// Make a transaction (tip/donation)
app.post('/transactions', verifyToken, async (req, res) => {
    try {
        const { receiver_id, book_id, amount } = req.body;
        const sender_id = req.user.user_id; // Authenticated user

        const newTransaction = await pool.query(
            "INSERT INTO transactions (sender_id, receiver_id, book_id, amount) VALUES ($1, $2, $3, $4) RETURNING *",
            [sender_id, receiver_id, book_id, amount]
        );

        res.status(201).json({ message: "Transaction successful!", transaction: newTransaction.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Transaction failed." });
    }
});

// Get transactions for a user
app.get('/transactions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const transactions = await pool.query(
            "SELECT * FROM transactions WHERE sender_id = $1 OR receiver_id = $1 ORDER BY timestamp DESC",
            [userId]
        );

        res.json(transactions.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch transactions." });
    }
});



