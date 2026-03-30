// utils/crypto.js
// 역할: AES-256-CBC 암호화/복호화
// 담당: 최유리

const crypto = require("crypto");
const logger = require("./logger");

let _key = null;
function getKey() {
  if (!_key) {
    _key = Buffer.from(process.env.ENCRYPT_KEY, "hex");
  }
  return _key;
}

function encrypt(plainText) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(encryptedData) {
  const [ivHex, encHex] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");

  logger.info("프롬프트 복호화 완료 (내용 비공개)");
  return decrypted;
}

module.exports = { encrypt, decrypt };
