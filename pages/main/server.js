const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: '*', // 允許所有來源連線，解決 127.0.0.1:5500 跨域問題
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10mb' })); // 支援上傳照片圖片資料

// 記憶體資料庫：儲存用戶與化妝品庫存 (實務上可串接 MongoDB/PostgreSQL)
// 格式: { "user@gmail.com": [ product1, product2 ... ] }
const userDataStore = {};

// ==========================================================================
// 1. Gmail SMTP 郵件寄送器設定
// ==========================================================================
// 請在 .env 檔案中設定 SENDER_EMAIL 與 SENDER_PASSWORD (應用程式密碼)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SENDER_EMAIL || 'your-system-email@gmail.com',
    pass: process.env.SENDER_PASSWORD || 'your-app-password'
  }
});

// 核心發送郵件邏輯
async function sendExpiryEmail(userEmail, expiringProducts) {
  const productRows = expiringProducts.map(p => `
    <tr style="border-bottom: 1px solid #334155;">
      <td style="padding: 10px; color: #ffffff;"><b>${p.brand}</b> ${p.name}</td>
      <td style="padding: 10px; color: #f43f5e; font-weight: bold;">${p.expiry}</td>
      <td style="padding: 10px; color: #94a3b8;">${p.zone || '未指定'}</td>
    </tr>
  `).join('');

  const mailOptions = {
    from: `"MY BEAUTY 智慧管家" <${process.env.SENDER_EMAIL || 'your-system-email@gmail.com'}>`,
    to: userEmail,
    subject: `【MY BEAUTY】您有 ${expiringProducts.length} 件化妝品即將過期提醒！`,
    html: `
      <div style="background-color: #0f172a; padding: 20px; font-family: sans-serif; color: #f8fafc; max-width: 600px; margin: auto; border-radius: 12px;">
        <h2 style="color: #38bdf8; margin-bottom: 10px;">MY BEAUTY 到期提醒</h2>
        <p style="font-size: 14px; color: #cbd5e1;">親愛的會員您好，系統檢測到您有以下化妝品即將在 <b>30 天之內過期</b>，請記得優先使用或進行清理喔！</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; text-align: left;">
          <thead>
            <tr style="background-color: #1e293b; color: #94a3b8;">
              <th style="padding: 10px;">商品名稱</th>
              <th style="padding: 10px;">有效期限</th>
              <th style="padding: 10px;">收納區域</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>

        <p style="font-size: 12px; color: #64748b; margin-top: 20px; text-align: center;">
          此信件由 MY BEAUTY 智慧管理系統自動發送，請勿直接回覆。
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[成功] 已發送過期提醒郵件至：${userEmail}`);
  } catch (error) {
    console.error(`[失敗] 發送郵件至 ${userEmail} 發生錯誤:`, error);
  }
}

// 掃描並檢查所有使用者過期商品的函式
function checkAndNotifyAllUsers() {
  console.log('[排程啟動] 開始掃描化妝品過期狀態...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  Object.keys(userDataStore).forEach(email => {
    const products = userDataStore[email] || [];
    const expiringProducts = products.filter(p => {
      if (!p.expiry || p.status === 'finished') return false;
      const expDate = new Date(p.expiry);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30; // 篩選 30 天內過期
    });

    if (expiringProducts.length > 0) {
      sendExpiryEmail(email, expiringProducts);
    }
  });
}

// ==========================================================================
// 2. 定時任務 (Cron Job)
// 語法: 秒 分 時 日 月 星期 (每天早上 09:00 自動執行)
// ==========================================================================
cron.schedule('0 0 9 * * *', () => {
  checkAndNotifyAllUsers();
});

// ==========================================================================
// 3. API 路由與前端資料同步接口
// ==========================================================================

// 前端同步備份產品資料至後端 API
app.post('/api/sync', (req, res) => {
  const { email, products } = req.body;
  if (!email || !Array.isArray(products)) {
    return res.status(400).json({ success: false, message: '參數不正確' });
  }

  userDataStore[email] = products;
  console.log(`[資料同步] 使用者 ${email} 已更新 ${products.length} 筆商品資料`);
  res.json({ success: true, message: '資料同步完成' });
});

// 手動觸發測試 API (方便開發測試，不必等排程時間)
app.post('/api/test-notify', (req, res) => {
  const { email } = req.body;
  if (!email || !userDataStore[email]) {
    return res.status(400).json({ success: false, message: '未找到該 Email 的商品紀錄，請先進行同步' });
  }

  checkAndNotifyAllUsers();
  res.json({ success: true, message: '測試通知發送程序已觸發' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MY BEAUTY 後端服務已啟動於 http://localhost:${PORT}`);
});
