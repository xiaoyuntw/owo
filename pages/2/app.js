// ==========================================
// 1. 全局資料庫讀取 (localStorage)
// ==========================================
function getStoredProducts() {
  return JSON.parse(localStorage.getItem("products")) || [];
}

function saveStoredProducts(products) {
  localStorage.setItem("products", JSON.stringify(products));
}

// 計算剩餘效期天數 (expDays)
function calculateExpDays(expiryDateStr) {
  if (!expiryDateStr) return 999;
  const today = new Date();
  const expiryDate = new Date(expiryDateStr);
  const diffTime = expiryDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ==========================================
// 2. AI 推薦演算法
// ==========================================
function generateAIRecommendation() {
  const products = getStoredProducts();
  const targetTone = "暖色調"; // 可動態切換

  const scoredProducts = products.map(product => {
    let score = 0;
    const expDays = calculateExpDays(product.expiry);

    if (expDays <= 15) score += 50;
    else if (expDays <= 30) score += 30;

    if (product.tone === targetTone) score += 40;

    return { ...product, aiScore: score, expDays: expDays };
  });

  const categories = ["粉底液", "眼影盤", "口紅"];
  const selectedCombo = [];

  categories.forEach(cat => {
    const categoryProducts = scoredProducts
      .filter(p => p.category === cat)
      .sort((a, b) => b.aiScore - a.aiScore);

    if (categoryProducts.length > 0) {
      selectedCombo.push(categoryProducts[0]);
    }
  });

  return {
    themeName: `AI 推薦：${targetTone}日常妝`,
    items: selectedCombo
  };
}

// ==========================================
// 3. AI 卡片畫面渲染
// ==========================================
function renderComboCard() {
  const recommendation = generateAIRecommendation();
  const cardContainer = document.getElementById("ai-combo-result");
  if (!cardContainer) return;

  if (recommendation.items.length === 0) {
    cardContainer.innerHTML = `
      <div style="background:#1c1c1e; padding:20px; border-radius:16px; text-align:center; color:#8e8e93;">
        📦 目前庫存為空，請先至「庫存管理」分頁新增化妝品！
      </div>`;
    return;
  }

  const neededZones = recommendation.items.map(item => item.zone).join("、");

  let cardHTML = `
    <div style="background: #1c1c1e; border-radius: 20px; padding: 20px; color: #ffffff;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 12px; color: #8e8e93; font-weight: 600;">DAILY LOOK</span>
        <span style="font-size: 11px; color: #8e8e93; background: #2c2c2e; padding: 2px 6px; border-radius: 8px;">AI 智慧選配</span>
      </div>
      <h3 style="margin: 0 0 14px 0; font-size: 18px;">${recommendation.themeName}</h3>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
  `;

  recommendation.items.forEach(item => {
    const isUrgent = item.expDays <= 15 ? `<span style='color: #ff453a; font-size: 11px; margin-left: auto;'>剩 ${item.expDays} 天過期</span>` : "";
    cardHTML += `
      <div style="background: #2c2c2e; padding: 10px 12px; border-radius: 12px; display: flex; align-items: center;">
        <span style="background: #3a3a3c; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 6px; border-radius: 6px; margin-right: 8px;">${item.zone}</span>
        <span style="font-size: 14px;">${item.name}</span>
        ${isUrgent}
      </div>
    `;
  });

  cardHTML += `
      </div>
      <div style="padding: 10px 12px; background: #2c2c2e; border-radius: 12px; font-size: 12px; color: #aeaeb2; display: flex; justify-content: space-between; margin-bottom: 14px;">
        <span>拿取區域</span>
        <span style="color: #ffffff; font-weight: 700;">${neededZones}</span>
      </div>
      <button onclick="applyCombo()" class="btn-main">套用妝容並開始監聽</button>
    </div>
  `;

  cardContainer.innerHTML = cardHTML;
}

function applyCombo() {
  alert("已套用妝容！開始即時監聽 ESP32 微動開關動作...");
}

// ==========================================
// 4. 新增、渲染列表與「點選修改」功能
// ==========================================
const photo = document.getElementById("photo");
const preview = document.getElementById("preview");
const save = document.getElementById("save");

if (photo) {
  photo.addEventListener("change", function() {
    const file = photo.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        preview.src = e.target.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });
}

if (save) {
  save.addEventListener("click", function() {
    const name = document.getElementById("name").value;
    const brand = document.getElementById("brand").value;
    const category = document.getElementById("category").value;
    const tone = document.getElementById("tone").value;
    const zone = document.getElementById("zone").value;
    const expiry = document.getElementById("expiry").value;

    if (!name || !expiry) {
      alert("請填寫產品名稱與保存期限！");
      return;
    }

    const product = {
      id: "p_" + Date.now(),
      name: name,
      brand: brand,
      category: category,
      tone: tone,
      zone: zone,
      expiry: expiry,
      photo: preview.src || ""
    };

    let products = getStoredProducts();
    products.push(product);
    saveStoredProducts(products);

    document.getElementById("name").value = "";
    document.getElementById("brand").value = "";
    preview.style.display = "none";

    showProducts();
    renderComboCard();
    alert("建檔成功！已同步至 AI 系統。");
  });
}

// 顯示庫存清單，並綁定「點擊修改」
function showProducts() {
  const productList = document.getElementById("productList");
  if (!productList) return;
  
  productList.innerHTML = "";
  let products = getStoredProducts();

  products.forEach(function(product, index) {
    const expDays = calculateExpDays(product.expiry);
    const isUrgent = expDays <= 15 ? `<span style="color:#ff453a; font-weight:bold;"> (⚠️ 剩 ${expDays} 天)</span>` : ` (剩 ${expDays} 天)`;

    productList.innerHTML += `
      <div class="product-card" onclick="editProductModal(${index})" style="cursor: pointer; position: relative;">
        ${product.photo ? `<img src="${product.photo}" style="width:100%; max-height:120px; object-fit:cover; border-radius:8px; margin-bottom:8px;">` : ""}
        <div style="display:flex; justify-content:space-between; align-items: center;">
          <strong style="font-size:15px;">${product.name}</strong>
          <span style="background:#3a3a3c; padding:2px 6px; border-radius:6px; font-size:11px;">${product.zone}</span>
        </div>
        <p style="color:#aeaeb2; font-size:12px; margin:6px 0 0 0;">
          品牌: ${product.brand || "未填寫"} | 類別: ${product.category} | 色調: ${product.tone}
        </p>
        <p style="color:#8e8e93; font-size:12px; margin:4px 0 0 0;">
          到期日: ${product.expiry}${isUrgent}
        </p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <span style="font-size:11px; color:#0a84ff;">✏️ 點擊卡片即可修改</span>
          <button class="btn-danger" onclick="event.stopPropagation(); deleteProduct(${index});">刪除</button>
        </div>
      </div>
    `;
  });
}

// 點擊物品欄修改資料（Prompt 快速修改版）
function editProductModal(index) {
  let products = getStoredProducts();
  const p = products[index];

  const newName = prompt("修改【產品名稱】：", p.name);
  if (newName === null) return; // 使用者按取消

  const newBrand = prompt("修改【品牌】：", p.brand || "");
  const newCategory = prompt("修改【類別】(粉底液/眼影盤/口紅)：", p.category);
  const newTone = prompt("修改【色調】(暖色調/冷色調)：", p.tone);
  const newZone = prompt("修改【存放分區】(A區/B區/C區)：", p.zone);
  const newExpiry = prompt("修改【保存期限】(YYYY-MM-DD)：", p.expiry);

  // 更新資料
  p.name = newName || p.name;
  p.brand = newBrand !== null ? newBrand : p.brand;
  p.category = newCategory || p.category;
  p.tone = newTone || p.tone;
  p.zone = newZone || p.zone;
  p.expiry = newExpiry || p.expiry;

  saveStoredProducts(products);
  showProducts();
  renderComboCard(); // 同步更新 AI 推薦結果
  alert("資料已更新並完成同步！");
}

function deleteProduct(index) {
  if (confirm("確定要刪除這項化妝品嗎？")) {
    let products = getStoredProducts();
    products.splice(index, 1);
    saveStoredProducts(products);
    showProducts();
    renderComboCard();
  }
}

// ==========================================
// 5. 過期 Gmail 提醒檢查機制 (展示用與背景模擬)
// ==========================================
async function triggerGmailNotificationCheck() {
  const products = getStoredProducts();
  let notificationQueue = [];

  products.forEach(p => {
    const days = calculateExpDays(p.expiry);
    // 觸發門檻：30天、15天、5天、0天(過期)
    if ([30, 15, 5, 0].includes(days) || days < 0) {
      notificationQueue.push({ name: p.name, daysLeft: days, zone: p.zone });
    }
  });

  if (notificationQueue.length === 0) {
    alert("目前沒有到達提醒門檻（30/15/5/0天）的商品！");
    return;
  }

  // 模擬呼叫 Node.js 後端 API 發送 Gmail 信件
  console.log("正在準備發送 Gmail 信件通知...", notificationQueue);
  
  // 在前端彈窗顯示模擬結果，供發表展示
  let alertText = "📧【過期提醒系統】成功發送 Gmail 到使用者信箱！\n\n通報清單：\n";
  notificationQueue.forEach(item => {
    alertText += `• ${item.name} (${item.zone})：${item.daysLeft <= 0 ? '已過期！' : '剩餘 ' + item.daysLeft + ' 天'}\n`;
  });
  
  alert(alertText);
}

// ==========================================
// 6. 導覽分頁切換邏輯 (SPA)
// ==========================================
function switchTab(tabName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

  if (tabName === 'recommend') {
    document.getElementById('page-recommend').classList.add('active');
    event.currentTarget.classList.add('active');
    renderComboCard();
  } else if (tabName === 'inventory') {
    document.getElementById('page-inventory').classList.add('active');
    event.currentTarget.classList.add('active');
    showProducts();
  }
}

// 網頁啟動初始化
window.onload = function() {
  showProducts();
  renderComboCard();
};
