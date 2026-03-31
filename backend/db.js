// ============================================
// db.js - SQLite 데이터베이스 초기화 및 관리 (sql.js)
// 담당: 장우혁 (백엔드 데이터 + API)
// ============================================

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "promptnft.db");

let db = null;

// DB를 파일로 저장
function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// DB 초기화 (서버 시작 시 1회 호출)
async function initDB() {
  const SQL = await initSqlJs();

  // 기존 파일이 있으면 로드, 없으면 새로 생성
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON;");

  // ============================================
  // 테이블 생성
  // ============================================
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
      max_executions    INTEGER DEFAULT 100,
      is_for_sale       INTEGER DEFAULT 1,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  saveDB();
  console.log("[DB] SQLite 초기화 완료:", DB_PATH);
  return db;
}

// ============================================
// 헬퍼: SELECT → 객체 배열로 변환
// ============================================
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
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

// ============================================
// DB 함수 모음 (prepared statements 대신 함수로 래핑)
// ============================================
const queries = {
  // --- NFT 삽입 (민팅 시) ---
  insertNFT(data) {
    runSql(
      `INSERT INTO nfts (token_id, title, description, prompt_encrypted,
                         creator_address, owner_address, price, category, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.token_id, data.title, data.description, data.prompt_encrypted,
       data.creator_address, data.owner_address, data.price, data.category, data.image_url]
    );
    return { lastInsertRowid: queryOne("SELECT last_insert_rowid() as id").id };
  },

  // --- 전체 NFT 목록 조회 ---
  getAllNFTs() {
    return queryAll(`
      SELECT token_id, title, description, creator_address, owner_address,
             price, royalty_percent, category, image_url,
             execution_count, max_executions, is_for_sale, created_at
      FROM nfts ORDER BY created_at DESC
    `);
  },

  // --- 판매 중인 NFT만 ---
  getForSaleNFTs() {
    return queryAll(`
      SELECT token_id, title, description, creator_address, owner_address,
             price, royalty_percent, category, image_url,
             execution_count, max_executions, is_for_sale, created_at
      FROM nfts WHERE is_for_sale = 1 ORDER BY created_at DESC
    `);
  },

  // --- 내 NFT 조회 ---
  getMyNFTs(ownerAddress) {
    return queryAll(`
      SELECT token_id, title, description, creator_address, owner_address,
             price, royalty_percent, category, image_url,
             execution_count, max_executions, is_for_sale, created_at
      FROM nfts WHERE owner_address = ? ORDER BY created_at DESC
    `, [ownerAddress]);
  },

  // --- 특정 NFT 조회 ---
  getNFTByTokenId(tokenId) {
    return queryOne("SELECT * FROM nfts WHERE token_id = ?", [tokenId]);
  },

  // --- 소유자 변경 ---
  updateOwner(data) {
    runSql(
      `UPDATE nfts SET owner_address = ?, price = ?, is_for_sale = 0,
              updated_at = datetime('now') WHERE token_id = ?`,
      [data.new_owner, data.price, data.token_id]
    );
  },

  // --- 판매 상태 변경 ---
  updateSaleStatus(data) {
    runSql(
      `UPDATE nfts SET is_for_sale = ?, price = ?,
              updated_at = datetime('now') WHERE token_id = ?`,
      [data.is_for_sale, data.price, data.token_id]
    );
  },

  // --- 실행 횟수 증가 ---
  incrementExecution(tokenId) {
    runSql(
      `UPDATE nfts SET execution_count = execution_count + 1,
              updated_at = datetime('now') WHERE token_id = ?`,
      [tokenId]
    );
  },

  // --- 실행 로그 삽입 ---
  insertExecutionLog(tokenId, executorAddress) {
    runSql(
      "INSERT INTO execution_logs (token_id, executor_address) VALUES (?, ?)",
      [tokenId, executorAddress]
    );
  },

  // --- 실행 로그 조회 ---
  getExecutionLogs(tokenId) {
    return queryAll(
      "SELECT * FROM execution_logs WHERE token_id = ? ORDER BY executed_at DESC",
      [tokenId]
    );
  },

  // --- 거래 내역 삽입 ---
  insertTransaction(data) {
    runSql(
      `INSERT INTO transactions (token_id, from_address, to_address, price, tx_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [data.token_id, data.from_address, data.to_address, data.price, data.tx_hash]
    );
  },

  // --- 거래 내역 조회 ---
  getTransactionsByToken(tokenId) {
    return queryAll(
      "SELECT * FROM transactions WHERE token_id = ? ORDER BY created_at DESC",
      [tokenId]
    );
  },
};

module.exports = { initDB, queries, getDB: () => db };
