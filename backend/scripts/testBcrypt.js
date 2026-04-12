const bcrypt = require('bcryptjs');
const hash = '$2a$10$DMlVVRMUC/Rvy2QKJLeRF.YhhpPfvmvid4dhm1WeF6FTuklgEcmjG';
const passwordsToTest = ['dormsphere123', 'dormsphere', 'password', '123456', 'dormsphere@123', 'admin', 'Student@123', 'student123'];

async function test() {
  for (let p of passwordsToTest) {
    const match = await bcrypt.compare(p, hash);
    if (match) {
      console.log(`✅ MATCH FOUND! The password is: ${p}`);
      return;
    }
  }
  console.log('❌ No matches found for common passwords.');
}
test();
