const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: 'dh3r0unc0',
  api_key: '179538925373142',
  api_secret: 'Prf4S2WqwHiOTU-jumIIJ1QLoN4'
});
cloudinary.api.ping()
  .then(res => console.log("✅ Cloudinary API is WORKING:", res))
  .catch(err => console.error("❌ Cloudinary API FAILED:", err));
