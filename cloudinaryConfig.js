const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME||"dlrx3l1zp",       // Your Cloudinary Cloud Name
  api_key: process.env.CLOUDINARY_API_KEY||"362394574787881",  // Your Cloudinary API Key
  api_secret: process.env.CLOUDINARY_API_SECRET||"gSbBNI0DiEMv8_xZ4XSJWD9YKho", // Your Cloudinary API Secret
});

module.exports = cloudinary;
