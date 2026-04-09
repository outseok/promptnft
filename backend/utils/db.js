// utils/db.js
// 역할: 통합 SQLite DB 초기화 (sql.js — WebAssembly 기반)
// 장우혁(데이터 테이블) + 최유리(보안 테이블) 통합

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DB_PATH = path.join(__dirname, "../data.db");

let db = null;
let _ready = null;

function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// DB 초기화 (서버 시작 시 1회 호출)
async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON;");

  // ── 장우혁 담당 테이블 ──
  db.run(`
    CREATE TABLE IF NOT EXISTS nfts (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id          INTEGER UNIQUE NOT NULL,
      title             TEXT    NOT NULL,
      description       TEXT,
      prompt_encrypted  TEXT    NOT NULL,
      creator_address   TEXT    NOT NULL,
      owner_address     TEXT    NOT NULL,
      price             TEXT    DEFAULT '0',
      royalty_percent   INTEGER DEFAULT 10,
      category          TEXT,
      image_url         TEXT,
      execution_count   INTEGER DEFAULT 0,
      max_executions    INTEGER DEFAULT 50,
      is_for_sale       INTEGER DEFAULT 1,
      mint_mode         TEXT    DEFAULT 'direct',
      is_minted         INTEGER DEFAULT 1,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 마이그레이션: 기존 DB에 새 컬럼 추가
  try { db.run("ALTER TABLE nfts ADD COLUMN mint_mode TEXT DEFAULT 'direct'"); } catch(e) {}
  try { db.run("ALTER TABLE nfts ADD COLUMN is_minted INTEGER DEFAULT 1"); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id         INTEGER NOT NULL,
      executor_address TEXT    NOT NULL,
      executed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token_id) REFERENCES nfts(token_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id      INTEGER NOT NULL,
      from_address  TEXT    NOT NULL,
      to_address    TEXT    NOT NULL,
      price         TEXT    NOT NULL,
      tx_hash       TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token_id) REFERENCES nfts(token_id)
    )
  `);

  // ── 최유리 담당 테이블 ──
  db.run(`
    CREATE TABLE IF NOT EXISTS prompts (
      token_id          TEXT PRIMARY KEY,
      encrypted_content TEXT NOT NULL,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usage (
      wallet    TEXT NOT NULL,
      token_id  TEXT NOT NULL,
      count     INTEGER DEFAULT 0,
      PRIMARY KEY (wallet, token_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nonces (
      wallet     TEXT PRIMARY KEY,
      nonce      TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  saveDB();
  logger.info(`DB 초기화 완료: ${DB_PATH}`);
  return db;
}

// ── 헬퍼: sql.js → 객체 배열 변환 ──
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// ── better-sqlite3 호환 래퍼 (최유리 코드 호환) ──
// db.prepare(sql).get(...params) / .all(...params) / .run(...params)
const dbWrapper = {
  prepare(sql) {
    return {
      get(...params) {
        return queryOne(sql, params);
      },
      all(...params) {
        return queryAll(sql, params);
      },
      run(...params) {
        runSql(sql, params);
        return { lastInsertRowid: queryOne("SELECT last_insert_rowid() as id")?.id };
      },
    };
  },
  exec(sql) {
    db.run(sql);
    saveDB();
  },
};

// ── 장우혁 담당 쿼리 함수 모음 ──
const queries = {
  insertNFT(data) {
    runSql(
      `INSERT INTO nfts (token_id, title, description, prompt_encrypted,
                         creator_address, owner_address, price, category, image_url,
                         max_executions, mint_mode, is_minted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.token_id, data.title, data.description, data.prompt_encrypted,
       data.creator_address, data.owner_address, data.price, data.category, data.image_url,
       data.max_executions || 50, data.mint_mode || 'direct', data.is_minted !== undefined ? data.is_minted : 1]
    );
    return { lastInsertRowid: queryOne("SELECT last_insert_rowid() as id")?.id };
  },

  getNextLazyTokenId() {
    const row = queryOne("SELECT COALESCE(MIN(token_id), 0) - 1 AS next_id FROM nfts WHERE token_id < 0");
    return row ? row.next_id : -1;
  },

  getAllNFTs() {
    return queryAll(`
      SELECT token_id, title, description, creator_address, owner_address,
             price, royalty_percent, category, image_url,
             execution_count, max_executions, is_for_sale,
             mint_mode, is_minted, created_at
      FROM nfts ORDER BY created_at DESC
    `);
  },

  getForSaleNFTs() {
    return queryAll(`
      SELECT token_id, title, description, creator_address, owner_address,
             price, royalty_percent, category, image_url,
             execution_count, max_executions, is_for_sale,
             mint_mode, is_minted, created_at
      FROM nfts WHERE is_for_sale = 1 ORDER BY created_at DESC
    `);
  },

  getMyNFTs(ownerAddress) {
    return queryAll(`
      SELECT token_id, title, description, creator_address, owner_address,
             price, royalty_percent, category, image_url,
             execution_count, max_executions, is_for_sale,
             mint_mode, is_minted, created_at
      FROM nfts WHERE owner_address = ? ORDER BY created_at DESC
    `, [ownerAddress]);
  },

  getNFTByTokenId(tokenId) {
    return queryOne("SELECT * FROM nfts WHERE token_id = ?", [tokenId]);
  },

  updateOwner(data) {
    runSql(
      `UPDATE nfts SET owner_address = ?, price = ?, is_for_sale = 0,
              updated_at = datetime('now') WHERE token_id = ?`,
      [data.new_owner, data.price, data.token_id]
    );
  },

  updateSaleStatus(data) {
    runSql(
      `UPDATE nfts SET is_for_sale = ?, price = ?,
              updated_at = datetime('now') WHERE token_id = ?`,
      [data.is_for_sale, data.price, data.token_id]
    );
  },

  incrementExecution(tokenId) {
    runSql(
      `UPDATE nfts SET execution_count = execution_count + 1,
              updated_at = datetime('now') WHERE token_id = ?`,
      [tokenId]
    );
  },

  insertExecutionLog(tokenId, executorAddress) {
    runSql(
      "INSERT INTO execution_logs (token_id, executor_address) VALUES (?, ?)",
      [tokenId, executorAddress]
    );
  },

  getExecutionLogs(tokenId) {
    return queryAll(
      "SELECT * FROM execution_logs WHERE token_id = ? ORDER BY executed_at DESC",
      [tokenId]
    );
  },

  insertTransaction(data) {
    runSql(
      `INSERT INTO transactions (token_id, from_address, to_address, price, tx_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [data.token_id, data.from_address, data.to_address, data.price, data.tx_hash]
    );
  },

  getTransactionsByToken(tokenId) {
    return queryAll(
      "SELECT * FROM transactions WHERE token_id = ? ORDER BY created_at DESC",
      [tokenId]
    );
  },

  deleteNFT(tokenId) {
    runSql("DELETE FROM prompts WHERE token_id = ?", [String(tokenId)]);
    runSql("DELETE FROM usage WHERE token_id = ?", [String(tokenId)]);
    runSql("DELETE FROM execution_logs WHERE token_id = ?", [tokenId]);
    runSql("DELETE FROM transactions WHERE token_id = ?", [tokenId]);
    runSql("DELETE FROM nfts WHERE token_id = ?", [tokenId]);
  },

  // lazy mint 구매 후 실제 token_id로 업데이트
  updateTokenIdAfterLazyMint(oldTokenId, newTokenId, newOwner) {
    runSql("UPDATE nfts SET token_id = ?, owner_address = ?, is_minted = 1, is_for_sale = 0, updated_at = datetime('now') WHERE token_id = ?",
      [newTokenId, newOwner, oldTokenId]);
    runSql("UPDATE prompts SET token_id = ? WHERE token_id = ?", [String(newTokenId), String(oldTokenId)]);
    runSql("UPDATE usage SET token_id = ? WHERE token_id = ?", [String(newTokenId), String(oldTokenId)]);
  },

  // DB 전체 테이블 조회 (관리자용)
  getTableList() {
    return queryAll("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  },

  getTableData(tableName) {
    // SQL injection 방지: 테이블 이름 화이트리스트
    const allowed = ['nfts', 'prompts', 'usage', 'nonces', 'execution_logs', 'transactions'];
    if (!allowed.includes(tableName)) return [];
    return queryAll(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 100`);
  },

  getTableCount(tableName) {
    const allowed = ['nfts', 'prompts', 'usage', 'nonces', 'execution_logs', 'transactions'];
    if (!allowed.includes(tableName)) return 0;
    const row = queryOne(`SELECT COUNT(*) as cnt FROM ${tableName}`);
    return row ? row.cnt : 0;
  },
};

// initDB를 반드시 서버 시작 전에 호출해야 함
module.exports = dbWrapper;
module.exports.initDB = initDB;
module.exports.queries = queries;
module.exports.getDB = () => db;
