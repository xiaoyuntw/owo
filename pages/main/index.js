
/* ==========================================================================
    DATA ARCHITECTURE & LOCAL STORAGE MANAGEMENT
    Key: 'MY_BEAUTY_DATA_V3'
    ========================================================================== */
const STORAGE_KEY = 'MY_BEAUTY_DATA_V3';
const USERS_KEY = 'MY_BEAUTY_USERS_V1';
// Default State Structure
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

// 舊版本資料補上 AI 推薦需要的欄位
function normalizeProductForAI(product) {
    return {
    ...product,
    category: product.category || '',
    tone: product.tone || '',
    zone: product.zone || ''
    };
}

// Load Data & Migration Logic
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            appState.products = (parsed.products || []).map(normalizeProductForAI);
            appState.collections = parsed.collections || ['全部', '日常必備', '底妝精選', '晚間修護'];
        } else {
            // Backward Compatibility Check for V1/V2 Keys if existing
            const oldV2 = localStorage.getItem('MY_BEAUTY_DATA_V2');
            if (oldV2) {
            const parsedOld = JSON.parse(oldV2);
            appState.products = (parsedOld.products || []).map(normalizeProductForAI);
            } else {
            // Seed Demo Data if empty
            seedInitialData();
            }
            saveData();
        }
    } catch (e) {
        console.error('Error loading data:', e);
        seedInitialData();
    }
}

function saveData() {
    try {
    const payload = {
        products: appState.products,
        collections: appState.collections
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
    } catch (e) {
    console.error('Error saving data:', e);
    showToast('儲存空間不足！請移除部分照片或先匯出備份');
    return false;
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

/* ==========================================================================
    UI CONTROLLERS & NAVIGATION
    ========================================================================== */
function switchTab(tabId) {
    appState.activeTab = tabId;

    // Toggle views
    document.querySelectorAll('.view-page').forEach(view => view.classList.add('hidden'));
    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');

    // Update Nav Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-white');
    btn.classList.add('text-brand-subtext');
    });
    const activeNavBtn = document.getElementById(`nav-${tabId}`);
    if (activeNavBtn) {
    activeNavBtn.classList.remove('text-brand-subtext');
    activeNavBtn.classList.add('text-white');
    }

    // Update Header Title
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

    // Refresh specific tab contents
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

/* ==========================================================================
    RENDER FUNCTIONS
    ========================================================================== */
function renderAll() {
    renderDashboard();
    renderBadges();
    renderProductsList();
    renderRecordsAndCollections();
    renderAIRecommendation();
    renderProfileStats();
}

// Days until expiry calculation
function getDaysToExpiry(expiryDateStr) {
    if (!expiryDateStr) return 9999;
    const today = new Date();
    today.setHours(0,0,0,0);
    const exp = new Date(expiryDateStr);
    const diffTime = exp - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 成就徽章統計
function getBadgeStats() {
    const products = appState.products || [];
    const total = products.length;
    const countCategory = (category) => products.filter(p => getRecommendationCategory(p) === category).length;
    const reviewed = products.filter(p => Number(p.rating) > 0 && String(p.review || '').trim()).length;
    const finished = products.filter(p => p.status === 'finished').length;
    const collections = (appState.collections || []).filter(c => c !== '全部').length;
    return {
    total,
    blush: products.filter(p => getRecommendationCategory(p) === '腮紅' || /腮紅|頰彩|blush/i.test(`${p.name || ''} ${p.notes || ''}`)).length,
    lipstick: countCategory('口紅'),
    eyeshadow: countCategory('眼影盤'),
    foundation: countCategory('粉底液'),
    reviewed,
    finished,
    collections
    };
}

function renderBadges() {
    const el = document.getElementById('dashboard-badges');
    const countEl = document.getElementById('badge-count');
    if (!el) return;
    const s = getBadgeStats();
    const badges = [
    { icon: '✦', name: '初入美妝', desc: '收藏第 1 件商品', value: s.total, target: 1, tone: 'from-[#f0d5c5] to-[#a87560]' },
    { icon: '◈', name: '底妝研究員', desc: '收藏 5 件底妝', value: s.foundation, target: 5, tone: 'from-[#e8d8bd] to-[#ad8c62]' },
    { icon: '♡', name: '唇彩控', desc: '收藏 5 件口紅', value: s.lipstick, target: 5, tone: 'from-[#efb6bd] to-[#a64c65]' },
    { icon: '✿', name: '腮紅收藏家', desc: '收藏 5 件腮紅', value: s.blush, target: 5, tone: 'from-[#f4c6d2] to-[#b56b83]' },
    { icon: '✧', name: '眼妝玩家', desc: '收藏 5 盤眼影', value: s.eyeshadow, target: 5, tone: 'from-[#d8c9f3] to-[#8870b5]' },
    { icon: '✎', name: '心得編輯', desc: '完成 5 筆評分與心得', value: s.reviewed, target: 5, tone: 'from-[#c7d9d1] to-[#6b9282]' },
    { icon: '⌂', name: '整理達人', desc: '建立 3 個自訂分類', value: s.collections, target: 3, tone: 'from-[#c6d7e8] to-[#6687aa]' },
    { icon: '♛', name: '美妝典藏家', desc: '收藏總數達 30 件', value: s.total, target: 30, tone: 'from-[#f1df9d] to-[#a98232]' }
    ];
    const unlocked = badges.filter(b => b.value >= b.target).length;
    if (countEl) countEl.textContent = `${unlocked} / ${badges.length} 解鎖`;

    el.innerHTML = badges.map(b => {
    const isUnlocked = b.value >= b.target;
    const progress = Math.min(100, Math.round((b.value / b.target) * 100));
    return `
        <div class="group relative overflow-hidden rounded-2xl border ${isUnlocked ? 'border-[#9c7866]/60 bg-[#211a19]' : 'border-white/[0.07] bg-black/25'} p-3 transition duration-300 hover:-translate-y-0.5">
        ${isUnlocked ? '<div class="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-[#d8b8a5]/10 blur-xl"></div>' : ''}
        <div class="relative flex items-start justify-between gap-2">
            <div class="flex h-11 w-11 items-center justify-center rounded-full border ${isUnlocked ? 'border-[#e6c8b7]/70 bg-gradient-to-br ' + b.tone + ' text-[#201614] shadow-lg shadow-black/20' : 'border-white/10 bg-white/[0.03] text-white/30'} text-xl font-light">${isUnlocked ? b.icon : '◇'}</div>
            <span class="text-[9px] ${isUnlocked ? 'text-[#e6c8b7]' : 'text-brand-subtext'}">${isUnlocked ? 'UNLOCKED' : `${Math.min(b.value,b.target)}/${b.target}`}</span>
        </div>
        <div class="relative mt-3 text-xs font-medium ${isUnlocked ? 'text-white' : 'text-white/70'}">${b.name}</div>
        <div class="relative mt-1 min-h-[28px] text-[10px] leading-relaxed text-brand-subtext">${b.desc}</div>
        <div class="relative mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div class="h-full rounded-full ${isUnlocked ? 'bg-gradient-to-r from-[#d8b8a5] to-[#f0dfd5]' : 'bg-white/25'} transition-all" style="width:${progress}%"></div>
        </div>
        </div>`;
    }).join('');
}

// 1. DASHBOARD RENDERER
function renderDashboard() {
    const usingItems = appState.products.filter(p => p.status === 'using' && getDaysToExpiry(p.expiry) >= 0);
    const recordItems = appState.products.filter(p => p.review || p.rating);
    
    // Expiry within 30 days
    const pendingItems = appState.products.filter(p => {
    const days = getDaysToExpiry(p.expiry);
    return days <= 30 && p.status === 'using';
    });

    // 即將過期數量：沿用原本「30 天內到期」的判定
    const expiringCount = pendingItems.length;

    // Update KPI Elements
    document.getElementById('kpi-using').textContent = usingItems.length;
    document.getElementById('kpi-records').textContent = recordItems.length;
    document.getElementById('kpi-pending').textContent = pendingItems.length;
    const savedSkin = getSavedSkinCheck();
    document.getElementById('kpi-skin').textContent = savedSkin ? savedSkin.label : '未檢測';

    // Expiry List Render
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

    // Render Tab Chips
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

    // Filter products by active collection tab
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

// 商品清單：搜尋同時套用正在使用與已封存兩區
function renderProductsList() {
    const usingContainer = document.getElementById('products-list');
    const archiveContainer = document.getElementById('archived-products-list');
    if (!usingContainer || !archiveContainer) return;

    const searchEl = document.getElementById('product-search');
    const keyword = (searchEl ? searchEl.value : '').trim().toLocaleLowerCase();
    const all = (appState.products || []).filter(p => {
    const searchable = [
        p.brand, p.name, p.category, p.tone, p.zone, p.notes, p.review,
        ...(Array.isArray(p.collections) ? p.collections : [])
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(keyword);
    });

    // 到期商品自動歸入封存區；使用中區只顯示效期尚未到期的商品
    const usingItems = all.filter(p => p.status !== 'finished' && getDaysToExpiry(p.expiry) >= 0);
    const archivedItems = all.filter(p => p.status === 'finished' || getDaysToExpiry(p.expiry) < 0);

    document.getElementById('using-count').textContent = `${usingItems.length} 件`;
    document.getElementById('archive-count').textContent = `${archivedItems.length} 件`;

    function emptyState(keyword, archived) {
    const title = keyword ? '找不到符合的商品' : (archived ? '封存區目前是空的' : '還沒有正在使用的商品');
    const desc = keyword ? '試試品牌、品名、類別或備註中的其他關鍵字。' :
        (archived ? '已完用或過期的商品會整理在這裡。' : '把喜歡的美妝品收進你的數位衣櫥吧。');
    return `<div class="rounded-2xl border border-brand-border/60 bg-brand-card/50 p-6 text-center">
        <div class="mb-2 text-2xl text-[#cda68e]">${archived ? '♡' : '✦'}</div>
        <div class="text-sm text-white">${title}</div>
        <p class="mt-2 text-xs text-brand-subtext">${desc}</p>
        ${keyword ? '<button onclick="document.getElementById(&quot;product-search&quot;).value=&quot;&quot;;renderProductsList()" class="mt-3 text-xs text-[#d8b8a5]">清除搜尋</button>' : (!archived ? '<button onclick="switchTab(&quot;add&quot;)" class="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-medium text-black">新增商品</button>' : '')}
    </div>`;
    }

    function productCard(p, archived) {
    const days = getDaysToExpiry(p.expiry);
    const expired = days < 0;
    const soon = days >= 0 && days <= 30;
    const photo = p.photo
        ? `<img src="${p.photo}" alt="${p.name || '商品照片'}" loading="lazy" class="h-full w-full object-cover">`
        : `<span class="text-xs tracking-wider text-[#d8b8a5]">${String(p.brand || 'MB').slice(0, 2)}</span>`;
    const statusText = expired ? '已過期' : p.status === 'finished' ? '已完用' : '使用中';
    return `
        <article onclick="openProductDetail('${p.id}')" class="flex items-center gap-3 rounded-2xl border ${archived ? 'border-[#8d6a5b]/40 bg-[#191615]' : 'border-brand-border/70 bg-brand-card'} p-3.5 cursor-pointer transition hover:border-[#8d6a5b]/70 hover:bg-brand-cardHover">
        <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-border bg-black flex items-center justify-center">${photo}</div>
        <div class="min-w-0 flex-1">
            <div class="text-[10px] uppercase tracking-[0.16em] text-[#cda68e]">${p.brand || '未填品牌'}</div>
            <div class="mt-1 truncate text-sm font-medium text-white">${p.name || '未命名商品'}</div>
            <div class="mt-1 text-[10px] text-brand-subtext">${p.category || '未分類'} · ${p.tone || '未設定色調'} · ${statusText}</div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
            ${p.rating ? `<span class="text-[10px] text-[#e6c8b7]">${'★'.repeat(Math.min(5, Number(p.rating) || 0))}</span>` : ''}
            <span class="text-[10px] ${expired ? 'text-brand-danger' : soon ? 'text-[#e6c8b7]' : 'text-brand-subtext'}">${expired ? '已過期' : `效期 ${p.expiry || '未設定'}`}</span>
            </div>
        </div>
        <span class="text-brand-subtext text-lg">›</span>
        </article>`;
    }

    usingContainer.innerHTML = usingItems.length
    ? usingItems.map(p => productCard(p, false)).join('')
    : emptyState(keyword, false);
    archiveContainer.innerHTML = archivedItems.length
    ? archivedItems.map(p => productCard(p, true)).join('')
    : emptyState(keyword, true);
}

// 分類／心得頁面共用重新整理入口
function renderRecordsAndCollections() {
    const tabBar = document.getElementById('collections-tab-bar');
    if (tabBar) {
    tabBar.innerHTML = (appState.collections || []).map(col => `
        <button onclick="setCollectionFilter('${col}')"
        class="px-3.5 py-1.5 rounded-full text-xs transition whitespace-nowrap ${
            appState.selectedCollection === col
            ? 'bg-white text-black font-medium'
            : 'bg-brand-card text-brand-subtext border border-brand-border/60 hover:text-white'
        }">${col}</button>
    `).join('');
    }

    let list = appState.products || [];
    if (appState.selectedCollection !== '全部') {
    list = list.filter(p => Array.isArray(p.collections) && p.collections.includes(appState.selectedCollection));
    }

    const recordsList = document.getElementById('records-list');
    if (!recordsList) return;
    if (!list.length) {
    recordsList.innerHTML = `<div class="rounded-2xl border border-brand-border/40 bg-brand-card p-8 text-center text-xs text-brand-subtext">這個分類還沒有商品，新增商品後就能在這裡整理心得。</div>`;
    return;
    }
    recordsList.innerHTML = list.map(p => `
    <div class="rounded-2xl border border-brand-border/60 bg-brand-card p-4 space-y-3">
        <div class="flex items-center gap-3">
        <div class="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-brand-border bg-black flex items-center justify-center">
            ${p.photo ? `<img src="${p.photo}" alt="${p.name}" loading="lazy" class="h-full w-full object-cover">` : `<span class="text-xs text-[#d8b8a5]">${String(p.brand || 'MB').slice(0,2)}</span>`}
        </div>
        <div class="min-w-0 flex-1">
            <div class="text-[10px] uppercase tracking-wider text-[#cda68e]">${p.brand || ''}</div>
            <div class="truncate text-sm text-white">${p.name || ''}</div>
            <div class="text-[10px] text-brand-subtext mt-1">${(p.collections || []).filter(c => c !== '全部').join(' · ') || '尚未加入分類'}</div>
        </div>
        <button onclick="openReviewModal('${p.id}')" class="shrink-0 rounded-lg border border-brand-border px-2.5 py-1.5 text-[10px] text-white hover:border-[#cda68e]">${p.rating || p.review ? '編輯心得' : '寫心得'}</button>
        </div>
        ${p.rating || p.review ? `<div class="rounded-xl border border-[#8d6a5b]/20 bg-black/30 p-3"><div class="text-xs text-[#e6c8b7]">${'★'.repeat(Math.min(5, Number(p.rating) || 0))}<span class="ml-2 text-brand-subtext">${p.rating || 0}/5</span></div><p class="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-brand-subtext">${p.review || '尚未填寫心得文字'}</p></div>` : `<div class="text-[11px] text-brand-subtext">還沒留下心得，點選「寫心得」記錄使用感受。</div>`}
    </div>
    `).join('');
}

// 4. TODAY AI RECOMMENDATION
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

    // 舊資料若沒有 AI 類別，仍讓推薦頁可以運作。
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

// ============================
// 今日膚況檢測
// ============================
let currentSkinImage = '';

function getSavedSkinCheck() {
    try { return JSON.parse(localStorage.getItem('MY_BEAUTY_SKIN_CHECK') || 'null'); }
    catch (e) { return null; }
}

function saveSkinCheck(result) {
    try {
    localStorage.setItem('MY_BEAUTY_SKIN_CHECK', JSON.stringify({
        ...result,
        checkedAt: new Date().toISOString()
    }));
    } catch (e) {
    console.warn('膚況結果無法保存：', e);
    showToast('膚況結果儲存失敗，請清出一些瀏覽器空間');
    }
}

function openSkinCheck() {
    const modal = document.getElementById('modal-skin-check');
    if (!modal) return;
    const saved = getSavedSkinCheck();
    const resultEl = document.getElementById('skin-result');
    const preview = document.getElementById('skin-photo-preview');
    const placeholder = document.getElementById('skin-photo-placeholder');
    if (saved) {
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = renderSkinResult(saved);
    } else {
    resultEl.classList.add('hidden');
    resultEl.innerHTML = '';
    }
    if (!currentSkinImage) {
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    }
    modal.classList.remove('hidden');
}

function analyzeSkinPhoto() {
    if (!currentSkinImage) return;
    const btn = document.getElementById('btn-skin-analyze');
    const resultEl = document.getElementById('skin-result');
    btn.disabled = true;
    btn.textContent = 'AI 分析中…';

    // 純 HTML 版本沒有內建雲端 AI 模型，因此先以照片像素特徵做「外觀狀態估算」。
    // 若之後接入真正的視覺 AI API，只需要替換此函式即可，推薦邏輯不需重寫。
    const img = new Image();
    img.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 160;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (size-w)/2, (size-h)/2, w, h);
    const data = ctx.getImageData(0, 0, size, size).data;
    let lum = 0, sat = 0, red = 0, n = 0;
    for (let i = 0; i < data.length; i += 16) {
        const r=data[i], g=data[i+1], b=data[i+2];
        const max=Math.max(r,g,b), min=Math.min(r,g,b);
        lum += (r+g+b)/3;
        sat += max ? (max-min)/max : 0;
        red += r / Math.max(1,(r+g+b)/3);
        n++;
    }
    lum /= n; sat /= n; red /= n;

    let label = '正常', icon = '✨', advice = '整體外觀狀態看起來穩定，可以依照平常妝容搭配。';
    if (lum < 92) {
        label='偏乾'; icon='💧'; advice='照片整體亮度較低，今日可優先考慮較滋潤、妝感較柔和的底妝。';
    } else if (sat > 0.30 && lum > 125) {
        label='偏油'; icon='🌿'; advice='照片顯示高亮度與較高色彩變化，今日可優先考慮較清爽的底妝。';
    } else if (red > 1.12) {
        label='泛紅感'; icon='🌸'; advice='照片中的紅色比例較高，今日可優先選擇妝感較自然、薄透的底妝。';
    }

    const result = { label, icon, advice };
    saveSkinCheck(result);
    document.getElementById('kpi-skin').textContent = label;
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = renderSkinResult(result);
    btn.disabled = false;
    btn.textContent = '重新分析';
    renderAIRecommendation();
    };
    img.src = currentSkinImage;
}

function renderSkinResult(result) {
    const suitable = getSkinRecommendedProducts(result.label);
    return `
    <div class="bg-brand-card border border-brand-border/60 rounded-2xl p-4">
        <div class="flex items-center justify-between">
        <div><div class="text-[10px] text-brand-subtext">今日膚況</div><div class="text-xl text-white mt-1">${result.icon} ${result.label}</div></div>
        <span class="text-[10px] text-brand-subtext">照片外觀分析</span>
        </div>
        <p class="text-xs text-brand-subtext leading-relaxed mt-3">${result.advice}</p>
    </div>
    <div class="bg-brand-card border border-brand-border/60 rounded-2xl p-4">
        <div class="text-xs text-white font-medium mb-3">今日推薦使用</div>
        ${suitable.length ? suitable.map(p => `
        <div onclick="closeModal('modal-skin-check'); openProductDetail('${p.id}')" class="flex items-center py-2.5 border-b border-brand-border/30 last:border-0 cursor-pointer">
            <div class="w-9 h-9 rounded-lg bg-black overflow-hidden mr-3 flex items-center justify-center text-[10px] text-brand-subtext">${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : (p.brand || 'MB').substring(0,2)}</div>
            <div class="min-w-0 flex-1"><div class="text-xs text-white truncate">${p.name}</div><div class="text-[10px] text-brand-subtext mt-0.5">${p.category || '其他'} · ${getRecommendationTone(p)}</div></div>
        </div>`).join('') : `<div class="text-xs text-brand-subtext">目前沒有符合條件的使用中商品，先到「新增商品」建立更多資料吧。</div>`}
    </div>
    <div class="text-[10px] text-brand-subtext leading-relaxed">※ 這是照片外觀的日常估算，不是醫療診斷；光線、相機與妝容都可能影響結果。</div>`;
}

function getSkinRecommendedProducts(label) {
    const tone = label === '偏乾' ? ['暖色調','冷色調'] : ['暖色調','冷色調'];
    return appState.products
    .filter(p => p.status === 'using' && p.recommendationCategory !== '其他')
    .map(p => ({...p, skinScore: (p.rating || 0) * 8 + (tone.includes(getRecommendationTone(p)) ? 5 : 0) + Math.max(0, 30 - Math.max(0, getDaysToExpiry(p.expiry))) }))
    .sort((a,b) => b.skinScore - a.skinScore)
    .slice(0, 3);
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

// 4. PROFILE STATS
function renderProfileStats() {
    const el = document.getElementById('profile-total-count');
    if (el) el.textContent = `${appState.products.length} 項`;
}

/* ==========================================================================
    PRODUCT DETAIL & ACTIONS
    ========================================================================== */
function openProductDetail(id) {
    const p = appState.products.find(item => item.id === id);
    if (!p) return;

    appState.selectedProductId = id;

    document.getElementById('detail-brand').textContent = p.brand;
    document.getElementById('detail-name').textContent = p.name;
    document.getElementById('detail-expiry').textContent = p.expiry;
    const isExpired = getDaysToExpiry(p.expiry) < 0;
    document.getElementById('detail-status').textContent = isExpired ? '已過期・已封存' : (p.status === 'using' ? '使用中' : '已完用・已封存');
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

    // Update finish toggle button text
    const finishBtn = document.getElementById('btn-toggle-finish');
    finishBtn.textContent = isExpired ? '商品已過期' : (p.status === 'using' ? '標示為完用' : '恢復為使用中');
    finishBtn.disabled = isExpired;
    finishBtn.classList.toggle('opacity-40', isExpired);
    finishBtn.classList.toggle('cursor-not-allowed', isExpired);

    openModal('modal-detail');
}

let editedProductPhoto = null;

function openEditProductModal() {
    const p = appState.products.find(item => item.id === appState.selectedProductId);
    if (!p) return;
    document.getElementById('edit-brand').value = p.brand || '';
    document.getElementById('edit-name').value = p.name || '';
    document.getElementById('edit-expiry').value = p.expiry || '';
    document.getElementById('edit-category').value = p.category || '粉底液';
    document.getElementById('edit-tone').value = p.tone || '暖色調';
    document.getElementById('edit-zone').value = p.zone || 'A區';
    document.getElementById('edit-notes').value = p.notes || '';
    const preview = document.getElementById('edit-photo-preview');
    if (p.photo) { preview.src = p.photo; preview.classList.remove('hidden'); }
    else { preview.removeAttribute('src'); preview.classList.add('hidden'); }
    document.getElementById('edit-photo').value = '';
    editedProductPhoto = null;
    closeModal('modal-detail');
    openModal('modal-edit-product');
}

/* ==========================================================================
    EVENT LISTENERS & BINDINGS
    ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderAll();

    document.getElementById('btn-edit-product').addEventListener('click', openEditProductModal);

    document.getElementById('edit-photo').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) { editedProductPhoto = null; return; }
    if (!file.type.startsWith('image/')) { showToast('請選擇圖片檔案'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onerror = () => showToast('讀取照片失敗，請再試一次');
    reader.onload = (evt) => {
        editedProductPhoto = evt.target.result;
        const preview = document.getElementById('edit-photo-preview');
        preview.src = editedProductPhoto;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    });

    document.getElementById('form-edit-product').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = appState.products.find(item => item.id === appState.selectedProductId);
    if (!p) return;
    const oldProduct = { ...p };
    p.brand = document.getElementById('edit-brand').value.trim();
    p.name = document.getElementById('edit-name').value.trim();
    p.expiry = document.getElementById('edit-expiry').value;
    p.category = document.getElementById('edit-category').value;
    p.tone = document.getElementById('edit-tone').value;
    p.zone = document.getElementById('edit-zone').value;
    p.notes = document.getElementById('edit-notes').value.trim();
    if (editedProductPhoto) p.photo = editedProductPhoto;
    // Keep the original review, rating, collection, and finished status unchanged.
    if (getDaysToExpiry(p.expiry) < 0) p.status = p.status || 'using';
    if (!saveData()) { Object.assign(p, oldProduct); return; }
    renderAll();
    closeModal('modal-edit-product');
    openProductDetail(p.id);
    showToast('商品資料已更新');
    });

    // Top Quick Add Button
    document.getElementById('quick-add-btn').addEventListener('click', () => {
    switchTab('add');
    });

    // Product Search Input
    document.getElementById('product-search').addEventListener('input', () => {
    renderProductsList();
    });

    // Image Canvas Compressor Upload
    const photoInput = document.getElementById('input-photo');
    const photoPreview = document.getElementById('photo-preview');
    const photoPlaceholder = document.getElementById('photo-placeholder');
    let currentBase64Image = '';

    photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('請選擇圖片檔案');
        photoInput.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onerror = () => showToast('讀取照片失敗，請再試一次');
    reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
        // Compress Image using Canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 420;
        const scaleSize = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = Math.round(img.width * scaleSize);
        canvas.height = Math.round(img.height * scaleSize);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        currentBase64Image = canvas.toDataURL('image/jpeg', 0.55);
        photoPreview.src = currentBase64Image;
        photoPreview.classList.remove('hidden');
        photoPlaceholder.classList.add('hidden');
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    });

    // Save Add Product Form
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
    const saved = saveData();
    if (!saved) {
        appState.products.shift();
        return;
    }

    // Reset form
    e.target.reset();
    currentBase64Image = '';
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');

    showToast('商品已成功加入');
    switchTab('products');
    });

    // Toggle Finish Status
    document.getElementById('btn-toggle-finish').addEventListener('click', () => {
    if (!appState.selectedProductId) return;
    const p = appState.products.find(item => item.id === appState.selectedProductId);
    if (p) {
        if (getDaysToExpiry(p.expiry) < 0) {
        showToast('商品已過期，無法恢復為使用中');
        return;
        }
        p.status = p.status === 'using' ? 'finished' : 'using';
        saveData();
        renderAll();
        closeModal('modal-detail');
        showToast(`已標示為 ${p.status === 'using' ? '使用中' : '已完用'}`);
    }
    });

    // Delete Product
    document.getElementById('btn-delete-product').addEventListener('click', () => {
    if (!appState.selectedProductId) return;
    appState.products = appState.products.filter(item => item.id !== appState.selectedProductId);
    saveData();
    renderAll();
    closeModal('modal-detail');
    showToast('商品已刪除');
    });

    // Review Modal Trigger from Detail
    document.getElementById('btn-open-review').addEventListener('click', () => {
    closeModal('modal-detail');
    openReviewModal(appState.selectedProductId);
    });

    // Rating Stars Selection
    const starBtns = document.querySelectorAll('.star-btn');
    starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const ratingVal = parseInt(btn.getAttribute('data-star'));
        appState.tempRating = ratingVal;
        updateStarUI(ratingVal);
    });
    });

    // Save Review
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

    // Manage Collections Modal
    document.getElementById('manage-collections-btn').addEventListener('click', () => {
    renderCollectionsManager();
    openModal('modal-collections');
    });

    // Add New Collection
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
        <button onclick="deleteCollection('${col}')" class="text-xs text-brand-danger hover:underline">
        刪除
        </button>
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

// System Data Export
function exportData() {
    const dataBlob = new Blob([JSON.stringify({
    products: appState.products,
    collections: appState.collections
    }, null, 2)], { type: 'application/json;charset=utf-8' });
    const dataUrl = URL.createObjectURL(dataBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = dataUrl;
    downloadAnchor.download = `MY_BEAUTY_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
    showToast('備份檔已匯出');
}

// Reset All System Data
function resetSystemData() {
    if (confirm('確定要清空所有化妝品資料與記錄嗎？此動作無法復原。')) {
    localStorage.removeItem(STORAGE_KEY);
    seedInitialData();
    saveData();
    renderAll();
    showToast('已重置所有資料');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('skin-photo-input');
    const preview = document.getElementById('skin-photo-preview');
    const placeholder = document.getElementById('skin-photo-placeholder');
    const btn = document.getElementById('btn-skin-analyze');
    if (input) input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('請選擇圖片檔案');
        return;
    }
    const reader = new FileReader();
    reader.onerror = () => showToast('照片讀取失敗，請再試一次');
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 600 / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        currentSkinImage = canvas.toDataURL('image/jpeg', 0.6);
        preview.src = currentSkinImage;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        btn.disabled = false;
        };
        img.onerror = () => showToast('無法開啟這張照片，請換一張試試');
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    });
    if (btn) btn.addEventListener('click', analyzeSkinPhoto);
});