const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // change as needed
    password: '', // change as needed
    database: 'user_roles'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to database');
});

// Redirect root to login
app.get('/', (req, res) => {
    res.redirect('/login'); // Redirect to the login page
});


// Routes
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, password, gender, state, district, terms } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(username+password+gender+state+district+terms)

    // Ensure terms is checked (it will be "on" if checked)
    if (!terms) {
        return res.send('You must agree to the terms and conditions.');
    }


    db.query('INSERT INTO users (username, password, gender, state, district, terms) VALUES (?, ?, ?, ?, ?, ?)', [username, hashedPassword, gender, state, district, true], (err) => {
        if (err) throw err;
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                // Store user ID, username, and role in the session
                req.session.userId = user.id;
                req.session.username = user.username; // Save the username
                req.session.role = user.role;         // Save the role
                 req.session.gender=user.gender;     // Save the gender
                 req.session.state=user.state;         //save the state
                 req.session.district=user.district;   //save the district
                return res.redirect('/dashboard');     // Redirect to the dashboard
            }
        }
        res.send('Invalid username or password');
    });
});


app.get('/dashboard', (req, res) => {
    if (!req.session.userId)
    return res.redirect('/login');
    // res.render('dashboard', { userId: req.session.userId, role: req.session.role });
    
    const role = req.session.role;
    const username = req.session.username;    // Ensure you store the username in the session
    const gender = req.session.gender;
    const state = req.session.state; 
    const district = req.session.district;
    db.query('SELECT * FROM users', (err, results) => {
        if (err) throw err;
        res.render('dashboard', { users: results, role, username, gender, state, district });
    });

});



// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard'); // Redirect to dashboard if there's an error
        }
        res.redirect('/login'); // Redirect to login after successful logout
    });
});


// Admin routes
app.post('/delete-user/:id', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});


app.post('/delete-user/:id', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});


// Edit users
app.post('/edit-user/:id', (req, res) => {
    const userId = req.params.id;
    const { username, gender, state, district } = req.body;
    
    db.query('UPDATE users SET username = ?, gender = ?, state = ?, district = ? WHERE id = ?', 
        [username, gender, state, district, userId], 
        (err, result) => {
            if (err) throw err;
            res.redirect('/dashboard'); // Redirect back to the dashboard
        }
    );
});


app.post('/edit-profile', async (req, res) => {
    const userId = req.session.userId;
    const { username, gender, state, district } = req.body;
    console.log(gender)
    console.log(state)
    console.log(district)
    db.query('UPDATE users SET username = ?, gender = ?, state = ?, district = ? WHERE id = ?', 
        [username, gender, state, district, userId], 
        (err, result) => {
            if (err) throw err;
              // Update session data
              req.session.username = username;
              req.session.gender = gender;
              req.session.state = state;
              req.session.district = district;
  
            res.redirect('/dashboard'); // Redirect back to the dashboard
        }
    );
});


// Route to render the change password form
app.get('/change-password', (req, res) => {
    if (!req.session.userId) 
    return res.redirect('/login');
    res.render('change-password'); // Create a new EJS file for this
});


// Handle the change password form submission
app.post('/change-password', async (req, res) => {
    if (!req.session.userId) 
        return res.redirect('/login');

    const { currentPassword, newPassword } = req.body;
    console.log(currentPassword + newPassword);
    
    db.query('SELECT * FROM users WHERE id = ?', [req.session.userId], async (err, results) => {
        if (err) throw err;
        
        const user = results[0];
        const match = await bcrypt.compare(currentPassword, user.password);
        if (match) {
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, user.id], (err) => {
                if (err) throw err;
                req.session.destroy(); // Destroy the session to log the user out
                res.redirect('/login'); // Redirect to the login page after success
            });
        } else {
            res.send('Current password is incorrect'); // Handle incorrect current password
        }
    });
});





app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
