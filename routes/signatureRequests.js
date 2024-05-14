const { Router } = require('express');
const ensureLogIn = require('connect-ensure-login').ensureLoggedIn;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient()

const router = Router()
const ensureLoggedIn = ensureLogIn();

// Display the homepage
router.get('/', ensureLoggedIn, (req, res, next) => {
   res.render('pages/signatureRequests/index', {
      allRequests: []
   })
})


// // Display the create signature request form
router.get('/signature-requests/create', ensureLoggedIn, (req, res, next) => {
   res.render('pages/signatureRequests/create')
})

module.exports = router