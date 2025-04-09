const multer = require('multer');
const { createCloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinaryConfig');

const storage = createCloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'travelBot', // The name of the folder in Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg'], // Allowed file formats
    },
    });

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'), false);
        }
        cb(null, true);
    },
})
module.exports = upload;
