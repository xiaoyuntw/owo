
const USERS_KEY = 'MY_BEAUTY_USERS_V1';
const BACKEND_URL = 'http://localhost:3000'; // 後端伺服器網址

let appState = {
  currentUser: null,
  users: [],
  products: [],
  collections: ['全部', '日常必備', '底妝精選', '晚間修護'],
  activeTab: 'dashboard',
  selectedCollection: '全部',
  selectedProductId: null,
  tempRating: 5
};

function normalizeProductForAI(product) {
  return {
    ...product,
    category: product.category || '',
    tone: product.tone || '',
    zone: product.zone || ''
  };
}

function loadUsersData() {
  try {
    const rawUsers = localStorage.getItem(USERS_KEY);
    if (rawUsers) appState.users = JSON.parse(rawUsers);

    const logged = localStorage.getItem('CURRENT_LOGGED_USER');
    if (logged) {
      appState.currentUser = JSON.parse(logged);
      loadUserData(appState.currentUser.email);
    } else {
      loadGuestData();
    }
  } catch (e) {
    console.error('Error loading users/data:', e);
    loadGuestData();
  }
}

function loadGuestData() {
  const raw = localStorage.getItem('MY_BEAUTY_DATA_V3');
  if (raw) {
    const parsed = JSON.parse(raw);
    appState.products = (parsed.products || []).map(normalizeProductForAI);
    appState.collections = parsed.collections || ['全部', '日常必備', '底妝精選', '晚間修護'];
  } else {
    seedInitialData();
    saveData();
  }
}

function loadUserData(email) {
  const userKey = `MY_BEAUTY_DATA_${email}`;
  const raw = localStorage.getItem(userKey);
  if (raw) {
    const parsed = JSON.parse(raw);
    appState.products = (parsed.products || []).map(normalizeProductForAI);
    appState.collections = parsed.collections || ['全部', '日常必備', '底妝精選', '晚間修護'];
  } else {
    seedInitialData();
    saveUserData(email);
  }
  syncDataToBackend(); // 自動同步資料給後端發信服務
}

// 自動同步資料給後端 Node.js API
async function syncDataToBackend() {
  if (!appState.currentUser || !appState.currentUser.email) return;
  try {
    await fetch(`${BACKEND_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: appState.currentUser.email,
        products: appState.products
      })
    });
  } catch (e) {
    console.warn('後端伺服器未啟動或無法連線，僅儲存於本地。');
  }
}

// 手動觸發發送測試郵件
async function triggerTestEmailNotify() {
  if (!appState.currentUser) {
    showToast('請先登入帳號');
    openModal('modal-login');
    return;
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/test-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: appState.currentUser.email })
    });
    const data = await res.json();
    showToast(data.message || '測試排程已觸發');
  } catch (e) {
    showToast('無法連線至後端伺服器，請確認 server.js 是否運行中');
  }
}

function saveData() {
  try {
    if (appState.currentUser) {
      saveUserData(appState.currentUser.email);
    } else {
      localStorage.setItem('MY_BEAUTY_DATA_V3', JSON.stringify({
        products: appState.products,
        collections: appState.collections
      }));
    }
    syncDataToBackend(); // 存檔時同步
  } catch (e) {
    console.error('Error saving data:', e);
    showToast('儲存失敗，空間可能不足');
  }
}

function saveUserData(email) {
  const userKey = `MY_BEAUTY_DATA_${email}`;
  localStorage.setItem(userKey, JSON.stringify({
    products: appState.products,
    collections: appState.collections
  }));
}

function saveUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(appState.users));
}

function seedInitialData() {
  appState.products = [
    {
      id: 'p1',
      brand: 'CHANEL',
      name: '香奈兒原生美肌微滴水粉底',
      expiry: '2026-11-15',
      category: '粉底液',
      tone: '暖色調',
      zone: 'A區',
      status: 'using',
      collections: ['底妝精選', '日常必備'],
      notes: '輕薄自然，透亮水潤質感',
      rating: 5,
      review: '非常適合日常清透妝容，多次回購！',
      photo: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'p2',
      brand: 'SHISEIDO',
      name: '小紅瓶紅妍肌活露',
      expiry: '2026-10-01',
      category: '粉底液',
      tone: '暖色調',
      zone: 'B區',
      status: 'using',
      collections: ['日常必備', '晚間修護'],
      notes: '穩定膚況必備精華',
      rating: 4,
      review: '修護效果顯著，敏感肌適用',
      photo: '',
      createdAt: new Date().toISOString()
    }
  ];
}

/* AUTH & GOOGLE LOGIN */
function registerUser(email, password, name) {
  if (appState.users.find(u => u.email === email)) {
    showToast('該 Email 已被註冊！');
    return false;
  }
  const newUser = { id: 'u_' + Date.now(), email, password, name, createdAt: new Date().toISOString() };
  appState.users.push(newUser);
  saveUsers();
  showToast('註冊成功！請直接登入');
  return true;
}

function loginUser(email, password) {
  const u = appState.users.find(item => item.email === email && item.password === password);
  if (!u) {
    showToast('帳號或密碼錯誤');
    return false;
  }
  appState.currentUser = u;
  localStorage.setItem('CURRENT_LOGGED_USER', JSON.stringify(u));
  loadUserData(u.email);
  renderAll();
  showToast(`歡迎回來，${u.name}！`);
  return true;
}

function logoutUser() {
  appState.currentUser = null;
  localStorage.removeItem('CURRENT_LOGGED_USER');
  loadGuestData();
  renderAll();
  showToast('已安全登出');
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch(e) {
    return null;
  }
}

function handleGoogleLoginResponse(response) {
  const payload = parseJwt(response.credential);
  if (!payload) {
    showToast('Google 登入失敗');
    return;
  }

  const googleUser = {
    id: 'g_' + payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    provider: 'google'
  };

  if (!appState.users.find(u => u.email === googleUser.email)) {
    appState.users.push(googleUser);
    saveUsers();
  }

  appState.currentUser = googleUser;
  localStorage.setItem('CURRENT_LOGGED_USER', JSON.stringify(googleUser));
  loadUserData(googleUser.email);
  renderAll();
  closeModal('modal-login');
  showToast(`Google 登入成功：${googleUser.name}`);
}

/* UI NAVIGATION */
function switchTab(tabId) {
  appState.activeTab = tabId;

  document.querySelectorAll('.view-page').forEach(view => view.classList.add('hidden'));
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-white');
    btn.classList.add('text-brand-subtext');
  });
  const activeNavBtn = document.getElementById(`nav-${tabId}`);
  if (activeNavBtn) {
    activeNavBtn.classList.remove('text-brand-subtext');
    activeNavBtn.classList.add('text-white');
  }

  const headerTitle = document.getElementById('header-title');
  const titles = {
    dashboard: '總覽 Dashboard',
    products: '我的商品',
    add: '新增商品',
    recommend: '今日推薦',
    records: '我的紀錄',
    profile: '個人專區'
  };
  if (headerTitle) headerTitle.textContent = titles[tabId] || 'MY BEAUTY';

  renderAll();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.remove('opacity-0', 'translate-y-[-10px]');
  toast.classList.add('opacity-100', 'translate-y-0');
  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
  }, 2500);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeModalOnBg(e, modalId) {
  if (e.target.id === modalId) {
    closeModal(modalId);
  }
}

/* RENDER LOGIC */
function renderAll() {
  renderDashboard();
  renderProductsList();
  renderRecordsAndCollections();
  renderAIRecommendation();
  renderProfileStats();
}

function getDaysToExpiry(expiryDateStr) {
  if (!expiryDateStr) return 9999;
  const today = new Date();
  today.setHours(0,0,0,0);
  const exp = new Date(expiryDateStr);
  const diffTime = exp - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function renderDashboard() {
  const usingItems = appState.products.filter(p => p.status === 'using');
  const recordItems = appState.products.filter(p => p.review || p.rating);
  
  const pendingItems = appState.products.filter(p => {
    const days = getDaysToExpiry(p.expiry);
    return days <= 30 && p.status === 'using';
  });

  const ratedItems = appState.products.filter(p => p.rating && p.rating > 0);
  const avgRating = ratedItems.length > 0 
    ? (ratedItems.reduce((acc, cur) => acc + cur.rating, 0) / ratedItems.length).toFixed(1)
    : '0.0';

  document.getElementById('kpi-using').textContent = usingItems.length;
  document.getElementById('kpi-records').textContent = recordItems.length;
  document.getElementById('kpi-pending').textContent = pendingItems.length;
  document.getElementById('kpi-rating').textContent = avgRating;

  const expiryListEl = document.getElementById('dashboard-expiry-list');
  const countBadge = document.getElementById('expiry-count-badge');
  if (countBadge) countBadge.textContent = `${pendingItems.length} 件`;

  if (pendingItems.length === 0) {
    expiryListEl.innerHTML = `
      <div class="bg-brand-card/50 border border-brand-border/40 rounded-xl p-4 text-center text-xs text-brand-subtext">
        近期無即將過期的商品
      </div>`;
  } else {
    expiryListEl.innerHTML = pendingItems.map(p => {
      const days = getDaysToExpiry(p.expiry);
      const isExpired = days < 0;
      return `
        <div onclick="openProductDetail('${p.id}')" class="bg-brand-card hover:bg-brand-cardHover border border-brand-border/60 rounded-xl p-3 flex justify-between items-center cursor-pointer transition">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg bg-black border border-brand-border overflow-hidden flex items-center justify-center text-xs text-brand-subtext">
              ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : p.brand.substring(0, 2)}
            </div>
            <div>
              <div class="text-xs uppercase text-brand-subtext font-medium">${p.brand}</div>
              <div class="text-sm text-white font-normal">${p.name}</div>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs ${isExpired ? 'text-brand-danger font-semibold' : 'text-brand-warning'}">
              ${isExpired ? '已過期' : `剩餘 ${days} 天`}
            </span>
            <div class="text-[10px] text-brand-subtext font-mono">${p.expiry}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  const recentListEl = document.getElementById('dashboard-recent-list');
  const recentItems = [...appState.products].reverse().slice(0, 3);
  if (recentItems.length === 0) {
    recentListEl.innerHTML = `
      <div class="bg-brand-card/50 border border-brand-border/40 rounded-xl p-4 text-center text-xs text-brand-subtext">
        尚無加入任何品項
      </div>`;
  } else {
    recentListEl.innerHTML = recentItems.map(p => `
      <div onclick="openProductDetail('${p.id}')" class="bg-brand-card hover:bg-brand-cardHover border border-brand-border/60 rounded-xl p-3 flex justify-between items-center cursor-pointer transition">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-lg bg-black border border-brand-border overflow-hidden flex items-center justify-center text-xs text-brand-subtext">
            ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : p.brand.substring(0, 2)}
          </div>
          <div>
            <div class="text-xs uppercase text-brand-subtext font-medium">${p.brand}</div>
            <div class="text-sm text-white font-normal">${p.name}</div>
          </div>
        </div>
        <span class="text-xs text-brand-subtext">${p.status === 'using' ? '使用中' : '已完用'}</span>
      </div>
    `).join('');
  }
}

function renderProductsList() {
  const container = document.getElementById('products-list');
  const searchInput = document.getElementById('product-search');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = appState.products;
  if (query) {
    filtered = filtered.filter(p => 
      p.brand.toLowerCase().includes(query) || 
      p.name.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-brand-card border border-brand-border/40 rounded-2xl p-8 text-center text-brand-subtext text-xs space-y-2">
        <div>查無符合條件的商品</div>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const days = getDaysToExpiry(p.expiry);
    const isExpired = days < 0;
    const isNear = days <= 30 && days >= 0;

    return `
      <div onclick="openProductDetail('${p.id}')" class="bg-brand-card border border-brand-border/60 hover:border-white/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition">
        <div class="flex items-center space-x-3.5">
          <div class="w-12 h-12 rounded-xl bg-black border border-brand-border overflow-hidden flex items-center justify-center text-xs text-brand-subtext shrink-0">
            ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : p.brand.substring(0,2)}
          </div>
          <div class="space-y-0.5">
            <div class="text-xs uppercase font-medium text-brand-subtext">${p.brand}</div>
            <div class="text-sm text-white font-normal line-clamp-1">${p.name}</div>
            <div class="text-[11px] font-mono text-brand-subtext">效期: ${p.expiry}</div>
          </div>
        </div>
        <div class="text-right flex flex-col items-end shrink-0 space-y-1">
          <span class="px-2 py-0.5 rounded-full text-[10px] border ${
            p.status === 'finished' 
              ? 'border-brand-border text-brand-subtext' 
              : isExpired 
              ? 'border-brand-danger/40 text-brand-danger' 
              : isNear 
              ? 'border-brand-warning/40 text-brand-warning' 
              : 'border-white/20 text-white'
          }">
            ${p.status === 'finished' ? '已完用' : isExpired ? '已過期' : isNear ? `剩 ${days} 天` : '使用中'}
          </span>
          ${p.rating ? `<span class="text-xs text-white">★ ${p.rating}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderRecordsAndCollections() {
  const tabBar = document.getElementById('collections-tab-bar');
  if (tabBar) {
    tabBar.innerHTML = appState.collections.map(col => `
      <button onclick="setCollectionFilter('${col}')" 
        class="px-3.5 py-1.5 rounded-full text-xs transition whitespace-nowrap ${
          appState.selectedCollection === col
            ? 'bg-white text-black font-medium'
            : 'bg-brand-card text-brand-subtext border border-brand-border/60 hover:text-white'
        }">
        ${col}
      </button>
    `).join('');
  }

  let list = appState.products;
  if (appState.selectedCollection !== '全部') {
    list = list.filter(p => p.collections && p.collections.includes(appState.selectedCollection));
  }

  const recordsList = document.getElementById('records-list');
  if (recordsList) {
    if (list.length === 0) {
      recordsList.innerHTML = `
        <div class="bg-brand-card border border-brand-border/40 rounded-2xl p-8 text-center text-brand-subtext text-xs">
          此分類下暫無商品紀錄
        </div>`;
      return;
    }

    recordsList.innerHTML = list.map(p => `
      <div class="bg-brand-card border border-brand-border/60 rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg bg-black border border-brand-border overflow-hidden flex items-center justify-center text-xs text-brand-subtext">
              ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : p.brand.substring(0, 2)}
            </div>
            <div>
              <div class="text-xs uppercase font-medium text-brand-subtext">${p.brand}</div>
              <div class="text-sm text-white font-normal">${p.name}</div>
            </div>
          </div>
          <button onclick="openReviewModal('${p.id}')" class="px-2.5 py-1 rounded-lg border border-brand-border text-xs text-white hover:bg-white/10 transition">
            ${p.rating ? '修改心得' : '新增心得'}
          </button>
        </div>

        ${p.rating || p.review ? `
          <div class="bg-black/40 border border-brand-border/40 p-3 rounded-xl space-y-1">
            <div class="flex items-center space-x-1 text-white text-xs">
              <span>${'★'.repeat(p.rating || 0)}</span>
              <span class="text-brand-subtext">(${p.rating || 0}/5)</span>
            </div>
            <p class="text-xs text-brand-subtext leading-relaxed">${p.review || '暫無詳細心得說明'}</p>
          </div>
        ` : `
          <div class="text-[11px] text-brand-subtext italic">尚無評分心得</div>
        `}
      </div>
    `).join('');
  }
}

function setCollectionFilter(col) {
  appState.selectedCollection = col;
  renderRecordsAndCollections();
}

function getRecommendationCategory(product) {
  if (product.category) return product.category;
  const text = `${product.name || ''} ${product.notes || ''}`.toLowerCase();
  if (/口紅|唇膏|唇釉|唇彩|lipstick|lip tint|lip gloss/i.test(text)) return '口紅';
  if (/眼影|眼彩|彩妝盤|eyeshadow|palette/i.test(text)) return '眼影盤';
  if (/粉底|底妝|foundation|粉餅|氣墊|cushion/i.test(text)) return '粉底液';
  return '其他';
}

function getRecommendationTone(product) {
  return product.tone || '暖色調';
}

function getRecommendationZone(product) {
  return product.zone || '未設定';
}

function generateAIRecommendation() {
  const products = appState.products || [];
  const targetTone = '暖色調';

  const scoredProducts = products.map(product => {
    let score = 0;
    const expDays = getDaysToExpiry(product.expiry);

    if (expDays < 0) score += 60;
    else if (expDays <= 15) score += 50;
    else if (expDays <= 30) score += 30;

    if (getRecommendationTone(product) === targetTone) score += 40;
    if (product.status === 'finished') score -= 100;

    return {
      ...product,
      recommendationCategory: getRecommendationCategory(product),
      recommendationZone: getRecommendationZone(product),
      aiScore: score,
      expDays: expDays
    };
  });

  const categories = ['粉底液', '眼影盤', '口紅'];
  const selectedCombo = [];
  const selectedIds = new Set();

  categories.forEach(category => {
    const candidates = scoredProducts
      .filter(p => p.recommendationCategory === category && !selectedIds.has(p.id))
      .sort((a, b) => b.aiScore - a.aiScore);

    if (candidates.length > 0) {
      selectedCombo.push(candidates[0]);
      selectedIds.add(candidates[0].id);
    }
  });

  if (selectedCombo.length === 0) {
    scoredProducts
      .filter(p => p.recommendationCategory === '其他' && !selectedIds.has(p.id))
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 3)
      .forEach(p => {
        selectedCombo.push(p);
        selectedIds.add(p.id);
      });
  }

  return {
    themeName: `AI 推薦：${targetTone}日常妝`,
    items: selectedCombo
  };
}

function renderAIRecommendation() {
  const container = document.getElementById('ai-combo-result');
  if (!container) return;

  const recommendation = generateAIRecommendation();

  if (recommendation.items.length === 0) {
    container.innerHTML = `
      <div class="bg-brand-card border border-brand-border/60 rounded-2xl p-6 text-center">
        <div class="text-3xl mb-3">📦</div>
        <div class="text-sm text-white mb-1">目前沒有可推薦的商品</div>
        <div class="text-xs text-brand-subtext leading-relaxed">
          請先到「新增」建立化妝品，AI 就會依照你的庫存產生今日妝容。
        </div>
        <button onclick="switchTab('add')" class="mt-4 px-4 py-2.5 rounded-xl bg-white text-black text-xs font-medium">
          新增化妝品
        </button>
      </div>`;
    return;
  }

  const neededZones = [...new Set(
    recommendation.items.map(item => item.recommendationZone)
  )].join('、');

  const itemRows = recommendation.items.map(item => {
    const expiryText = item.expDays < 0
      ? `<span class="text-brand-danger text-[11px] ml-auto">已過期</span>`
      : item.expDays <= 15
        ? `<span class="text-brand-danger text-[11px] ml-auto">剩 ${item.expDays} 天</span>`
        : '';

    return `
      <div onclick="openProductDetail('${item.id}')" class="bg-[#2c2c2e] p-3 rounded-xl flex items-center cursor-pointer hover:bg-brand-cardHover transition">
        <div class="w-10 h-10 rounded-lg bg-black border border-brand-border overflow-hidden flex items-center justify-center shrink-0 mr-3">
          ${item.photo
            ? `<img src="${item.photo}" class="w-full h-full object-cover">`
            : `<span class="text-[10px] text-brand-subtext">${(item.brand || 'MB').substring(0,2)}</span>`}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center">
            <span class="bg-[#3a3a3c] text-white text-[10px] font-semibold px-1.5 py-1 rounded-md mr-2">${item.recommendationZone}</span>
            <span class="text-sm text-white truncate">${item.name}</span>
          </div>
          <div class="text-[10px] text-brand-subtext mt-1">
            ${item.recommendationCategory} · ${getRecommendationTone(item)}
          </div>
        </div>
        ${expiryText}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="bg-brand-card border border-brand-border/60 rounded-2xl p-5 shadow-xl">
      <div class="flex justify-between items-center mb-2">
        <span class="text-[11px] text-brand-subtext font-semibold tracking-widest">DAILY LOOK</span>
        <span class="text-[10px] text-brand-subtext bg-[#2c2c2e] px-2 py-1 rounded-lg">AI 智慧選配</span>
      </div>

      <h2 class="text-lg font-medium text-white mb-4">${recommendation.themeName}</h2>

      <div class="space-y-2.5">
        ${itemRows}
      </div>

      <div class="mt-4 p-3 bg-[#2c2c2e] rounded-xl flex justify-between items-center">
        <span class="text-xs text-brand-subtext">拿取區域</span>
        <span class="text-xs text-white font-semibold">${neededZones}</span>
      </div>

      <button onclick="applyCombo()" class="w-full mt-3 py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-brand-accentHover transition">
        套用妝容並開始監聽
      </button>
    </div>`;
}

function applyCombo() {
  const recommendation = generateAIRecommendation();
  const names = recommendation.items.map(item => item.name).join('、');
  showToast(names ? `已套用今日妝容：${names}` : '目前沒有可套用的妝容');
}

function renderProfileStats() {
  const elCount = document.getElementById('profile-total-count');
  if (elCount) elCount.textContent = `${appState.products.length} 項`;

  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const authBtn = document.getElementById('profile-auth-btn');
  const avatarEl = document.getElementById('profile-avatar');

  if (appState.currentUser) {
    if (usernameEl) usernameEl.textContent = appState.currentUser.name;
    if (emailEl) emailEl.textContent = appState.currentUser.email;
    if (authBtn) {
      authBtn.textContent = '登出帳號';
      authBtn.onclick = logoutUser;
    }
    if (avatarEl && appState.currentUser.picture) {
      avatarEl.innerHTML = `<img src="${appState.currentUser.picture}" class="w-full h-full object-cover">`;
    } else if (avatarEl) {
      avatarEl.textContent = (appState.currentUser.name || 'MB').substring(0, 2).toUpperCase();
    }
  } else {
    if (usernameEl) usernameEl.textContent = '美妝愛好者';
    if (emailEl) emailEl.textContent = '尚未登入';
    if (authBtn) {
      authBtn.textContent = '登入 / 註冊';
      authBtn.onclick = () => openModal('modal-login');
    }
    if (avatarEl) avatarEl.textContent = 'MB';
  }
}

function openProductDetail(id) {
  const p = appState.products.find(item => item.id === id);
  if (!p) return;

  appState.selectedProductId = id;

  document.getElementById('detail-brand').textContent = p.brand;
  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-expiry').textContent = p.expiry;
  document.getElementById('detail-status').textContent = p.status === 'using' ? '使用中' : '已完用';
  document.getElementById('detail-collections').textContent = (p.collections && p.collections.length) ? p.collections.join(', ') : '無';
  document.getElementById('detail-notes').textContent = p.notes || '無備註';

  const imgEl = document.getElementById('detail-img');
  const imgContainer = document.getElementById('detail-img-container');
  if (p.photo) {
    imgEl.src = p.photo;
    imgContainer.classList.remove('hidden');
  } else {
    imgContainer.classList.add('hidden');
  }

  const finishBtn = document.getElementById('btn-toggle-finish');
  finishBtn.textContent = p.status === 'using' ? '標示為完用' : '恢復為使用中';

  openModal('modal-detail');
}

/* BINDINGS */
document.addEventListener('DOMContentLoaded', () => {
  loadUsersData();
  renderAll();

  document.getElementById('quick-add-btn').addEventListener('click', () => switchTab('add'));
  document.getElementById('product-search').addEventListener('input', () => renderProductsList());

  const photoInput = document.getElementById('input-photo');
  const photoPreview = document.getElementById('photo-preview');
  const photoPlaceholder = document.getElementById('photo-placeholder');
  let currentBase64Image = '';

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
        canvas.height = (img.width > MAX_WIDTH) ? img.height * scaleSize : img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        currentBase64Image = canvas.toDataURL('image/jpeg', 0.7);
        photoPreview.src = currentBase64Image;
        photoPreview.classList.remove('hidden');
        photoPlaceholder.classList.add('hidden');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('add-product-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const brand = document.getElementById('input-brand').value.trim();
    const name = document.getElementById('input-name').value.trim();
    const expiry = document.getElementById('input-expiry').value;
    const category = document.getElementById('input-category').value;
    const tone = document.getElementById('input-tone').value;
    const zone = document.getElementById('input-zone').value;
    const notes = document.getElementById('input-notes').value.trim();

    if (!brand || !name || !expiry) {
      showToast('請填寫所有必填欄位');
      return;
    }

    const newProduct = {
      id: 'p_' + Date.now(),
      brand: brand,
      name: name,
      expiry: expiry,
      category: category,
      tone: tone,
      zone: zone,
      status: 'using',
      collections: ['全部'],
      notes: notes,
      rating: 0,
      review: '',
      photo: currentBase64Image,
      createdAt: new Date().toISOString()
    };

    appState.products.unshift(newProduct);
    saveData();

    e.target.reset();
    currentBase64Image = '';
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');

    showToast('商品已成功加入');
    switchTab('products');
  });

  document.getElementById('btn-submit-login').addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-password').value.trim();
    if (loginUser(email, pwd)) closeModal('modal-login');
  });

  document.getElementById('btn-submit-register').addEventListener('click', () => {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pwd = document.getElementById('reg-password').value.trim();
    if (name && email && pwd) {
      if (registerUser(email, pwd, name)) {
        closeModal('modal-register');
        openModal('modal-login');
      }
    } else {
      showToast('請完整填寫所有欄位');
    }
  });

  document.getElementById('btn-toggle-finish').addEventListener('click', () => {
    if (!appState.selectedProductId) return;
    const p = appState.products.find(item => item.id === appState.selectedProductId);
    if (p) {
      p.status = p.status === 'using' ? 'finished' : 'using';
      saveData();
      renderAll();
      closeModal('modal-detail');
      showToast(`已標示為 ${p.status === 'using' ? '使用中' : '已完用'}`);
    }
  });

  document.getElementById('btn-delete-product').addEventListener('click', () => {
    if (!appState.selectedProductId) return;
    appState.products = appState.products.filter(item => item.id !== appState.selectedProductId);
    saveData();
    renderAll();
    closeModal('modal-detail');
    showToast('商品已刪除');
  });

  document.getElementById('btn-open-review').addEventListener('click', () => {
    closeModal('modal-detail');
    openReviewModal(appState.selectedProductId);
  });

  const starBtns = document.querySelectorAll('.star-btn');
  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const ratingVal = parseInt(btn.getAttribute('data-star'));
      appState.tempRating = ratingVal;
      updateStarUI(ratingVal);
    });
  });

  document.getElementById('btn-save-review').addEventListener('click', () => {
    if (!appState.selectedProductId) return;
    const p = appState.products.find(item => item.id === appState.selectedProductId);
    if (p) {
      p.rating = appState.tempRating;
      p.review = document.getElementById('input-review-text').value.trim();
      saveData();
      renderAll();
      closeModal('modal-review');
      showToast('已更新心得與評分');
    }
  });

  document.getElementById('manage-collections-btn').addEventListener('click', () => {
    renderCollectionsManager();
    openModal('modal-collections');
  });

  document.getElementById('btn-add-collection').addEventListener('click', () => {
    const input = document.getElementById('input-new-collection');
    const val = input.value.trim();
    if (val && !appState.collections.includes(val)) {
      appState.collections.push(val);
      saveData();
      input.value = '';
      renderCollectionsManager();
      renderRecordsAndCollections();
      showToast('已新增分類');
    }
  });
});

function updateStarUI(ratingVal) {
  const starBtns = document.querySelectorAll('.star-btn');
  starBtns.forEach(btn => {
    const val = parseInt(btn.getAttribute('data-star'));
    if (val <= ratingVal) {
      btn.classList.remove('text-brand-border');
      btn.classList.add('text-white');
    } else {
      btn.classList.remove('text-white');
      btn.classList.add('text-brand-border');
    }
  });
}

function openReviewModal(productId) {
  appState.selectedProductId = productId;
  const p = appState.products.find(item => item.id === productId);
  if (!p) return;

  const currentRating = p.rating || 5;
  appState.tempRating = currentRating;
  updateStarUI(currentRating);

  document.getElementById('input-review-text').value = p.review || '';
  openModal('modal-review');
}

function renderCollectionsManager() {
  const container = document.getElementById('collections-manage-list');
  if (!container) return;

  container.innerHTML = appState.collections.filter(c => c !== '全部').map(col => `
    <div class="flex items-center justify-between p-3 rounded-xl bg-brand-card border border-brand-border/60">
      <span class="text-sm text-white font-medium">${col}</span>
      <button onclick="deleteCollection('${col}')" class="text-xs text-brand-danger hover:underline">刪除</button>
    </div>
  `).join('');
}

function deleteCollection(colName) {
  appState.collections = appState.collections.filter(c => c !== colName);
  if (appState.selectedCollection === colName) appState.selectedCollection = '全部';
  saveData();
  renderCollectionsManager();
  renderRecordsAndCollections();
  showToast('已移除分類');
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `MY_BEAUTY_BACKUP_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('備份檔已匯出');
}

function resetSystemData() {
  if (confirm('確定要清空所有化妝品資料與記錄嗎？此動作無法復原。')) {
    seedInitialData();
    saveData();
    renderAll();
    showToast('已重置所有資料');
  }
}