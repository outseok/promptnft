// middleware/admin.js - 관리자 권한 검증
// 담당: 최유리 (보안)

const logger = require("../utils/logger");

// 관리자 지갑 주소 목록 (소문자로 저장)
const ADMIN_ADDRESSES = [
  "0x0ceb7a69b9b1894a335ee0539b48a6d9a6420c5c",
];

function isAdmin(walletAddress) {
  if (!walletAddress) return false;
  return ADMIN_ADDRESSES.includes(walletAddress.toLowerCase());
}

// 관리자 전용 미들웨어
function requireAdmin(req, res, next) {
  const wallet = req.headers["x-wallet-address"];
  if (!wallet || !isAdmin(wallet)) {
    logger.warn(`관리자 권한 거부 — wallet=${wallet?.slice(0, 10) || "없음"}`);
    return res.status(403).json({ success: false, error: "관리자 권한이 필요합니다" });
  }
  req.adminWallet = wallet.toLowerCase();
  next();
}

module.exports = { isAdmin, requireAdmin, ADMIN_ADDRESSES };
