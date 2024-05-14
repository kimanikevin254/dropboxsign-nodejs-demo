const { Router } = require('express');
const ensureLogIn = require('connect-ensure-login').ensureLoggedIn;
const { PrismaClient } = require('@prisma/client');
const multer = require("multer");
const fs = require("fs");
const {
    createEmbeddedSignatureRequest,
    generateSignUrl,
} = require("../utils/dropbox");

// Multer configuration for handling file uploads
const upload = multer({ storage: multer.memoryStorage() }); // Configure multer to use in-memory storage

const prisma = new PrismaClient()

const router = Router()
const ensureLoggedIn = ensureLogIn();

// Display the homepage
router.get("/", ensureLoggedIn, async (req, res, next) => {
   // Fetch all requests where the user is the initiator
   const initiatorSignatureRequests = await prisma.signatureRequest.findMany({
       where: { initiatorId: req.user.id },
       select: {
           requestId: true,
           title: true,
           description: true,
           documentUrl: true,
           status: true,
           user: {
               select: {
                   name: true,
               },
           },
       },
   });

   // Fetch all requests where the user is a signatory
   // Retrieve user email from DB
   const user = await prisma.user.findUnique({
       where: { id: req.user.id },
       select: { email: true },
   });

   const signatorySignatureRequests = await prisma.signatory.findMany({
       where: { email: user.email },
       select: {
           signatureRequest: {
               select: {
                   requestId: true,
                   title: true,
                   description: true,
                   documentUrl: true,
                   status: true,
                   user: {
                       select: {
                           name: true,
                       },
                   },
               },
           },
       },
   });

   // Restructure the signatorySignatureRequests array
   const newSignatorySignatureRequests = signatorySignatureRequests.map(
       (item) => item.signatureRequest
   );

   // Merge the arrays without duplicates
   const allRequests = initiatorSignatureRequests
       .concat(newSignatorySignatureRequests)
       .reduce((acc, obj) => {
           // Check if an object with the same 'name' property already exists in the accumulator array
           const existingObj = acc.find(
               (item) => item.requestId === obj.requestId
           );
           // If not found, add the object to the accumulator array
           if (!existingObj) {
               acc.push(obj);
           }
           return acc;
       }, []);

   res.render("pages/signatureRequests/index", {
       allRequests,
   });
});


// // Display the create signature request form
router.get('/signature-requests/create', ensureLoggedIn, (req, res, next) => {
   res.render('pages/signatureRequests/create')
})

// Create embedded signature request
router.post(
   "/signature-requests/create",
   ensureLoggedIn,
   upload.single("document"),
   async (req, res, next) => {
       try {
           // TODO: Validate all input fields

           // Save the document to file system
           const uploadedFile = req.file;
           const filePath =
               "uploads/" +
               new Date().toISOString().split("T").join("_") +
               "_" +
               uploadedFile.originalname;

           fs.writeFileSync(filePath, uploadedFile.buffer);

           // Extract data from request body
           const {
               title,
               description,
               signatory_name,
               signatory_email,
               signatory_position,
           } = req.body;

           // Save the signature request to the DB
           const signatureRequest = await prisma.signatureRequest.create({
               data: {
                   title,
                   description,
                   documentUrl: filePath,
                   initiatorId: req.user.id,
                   status: "pending",
                   referenceId: "", // Will be updated later
               },
           });

           // Save the signatories to DB
           let signatories = [];

           for (let i = 0; i < signatory_name.length; i++) {
               console.log("Name", signatory_name[i]);
               // Make sure the signatory
               const signatory = await prisma.signatory.create({
                   data: {
                       name: signatory_name[i],
                       email: signatory_email[i],
                       position: signatory_position[i],
                       dsSignatureId: "", // To be updated later
                       signatureRequestId: signatureRequest.requestId,
                       status: "pending",
                   },
               });

               signatories.push(signatory);
           }

           // Create embedded signature request on Dropbox Sign
           // Create a signers array
           const signers = [];
           for (let i = 0; i < signatory_name.length; i++) {
               const signer = {
                   name: signatory_name[i],
                   email_address: signatory_email[i],
               };

               signers.push(signer);
           }
           const {
               body: { signatureRequest: signature_request },
           } = await createEmbeddedSignatureRequest(req, signers, filePath);

           // Update the signature request reference ID
           const updatedSignatureRequest =
               await prisma.signatureRequest.update({
                   where: { requestId: signatureRequest.requestId },
                   data: { referenceId: signature_request.signatureRequestId },
               });

           // Update the signatories dsSignatureId
           signature_request.signatures.map(async (signature, i) => {
               // Get the array index of the signatory
               const signatoryIndex = signatories.findIndex(
                   (el) => el.email === signature.signerEmailAddress
               );

               // Retrieve the signature.signer_email_adress from DB
               const signatory = await prisma.signatory.findUnique({
                   where: {
                       signatoryId: signatories[signatoryIndex].signatoryId,
                   },
               });

               if (!signatory) return;

               // Make the updates
               await prisma.signatory.update({
                   where: {
                       signatoryId: signatories[signatoryIndex].signatoryId,
                   },
                   data: {
                       dsSignatureId: signature.signatureId,
                   },
               });
           });

           // Redirect to homepage
           res.redirect("/");
       } catch (error) {
           console.log(error);
       }
   }
)

// Dislay signature request details
router.get(
   "/signature-requests/:requestId",
   ensureLoggedIn,
   async (req, res, next) => {
       try {
           const { requestId } = req.params;

           // Retrieve the signature request from the database
           const signatureRequest = await prisma.signatureRequest.findUnique({
               where: { requestId },
               select: {
                   requestId: true,
                   title: true,
                   description: true,
                   documentUrl: true,
                   status: true,
                   user: {
                       select: {
                           name: true,
                       },
                   },
                   signatories: true,
               },
           });

           // Check if current user is a signatory
           // Retrieve user email from DB
           const user = await prisma.user.findUnique({
               where: { id: req.user.id },
               select: { email: true },
           });

           const isSignatory = signatureRequest.signatories.some(
               (el) => el.email === user.email
           );

           if (isSignatory) {
               const signatory = signatureRequest.signatories.find(
                   (el) => el.email === user.email
               );

               const signUrl = await generateSignUrl(signatory.dsSignatureId);

               signatureRequest["signUrl"] = signUrl.body.embedded.signUrl;
           }

           res.render("pages/signatureRequests/details", {
               signatureRequest,
           });
       } catch (error) {
           console.log(error);
       }
   }
);

module.exports = router