const express = require('express')
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport')
const path = require('path')

var SQLiteStore = require('connect-sqlite3')(session);

require('dotenv').config()

const authRoutes = require('./routes/auth')
const signatureRequestsRoutes = require('./routes/signatureRequests')

const app = express()

// Disable powered-by heder
app.disable('x-powered-by')

// Parse request bodies
app.use(express.json())
app.use(express.urlencoded({ extended: false }));

// Set the view engine to ejs
app.set('view engine', 'ejs');

// Serve static files from the "public" directory
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set up session management
app.use(cookieParser())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false, // Don't save session if not modified
    saveUninitialized: false, // Don't create session until something stored
    store: new SQLiteStore({ db: 'dev.db', dir: './prisma' })
}))
app.use(passport.authenticate('session'));

// Register routes
app.use('/', authRoutes)
app.use('/', signatureRequestsRoutes)

app.listen(3001, () => {
    console.log('Server listening on port 3001');
})
