// utils/db.js
// 역할: SQLite DB 초기화
// 담당: 최유리

const Database = require("better-sqlite3");
const path = require("path");
const logger = require("./logger");

const db = new Database(path.join(__dirname, "../data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS prompts (
    token_id          TEXT PRIMARY KEY,
    encrypted_content TEXT NOT NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usage (
    wallet    TEXT NOT NULL,
    token_id  TEXT NOT NULL,
    count     INTEGER DEFAULT 0,
    PRIMARY KEY (wallet, token_id)
  );

  CREATE TABLE IF NOT EXISTS nonces (
    wallet     TEXT PRIMARY KEY,
    nonce      TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

logger.info("DB 초기화 완료");
module.exports = db;
