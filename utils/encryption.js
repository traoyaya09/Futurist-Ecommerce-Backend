const crypto = require('crypto');

const algorithm = 'aes-256-cbc'; // Algorithm for encryption
const secretKey = process.env.ENCRYPTION_SECRET_KEY || 'your_secret_key'; // Define your secret key
const iv = crypto.randomBytes(16); // Generate random initialization vector

// Encrypt text
const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

// Decrypt text
const decrypt = (encryptedText) => {
  const [ivText, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'hex'), Buffer.from(ivText, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = {
  encrypt,
  decrypt,
};
