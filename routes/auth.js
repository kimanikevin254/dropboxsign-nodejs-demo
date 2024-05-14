const { Router } = require('express')
const passport = require('passport')
const localStrategy = require('passport-local').Strategy
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

// Configure password authentication strategy.
passport.use(new localStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    async (req, username, password, done) => {
        const user = await prisma.user.findUnique({
            where: { email: username }
        })

        if (!user) return done(null, false, { message: 'Incorrect username or password.' })

        // Check if user's password is valid
        const isPasswordValid = await bcrypt.compare(password, user.password)

        // Return an error if password is not valid
        if(!isPasswordValid) return done(null, false, { message: 'Incorrect password' })

        // Return user for correct email and password
        return done(null, user, { message: 'Logged in successfully' })
    }
))

// Persist user information in the login session
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

const router = Router()

// Show sign up page
router.get('/signup', function(req, res) {
    res.render('pages/auth/signup');
});

// Sign up
router.post('/signup', async (req, res, next) => {
    const { name, email, password, confirm_password } = req.body

    // Make sure passwords match
    if(password !== confirm_password){
        return res.render('pages/auth/signup', {
            errors: ['Passwords do not match']
        })
    }

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Save the user to DB
        const user = await prisma.user.create({
            data: {
                name: req.body.name,
                email,
                password: hashedPassword
            }
        })

        // Log in the user
        const userData = {
            id: user.id,
            email: user.email
        }

        req.login(userData, function(err) {
            if (err) { return next(err) }
            res.redirect('/')
        })

    } catch (error) {
        // User already exists
        if(error.code === 'P2002' && error.meta && error.meta.target.includes('email')){
            return res.render('pages/auth/signup', {
                errors: ['Email already registered']
            })
        } else {
            // Return any other error
            return res.render('pages/auth/signup', {
                errors: ['An error occured.']
            })
        }
    }
})

// Show login page
router.get('/login', function(req, res) {
    res.render('pages/auth/login');
});

// Log in
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        // Email not registered
        if(!err && !user){
            return res.render('pages/auth/login', {
                errors: [info.message]
            })
        }

        // Log in the user
        if(user){
            // Log in the user
            const userData = {
                id: user.id,
                email: user.email
            }

            req.login(userData, function(err) {
                if (err) { return next(err) }
                res.redirect('/')
            })
        }
    })(req, res, next)
})

router.post('/logout', async (req, res, next) => {
    req.logout(function(err) {
        if (err) return next(err)
        res.redirect('/')
    })
})

module.exports = router