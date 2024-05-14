const DropboxSign = require("@dropbox/sign");
const fs = require("fs");

const signatureRequestApi = new DropboxSign.SignatureRequestApi();
const embeddedApi = new DropboxSign.EmbeddedApi();

// Configure HTTP basic authorization
signatureRequestApi.username = process.env.DS_API_KEY;
embeddedApi.username = process.env.DS_API_KEY;

const createEmbeddedSignatureRequest = async (req, signers, filePath) => {
    try {
        const signingOptions = {
            draw: true,
            type: true,
            upload: true,
            phone: true,
            defaultType: "draw",
        };

        const data = {
            clientId: process.env.DS_CLIENT_ID,
            title: req.body.title,
            subject: req.body.title,
            message: req.body.description,
            signers,
            ccEmailAddresses: ["lawyer@example.com"],
            files: [fs.createReadStream(filePath)],
            signingOptions,
            testMode: true,
        };

        return await signatureRequestApi.signatureRequestCreateEmbedded(data);
    } catch (error) {
        console.log(error);
    }
};

const generateSignUrl = async (signatureId) => {
    try {
        return await embeddedApi.embeddedSignUrl(signatureId);
    } catch (error) {
        console.log(error);
    }
};

module.exports = { createEmbeddedSignatureRequest, generateSignUrl };