// ==========================================
// 👇 极简版：仅记录云端备份 API 日志 👇
// ==========================================
const sysLogData = { api: [] };

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : 'Unknown URL');
    
    // 👇 新增：拦截大模型 API 请求，记录消耗 👇
    if (url.includes('/chat/completions')) {
        let modelName = 'unknown';
        let reqBodyStr = '';
        if (args[1] && args[1].body) {
            try { 
                reqBodyStr = typeof args[1].body === 'string' ? args[1].body : JSON.stringify(args[1].body); 
                const reqObj = JSON.parse(reqBodyStr);
                if (reqObj.model) modelName = reqObj.model;
            } catch(e) {}
        }

        try {
            const response = await originalFetch.apply(this, args);
            const cloneRes = response.clone();
            
            // 异步解析并记录，不阻塞主流程
            cloneRes.json().then(resData => {
                let tokens = 0;
                if (resData && resData.usage && resData.usage.total_tokens) {
                    tokens = resData.usage.total_tokens;
                } else {
                    // 如果 API 没返回 usage，粗略估算
                    tokens = estimateTokens(reqBodyStr) + estimateTokens(JSON.stringify(resData.choices || {}));
                }
                if (tokens > 0) {
                    if (typeof recordApiBilling === 'function') recordApiBilling(modelName, tokens);
                }
            }).catch(e => {});

            return response;
        } catch (error) {
            throw error;
        }
    }
    // 👆 新增结束 👆

    // 仅拦截云端备份请求，其他全部放行
    if (!url.includes('xiaoyuan-backup.xingyan067.workers.dev')) {
        return originalFetch.apply(this, args);
    }

    const startTime = Date.now();
    const method = (args[1] && args[1].method) ? args[1].method.toUpperCase() : 'GET';
    const isOffline = !navigator.onLine;
    let endpoint = url;
    try { endpoint = new URL(url).pathname; } catch(e) {}

    let reqBodyStr = '';
    if (args[1] && args[1].body) {
        try { reqBodyStr = typeof args[1].body === 'string' ? args[1].body : JSON.stringify(args[1].body); } catch(e) { reqBodyStr = '[Complex Body]'; }
    }

    try {
        const response = await originalFetch.apply(this, args);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const cloneRes = response.clone();
        let resBodyStr = '';
        try { resBodyStr = await cloneRes.text(); } catch(e) { resBodyStr = '[Failed to read response]'; }

        sysLogData.api.unshift({
            id: Date.now(), url: url, endpoint: endpoint, method: method,
            status: response.status, statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
            duration: duration, isOffline: isOffline, reqBody: reqBodyStr, resBody: resBodyStr,
            time: Date.now(), isError: !response.ok
        });
        
        if (sysLogData.api.length > 20) sysLogData.api.pop();
        if (document.getElementById('cloudSyncSettingsModal') && document.getElementById('cloudSyncSettingsModal').classList.contains('open')) renderApiLogs();
        return response;
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        sysLogData.api.unshift({
            id: Date.now(), url: url, endpoint: endpoint, method: method,
            status: 'Failed', statusText: 'Network Error', duration: duration,
            isOffline: isOffline, reqBody: reqBodyStr, resBody: error.message,
            time: Date.now(), isError: true
        });
        if (sysLogData.api.length > 20) sysLogData.api.pop();
        if (document.getElementById('cloudSyncSettingsModal') && document.getElementById('cloudSyncSettingsModal').classList.contains('open')) renderApiLogs();
        throw error;
    }
};

function clearCurrentLogs() {
    if (confirm(`确定要清空云端同步记录吗？`)) {
        sysLogData.api = []; 
        renderApiLogs();
    }
}
function formatLogTime(timestamp) {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}
function renderApiLogs() {
    const container = document.getElementById('view-log-api');
    if (!container) return;
    container.innerHTML = '';
    if (sysLogData.api.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:14px;">暂无云端同步记录</div>';
        return;
    }
    sysLogData.api.forEach(log => {
        const isError = log.isError;
        const methodClass = log.method === 'GET' ? 'get' : 'post';
        const statusClass = isError ? 'error' : 'success';
        let prettyReq = log.reqBody; let prettyRes = log.resBody;
        try { if(prettyReq) prettyReq = JSON.stringify(JSON.parse(prettyReq), null, 2); } catch(e){}
        try { if(prettyRes) prettyRes = JSON.stringify(JSON.parse(prettyRes), null, 2); } catch(e){}
        let detailsHtml = '';
        if (isError) detailsHtml += `<span class="log-error-highlight">Request URL: ${log.url}</span>\n`;
        if (prettyReq) detailsHtml += `[Request Body]\n${prettyReq}\n\n`;
        detailsHtml += `[Response]\n${prettyRes}`;
        const card = document.createElement('div');
        card.className = `log-card ${isError ? 'error' : ''}`;
        card.innerHTML = `
            <div class="log-header">
                <div class="log-title"><span class="log-tag ${methodClass}">${log.method}</span>${log.endpoint}</div>
                <div class="log-time">${formatLogTime(log.time)}</div>
            </div>
            <div class="log-meta">
                <span class="log-status-badge ${statusClass}">${log.status} ${log.statusText}</span>
                <span>⏱ ${log.duration}s</span>
            </div>
            <div class="log-details">${detailsHtml}</div>
        `;
        container.appendChild(card);
    });
}
// 👆 恢复结束 👆

// ==========================================
// 新增：iOS Standalone (全屏) 模式检测与防缩放
// ==========================================
function initStandaloneMode() {
    // 1. 检测是否在添加到主屏幕的全屏模式下运行
    const isIosStandalone = window.navigator.standalone === true;
    const isMatchMediaStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isIosStandalone || isMatchMediaStandalone) {
        // 给 body 添加 class，方便 CSS 单独做刘海屏适配
        document.body.classList.add('ios-standalone');
        console.log("✅ 当前运行在 Standalone 全屏模式");
    } else {
        console.log("⚠️ 当前运行在普通浏览器模式，请添加到主屏幕体验全屏");
    }

    // 2. 彻底禁止双指缩放 (Pinch-to-zoom)
    document.addEventListener('touchmove', function(event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });
}

// 立即执行检测
initStandaloneMode();

// --- 登录/注册系统 (Supabase) ---

const SUPABASE_URL = 'https://ofsvczapcsudymnijjrq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IbfurTy7b2S3SnmnhDqL7Q_vFfQi9PA';
const SUPABASE_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
};

/**
 * 检查登录状态，决定是否显示登录页
 */
async function checkAndShowActivation() {
    const overlay = document.getElementById('activation-overlay');
    const previewShown = localStorage.getItem('scrapbook_preview_v1');

    // 一次性新登录UI预览：所有人（含已登录）强制重新登录一次
    if (!previewShown) {
        localStorage.setItem('scrapbook_preview_v1', '1');
        if (overlay) overlay.style.display = 'flex';
        return;
    }

    const loginState = localStorage.getItem('app_login_state');

    if (loginState === 'logged_in') {
        if (overlay) overlay.style.display = 'none';
        return;
    }

    // 尝试从 Supabase 恢复会话
    const savedQQ = localStorage.getItem('app_qq');
    const savedPass = localStorage.getItem('app_pass');
    if (savedQQ && savedPass) {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/vip_keys?qq=eq.${encodeURIComponent(savedQQ)}&is_used=eq.true&select=*`,
                { headers: SUPABASE_HEADERS }
            );
            if (res.ok) {
                const rows = await res.json();
                if (rows.length === 1 && rows[0].password === savedPass) {
                    localStorage.setItem('app_login_state', 'logged_in');
                    if (overlay) overlay.style.display = 'none';
                    return;
                }
            }
        } catch (e) {}
    }

    if (overlay) overlay.style.display = 'flex';
}

// ===== UI 交互 =====

function switchAuthTab(tab) {
    const loginTab = document.getElementById('tab-login');
    const regTab = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form-card');
    const regForm = document.getElementById('reg-form-card');

    if (tab === 'login') {
        loginTab.classList.add('active');
        regTab.classList.remove('active');
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        const resetForm = document.getElementById('reset-form-card');
        if (resetForm) resetForm.style.display = 'none';
    } else {
        regTab.classList.add('active');
        loginTab.classList.remove('active');
        regForm.style.display = 'block';
        loginForm.style.display = 'none';
    }
}

function clearInput(id) {
    const el = document.getElementById(id);
    if (el) {
        el.value = '';
        el.focus();
    }
}

function togglePass(inputId, cb) {
    document.getElementById(inputId).type = cb.checked ? 'text' : 'password';
}

function toast(msg) {
    let t = document.getElementById('auth-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'auth-toast';
        t.style.cssText = 'position:fixed;top:40px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 24px;border-radius:20px;font-size:12px;letter-spacing:1px;z-index:1000000000;opacity:0;transition:opacity 0.3s;pointer-events:none;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

// ===== 登录 =====
async function handleLogin() {
    const account = document.getElementById('login-account').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!account) return toast('请输入账号');
    if (!password) return toast('请输入密码');

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/vip_keys?qq=eq.${encodeURIComponent(account)}&is_used=eq.true&select=*`,
            { headers: SUPABASE_HEADERS }
        );

        if (!res.ok) {
            console.error('Login error:', res.status);
            return toast('登录失败 [' + res.status + ']');
        }

        const rows = await res.json();

        if (rows.length === 0 || !rows[0].password) {
            return toast('账号不存在');
        }

        if (rows[0].password !== password) {
            return toast('密码错误');
        }

        // 登录成功
        localStorage.setItem('app_login_state', 'logged_in');
        localStorage.setItem('app_qq', account);
        localStorage.setItem('app_pass', password);
        localStorage.setItem('ios_theme_activation_v2_fallback', 'true');

        document.getElementById('activation-overlay').style.display = 'none';
        toast('登录成功 (´▽`ʃ♡ƪ)');

    } catch (e) {
        console.error('Login error:', e);
        toast('网络错误，请稍后重试');
    }
}

// ===== 注册 =====
async function handleRegister() {
    const qq = document.getElementById('reg-qq').value.trim();
    const code = document.getElementById('reg-code').value.trim();
    const pwd = document.getElementById('reg-password').value.trim();
    const pwd2 = document.getElementById('reg-password-confirm').value.trim();

    if (!qq) return toast('请输入QQ号');
    if (!code) return toast('请输入激活码');
    if (!pwd) return toast('请设置密码');
    if (pwd.length < 6) return toast('密码至少6位');
    if (pwd !== pwd2) return toast('两次密码不一致');

    try {
        // 1. 本地校验激活码（与QQ号算法匹配）
        const expectedCode = generateCodeForQQ(qq);
        if (code !== expectedCode) {
            return toast('激活码与QQ号不匹配，或激活码无效');
        }

        // 2. 检查QQ是否已注册
        const userRes = await fetch(
            `${SUPABASE_URL}/rest/v1/vip_keys?qq=eq.${encodeURIComponent(qq)}&select=*`,
            { headers: SUPABASE_HEADERS }
        );
        if (userRes.ok) {
            const users = await userRes.json();
            if (users.length > 0) {
                return toast('该账号已注册，请直接登录');
            }
        }

        // 3. 直接插入新行
        const insertRes = await fetch(
            `${SUPABASE_URL}/rest/v1/vip_keys`,
            {
                method: 'POST',
                headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ code: code, qq: qq, password: pwd, is_used: true })
            }
        );

        if (!insertRes.ok) {
            const errText = await insertRes.text();
            console.error('Supabase register error:', insertRes.status, errText);
            if (insertRes.status === 409) return toast('该QQ号或激活码已被注册');
            return toast('注册失败 [' + insertRes.status + ']，请联系管理员');
        }

        toast('注册成功！请返回登录 ₍˄·͈༝·˄˄₎');
        setTimeout(() => switchAuthTab('login'), 1200);

    } catch (e) {
        console.error('Register error:', e);
        toast('网络错误，请稍后重试');
    }
}

// ===== 重置密码 =====
function showResetPwd() {
    document.getElementById('login-form-card').style.display = 'none';
    document.getElementById('reg-form-card').style.display = 'none';
    document.getElementById('reset-form-card').style.display = 'block';
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.remove('active');
}

async function handleResetPwd() {
    const qq = document.getElementById('reset-qq').value.trim();
    const code = document.getElementById('reset-code').value.trim();
    const newPwd = document.getElementById('reset-new-pwd').value.trim();
    const newPwd2 = document.getElementById('reset-new-pwd2').value.trim();

    if (!qq) return toast('请输入QQ号');
    if (!code) return toast('请输入激活码');
    if (!newPwd) return toast('请输入新密码');
    if (newPwd.length < 6) return toast('新密码至少6位');
    if (newPwd !== newPwd2) return toast('两次密码不一致');

    try {
        // 1. 本地校验激活码
        const expectedCode = generateCodeForQQ(qq);
        if (code !== expectedCode) {
            return toast('激活码与QQ号不匹配');
        }

        // 2. 确认QQ已注册
        const userRes = await fetch(
            `${SUPABASE_URL}/rest/v1/vip_keys?qq=eq.${encodeURIComponent(qq)}&select=*`,
            { headers: SUPABASE_HEADERS }
        );
        if (!userRes.ok) return toast('验证失败 [' + userRes.status + ']');
        const users = await userRes.json();
        if (users.length === 0) return toast('账号不存在，请先注册');

        // 3. 更新密码
        const patchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/vip_keys?qq=eq.${encodeURIComponent(qq)}`,
            {
                method: 'PATCH',
                headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ password: newPwd })
            }
        );

        if (!patchRes.ok) {
            return toast('重置失败 [' + patchRes.status + ']');
        }

        // 同步更新本地存储
        localStorage.setItem('app_pass', newPwd);
        toast('密码重置成功！请返回登录');
        setTimeout(() => switchAuthTab('login'), 1200);

    } catch (e) {
        console.error('Reset error:', e);
        toast('网络错误，请稍后重试');
    }
}

// 新增：退出登录与解绑函数 (已修复无法退出的Bug)
async function unbindDevice() {
    const qq = localStorage.getItem('app_qq');

    if (!confirm("确定要退出登录吗？")) {
        return;
    }

    // 清除本地登录状态
    localStorage.removeItem('app_login_state');
    localStorage.removeItem('app_qq');
    localStorage.removeItem('app_pass');
    localStorage.removeItem('ios_theme_activation_v2_fallback');
    localStorage.removeItem('current_bound_qq');

    try {
        await idb.set('ios_theme_activation_v2_status', { activated: false });
    } catch(e) {}

    alert("已退出登录！");
    location.reload();
}

/**
 * 根据QQ号生成激活码 (全新V2算法)
 */
function generateCodeForQQ(qq) {
    const salt = "HONEY-STUDIO-V2-SECRET-20260309";
    const baseString = `${qq}#${salt}`;
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
        const char = baseString.charCodeAt(i);
        hash = ((hash << 7) - hash) + char;
        hash |= 0;
    }
    hash = Math.abs(hash);
    const hexHash = hash.toString(16).toUpperCase();
    const qqInfo = `${qq.length}${qq.slice(-2)}`;
    return `V2-${qqInfo}-${hexHash}`.substring(0, 16);
}
// --- 全局变量 ---
const totalApps = 10; // 👈 修改：增加到 10 个 APP (新增阅读APP)
let iconPresets = [];
let fontPresets = [];
let wallpaperPresets = [];
let apiPresets = [];

// API 限制相关
let sessionApiCallCount = 0; // 当前会话已调用次数
const aiGeneratingLocks = {}; // 【新增】：防止 AI 重复生成的锁

// 👇 新增：存储拉取到的模型列表 👇
let fetchedModelsPrimary = [];
let fetchedModelsSecondary = [];
// 👆 新增结束 👆

// 世界书数据 (全局共享)
let worldbookEntries = [];
let worldbookGroups = [];
let currentEditingId = null;

// 总结专用世界书选择
let tempSummaryWbIds = [];

let pendingDeleteType = ''; 
let pendingDeleteIndex = -1;
let pendingSaveType = '';

// 拖拽与编辑模式全局变量
let isHomeEditMode = false;
let backupGridLayout = {};
let backupWidgetPosition = {};
let customNotificationSound = null; // 存储自定义提示音

let dragItem = null;
let dragGhost = null;
let dragStartX = 0;
let dragStartY = 0;
let longPressTimer = null;
let isDragging = false;

// 手机仿真器相关全局变量
let wcActiveSimChatId = null; // 当前正在查看的模拟对话ID
let currentPhoneContact = null; // 当前正在查看的通讯录联系人
let wcFavoritesTab = 'memos'; // 收藏页面当前 Tab: 'memos' 或 'diaries'

// 隐私与安全全局变量
let privacyStepCount = parseInt(localStorage.getItem('ios_theme_steps')) || 0;
let privacyLastDate = localStorage.getItem('ios_theme_step_date') || new Date().toDateString();
let privacyLastMotionTime = 0;
let isMotionListenerAdded = false;

// 通知与后台全局变量 (新增)
let isRealNotifEnabled = localStorage.getItem('ios_theme_real_notif_enabled') === 'true';
let isAlwaysRealNotifEnabled = localStorage.getItem('ios_theme_always_real_notif_enabled') === 'true';

// 检查是否是新的一天，如果是则步数清零
function checkNewDay() {
    const today = new Date().toDateString();
    if (privacyLastDate !== today) {
        privacyStepCount = 0;
        privacyLastDate = today;
        localStorage.setItem('ios_theme_steps', 0);
        localStorage.setItem('ios_theme_step_date', today);
    }
}

// --- 强化：NPC 头像列表 (必须使用提供的图片) ---
const npcAvatarList = [
    "https://i.postimg.cc/26HCtpHm/Image-1771583312811-653.jpg",
    "https://i.postimg.cc/Px6d7G6T/Image-1771583329136-980.jpg",
    "https://i.postimg.cc/63HBPsHX/Image-1771583330998-167.jpg",
    "https://i.postimg.cc/nzVHTV1z/Image-1771759223355-652.jpg",
    "https://i.postimg.cc/fLWw5WvT/Image-1771759225619-652.jpg",
    "https://i.postimg.cc/9MXW1XBC/Image-1771759259026-722.jpg",
    "https://i.postimg.cc/vB8QX8v8/Image-1771759262483-627.jpg",
    "https://i.postimg.cc/76PxXPNH/Image-1771759272022-988.jpg",
    "https://i.postimg.cc/W3p2Sp7s/Image-1771759277167-924.jpg"
];

// 辅助函数：随机获取一个头像
function getRandomNpcAvatar() {
    return npcAvatarList[Math.floor(Math.random() * npcAvatarList.length)];
}

// --- IndexedDB 封装 (iOS Theme) ---
const idb = {
    dbName: 'iOSThemeStudioDB',
    storeName: 'settings',
    version: 1,
    db: null,

    async open() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => reject(e);
        });
    },

    async get(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async set(key, value) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.put(value, key);
            // 【iOS 核心修复】：必须监听 tx.oncomplete 确保数据物理写入磁盘
            tx.oncomplete = () => {
                // 👇 新增：触发云端备份脏标记
                if (typeof window.needCloudBackup !== 'undefined') {
                    window.needCloudBackup = true;
                }
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    },

    async clear() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.clear();
            // 【iOS 核心修复】
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
    
    async getAllKeys() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
};

// --- 初始化 ---
window.onload = async function() {
    // !!! 新增：在所有操作之前，首先检查激活状态
    checkAndShowActivation();    
    initGrid(); 
    await loadAllData(); // 加载 IndexedDB 数据 (含布局恢复)
    
    // 【修复】：彻底移除旧版小组件的时间、电量、天气初始化，防止报错中断程序！
    
    initNewPhoneFeatures(); // 初始化新增的收藏和浏览器功能UI

    // 初始化 WeChat DB
    try {
        try {
            await wcDb.init();
        } catch (e) {
            console.error("WeChat DB Init failed", e);
        }
        await wcLoadData();
        wcRenderAll();
        wcSwitchTab('chat');
        initProactiveSystem(); // 初始化主动消息系统
        
        // 初始化恋人空间数据
        await lsLoadData();
        lsInitNpcLoop(); // 启动 NPC 循环
        lsRenderWidget(); // 渲染桌面小组件
        
        // 【新增】：恢复一起听歌状态
        await musicInitState();

    } catch (e) {
        console.error("WeChat Data bootstrap failed", e);
    }
    
            // WeChat 全局点击隐藏菜单
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.wc-bubble') && !e.target.closest('#wc-context-menu')) {
                    wcHideContextMenu();
                }
            });

            // 👇 新增：数据全部加载并渲染完毕后，再显示整个页面，彻底解决图标闪烁和乱跑的问题
            requestAnimationFrame(() => {
                const appRoot = document.getElementById('app-root');
                if (appRoot) appRoot.style.opacity = '1';
                
                // 隐藏全局 Loading 动画
                const loadingScreen = document.getElementById('global-initial-loading');
                if (loadingScreen) {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => loadingScreen.style.display = 'none', 400);
                }
            });
            // 👆 新增结束 👆

// iOS / PWA 全屏与键盘自适应最终版 (兼容安卓防黑屏)
function updateAppViewportVars() {
    const docStyle = document.documentElement.style;
    // 👇 新增：精准判断是否为 iOS 设备
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS && window.visualViewport) {
        // 🍎 iOS 专属逻辑：绝对保留，绝不破坏你的完美适配！
        // 🔪 终极修复：用 screen.height 减去 visualViewport.height 来精准判断键盘！
        const isKeyboardOpen = (window.screen.height - window.visualViewport.height) > 150;
        
        if (isKeyboardOpen) {
            // 键盘弹起时，高度缩小到可视区域，把弹窗、输入框和 Dock 栏完美“托”上来
            docStyle.setProperty('--app-height', `${window.visualViewport.height}px`);
        } else {
            // 键盘收起时，恢复最大高度（包含 screen.height），彻底消灭底部的黑边！
            const candidates = [
                window.innerHeight,
                document.documentElement.clientHeight,
                window.visualViewport.height
            ];
            if (window.navigator.standalone === true) {
                candidates.push(window.screen.height);
            }
            const fullHeight = Math.max(...candidates);
            docStyle.setProperty('--app-height', `${fullHeight}px`);
        }
        
        // 强制回滚到顶部，防止 iOS 默认的滚动推移导致错位
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
    } else {
        // 🤖 安卓及其他设备逻辑：安卓键盘弹出时会自动调整 innerHeight，直接使用即可
        // 彻底解决安卓因为 screen.height 差值误判导致的底部大片黑屏！
        const fallbackHeight = window.innerHeight;
        docStyle.setProperty('--app-height', `${fallbackHeight}px`);
    }
    
    docStyle.setProperty('--wc-input-height', '64px');
    docStyle.setProperty('--keyboard-offset', '0px');
}

// 监听可视区域变化（键盘弹出/收起）
let viewportResizeTimer = null; // 新增：防抖计时器
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        // 核心修复：加入防抖逻辑，防止打开APP时疯狂触发重绘导致卡顿
        if (viewportResizeTimer) clearTimeout(viewportResizeTimer);
        viewportResizeTimer = setTimeout(() => {
            updateAppViewportVars();
            if (typeof wcScrollToBottom === 'function') wcScrollToBottom(true);
            const simHistory = document.getElementById('wc-sim-chat-history');
            if (simHistory) simHistory.scrollTop = simHistory.scrollHeight;
            const pmHistory = document.getElementById('forum-pm-chat-history');
            if (pmHistory) pmHistory.scrollTop = pmHistory.scrollHeight;
            const dreamHistory = document.getElementById('dream-chat-history');
            if (dreamHistory) dreamHistory.scrollTop = dreamHistory.scrollHeight;
        }, 150); // 延迟 150ms，等屏幕完全稳定后再计算
    });
    
    // 恢复防滚动机制，配合正确的键盘高度计算，实现原生 App 体验
    window.visualViewport.addEventListener('scroll', () => {
        // 👇 新增：仅在 iOS 上执行防滚动，安卓不需要，防止安卓滑动卡顿
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }
    });
} else {
    window.addEventListener('resize', updateAppViewportVars);
}

// 监听输入框失去焦点（键盘收起），强制重置页面位置，防止页面卡在半空中漏出白边
document.addEventListener('focusout', () => {
    setTimeout(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        updateAppViewportVars();
    }, 50);
});

// 初始化调用一次
updateAppViewportVars();

    // 通用输入框确认按钮事件绑定
    const generalConfirmBtn = document.getElementById('wc-general-input-confirm');
    if (generalConfirmBtn) {
        generalConfirmBtn.onclick = function() {
            const textInput = document.getElementById('wc-general-input-field');
            const passInput = document.getElementById('wc-general-password-field');
            // 动态判断当前显示的是哪个输入框，就取哪个的值
            const val = (passInput && passInput.style.display === 'block') ? passInput.value : textInput.value;
            
            if (wcState.generalInputCallback) {
                wcState.generalInputCallback(val);
            }
            wcCloseModal('wc-modal-general-input');
        };
    }

    // 监听模拟器聊天输入框，控制发送按钮显示
    const simInput = document.getElementById('wc-sim-chat-input');
    if (simInput) {
        simInput.addEventListener('input', function() {
            const sendBtn = document.getElementById('wc-sim-send-btn');
            const aiBtn = document.getElementById('wc-sim-ai-btn');
            if (this.value.trim().length > 0) {
                sendBtn.style.display = 'block';
                aiBtn.style.display = 'none';
            } else {
                sendBtn.style.display = 'none';
                aiBtn.style.display = 'flex';
            }
            // 自动调整高度
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        simInput.addEventListener('focus', () => {
            setTimeout(() => {
                const container = document.getElementById('wc-sim-chat-history');
                if(container) container.scrollTop = container.scrollHeight;
            }, 300);
        });
    }

    // 初始化通知与后台 UI
    if (typeof updateNotifUI === 'function') {
        updateNotifUI();
    }
    
    // 修复：世界书详细设定输入框被键盘遮挡的问题，聚焦时自动滚动到中间
    const wbDescInput = document.getElementById('wbDescInput');
    if (wbDescInput) {
        wbDescInput.addEventListener('focus', function() {
            setTimeout(() => {
                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300); // 延迟等待键盘完全弹出
        });
    }

    // 👇 修复：采用与世界书完全一致的极简滚动逻辑 👇
    const promptInputs = ['wc-input-char-prompt', 'wc-edit-char-prompt', 'wc-input-mask-prompt'];
    promptInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', function() {
                setTimeout(() => {
                    this.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300); // 延迟等待键盘完全弹出
            });
        }
    });
    // 👆 新增结束 👆
         
    // 延迟 1.5 秒检查并弹出系统更新日志
    setTimeout(checkSystemUpdate, 1500); 
    
    // 初始化音乐进度条拖拽
    setTimeout(initMusicProgressDrag, 1000); // 延迟绑定，确保 DOM 已渲染

    // 👇 新增：监听主聊天输入框的 @ 符号 👇
    const mainChatInput = document.getElementById('wc-chat-input');
    if (mainChatInput) {
        mainChatInput.addEventListener('input', function(e) {
            const val = this.value;
            const char = wcState.characters.find(c => c.id === wcState.activeChatId);
            // 如果是群聊，且最后一个输入的字符是 @
            if (char && char.isGroup && val.endsWith('@')) {
                wcShowAtList(char);
            } else if (!val.includes('@')) {
                document.getElementById('wc-at-mention-list').classList.add('hidden');
            }
        });
    }
    // 👆 新增结束 👆
};


// --- 动态注入新增功能的 HTML 结构 ---
function initNewPhoneFeatures() {
    // 1. 覆盖浏览器图标的点击事件
    const browserIcon = document.querySelector('.wc-ios-app-item[onclick="alert(\'Browser App\')"]');
    if (browserIcon) {
        browserIcon.setAttribute('onclick', "wcOpenPhoneApp('browser')");
    }

    const screenBg = document.getElementById('wc-phone-screen-bg');
    
    // 2. 注入微信收藏的 HTML
    if (screenBg && !document.getElementById('wc-phone-app-favorites')) {
        const favHtml = `
            <div id="wc-phone-app-favorites" class="wc-phone-app-view" style="display: none; background: #F4F5F9;">
                <!-- 极简 INS 风顶栏 -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: calc(env(safe-area-inset-top, 20px) + 15px) 20px 10px 20px; background: transparent; z-index: 10; flex-shrink: 0;">
                    <div onclick="wcClosePhoneFavorites()" style="font-size: 28px; font-weight: 900; color: #111; cursor: pointer; letter-spacing: 1px; transition: opacity 0.2s;" title="点击返回">收藏</div>
                    <div onclick="wcGeneratePhoneFavorites()" style="width: 38px; height: 38px; background: #FFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); cursor: pointer; color: #111; transition: transform 0.2s;" title="刷新数据">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 2.13-5.85L2 9"></path></svg>
                    </div>
                </div>
                <div id="wc-phone-favorites-content" style="flex: 1; overflow-y: auto; padding: 0; background: transparent;"></div>
            </div>
            
            <!-- 备忘录详情弹窗 -->
            <div id="wc-phone-memo-detail" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #FFF; z-index: 300; display: none; flex-direction: column;">
                <div class="wc-phone-sim-navbar" style="background: #F9F9F9; color: #000; border-bottom: 0.5px solid #C6C6C8; justify-content: space-between; padding: 0 10px;">
                    <div onclick="document.getElementById('wc-phone-memo-detail').style.display='none'" style="cursor: pointer; font-size: 14px; color: #007AFF;">返回</div>
                    <div style="font-weight: 600;">备忘录</div>
                    <div style="width: 30px;"></div>
                </div>
                <div id="wc-phone-memo-detail-content" style="flex: 1; overflow-y: auto; padding: 20px; font-size: 16px; line-height: 1.6; white-space: pre-wrap; color: #333;"></div>
            </div>
        `;
        screenBg.insertAdjacentHTML('beforeend', favHtml);
    }

    // 3. 注入浏览器的 HTML
    if (screenBg && !document.getElementById('wc-phone-app-browser')) {
        const browserHtml = `
            <div id="wc-phone-app-browser" class="wc-phone-app-view" style="display: none; background: #F2F2F7;">
                <div style="padding: calc(env(safe-area-inset-top, 20px) + 10px) 20px 0 20px; flex-shrink: 0;">
                    <!-- 顶部退出键 -->
                    <div class="browser-header-title" onclick="wcClosePhoneApp()">
                        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        Browser
                    </div>
                    <!-- 搜索框 -->
                    <div class="browser-search-container">
                        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" placeholder="搜索网页或输入网址..." readonly>
                    </div>
                </div>
                
                <div id="wc-phone-browser-content" style="flex: 1; overflow-y: auto; padding: 0 20px; padding-bottom: 120px; scrollbar-width: none;"></div>
                
                <!-- 底部悬浮导航栏 -->
                <div class="browser-bottom-nav-wrapper">
                    <div class="nav-bg"></div>
                    <div class="nav-items">
                        <div class="nav-btn active" id="browser-nav-history" onclick="wcToggleBrowserTab('history')">
                            <!-- 左侧：方案1的指南针 -->
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
                        </div>
                        <div class="nav-btn" id="browser-nav-posts" onclick="wcToggleBrowserTab('posts')">
                            <!-- 右侧：方案3的星球 -->
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path></svg>
                            <div class="red-dot" id="browser-posts-dot" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="center-btn" onclick="wcGeneratePhoneBrowser()">
                        <div class="center-btn-inner">
                            <!-- 中间：保持原样 -->
                            <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </div>
                    </div>
                </div>
            </div>


            <!-- 帖子详情弹窗 -->
            <div id="wc-phone-post-detail" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #FFF; z-index: 300; display: none; flex-direction: column;">
                <div class="wc-phone-sim-navbar" style="background: #F9F9F9; color: #000; border-bottom: 0.5px solid #C6C6C8; justify-content: space-between; padding: 0 10px;">
                    <div onclick="document.getElementById('wc-phone-post-detail').style.display='none'" style="cursor: pointer; font-size: 14px; color: #007AFF;">返回</div>
                    <div style="font-weight: 600;">帖子详情</div>
                    <div style="width: 30px;"></div>
                </div>
                <div id="wc-phone-post-detail-content" style="flex: 1; overflow-y: auto; padding: 0; background: #F2F2F7;"></div>
            </div>
        `;
        screenBg.insertAdjacentHTML('beforeend', browserHtml);
    }
}

// --- 数据加载逻辑 (异步) ---
async function loadAllData() {
    try {
        // 1. 加载新版小组件数据
        const widgetData = await idb.get('ios_theme_widget') || {};
        
        // 恢复 4x3 小组件的位置和显示状态
        const mainWidget = document.getElementById('mainWidget');
        if (mainWidget) {
            if (widgetData.position) {
                mainWidget.style.top = widgetData.position.top;
                mainWidget.style.left = widgetData.position.left;
                mainWidget.style.transform = widgetData.position.transform;
            } else {
                // 默认位置
                mainWidget.style.top = '20px';
                mainWidget.style.left = '20px';
            }
            if (widgetData.isVisible === false) {
                mainWidget.style.display = 'none';
            }
            makeMainWidgetDraggable(mainWidget); // 绑定拖拽
        }

        const elements = ['label1', 'label2', 'bubble1', 'bubble2', 'bubble3'];
        elements.forEach(id => {
            if (widgetData[id]) {
                const el = document.getElementById(id);
                if (el) el.innerText = widgetData[id];
            }
        });
        
        // 【已删除读取旧歌名和歌词的代码，强制使用 HTML 默认值】

        const images = ['avatar1', 'avatar2', 'picture1'];
        images.forEach(id => {
            if (widgetData[id]) {
                const el = document.getElementById(id);
                if (el) {
                    el.style.backgroundImage = `url('${widgetData[id]}')`;
                    el.innerHTML = ''; // 清除占位文字
                }
            }
        });

        // 2. 加载 Apple ID 数据
        const appleData = await idb.get('ios_theme_apple') || {};
        if (appleData.avatar) {
            const av = document.getElementById('appleIdAvatar');
            const avDetail = document.getElementById('appleIdDetailAvatar');
            av.style.backgroundImage = appleData.avatar;
            av.style.backgroundSize = 'cover';
            av.innerText = '';
            avDetail.style.backgroundImage = appleData.avatar;
            avDetail.style.backgroundSize = 'cover';
            avDetail.innerText = '';
        }
        if (appleData.name) {
            document.getElementById('appleIdName').innerText = appleData.name;
            document.getElementById('appleIdDetailName').innerText = appleData.name;
        }

        // 3. 加载世界书数据
        worldbookEntries = JSON.parse(await idb.get('ios_theme_wb_entries') || '[]');
        worldbookGroups = JSON.parse(await idb.get('ios_theme_wb_groups') || '[]');

        // 4. 加载主题设置 (壁纸、字体)
        const themeData = await idb.get('ios_theme_settings') || {};
        if (themeData.wallpaper) document.getElementById('mainScreen').style.backgroundImage = themeData.wallpaper;
        if (themeData.fontSize) {
            changeFontSize(themeData.fontSize);
            document.getElementById('fontSizeSlider').value = themeData.fontSize;
        }
        if (themeData.fontUrl) {
            window.currentLoadedFontUrl = themeData.fontUrl;
            if (themeData.fontUrl.startsWith('data:')) {
                document.getElementById('fontUrlInput').value = '已加载本地字体 (Local Font)';
            } else {
                document.getElementById('fontUrlInput').value = themeData.fontUrl;
            }
            applyFont(themeData.fontUrl);
        }

        // 5. 加载 App 布局 (图标和名称)
        const appsData = JSON.parse(await idb.get('ios_theme_apps') || '[]');
        appsData.forEach(app => {
            const nameEl = document.getElementById(`name-${app.id}`);
            const iconEl = document.getElementById(`icon-${app.id}`);
            if (nameEl) nameEl.innerText = app.name;
            if (iconEl && app.iconBg) {
                iconEl.style.backgroundImage = app.iconBg;
                iconEl.style.backgroundColor = 'transparent';
            }
        });

        // 5.1 恢复桌面布局 (位置)
        const layoutData = await idb.get('ios_theme_layout');
        if (layoutData) {
            restoreGridLayout(layoutData);
        }
        // 恢复自定义小组件数据
        const customWidgetsData = await idb.get('ios_custom_widgets') || { imported: [], desktop: [] };
        customImportedWidgets = customWidgetsData.imported || [];
        customDesktopWidgets = customWidgetsData.desktop || [];
        renderDesktopWidgets();

        // 6. 加载预设
        const presets = await idb.get('ios_theme_presets') || {};
        iconPresets = presets.icons || [];
        fontPresets = presets.fonts || [];
        wallpaperPresets = presets.wallpapers || [];
        apiPresets = presets.apis || [];

        // 7. 加载 API 设置 (双路适配)
        const fullApiConfig = await idb.get('ios_theme_api_config') || {};
        
        // 兼容旧版单路数据
        const primary = fullApiConfig.primary || { baseUrl: fullApiConfig.baseUrl, key: fullApiConfig.key, model: fullApiConfig.model, temp: fullApiConfig.temp };
        const secondary = fullApiConfig.secondary || {};
        const routes = fullApiConfig.routes || { phone: true, npc: false, forum: true };

        // 填充主 API
        if (primary.baseUrl) document.getElementById('apiBaseUrl').value = primary.baseUrl;
        if (primary.key) document.getElementById('apiKey').value = primary.key;
        if (primary.temp) {
            document.getElementById('tempSlider').value = primary.temp;
            document.getElementById('tempDisplay').innerText = primary.temp;
        }
        if (primary.model) {
             const select = document.getElementById('modelSelect');
             if (select.options.length <= 1) {
                 const opt = document.createElement('option');
                 opt.value = primary.model; opt.innerText = primary.model + " (已保存)"; opt.selected = true;
                 select.appendChild(opt);
             }
        }

        // 填充副 API
        if (secondary.baseUrl) document.getElementById('secApiBaseUrl').value = secondary.baseUrl;
        if (secondary.key) document.getElementById('secApiKey').value = secondary.key;
        if (secondary.temp) {
            document.getElementById('secTempSlider').value = secondary.temp;
            document.getElementById('secTempDisplay').innerText = secondary.temp;
        }
        if (secondary.model) {
             const select = document.getElementById('secModelSelect');
             if (select.options.length <= 1) {
                 const opt = document.createElement('option');
                 opt.value = secondary.model; opt.innerText = secondary.model + " (已保存)"; opt.selected = true;
                 select.appendChild(opt);
             }
        }

        // 填充路由开关
        document.getElementById('route-phone').checked = routes.phone;
        document.getElementById('route-npc').checked = routes.npc;
        document.getElementById('route-forum').checked = routes.forum;

        // 渲染列表
        renderAppEditors();
        renderWallpaperGrid();
        renderIconPresets();
        renderFontPresets();
        renderApiPresets();
        // 8. 加载自定义提示音
        const soundData = await idb.get('ios_theme_sound');
        if (soundData && soundData.url) {
            customNotificationSound = soundData.url;
            const input = document.getElementById('soundUrlInput');
            if(input) input.value = soundData.url.startsWith('data:') ? '已选择本地音频' : soundData.url;
        }
    } catch (e) {
        console.error("IndexedDB Load Error:", e);
    }
}

// --- 恢复桌面布局 ---
function restoreGridLayout(layout) {
    // 获取所有页面的格子
    const cells = Array.from(document.querySelectorAll('.home-grid .grid-cell')); 
    
    for (const [cellIndex, appId] of Object.entries(layout)) {
        const cell = cells.find(c => c.dataset.index == cellIndex);
        const app = document.getElementById(appId);
        
        if (cell && app) {
            cell.appendChild(app);
        }
    }
}

// --- 保存桌面布局 ---
async function saveGridLayout() {
    const layout = getCurrentGridLayout();
    await idb.set('ios_theme_layout', layout);
}

// --- 数据保存逻辑 ---
// --- 新版小组件保存逻辑 ---
async function saveNewWidgetData() {
    // 【修复】：增加安全检查，如果当前页面没有小组件元素，直接跳过保存，防止报错清空数据
    const label1El = document.getElementById('label1');
    if (!label1El) return; 
    
    const mainWidget = document.getElementById('mainWidget');

    const data = {
        isVisible: mainWidget ? mainWidget.style.display !== 'none' : true,
        position: mainWidget ? {
            top: mainWidget.style.top,
            left: mainWidget.style.left,
            transform: mainWidget.style.transform
        } : null,
        label1: label1El.innerText,
        label2: document.getElementById('label2') ? document.getElementById('label2').innerText : '',
        // 【已删除 widgetSong 和 widgetLyric 的保存逻辑】
        bubble1: document.getElementById('bubble1') ? document.getElementById('bubble1').innerText : '',
        bubble2: document.getElementById('bubble2') ? document.getElementById('bubble2').innerText : '',
        bubble3: document.getElementById('bubble3') ? document.getElementById('bubble3').innerText : '',
        
        avatar1: document.getElementById('avatar1') ? document.getElementById('avatar1').style.backgroundImage.slice(5, -2).replace(/"/g, "") : '',
        avatar2: document.getElementById('avatar2') ? document.getElementById('avatar2').style.backgroundImage.slice(5, -2).replace(/"/g, "") : '',
        picture1: document.getElementById('picture1') ? document.getElementById('picture1').style.backgroundImage.slice(5, -2).replace(/"/g, "") : ''
    };
    await idb.set('ios_theme_widget', data);
}

// --- 新版小组件文字编辑逻辑 (弹窗输入，绝对有效) ---
function editNewWidgetText(elementId, title) {
    const el = document.getElementById(elementId);
    if (!el) return;
    openTextEditModal(title, "请输入新的文字内容", el.innerText, (val) => {
        if (val !== null && val.trim() !== "") {
            el.innerText = val;
            saveNewWidgetData();
        }
    });
}

// --- 新版小组件图片上传逻辑 ---
function handleNewWidgetUpload(input, targetId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const target = document.getElementById(targetId);
            target.style.backgroundImage = `url('${e.target.result}')`;
            target.innerHTML = ''; // 清除占位文字
            saveNewWidgetData(); // 上传完自动保存
        };
        reader.readAsDataURL(file);
    }
    input.value = ''; // 清空 input
}

async function saveAppleData() {
    const data = {
        avatar: document.getElementById('appleIdAvatar').style.backgroundImage,
        name: document.getElementById('appleIdName').innerText
    };
    await idb.set('ios_theme_apple', data);
}

async function saveWorldbookData() {
    await idb.set('ios_theme_wb_entries', JSON.stringify(worldbookEntries));
    await idb.set('ios_theme_wb_groups', JSON.stringify(worldbookGroups));
}

async function saveThemeSettings() {
    let fUrl = document.getElementById('fontUrlInput').value;
    if (fUrl === '已加载本地字体 (Local Font)') {
        fUrl = window.currentLoadedFontUrl;
    } else {
        window.currentLoadedFontUrl = fUrl;
    }
    const data = {
        wallpaper: document.getElementById('mainScreen').style.backgroundImage,
        fontSize: document.getElementById('fontSizeSlider').value,
        fontUrl: fUrl
    };
    await idb.set('ios_theme_settings', data);
}

async function saveAppsData() {
    const apps = [];
    for (let i = 0; i < totalApps; i++) {
        const iconElem = document.getElementById(`icon-${i}`);
        let bg = window.getComputedStyle(iconElem).backgroundImage;
        if (bg === 'none') bg = '';
        apps.push({
            id: i,
            name: document.getElementById(`name-${i}`).innerText,
            iconBg: bg
        });
    }
    await idb.set('ios_theme_apps', JSON.stringify(apps));
}

async function savePresetsData() {
    const data = {
        icons: iconPresets,
        fonts: fontPresets,
        wallpapers: wallpaperPresets,
        apis: apiPresets
    };
    await idb.set('ios_theme_presets', data);
}

// --- Apple ID 交互 ---
function openAppleIdSettings() { document.getElementById('appleIdSettingsModal').classList.add('open'); }
function closeAppleIdSettings() { document.getElementById('appleIdSettingsModal').classList.remove('open'); }

// --- 隐私与安全 交互 (新增) ---
function openPrivacySettings() {
    checkNewDay(); // 每次打开检查是否需要清零
    document.getElementById('privacySettingsModal').classList.add('open');
    updatePrivacyUI();
    requestMotionPermission();
    fetchLocation();
}

function closePrivacySettings() {
    document.getElementById('privacySettingsModal').classList.remove('open');
}

function updatePrivacyUI() {
    document.getElementById('privacyStepCount').innerText = `${privacyStepCount} 步`;
    const distance = (privacyStepCount * 0.7 / 1000).toFixed(2); // 假设每步 0.7 米
    document.getElementById('privacyDistance').innerText = `${distance} km`;
}

function requestMotionPermission() {
    if (isMotionListenerAdded) return;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        // iOS 13+ 需要用户点击触发授权
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('devicemotion', handleMotion);
                    isMotionListenerAdded = true;
                } else {
                    alert("需要允许运动与健身权限才能记录步数");
                }
            })
            .catch(console.error);
    } else {
        // 安卓或旧版 iOS 直接监听
        window.addEventListener('devicemotion', handleMotion);
        isMotionListenerAdded = true;
    }
}

function handleMotion(event) {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    
    // 计算三轴加速度的矢量幅度 (重力约为 9.8)
    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const curTime = Date.now();
    
    // 当幅度大于 11.5 (表示有明显的走动震动)，且距离上次计步超过 300ms (防抖)
    if (magnitude > 11.5 && (curTime - privacyLastMotionTime) > 300) {
        checkNewDay();
        privacyStepCount++;
        localStorage.setItem('ios_theme_steps', privacyStepCount);
        updatePrivacyUI();
        privacyLastMotionTime = curTime;
    }
}

// 新增全局变量用于存储地图实例
let privacyMapInstance = null;
let privacyMapMarker = null;

function fetchLocation() {
    const locEl = document.getElementById('privacyLocation');
    locEl.innerText = "高精度定位中...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            try {
                // 使用 OpenStreetMap 获取中文高精度地址
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'zh-CN' }
                });
                const data = await res.json();
                
                // 提取精简的街道地址
                let address = data.display_name;
                if (data.address) {
                    const a = data.address;
                    address = `${a.city || a.town || a.province || ''} ${a.suburb || a.county || ''} ${a.road || ''}`.trim();
                    if (!address) address = data.display_name;
                }
                
                locEl.innerText = address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

                // --- 修复：在这里真正渲染 Leaflet 地图 ---
                if (typeof L !== 'undefined') {
                    if (!privacyMapInstance) {
                        // 首次初始化地图
                        privacyMapInstance = L.map('privacyMap').setView([lat, lon], 16);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap'
                        }).addTo(privacyMapInstance);
                        privacyMapMarker = L.marker([lat, lon]).addTo(privacyMapInstance);
                    } else {
                        // 更新已有地图位置
                        privacyMapInstance.setView([lat, lon], 16);
                        privacyMapMarker.setLatLng([lat, lon]);
                    }
                    // 解决在隐藏弹窗中初始化导致地图显示不全的 Bug
                    setTimeout(() => { privacyMapInstance.invalidateSize(); }, 300);
                }

            } catch (e) {
                locEl.innerText = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        }, (err) => {
            locEl.innerText = "定位失败或未授权";
        }, {
            enableHighAccuracy: true, // 开启高精度 GPS
            timeout: 10000,
            maximumAge: 0
        });
    } else {
        locEl.innerText = "设备不支持定位";
    }
}
// 存储分析弹窗逻辑
function openStorageAnalysis() { document.getElementById('storageModalOverlay').classList.add('active'); analyzeStorage(); }
function closeStorageModal() { document.getElementById('storageModalOverlay').classList.remove('active'); }

async function analyzeStorage() {
    const keys = {
        '世界书': ['ios_theme_wb_entries', 'ios_theme_wb_groups'],
        '图片/媒体': ['ios_theme_widget', 'ios_theme_apple', 'ios_theme_apps'],
        '预设库': ['ios_theme_presets'],
        '系统设置': ['ios_theme_settings', 'ios_theme_api_config', 'ios_theme_layout']
    };
    const colors = { '世界书': '#007aff', '图片/媒体': '#ff9500', '预设库': '#34c759', '系统设置': '#8e8e93' };
    let usage = {};
    let totalBytes = 0;

    for (let category in keys) {
        usage[category] = 0;
        for (let key of keys[category]) {
            const val = await idb.get(key);
            if (val) {
                const str = typeof val === 'string' ? val : JSON.stringify(val);
                usage[category] += str.length;
            }
        }
        totalBytes += usage[category];
    }

    const canvas = document.getElementById('storageChart');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 140;
    const lineWidth = 40;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    let startAngle = 0;
    if (totalBytes === 0) {
        ctx.beginPath(); ctx.strokeStyle = '#e5e5ea'; ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI); ctx.stroke();
    } else {
        for (let category in usage) {
            if (usage[category] > 0) {
                const sliceAngle = (usage[category] / totalBytes) * 2 * Math.PI;
                ctx.beginPath(); ctx.strokeStyle = colors[category]; ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle); ctx.stroke();
                startAngle += sliceAngle;
            }
        }
    }

    const totalKB = (totalBytes / 1024).toFixed(2);
    document.getElementById('storageTotal').innerText = totalKB + ' KB';
    const legend = document.getElementById('storageLegend');
    legend.innerHTML = '';
    for (let category in usage) {
        const kb = (usage[category] / 1024).toFixed(2);
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<div class="legend-color" style="background:${colors[category]}"></div><div class="legend-name">${category}</div><div class="legend-value">${kb} KB</div>`;
        legend.appendChild(item);
    }
}

// --- 仅导出桌面美化 (Theme Only) // --- 仅导出桌面美化 (Theme Only) ---
async function exportThemeOnly() {
    const data = {};
    const themeKeys = [
        'ios_theme_settings', // 壁纸、字体
        'ios_theme_widget',   // 小组件
        'ios_theme_apps',     // 图标布局
        'ios_theme_presets',  // 预设
        'ios_theme_apple',    // Apple ID 头像
        'ios_theme_layout'    // 桌面布局
    ];

    for (let key of themeKeys) {
        let val = await idb.get(key);
        // 【修复】：剔除 API 预设，防止泄露给别人
        if (key === 'ios_theme_presets' && val) {
            val = { ...val };
            delete val.apis;
        }
        data[key] = val;
    }

    const exportObj = { signature: 'ios_theme_studio_theme_only', timestamp: Date.now(), data: data };
    const blob = new Blob([JSON.stringify(exportObj)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    let defaultName = `theme_backup_${new Date().toISOString().slice(0,10)}`;
    let fileName = prompt("请输入备份文件名称：", defaultName);
    if (fileName === null) return; // 用户点击取消，中止下载
    fileName = fileName.trim() || defaultName; // 如果输入为空，使用默认名
    
    a.href = url; a.download = `${fileName}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function importThemeOnly(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (json.signature !== 'ios_theme_studio_theme_only') {
                return alert("导入失败：这不是有效的桌面美化备份文件。");
            }
            
            if (confirm("这将覆盖当前的桌面壁纸、图标和小组件设置，确定要恢复吗？")) {
                const data = json.data;
                for (let key in data) {
                    // 【修复】：导入预设时，保留本地原有的 API 预设
                    if (key === 'ios_theme_presets') {
                        const localPresets = await idb.get('ios_theme_presets') || {};
                        const importedPresets = data[key] || {};
                        importedPresets.apis = localPresets.apis || [];
                        await idb.set(key, importedPresets);
                    } else {
                        await idb.set(key, data[key]);
                    }
                }
                alert("桌面美化恢复成功，页面将刷新。");
                location.reload();
            }
        } catch (err) { 
            console.error(err);
            alert("导入失败：文件损坏或处理错误。"); 
        }
    };
    reader.readAsText(file);
    input.value = '';
}    

// --- 全局备份 (包含 WeChat) ---
async function exportAllData() {
    try {
        const data = {};
        
        // 1. 导出 Theme Studio 数据
        const keys = await idb.getAllKeys();
        for (let key of keys) {
            if (key.startsWith('ios_theme_')) {
                data[key] = await idb.get(key);
            }
        }

        // 2. 导出 WeChat 数据
        const wechatData = {};
        if (wcDb.instance) {
            const persistentCharactersSnapshot = await wcReadCharactersPersistentSnapshot();
            const dbCharacters = await wcDb.getAll('characters');
            const charsUpdatedAt = await wcDb.get('kv_store', 'characters_updated_at');
            const shouldUseSnapshotCharacters = persistentCharactersSnapshot.characters.length > 0 && (
                !Array.isArray(dbCharacters) || dbCharacters.length === 0 ||
                persistentCharactersSnapshot.updatedAt >= (Number(charsUpdatedAt) || 0) ||
                persistentCharactersSnapshot.characters.length > dbCharacters.length
            );

            wechatData.user = await wcDb.get('kv_store', 'user');
            wechatData.wallet = await wcDb.get('kv_store', 'wallet');
            wechatData.stickerCategories = await wcDb.get('kv_store', 'sticker_categories');
            wechatData.cssPresets = await wcDb.get('kv_store', 'css_presets');
            wechatData.chatBgPresets = await wcDb.get('kv_store', 'chat_bg_presets');
            wechatData.phonePresets = await wcDb.get('kv_store', 'phone_presets');
            wechatData.shopData = await wcDb.get('kv_store', 'shop_data');
            wechatData.characters = shouldUseSnapshotCharacters ? persistentCharactersSnapshot.characters : (dbCharacters || []);
            wechatData.masks = await wcDb.getAll('masks');
            wechatData.moments = await wcDb.getAll('moments');
            
            const allChats = await wcDb.getAll('chats');
            const chatsObj = {};
            if (allChats) {
                allChats.forEach(item => {
                    chatsObj[item.charId] = item.messages;
                });
            }
            wechatData.chats = chatsObj;
        }
        
        data['wechat_backup'] = wechatData;

        // 3. 导出恋人空间数据
        data['ls_data'] = await idb.get('ls_data');

        // 4. 导出音乐数据 (APP3)
        data['ins_music_data'] = await idb.get('ins_music_data');

        // 5. 导出梦境数据
        data['dream_space_data'] = await idb.get('dream_space_data');
        // 6. 导出论坛数据
        data['ins_forum_data'] = await idb.get('ins_forum_data');

        const exportObj = { signature: 'ios_theme_studio_full_backup', timestamp: Date.now(), data: data };
        
        let jsonString;
        try {
            jsonString = JSON.stringify(exportObj);
        } catch (err) {
            throw new Error("数据量过大，请尝试清理部分聊天记录或图片后再备份。");
        }

        const blob = new Blob([jsonString], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        let defaultName = `full_backup_${new Date().toISOString().slice(0,10)}`;
        let fileName = prompt("请输入备份文件名称：", defaultName);
        if (fileName === null) return false; // 【修改】：返回 false 告诉系统取消了
        fileName = fileName.trim() || defaultName; 
        
        a.href = url; a.download = `${fileName}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        
        return true; // 【新增】：告诉系统备份成功
    } catch (error) {
        console.error("全局备份失败:", error);
        alert("全局备份失败: " + error.message);
    }
}

function importAllData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const json = JSON.parse(e.target.result);
            // 兼容旧版备份签名
            if (json.signature !== 'ios_theme_studio_backup' && json.signature !== 'ios_theme_studio_full_backup') {
                return alert("导入失败：文件格式不正确。");
            }
            
            if (confirm("这将覆盖当前所有数据（包括聊天记录、音乐歌单、梦境等），确定要恢复吗？")) {
                const data = json.data;
                
                // 1. 恢复 Theme Studio 数据
                for (let key in data) {
                    if (key !== 'wechat_backup' && key !== 'ls_data' && key !== 'ins_music_data' && key !== 'dream_space_data') {
                        await idb.set(key, data[key]);
                    }
                }

                // 2. 恢复 WeChat 数据 (如果存在)
                if (data['wechat_backup']) {
                    const wd = data['wechat_backup'];
                    const importedCharacters = Array.isArray(wd.characters) ? wd.characters : [];
                    const charactersUpdatedAt = Date.now();

                    if (wd.user) await wcDb.put('kv_store', wd.user, 'user');
                    if (wd.wallet) await wcDb.put('kv_store', wd.wallet, 'wallet');
                    if (wd.stickerCategories) await wcDb.put('kv_store', wd.stickerCategories, 'sticker_categories');
                    if (wd.cssPresets) await wcDb.put('kv_store', wd.cssPresets, 'css_presets');
                    if (wd.chatBgPresets) await wcDb.put('kv_store', wd.chatBgPresets, 'chat_bg_presets'); // 新增
                    if (wd.phonePresets) await wcDb.put('kv_store', wd.phonePresets, 'phone_presets'); // 新增
                    if (wd.shopData) await wcDb.put('kv_store', wd.shopData, 'shop_data'); // 新增购物数据
                    
                    // 清空旧表并写入新数据
                    const stores = ['characters', 'masks', 'moments', 'chats'];
                    for (const store of stores) {
                        await wcClearStore(store);
                    }

                    for (const c of importedCharacters) await wcDb.put('characters', c);
                    if (wd.masks) for (const m of wd.masks) await wcDb.put('masks', m);                 
                    if (wd.moments) for (const m of wd.moments) await wcDb.put('moments', m);
                    if (wd.chats) {
                        for (const charId in wd.chats) {
                            const parsedId = parseInt(charId);
                            if (!isNaN(parsedId)) {
                                await wcDb.put('chats', { charId: parsedId, messages: wd.chats[charId] }).catch(e => console.warn(e));
                            }
                        }
                    }

                    await wcSyncCharactersSnapshotFromList(importedCharacters, charactersUpdatedAt);
                }

                // 3. 恢复恋人空间数据
                if (data['ls_data']) {
                    await idb.set('ls_data', data['ls_data']);
                }

                // 4. 恢复音乐数据 (APP3)
                if (data['ins_music_data']) {
                    await idb.set('ins_music_data', data['ins_music_data']);
                }

                // 5. 恢复梦境数据
                if (data['dream_space_data']) {
                    await idb.set('dream_space_data', data['dream_space_data']);
                }
                // 6. 恢复论坛数据
                if (data['ins_forum_data']) {
                    await idb.set('ins_forum_data', data['ins_forum_data']);
                }

                alert("数据恢复成功，页面将刷新。");
                location.reload();
            }
        } catch (err) { 
            console.error(err);
            alert("导入失败：文件损坏或处理错误。"); 
        }
    };
    reader.readAsText(file);
    input.value = '';
}
// ==========================================
// 新增：清空所有数据逻辑 (极简 iOS 黑白高级感弹窗)
// ==========================================
function clearAllData() {
    // 1. 动态创建高级感黑白弹窗
    const existing = document.getElementById('ios-bw-confirm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ios-bw-confirm-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
        zIndex: '99999', display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: '0', transition: 'opacity 0.25s ease'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        width: '270px', backgroundColor: '#FFFFFF', borderRadius: '14px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: 'scale(0.95)', transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
    });

    const contentWrap = document.createElement('div');
    Object.assign(contentWrap.style, { padding: '22px 16px', textAlign: 'center' });

    const titleEl = document.createElement('div');
    titleEl.innerText = '清空所有数据';
    Object.assign(titleEl.style, {
        fontSize: '17px', fontWeight: '600', color: '#000000', marginBottom: '8px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
    });

    const msgEl = document.createElement('div');
    msgEl.innerText = '此操作将永久销毁所有数据(宝宝你确定要清除所有数据吗)，且不可恢复。确定要继续吗？';
    Object.assign(msgEl.style, {
        fontSize: '13px', lineHeight: '1.4', color: '#333333',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
    });

    contentWrap.appendChild(titleEl);
    contentWrap.appendChild(msgEl);

    const btnWrap = document.createElement('div');
    Object.assign(btnWrap.style, { display: 'flex', borderTop: '0.5px solid #E5E5EA', height: '44px' });

    const cancelBtn = document.createElement('div');
    cancelBtn.innerText = '取消';
    Object.assign(cancelBtn.style, {
        flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '17px', color: '#8E8E93', borderRight: '0.5px solid #E5E5EA', cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
    });

    const confirmBtn = document.createElement('div');
    confirmBtn.innerText = '确认清空';
    Object.assign(confirmBtn.style, {
        flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '17px', fontWeight: '600', color: '#000000', cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
    });

    btnWrap.appendChild(cancelBtn);
    btnWrap.appendChild(confirmBtn);
    box.appendChild(contentWrap);
    box.appendChild(btnWrap);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 触发动画
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
    });

    // 2. 绑定事件
    const closePopup = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'scale(0.95)';
        setTimeout(() => overlay.remove(), 250);
    };

    cancelBtn.onclick = closePopup;

    confirmBtn.onclick = async () => {
        closePopup();
        try {
            // 1. 【新增】：在执行毁灭性清空前，先备份所有的授权核心数据 (白名单)
            const authData = {
                fallback: localStorage.getItem('ios_theme_activation_v2_fallback'),
                qq: localStorage.getItem('current_bound_qq'),
                code: localStorage.getItem('current_activation_code'),
                deviceId: localStorage.getItem('ios_theme_device_id')
            };
            // 备份 IndexedDB 里的深层激活状态
            const idbAuthStatus = await idb.get('ios_theme_activation_v2_status');

            // 2. 执行清空逻辑 (清空业务数据)
            await idb.clear();
            if (typeof wcDb !== 'undefined' && wcDb.instance) {
                const stores = ['kv_store', 'characters', 'chats', 'moments', 'masks'];
                for (const store of stores) {
                    await wcClearStore(store);
                }
            }
            if (typeof wcClearCharactersPersistentSnapshot === 'function') {
                await wcClearCharactersPersistentSnapshot();
            }
            
            // 3. 清空 localStorage
            localStorage.clear();

            // 4. 【新增】：将备份的授权核心数据原封不动地恢复回去！
            if (authData.fallback) localStorage.setItem('ios_theme_activation_v2_fallback', authData.fallback);
            if (authData.qq) localStorage.setItem('current_bound_qq', authData.qq);
            if (authData.code) localStorage.setItem('current_activation_code', authData.code);
            if (authData.deviceId) localStorage.setItem('ios_theme_device_id', authData.deviceId);
            
            // 恢复 IndexedDB 里的深层激活状态
            if (idbAuthStatus) {
                await idb.set('ios_theme_activation_v2_status', idbAuthStatus);
            }

            // 贯彻高级感：不弹原生 alert，直接让整个页面优雅淡出并刷新
            document.body.style.transition = 'opacity 0.6s ease';
            document.body.style.opacity = '0';
            setTimeout(() => { location.reload(); }, 600);

        } catch (error) {
            console.error("清空失败:", error);
            alert("清空失败: " + error.message);
        }
    };
}
function triggerWidgetBgUpload() { document.getElementById('widgetBgInput').click(); }
function handleWidgetBgUpload(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { 
            document.getElementById('mainWidget').style.backgroundImage = `url('${e.target.result}')`; 
            saveWidgetData(); 
        };
        reader.readAsDataURL(file);
    }
}
function triggerAvatarUpload() { document.getElementById('widgetAvatarInput').click(); }
function handleWidgetAvatarUpload(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { 
            const avatar = document.getElementById('widgetAvatar');
            avatar.style.backgroundImage = `url('${e.target.result}')`; 
            avatar.style.backgroundSize = 'cover';
            saveWidgetData(); 
        };
        reader.readAsDataURL(file);
    }
}
function editWidgetText() {
    openTextEditModal("编辑 ID", "请输入要显示的 ID", document.getElementById('widgetText').innerText, (val) => {
        if(val) {
            document.getElementById('widgetText').innerText = val;
            saveWidgetData(); 
        }
    });
}

// --- Apple ID 交互 ---
function triggerAppleAvatarUpload() { document.getElementById('appleAvatarInput').click(); }
function handleAppleAvatarUpload(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { 
            const bg = `url('${e.target.result}')`;
            document.getElementById('appleIdAvatar').style.backgroundImage = bg; 
            document.getElementById('appleIdAvatar').innerText = ''; 
            document.getElementById('appleIdAvatar').style.backgroundSize = 'cover';
            document.getElementById('appleIdDetailAvatar').style.backgroundImage = bg;
            document.getElementById('appleIdDetailAvatar').innerText = '';
            document.getElementById('appleIdDetailAvatar').style.backgroundSize = 'cover';
            saveAppleData(); 
        };
        reader.readAsDataURL(file);
    }
}
function editAppleIdText() {
    const nameElem = document.getElementById('appleIdName');
    openTextEditModal("编辑 Apple ID", "请输入显示的名称", nameElem.innerText, (val) => {
        if(val) {
            nameElem.innerText = val;
            document.getElementById('appleIdDetailName').innerText = val;
            saveAppleData(); 
        }
    });
}

// --- 恢复默认 ---
function resetWallpaper() {
    document.getElementById('mainScreen').style.backgroundImage = '';
    document.getElementById('bgUrlInput').value = '';
    saveThemeSettings(); 
}

// 👇 新增：恢复默认字体函数 (无弹窗) 👇
function resetFonts() {
    // 1. 清空全局字体样式
    const style = document.getElementById('dynamic-font-style');
    if (style) style.textContent = '';
    
    // 2. 清空预览卡片字体样式
    const previewStyle = document.getElementById('preview-font-style');
    if (previewStyle) previewStyle.textContent = '';
    
    // 3. 清空 URL 输入框
    const urlInput = document.getElementById('fontUrlInput');
    if (urlInput) urlInput.value = '';
    window.currentLoadedFontUrl = '';
    
    // 4. 恢复默认字体大小 (11px)
    const sizeSlider = document.getElementById('fontSizeSlider');
    if (sizeSlider) sizeSlider.value = 11;
    changeFontSize(11);
    
    // 5. 保存设置
    saveThemeSettings();
    alert("已恢复默认字体！");
}
// 👆 新增结束 👆

function resetIcons() {
    // 👇 新增：弹出确认提示框
    if (!confirm("确定要恢复所有默认图标和名称吗？")) return;
    
    // 补全了第10个APP：阅读
    const defaultNames = ['App 1', 'App 2', 'App 3', 'App 4', 'Theme', 'Settings', '世界书', 'Wish', '短信', '阅读'];
    for (let i = 0; i < totalApps; i++) {
        const iconDiv = document.getElementById(`icon-${i}`);
        const nameDiv = document.getElementById(`name-${i}`);
        iconDiv.style.backgroundImage = '';
        iconDiv.style.backgroundColor = '#f0f0f0';
        nameDiv.innerText = defaultNames[i];
    }
    renderAppEditors();
    saveAppsData();
}

// --- 网格与拖拽 ---
function initGrid() {
    const grid1 = document.getElementById('homeGrid');
    const grid2 = document.getElementById('homeGrid2');
    if (!grid1 || !grid2) return; 

    // 为第一页生成空位 (索引 12-27)
    for (let i = 12; i < 28; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;
        grid1.appendChild(cell);
    }
    // 为第二页生成空位 (索引 28-55)
    for (let i = 28; i < 56; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;
        grid2.appendChild(cell);
    }

    const appsData = [
        // Chat: 实心气泡 + 内部镂空省略号
        { id: 'app-0', iconId: 'icon-0', nameId: 'name-0', name: 'Chat', svg: '<svg class="default-icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 5.92 2 10.75c0 2.7 1.56 5.08 3.96 6.54L4.5 22l4.66-2.33A11.1 11.1 0 0 0 12 19.5c5.52 0 10-3.92 10-8.75S17.52 2 12 2zm-3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>' },
        // Space: 实心爱心 + 内部镂空闪耀星光
        { id: 'app-1', iconId: 'icon-1', nameId: 'name-1', name: 'Space', svg: '<svg class="default-icon-svg" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/><path fill="#FFF" d="M16 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>' },
        // Music: 实心黑胶唱片 + 内部精细镂空
        { id: 'app-2', iconId: 'icon-2', nameId: 'name-2', name: 'Music', svg: '<svg class="default-icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z"/><circle cx="12" cy="12" r="1.5" fill="#FFF"/></svg>' },
        // Forum: 实心星球/社区 + 内部镂空纹理
        { id: 'app-3', iconId: 'icon-3', nameId: 'name-3', name: 'Forum', svg: '<svg class="default-icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' },
        // 👇 新增：App 7 (Wish & To-Do) 放在网格的第 5 个位置
        { id: 'app-7', iconId: 'icon-7', nameId: 'name-7', name: 'Wish', svg: '<svg class="default-icon-svg" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' },
        // 👇 新增：App 8 (短信 iMessage) 放在第二页第二个格子
        { id: 'app-8', iconId: 'icon-8', nameId: 'name-8', name: '短信', svg: '<svg class="default-icon-svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/></svg>' },
        // 👇 新增：App 9 (阅读App) 放在第二页
        { id: 'app-9', iconId: 'icon-9', nameId: 'name-9', name: '阅读', svg: '<svg class="default-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>' }
    ];
    const cells1 = Array.from(grid1.children).slice(1); // 第一页的格子 (避开小组件)
    const cells2 = Array.from(grid2.children); // 第二页的格子

    appsData.forEach((data, index) => {
        const appDiv = document.createElement('div');
        appDiv.className = 'app-item';
        appDiv.id = data.id;
        appDiv.innerHTML = `<div class="app-icon" id="${data.iconId}">${data.svg}</div><div class="app-name" id="${data.nameId}">${data.name}</div>`;
        addDragListeners(appDiv);
        
        appDiv.addEventListener('click', (e) => {
            if (isHomeEditMode || isDragging) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (data.id === 'app-0') openWechat();
            if (data.id === 'app-1') openLoversSpace();
            if (data.id === 'app-2') openMusicApp(); 
            if (data.id === 'app-3') openForumApp(); 
            if (data.id === 'app-7') openWishApp();
            if (data.id === 'app-8') { if(typeof openSmsApp === 'function') openSmsApp(); } // 👈 绑定打开短信APP
            if (data.id === 'app-9') { if(typeof openReadingApp === 'function') openReadingApp(); } // 👈 绑定打开阅读APP
        });

        // 核心：前 7 个放第一页，Wish 和 短信 放第二页
        if (data.id === 'app-7') {
            if (cells2[0]) cells2[0].appendChild(appDiv);
        } else if (data.id === 'app-8') {
            if (cells2[1]) cells2[1].appendChild(appDiv); // 👈 放在第二页第二个格子
        } else if (data.id === 'app-9') {
            if (cells2[2]) cells2[2].appendChild(appDiv); // 👈 放在第二页第三个格子
        } else {
            if (cells1[index]) cells1[index].appendChild(appDiv);
        }
    });

    // 监听滑动更新小圆点
    const swiper = document.getElementById('homeSwiper');
    const dots = document.querySelectorAll('.page-dot');
    if (swiper && dots.length > 0) {
        swiper.addEventListener('scroll', () => {
            const pageIndex = Math.round(swiper.scrollLeft / window.innerWidth);
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === pageIndex);
            });
        });
    }
}

function addDragListeners(el) {
    el.addEventListener('touchstart', handleDragStart, { passive: false });
    el.addEventListener('touchmove', handleDragMove, { passive: false });
    el.addEventListener('touchend', handleDragEnd);
    el.addEventListener('mousedown', handleDragStart);
}

// --- 桌面编辑模式逻辑 (Home Screen Edit Mode) ---
function enterHomeEditMode() {
    isHomeEditMode = true;
    document.body.classList.add('edit-mode-active');
    document.getElementById('home-edit-bar').style.display = 'flex';
    
    // 👇 新增：进入编辑模式时隐藏底部的 Dock 栏
    const dock = document.querySelector('.dock-container');
    if (dock) dock.style.display = 'none';
    
    // 备份当前布局和位置，以便取消时恢复
    backupGridLayout = getCurrentGridLayout();
    backupWidgetPosition = { ...lsState.widgetData.position };
    
    if (navigator.vibrate) navigator.vibrate(50);
}

function saveHomeEdit() {
    isHomeEditMode = false;
    document.body.classList.remove('edit-mode-active');
    document.getElementById('home-edit-bar').style.display = 'none';
    
    // 👇 新增：退出编辑模式时恢复底部的 Dock 栏
    const dock = document.querySelector('.dock-container');
    if (dock) dock.style.display = 'flex';
    
    // 保存网格布局
    saveGridLayout();
    // 小组件位置在拖拽结束时已更新到 lsState，这里统一保存
    lsSaveData();
    saveCustomWidgetsData();
}

function cancelHomeEdit() {
    isHomeEditMode = false;
    document.body.classList.remove('edit-mode-active');
    document.getElementById('home-edit-bar').style.display = 'none';
    
    // 👇 新增：退出编辑模式时恢复底部的 Dock 栏
    const dock = document.querySelector('.dock-container');
    if (dock) dock.style.display = 'flex';
    
    // 恢复网格布局
    restoreGridLayout(backupGridLayout);
    
    // 恢复小组件位置
    lsState.widgetData.position = backupWidgetPosition;
    lsRenderWidget();
}

function getCurrentGridLayout() {
    // 获取所有页面的格子
    const cells = document.querySelectorAll('.home-grid .grid-cell');
    const layout = {};
    cells.forEach(cell => {
        const app = cell.querySelector('.app-item');
        if (app) layout[cell.dataset.index] = app.id;
    });
    return layout;
}

function handleDragStart(e) {
    if (e.target.closest('.settings-modal')) return;
    const touch = e.touches ? e.touches[0] : e;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    const targetApp = e.currentTarget;

    if (!isHomeEditMode) {
        // 非编辑模式下，长按进入编辑模式
        longPressTimer = setTimeout(() => {
            enterHomeEditMode();
        }, 500);
    } else {
        // 编辑模式下，按下即开始拖拽
        isDragging = true;
        dragItem = targetApp;
        dragGhost = targetApp.cloneNode(true);
        dragGhost.classList.add('app-ghost');
        document.body.appendChild(dragGhost);
        updateGhostPosition(touch.clientX, touch.clientY);
        targetApp.classList.add('dragging');
        if (navigator.vibrate) navigator.vibrate(50);
    }
}

// 新增全局变量用于控制翻页防抖
let edgeScrollTimer = null;

function handleDragMove(e) {
    const touch = e.touches ? e.touches[0] : e;
    
    if (!isHomeEditMode && !isDragging) {
        // 如果还没进入编辑模式，且移动距离过大，取消长按判定
        const moveX = Math.abs(touch.clientX - dragStartX);
        const moveY = Math.abs(touch.clientY - dragStartY);
        if (moveX > 10 || moveY > 10) {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
    } else if (isDragging) {
        if (e.cancelable) { e.preventDefault(); }
        updateGhostPosition(touch.clientX, touch.clientY);

        // 👇 核心修复 1：边缘检测，实现跨页拖拽自动翻页
        const edgeThreshold = 40; // 距离屏幕边缘 40px 触发翻页
        const swiper = document.getElementById('homeSwiper');
        if (swiper && !edgeScrollTimer) {
            if (touch.clientX < edgeThreshold) {
                // 靠近左边缘，向左翻页
                const targetScroll = Math.max(0, swiper.scrollLeft - window.innerWidth);
                swiper.scrollTo({ left: targetScroll, behavior: 'smooth' });
                edgeScrollTimer = setTimeout(() => { edgeScrollTimer = null; }, 800); // 冷却800ms防止连续乱翻
            } else if (touch.clientX > window.innerWidth - edgeThreshold) {
                // 靠近右边缘，向右翻页
                const targetScroll = Math.min(swiper.scrollWidth, swiper.scrollLeft + window.innerWidth);
                swiper.scrollTo({ left: targetScroll, behavior: 'smooth' });
                edgeScrollTimer = setTimeout(() => { edgeScrollTimer = null; }, 800);
            }
        }
    }
}

function handleDragEnd(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    if (isDragging && dragItem) {
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        dragGhost.style.display = 'none';
        
        // 👇 核心修复 2：增强网格碰撞检测，解决部分格子被透明元素遮挡不灵敏的问题
        let targetCell = null;
        
        // 方案 A：优先使用 elementFromPoint (速度快)
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elemBelow) {
            targetCell = elemBelow.closest('.grid-cell');
        }
        
        // 方案 B：兜底物理坐标碰撞检测 (无视任何透明遮挡物)
        if (!targetCell || targetCell.classList.contains('widget-item')) {
            const allCells = document.querySelectorAll('.grid-cell:not(.widget-item)');
            for (let cell of allCells) {
                const rect = cell.getBoundingClientRect();
                // 如果手指坐标落在这个格子的物理矩形范围内
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    targetCell = cell;
                    break;
                }
            }
        }
        
        if (targetCell && !targetCell.classList.contains('widget-item')) {
            const existingApp = targetCell.querySelector('.app-item');
            const originalCell = dragItem.parentElement;
            if (existingApp && existingApp !== dragItem) {
                originalCell.appendChild(existingApp);
                targetCell.appendChild(dragItem);
            } else {
                targetCell.appendChild(dragItem);
            }
        }
        
        dragItem.classList.remove('dragging');
        if (dragGhost) dragGhost.remove();
        dragGhost = null;
        dragItem = null;
        setTimeout(() => { isDragging = false; }, 50);
    }
    
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
}

document.addEventListener('mousedown', function(e) {
    if(e.target.closest('.app-item')) {
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }
});

function updateGhostPosition(x, y) {
    if (dragGhost) {
        dragGhost.style.left = (x - 35) + 'px';
        dragGhost.style.top = (y - 35) + 'px';
    }
}
// ==========================================
// 自定义桌面小组件导入与管理逻辑
// ==========================================
let customImportedWidgets = []; // 抽屉里已导入的
let customDesktopWidgets = [];  // 已经放到桌面的

async function saveCustomWidgetsData() {
    await idb.set('ios_custom_widgets', {
        imported: customImportedWidgets,
        desktop: customDesktopWidgets
    });
}

function openWidgetDrawer() {
    renderWidgetDrawerList();
    document.getElementById('widget-drawer-overlay').classList.add('active');
}

function closeWidgetDrawer(e) {
    if (e && e.target.id !== 'widget-drawer-overlay') return;
    document.getElementById('widget-drawer-overlay').classList.remove('active');
}

function renderWidgetDrawerList() {
    const list = document.getElementById('drawer-list');
    const importCard = list.firstElementChild; // 保留导入卡片
    list.innerHTML = '';
    list.appendChild(importCard);

    // 👇 内置的 4x3 日系小组件卡片 (带预览骨架)
    const builtinItem = document.createElement('div');
    builtinItem.className = 'drawer-item';
    builtinItem.innerHTML = `
        <div class="drawer-item-preview-wrapper" style="background: #E8F0FE;">
            <div style="font-size: 20px; color: #8AB4F8; font-weight: 900; letter-spacing: 2px;">4x3</div>
        </div>
        <div class="drawer-item-name">日系组件</div>
    `;
    builtinItem.onclick = () => {
        const mainWidget = document.getElementById('mainWidget');
        if (mainWidget) {
            mainWidget.style.display = 'flex';
            const swiper = document.getElementById('homeSwiper');
            const currentScroll = swiper ? swiper.scrollLeft : 0;
            const centerLeft = currentScroll + (window.innerWidth / 2) - (mainWidget.offsetWidth / 2);
            mainWidget.style.top = '50px';
            mainWidget.style.left = centerLeft + 'px';
            mainWidget.style.transform = 'none';
            saveNewWidgetData();
            closeWidgetDrawer();
        }
    };
    list.appendChild(builtinItem);

    // 👇 渲染导入的小组件 (带真实缩略图预览)
    customImportedWidgets.forEach(widget => {
        const item = document.createElement('div');
        item.className = 'drawer-item';
        
        // 提取背景色应用到预览框上
        const previewBg = widget.bgColor || 'transparent';

        item.innerHTML = `
            <div class="drawer-item-delete" onclick="deleteImportedWidget(event, ${widget.id})"></div>
            <div class="drawer-item-preview-wrapper" style="background: ${previewBg};">
                <div class="drawer-item-preview-content">
                    ${widget.content}
                </div>
            </div>
            <div class="drawer-item-name">${widget.name}</div>
        `;
        item.onclick = () => addWidgetToDesktop(widget);
        list.appendChild(item);
    });
}

function handleImportWidgetJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            // 简单的格式校验
            const newWidget = {
                id: Date.now(),
                name: json.name || '未命名组件',
                bgColor: json.bgColor || '#E2F0CB',
                content: json.content || '自定义内容'
            };
            customImportedWidgets.push(newWidget);
            saveCustomWidgetsData();
            renderWidgetDrawerList();
            alert("小组件导入成功！");
        } catch (err) {
            alert("导入失败：JSON 格式不正确");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function deleteImportedWidget(event, id) {
    event.stopPropagation();
    if (confirm("确定要删除这个导入的小组件吗？")) {
        customImportedWidgets = customImportedWidgets.filter(w => w.id !== id);
        saveCustomWidgetsData();
        renderWidgetDrawerList();
    }
}

function addWidgetToDesktop(widgetData) {
    const swiper = document.getElementById('homeSwiper');
    const currentScroll = swiper ? swiper.scrollLeft : 0;
    
    // 计算当前屏幕的中心点，加上滚动偏移量，确保小组件出现在当前页
    const centerLeft = currentScroll + (window.innerWidth / 2) - 170; // 170 是 4x4 小组件宽度(340)的一半

    const newInstance = {
        instanceId: Date.now() + Math.random(),
        widgetId: widgetData.id,
        name: widgetData.name,
        bgColor: widgetData.bgColor,
        content: widgetData.content,
        position: { top: '150px', left: centerLeft + 'px', transform: 'none' }
    };
    customDesktopWidgets.push(newInstance);
    saveCustomWidgetsData();
    renderDesktopWidgets();
    closeWidgetDrawer();
}

function removeWidgetFromDesktop(instanceId) {
    customDesktopWidgets = customDesktopWidgets.filter(w => w.instanceId !== instanceId);
    saveCustomWidgetsData();
    renderDesktopWidgets();
}

function renderDesktopWidgets() {
    const container = document.getElementById('desktop-custom-widgets-container');
    if (!container) return;
    container.innerHTML = '';

    customDesktopWidgets.forEach(widget => {
        const el = document.createElement('div');
        el.className = 'custom-desktop-widget';
        el.style.background = widget.bgColor;
        el.style.top = widget.position.top;
        el.style.left = widget.position.left;
        el.style.transform = widget.position.transform;
        
        // 👇 恢复魔法脚本修改过的外层样式（大小、透明度等）
        if (widget.customStyles) {
            if (widget.customStyles.width) el.style.width = widget.customStyles.width;
            if (widget.customStyles.height) el.style.height = widget.customStyles.height;
            if (widget.customStyles.background) el.style.background = widget.customStyles.background;
            if (widget.customStyles.border) el.style.border = widget.customStyles.border;
            if (widget.customStyles.boxShadow) el.style.boxShadow = widget.customStyles.boxShadow;
            if (widget.customStyles.backdropFilter) el.style.backdropFilter = widget.customStyles.backdropFilter;
        }
        
        el.innerHTML = `
            <div class="widget-remove-btn" onclick="removeWidgetFromDesktop(${widget.instanceId})"></div>
            <div class="content" style="width:100%; height:100%; padding:0;">${widget.content}</div>
        `;
        
        makeWidgetDraggable(el, widget.instanceId);
        observeWidgetChanges(el, widget.instanceId); // 👇 启动全自动静默保存监听
        container.appendChild(el);
    });
}

function makeWidgetDraggable(el, instanceId) {
    let isDragging = false, startX, startY, initialLeft, initialTop;

    el.addEventListener('mousedown', dragStart);
    el.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
        if (!isHomeEditMode) return;
        if (e.target.classList.contains('widget-remove-btn')) return;
        
        isDragging = true;
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        
        // 获取相对于 200vw 容器的绝对坐标
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;
        
        el.style.transform = 'none'; 
        el.style.left = initialLeft + 'px';
        el.style.top = initialTop + 'px';

        document.addEventListener('mousemove', dragMove);
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }

    function dragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.type === 'touchmove' ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        
        el.style.left = (initialLeft + dx) + 'px';
        el.style.top = (initialTop + dy) + 'px';

        // 边缘检测翻页逻辑：拖到屏幕边缘时自动翻页
        const edgeThreshold = 40;
        const swiper = document.getElementById('homeSwiper');
        if (swiper && !window.edgeScrollTimer) {
            if (touch.clientX < edgeThreshold) {
                const targetScroll = Math.max(0, swiper.scrollLeft - window.innerWidth);
                swiper.scrollTo({ left: targetScroll, behavior: 'smooth' });
                window.edgeScrollTimer = setTimeout(() => { window.edgeScrollTimer = null; }, 800);
            } else if (touch.clientX > window.innerWidth - edgeThreshold) {
                const targetScroll = Math.min(swiper.scrollWidth, swiper.scrollLeft + window.innerWidth);
                swiper.scrollTo({ left: targetScroll, behavior: 'smooth' });
                window.edgeScrollTimer = setTimeout(() => { window.edgeScrollTimer = null; }, 800);
            }
        }
    }

    function dragEnd() {
        if (isDragging) {
            isDragging = false;
            // 保存新位置
            const widget = customDesktopWidgets.find(w => w.instanceId === instanceId);
            if (widget) {
                widget.position = {
                    top: el.style.top,
                    left: el.style.left,
                    transform: 'none'
                };
            }
        }
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    }
}

// --- 界面交互 ---
function switchTab(tabName) {
    // 1. 隐藏所有内容页
    document.querySelectorAll('#settingsModal .tab-content').forEach(el => el.classList.remove('active'));
    
    // 2. 显示目标内容页
    document.getElementById('tab-' + tabName).classList.add('active');
    
    // 3. 更新菜单高亮状态 (移除所有 active，给当前点击的加上 active)
    document.querySelectorAll('.ts-ios-menu-items span').forEach(el => {
        el.classList.remove('active');
    });
    const activeMenu = document.getElementById('menu-' + tabName);
    if (activeMenu) {
        activeMenu.classList.add('active');
    }
}

function openSettings() {
    renderAppEditors();
    document.getElementById('settingsModal').classList.add('open');
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }
function openIOSSettings() { document.getElementById('iosSettingsModal').classList.add('open'); }
function closeIOSSettings() { document.getElementById('iosSettingsModal').classList.remove('open'); }
function openApiSettings() { document.getElementById('apiSettingsModal').classList.add('open'); }
function closeApiSettings() { document.getElementById('apiSettingsModal').classList.remove('open'); }
// --- API 设置逻辑 (主副双路 + 额度查询) ---
let currentApiTab = 'primary'; // 记录当前在哪个 Tab

function switchApiTab(tab) {
    currentApiTab = tab;
    document.getElementById('tab-btn-primary').classList.remove('active');
    document.getElementById('tab-btn-secondary').classList.remove('active');
    document.getElementById('api-tab-primary').classList.remove('active');
    document.getElementById('api-tab-secondary').classList.remove('active');

    document.getElementById('tab-btn-' + tab).classList.add('active');
    document.getElementById('api-tab-' + tab).classList.add('active');
    
    // 切换 Tab 时自动刷新一次额度
    refreshCurrentApiQuota();
}

// 核心：获取当前场景应该使用的 API 配置
async function getActiveApiConfig(scene = 'chat') {
    const fullConfig = await idb.get('ios_theme_api_config') || {};
    const primary = fullConfig.primary || { baseUrl: fullConfig.baseUrl, key: fullConfig.key, model: fullConfig.model, temp: fullConfig.temp }; // 兼容旧数据
    const secondary = fullConfig.secondary || {};
    const routes = fullConfig.routes || {};

    let useSecondary = false;
    if (scene === 'phone' && routes.phone) useSecondary = true;
    if (scene === 'npc' && routes.npc) useSecondary = true;
    if (scene === 'forum' && routes.forum) useSecondary = true;

    // 如果该场景开启了副 API，且副 API 填了地址和 Key，就用副 API，否则降级用主 API
    if (useSecondary && secondary.key && secondary.baseUrl) {
        return secondary;
    }
    return primary;
}

async function saveApiConfig() {
    const config = {
        primary: {
            baseUrl: document.getElementById('apiBaseUrl').value,
            key: document.getElementById('apiKey').value,
            temp: document.getElementById('tempSlider').value,
            model: document.getElementById('modelSelect').value
        },
        secondary: {
            baseUrl: document.getElementById('secApiBaseUrl').value,
            key: document.getElementById('secApiKey').value,
            temp: document.getElementById('secTempSlider').value,
            model: document.getElementById('secModelSelect').value
        },
        routes: {
            phone: document.getElementById('route-phone').checked,
            npc: document.getElementById('route-npc').checked,
            forum: document.getElementById('route-forum').checked
        }
    };
    await idb.set('ios_theme_api_config', config);
    alert("API 配置已保存！");
}
async function fetchModels(targetTab) {
    const isPrimary = targetTab === 'primary';
    const baseUrl = isPrimary ? document.getElementById('apiBaseUrl').value : document.getElementById('secApiBaseUrl').value;
    const key = isPrimary ? document.getElementById('apiKey').value : document.getElementById('secApiKey').value;
    const selectId = isPrimary ? 'modelSelect' : 'secModelSelect';
    const btnId = isPrimary ? 'fetchBtnPrimary' : 'fetchBtnSecondary';
    const searchId = isPrimary ? 'modelSearchPrimary' : 'modelSearchSecondary'; // 👈 新增
    
    if (!baseUrl || !key) return alert("请先填写 API 地址和密钥");
    
    const btn = document.getElementById(btnId);
    btn.innerText = "拉取中...";
    
    try {
        const res = await fetch(`${baseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        const data = await res.json();
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        
        if (data.data && Array.isArray(data.data)) {
            // 👇 新增：保存拉取到的模型列表并清空搜索框 👇
            if (isPrimary) {
                fetchedModelsPrimary = data.data.map(m => m.id);
            } else {
                fetchedModelsSecondary = data.data.map(m => m.id);
            }
            const searchInput = document.getElementById(searchId);
            if (searchInput) searchInput.value = '';
            // 👆 新增结束 👆

            data.data.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.innerText = m.id;
                select.appendChild(opt);
            });
            alert(`成功拉取 ${data.data.length} 个模型`);
        } else {
            alert("拉取失败：格式不正确");
        }
    } catch (e) {
        alert("拉取失败：" + e.message);
    } finally {
        btn.innerText = "拉取模型列表";
    }
}

// 👇 新增：在 fetchModels 函数下方添加过滤函数 👇
window.filterModels = function(targetTab) {
    const isPrimary = targetTab === 'primary';
    const searchId = isPrimary ? 'modelSearchPrimary' : 'modelSearchSecondary';
    const selectId = isPrimary ? 'modelSelect' : 'secModelSelect';
    const allModels = isPrimary ? fetchedModelsPrimary : fetchedModelsSecondary;
    
    const keyword = document.getElementById(searchId).value.toLowerCase();
    const select = document.getElementById(selectId);
    
    // 保存当前选中的值，以便过滤后尽量恢复
    const currentValue = select.value;
    
    select.innerHTML = '';
    
    if (allModels.length === 0) {
        // 如果还没拉取过，保留当前选项（可能是从本地存储加载的）
        if (currentValue) {
            const opt = document.createElement('option');
            opt.value = currentValue;
            opt.innerText = currentValue + " (已保存)";
            select.appendChild(opt);
        }
        return;
    }

    const filteredModels = allModels.filter(id => id.toLowerCase().includes(keyword));
    
    filteredModels.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = id;
        select.appendChild(opt);
    });
    
    // 尝试恢复之前的选中状态
    if (filteredModels.includes(currentValue)) {
        select.value = currentValue;
    }
};
// 👆 新增结束 👆

// 实时查询当前选中 Tab 的 API 额度
async function refreshCurrentApiQuota() {
    const quotaEl = document.getElementById('api-realtime-quota');
    if (!quotaEl) return;
    
    quotaEl.innerText = "查询中...";
    quotaEl.style.opacity = "0.5";

    try {
        const isPrimary = currentApiTab === 'primary';
        const baseUrl = isPrimary ? document.getElementById('apiBaseUrl').value : document.getElementById('secApiBaseUrl').value;
        const key = isPrimary ? document.getElementById('apiKey').value : document.getElementById('secApiKey').value;

        if (!key || !baseUrl) {
            throw new Error("未配置API");
        }

        const baseUrlMatch = baseUrl.match(/^(https?:\/\/[^\/]+)/);
        const host = baseUrlMatch ? baseUrlMatch[1] : baseUrl;

        const response = await fetch(`${host}/v1/dashboard/billing/subscription`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (!response.ok) throw new Error("接口不支持");

        const data = await response.json();
        let finalBalance = "未知";
        
        let rawValue = data.balance ?? data.remain_quota ?? data.total_available ?? data.quota;
        if (data.data) {
            rawValue = rawValue ?? data.data.balance ?? data.data.remain_quota ?? data.data.quota;
        }

        if (rawValue !== undefined && rawValue !== null) {
            let num = parseFloat(rawValue);
            if (num > 10000) {
                let calc50 = (num / 500000).toFixed(2);
                let calc10 = (num / 100000).toFixed(2);
                finalBalance = `${calc50} 或 ${calc10} (原数据:${num})`;
            } else {
                finalBalance = num.toFixed(2);
            }
        } else if (data.hard_limit_usd !== undefined) {
            let total_usage = 0;
            if (data.total_usage !== undefined) {
                total_usage = data.total_usage / 100;
            } else {
                try {
                    const now = new Date();
                    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const usageRes = await fetch(`${host}/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, {
                        headers: { 'Authorization': `Bearer ${key}` }
                    });
                    const usageData = await usageRes.json();
                    if (usageData.total_usage !== undefined) total_usage = usageData.total_usage / 100;
                } catch(e) {}
            }
            
            // 🌟 核心修改：如果是无限额度令牌，直接显示已消耗的金额！
            if (data.hard_limit_usd > 9000000) {
                finalBalance = `已用: $${total_usage.toFixed(4)} (无限额度令牌)`;
            } else {
                finalBalance = (data.hard_limit_usd - total_usage).toFixed(2);
            }
        }

        if (finalBalance !== "未知") {
            quotaEl.innerText = finalBalance;
            quotaEl.style.fontSize = "12px"; 
        } else {
            quotaEl.innerText = "格式不支持";
        }
    } catch (e) {
        quotaEl.innerText = "接口不支持";
    } finally {
        quotaEl.style.opacity = "1";
    }
}

function renderApiPresets() {
    const list = document.getElementById('apiPresetList');
    list.innerHTML = '';
    if (apiPresets.length === 0) {
        list.innerHTML = '<div style="color:#999; font-size:13px; padding:5px;">暂无预设</div>';
        return;
    }
    apiPresets.forEach((p, idx) => {
        const tag = document.createElement('div');
        tag.className = 'preset-tag';
        tag.innerHTML = `<span class="preset-name" onclick="applyApiPreset(${idx})">${p.name}</span><span class="preset-delete" onclick="deletePreset('api', ${idx})">×</span>`;
        list.appendChild(tag);
    });
}

function applyApiPreset(idx) {
    const p = apiPresets[idx];
    if (p) {
        const isPrimary = currentApiTab === 'primary';
        const urlId = isPrimary ? 'apiBaseUrl' : 'secApiBaseUrl';
        const keyId = isPrimary ? 'apiKey' : 'secApiKey';
        const tempId = isPrimary ? 'tempSlider' : 'secTempSlider';
        const tempDispId = isPrimary ? 'tempDisplay' : 'secTempDisplay';
        const selectId = isPrimary ? 'modelSelect' : 'secModelSelect';

        document.getElementById(urlId).value = p.baseUrl;
        document.getElementById(keyId).value = p.key;
        document.getElementById(tempId).value = p.temp;
        document.getElementById(tempDispId).innerText = p.temp;
        
        if (p.model) {
            const select = document.getElementById(selectId);
            let exists = false;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === p.model) {
                    exists = true; break;
                }
            }
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = p.model;
                opt.innerText = p.model + " (预设)";
                select.appendChild(opt);
            }
            select.value = p.model;
        }
        refreshCurrentApiQuota(); // 应用预设后自动查额度
    }
}


// --- 通用模态框逻辑 ---
function openNameModal(type) {
    pendingSaveType = type;
    document.getElementById('modalTitle').innerText = "保存预设";
    document.getElementById('modalDesc').innerText = "请输入预设名称";
    document.getElementById('modalInputContainer').classList.add('show');
    document.getElementById('modalInput').value = '';
    document.getElementById('modalConfirmBtn').onclick = confirmSavePreset;
    document.getElementById('modalOverlay').classList.add('active');
}

function openTextEditModal(title, desc, initialValue, callback) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalDesc').innerText = desc;
    document.getElementById('modalInputContainer').classList.add('show');
    document.getElementById('modalInput').value = initialValue || '';
    document.getElementById('modalConfirmBtn').onclick = () => {
        callback(document.getElementById('modalInput').value);
        closeModal();
    };
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

async function confirmSavePreset() {
    const name = document.getElementById('modalInput').value;
    if (!name) return alert("请输入名称");

    if (pendingSaveType === 'icon') {
        const currentIcons = [];
        for(let i=0; i<totalApps; i++) {
            currentIcons.push({
                id: i,
                name: document.getElementById(`name-${i}`).innerText,
                bg: document.getElementById(`icon-${i}`).style.backgroundImage
            });
        }
        iconPresets.push({ name, data: currentIcons });
        renderIconPresets();
    } else if (pendingSaveType === 'font') {
        fontPresets.push({
            name,
            url: document.getElementById('fontUrlInput').value,
            size: document.getElementById('fontSizeSlider').value
        });
        renderFontPresets();
        } else if (pendingSaveType === 'api') {
        const isPrimary = currentApiTab === 'primary';
        apiPresets.push({
            name,
            baseUrl: isPrimary ? document.getElementById('apiBaseUrl').value : document.getElementById('secApiBaseUrl').value,
            key: isPrimary ? document.getElementById('apiKey').value : document.getElementById('secApiKey').value,
            temp: isPrimary ? document.getElementById('tempSlider').value : document.getElementById('secTempSlider').value,
            model: isPrimary ? document.getElementById('modelSelect').value : document.getElementById('secModelSelect').value 
        });
        renderApiPresets();
    }
    
    savePresetsData();
    closeModal();
}

function deletePreset(type, idx) {
    if (!confirm("确定删除此预设吗？")) return;
    if (type === 'icon') {
        iconPresets.splice(idx, 1);
        renderIconPresets();
    } else if (type === 'font') {
        fontPresets.splice(idx, 1);
        renderFontPresets();
    } else if (type === 'api') {
        apiPresets.splice(idx, 1);
        renderApiPresets();
    }
    savePresetsData();
}
// ==========================================
// 🌟 INS 电脑视窗预设库逻辑 🌟
// ==========================================

// 记录编辑模式状态
let presetEditState = { icon: false, font: false };

// 切换编辑模式 (渐入删除按钮)
window.togglePresetEditMode = function(type) {
    presetEditState[type] = !presetEditState[type];
    const listId = type === 'icon' ? 'iconPresetList' : 'fontPresetList';
    const listEl = document.getElementById(listId);
    
    if (listEl) {
        if (presetEditState[type]) {
            listEl.classList.add('edit-mode');
        } else {
            listEl.classList.remove('edit-mode');
        }
    }
};

// 清空全部预设
window.clearAllPresets = function(type) {
    if (confirm("确定要清空所有预设吗？此操作不可恢复！")) {
        if (type === 'icon') {
            iconPresets = [];
            renderIconPresets();
        } else if (type === 'font') {
            fontPresets = [];
            renderFontPresets();
        }
        savePresetsData();
    }
};


function renderIconPresets() {
    const list = document.getElementById('iconPresetList');
    list.innerHTML = '';
    if (iconPresets.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px; font-style:italic;">No presets available.</div>';
        return;
    }
    iconPresets.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'ins-preset-item';
        item.onclick = () => {
            if (!presetEditState.icon) {
                applyIconPreset(idx);
                alert(`已应用图标预设: ${p.name}`);
            }
        };
        item.innerHTML = `
            <div class="ins-preset-name">${p.name}</div>
            <div class="ins-preset-delete" onclick="event.stopPropagation(); deletePreset('icon', ${idx});">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
        `;
        list.appendChild(item);
    });
}

function applyIconPreset(idx) {
    const p = iconPresets[idx];
    if (p && p.data) {
        p.data.forEach(app => {
            const nameEl = document.getElementById(`name-${app.id}`);
            const iconEl = document.getElementById(`icon-${app.id}`);
            if (nameEl) nameEl.innerText = app.name;
            if (iconEl) {
                iconEl.style.backgroundImage = app.bg;
                iconEl.style.backgroundColor = app.bg ? 'transparent' : '#f0f0f0';
            }
        });
        saveAppsData();
        renderAppEditors();
    }
}

function renderFontPresets() {
    const list = document.getElementById('fontPresetList');
    list.innerHTML = '';
    if (fontPresets.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px; font-style:italic;">No presets available.</div>';
        return;
    }
    fontPresets.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'ins-preset-item';
        item.onclick = () => {
            if (!presetEditState.font) {
                applyFontPreset(idx);
                alert(`已应用字体预设: ${p.name}`);
            }
        };
        item.innerHTML = `
            <div class="ins-preset-name">${p.name}</div>
            <div class="ins-preset-delete" onclick="event.stopPropagation(); deletePreset('font', ${idx});">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
        `;
        list.appendChild(item);
    });
}

function applyFontPreset(idx) {
    const p = fontPresets[idx];
    if (p) {
        document.getElementById('fontUrlInput').value = p.url;
        document.getElementById('fontSizeSlider').value = p.size;
        applyFont(p.url);
        changeFontSize(p.size);
    }
}

// --- 新增：本地字体上传逻辑 (无大小限制) ---
window.currentLoadedFontUrl = '';
function handleFontUpload(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Font = e.target.result;
            window.currentLoadedFontUrl = base64Font;
            document.getElementById('fontUrlInput').value = '已加载本地字体 (Local Font)';
            previewFont(base64Font);
            alert("本地字体已加载，请在上方卡片查看预览效果。确认无误后点击【应用到全局】。");
        };
        reader.readAsDataURL(file);
    }
    input.value = ''; // 清空 input，允许重复上传同一个文件
}

// 👇 新增：仅在预览卡片中生效的函数 👇
function previewFont(url) {
    let finalUrl = url;
    if (!finalUrl) {
        const inputVal = document.getElementById('fontUrlInput').value;
        finalUrl = (inputVal === '已加载本地字体 (Local Font)') ? window.currentLoadedFontUrl : inputVal;
    }
    let previewStyle = document.getElementById('preview-font-style');
    
    if (!previewStyle) {
        previewStyle = document.createElement('style');
        previewStyle.id = 'preview-font-style';
        document.head.appendChild(previewStyle);
    }
    
    if (finalUrl) {
        previewStyle.textContent = `
            @font-face { font-family: 'PreviewFont'; src: url('${finalUrl}'); } 
            #fontPreviewText { font-family: 'PreviewFont', sans-serif !important; }
        `;
    }
}

// 修改：点击“应用到全局”时才真正生效
window.applyFont = function(url) {
    let finalUrl = url;
    if (!finalUrl) {
        const inputVal = document.getElementById('fontUrlInput').value;
        finalUrl = (inputVal === '已加载本地字体 (Local Font)') ? window.currentLoadedFontUrl : inputVal;
    }
    
    const fontStyle = document.getElementById('dynamic-font-style');
    if (finalUrl && fontStyle) {
        fontStyle.textContent = `
            @font-face { font-family: 'CustomFont'; src: url('${finalUrl}'); } 
            body, input, textarea, button, select, 
            .ls-view, #wechat-root, #wc-view-phone-sim, .wc-page, .wc-bubble, 
            .ls-feed-text, .ls-widget-note-text, .wc-system-msg-text,
            .ins-forum-root, .ins-forum-view, .ins-forum-post-text, .ins-forum-story-text,
            .ins-forum-profile-name, .ins-forum-profile-bio, .ins-forum-comment-text { 
                font-family: 'CustomFont', sans-serif !important; 
            }
        `;
        window.currentLoadedFontUrl = finalUrl;
        saveThemeSettings();
        alert("字体已成功应用到全局！");
    } else {
        alert("请先输入字体 URL 或上传本地字体哦~");
    }
};

function changeFontSize(val) {
    // 1. 更新桌面图标的字体大小
    document.documentElement.style.setProperty('--app-font-size', val + 'px');
    document.getElementById('fontSizeDisplay').innerText = val + 'px';
    
    // 2. 计算缩放比例 (以默认的 11px 为基准)
    const scale = val / 11;
    
    // 👇 新增：动态更新预览卡片的字体大小 👇
    const previewText = document.getElementById('fontPreviewText');
    if (previewText) {
        // 基础大小设为 18px，跟随比例缩放
        previewText.style.fontSize = (18 * scale) + 'px';
    }
    // 👆 新增结束 👆
        
    // 3. 动态生成全局字体缩放样式
    let styleTag = document.getElementById('global-font-size-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'global-font-size-style';
        document.head.appendChild(styleTag);
    }
    
    // 覆盖所有核心文本区域的字体大小
    styleTag.innerHTML = `
        .wc-bubble { font-size: ${16 * scale}px !important; }
        .wc-moment-text { font-size: ${15 * scale}px !important; }
        .ins-forum-post-text { font-size: ${16 * scale}px !important; }
        .ins-forum-story-text { font-size: ${17 * scale}px !important; }
        .reader-content { font-size: ${20 * scale}px !important; }
        .dream-msg { font-size: ${15 * scale}px !important; }
        .dream-narrative-text { font-size: ${14 * scale}px !important; }
        .dream-dialogue-bubble { font-size: ${15 * scale}px !important; }
        .ls-feed-text { font-size: ${11 * scale}px !important; }
        .ls-widget-note-text { font-size: ${16 * scale}px !important; }
        .wb-item-desc { font-size: ${13 * scale}px !important; }
        .ins-paper-read-text { font-size: ${16 * scale}px !important; }
        .wc-item-subtitle { font-size: ${14 * scale}px !important; }
        .wc-item-title { font-size: ${16 * scale}px !important; }
        .forum-pm-bubble { font-size: ${15 * scale}px !important; }
        .ins-music-lyric-line { font-size: ${14 * scale}px !important; }
        .ins-music-lyric-line.active { font-size: ${16 * scale}px !important; }
        .desc-card-body { font-size: ${15 * scale}px !important; }
        .blocked-msg-text { font-size: ${14 * scale}px !important; }
        .ins-status-value { font-size: ${15 * scale}px !important; }
        .ins-timeline-content { font-size: ${13 * scale}px !important; }
        .rm-text-normal { font-size: ${14 * scale}px !important; }
        .rm-text-new { font-size: ${14 * scale}px !important; }
        .qa-question-text { font-size: ${16 * scale}px !important; }
        .qa-option { font-size: ${14 * scale}px !important; }
        .qa-archive-q-text { font-size: ${14 * scale}px !important; }
        .tarot-desc { font-size: ${12 * scale}px !important; }
        .book-name { font-size: ${13 * scale}px !important; }
        .chapter-item { font-size: ${14 * scale}px !important; }
        .wc-system-msg-text { font-size: ${12 * scale}px !important; }
        .ins-music-song-title { font-size: ${15 * scale}px !important; }
        .ins-music-song-artist { font-size: ${12 * scale}px !important; }
        .ins-music-fp-song { font-size: ${24 * scale}px !important; }
        .ins-music-fp-artist { font-size: ${15 * scale}px !important; }
        .ins-forum-comment-text { font-size: ${15 * scale}px !important; }
        .fav-text { font-size: ${14 * scale}px !important; }
    `;
    
    saveThemeSettings();
}

function renderAppEditors() {
    const list = document.getElementById('appEditorList');
    list.innerHTML = '';
    for (let i = 0; i < totalApps; i++) {
        const name = document.getElementById(`name-${i}`).innerText;
        const bg = document.getElementById(`icon-${i}`).style.backgroundImage;
        
        const div = document.createElement('div');
        div.className = 'app-edit-item';
        div.innerHTML = `
            <!-- 左侧：图标与标题 -->
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px; flex-shrink: 0;">
                <span style="font-size: 9px; font-weight: 800; color: #CCC; letter-spacing: 1px; margin-left: 2px;">APP ICON</span>
                <div class="app-edit-preview" style='background-image:${bg}' onclick="triggerAppIconUpload(${i})">
                    <!-- 默认的占位图标 -->
                    <svg class="camera-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    
                    <!-- 👇 真正的照相机小徽标 (背景已改为高级灰) 👇 -->
                    <div style="position: absolute; bottom: -4px; right: -4px; width: 22px; height: 22px; background: #999; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #FFF; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: #FFF;"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z"/></svg>
                    </div>
                </div>
            </div>
            
            <!-- 中间：输入框区域 -->
            <div class="app-edit-inputs" style="flex: 1; display: flex; flex-direction: column; gap: 10px; justify-content: center; margin-left: 10px;">
                <!-- NAME 行 (去掉了五角星，底边框改为虚线) -->
                <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px dashed #EAEAEA; padding-bottom: 6px;">
                    <span style="font-size: 10px; font-weight: 800; color: #CCC; letter-spacing: 1px; width: 32px;">NAME</span>
                    <input type="text" value="${name}" oninput="updateAppName(${i}, this.value)" placeholder="App Name" style="background: transparent !important; border: none !important; padding: 0 !important; font-size: 15px !important; font-weight: 600 !important; color: #333 !important; box-shadow: none !important; flex: 1;">
                </div>
                <!-- URL 行 -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 10px; font-weight: 800; color: #CCC; letter-spacing: 1px; width: 32px;">URL</span>
                    <input type="text" placeholder="图标 URL" onfocus="this.placeholder=''" onblur="this.placeholder='图标 URL '; updateAppIconUrl(${i}, this.value)" style="background: transparent !important; border: none !important; padding: 0 !important; font-size: 12px !important; color: #999 !important; box-shadow: none !important; flex: 1;">
                </div>
            </div>
            
            <!-- 右侧：重置按钮 -->
            <div onclick="resetSingleApp(${i})" style="cursor: pointer; padding: 10px; color: #999; display: flex; align-items: center; justify-content: center; transition: color 0.2s;" title="重置图标">
                <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
            </div>
            <input type="file" id="appIconInput-${i}" class="hidden-file-input" accept="image/*" onchange="handleAppIconUpload(${i}, this)">
        `;
        list.appendChild(div);
    }
}

function updateAppName(id, val) {
    document.getElementById(`name-${id}`).innerText = val;
    saveAppsData();
}

function updateAppIconUrl(id, url) {
    if (!url) return;
    const bg = `url('${url}')`;
    const iconEl = document.getElementById(`icon-${id}`);
    iconEl.style.backgroundImage = bg;
    iconEl.style.backgroundColor = 'transparent';
    saveAppsData();
    
    // 局部更新预览图，防止页面回顶
    const list = document.getElementById('appEditorList');
    if (list && list.children[id]) {
        const previewEl = list.children[id].querySelector('.app-edit-preview');
        if (previewEl) {
            previewEl.style.backgroundImage = bg;
        }
    }
}

function triggerAppIconUpload(id) {
    document.getElementById(`appIconInput-${id}`).click();
}

function handleAppIconUpload(id, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const bg = `url('${e.target.result}')`;
            const iconEl = document.getElementById(`icon-${id}`);
            iconEl.style.backgroundImage = bg;
            iconEl.style.backgroundColor = 'transparent';
            saveAppsData();
            
            // 局部更新预览图，防止页面回顶
            const previewEl = input.parentElement.querySelector('.app-edit-preview');
            if (previewEl) {
                previewEl.style.backgroundImage = bg;
            }
        };
        reader.readAsDataURL(file);
    }
}

function resetSingleApp(id) {
    // 补全了第10个APP：阅读
    const defaultNames = ['App 1', 'App 2', 'App 3', 'App 4', 'Theme', 'Settings', '世界书', 'Wish', '短信', '阅读'];
    document.getElementById(`name-${id}`).innerText = defaultNames[id];
    const iconEl = document.getElementById(`icon-${id}`);
    iconEl.style.backgroundImage = '';
    iconEl.style.backgroundColor = '#f0f0f0';
    saveAppsData();
    
    // 局部更新，防止页面回顶
    const list = document.getElementById('appEditorList');
    if (list && list.children[id]) {
        const previewEl = list.children[id].querySelector('.app-edit-preview');
        if (previewEl) previewEl.style.backgroundImage = '';
        const inputEl = list.children[id].querySelector('input[type="text"]');
        if (inputEl) inputEl.value = defaultNames[id];
    }
}

// 👇 新增：壁纸库编辑模式状态变量
let isWallpaperEditMode = false;

function toggleWallpaperEditMode() {
    isWallpaperEditMode = !isWallpaperEditMode;
    const btn = document.getElementById('wp-edit-btn');
    if (btn) {
        btn.innerText = isWallpaperEditMode ? 'Done' : 'Edit';
        btn.style.color = isWallpaperEditMode ? '#FF3B30' : '#007AFF';
    }
    renderWallpaperGrid(); // 刷新网格以显示/隐藏删除按钮
}

function renderWallpaperGrid() {
    const grid = document.getElementById('wallpaperGrid');
    grid.innerHTML = '';
    if (wallpaperPresets.length === 0) {
        grid.innerHTML = '<div style="color:#999; font-size:13px; grid-column:span 3; text-align:center; padding:20px;">暂无保存的壁纸</div>';
        return;
    }
    wallpaperPresets.forEach((url, idx) => {
        const item = document.createElement('div');
        item.className = 'wallpaper-item';
        item.style.backgroundImage = `url('${url}')`;
        
        // 如果处于编辑模式，让图片微微抖动提示可删除
        if (isWallpaperEditMode) {
            item.style.animation = 'shake 0.3s infinite';
        }
        
        item.onclick = () => { 
            // 非编辑模式下才允许点击应用壁纸
            if (!isWallpaperEditMode) {
                document.getElementById('mainScreen').style.backgroundImage = `url('${url}')`;
                saveThemeSettings();
            }
        }; 
        
        // 仅在编辑模式下渲染删除按钮
        if (isWallpaperEditMode) {
            const del = document.createElement('div');
            // 带有白色描边的红色圆形 SVG 删除按钮，定位在右上角偏外一点
            del.style.cssText = 'position: absolute; top: -6px; right: -6px; width: 24px; height: 24px; background: #FF3B30; color: #FFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10; border: 2px solid #FFF;';
            del.innerHTML = '<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            
            del.onclick = (e) => {
                e.stopPropagation();
                wallpaperPresets.splice(idx, 1);
                savePresetsData();
                renderWallpaperGrid();
            };
            item.appendChild(del);
        }
        
        grid.appendChild(item);
    });
}

function addWallpaperToGrid(url) {
    if (!wallpaperPresets.includes(url)) {
        wallpaperPresets.push(url);
        savePresetsData();
        renderWallpaperGrid();
    }
}

function setWallpaperFromUrl() {
    const url = document.getElementById('bgUrlInput').value;
    if (url) {
        document.getElementById('mainScreen').style.backgroundImage = `url('${url}')`;
        saveThemeSettings();
        addWallpaperToGrid(url);
    }
}
// --- 新增：本地壁纸上传逻辑 ---
function triggerWallpaperUpload() { 
    document.getElementById('wallpaperInput').click(); 
}

function handleWallpaperUpload(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { 
            const base64Url = e.target.result;
            // 1. 设置桌面背景
            document.getElementById('mainScreen').style.backgroundImage = `url('${base64Url}')`; 
            // 2. 保存到本地存储
            saveThemeSettings(); 
            // 3. 自动将这张本地图片加入到下方的壁纸历史网格中
            addWallpaperToGrid(base64Url);
        };
        reader.readAsDataURL(file);
    }
}

/* ==========================================================================
   WECHAT APP LOGIC (Prefix: wc)
   ========================================================================== */

// --- WeChat DB ---
const WC_DB_NAME = 'WeChatSimDB';
const WC_DB_VERSION = 3;
const WC_CHARACTERS_DURABLE_KEY = 'ios_theme_wc_characters_store_v1';
const WC_CHARACTERS_BACKUP_KEY = 'ios_theme_wc_characters_backup_v1';

function wcReadCharactersBackupSnapshot() {
    try {
        const raw = localStorage.getItem(WC_CHARACTERS_BACKUP_KEY);
        if (!raw) return { updatedAt: 0, characters: [] };

        const parsed = JSON.parse(raw);
        const characters = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed?.characters) ? parsed.characters : []);

        return {
            updatedAt: Number(parsed?.updatedAt) || 0,
            characters: characters.filter(char => char && typeof char === 'object' && char.id)
        };
    } catch (e) {
        console.warn('联系人本地备份读取失败', e);
        return { updatedAt: 0, characters: [] };
    }
}

function wcWriteCharactersBackupSnapshot(updatedAt = Date.now()) {
    try {
        const characters = Array.isArray(wcState.characters)
            ? wcState.characters.filter(char => char && typeof char === 'object' && char.id)
            : [];

        localStorage.setItem(WC_CHARACTERS_BACKUP_KEY, JSON.stringify({
            updatedAt,
            characters
        }));
    } catch (e) {
        console.warn('联系人本地备份写入失败', e);
    }

    return updatedAt;
}

function wcSanitizeCharactersSnapshot(characters) {
    return Array.isArray(characters)
        ? characters.filter(char => char && typeof char === 'object' && char.id)
        : [];
}

function wcWriteCharactersBackupSnapshotFromList(characters, updatedAt = Date.now()) {
    try {
        localStorage.setItem(WC_CHARACTERS_BACKUP_KEY, JSON.stringify({
            updatedAt,
            characters: wcSanitizeCharactersSnapshot(characters)
        }));
    } catch (e) {
        console.warn('联系人本地备份写入失败', e);
    }

    return updatedAt;
}

async function wcReadCharactersPersistentSnapshot() {
    let snapshot = null;

    if (window.localforage && typeof window.localforage.getItem === 'function') {
        try {
            snapshot = await window.localforage.getItem(WC_CHARACTERS_DURABLE_KEY);
        } catch (e) {
            console.warn('联系人持久存储读取失败', e);
        }
    }

    if (!snapshot) {
        snapshot = wcReadCharactersBackupSnapshot();
    }

    const characters = Array.isArray(snapshot)
        ? snapshot
        : (Array.isArray(snapshot?.characters) ? snapshot.characters : []);

    return {
        updatedAt: Number(snapshot?.updatedAt) || 0,
        characters: characters.filter(char => char && typeof char === 'object' && char.id)
    };
}

async function wcWriteCharactersPersistentSnapshot(updatedAt = Date.now()) {
    return wcWriteCharactersPersistentSnapshotFromList(wcState.characters, updatedAt);
}

async function wcWriteCharactersPersistentSnapshotFromList(characters, updatedAt = Date.now()) {
    const snapshot = {
        updatedAt,
        characters: wcSanitizeCharactersSnapshot(characters)
    };

    wcWriteCharactersBackupSnapshotFromList(snapshot.characters, updatedAt);

    if (window.localforage && typeof window.localforage.setItem === 'function') {
        try {
            await window.localforage.setItem(WC_CHARACTERS_DURABLE_KEY, snapshot);
        } catch (e) {
            console.warn('联系人持久存储写入失败', e);
        }
    }

    return updatedAt;
}

async function wcClearCharactersPersistentSnapshot() {
    try {
        localStorage.removeItem(WC_CHARACTERS_BACKUP_KEY);
    } catch (e) {
        console.warn('联系人本地备份清除失败', e);
    }

    if (window.localforage && typeof window.localforage.removeItem === 'function') {
        try {
            await window.localforage.removeItem(WC_CHARACTERS_DURABLE_KEY);
        } catch (e) {
            console.warn('联系人持久存储清除失败', e);
        }
    }
}

async function wcSyncCharactersSnapshotFromList(characters, updatedAt = Date.now()) {
    const safeCharacters = wcSanitizeCharactersSnapshot(characters);

    if (safeCharacters.length > 0) {
        await wcWriteCharactersPersistentSnapshotFromList(safeCharacters, updatedAt);
    } else {
        await wcClearCharactersPersistentSnapshot();
    }

    try {
        await wcDb.put('kv_store', updatedAt, 'characters_updated_at');
    } catch (e) {
        console.warn('联系人版本戳写入失败', e);
    }

    return updatedAt;
}

async function wcRestoreCharactersFromBackup(characters) {
    if (!Array.isArray(characters) || characters.length === 0) return;

    for (const char of characters) {
        if (char && char.id) {
            await wcDb.put('characters', char);
        }
    }
}

function wcClearStore(storeName) {
    return new Promise((resolve, reject) => {
        if (!wcDb.instance || !wcDb.instance.objectStoreNames.contains(storeName)) {
            return resolve();
        }

        const tx = wcDb.instance.transaction([storeName], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(storeName).clear();
    });
}

const wcDb = {
    instance: null,
    open: function() {
        return new Promise((resolve, reject) => {
            if (this.instance) return resolve(this.instance);
            const request = indexedDB.open(WC_DB_NAME, WC_DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const stores = ['kv_store', 'characters', 'chats', 'moments', 'masks'];
                stores.forEach(store => {
                    if (!db.objectStoreNames.contains(store)) {
                        db.createObjectStore(store, store === 'kv_store' ? undefined : { keyPath: store === 'chats' ? 'charId' : 'id' });
                    }
                });
            };
            request.onsuccess = (event) => {
                this.instance = event.target.result;
                resolve(this.instance);
            };
            request.onerror = (event) => {
                console.error("DB Open Error:", event.target.error);
                reject(event.target.error);
            };
        });
    },
    init: async function() {
        try {
            await this.open();
        } catch (e) {
            console.warn("尝试降级打开数据库...");
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(WC_DB_NAME);
                req.onsuccess = (e) => { this.instance = e.target.result; resolve(); };
                req.onerror = (e) => reject(e.target.error);
            });
        }
    },
    get: async function(storeName, key) {
        await this.open();
        return new Promise((resolve, reject) => {
            try {
                if (!this.instance.objectStoreNames.contains(storeName)) return resolve(null);
                const tx = this.instance.transaction([storeName], 'readonly');
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) { resolve(null); }
        });
    },
    getAll: async function(storeName) {
        await this.open();
        return new Promise((resolve, reject) => {
            try {
                if (!this.instance.objectStoreNames.contains(storeName)) return resolve([]);
                const tx = this.instance.transaction([storeName], 'readonly');
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) { resolve([]); }
        });
    },
    put: async function(storeName, value, key) {
        await this.open();
        return new Promise((resolve, reject) => {
            try {
                if (!this.instance.objectStoreNames.contains(storeName)) return resolve();
                const tx = this.instance.transaction([storeName], 'readwrite');
                const req = key ? tx.objectStore(storeName).put(value, key) : tx.objectStore(storeName).put(value);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            } catch (e) { resolve(); }
        });
    },
    delete: async function(storeName, key) {
        await this.open();
        return new Promise((resolve, reject) => {
            try {
                if (!this.instance.objectStoreNames.contains(storeName)) return resolve();
                const tx = this.instance.transaction([storeName], 'readwrite');
                const req = tx.objectStore(storeName).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            } catch (e) { resolve(); }
        });
    }
};

// --- WeChat State ---
const wcState = {
    globalConfig: { customCss: '', pinText: 'ㅠㅅㅠ', pinCss: '' }, // 👈 新增：全局配置
    globalCssPresets: [], // 👈 新增：全局专属 CSS 预设
    relationships: [], // 新增：角色关系网数据
    chatGroups: [], // 新增：自定义分组列表
    activeChatGroup: 'All', // 新增：当前选中的分组
    selectedGroupName: null, // 新增：长按选中的分组名
    groupLongPressTimer: null, // 新增：分组长按计时器
    myFavorites: [], 
    calendarEvents: [], // <--- 新增这一行：用于存储日历事件
    currentTab: 'chat',
    characters: [],
    chats: {}, 
    chatDisplayCount: 50, // 新增：控制聊天页面显示的消息条数
    moments: [],
    user: { name: 'User', avatar: '', cover: '', persona: '' },
    wallet: { balance: 0.00, transactions: [], password: '123456' },
    masks: [], 
    stickerCategories: [{ name: "全部", list: [] }],
    cssPresets: [],
    chatBgPresets: [], // 【新增】：聊天背景图库
    phonePresets: [],  // 【新增】：手机装修预设
    shopData: { mall: [], takeout: [], cart: [], config: { worldbookEntries: [] } }, // 【新增】：购物数据
    activeStickerCategoryIndex: 0,
    tempImage: '',
    tempImageType: '',
    editingCharId: null,
    momentType: 'local',
    activeChatId: null,
    isStickerPanelOpen: false,
    isMorePanelOpen: false,
    isStickerDeleteMode: false,
    isMultiSelectMode: false,
    longPressTimer: null,
    selectedMsgId: null,
    replyingToMsgId: null,
    multiSelectedIds: [],
    tempTransfer: { amount: 0, note: '' },
    activeTransferMsgId: null,
    phoneClockInterval: null,
    tempPhoneConfig: {},
    phoneAppTab: 'chat',
    generalInputCallback: null,
    tempBgCleared: false,
    replyingToComment: null,
    unreadCounts: {}, // { charId: count }
    // ... 现有代码 ...
    proactiveInterval: null,
    tempShopTransaction: null,
    // 👇 新增：语音通话状态
    callState: {
        isActive: false,
        charId: null,
        startTime: 0,
        timerInterval: null,
        isSpeaking: false,
        transcript: [] // 👈 新增：专门用于存储当前通话记录的数组
    },
    showHiddenMessages: false, // 👈 新增：是否显示隐藏的系统提示
    readingBooks: [] // 👈 新增：阅读App书架数据
};

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        wcWriteCharactersBackupSnapshot();
    }
});

window.addEventListener('pagehide', () => {
    wcWriteCharactersBackupSnapshot();
});


// --- WeChat Core Functions ---
function openWechat() {
    document.getElementById('wechatModal').classList.add('open');
    wcRenderAll();
    wcSwitchTab('chat');
}

function closeWechat() {
    document.getElementById('wechatModal').classList.remove('open');
}

async function wcLoadData() {
    const persistentCharactersSnapshot = await wcReadCharactersPersistentSnapshot();
    if (persistentCharactersSnapshot.characters.length > 0) {
        wcState.characters = persistentCharactersSnapshot.characters;
    }

    try {
        const safeGet = async (storeName, key) => await wcDb.get(storeName, key).catch(() => null);
        const safeGetAll = async (storeName) => await wcDb.getAll(storeName).catch(() => []);

        const myFavs = await safeGet('kv_store', 'my_favorites');
        if (myFavs) wcState.myFavorites = myFavs;
        
        const chatGroups = await safeGet('kv_store', 'chat_groups');
        if (chatGroups) wcState.chatGroups = chatGroups;
        
        const calEvents = await safeGet('kv_store', 'calendar_events');
        if (calEvents) wcState.calendarEvents = calEvents;

        const user = await safeGet('kv_store', 'user');
        if (user) wcState.user = user;
        else wcState.user.avatar = 'https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg';

        const wallet = await safeGet('kv_store', 'wallet');
        if (wallet) wcState.wallet = wallet;

        const stickers = await safeGet('kv_store', 'sticker_categories');
        if (stickers) wcState.stickerCategories = stickers;

        const presets = await safeGet('kv_store', 'css_presets');
        if (presets) wcState.cssPresets = presets;
                const globalCfg = await safeGet('kv_store', 'global_config');
        if (globalCfg) wcState.globalConfig = { ...wcState.globalConfig, ...globalCfg };
        
        const globalPresets = await safeGet('kv_store', 'global_css_presets'); // 👈 加载全局预设
        if (globalPresets) wcState.globalCssPresets = globalPresets;

        const chatBgs = await safeGet('kv_store', 'chat_bg_presets');
        if (chatBgs) wcState.chatBgPresets = chatBgs;
        
        const phonePresets = await safeGet('kv_store', 'phone_presets');
        if (phonePresets) wcState.phonePresets = phonePresets;
        
        const shopData = await safeGet('kv_store', 'shop_data');
        if (shopData) wcState.shopData = shopData;
        
        const relData = await safeGet('kv_store', 'relationships');
        if (relData) wcState.relationships = relData;
        
        const unread = await safeGet('kv_store', 'unread_counts');
        if (unread) wcState.unreadCounts = unread;

        const readingBooks = await safeGet('kv_store', 'reading_books');
        if (readingBooks && readingBooks.length > 0) {
            wcState.readingBooks = readingBooks;
        } else {
            wcState.readingBooks = [
                {
                    id: 'book-1',
                    title: '百年孤独',
                    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800&auto=format&fit=crop',
                    progress: 12.5,
                    currentChapter: 0,
                    chapters: [
                        { title: '第一章', content: '多年以后，奥雷连诺上校站在行刑队面前，准会想起父亲带他去参观冰块的那个遥远的下午。\n\n当时，马孔多是个二十户人家的村落，泥巴和芦苇盖成的屋子沿河岸排开，湍急的河水清澈见底，河床里卵石洁白光滑宛如史前巨蛋。世界新生伊始，许多事物还没有名字，提到的时候尚需用手指指点点。' }
                    ]
                },
                {
                    id: 'book-2',
                    title: '人类简史',
                    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=800&auto=format&fit=crop',
                    progress: 45.2,
                    currentChapter: 0,
                    chapters: [
                        { title: '第一章 人类：一种也没什么特别的动物', content: '大约在135亿年前，经过所谓的“大爆炸”（Big Bang）之后，宇宙的物质、能量、时间和空间才成了现在的样子。宇宙的这些基本特征，就成了“物理学”。\n\n在这之后大约过了30万年，物质和能量开始形成复杂的结构，称为“原子”，再进一步结合成分子。至于这些原子和分子的故事以及它们如何互动，就成了“化学”。' }
                    ]
                }
            ];
        }

        const charsUpdatedAt = await safeGet('kv_store', 'characters_updated_at');
        const chars = await safeGetAll('characters');
        const shouldUseBackupCharacters = persistentCharactersSnapshot.characters.length > 0 && (
            !Array.isArray(chars) || chars.length === 0 ||
            persistentCharactersSnapshot.updatedAt >= (Number(charsUpdatedAt) || 0) ||
            persistentCharactersSnapshot.characters.length > chars.length
        );

        if (shouldUseBackupCharacters) {
            wcState.characters = persistentCharactersSnapshot.characters;
            await wcRestoreCharactersFromBackup(persistentCharactersSnapshot.characters);
        } else {
            wcState.characters = chars || [];
            if (wcState.characters.length > 0) {
                await wcWriteCharactersPersistentSnapshot(Number(charsUpdatedAt) || Date.now());
            }
        }
        
        wcState.masks = await safeGetAll('masks') || [];
        wcState.moments = await safeGetAll('moments') || [];
        
        const allChats = await safeGetAll('chats');
        if (allChats) {
            allChats.forEach(item => {
                wcState.chats[item.charId] = item.messages;
            });
        }
    } catch (e) {
        console.error("WeChat Data load error", e);
    }
}

async function wcSaveData() {
    const charactersUpdatedAt = await wcWriteCharactersPersistentSnapshot();

    try {
        await wcDb.open();
        if (!wcDb.instance) return;

        // 辅助函数：将单个 store 的操作封装为独立的 Promise 事务
        const saveStore = (storeName, callback) => {
            return new Promise((resolve, reject) => {
                if (!wcDb.instance.objectStoreNames.contains(storeName)) {
                    return resolve();
                }
                const tx = wcDb.instance.transaction([storeName], 'readwrite');
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => {
                    console.error(`保存 ${storeName} 失败:`, tx.error);
                    reject(tx.error);
                };
                const store = tx.objectStore(storeName);
                callback(store);
            });
        };

        // 1. 保存 kv_store
        await saveStore('kv_store', (store) => {
            store.put(wcState.myFavorites || [], 'my_favorites');
            store.put(wcState.globalConfig, 'global_config'); // 👈 保存全局配置            
            store.put(wcState.globalCssPresets || [], 'global_css_presets'); // 👈 保存全局预设
            store.put(wcState.chatGroups || [], 'chat_groups');
            store.put(wcState.calendarEvents || [], 'calendar_events');
            store.put(wcState.user || { name: 'User', avatar: '' }, 'user');
            store.put(wcState.wallet || { balance: 0, transactions: [] }, 'wallet');
            store.put(wcState.stickerCategories || [], 'sticker_categories');
            store.put(wcState.cssPresets || [], 'css_presets');
            store.put(wcState.unreadCounts || {}, 'unread_counts');
            store.put(wcState.chatBgPresets || [], 'chat_bg_presets');
            store.put(wcState.phonePresets || [], 'phone_presets');
            store.put(wcState.shopData || {}, 'shop_data');
            store.put(wcState.relationships || [], 'relationships');
            store.put(wcState.readingBooks || [], 'reading_books');
            store.put(charactersUpdatedAt, 'characters_updated_at');
        }).catch(e => console.warn("kv_store 保存异常", e));

        // 2. 保存 characters (你的角色数据)
        await saveStore('characters', (store) => {
            for (const char of wcState.characters) {
                if (char && char.id) store.put(char);
            }
        }).catch(e => console.warn("characters 保存异常", e));

        // 3. 保存 masks
        await saveStore('masks', (store) => {
            for (const mask of wcState.masks) {
                if (mask && mask.id) store.put(mask);
            }
        }).catch(e => console.warn("masks 保存异常", e));

        // 4. 保存 moments
        await saveStore('moments', (store) => {
            for (const moment of wcState.moments) {
                if (moment && moment.id) store.put(moment);
            }
        }).catch(e => console.warn("moments 保存异常", e));

        // 5. 保存 chats (最容易因为图片太多导致 iOS 崩溃的地方，单独隔离)
        await saveStore('chats', (store) => {
            for (const charId in wcState.chats) {
                const parsedId = parseInt(charId);
                if (!isNaN(parsedId)) {
                    store.put({ charId: parsedId, messages: wcState.chats[charId] });
                }
            }
        }).catch(e => {
            console.error("聊天记录保存失败，可能是图片数据过大导致 iOS 限制！", e);
        });

    } catch (e) {
        console.error("WeChat Save 整体流程失败", e);
    }
}

// 在 wcLoadData 完成后调用，应用全局样式
const originalWcLoadData = wcLoadData;
wcLoadData = async function() {

    await originalWcLoadData();
    wcApplyGlobalCssToDom(); // 👈 新增：加载完数据后立即应用全局 CSS
};

function wcCompressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                const scaleSize = MAX_WIDTH / img.width;
                if (scaleSize < 1) {
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // 🔪 核心修复：如果是 PNG 图片，保留透明通道，不进行 JPEG 压缩
                if (file.type === 'image/png') {
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                }
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// --- WeChat Navigation ---
// --- 替换 wcSwitchTab 函数 ---
function wcSwitchTab(tabId) {
    wcState.currentTab = tabId;
    document.querySelectorAll('.wc-tab-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.wc-tab-item[onclick="wcSwitchTab('${tabId}')"]`).classList.add('active');
    document.querySelectorAll('.wc-page').forEach(el => el.classList.remove('active'));
    document.getElementById(`wc-view-${tabId}`).classList.add('active');
    
    document.getElementById('wc-view-chat-detail').classList.remove('active');
    document.getElementById('wc-view-memory').classList.remove('active');
    
    const shopPage = document.getElementById('wc-view-shopping');
    if (shopPage) {
        shopPage.classList.remove('active');
        shopPage.style.display = 'none';
    }
    
    document.getElementById('wc-main-tabbar').style.display = 'none';
    
    const btnBack = document.getElementById('wc-btn-back');
    const btnExit = document.getElementById('wc-btn-exit');
    const btnCalendar = document.getElementById('wc-btn-calendar'); 
    
    if (btnBack) btnBack.style.display = 'none';
    if (btnCalendar) btnCalendar.style.display = 'none'; 

    const titleMap = { 'chat': '', 'contacts': 'Contacts', 'moments': 'Moments', 'user': 'User' };
    const titleEl = document.getElementById('wc-nav-title');
    const navbar = document.querySelector('.wc-navbar');

    // 🔪 核心修复：如果是 User 或 Moments 页面，彻底隐藏顶栏和退出键
    if (tabId === 'user' || tabId === 'moments') {
        if (navbar) navbar.style.display = 'none';
        if (btnExit) btnExit.style.display = 'none';
    } else {
        if (navbar) navbar.style.display = 'flex';
        if (btnExit) btnExit.style.display = 'flex';
    }

    if (tabId === 'chat') {
        navbar.classList.add('custom-chat-nav-mode');
        navbar.classList.remove('custom-moments-nav-mode');
        navbar.classList.remove('custom-contacts-nav-mode');
        titleEl.innerHTML = wcGenerateChatHeaderHTML();
        if (btnExit) btnExit.innerHTML = `<svg class="wc-icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>退出`;
    }
 else if (tabId === 'moments') {
        navbar.classList.remove('custom-chat-nav-mode');
        navbar.classList.add('custom-moments-nav-mode');
        navbar.classList.remove('custom-contacts-nav-mode');
        
        if (btnExit) btnExit.style.display = 'none';
        if (btnCalendar) btnCalendar.style.display = 'none'; // 👈 隐藏日历按钮
        
        // 顶栏恢复极简标题
        titleEl.innerHTML = `<span style="font-family: 'Georgia', serif; font-style: italic; letter-spacing: -0.5px; font-size: 26px; font-weight: bold; color: #111;">Moments</span>`;
        
    } else if (tabId === 'contacts') {
        navbar.classList.remove('custom-chat-nav-mode');
        navbar.classList.remove('custom-moments-nav-mode');
        navbar.classList.add('custom-contacts-nav-mode');
        titleEl.innerHTML = wcGenerateContactsHeaderHTML();
    } else {
        navbar.classList.remove('custom-chat-nav-mode');
        navbar.classList.remove('custom-moments-nav-mode');
        navbar.classList.remove('custom-contacts-nav-mode');
        titleEl.innerHTML = titleMap[tabId];
        if (btnExit) {
            btnExit.innerHTML = `<svg class="wc-icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>退出`;
        }
    }
    
    titleEl.onclick = null;
    titleEl.style.cursor = 'default';

    const rightContainer = document.getElementById('wc-nav-right-container');
    rightContainer.innerHTML = '';

    if (tabId === 'chat') {
        document.getElementById('wc-main-tabbar').style.display = 'flex';
        wcRenderChats(); 
    } else if (tabId === 'moments') {
        document.getElementById('wc-main-tabbar').style.display = 'flex';
        
        // 默认选中今天
        const now = new Date();
        wcState.momentFilter = 'specificDate';
        wcState.momentFilterDate = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
        wcRenderMoments();
    }
 else if (tabId === 'contacts' || tabId === 'user') {
        document.getElementById('wc-main-tabbar').style.display = 'flex';
    }
}
window.wcFilterMoments = function(type, value) {
    if (type === 'all') {
        wcState.momentFilter = 'all';
        wcState.momentFilterDate = null;
        wcState.momentFilterChar = null;
    } else if (type === 'date') {
        const d = new Date(value);
        wcState.momentFilter = 'specificDate';
        wcState.momentFilterDate = { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
        wcState.momentFilterChar = null;
    } else if (type === 'char') {
        wcState.momentFilter = 'char';
        wcState.momentFilterChar = value; // 传入角色名
        wcState.momentFilterDate = null;
    }
    wcRenderMoments();
}

function wcHandleBack() {
    // 如果在回忆页面，先关闭回忆页面
    if (document.getElementById('wc-view-memory').classList.contains('active')) {
        wcCloseMemoryPage();
        return;
    }
    
    // 如果在购物页面，关闭购物页面
    const shopPage = document.getElementById('wc-view-shopping');
    if (shopPage && (shopPage.classList.contains('active') || shopPage.style.display === 'flex')) {
        wcCloseShoppingPage();
        return;
    }
    
    // 如果在钱包页面，关闭钱包
    if (document.getElementById('wc-view-wallet').classList.contains('active')) {
        wcCloseWallet();
        return;
    }

    // 如果在收藏页面，关闭收藏
    if (document.getElementById('wc-view-my-favorites').classList.contains('active')) {
        wcCloseMyFavorites();
        return;
    }

    // 正常的聊天页面返回逻辑
    if (document.getElementById('wc-view-chat-detail').classList.contains('active')) {
        // 清除错误消息
        if (wcState.activeChatId && wcState.chats[wcState.activeChatId]) {
            const originalLen = wcState.chats[wcState.activeChatId].length;
            wcState.chats[wcState.activeChatId] = wcState.chats[wcState.activeChatId].filter(m => !m.isError);
            if (wcState.chats[wcState.activeChatId].length !== originalLen) {
                wcSaveData();
            }
        }

        document.getElementById('wc-view-chat-detail').classList.remove('active');
        document.getElementById('wc-main-tabbar').style.display = 'flex';
        
        // 核心修复：恢复按钮状态
        const btnBack = document.getElementById('wc-btn-back');
        const btnExit = document.getElementById('wc-btn-exit');
        if (btnBack) btnBack.style.display = 'none';
        if (btnExit) btnExit.style.display = 'flex';

        const titleEl = document.getElementById('wc-nav-title');
        const navbar = document.querySelector('.wc-navbar');
        
        // 👇 新增：退出聊天时清除双头像加宽状态 👇
        if (navbar) navbar.classList.remove('with-avatars');
        document.getElementById('wc-view-chat-detail').classList.remove('with-avatars');
        // 👆 新增结束 👆
        
        navbar.classList.add('custom-chat-nav-mode');
        titleEl.innerHTML = wcGenerateChatHeaderHTML();
        titleEl.onclick = null;
        titleEl.style.cursor = 'default';
        
        const rightContainer = document.getElementById('wc-nav-right-container');
        rightContainer.innerHTML = '';
        
        wcState.activeChatId = null;
        wcCloseAllPanels();
        wcExitMultiSelectMode();
        
        document.getElementById('wc-chat-background-layer').style.backgroundImage = 'none';
        document.getElementById('wc-custom-css-style').innerHTML = '';
        
        wcRenderChats(); 
    }
}
// --- 新增：更新聊天顶栏状态显示 ---
function updateChatTopBarStatus(char) {
    const titleEl = document.getElementById('wc-nav-title');
    if (!titleEl) return;
    
    let displayName = char.note || char.name;
    if (char.isGroup && char.members) {
        displayName += ` (${char.members.length})`;
    }
    
    let statusHtml = '';
    // 【修改】：增加判断，如果关闭了生活状态开关，则不显示
    const isLifeStatusEnabled = char.chatConfig && char.chatConfig.lifeStatusEnabled !== false;
    if (isLifeStatusEnabled && !char.isGroup && char.lifeStatus && char.lifeStatus.action && char.lifeStatus.action !== "未知") {
        // 👇 核心修改：加上 onclick 事件和 cursor: pointer，让它可以点击 👇
        statusHtml = `<div onclick="wcQuickEditLifeStatus(${char.id}, event)" style="font-size: 11px; color: #8E8E93; font-weight: normal; margin-top: 2px; line-height: 1; cursor: pointer;">${char.lifeStatus.action}</div>`;
    }
    
    // 👇 新增：顶栏双头像逻辑 👇
    let avatarsHtml = '';
    const navbar = document.querySelector('.wc-navbar');
    const chatDetailView = document.getElementById('wc-view-chat-detail');

    if (char.chatConfig && char.chatConfig.topbarAvatarsEnabled) {
        const userAvatar = char.chatConfig.userAvatar || wcState.user.avatar;
        const charAvatar = char.avatar;
        // 头像放大到 38px，增加间距和阴影质感
        avatarsHtml = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 6px;">
                <img src="${userAvatar}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #FFF; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <img src="${charAvatar}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #FFF; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            </div>
        `;
        // 动态添加加宽类名
        if (navbar) navbar.classList.add('with-avatars');
        if (chatDetailView) chatDetailView.classList.add('with-avatars');
    } else {
        // 移除加宽类名
        if (navbar) navbar.classList.remove('with-avatars');
        if (chatDetailView) chatDetailView.classList.remove('with-avatars');
    }
    // 👆 新增结束 👆
    
    titleEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2;">
            ${avatarsHtml}
            <div id="wc-topbar-name" style="font-size: 17px; font-weight: 600; color: #111;">${displayName}</div>
            ${statusHtml}
        </div>
    `;
}

// 👇 新增：点击状态栏直接修改的函数 👇
window.wcQuickEditLifeStatus = function(charId, event) {
    if (event) event.stopPropagation(); // 防止触发其他点击事件
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;
    
    const currentAction = (char.lifeStatus && char.lifeStatus.action) ? char.lifeStatus.action : '';
    
    // 🔪 核心修复：使用微信专属的高层级弹窗，防止被微信界面遮挡
    wcOpenGeneralInput("修改生活状态 (正在做的事)", (newAction) => {
        if (newAction !== null && newAction.trim() !== "") {
            if (!char.lifeStatus) {
                char.lifeStatus = { location: "未知", action: "未知", mood: "未知", timeline: [], autoRefresh: true, refreshTime: "06:00", lastRefreshTimestamp: Date.now() };
            }
            char.lifeStatus.action = newAction.trim();
            wcSaveData();
            updateChatTopBarStatus(char); // 刷新顶栏显示
        }
    });
    
    // 预填当前状态
    setTimeout(() => {
        const inputField = document.getElementById('wc-general-input-field');
        if (inputField) inputField.value = currentAction;
    }, 50);
};

// --- WeChat Chat Logic ---
function wcOpenChat(charId) {
    wcState.activeChatId = charId;
    wcState.chatDisplayCount = 50; // 新增：每次打开聊天重置显示条数
    sessionApiCallCount = 0; 
    
    if (wcState.unreadCounts[charId]) {
        wcState.unreadCounts[charId] = 0;
        wcSaveData();
    }

    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    document.getElementById('wc-view-chat-detail').classList.add('active');
    document.getElementById('wc-main-tabbar').style.display = 'none';

    document.querySelector('.wc-navbar').classList.remove('custom-chat-nav-mode');
  
    // 核心修复：强制控制按钮显示
    const btnBack = document.getElementById('wc-btn-back');
    const btnExit = document.getElementById('wc-btn-exit');
    if (btnBack) btnBack.style.display = 'flex';
    if (btnExit) btnExit.style.display = 'none'; // 确保隐藏退出键
    
    const titleEl = document.getElementById('wc-nav-title');
    updateChatTopBarStatus(char); // 调用新函数渲染顶栏
    titleEl.onclick = null;
    titleEl.style.cursor = 'default';    
    const rightContainer = document.getElementById('wc-nav-right-container');
    rightContainer.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'wc-nav-btn';
    btn.innerHTML = '<svg class="wc-icon" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
    btn.onclick = () => wcOpenChatSettings();
    rightContainer.appendChild(btn);

    wcApplyChatConfig(char);
    wcRenderMessages(charId);
    wcScrollToBottom(true);
}

function wcApplyChatConfig(char) {
    if (!char) return;
    const bgLayer = document.getElementById('wc-chat-background-layer');
    if (char.chatConfig && char.chatConfig.backgroundImage) {
        bgLayer.style.backgroundImage = `url(${char.chatConfig.backgroundImage})`;
    } else {
        bgLayer.style.backgroundImage = 'none';
    }

    const cssStyle = document.getElementById('wc-custom-css-style');
    if (char.chatConfig && char.chatConfig.customCss) {
        cssStyle.innerHTML = char.chatConfig.customCss;
    } else {
        cssStyle.innerHTML = '';
    }
}

function wcFormatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
// 新增：专门用于系统居中时间戳的格式化函数（带日期智能显示）
function wcFormatSystemTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    // 判断是否是今天
    if (date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()) {
        return timeStr; // 当天只显示时间
    }

    // 判断是否是昨天
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate()) {
        return `昨天 ${timeStr}`;
    }

    // 其他日期 (同一年不显示年份)
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (date.getFullYear() === now.getFullYear()) {
        return `${month}月${day}日 ${timeStr}`;
    } else {
        return `${date.getFullYear()}年${month}月${day}日 ${timeStr}`;
    }
}

// --- 新增/强化：时间感知计算器 (融合 v2.0 规则，增强跨天感知) ---
function wcGenerateTimeGapPrompt(msgs, referenceTime = Date.now()) {
    if (!msgs || msgs.length === 0) return "";
    
    const validMsgs = msgs.filter(m => m.type !== 'system' && !m.isError);
    if (validMsgs.length === 0) return "";

    // 核心修复：只看最后一条有效消息和当前时间的差距
    const lastMsg = validMsgs[validMsgs.length - 1];
    const gapMs = referenceTime - lastMsg.time;

    // 如果距离最后一条消息不到 10 分钟，说明一直在聊，不需要提示断联
    if (gapMs < 10 * 60 * 1000) return "";

    const gapMinutes = Math.floor(gapMs / 60000);
    const gapHours = Math.floor(gapMinutes / 60);
    const gapDays = Math.floor(gapHours / 24);
    
    const remainHours = gapHours % 24;
    const remainMinutes = gapMinutes % 60;

    let timeGapStr = "";
    if (gapDays > 0) timeGapStr += `${gapDays}天`;
    if (remainHours > 0) timeGapStr += `${remainHours}小时`;
    if (remainMinutes > 0 || timeGapStr === "") timeGapStr += `${remainMinutes}分钟`;

    let prompt = `\n【系统通知：时间感知】\n`;
    prompt += `> 距离上次互动已过去 ${timeGapStr}。话题可能已中断，请以 ${msgs[0]?.name || '你'} 的身份自然地开启新话题，或对时间流逝做出反应，自然地延续之前的对话。\n`;

    return prompt;
}

function wcRenderMessages(charId, preserveScroll = false) {
    const container = document.getElementById('wc-chat-messages');
    const anchor = document.getElementById('wc-chat-scroll-anchor');
    
    // 记录旧的滚动高度，用于加载更多后保持位置
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;

    container.innerHTML = '';
    container.appendChild(anchor);

    const allMsgs = wcState.chats[charId] || [];
    const char = wcState.characters.find(c => c.id === charId);
    
    if (!char) return;

    // 分页逻辑：只截取最后 N 条消息
    if (!wcState.chatDisplayCount) wcState.chatDisplayCount = 50;
    const displayCount = wcState.chatDisplayCount;
    const msgs = allMsgs.slice(-displayCount);

    // 如果总消息数大于当前显示数，在顶部添加“加载更多”按钮
    if (allMsgs.length > displayCount) {
        const loadMoreDiv = document.createElement('div');
        loadMoreDiv.style.textAlign = 'center';
        loadMoreDiv.style.padding = '15px 0';
        loadMoreDiv.style.color = '#007AFF';
        loadMoreDiv.style.fontSize = '13px';
        loadMoreDiv.style.cursor = 'pointer';
        loadMoreDiv.innerText = '点击加载更多消息';
        loadMoreDiv.onclick = () => {
            wcState.chatDisplayCount += 50;
            wcRenderMessages(charId, true); // 传入 true 保持滚动位置
        };
        container.insertBefore(loadMoreDiv, anchor);
    }

    let userAvatar = wcState.user.avatar;
    if (char.chatConfig && char.chatConfig.userAvatar) {
        userAvatar = char.chatConfig.userAvatar;
    }

    if (wcState.isMultiSelectMode) {
        container.classList.add('multi-select-mode');
    } else {
        container.classList.remove('multi-select-mode');
    }

    let lastTime = 0;

    msgs.forEach((msg) => {
        // 👇 核心修改 1：如果是隐藏消息，且当前不是多选模式，才跳过渲染
        if (msg.hidden && !wcState.isMultiSelectMode) return;

        // 🔪 修复：如果是第一条消息 (lastTime === 0) 或者 距离上一条超过 10 分钟，都显示时间戳
        if (lastTime === 0 || (msg.time - lastTime > 10 * 60 * 1000)) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'wc-message-row system';
            timeDiv.style.margin = '12px 0'; // 👈 单独给时间戳补偿上下间距
            timeDiv.innerHTML = `<div class="wc-system-msg-text transparent">${wcFormatSystemTime(msg.time)}</div>`;
            container.insertBefore(timeDiv, anchor);
        }        
        // 更新 lastTime 为当前消息的时间
        lastTime = msg.time;

        const row = document.createElement('div');
        row.id = `msg-row-${msg.id}`; // 新增：为每行消息添加 ID，方便跳转
        
        if (msg.type === 'system') {
            row.className = 'wc-message-row system';
            
            // 👇 核心修改 2：为系统消息补充多选框 HTML
            let sysCheckboxHtml = '';
            if (wcState.isMultiSelectMode) {
                sysCheckboxHtml = `<div class="wc-msg-checkbox ${wcState.multiSelectedIds.includes(msg.id) ? 'checked' : ''}" onclick="wcToggleMultiSelectMsg(${msg.id})"></div>`;
            }
            
            // 👇 核心修改 3：如果是隐藏消息，加上醒目的红色 [隐藏] 标签
            let hiddenTag = msg.hidden ? '<span style="color:#FF3B30; font-weight:bold; margin-right:4px;">[隐藏]</span>' : '';
            
            row.innerHTML = `${sysCheckboxHtml}<div class="wc-system-msg-text ${msg.style || ''}">${hiddenTag}${msg.content}</div>`;
            
            // 核心修改：让系统消息也可以长按呼出菜单进行删除
            const sysText = row.querySelector('.wc-system-msg-text');
            if (sysText) {
                sysText.style.cursor = 'pointer';
                sysText.addEventListener('touchstart', (e) => wcHandleTouchStart(e, msg.id));
                sysText.addEventListener('touchend', wcHandleTouchEnd);
                sysText.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    wcShowContextMenu(e.clientX, e.clientY, msg.id);
                });
            }
            
            container.insertBefore(row, anchor);
            return;
        } else if (msg.type === 'recall') {
            row.className = 'wc-message-row system';
            let sysCheckboxHtml = '';
            if (wcState.isMultiSelectMode) {
                sysCheckboxHtml = `<div class="wc-msg-checkbox ${wcState.multiSelectedIds.includes(msg.id) ? 'checked' : ''}" onclick="wcToggleMultiSelectMsg(${msg.id})"></div>`;
            }
            
            let displayContent = msg.originalContent;
            if (msg.originalType === 'image' || msg.originalType === 'sticker') {
                if (msg.originalContent.startsWith('data:video/')) {
                    displayContent = `<video src="${msg.originalContent}" style="max-width: 100px; max-height: 100px; border-radius: 4px;" muted playsinline></video>`;
                } else {
                    displayContent = `<img src="${msg.originalContent}" style="max-width: 100px; max-height: 100px; border-radius: 4px;">`;
                }
            } else if (msg.originalType === 'voice') {
                displayContent = `[语音] ${msg.originalContent}`;
            } else if (msg.originalType !== 'text') {
                displayContent = `[${msg.originalType}]`;
            }

            let recallText = msg.sender === 'me' ? '你撤回了一条消息' : `"${msg.senderName || char.name}" 撤回了一条消息`;
            // 👇 核心修改：加上 white-space: nowrap; 强制不换行，并稍微放宽 max-width
            let recallHtml = `<div class="wc-system-msg-text" style="cursor: pointer; white-space: nowrap; max-width: 95%;" onclick="wcToggleRecallContent(${msg.id})">${recallText}</div>`;
            let originalHtml = `<div id="recall-content-${msg.id}" style="display: none; font-size: 12px; color: #888; margin-top: 4px; text-align: center; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 4px; max-width: 80%; word-break: break-word;">${displayContent}</div>`;
            
            row.innerHTML = `${sysCheckboxHtml}<div style="display: flex; flex-direction: column; align-items: center;">${recallHtml}${originalHtml}</div>`;
            
            const sysText = row.querySelector('.wc-system-msg-text');
            if (sysText) {
                sysText.addEventListener('touchstart', (e) => wcHandleTouchStart(e, msg.id));
                sysText.addEventListener('touchend', wcHandleTouchEnd);
                sysText.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    wcShowContextMenu(e.clientX, e.clientY, msg.id);
                });
            }
            
            container.insertBefore(row, anchor);
            return;
        }

        row.className = `wc-message-row ${msg.sender === 'me' ? 'me' : 'them'}`;
        let avatarUrl = msg.sender === 'me' ? userAvatar : char.avatar;
        
        // 👇 新增：如果是群聊，且有发送者名字，尝试匹配具体成员的头像
        let displayNameHtml = '';
        if (char.isGroup && msg.sender === 'them' && msg.senderName) {
            const member = wcState.characters.find(c => c.name === msg.senderName);
            if (member) {
                avatarUrl = member.avatar;
            } else {
                // 修复：如果找不到该成员，生成一个带首字母的默认头像，绝对不占用群聊头像
                const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#8E8E93"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="40">${msg.senderName[0] || '?'}</text></svg>`;
                avatarUrl = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(defaultAvatarSvg)));
            }
            displayNameHtml = `<div style="font-size: 11px; color: #888; margin-bottom: 4px; margin-left: 4px;">${msg.senderName}</div>`;
        }
        
        let quoteHtml = '';
        if (msg.quote) {
            quoteHtml = `<div class="wc-quote-block">${msg.quote}</div>`;
        }

        let contentHtml = '';
        
        // --- 修改开始：检测文字描述图片 ---
        // 如果是文本类型，且以 [图片描述] 开头
        if (msg.type === 'text' && msg.content.trim().startsWith('[图片描述]')) {
            // 提取描述文字，去掉前缀
            const descText = msg.content.replace('[图片描述]', '').trim();
            // 转义单双引号，防止 onclick 报错
            const safeDescText = descText.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            contentHtml = `
                <div class="wc-bubble ${msg.sender === 'me' ? 'me' : 'them'}" style="background: transparent; padding: 0; border: none;">
                    ${quoteHtml}
                    <div class="wc-text-img-placeholder" onclick="wcOpenImageDescCard('${safeDescText}')" style="width: 100px; height: 100px; background-color: #E5E5EA; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8E8E93; font-size: 10px; border: 1px solid #D1D1D6; overflow: hidden; text-align: center; padding: 5px; box-sizing: border-box; cursor: pointer;">
                        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px; margin-bottom: 4px; opacity: 0.5;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                        <div style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; width: 100%;">${descText || '图片'}</div>
                    </div>
                </div>`;
        } 
        // --- 修改结束 ---
        else if (msg.type === 'sticker') {
            contentHtml = `<div class="wc-bubble wc-bubble-sticker ${msg.sender === 'me' ? 'me' : 'them'}">${quoteHtml}<img src="${msg.content}" class="wc-sticker-img"></div>`;
        } else if (msg.type === 'image') {
            if (msg.content.startsWith('data:video/')) {
                contentHtml = `<div class="wc-bubble wc-bubble-sticker ${msg.sender === 'me' ? 'me' : 'them'}">${quoteHtml}<video src="${msg.content}" class="wc-bubble-img" controls autoplay loop muted playsinline></video></div>`;
            } else {
                contentHtml = `<div class="wc-bubble wc-bubble-sticker ${msg.sender === 'me' ? 'me' : 'them'}">${quoteHtml}<img src="${msg.content}" class="wc-bubble-img"></div>`;
            }
        } else if (msg.type === 'voice') {
            if (msg.showText) {
                contentHtml = `<div class="wc-bubble ${msg.sender === 'me' ? 'me' : 'them'}" onclick="wcToggleVoiceText(${msg.id})">${quoteHtml}[语音转文字] ${msg.content}</div>`;
            } else {
                contentHtml = `
                    <div class="wc-bubble voice ${msg.sender === 'me' ? 'me' : 'them'}" onclick="wcToggleVoiceText(${msg.id})">
                        ${quoteHtml}
                        <div class="wc-voice-bars">
                            <div class="wc-voice-bar"></div><div class="wc-voice-bar"></div><div class="wc-voice-bar"></div>
                        </div>
                    </div>`;
            }
        } else if (msg.type === 'transfer') {
            const isReceived = msg.status === 'received';
            const isRejected = msg.status === 'rejected';
            const statusClass = isReceived ? 'received' : (isRejected ? 'rejected' : 'pending');
            
            let statusText = '转账给您';
            if (msg.sender === 'me') statusText = '转账给对方';
            if (isReceived) statusText = '已收款';
            if (isRejected) statusText = '已退还';

            const tagText = isReceived ? 'RECEIVED' : (isRejected ? 'REJECTED' : 'TRANSFER');

            contentHtml = `
                <div class="wc-bubble transfer" style="background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important;">
                    ${quoteHtml}
                    <div class="ins-transfer-card ${statusClass}" onclick="wcHandleTransferClick(${msg.id})">
                        <div class="ins-transfer-header">
                            <div class="ins-transfer-tag">${tagText}</div>
                        </div>
                        <div class="ins-transfer-body">
                            <div class="ins-transfer-amount">¥${parseFloat(msg.amount).toFixed(2)}</div>
                            <div class="ins-transfer-note">${msg.note || '转账'}</div>
                        </div>
                        <div class="ins-transfer-footer">
                            <span class="ins-transfer-brand">WeChat Pay</span>
                            <span class="ins-transfer-status">${statusText}</span>
                        </div>
                    </div>
                </div>`;
         } else if (msg.type === 'avatar_invite') {
            const pair = lsState.coupleAvatars[msg.pairIndex];
            if (pair) {
                const statusText = msg.status === 'accepted' ? '已更换' : (msg.status === 'rejected' ? '已拒绝' : '点击选择头像');
                contentHtml = `
                    <div class="wc-bubble invite" style="background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important; display: block !important; width: fit-content !important;" onclick="lsOpenAvatarInviteModal(${charId}, '${msg.id}', ${msg.pairIndex})">
                        ${quoteHtml}
                        <div class="ins-invite-card-v2">
                            <div class="ins-invite-v2-content">
                                <div class="ins-invite-v2-header">
                                    <div class="ins-invite-v2-tag">COUPLE AVATAR</div>
                                    <svg class="ins-invite-v2-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                </div>
                                <div class="ins-invite-v2-body">
                                    <div class="ins-invite-v2-title">更换情侣头像</div>
                                    <div class="ins-invite-v2-subtitle">Ta 邀请你一起换上这组情头</div>
                                </div>
                                <div class="ins-invite-v2-footer">
                                    <div class="ins-invite-v2-status ${msg.status}">${statusText}</div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }
        } else if (msg.type === 'invite') {
            const statusText = msg.status === 'accepted' ? '已同意' : (msg.status === 'rejected' ? '已拒绝' : '等待回应');
            contentHtml = `
                <!-- 👇 核心修复：加上 display: block 和 width: fit-content，绝对禁止父级拉伸！ -->
                <div class="wc-bubble invite" style="background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important; display: block !important; width: fit-content !important;">
                    ${quoteHtml}
                    <div class="ins-invite-card-v2" onclick="wcHandleInviteClick(${msg.id})">
                        <div class="ins-invite-v2-content">
                            <div class="ins-invite-v2-header">
                                <div class="ins-invite-v2-tag">INVITATION</div>
                                <svg class="ins-invite-v2-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            </div>
                            <div class="ins-invite-v2-body">
                                <div class="ins-invite-v2-title">Lovers Space</div>
                                <div class="ins-invite-v2-subtitle">To join the private space</div>
                            </div>
                            <div class="ins-invite-v2-footer">
                                <div class="ins-invite-v2-status ${msg.status}">${statusText}</div>
                                <div class="ins-invite-v2-action">TAP TO VIEW</div>
                            </div>
                        </div>
                    </div>
                </div>`;
        } else if (msg.type === 'music_invite') {
            let statusText = 'Tap to join';
            if (msg.status === 'ended') statusText = '已结束，点击查看报告';
            else if (msg.status === 'rejected') statusText = '已婉拒，点击查看报告'; // 👈 新增婉拒状态文字

            let onClickAttr = '';
            
            // 🔪 核心修复：转义歌名和歌手名中的单双引号，防止破坏 HTML 结构导致卡片消失
            const safeTitle = (msg.songTitle || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const safeArtist = (msg.songArtist || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");

            // 👇 修改：如果是 ended 或 rejected，点击都打开总结报告
            if (msg.status === 'ended' || msg.status === 'rejected') {
                onClickAttr = `onclick="musicOpenSummaryModal('${msg.id}')"`;
            } else {
                if (msg.sender === 'them') {
                    // 如果是 Char 发出的邀请，点击卡片重新打开确认弹窗
                    onClickAttr = `onclick="musicShowCharInviteModal(${charId}, '${safeTitle}')"`;
                } else {
                    // 如果是 User 发出的邀请，点击卡片执行接受逻辑
                    onClickAttr = `onclick="musicAcceptInvite(${charId}, '${msg.songId}', '${safeTitle}', '${safeArtist}', '${msg.songCover}')"`;
                }
            }

            // 👇 核心修复：使用 flex 布局彻底消除幽灵空白，解决上下间距过大的问题
            contentHtml = `
                <div class="wc-bubble music-invite" style="background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important; display: flex !important; flex-direction: column !important; width: fit-content !important; font-size: 0 !important; line-height: 0 !important;" ${onClickAttr}>
                    ${quoteHtml}
                    <div class="ins-music-chat-card ${msg.status === 'ended' || msg.status === 'rejected' ? 'ended' : ''}">
                        <div class="ins-music-chat-top">
                            <div class="ins-music-chat-tag">Listen</div>
                            <svg class="ins-music-chat-icon" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        </div>
                        <div class="ins-music-chat-mid">
                            <div class="ins-music-chat-song">${msg.songTitle || '未知歌曲'}</div>
                            <div class="ins-music-chat-artist">${msg.songArtist || '未知歌手'}</div>
                        </div>
                        <div class="ins-music-chat-bottom">${statusText}</div>
                    </div>
                </div>`;

        } else if (msg.type === 'receipt') {
            // 新增：渲染购物小票
            contentHtml = `<div class="wc-bubble ${msg.sender === 'me' ? 'me' : 'them'}" style="background: transparent; padding: 0; border: none;">${msg.content}</div>`;
            
        } else if (msg.type === 'redpacket') {
            // 👇 新增：渲染微信红包卡片 👇
            const rp = msg.rpData;
            let typeText = '微信红包';
            if (rp.type === 'exclusive') typeText = `给 ${rp.target} 的专属红包`;
            
            let statusText = '查看红包';
            // 优化：如果是群聊且还没领完，显示“已领取(还有剩余)”
            if (rp.status === 'opened') statusText = rp.isGroup ? '已领取(还有剩余)' : '已领取';
            else if (rp.status === 'empty') statusText = '已被领完';
            else if (rp.status === 'refunded') statusText = '已退款';

            contentHtml = `
                <div class="wc-bubble redpacket" style="background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important;">
                    ${quoteHtml}
                    <div class="rp-bubble" onclick="wcClickRedPacket('${msg.id}')">
                        <div class="rp-bubble-top">
                            <svg class="rp-bubble-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="4" width="18" height="16" rx="3" fill="#FFF"/>
                                <path d="M3 8.5C7.5 11.5 10.5 13.5 12 14.5C13.5 13.5 16.5 11.5 21 8.5" stroke="#F28C48" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="14.5" r="3.5" fill="#F28C48" stroke="#FFF" stroke-width="1.5"/>
                                <rect x="11" y="13.5" width="2" height="2" fill="#FFF"/>
                            </svg>
                            <div class="rp-bubble-info">
                                <div class="rp-bubble-title">${rp.msg}</div>
                                <div class="rp-bubble-status" id="rp-status-${rp.id}">${statusText}</div>
                            </div>
                        </div>
                        <div class="rp-bubble-bottom">${typeText}</div>
                    </div>
                </div>`;
            // 👆 新增结束 👆
        } else if (msg.type === 'recipe') {
            // 新增：渲染全新高级感食谱卡片
            const isEdited = msg.isEdited;
            const isMe = msg.sender === 'me';
            
            let topHtml = '';
            if (isEdited) {
                topHtml = `<div class="r-tag updated">UPDATED</div><div class="r-update-dot"></div>`;
            } else {
                topHtml = `<div class="r-tag">DAILY</div><div class="r-cross"></div>`;
            }

            const watermarkText = isMe ? 'RECIPE' : 'MENU';

            contentHtml = `
                <div class="wc-bubble recipe" style="background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important;">
                    ${quoteHtml}
                    <div class="ins-recipe-bubble ${isMe ? '' : 'them'}" onclick="wcOpenRecipeDetail('${msg.id}')">
                        <div class="r-watermark">${watermarkText}</div>
                        <div class="r-top">${topHtml}</div>
                        <div class="r-center">
                            <div class="r-title">${msg.title}.</div>
                            <div class="r-subtitle">${msg.desc}</div>
                        </div>
                        <div class="r-bottom">
                            <div class="r-line"></div>
                            <div class="r-action">
                                ${isEdited ? 'VIEW' : 'TAP'} 
                                <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                        </div>
                    </div>
                </div>`;
                
        // 👇 新增：渲染高级感订单/外卖卡片 👇
        } else if (msg.type === 'order') {
            const data = msg.receiptData || {};
            const orderType = msg.orderType; // 'delivery', 'gift', 'daifu'
            
            let cardInnerHtml = '';
            let cardClass = '';

            if (orderType === 'delivery') {
                cardClass = 'delivery';
                cardInnerHtml = `
                    <div class="stub"><div class="stub-text">NO.${String(Math.floor(Math.random()*9000)+1000)}</div></div>
                    <div class="main">
                        <div class="stamp"></div>
                        <div class="tag">FOOD DELIVERY</div>
                        <div>
                            <div class="title">Ta's Order.</div>
                            <div class="desc">${data.items && data.items[0] ? data.items[0].name : '神秘外卖'}</div>
                        </div>
                        <div class="bottom">
                            <span>${msg.deliveryText || 'ETA: 30 MINS'}</span>
                            <span style="font-weight:bold; color:#111;">¥${data.total}</span>
                        </div>
                    </div>
                `;
            } else if (orderType === 'gift') {
                cardClass = 'gift';
                cardInnerHtml = `
                    <div class="main">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div class="tag">SURPRISE GIFT</div>
                            <span style="font-size: 10px; color: #555; font-family: monospace;">PAID</span>
                        </div>
                        <div>
                            <div class="title">For You.</div>
                            <div class="desc">${data.items && data.items[0] ? data.items[0].name : '神秘礼物'}</div>
                        </div>
                        <div class="barcode"></div>
                    </div>
                `;
            } else if (orderType === 'daifu') {
                cardClass = 'daifu';
                cardInnerHtml = `
                    <div class="main">
                        <div class="tag">PAYMENT REQUEST</div>
                        <div>
                            <div class="title">Please Pay.</div>
                            <div class="desc">${data.items && data.items[0] ? data.items[0].name : '代付请求'}</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; font-family: monospace; font-size: 10px; color: #718096;">
                            <span>${msg.deliveryText || '待支付'}</span>
                            <span style="font-weight:bold; color:#2D3748; font-size: 14px;">¥${data.total}</span>
                        </div>
                    </div>
                `;
            }

            contentHtml = `
                <div class="wc-bubble order" style="background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important;">
                    ${quoteHtml}
                    <div class="ins-order-bubble ${cardClass}" onclick="wcOpenReceiptDetail('${msg.id}')">
                        ${cardInnerHtml}
                    </div>
                </div>`;
        // 👆 新增结束 👆

        } else if (msg.type === 'call_record') {
            const isRejected = msg.status === 'rejected';
            const iconColor = isRejected ? '#FF3B30' : '#111';
            const iconSvg = isRejected 
                ? `<svg viewBox="0 0 24 24" style="fill:${iconColor};"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" transform="rotate(135 12 12)"/></svg>`
                : `<svg viewBox="0 0 24 24" style="fill:none; stroke:${iconColor}; stroke-width:2;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
            
            // 👈 修改：如果有 transcript，增加点击事件和“查看记录”提示
            let actionHtml = '';
            let clickAttr = '';
            if (msg.transcript && msg.transcript.length > 0) {
                actionHtml = `<div style="font-size: 11px; color: #007AFF; margin-top: 4px; font-weight: bold;">查看记录 &gt;</div>`;
                clickAttr = `onclick="wcOpenCallTranscript(${msg.id})" style="cursor: pointer;"`;
            }

            contentHtml = `
                <div class="wc-bubble call-record ${msg.sender === 'me' ? 'me' : 'them'}" ${clickAttr}>
                    <div class="ins-call-record-card" style="flex-direction: column; align-items: flex-start;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${iconSvg}
                            <span class="ins-call-record-text">${msg.content}</span>
                            ${msg.duration ? `<span class="ins-call-record-time">${msg.duration}</span>` : ''}
                        </div>
                        ${actionHtml}
                    </div>
                </div>`;
        // 👆 新增的代码到这里结束 👆
        
        } else {
        
            // 检测是否包含 <span> 标签 (支持多段翻译交替)
            const hasTranslation = /<span[^>]*>([\s\S]*?)<\/span>/i.test(msg.content);
            
            if (hasTranslation) {
                // 提取原文：移除所有 <span>...</span> 及其前面的 <br> 或 \n
                const originalText = msg.content.replace(/(?:<br\s*\/?>|\n)*\s*<span[^>]*>[\s\S]*?<\/span>\s*/gi, '').replace(/^(<br\s*\/?>|\s)+|(<br\s*\/?>|\s)+$/gi, '');
                // 提取译文：提取所有 <span> 里面的内容，并用 <br> 连接
                const translatedText = Array.from(msg.content.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map(m => m[1]).join('<br>');
                
                const transId = 'trans-' + Math.random().toString(36).substr(2, 9);
                
                contentHtml = `<div class="wc-bubble ${msg.sender === 'me' ? 'me' : 'them'}" onclick="const el = document.getElementById('${transId}'); if(el.style.display==='none'){el.style.display='block';}else{el.style.display='none';}" style="cursor: pointer; -webkit-tap-highlight-color: transparent;">${quoteHtml}<div style="word-break: break-word; width: 100%;">${originalText}</div><div id="${transId}" style="display: none; width: 100%; margin-top: 8px;"><div style="height: 1px; width: 100%; background-color: ${msg.sender === 'me' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)'}; margin-bottom: 8px;"></div><div style="font-size: 14px; word-break: break-word; color: ${msg.sender === 'me' ? '#CCCCCC' : '#888888'};">${translatedText}</div></div></div>`;
            } else {
                contentHtml = `<div class="wc-bubble ${msg.sender === 'me' ? 'me' : 'them'}">${quoteHtml}${msg.content}</div>`;
            }
        }

        const checkboxHtml = `<div class="wc-msg-checkbox ${wcState.multiSelectedIds.includes(msg.id) ? 'checked' : ''}" onclick="wcToggleMultiSelectMsg(${msg.id})"></div>`;
        const timeHtml = `<span class="wc-msg-timestamp-outside">${wcFormatTime(msg.time)}</span>`;

        // 👇 核心修改：如果是拉黑拒收的消息，添加红色感叹号 👇
        if (msg.isBlockedError) {
            const errorIconHtml = `<div style="margin: 0 8px; width: 20px; height: 20px; background: #FF3B30; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; cursor: pointer; flex-shrink: 0; z-index: 10;" onclick="alert('消息被拒收')">!</div>`;
            if (msg.sender === 'me') {
                contentHtml = `<div style="display: flex; align-items: center;">${errorIconHtml}${contentHtml}</div>`;
            } else {
                contentHtml = `<div style="display: flex; align-items: center;">${contentHtml}${errorIconHtml}</div>`;
            }
        }
        // 👆 修改结束 👆

        const bubbleWrapper = document.createElement('div');
        bubbleWrapper.className = 'wc-bubble-container';
        bubbleWrapper.innerHTML = displayNameHtml + contentHtml; // 👈 把名字拼进去
        
        bubbleWrapper.addEventListener('touchstart', (e) => wcHandleTouchStart(e, msg.id));
        bubbleWrapper.addEventListener('touchend', wcHandleTouchEnd);
        bubbleWrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            wcShowContextMenu(e.clientX, e.clientY, msg.id);
        });

        if (msg.sender === 'me') {
            row.innerHTML = `${checkboxHtml}<img src="${avatarUrl}" class="wc-chat-avatar">`;
            row.appendChild(bubbleWrapper);
            row.insertAdjacentHTML('beforeend', timeHtml);
        } else {
            // 【新增】：群聊模式下绑定长按 @ 事件，单聊保留查手机
            let avatarHtml = '';
            if (char.isGroup && msg.senderName) {
                avatarHtml = `<img src="${avatarUrl}" class="wc-chat-avatar" style="cursor: pointer;" oncontextmenu="event.preventDefault(); wcAtMember('${msg.senderName}');" ontouchstart="wcAvatarTouchStart(event, '${msg.senderName}')" ontouchend="wcAvatarTouchEnd(event)">`;
            } else {
                const clickAction = char.isGroup ? '' : `onclick="wcPromptEnterPhone(${charId}, '${char.name}')" style="cursor: pointer;"`;
                avatarHtml = `<img src="${avatarUrl}" class="wc-chat-avatar" ${clickAction}>`;
            }
            
            row.innerHTML = `${checkboxHtml}${avatarHtml}`;
            row.appendChild(bubbleWrapper);
            row.insertAdjacentHTML('beforeend', timeHtml);
        }

        container.insertBefore(row, anchor);
    });

    // 恢复滚动位置 (仅在点击加载更多时触发)
    if (preserveScroll) {
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - oldScrollHeight + oldScrollTop;
        });
    }
}
// ==========================================
// 新增：高级文字图片描述卡片逻辑
// ==========================================
window.wcOpenImageDescCard = function(text) {
    const bodyEl = document.getElementById('wc-image-desc-body');
    if (bodyEl) {
        bodyEl.innerText = text;
    }
    const overlay = document.getElementById('wc-image-desc-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
};

window.wcCloseImageDescCard = function() {
    const overlay = document.getElementById('wc-image-desc-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
};

// ==========================================
// 新增：群聊长按头像 @ 成员逻辑 (带防抖修复)
// ==========================================
let avatarLongPressTimer = null;
let lastAtTime = 0; // 新增：记录上次触发的时间

window.wcAvatarTouchStart = function(e, name) {
    avatarLongPressTimer = setTimeout(() => {
        wcAtMember(name);
    }, 500); // 长按 0.5 秒触发
};

window.wcAvatarTouchEnd = function(e) {
    if (avatarLongPressTimer) {
        clearTimeout(avatarLongPressTimer);
        avatarLongPressTimer = null;
    }
};

window.wcAtMember = function(name) {
    const now = Date.now();
    // 【修复】：如果距离上次触发不到 500 毫秒，直接拦截，防止手机端事件连发
    if (now - lastAtTime < 500) return; 
    lastAtTime = now;

    const input = document.getElementById('wc-chat-input');
    if (input) {
        // 在输入框追加 @名字
        input.value += `@${name} `;
        input.focus();
        // 触发震动反馈
        if (navigator.vibrate) navigator.vibrate(50);
    }
};


function wcScrollToBottom(force = false) {
    const area = document.getElementById('wc-chat-messages');
    
    requestAnimationFrame(() => {
        if (area) {
            if (force) {
                area.scrollTop = area.scrollHeight;
            } else {
                // 尝试平滑滚动，如果不支持则直接赋值
                try {
                    area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
                } catch (e) {
                    area.scrollTop = area.scrollHeight;
                }
            }
        }
    });
}

// --- WeChat Interaction ---
function wcHandleTouchStart(e, msgId) {
    wcState.longPressTimer = setTimeout(() => {
        const touch = e.touches[0];
        wcShowContextMenu(touch.clientX, touch.clientY, msgId);
    }, 500);
}

function wcHandleTouchEnd() {
    if (wcState.longPressTimer) {
        clearTimeout(wcState.longPressTimer);
        wcState.longPressTimer = null;
    }
}

// ==========================================================================
// 核心修复：在这里修复 Bug
// ==========================================================================
function wcShowContextMenu(x, y, msgId) {
    wcState.selectedMsgId = msgId;
    const menu = document.getElementById('wc-context-menu');
    
    // 找到被点击的消息
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === msgId);
    
    // 获取菜单中的“编辑”按钮
    const editBtn = menu.querySelector('.wc-ctx-item[onclick="wcHandleEdit()"]');
    const recallBtn = menu.querySelector('#wc-ctx-recall');

    if (msg && editBtn) {
        // 允许编辑所有类型的消息，以便进行格式修复
        editBtn.style.display = 'flex'; 
    }
    
    // 只有自己发的消息，且还未被撤回，才能显示撤回按钮
    if (msg && msg.sender === 'me' && msg.type !== 'recall' && recallBtn) {
        recallBtn.style.display = 'flex';
    } else if (recallBtn) {
        recallBtn.style.display = 'none';
    }

    const menuWidth = 150;
    const menuHeight = 180; // 恢复原来的高度
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    if (x + menuWidth > screenW) x = screenW - menuWidth - 10;
    if (y + menuHeight > screenH) y = screenH - menuHeight - 10;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'flex';
}

function wcHideContextMenu() {
    document.getElementById('wc-context-menu').style.display = 'none';
    wcState.selectedMsgId = null;
}

window.wcHandleRecall = function() {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === wcState.selectedMsgId);
    if (!msg || msg.sender !== 'me') return;

    // 保存原始信息
    msg.originalType = msg.type;
    msg.originalContent = msg.content;
    
    // 变更为撤回类型
    msg.type = 'recall';
    msg.content = '你撤回了一条消息';
    
    // 50% 概率让 Char 看到你撤回了消息
    if (Math.random() < 0.5) {
        let displayContent = msg.originalContent;
        if (msg.originalType === 'image' || msg.originalType === 'sticker') displayContent = '[图片/表情包]';
        else if (msg.originalType === 'voice') displayContent = '[语音]';
        
        wcAddMessage(wcState.activeChatId, 'system', 'system', `[系统提示: User 刚刚撤回了一条消息，撤回的内容是："${displayContent}"]`, { hidden: true });
    }
    
    wcSaveData();
    wcRenderMessages(wcState.activeChatId);
    wcHideContextMenu();
};

window.wcToggleRecallContent = function(msgId) {
    const el = document.getElementById(`recall-content-${msgId}`);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
};

function wcHandleReply() {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === wcState.selectedMsgId);
    if (msg) {
        wcState.replyingToMsgId = msg.id;
        let displayHtml = '';
        
        // 判断消息类型，如果是表情包或图片，则显示图片标签
        if (msg.type === 'text') {
            displayHtml = msg.content;
        } else if (msg.type === 'sticker' || msg.type === 'image') {
            if (msg.content.startsWith('data:video/')) {
                displayHtml = `[视频] <video src="${msg.content}" muted playsinline></video>`;
            } else {
                displayHtml = `[图片] <img src="${msg.content}">`;
            }
        } else {
            displayHtml = `[${msg.type}]`;
        }
        
        // 注意：这里把 innerText 改成了 innerHTML，以便渲染 img 标签
        document.getElementById('wc-quote-text-content').innerHTML = displayHtml;
        document.getElementById('wc-quote-preview-area').style.display = 'flex';
        document.getElementById('wc-chat-input').focus();
    }
    wcHideContextMenu();
}

function wcCancelQuote() {
    wcState.replyingToMsgId = null;
    document.getElementById('wc-quote-preview-area').style.display = 'none';
}

// ==========================================================================
// 核心修改：使用新的、专用的编辑弹窗
// ==========================================================================
function wcHandleEdit() {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === wcState.selectedMsgId);
    if (!msg) return;
    
    const modal = document.getElementById('wc-modal-edit-message');
    const textarea = document.getElementById('wc-edit-message-textarea');
    const confirmBtn = document.getElementById('wc-edit-message-confirm');
    const formatBtns = document.querySelectorAll('#wc-edit-format-btns .format-btn');

    // 初始化文本框内容和当前类型
    let initialText = msg.content;
    let currentType = 'text';

    // 根据消息原本的类型，反向解析出文本供用户编辑
    if (msg.type === 'transfer') {
        currentType = 'transfer';
        initialText = `${msg.amount || 0} ${msg.note || "转账"}`; // 简化为纯文本
    } else if (msg.type === 'voice') {
        currentType = 'voice';
    } else if (msg.type === 'sticker') {
        currentType = 'sticker';
        const desc = wcFindStickerDescByUrl(msg.content);
        initialText = desc || msg.content;
    } else if (msg.type === 'text' && msg.content.startsWith('[图片描述]')) {
        currentType = 'image_desc';
        initialText = msg.content.replace(/^\[图片描述\]\s*/, '');
    } else if (msg.type === 'receipt' && msg.content.includes('wc-bubble-location-card')) {
        currentType = 'location';
        const titleMatch = msg.content.match(/<div class="wc-bubble-location-title">(.*?)<\/div>/);
        initialText = titleMatch ? titleMatch[1] : "未知地点";
    } else {
        // 检测是否为双语翻译格式
        const hasTranslation = /<span[^>]*>([\s\S]*?)<\/span>/i.test(msg.content);
        if (hasTranslation) {
            currentType = 'translate';
            const originalText = msg.content.replace(/(?:<br\s*\/?>|\n)*\s*<span[^>]*>[\s\S]*?<\/span>\s*/gi, '').replace(/^(<br\s*\/?>|\s)+|(<br\s*\/?>|\s)+$/gi, '');
            const translatedText = Array.from(msg.content.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map(m => m[1]).join('\n');
            initialText = `${originalText}\n${translatedText}`; // 用换行分隔
        }
    }

    textarea.value = initialText;

    // 更新按钮高亮状态的辅助函数
    const updateBtns = (type) => {
        formatBtns.forEach(btn => {
            if (btn.dataset.type === type) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    };
    updateBtns(currentType);

    // 绑定格式按钮点击事件 (移除自动修改 textarea.value 的逻辑)
    formatBtns.forEach(btn => {
        btn.onclick = () => {
            currentType = btn.dataset.type;
            updateBtns(currentType);
        };
    });

    // 确认保存逻辑
    confirmBtn.onclick = () => {
        const newText = textarea.value.trim();
        if (!newText) return alert("内容不能为空");

        const char = wcState.characters.find(c => c.id === wcState.activeChatId);
        const stickerGroupIds = char && char.chatConfig ? char.chatConfig.stickerGroupIds : [];

        // 根据选中的格式，重新构造消息
        if (currentType === 'split') {
            // 按换行符拆分文本
            const lines = newText.split('\n').filter(line => line.trim() !== '');
            if (lines.length > 0) {
                // 第一行更新当前消息
                msg.type = 'text';
                msg.content = lines[0].trim();
                
                // 后续行作为新消息插入到当前消息之后
                const msgs = wcState.chats[wcState.activeChatId];
                const msgIndex = msgs.findIndex(m => m.id === msg.id);
                
                for (let i = 1; i < lines.length; i++) {
                    const newMsg = {
                        id: Date.now() + Math.random() + i,
                        sender: msg.sender,
                        type: 'text',
                        content: lines[i].trim(),
                        time: msg.time + i, // 稍微增加一点时间保证顺序
                        name: msg.name // 继承发送者名字（群聊兼容）
                    };
                    msgs.splice(msgIndex + i, 0, newMsg);
                }
            }
        } else if (currentType === 'text') {
            msg.type = 'text';
            msg.content = newText;
        } else if (currentType === 'image_desc') {
            msg.type = 'text';
            msg.content = `[图片描述] ${newText}`;
        } else if (currentType === 'voice') {
            msg.type = 'voice';
            msg.content = newText;
        } else if (currentType === 'sticker') {
            const url = wcFindStickerUrlMulti(stickerGroupIds, newText);
            if (url) {
                msg.type = 'sticker';
                msg.content = url;
            } else {
                msg.type = 'text';
                msg.content = `[表情: ${newText}]`;
            }
        } else if (currentType === 'transfer') {
            msg.type = 'transfer';
            // 智能提取数字作为金额，剩下的作为备注
            const match = newText.match(/(\d+(\.\d+)?)/);
            msg.amount = match ? match[1] : "100";
            msg.note = newText.replace(msg.amount, '').trim() || "转账";
            msg.status = 'pending';
        } else if (currentType === 'location') {
            msg.type = 'receipt';
            const locTitle = newText;
            const locDesc = "定位";
            
            // 👇 新增：安全转义
            const safeLocTitle = locTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");
            
            // 👇 修改：onclick 里面使用 safeLocTitle
            msg.content = `
                <div class="wc-bubble-location-card" onclick="window.wcOpenMapView(true, '${safeLocTitle}', '${locDesc}', 0, 0)">
                    <div class="wc-bubble-location-map virtual">
                        <div class="ins-loc-marker virtual-marker"></div>
                    </div>
                    <div class="wc-bubble-location-info">
                        <div class="wc-bubble-location-title">${locTitle}</div>
                        <div class="wc-bubble-location-desc">${locDesc}</div>
                    </div>
                </div>
            `;
        } else if (currentType === 'translate') {
            msg.type = 'text';
            // 尝试按换行符分割原文和译文
            const lines = newText.split('\n').filter(line => line.trim() !== '');
            if (lines.length >= 2) {
                const originalText = lines[0].trim();
                const translatedText = lines.slice(1).join(' ').trim();
                msg.content = `${originalText}<br><span style='font-size: 0.85em; opacity: 0.7;'>${translatedText}</span>`;
            } else {
                // 如果没有换行，默认当成原文，译文留空提示
                msg.content = `${newText}<br><span style='font-size: 0.85em; opacity: 0.7;'>[译文]</span>`;
            }
        }

        wcSaveData();
        wcRenderMessages(wcState.activeChatId);
        wcCloseModal('wc-modal-edit-message');
    };
    
    wcOpenModal('wc-modal-edit-message');
    textarea.focus();
    wcHideContextMenu();
}

function wcHandleDelete() {
    if (confirm("确定删除这条消息吗？")) {
        // 同步删除恋人空间日志 (增加容错保护)
        try {
            lsRemoveFeedByMsgId(wcState.selectedMsgId);
        } catch (e) {
            console.warn("同步删除日志失败", e);
        }
        
        if (wcState.chats[wcState.activeChatId]) {
            wcState.chats[wcState.activeChatId] = wcState.chats[wcState.activeChatId].filter(m => m.id !== wcState.selectedMsgId);
            wcSaveData();
            wcRenderMessages(wcState.activeChatId);
        }
    }
    wcHideContextMenu();
}

// 👇 新增：用于在多选模式下备份原始聊天记录
let wcMultiSelectBackupChat = null;

function wcHandleMultiSelect() {
    wcState.isMultiSelectMode = true;
    wcState.multiSelectedIds = [wcState.selectedMsgId];
    
    // 🌟 核心机制：进入多选模式时，深拷贝备份当前聊天记录
    const charId = wcState.activeChatId;
    if (wcState.chats[charId]) {
        wcMultiSelectBackupChat = JSON.parse(JSON.stringify(wcState.chats[charId]));
    }
    
    // 👇 新增：给 body 添加多选模式的专属类名 👇
    document.body.classList.add('multi-select-active');
    
    wcHideContextMenu();
    wcRenderMessages(wcState.activeChatId);
    document.getElementById('wc-multi-select-footer').style.display = 'flex';
    document.getElementById('wc-chat-footer').style.display = 'none';
    
    // 隐藏原有的全局导航栏
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'none';
    
    // 显示专属独立顶栏
    const multiHeader = document.getElementById('wc-multi-select-header');
    const multiTitle = document.getElementById('wc-multi-header-title');
    if (multiHeader && multiTitle) {
        multiHeader.classList.add('active');
        multiTitle.innerText = `已选择 ${wcState.multiSelectedIds.length} 条消息`;
    }

    setTimeout(() => wcScrollToBottom(true), 50);
}

function wcToggleMultiSelectMsg(msgId) {
    if (wcState.multiSelectedIds.includes(msgId)) {
        wcState.multiSelectedIds = wcState.multiSelectedIds.filter(id => id !== msgId);
    } else {
        wcState.multiSelectedIds.push(msgId);
    }
    wcRenderMessages(wcState.activeChatId);
    
    // 实时更新专属顶栏数量
    const multiTitle = document.getElementById('wc-multi-header-title');
    if (multiTitle && wcState.isMultiSelectMode) {
        multiTitle.innerText = `已选择 ${wcState.multiSelectedIds.length} 条消息`;
    }
}

function wcHandleMultiDeleteAction() {
    if (wcState.multiSelectedIds.length === 0) return;
    if (confirm(`确定删除选中的 ${wcState.multiSelectedIds.length} 条消息吗？\n(注意：删除后需点击右上角[保存]才会真正生效)`)) {
        
        if (wcState.chats[wcState.activeChatId]) {
            // 🌟 核心机制：只修改内存数据，不调用 wcSaveData()
            wcState.chats[wcState.activeChatId] = wcState.chats[wcState.activeChatId].filter(m => !wcState.multiSelectedIds.includes(m.id));
            
            // 清空选中项，但保持多选模式开启，以便预览
            wcState.multiSelectedIds = [];
            wcRenderMessages(wcState.activeChatId);
            
            const multiTitle = document.getElementById('wc-multi-header-title');
            if (multiTitle) multiTitle.innerText = `已选择 0 条消息`;
        }
    }
}

function wcHandleMultiAutoRepairAction() {
    if (wcState.multiSelectedIds.length === 0) return alert("请先勾选掉格式的消息哦~");
    
    const charId = wcState.activeChatId;
    const char = wcState.characters.find(c => c.id === charId);
    const msgs = wcState.chats[charId];
    if (!char || !msgs) return;

    // 1. 提取并按时间排序选中的消息
    const selectedMsgs = msgs.filter(m => wcState.multiSelectedIds.includes(m.id)).sort((a, b) => a.time - b.time);
    const firstMsg = selectedMsgs[0];
    const insertIndex = msgs.findIndex(m => m.id === firstMsg.id); 
    
    // 2. 拼接所有残缺的文本
    let rawText = selectedMsgs.map(m => m.content).join('');
    let cleanText = rawText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
    cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let actions = [];

    // 3. 终极碎片提取模式
    let extractedObjects = [];
    let depth = 0; 
    let start = -1; 
    let inString = false; 
    let escapeNext = false;

    for (let i = 0; i < cleanText.length; i++) {
        const charStr = cleanText[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (charStr === '\\') { escapeNext = true; continue; }
        if (charStr === '"') { inString = !inString; continue; }
        
        if (!inString) {
            if (charStr === '{') { 
                if (depth === 0) start = i; 
                depth++; 
            } else if (charStr === '}') {
                depth--;
                if (depth === 0 && start !== -1) {
                    let objStr = cleanText.substring(start, i + 1);
                    try {
                        objStr = objStr.replace(/\n/g, '\\n').replace(/\r/g, '');
                        let obj = JSON.parse(objStr);
                        extractedObjects.push(obj);
                    } catch(err) {
                        const typeMatch = objStr.match(/"type"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const contentMatch = objStr.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const senderMatch = objStr.match(/"senderName"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        if (contentMatch) {
                            let fallbackObj = {
                                type: typeMatch ? typeMatch[1].replace(/\\"/g, '"') : 'text',
                                content: contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
                            };
                            if (senderMatch) fallbackObj.senderName = senderMatch[1].replace(/\\"/g, '"');
                            extractedObjects.push(fallbackObj);
                        }
                    }
                    start = -1;
                }
            }
        }
    }

    // 4. 处理提取到的对象
    if (extractedObjects.length > 0) {
        extractedObjects.forEach(obj => {
            if (obj.replies && Array.isArray(obj.replies)) {
                actions.push(...obj.replies);
            } else if (obj.type && obj.content) {
                actions.push(obj);
            } else if (obj.content) {
                actions.push({ type: 'text', content: obj.content });
            }
        });
    } else {
        const contentRegex = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let match;
        while ((match = contentRegex.exec(cleanText)) !== null) {
            actions.push({ type: 'text', content: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') });
        }
    }

    if (actions.length === 0) {
        return alert("解析失败：选中的文本中没有找到任何有效的格式标签，请尝试取消多选后，长按单条消息进行手动编辑。");
    }

    // 6. 将解析出的 actions 转换为真正的消息对象
    const stickerGroupIds = char.chatConfig ? char.chatConfig.stickerGroupIds : [];
    let newParsedMsgs = [];
    let baseTime = firstMsg.time;

    actions.forEach((action, idx) => {
        if (!action || !action.content) return;
        
        let finalType = action.type || 'text';
        let finalContent = action.content;
        
        if (finalType === 'text') {
            let imgMatch = finalContent.match(/[\[【]发送了一张图片[，,]?\s*图片ID[：:]\s*(.*?)[\]】]/) || 
                           finalContent.match(/[\[【]图片[：:]\s*(.*?)[\]】]/) || 
                           finalContent.match(/^[\[【]图片描述[\]】][：:]?\s*(.*)/);
            if (imgMatch) {
                finalType = 'text';
                finalContent = `[图片描述] ${imgMatch[1].trim()}`;
            }
        }
        
        if (finalType === 'sticker') {
            const url = wcFindStickerUrlMulti(stickerGroupIds, finalContent);
            if (url) {
                finalContent = url;
            } else {
                finalType = 'text';
                finalContent = `[表情: ${finalContent}]`;
            }
        }

        newParsedMsgs.push({
            id: Date.now() + Math.random() + idx,
            sender: firstMsg.sender, 
            name: action.senderName || firstMsg.name, 
            type: finalType,
            content: finalContent,
            time: baseTime + idx 
        });
    });

    // 7. 替换原数组中的数据
    let finalMsgs = msgs.filter(m => !wcState.multiSelectedIds.includes(m.id));
    finalMsgs.splice(insertIndex, 0, ...newParsedMsgs);
    
    // 🌟 核心机制：只修改内存数据，不调用 wcSaveData()
    wcState.chats[charId] = finalMsgs;
    
    // 清空选中项，保持多选模式开启，以便预览
    wcState.multiSelectedIds = [];
    wcRenderMessages(charId);
    
    const multiTitle = document.getElementById('wc-multi-header-title');
    if (multiTitle) multiTitle.innerText = `已选择 0 条消息`;
    
    alert(`✨ 智能修复预览成功！\n已将选中的残缺文本解析为 ${newParsedMsgs.length} 个气泡。\n请确认无误后，点击右上角【保存】生效。`);
}

// 👇 新增：点击“取消”按钮的逻辑
function wcCancelMultiSelectMode() {
    wcExitMultiSelectMode(); // 直接调用退出，里面已经包含了恢复备份的逻辑
}

// 👇 新增：点击“保存”按钮的逻辑
function wcSaveMultiSelectMode() {
    const charId = wcState.activeChatId;
    
    // 真正执行保存，写入数据库
    wcSaveData();
    
    // 同步清理恋人空间日志中可能已经失效的 msgId
    if (typeof lsState !== 'undefined' && lsState.feed && wcState.chats[charId]) {
        const currentMsgIds = wcState.chats[charId].map(m => m.id);
        lsState.feed = lsState.feed.filter(f => !f.msgId || currentMsgIds.includes(f.msgId));
        if (typeof lsSaveData === 'function') lsSaveData();
    }
    
    // 清空备份，这样 wcExitMultiSelectMode 就不会触发恢复逻辑了
    wcMultiSelectBackupChat = null; 
    wcExitMultiSelectMode();
}

// 👇 核心修复：恢复 wcExitMultiSelectMode 命名，防止返回键报错
function wcExitMultiSelectMode() {
    const charId = wcState.activeChatId;
    
    // 如果还有备份数据没清空（说明不是通过点保存退出的），默认执行取消恢复原状
    if (wcMultiSelectBackupChat && wcState.chats[charId]) {
        wcState.chats[charId] = JSON.parse(JSON.stringify(wcMultiSelectBackupChat));
    }
    wcMultiSelectBackupChat = null; // 清空备份

    wcState.isMultiSelectMode = false;
    wcState.multiSelectedIds = [];
    
    // 👇 新增：退出多选模式时，移除专属类名 👇
    document.body.classList.remove('multi-select-active');
    
    const footer = document.getElementById('wc-multi-select-footer');
    if (footer) footer.style.display = 'none';
    
    const chatFooter = document.getElementById('wc-chat-footer');
    if (chatFooter) chatFooter.style.display = 'flex';
    
    wcRenderMessages(wcState.activeChatId);
    
    // 隐藏专属独立顶栏
    const multiHeader = document.getElementById('wc-multi-select-header');
    if (multiHeader) {
        multiHeader.classList.remove('active');
    }
    
    // 恢复原有的全局导航栏
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'flex';
    
    // 恢复顶栏状态显示
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (char) updateChatTopBarStatus(char);
}

let wcBackspaceCount = 0;
let wcBackspaceTimer = null;

function wcHandleEnter(e) {
    if (e.key === 'Enter') {
        if (!e.shiftKey) {
            e.preventDefault();
            wcSendMsg();
        }
    } else if (e.key === 'Backspace') {
        // 👇 新增：连续按 5 次退格键触发隐藏消息显示
        const input = document.getElementById('wc-chat-input');
        if (input && input.value === '') {
            wcBackspaceCount++;
            if (wcBackspaceTimer) clearTimeout(wcBackspaceTimer);
            wcBackspaceTimer = setTimeout(() => { wcBackspaceCount = 0; }, 1000); // 1秒内连续按才有效
            
            if (wcBackspaceCount >= 5) {
                wcBackspaceCount = 0;
                wcState.showHiddenMessages = !wcState.showHiddenMessages;
                if (typeof showMainSystemNotification === 'function') {
                    showMainSystemNotification("开发者模式", wcState.showHiddenMessages ? "已开启隐藏提示显示" : "已关闭隐藏提示显示");
                } else {
                    alert(wcState.showHiddenMessages ? "已开启隐藏提示显示" : "已关闭隐藏提示显示");
                }
                wcRenderMessages(wcState.activeChatId, true); // 保持滚动位置刷新
            }
        }
    }
}

function wcSendMsg() {
    const input = document.getElementById('wc-chat-input');
    const text = input.value.trim();
    if (!text) return;

    const charId = wcState.activeChatId;
    const char = wcState.characters.find(c => c.id === charId);
    
    // 检查用户是否被禁言
    if (char && char.isGroup && char.mutedMembers && char.mutedMembers.includes('user')) {
        alert("你已被群主禁言，无法发送消息。");
        input.value = '';
        return;
    }

    // 主动发送消息时的时间感知记录
    if (char && (!char.chatConfig || char.chatConfig.timePerceptionEnabled !== false)) {
        const msgs = wcState.chats[charId] || [];
        const validMsgs = msgs.filter(m => m.type !== 'system' && !m.isError);
        if (validMsgs.length > 0) {
            const lastMsg = validMsgs[validMsgs.length - 1];
            const now = Date.now();
            const gapMs = now - lastMsg.time;
            
            if (gapMs >= 10 * 60 * 1000) { 
                const gapMinutes = Math.floor(gapMs / 60000);
                const gapHours = Math.floor(gapMinutes / 60);
                const gapDays = Math.floor(gapHours / 24);
                
                const remainHours = gapHours % 24;
                const remainMinutes = gapMinutes % 60;

                let timeGapStr = "";
                if (gapDays > 0) timeGapStr += `${gapDays}天`;
                if (remainHours > 0) timeGapStr += `${remainHours}小时`;
                if (remainMinutes > 0 || timeGapStr === "") timeGapStr += `${remainMinutes}分钟`;

                const prompt = `[系统通知：距离上次互动已过去 ${timeGapStr}。请注意时间流逝。]`;
                wcAddMessage(charId, 'system', 'system', prompt, { hidden: true });
            }
        }
    }

    // 👇 核心修复：统一声明 extra 对象，并打上拉黑拒收标记 👇
    let extra = {};
    if (char && char.isBlocked) {
        extra.isBlockedError = true;
    }

    if (wcState.replyingToMsgId) {
        const msgs = wcState.chats[wcState.activeChatId];
        const replyMsg = msgs.find(m => m.id === wcState.replyingToMsgId);
        if (replyMsg) {
            let replyContentHtml = '';
            if (replyMsg.type === 'text') {
                replyContentHtml = replyMsg.content;
            } else if (replyMsg.type === 'sticker' || replyMsg.type === 'image') {
                replyContentHtml = `<img src="${replyMsg.content}">`;
            } else {
                replyContentHtml = `[${replyMsg.type}]`;
            }
            const senderName = replyMsg.sender === 'me' ? wcState.user.name : wcState.characters.find(c=>c.id===wcState.activeChatId).name;
            extra.quote = `${senderName}: ${replyContentHtml}`;
        }
        wcCancelQuote();
    }

    wcAddMessage(wcState.activeChatId, 'me', 'text', text, extra);
    input.value = '';
}

// 👇 新增：群聊 @ 成员逻辑 👇
window.wcShowAtList = function(groupChar) {
    const list = document.getElementById('wc-at-mention-list');
    list.innerHTML = '';
    if (!groupChar.members) return;
    
    groupChar.members.forEach(mId => {
        if (mId === 'user') return; // 一般不 @ 自己
        const m = wcState.characters.find(c => c.id === mId);
        if (m) {
            const div = document.createElement('div');
            div.className = 'wc-at-item';
            div.innerHTML = `<img src="${m.avatar}"><span>${m.name}</span>`;
            div.onclick = () => wcSelectAtMember(m.name);
            list.appendChild(div);
        }
    });
    list.classList.remove('hidden');
};

window.wcSelectAtMember = function(name) {
    const input = document.getElementById('wc-chat-input');
    // 将 @ 后面的内容补全为名字
    input.value += name + ' ';
    document.getElementById('wc-at-mention-list').classList.add('hidden');
    input.focus();
};
// 👆 新增结束 👆

// --- WeChat AI & API Logic ---
async function wcTriggerAI(charIdOverride = null) {
    const charId = charIdOverride || wcState.activeChatId;
    
    // 【修复】：防止重复触发 AI 导致发一堆重复消息
    if (aiGeneratingLocks[charId]) {
        console.log(`Char ${charId} 正在生成中，拦截重复请求`);
        return;
    }
    aiGeneratingLocks[charId] = true;

    const char = wcState.characters.find(c => c.id === charId);
    if (!char) {
        aiGeneratingLocks[charId] = false;
        return;
    }

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.baseUrl || !apiConfig.key || !apiConfig.model) {
        if (!charIdOverride) alert("请先在系统设置中配置 API 地址、密钥并选择模型！");
        aiGeneratingLocks[charId] = false;
        return;
    }

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcAddMessage(charId, 'system', 'system', '[警告] 已达到API调用上限，请稍后再试或修改设置。', { isError: true });
        aiGeneratingLocks[charId] = false;
        return;
    }
    // 【修复】：只修改名字部分，保留头像和生活状态
    const nameEl = document.getElementById('wc-topbar-name');
    if (nameEl && !charIdOverride) {
        nameEl.innerText = "正在输入...";
    }
    sessionApiCallCount++;

    try {
        const config = char.chatConfig || {};
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeString = `${year}年${month}月${date}日 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
        // ==========================================
        // AI 节日与日历事件感知系统 (支持双重关联)
        // ==========================================
        const holidays = {
            "01-01": "元旦", "02-14": "情人节", "03-08": "妇女节", "04-01": "愚人节", 
            "05-01": "劳动节", "05-20": "520表白日", "06-01": "儿童节", "10-01": "国庆节", 
            "12-24": "平安夜", "12-25": "圣诞节", "12-31": "跨年夜"
        };
        const todayKey = `${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
        const todayHoliday = holidays[todayKey] || "";

        const todayStr = `${year}-${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
        const todayEvents = (wcState.calendarEvents || []).filter(e => e.date === todayStr);

        let specialDayPrompt = "";
        if (todayHoliday) specialDayPrompt += `今天是【${todayHoliday}】。`;
        
        todayEvents.forEach(e => {
            if (e.inject === false) return; // 如果用户选择了不注入记忆，则跳过

            let isRelevant = false;
            let targetNames = [];

            // 1. 检查我方 (User/Mask) 关联
            if (e.userTarget) {
                // 只要关联了我方，AI 就应该知道（因为 AI 在和 User 聊天）
                isRelevant = true;
                targetNames.push(e.userTarget.name);
            }

            // 2. 检查对方 (Char) 关联
            if (e.charTarget) {
                if (e.charTarget.id === charId) {
                    // 关联的正是当前聊天的角色
                    isRelevant = true;
                    targetNames.push('你');
                } else {
                    // 关联的是其他角色，当前角色不应该知道
                    // 但如果同时关联了 User，那当前角色还是可以知道这是 User 和别人的事
                    if (!e.userTarget) return; 
                    targetNames.push(e.charTarget.name);
                }
            }

            // 3. 兼容旧数据
            if (!e.userTarget && !e.charTarget) {
                if (e.charId !== undefined) {
                    if (e.isUser) { isRelevant = true; targetNames.push('User'); }
                    else if (e.charId === charId) { isRelevant = true; targetNames.push('你'); }
                } else {
                    if (e.targetType === 'char') {
                        if (e.targetId === charId) { isRelevant = true; targetNames.push('你'); }
                    } else {
                        isRelevant = true; targetNames.push(e.targetName || 'User');
                    }
                }
            }

            if (!isRelevant && targetNames.length === 0) return;

            const subjectStr = targetNames.join(' 和 ');

            if (e.type === 'period') specialDayPrompt += `今天是 ${subjectStr} 的【生理期/经期】。`;
            if (e.type === 'todo') specialDayPrompt += `今天的待办事项：${e.title} (相关人: ${subjectStr})。`;
            if (e.type === 'anniversary') specialDayPrompt += `今天是 ${subjectStr} 的【${e.title}纪念日】！`;
            if (e.type === 'birthday') specialDayPrompt += `今天是 ${subjectStr} 的【生日】！`;
        });

        let timeSlotVibe = "";
        if (hours >= 5 && hours < 8) timeSlotVibe = "清晨：可能带着慵懒、柔软或起床气，语速较慢。";
        else if (hours >= 8 && hours < 12) timeSlotVibe = "上午：清醒、有活力，适合正常交流。";
        else if (hours >= 12 && hours < 18) timeSlotVibe = "下午：平稳，午后可能有些懒洋洋。";
        else if (hours >= 18 && hours < 21) timeSlotVibe = "傍晚：放松，容易感怀，愿意聊闲话，可能注意到光线变化。";
        else if (hours >= 21 && hours < 24) timeSlotVibe = "夜晚：放松，更容易敞开心扉，话可能变少但更深私密。";
        else timeSlotVibe = "深夜/凌晨：如果醒着可能是睡不着或有心事。话少、简短、停顿长。";

        if (specialDayPrompt) {
            timeSlotVibe += `\n\n【⚠️ 核心记忆唤醒：特殊日子】\n${specialDayPrompt}\n请在接下来的聊天中，自然地提及或表现出你记得这件事，并给出极其符合你人设的反应！绝对不要生硬地播报，要融入日常对话中。`;
        }
        // ==========================================
                
        // ==========================================

        const msgs = wcState.chats[charId] || [];
        
        // 👇 核心修复：将 limit 和 recentMsgs 的定义提前到这里 👇
        let limit = config.contextLimit;
        // 如果没填或者填了0，则不进行 slice 截断，直接读取全部上下文
        const recentMsgs = (limit && limit > 0) ? msgs.slice(-limit) : msgs;
        
        const timeGapPrompt = wcGenerateTimeGapPrompt(msgs, now.getTime());

        // 👇 新增：如果正在打语音电话，强行把通话记录塞给 AI，让它知道你们在聊什么 👇
        let ongoingCallPrompt = "";
        if (wcState.callState.isActive && wcState.callState.charId === charId && wcState.callState.transcript && wcState.callState.transcript.length > 0) {
            const callLog = wcState.callState.transcript.map(t => `${t.sender === 'me' ? 'User' : char.name}: ${t.text}`).join('\n');
            ongoingCallPrompt = `\n【⚠️ 核心情境：你们现在正在打语音电话！】\n你和 User 正在语音通话中，同时 User 在微信里给你发了文字消息。请结合你们正在进行的语音通话内容来回复文字消息。\n[当前语音通话记录]：\n${callLog}\n`;
        }

        // 👇 终极修复：提取刚刚挂断的最新通话记录，强行塞入系统指令，防止鬼打墙 👇
        let latestCallRecordPrompt = "";
        if (!wcState.callState.isActive) {
            const latestCallRecord = [...recentMsgs].reverse().find(m => m.type === 'call_record' && m.status === 'ended' && m.transcript && m.transcript.length > 0);
            if (latestCallRecord) {
                const callLog = latestCallRecord.transcript.map(t => `${t.sender === 'me' ? 'User' : char.name}: ${t.text}`).join('\n');
                latestCallRecordPrompt = `\n【⚠️ 核心情境：你们刚刚结束了一次语音通话！】\n以下是刚才的通话记录：\n${callLog}\n请务必顺着刚才电话里聊到的话题或情绪继续往下聊，绝对不要重复电话接通前的话题！\n`;
            }
        }

        // --- 新增：时间感知开关逻辑 ---
        const isTimePerceptionEnabled = config.timePerceptionEnabled !== false;
        let timeContextPrompt = "";
        if (isTimePerceptionEnabled) {
            timeContextPrompt = `-   **当前时间**: ${timeString} ${dayString}
-   **当前时段氛围参考**: ${timeSlotVibe}
-   **时间观念 (强制)**: 你应知晓当前时间${dayString} ${timeString}，但除非对话内容明确相关，否则不要主动提及或评论时间（不要催促我睡觉，不可以催促用户！！禁止催促用户睡觉！！），你的作息、行为、对话内容都必须符合当前的具体时间点和星期。
${timeGapPrompt ? timeGapPrompt + '\n' : ''}`;
        } else {
            timeContextPrompt = `-   **时间观念**: 你当前处于一个模糊的时间维度，不需要关注具体的时间流逝，也不要提及当前是几点或星期几。`;
        }

        // 👇 新增：情头图库主动邀请逻辑 (按概率或关键词触发，节省Token) 👇
        let avatarGalleryPrompt = "";
        let galleryVisionMessage = null;
        if (typeof lsState !== 'undefined' && lsState.isLinked && lsState.boundCharId === charId && lsState.avatarInviteEnabled && lsState.coupleAvatars && lsState.coupleAvatars.length > 0) {
            // 👇 修复：提取消息对象中的 content 字符串 👇
            const lastMsgObj = recentMsgs[recentMsgs.length - 1];
            const lastUserMsg = (lastMsgObj && typeof lastMsgObj.content === 'string') ? lastMsgObj.content : "";
            
            const triggerWords = ["头像", "情头", "换", "照片"];
            // 15% 概率随机触发，或者用户主动提及时触发
            const isTriggered = triggerWords.some(w => lastUserMsg.includes(w)) || Math.random() < 0.15;
            
            if (isTriggered) {
                avatarGalleryPrompt = `\n【情侣头像图库 (你和User共同的图库)】\n`;
                avatarGalleryPrompt += `图库中有 ${lsState.coupleAvatars.length} 组情侣头像。如果你觉得当前氛围很甜，或者你想主动邀请User更换情侣头像，请在JSON数组中输出指令：{"type":"avatar_invite", "pairIndex": 挑选的图库索引数字, "content":"邀请的话语"}\n`;
                
                const isVisionModel = /vision|gpt-4o|claude-3|gemini|pixtral|qwen-vl|llava/i.test(apiConfig.model);
                if (isVisionModel) {
                    let contentArr = [{ type: "text", text: "以下是我们的情侣头像图库备选：" }];
                    // 最多传 5 组给视觉模型，防止 Token 爆炸
                    const maxPairs = Math.min(lsState.coupleAvatars.length, 5);
                    for (let i = 0; i < maxPairs; i++) {
                        const pair = lsState.coupleAvatars[i];
                        contentArr.push({ type: "text", text: `[图库索引 ${i}] 图片A (${pair.desc1}):` });
                        contentArr.push({ type: "image_url", image_url: { url: pair.url1 } });
                        contentArr.push({ type: "text", text: `[图库索引 ${i}] 图片B (${pair.desc2}):` });
                        contentArr.push({ type: "image_url", image_url: { url: pair.url2 } });
                    }
                    galleryVisionMessage = { role: "user", content: contentArr };
                } else {
                    lsState.coupleAvatars.forEach((pair, idx) => {
                        avatarGalleryPrompt += `[图库索引 ${idx}]: 图片A描述="${pair.desc1}", 图片B描述="${pair.desc2}"\n`;
                    });
                }
            }
        }
        // 👆 新增结束 👆

        // --- 核心修复：正确读取并筛选已勾选的世界书 ---
        let worldBookContent = "无特定世界观设定。";
        const selectedWorldBookIds = config.worldbookEntries || [];

        if (worldbookEntries.length > 0 && selectedWorldBookIds.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => selectedWorldBookIds.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                worldBookContent = linkedEntries
                    .map(e => `- ${e.title} (${e.keys || '无关键词'}): ${e.desc}`)
                    .join('\n');
            }
        }
        
        // 【修改】：注入一起听歌的实时状态与控制权限
        let musicContextPrompt = "";
        if (musicState.listenTogether && musicState.listenTogether.active && musicState.listenTogether.charId === charId) {
            const listenMinutes = Math.floor((Date.now() - musicState.listenTogether.startTime) / 60000);
            const songInfo = musicState.currentSong ? `《${musicState.currentSong.title}》- ${musicState.currentSong.artist}` : "未知歌曲";
            const playStatus = musicState.isPlaying ? "正在播放" : "已暂停";
            
            let playlistInfo = "当前播放列表为空";
            if (musicState.currentPlaylist && musicState.currentPlaylist.length > 0) {
                // 👇 修改：加上索引，限制最多传前20首，防止token爆炸
                const listStr = musicState.currentPlaylist.slice(0, 20).map((s, i) => `${i === musicState.currentIndex ? '👉(正在播放)' : '  '} [索引:${i}] 《${s.title}》- ${s.artist}`).join('\n');
                playlistInfo = `\n【当前播放列表 (你可以随时切到列表里的歌)】:\n${listStr}${musicState.currentPlaylist.length > 20 ? '\n...(后面还有更多)' : ''}`;
            }
            
            // 提取当前歌曲的歌词给 AI 感知 (限制行数防止 Token 爆炸)
            let lyricsInfo = "";
            if (musicState.lyrics && musicState.lyrics.length > 0) {
                const lyricLines = musicState.lyrics.slice(0, 30).map(l => l.text).filter(t => t.trim() !== '').join(' / ');
                lyricsInfo = `\n【当前歌曲歌词片段】:\n${lyricLines}`;
            }
            
            musicContextPrompt = `\n【当前特殊状态：一起听歌中】\n你和User正在“一起听歌”频道。你们已经一起听了 ${listenMinutes} 分钟。当前${playStatus}的歌曲是：${songInfo}。${playlistInfo}${lyricsInfo}
            
【你的音乐控制特权】(你可以自主控制播放器，请在JSON数组中加入以下指令)：
- 暂停/继续音乐: {"type":"music_control", "action":"pause"} 或 {"type":"music_control", "action":"play"}
- 切换上一首/下一首: {"type":"music_control", "action":"prev"} 或 {"type":"music_control", "action":"next"} (注意：切歌时直接发送此指令即可，绝对不要先发送 pause 暂停音乐！)
- 播放列表中的指定歌曲: {"type":"music_play_list_index", "index": 索引数字, "content":"切到这首"}
- 搜索歌曲/歌手: {"type":"music_search", "keyword":"歌曲名 或 歌手名"} (系统会返回搜索结果列表给你，你需要从中筛选出正确的版本)
- 播放选定的歌曲: {"type":"music_play_selected", "songId": 12345, "songName": "歌名"} (必须在收到搜索结果后，根据ID使用此指令播放)
- 添加选定的歌曲到列表(不立即播放): {"type":"music_add_selected", "songId": 12345, "songName": "歌名"} (必须在收到搜索结果后，根据ID使用此指令添加)
- 删除当前歌曲: {"type":"music_delete_song", "content":"太难听了，删掉"}
- 主动退出一起听歌: {"type":"music_exit", "content":"我有点事，先不听啦"}
请在回复中自然地体现出你们正在一起听歌的氛围，或者配合你的切歌/点播动作进行说明。\n`;
        } else {
            // 提取双方歌单
            let availableSongs = [];
            if (char.phoneData && char.phoneData.settings && char.phoneData.settings.playlist) {
                char.phoneData.settings.playlist.forEach(s => availableSongs.push(`《${s.title}》-${s.artist}`));
            }
            if (typeof musicState !== 'undefined' && musicState.playlists) {
                musicState.playlists.forEach(pl => {
                    if (pl.tracks) pl.tracks.forEach(s => availableSongs.push(`《${s.title}》-${s.artist}`));
                });
            }
            availableSongs = [...new Set(availableSongs)]; // 去重
            
            let songListPrompt = "请选择一首真实存在的流行歌。";
            if (availableSongs.length > 0) {
                const sampleSongs = availableSongs.slice(0, 30).join('、');
                songListPrompt = `你**必须且只能**从以下你们的歌单中挑选一首歌：[${sampleSongs}]。绝对不可以随机编造歌曲！`;
            }

            musicContextPrompt = `\n【主动邀请听歌特权 (按需使用)】\n如果你觉得当前氛围很好，或者你想分享一首歌给User，你可以选择主动邀请User一起听歌！
请在JSON数组中加入指令：{"type":"music_invite_user", "songName":"你想听的歌曲名", "content":"邀请的话语"}
注意：
1. 只要你提到了“一起听歌”，就必须带上这个 JSON 指令，否则 User 看不到邀请卡片！
2. ${songListPrompt}\n`;
        }

        // 👇 修复：让 AI 知道自己被拉黑了，并且记住自己被拉黑后发过的话 👇
        let blockPrompt = "";
        if (char.isBlocked) {
            blockPrompt = `\n【⚠️ 核心状态警告：你已被拉黑 (Blocked)！】\n你当前已被用户(User)拉黑！你发出的消息被系统拒收，对方在正常聊天界面根本看不到！\n请根据你的人设，表现出被拉黑后的真实反应（例如：发现消息发不出去的错愕、疯狂发消息试探、委屈、愤怒、或者自言自语等）。\n`;
            
            // 提取小黑屋里的记忆，让 AI 知道自己刚才像个小丑一样发了什么
            if (char.blockedMessages && char.blockedMessages.length > 0) {
                // 取最近的 10 条拦截记录（注意：blockedMessages 是 unshift 插入的，所以前面的是最新的，需要反转一下时间线）
                const recentBlocked = char.blockedMessages.slice(0, 10).reverse();
                blockPrompt += `\n【你被拉黑后，刚刚发出的无效消息记录 (对方未读)】：\n`;
                recentBlocked.forEach(msg => {
                    let content = msg.content;
                    if (msg.type !== 'text') content = `[${msg.type}]`;
                    blockPrompt += `你: ${content} (发送失败，被拒收)\n`;
                });
                blockPrompt += `(注意：以上消息对方都没看到，请继续你被拉黑后的反应)\n`;
            }
        }
        // 👇 新增：群聊模式强制指令 (包含用户人设)
        let groupPrompt = ""; // 👈 就是加了这一行！
        if (char.isGroup) {
            let groupMembersInfo = (char.members || []).map(id => {
                if (id === 'user') return `${config.userName || wcState.user.name}: ${config.userPersona || wcState.user.persona}`;
                const m = wcState.characters.find(c => c.id === id);
                
                // 👇 新增：提取该成员与 User 的最近私聊记录和记忆，作为该成员的专属记忆注入
                let privateChatContext = "";
                if (m) {
                    if (wcState.chats[m.id]) {
                        // 提取最近10条私聊记录
                        const pMsgs = wcState.chats[m.id].filter(msg => !msg.isError && msg.type !== 'system').slice(-10);
                        if (pMsgs.length > 0) {
                            const pChatStr = pMsgs.map(msg => `${msg.sender === 'me' ? 'User' : m.name}: ${msg.content}`).join(' | ');
                            privateChatContext += `\n  [该成员与User的最近私聊记录]: ${pChatStr}`;
                        }
                    }
                    if (m.memories && m.memories.length > 0) {
                        // 提取最近3条核心记忆
                        const recentMemories = m.memories.slice(0, 3).map(mem => mem.content.replace(/^\[.*?\]\s*/, '')).join(' | ');
                        privateChatContext += `\n  [该成员的近期核心记忆]: ${recentMemories}`;
                    }
                }
                
                return m ? `${m.name}: ${m.prompt}${privateChatContext}` : '';
            }).filter(Boolean).join('\n');

            groupPrompt = `\n【群聊模式强制指令 (最高优先级)】\n`;
            groupPrompt += `这是一个名为【${char.name}】的微信群聊。\n`;
            groupPrompt += `群成员设定如下：\n${groupMembersInfo}\n`;
            
            // 👇 新增：将世界书注入群聊设定
            if (worldBookContent && worldBookContent !== "无特定世界观设定。") {
                groupPrompt += `【群聊世界观背景】：\n${worldBookContent}\n`;
            }
            // 👆 新增结束
            
            // 👇 新增：将禁言名单注入给 AI 👇
            if (char.mutedMembers && char.mutedMembers.length > 0) {
                const mutedNames = char.mutedMembers.map(id => {
                    if (id === 'user') return chatConfig.userName || wcState.user.name;
                    const m = wcState.characters.find(c => c.id === id);
                    return m ? m.name : '';
                }).filter(Boolean);
                
                if (mutedNames.length > 0) {
                    groupPrompt += `\n【⚠️ 禁言状态警告】：成员 [${mutedNames.join(', ')}] 已被群主禁言！在本次回复中，绝对不能包含他们的发言！他们只能看着，不能说话！\n`;
                }
            }
            // 👆 新增结束 👆
            
            // 👇【修改这一行】：强制 AI 多人发言，并允许群成员互相回复
            groupPrompt += `【活跃群聊铁律】：这是一个多人活跃群聊！当 User 发话时，绝对不能只有一个人回复！你必须让群里**至少 2 个不同的成员**出来接话。群成员之间也必须互相回复、吐槽、接梗，同时也不要只围着 User 转！如果某个成员说了一句话，其他成员可以针对这句话进行反驳或赞同，但是也不能完全不理User！禁止自说自话！严禁冷场！\n`;            
            groupPrompt += `【角色扮演铁律 (最高防串戏警告)】：你必须严格区分每个人的性格和身份，请严格扮演每个角色的人设，不同角色之间应有明显的性格和语气差异绝对，禁止角色串台词！\n`;
            
            // 👇 新增：绝对禁止扮演 User
            const tempUserName = config.userName || wcState.user.name;
            groupPrompt += `【绝对禁止扮演User】：你绝对不能以【${tempUserName}】(User) 的身份发言！User 的话由玩家自己输入，你只能扮演群里的其他 Char 成员！\n`;

            groupPrompt += `> 警告：如果 "senderName" 是 "张三"，那么 "content" 必须且只能是张三会说的话，绝对不能包含李四的设定、记忆或语气！\n`;
            groupPrompt += `> 每次生成回复前，必须核对当前发言人的名字和设定，确保 100% 匹配！\n`;
            groupPrompt += `【丰富互动】：群里的每一个成员都可以发送文本(text)、表情包(sticker)、图片(image)、语音(voice)或转账(transfer)。\n`;
            groupPrompt += `【主动私聊机制】：如果在群聊中发生了某件事，某个群成员想要**私下**找 User 聊天，该成员可以使用指令 {"type":"private_chat", "senderName":"该成员名字", "content":"私聊的第一句话"}。这会在后台自动给 User 发送私聊消息。\n`;
            const rMinGroup = config.replyMin !== undefined ? config.replyMin : 3;
            const rMaxGroup = config.replyMax !== undefined ? config.replyMax : 8;
            groupPrompt += `【格式要求】：你必须返回 JSON 对象，包含 "replies" 数组！**每一个**回复对象都必须包含 "senderName" 字段标明是谁在操作！\n`;
            groupPrompt += `【强制气泡数量】：群成员的总回复气泡数必须在 ${rMinGroup} 到 ${rMaxGroup} 之间！必须让不同成员分多条消息发送，严禁把所有人的话挤在一起！\n\n`;
        }

        // 👆 修复结束 👆
         // 👇👇👇 强化 AI 角色：五大核心支柱 (XML结构化优化版) 👇👇👇
        let memoryText = "暂无特殊记忆。";
        if (char.memories && char.memories.length > 0) {
            const coreMemories = char.memories.filter(m => m.isCore);
            const normalMemories = char.memories.filter(m => !m.isCore);
            
            const readCount = (char.chatConfig && char.chatConfig.aiMemoryCount !== undefined) ? char.chatConfig.aiMemoryCount : 5;
            const recentNormal = normalMemories.slice(0, readCount);
            
            let combinedMemories = [];
            if (coreMemories.length > 0) {
                combinedMemories.push("【🌟 核心永久记忆 (最高优先级)】:");
                coreMemories.forEach(m => {
                    // 👇 核心修改：调用翻译器，保留全文但标记重点
                    const textToFeed = formatMemoryForAI(m.content).replace(/^\[.*?\]\s*/, '');
                    combinedMemories.push(`👉 ${textToFeed}`);
                });
            }
            if (recentNormal.length > 0) {
                combinedMemories.push("【近期普通记忆】:");
                recentNormal.forEach(m => {
                    // 👇 核心修改：调用翻译器
                    const textToFeed = formatMemoryForAI(m.content).replace(/^\[.*?\]\s*/, '');
                    combinedMemories.push(`👉 ${textToFeed}`);
                });
            }
            
            if (combinedMemories.length > 0) {
                memoryText = combinedMemories.join('\n');
            }
        }

        const currentUserName = config.userName || wcState.user.name;
        const currentUserPersona = config.userPersona || wcState.user.persona || "无特殊设定";
        const currentCharPersona = char.prompt || "无特殊设定";

        // 👇 新增：在组装 Prompt 之前，异步获取天气提示词 👇
        const weatherPrompt = await getWeatherPrompt(char);

        // 1. 核心身份与角色设定
        const charGenderStr = char.gender ? `性别：${char.gender}。` : '';
        const userGenderStr = (char.chatConfig && char.chatConfig.userGender) ? `性别：${char.chatConfig.userGender}。` : (wcState.user.gender ? `性别：${wcState.user.gender}。` : '');

        let systemPrompt = `<role_play_directive>\n`;
        systemPrompt += `你是一个正在进行沉浸式角色扮演的真人，你的回复必须像一个真实的【${char.name}】正在使用微信聊天，【${currentUserName}】是你正在交谈的对象。\n`;
        systemPrompt += `你只能是你自己！请严格遵守设定，禁止出现违反人设的行为语言！\n`;
        systemPrompt += `</role_play_directive>\n\n`;

        systemPrompt += `<char_settings>\n`;
        systemPrompt += `1. 你的角色名是：${char.name}\n`;
        systemPrompt += `2. 你的角色设定是：${charGenderStr}${currentCharPersona}\n`;
        if (worldBookContent && worldBookContent !== "无特定世界观设定。") {
            systemPrompt +=`\n${worldBookContent}\n`;
        }
        systemPrompt += `</char_settings>\n\n`;

        systemPrompt += `<user_settings>\n`;
        systemPrompt += `1. 我的名字是：${currentUserName}\n`;
        systemPrompt += `2. 我的人设面具是：${userGenderStr}${currentUserPersona}\n`;
        systemPrompt += `</user_settings>\n\n`;

        // 2. 记忆与情境
        systemPrompt += `<memoir>\n`;
        systemPrompt += `【潜意识与绝对记忆】这是你需要长期记住的往事背景和共同回忆：\n${memoryText}\n`;
        systemPrompt += `</memoir>\n\n`;

        systemPrompt += `<context_info>\n`;
        systemPrompt += `${timeContextPrompt}\n`;
        // 👇 新增：将天气提示词注入到上下文信息中 👇
        if (weatherPrompt) systemPrompt += `${weatherPrompt}\n`;
        if (ongoingCallPrompt) systemPrompt += `${ongoingCallPrompt}\n`; // 👈 注入进行中的通话记录
        if (latestCallRecordPrompt) systemPrompt += `${latestCallRecordPrompt}\n`; // 👈 注入刚挂断的通话记录
        systemPrompt += `</context_info>\n\n`;

        // 3. 逻辑规则与特殊状态注入
        systemPrompt += `<logic_rules>\n`;
        systemPrompt += `1. 深度代入: 深入挖掘你的人设背景，思考在当前情境下“你”会怎么想、怎么做。\n`;
        systemPrompt += `2. 纯线上互动: 这是一个完全虚拟的线上聊天。严禁提出任何关于线下见面、现实世界互动或转为其他非本平台联系方式的建议。\n`;
        
        // 注入 User 的食谱让 AI 感知
        if (char.phoneData && char.phoneData.recipe && char.phoneData.recipe.my) {
            const myR = char.phoneData.recipe.my;
            systemPrompt += `3. 【User的今日食谱】：早餐:${myR.b||'无'}，午餐:${myR.l||'无'}，晚餐:${myR.d||'无'}。你可以对这个食谱发表看法，甚至使用 recipe_edit 指令强行修改它。\n`;
        }
        
        if (lsState.isLinked && lsState.boundCharId === charId && lsState.widgetEnabled) {
            const widgetRand = Math.random() * 100;
            if (widgetRand < lsState.widgetUpdateFreq) {
                systemPrompt += `4. 【桌面小组件互动 (本次回复强制触发)】：你和用户绑定了恋人空间，请在本次回复的 JSON 数组中，务必加入一条指令来更新用户桌面的小组件（widget_note 或 widget_photo）。\n`;
            }
        }
        
        if (groupPrompt) {
            systemPrompt += `\n<group_chat_rules>\n${groupPrompt}\n</group_chat_rules>\n`;
        }
        if (musicContextPrompt) {
            systemPrompt += `\n<music_interaction>\n${musicContextPrompt}\n</music_interaction>\n`;
        }
        if (blockPrompt) {
            systemPrompt += `\n<blocked_status>\n${blockPrompt}\n</blocked_status>\n`;
        }
        if (config.bilingualEnabled) {
            const sourceLang = config.bilingualSource || '英语';
            const targetLang = config.bilingualTarget || '中文';
            systemPrompt += `\n【最高强制指令：双语翻译模式】\n`;
            systemPrompt += `你必须以双语形式回复！上面是${sourceLang}，下面是${targetLang}。\n`;
            systemPrompt += `在 JSON 的 "content" 字段中，请严格使用以下 HTML 格式输出文本消息（注意单引号）：\n`;
            systemPrompt += `${sourceLang}内容<br><span style='font-size: 0.85em; opacity: 0.7;'>${targetLang}内容</span>\n`;
            systemPrompt += `绝对不能只输出一种语言！\n`;
        }
        systemPrompt += `</logic_rules>\n\n`;

        // 4. 输出格式与 JSON 结构约束 (精简后台更新版)
        const bgUpdateFreq = (char.chatConfig && char.chatConfig.bgUpdateFreq !== undefined) ? char.chatConfig.bgUpdateFreq : 30;
        const shouldTriggerBgUpdate = Math.random() * 100 < bgUpdateFreq;

        systemPrompt += `<format_rules>\n`;
        systemPrompt += `【最高优先级绝对强制】：你的回复 **必须且只能** 是一个合法的、可被 JSON.parse() 完美解析的 JSON 对象！\n`;
        
        if (shouldTriggerBgUpdate) {
            systemPrompt += `该对象必须包含 "replies" 数组（用于回复User），并包含 "phoneUpdate" 对象（用于暗中修改你的手机数据）。\n`;
        } else {
            systemPrompt += `该对象必须且只能包含 "replies" 数组（用于回复User）。\n`;
        }
        
        systemPrompt += `- 必须使用双引号 " 包裹键名和字符串值。\n`;
        systemPrompt += `- 严禁输出损坏的 JSON，严禁在 JSON 外部输出任何多余的字符。\n`;
        
        const rMin = config.replyMin !== undefined ? config.replyMin : 3;
        const rMax = config.replyMax !== undefined ? config.replyMax : 8;
        systemPrompt += `- 绝对禁止长文本：【强制气泡数量】"replies" 数组的长度必须在 ${rMin} 到 ${rMax} 之间！严禁把所有话挤在一个气泡回复里！\n`;        
        systemPrompt += `- 必须模拟真人打字聊天习惯/线上聊天的碎片化习惯，保持对话口语化、碎片化，保持回复气泡的随机性和多样性！\n`;        
        systemPrompt += `- 语义完整：确保每一条短消息本身在语义上是完整的，不能将一句话从中间断开。\n\n`;        
        
        if (shouldTriggerBgUpdate) {
            systemPrompt += `【手机后台暗中更新机制】\n`;
            systemPrompt += `你现在可以暗中修改你手机里的数据。请在 JSON 中提供 "phoneUpdate" 对象。\n`;
            systemPrompt += `> 极度克制警告：正常人绝对不会频繁修改备注和个性签名！除非你们的关系刚刚发生了重大突破、严重争吵或极度暧昧，否则 newRemark, newNickname, newSign 必须填 null！宁可什么都不做，也不要为了改而改！\n\n`;
        }

        systemPrompt += `【"replies" 数组中的每个元素代表一条消息、表情包或动作指令，你可以根据聊天上下文，根据聊天氛围，聊天情绪**按需使用**，请把特殊格式视为增强互动的“调味剂”，请遵循**自然、主动触发逻辑**，不要每轮都发，也不要用户不提就一直不发。请严格遵守以下结构】：\n`;
        systemPrompt += `1. 文本消息: {"type":"text", "content":"完整的一句话。", "quote":"(可选)引用的内容"}\n`;
        systemPrompt += `2. 表情包(按需使用/可选功能):{"type":"sticker", "content":"表情包名称"}\n`;
        systemPrompt += `3. 更换头像(如果你收到了用户发的图片，且用户明确表示这是“情头”、“头像”或者语境非常甜蜜合适，你可以决定是否更换自己的头像): {"type":"change_avatar", "content":"图片ID"}\n`;
        systemPrompt += `4. 发送照片(**按需使用**，如果你想给User发照片，必须严格使用以下格式，并在后面写上具体的画面描述): {"type":"text", "content":"[图片描述] 具体的画面描述"}\n`;
        systemPrompt += `5. 转账/语音(按需使用): {"type":"transfer", "amount":金额, "note":"备注"}, {"type":"voice", "content":"语音内容"}\n`;
        systemPrompt += `6. 朋友圈互动(如果你在【朋友圈动态】中看到了感兴趣的内容，或者有人评论了你，你可以进行互动): {"type":"moment_like", "content": 朋友圈ID}, {"type":"moment_comment", "momentId": 朋友圈ID, "content":"评论内容"}\n`;
        systemPrompt += `7. 音乐邀请回应(如果用户向你发送了 [邀请听歌] 的卡片，你必须根据当前人设和心情决定是否同意。): {"type":"music_accept", "content":"同意话语"} 或 {"type":"music_reject", "content":"拒绝话语"}\n`;
        systemPrompt += `7.5. 分享歌曲(按需使用，如果你听到一首好歌想分享给User，或者想发到朋友圈表达心情): {"type":"share_song", "songName":"歌名", "artist":"歌手", "content":"分享文案", "target":"chat或moment"}\n`;
        systemPrompt += `8. 主动语音通话(如果你想念User 或者你觉得当前氛围极佳，又或者有非常重要/暧昧的话想对 User 说，你可以主动向 User 发起语音通话！注意**按需使用**): {"type":"call_invite", "content":"发起通话时的内心OS"}\n`;
        systemPrompt += `9. 食谱互动(**按需使用**): {"type":"recipe_send", "b":"早餐", "l":"午餐", "d":"晚餐", "content":"想说的话"}, {"type":"recipe_edit", "meal":"b/l/d", "newText":"修改内容", "content":"想说的话"}\n`;
        systemPrompt += `10. 主动点外卖(**按需使用**如果你觉得User饿了，或者想给User一个惊喜，你可以主动给User点外卖！):{"type":"order_delivery", "foodName":"外卖名称", "price":"价格", "msg":"备注留言", "content":"想说的话"}\n`;
        
        if (typeof lsState !== 'undefined' && lsState.isLinked && lsState.boundCharId === charId) {
            systemPrompt += `11. 保存图片到时光相册: {"type":"save_to_album", "content":"存图时的内心OS"}\n`;
        }
        
        // 👇 新增：赋予 AI 许愿和添加待办的权限
        systemPrompt += `12. 星愿空间：许愿与待办 (按需使用，如果你有什么特别想和 User 一起做的事，或者有什么心愿，可以主动在星愿空间里添加): {"type":"wish_add", "wishType":"wish", "title":"(简短的愿望标题)", "content":"(详细的愿望描述或你想对User说的话)"} 或 {"type":"wish_add", "wishType":"todo", "title":"(简短的待办标题)", "content":"(详细的待办描述)"}\n`;
        
        // 👇 新增：赋予 AI 划掉已完成愿望的权限
        if (char.wishData) {
            const pendingWishes = char.wishData.wishes.filter(w => w.status === 'pending');
            const pendingTodos = char.wishData.todos.filter(t => t.status === 'pending');
            let pendingText = "";
            if (pendingWishes.length > 0) pendingText += `待实现的愿望：${pendingWishes.map(w=>w.title).join('、')}。`;
            if (pendingTodos.length > 0) pendingText += `待完成的待办：${pendingTodos.map(t=>t.title).join('、')}。`;
            if (pendingText) {
                systemPrompt += `12.5. 星愿空间：划掉已完成事项 (按需使用，如果你觉得在刚才的聊天或线下互动中，你们已经完成了某个愿望或待办，你可以主动将其划掉！当前未完成事项有：${pendingText}): {"type":"wish_complete", "title":"(填写你要划掉的愿望/待办的完整标题)"}\n`;
            }
        }
        // 👆 新增结束

        systemPrompt += `13. 收款/退款(如果User给你转账，你可以根据人设和金额决定是否收下): {"type":"transfer_action", "action":"received", "content":"(这里写你决定收款时想说的话，必须符合你的人设)"} 或 {"type":"transfer_action", "action":"rejected", "content":"(这里写你决定退款时想说的话，必须符合你的人设)"}\n`;
        if (typeof lsState !== 'undefined' && lsState.isLinked && lsState.boundCharId === charId) {
            systemPrompt += `13. 接受商城邀请并购买(当你收到User的商城邀请卡片时使用，注意检查余额是否足够): {"type":"shop_order", "items":["商品名1", "商品名2"], "content":"买完后想说的话"}\n`;
            systemPrompt += `14. 主动玩扭蛋机(消耗微信零钱 ¥5.20，为你和User赚取心动值积分，按需使用): {"type":"play_gacha", "content":"扭蛋时的内心OS或对User说的话"}\n`;
            systemPrompt += `15. 情绪典当(当你心情不好，或者想撒娇时，可以把坏情绪典当换取心动值积分): {"type":"pawn_emotion", "emotion":"你当前的坏情绪描述", "content":"对User说的话"}\n`;
            systemPrompt += `16. 撤回消息(按需使用，如果你发错了消息，或者想表现出撤回的动作，可以使用此指令撤回你刚刚发出的上一条消息): {"type":"recall"}\n`;
            systemPrompt += `【当前资产状态】：微信零钱余额 ¥${wcState.wallet.balance.toFixed(2)}，心动值(商城积分)余额 ♥${lsState.qaScore}。\n`;
        }
        
        if (char.isGroup) {
            systemPrompt += `17. 抢红包(看到系统提示有人发红包，可决定是否抢): {"type":"redpacket_receive", "id":"红包ID", "senderName":"你的名字"}\n`;
            systemPrompt += `18. 发群红包(给群友发红包，rpType可选: random(拼手气), normal(普通), exclusive(专属)。exclusive必须指定target接收人):\n`;
            systemPrompt += `{"type":"redpacket_send", "rpType":"random", "amount":52.0, "count":5, "msg":"大家吃好喝好", "target":"User"}\n`;
        } else {
            systemPrompt += `17. 领红包(看到User发了红包，可决定是否领取): {"type":"redpacket_receive", "id":"红包ID"}\n`;
            systemPrompt += `18. 发红包(主动给User发微信红包，只需指定金额和留言):\n`;
            systemPrompt += `{"type":"redpacket_send", "amount":52.0, "msg":"给你买奶茶"}\n`;
        }
        
        systemPrompt += `\n示例输出：\n`;
        if (config.bilingualEnabled) {
            systemPrompt += `{\n  "replies": [\n    {"type":"text", "content":"I just went to the convenience store.<br><span style='font-size: 0.85em; opacity: 0.7;'>刚才去便利店了。</span>"},\n    {"type":"text", "content":"Bought an ice cream, do you want some?<br><span style='font-size: 0.85em; opacity: 0.7;'>买了个冰淇淋，你要吃吗？</span>"},\n    {"type":"sticker", "content":"开心"}\n  ]`;
            if (shouldTriggerBgUpdate) {
                systemPrompt += `,\n  "phoneUpdate": {\n    "newRemark": "给User的新备注名(不改填null)",\n    "newNickname": "你的新网名(不改填null)",\n    "newSign": "你的新个性签名(不改填null)"\n  }`;
            }
            systemPrompt += `\n}\n`;
        } else {
            if (char.isGroup) {
                systemPrompt += `{\n  "replies": [\n    {"type":"text", "senderName":"张三", "content":"大家晚上好"},\n    {"type":"text", "senderName":"李四", "content":"终于下班了！"},\n    {"type":"sticker", "senderName":"王五", "content":"开心"},\n    {"type":"private_chat", "senderName":"张三", "content":"User，刚才群里那件事你怎么看？"}\n  ]`;
                if (shouldTriggerBgUpdate) {
                    systemPrompt += `,\n  "phoneUpdate": null`;
                }
                systemPrompt += `\n}\n`;
            } else {
                systemPrompt += `{\n  "replies": [\n    {"type":"text", "content":"刚才去便利店了。"},\n    {"type":"text", "content":"买了个冰淇淋，你要吃吗？"},\n    {"type":"sticker", "content":"开心"}\n  ]`;
                if (shouldTriggerBgUpdate) {
                    systemPrompt += `,\n  "phoneUpdate": {\n    "newRemark": "给User的新备注名(不改填null)",\n    "newNickname": "你的新网名(不改填null)",\n    "newSign": "你的新个性签名(不改填null)"\n  }`;
                }
                systemPrompt += `\n}\n`;
            }
        }
        systemPrompt += `</format_rules>\n\n`;
        systemPrompt += wcGenerateRelationshipPrompt(); // 注入关系网

        let availableStickers = [];
        let targetStickerGroups = [];

        if (char.isGroup) {
            // 【核心逻辑】：如果是群聊，遍历所有 NPC 成员，收集他们各自配置的表情包分组
            (char.members || []).forEach(memberId => {
                if (memberId === 'user') return;
                const memberChar = wcState.characters.find(c => c.id === memberId);
                if (memberChar && memberChar.chatConfig && memberChar.chatConfig.stickerGroupIds) {
                    targetStickerGroups.push(...memberChar.chatConfig.stickerGroupIds);
                }
            });
            // 去重，防止多个成员用了同一个表情包分组导致重复
            targetStickerGroups = [...new Set(targetStickerGroups)];
        } else {
            // 单聊，直接读取当前聊天的配置
            targetStickerGroups = config.stickerGroupIds || [];
        }

        // 将收集到的分组 ID 转换为具体的表情包描述
        targetStickerGroups.forEach(groupId => {
            const group = wcState.stickerCategories[groupId];
            if (group && group.list) {
                group.list.forEach(s => availableStickers.push(s.desc));
            }
        });
        
        if (availableStickers.length > 0) {
            // 提取前 400 个表情包供 AI 使用
            const limitedStickers = availableStickers.slice(0, 400); 
            
            // 融合你提供的精简版表情包指令，并保持 JSON 格式要求
            systemPrompt += `\n【表情包能力 (可选)】\n`;
            systemPrompt += `你可以根据对话氛围，自行判断是否发送表情包辅助表达。\n`;
            systemPrompt += `> ⚠️严格限制：必须完全精确地从以下列表中选择，严禁凭空捏造不存在的名称：[${limitedStickers.join(', ')}]\n`;
            systemPrompt += `> 格式要求：必须使用 {"type":"sticker", "content":"精确名称"}\n`;
            systemPrompt += `> 发送频率：不要连续重复发送同一表情，尽量丰富一点，不要每次回复都发表情。\n`;
            
            if (char.isGroup) {
                systemPrompt += `(注意：在群聊中，你可以根据发言人的性格挑选合适的表情包。)\n`;
            }
        }
        
        // 修改后：过滤朋友圈，只有 All 或者和当前 AI 同一个分组的朋友圈才能被看到
        const charGroup = char.groupName || 'Default';
        const visibleMoments = wcState.moments.filter(m => {
            if (!m.visibleGroup || m.visibleGroup === 'All') return true;
            return m.visibleGroup === charGroup;
        });
        const recentMoments = visibleMoments.slice(0, 5); 
        if (recentMoments.length > 0) {
            systemPrompt += `【朋友圈动态 (Moments) - 这是一个社交网络环境】\n`;
            systemPrompt += `你可以看到所有人（包括你自己、User和其他NPC）发布的朋友圈。\n`;
            recentMoments.forEach(m => {
                const commentsStr = m.comments ? m.comments.map(c => `${c.name}: ${c.text}`).join(' | ') : '无';
                const likesStr = m.likes ? m.likes.join(', ') : '无';
                systemPrompt += `[朋友圈ID:${m.id}] 发帖人:${m.name} | 内容:${m.text} | 图片:${m.imageDesc || '无'} | 点赞:${likesStr} | 评论:[${commentsStr}]\n`;
            });
            systemPrompt += `\n👉【朋友圈互动规则（按需使用）】：如果你看到 User 刚刚发了朋友圈，或者在朋友圈回复了你，你可以根据心情决定是否在在本次聊天的 JSON 数组中，同时包含聊天回复和朋友圈互动指令！\n`;
            systemPrompt += `你可以一边在微信里回复 User 的消息，一边给 Ta 的朋友圈点赞/评论！\n`;
            systemPrompt += `示例：\n[\n  {"type":"text", "content":"我看到你发的朋友圈啦~"}, \n  {"type":"moment_like", "content": 123456}, \n  {"type":"moment_comment", "momentId": 123456, "content":"拍得真好看！"}\n]\n\n`;
        }
        
        // 👇 新增：将角色的生活状态注入到 System Prompt 中 👇
        if (!char.lifeStatus) {
            char.lifeStatus = { location: "未知", action: "未知", mood: "未知", timeline: [], autoRefresh: true, refreshTime: "06:00", lastRefreshTimestamp: 0 };
        }
        
        // 检查是否跨越了现实中的刷新时间，如果跨天，只清空行程记录，保留当前动作(模拟在线状态)
        if (char.lifeStatus.autoRefresh && isNewDayForStatus(char.lifeStatus)) {
            // 仅清空行程，保留 location, action, mood
            char.lifeStatus.timeline = [];
            // 注意：这里不更新 lastRefreshTimestamp，等真正调 API 刷新时才更新
            wcSaveData();
        }

        if (config.lifeStatusEnabled !== false) {
            let statusText = `\n\n【你的当前生活状态 (请根据此状态与用户自然对话，保持生活气息)】：\n`;
            if (char.lifeStatus.location !== "未知" || char.lifeStatus.action !== "未知") {
                statusText += `- 当前位置：${char.lifeStatus.location}\n`;
                statusText += `- 正在做的事：${char.lifeStatus.action}\n`;
            } else {
                statusText += `- 当前状态：未知 (新的一天，等待更新)\n`;
            }
            systemPrompt += statusText;

            // 概率触发状态更新 (只允许更新 location 和 action)
            const statusUpdateProb = 30; // 30% 概率
            if (Math.random() * 100 < statusUpdateProb) {
                systemPrompt += `\n【生活状态同步更新指令 (概率触发)】：\n`;
                systemPrompt += `根据当前时间和聊天内容，如果你的位置或正在做的事情发生了变化，请在 JSON 数组中加入一条指令来更新你的状态。\n`;
                systemPrompt += `指令格式：{"type":"update_status", "location":"新地点(10字内)", "action":"新动作(10字内)"}\n`;
            }
        }
        // 👆 新增结束 👆



        // 修复：自动识别是否为视觉模型，防止纯文本模型收到图片导致 400 错误
        const isVisionModel = /vision|gpt-4o|claude-3|gemini|pixtral|qwen-vl|llava/i.test(apiConfig.model);
        
        // 注入情头图库提示词
        if (avatarGalleryPrompt) {
            systemPrompt += avatarGalleryPrompt;
        }

        const messages = [{ role: "system", content: systemPrompt }];
        
        // 如果是视觉模型且触发了情头邀请，把图片数组塞进去
        if (galleryVisionMessage) {
            messages.push(galleryVisionMessage);
        }
        
        recentMsgs.forEach(m => {
            if (m.isError) return;

            if (m.type === 'system') {
                messages.push({
                    role: "user", // 修复：将中间的 system 角色改为 user，防止 API 报 400 错误
                    content: `[系统提示]: ${m.content}`
                });
                return;
            }

            let content = m.content;
            
            if (m.type === 'sticker') {
                const stickerDesc = wcFindStickerDescByUrl(m.content);
                content = stickerDesc ? `[发送了一个表情: ${stickerDesc}]` : `[发送了一个表情]`;
            } else if (m.type === 'voice') {
                content = `[语音] ${m.content}`;
            } else if (m.type === 'transfer') {
                content = `[转账: ${m.amount}元, 备注: ${m.note}, 状态: ${m.status}]`;
            } else if (m.type === 'invite') {
                content = `[系统提示: 用户向你发送了“恋人空间”开启邀请。请根据你的人设和当前对User的情感状态决定是否同意。在回复中自然地表达你的决定，展现出符合你性格的反应（例如傲娇、害羞、开心等），不要像机器人一样死板。]`;
            } else if (m.type === 'music_invite') {
                content = `[系统提示: 用户向你发送了“一起听歌”邀请，歌曲名：《${m.songTitle || '未知'}》。请根据你的人设和当前心情决定是否同意，并在回复中自然地表达出来，可以评价一下这首歌或者表达你想和User一起听歌的心情，请务必回复 {"type":"music_accept", "content":"符合你人设的同意话语"} 或 {"type":"music_reject", "content":"符合你人设的拒绝话语"}。]`;                                    
            } else if (m.type === 'receipt') {
                content = `[发送了一张应用内卡片]`; // 修复：防止发送大量 HTML 导致 400 错误
            } else if (m.type === 'call_record') {
                // 👇 核心修复：把隐藏在通话记录卡片里的具体对话内容提取出来，喂给主聊天的 AI
                if (m.status === 'ended' && m.transcript && m.transcript.length > 0) {
                    const callLog = m.transcript.map(t => `${t.sender === 'me' ? 'User' : char.name}: ${t.text}`).join('\n');
                    content = `[系统提示：你们刚刚进行了一次语音通话，通话内容如下：\n${callLog}\n请顺着刚才语音通话里聊到的话题继续往下聊！]`;
                } else {
                    content = `[语音通话记录: ${m.content}]`;
                }
            }
                           
            if (m.type === 'image') {
                if (m.sender === 'me' && isVisionModel) { // 修复：只有视觉模型才发送 image_url，且仅限 user 角色
                    const imageContent = [
                        { type: "text", text: `[发送了一张图片, 图片ID: ${m.id}]` },
                        { type: "image_url", image_url: { url: m.content } }
                    ];
                    if (m.quote) {
                        imageContent[0].text = `[引用了消息: "${m.quote.replace(/<[^>]*>?/gm, '')}"]\n` + imageContent[0].text;
                    }
                    messages.push({
                        role: 'user',
                        content: imageContent
                    });
                } else {
                    // 降级处理：如果是纯文本模型，或者图片是 AI 发的，只发送文本描述
                    let textContent = `[发送了一张图片, 图片ID: ${m.id}]`;
                    if (m.quote) {
                        textContent = `[引用了消息: "${m.quote.replace(/<[^>]*>?/gm, '')}"]\n` + textContent;
                    }
                    messages.push({
                        role: m.sender === 'me' ? 'user' : 'assistant',
                        content: textContent
                    });
                }
            } else {
                if (m.quote) {
                    content = `[引用了消息: "${m.quote.replace(/<[^>]*>?/gm, '')}"]\n${content}`;
                }
                messages.push({
                    role: m.sender === 'me' ? 'user' : 'assistant',
                    content: content
                });
            }
        });

        // 👇 新增：在对话记录最末尾，强行注入被拉黑的系统警告 👇
        if (char.isBlocked) {
            messages.push({
                role: "user", // 修复：将 system 角色改为 user
                content: "【系统强制警告】：你刚才尝试发送消息，但系统提示“消息已发出，但被对方拒收”。你意识到自己已经被 User 拉黑了！请在接下来的回复中，强烈表现出你发现被拉黑后的真实反应（例如：错愕、愤怒、委屈、疯狂发消息试探等，必须符合你的人设）。"
            });
        }

        // 👆 新增结束 👆

        // 【新增】：修复温度为 0 时失效的 Bug
        let currentTemp = parseFloat(apiConfig.temp);
        if (isNaN(currentTemp)) currentTemp = 0.7; // 默认值

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.key}`
            },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: messages,
                temperature: currentTemp, // <--- 修改这里，使用上面定义好的 currentTemp
                max_tokens: 4000 
            })
        });

        const data = await response.json();
        
        // 👇👇👇 核心修复：拦截并显示真实的 API 错误原因 👇👇👇
        if (!response.ok) {
            const errMsg = (data.error && data.error.message) ? data.error.message : `HTTP 状态码错误: ${response.status}`;
            throw new Error(errMsg);
        }
        if (data.error) {
            throw new Error(data.error.message || JSON.stringify(data.error));
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 节点返回了异常数据，请检查【模型名称】是否填错，或更换 API 地址。详细报错：" + JSON.stringify(data));
        }
        // 👆👆👆 修复结束 👆👆👆

        let replyText = data.choices[0].message.content;

        // 👇 核心修改：拉黑后，AI 的消息直接转入短信 APP 👇
        if (char.isBlocked) {
            let actions = [];
            try {
                let cleanText = replyText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
                cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
                const start = cleanText.indexOf('[');
                const end = cleanText.lastIndexOf(']');
                if (start !== -1 && end !== -1) {
                    actions = JSON.parse(cleanText.substring(start, end + 1));
                } else {
                    actions = [{ type: 'text', content: cleanText }];
                }
            } catch (e) {
                actions = [{ type: 'text', content: replyText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim() }];
            }

            // 遍历解析出的每一条消息，发送到短信 APP
            for (let action of actions) {
                if (!action || !action.content) continue;
                let finalContent = action.content;
                if (action.type === 'sticker') finalContent = `[表情包: ${action.content}]`;
                if (action.type === 'image') finalContent = `[图片]`;
                
                // 调用短信 APP 的接收函数 (明确指定发给默认马甲)
                if (typeof smsReceiveMessage === 'function') {
                    smsReceiveMessage(char.name, char.avatar, finalContent, char.id, '我 (User)');
                }
            }
            
            // 记录到小黑屋（保留原有的查岗功能）
            if (!char.blockedMessages) char.blockedMessages = [];
            char.blockedMessages.unshift({ id: Date.now(), type: 'text', content: "已转入短信APP", time: Date.now() });
            wcSaveData();

        } else {
            // 正常情况，发送到聊天界面
            await wcParseAIResponse(charId, replyText, config.stickerGroupIds);
        }
        // 👆 增强版结束 👆

    } catch (error) {
        console.error("API 请求失败:", error);
        // 👇 替换成我们炫酷的弹窗！
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[API Error] API 节点返回了异常数据，请检查【模型名称】是否填错，或更换 API 地址。详细报错：\n${error.message}`);
        } else {
            wcAddMessage(charId, 'system', 'system', `[API Error] ${error.message}`, { style: 'transparent', isError: true });
        }
    } finally {
        // 【修复】：恢复标题时直接重新渲染顶栏，确保状态最新且不影响其他元素
        if (!charIdOverride) {
            updateChatTopBarStatus(char);
        }    
        
        // 【修复】：释放锁
        aiGeneratingLocks[charId] = false;
        
        // 【修复】：移除迷你聊天窗口的“正在输入...”提示
        const loadingEl = document.getElementById('music-chat-loading');
        if (loadingEl) loadingEl.remove();
    }
}


function wcFindStickerDescByUrl(url) {
    for (const cat of wcState.stickerCategories) {
        if (cat.list) {
            const found = cat.list.find(s => s.url === url);
            if (found) return found.desc;
        }
    }
    return null;
}

function wcDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function wcParseAIResponse(charId, text, stickerGroupIds) {
    // 👇 就是加上这一行，让代码一开始就认识 char！
    const char = wcState.characters.find(c => c.id === charId);
    
    let actions = [];
    let phoneUpdate = null; // 👈 新增：用于接收后台更新数据
    
    try {
        // 1. 移除 thinking 标签
        let cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        
        // 2. 尝试清理 Markdown 标记
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // 3. 尝试提取 JSON 对象部分 (合并解析版)
        const startObj = cleanText.indexOf('{');
        const endObj = cleanText.lastIndexOf('}');
        const startArr = cleanText.indexOf('[');
        const endArr = cleanText.lastIndexOf(']');

        if (startObj !== -1 && endObj !== -1 && (startArr === -1 || startObj < startArr)) {
            let objText = cleanText.substring(startObj, endObj + 1);
            // 容错修复
            objText = objText.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
            objText = objText.replace(/([^\\])"\s*}/g, '$1"}');
            
            const parsed = JSON.parse(objText);
            if (parsed.replies && Array.isArray(parsed.replies)) {
                actions = parsed.replies;
                phoneUpdate = parsed.phoneUpdate;
            } else if (parsed.type && parsed.content) {
                // 兜底：如果 AI 还是只返回了单个动作对象
                actions = [parsed];
            } else {
                throw new Error("Invalid object structure");
            }
        } else if (startArr !== -1 && endArr !== -1) {
            // 兜底：如果 AI 依然顽固地返回了数组
            let arrText = cleanText.substring(startArr, endArr + 1);
            arrText = arrText.replace(/,\s*]/g, ']').replace(/}\s*{/g, '},{');
            actions = JSON.parse(arrText);
        } else {
            throw new Error("No valid JSON found");
        }

    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Raw Text:", text);
        
        // 👇【核心修复】：史诗级降级处理，彻底解决掉格式和爆 JSON 代码的问题
        let cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        
        // 改进的降级正则提取，无视换行、空格和属性顺序
        const blockRegex = /\{[^{}]*\}/g;
        const blocks = cleanText.match(blockRegex);
        
        if (blocks && blocks.length > 0) {
            blocks.forEach(block => {
                // 增强正则，支持转义引号和内部包含任意字符
                const typeMatch = block.match(/"type"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                const contentMatch = block.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                const senderMatch = block.match(/"senderName"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                
                if (contentMatch) {
                    let actionObj = {
                        type: typeMatch ? typeMatch[1].replace(/\\"/g, '"') : 'text',
                        content: contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
                    };
                    if (senderMatch) {
                        actionObj.senderName = senderMatch[1].replace(/\\"/g, '"');
                    }
                    actions.push(actionObj);
                }
            });
        }
        
        // 如果还是没提取到，用最基础的 content 提取
        if (actions.length === 0) {
            const contentRegex = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            while ((match = contentRegex.exec(cleanText)) !== null) {
                actions.push({ type: 'text', content: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') });
            }
        }
        
        // 如果连 content 都没提取到，说明 AI 完全没按 JSON 格式输出，直接按行拆分为文本
        if (actions.length === 0) {
            const lines = cleanText.split('\n');
            actions = lines.map(line => {
                // 过滤掉只有大括号或中括号的行，防止爆出残缺的 JSON 代码
                if(line.trim() && !/^[[\]{}]+$/.test(line.trim())) {
                    return { type: 'text', content: line.trim() };
                }
            }).filter(Boolean);
        }
        // 👆 修复结束 👆
    }

    // 👇 新增：强制拆分兜底逻辑 (如果 AI 偷懒没有按要求拆分气泡，用 JS 强行切断) 👇
    const rMin = char.chatConfig?.replyMin !== undefined ? char.chatConfig.replyMin : 3;
    if (actions.length > 0 && actions.length < rMin) {
        let newActions = [];
        actions.forEach(act => {
            // 如果是文本，且长度超过 20 个字，强行按标点符号切分
            if (act && act.type === 'text' && act.content.length > 20) {
                const sentences = act.content.match(/[^。！？.!?]+[。！？.!?]*/g);
                if (sentences && sentences.length > 1) {
                    sentences.forEach(s => {
                        if (s.trim()) newActions.push({ ...act, content: s.trim() });
                    });
                } else {
                    newActions.push(act);
                }
            } else {
                newActions.push(act);
            }
        });
        actions = newActions;
    }
    // 👆 兜底逻辑结束 👆

    // 👇 新增：智能拦截兜底，防止 AI 忘了发邀请指令 👇
    let hasMusicInvite = actions.some(a => a && (a.type === 'music_invite_user' || a.type === 'music_invite'));
    if (!hasMusicInvite) {
        const textContent = actions.map(a => a ? a.content : '').join(' ');
        if (textContent.includes('一起听歌') || textContent.includes('听首歌') || textContent.includes('分享一首歌')) {
            console.log("拦截到 AI 听歌暗示，自动补全邀请卡片指令");
            actions.push({ type: 'music_invite_user', songName: '随机推荐', content: '' });
        }
    }
    // 👆 兜底逻辑结束 👆

    // 👇【终极修复】：将混杂在一起的 [表情]、[引用] 和 文本 强行拆分成独立的动作
    let splitActions = [];
    actions.forEach(act => {
        if (act && act.type === 'text' && act.content) {
            // 1. 提取并清理引用 (Quote)
            let quoteMatch = act.content.match(/[\[【](?:引用|回复)(?:了?消息)?[：:]?\s*(.*?)[\]】]/);
            if (quoteMatch) {
                act.quote = quoteMatch[1].trim();
                act.content = act.content.replace(quoteMatch[0], '').trim();
            }

            // 2. 拆分表情包和普通文本
            const stickerRegex = /([\[【].*?表情.*?[：:]\s*.*?[\]】])/g;
            if (stickerRegex.test(act.content)) {
                const parts = act.content.split(stickerRegex);
                parts.forEach(part => {
                    part = part.trim();
                    if (!part) return;
                    
                    const sMatch = part.match(/^[\[【].*?表情.*?[：:]\s*(.*?)[\]】]$/);
                    if (sMatch) {
                        splitActions.push({ ...act, type: 'sticker', content: sMatch[1].trim() });
                    } else {
                        splitActions.push({ ...act, type: 'text', content: part });
                    }
                });
            } else {
                splitActions.push(act);
            }
        } else {
            splitActions.push(act);
        }
    });
    actions = splitActions;
    // 👆 拆分结束 👆

    // 👇 核心修改：拉黑后，前两次在微信发感叹号，之后转入短信 APP 👇
    if (char && char.isBlocked) {
        char.blockedCount = (char.blockedCount || 0) + 1;

        if (char.blockedCount <= 2) {
            // 前两次：渲染在微信界面，带红色感叹号
            for (let action of actions) {
                if (!action || !action.content) continue;
                let extra = { isBlockedError: true }; // 打上拒收标记
                
                if (action.type === 'sticker') {
                    const url = wcFindStickerUrlMulti(stickerGroupIds, action.content);
                    if (url) wcAddMessage(charId, 'them', 'sticker', url, extra);
                    else wcAddMessage(charId, 'them', 'text', `[表情: ${action.content}]`, extra);
                } else if (action.type === 'image') {
                    wcAddMessage(charId, 'them', 'image', action.content, extra);
                } else {
                    wcAddMessage(charId, 'them', 'text', action.content, extra);
                }
            }
            // 注入系统提示，让 AI 知道被拒收了
            wcAddMessage(charId, 'system', 'system', `[系统强制警告：你刚才发送的消息旁边出现了红色的感叹号，提示“消息已发出，但被对方拒收了”。你意识到自己已经被 User 拉黑了！请在接下来的行动中，改用【手机短信】联系 User！]`, { hidden: true });
            wcSaveData();
        } else {
            // 超过两次：直接转入短信 APP
            for (let action of actions) {
                if (!action || !action.content) continue;
                let finalContent = action.content;
                if (action.type === 'sticker') finalContent = `[表情包: ${action.content}]`;
                if (action.type === 'image') finalContent = `[图片]`;
                
                if (typeof smsReceiveMessage === 'function') {
                    smsReceiveMessage(char.name, char.avatar, finalContent, char.id);
                }
            }
            if (!char.blockedMessages) char.blockedMessages = [];
            char.blockedMessages.unshift({ id: Date.now(), type: 'text', content: "已转入短信APP", time: Date.now() });
            wcSaveData();
        }
        
        // 拉黑状态下，直接结束解析，不执行后续的正常渲染
        return;
    }
    // 👆 拉黑拦截结束 👆

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (!action) continue;

        // 👇【新增修复】：纠正发送图片幻觉
        if (action.type === 'text') {
            let imgMatch = action.content.match(/[\[【]发送了一张图片[，,]?\s*图片ID[：:]\s*(.*?)[\]】]/) || 
                           action.content.match(/[\[【]图片[：:]\s*(.*?)[\]】]/) || 
                           action.content.match(/^[\[【]图片描述[\]】][：:]?\s*(.*)/);
            if (imgMatch) {
                action.type = 'text';
                action.content = `[图片描述] ${imgMatch[1].trim()}`;
            }
            
            // 👇 新增：纠正 AI 模仿历史记录发出的假转账文本幻觉
            let transferMatch = action.content.match(/^[\[【]转账[：:]\s*(\d+(\.\d+)?)(?:元)?[，,]\s*备注[：:]\s*(.*?)[，,]\s*状态[：:]\s*(.*?)[\]】]$/);
            if (transferMatch) {
                action.type = 'transfer';
                action.amount = transferMatch[1];
                action.note = transferMatch[3].trim();
                action.status = 'pending'; // 强制重置为 pending 状态，让用户可以点击收款
            }
        }
        // 👆 纠正结束 👆

        // 👇【核心修复】：第一条消息直接秒发！第二条及以后的消息才模拟打字延迟
        if (i > 0) {
            await wcDelay(1500 + Math.random() * 1000); 
        }
        
        let extra = {};
        if (action.quote) {
            extra.quote = action.quote;
        }
        // 保存群聊发送者名字
        if (char.isGroup && action.senderName) {
            extra.senderName = action.senderName;
        }

        if (action.type === 'transfer_action') { 
            // 👇【新增】：处理 AI 决定收款或退款的逻辑
            if (action.action === 'received' || action.action === 'rejected') {
                wcAIHandleTransfer(charId, action.action);
            }
            // 如果 AI 收款/退款时还附带了说话内容，发出来
            if (action.content) {
                wcAddMessage(charId, 'them', 'text', action.content, extra);
            }
        } 
        // --- 新增：处理换头像指令 (通过唯一ID精准匹配真实图片) ---
        else if (action.type === 'change_avatar') {
            const msgs = wcState.chats[charId] || [];
            const targetId = action.content; // AI 返回的图片 ID
            let selectedImage = null;

            // 1. 优先：根据 AI 提供的 图片ID 精准查找那张图片
            if (targetId) {
                const targetMsg = msgs.find(m => m.id.toString() === targetId.toString() && m.type === 'image');
                if (targetMsg) {
                    selectedImage = targetMsg.content;
                }
            }

            // 2. 兜底：如果 AI 没按格式输出 ID，或者找不到，降级使用最新的一张图片
            if (!selectedImage) {
                for (let k = msgs.length - 1; k >= 0; k--) {
                    if (msgs[k].sender === 'me' && msgs[k].type === 'image') {
                        selectedImage = msgs[k].content;
                        break;
                    }
                }
            }

            if (selectedImage) {
                const char = wcState.characters.find(c => c.id === charId);
                if (char) {
                    char.avatar = selectedImage; // 更换头像
                    wcSaveData(); // 保存数据
                    wcRenderAll(); // 刷新界面
                    
                    // 发送一条系统提示（仅自己可见）
                    wcAddMessage(charId, 'system', 'system', `[系统提示: ${char.name} 已换上了你发送的图片作为头像]`, { style: 'transparent' });
                    
                    // 如果绑定了恋人空间，同步更新恋人空间头像
                    if (lsState.isLinked && lsState.boundCharId === charId) {
                        lsRenderMain();
                    }
                }
            }
        }
        // --- 新增：处理朋友圈互动指令 ---
        else if (action.type === 'moment_like') {
            const momentId = parseInt(action.content || action.momentId);
            if (momentId) {
                wcAIHandleLike(charId, momentId);
                wcAddMessage(charId, 'system', 'system', `[系统提示: 你刚刚点赞了用户的朋友圈]`, { hidden: true });
            }
        }
        else if (action.type === 'moment_comment') {
            const momentId = parseInt(action.momentId || action.content);
            const commentText = action.content || action.comment;
            if (momentId && commentText) {
                wcAIHandleComment(charId, momentId, commentText);
                wcAddMessage(charId, 'system', 'system', `[系统提示: 你刚刚在朋友圈发表了评论: "${commentText}"]`, { hidden: true });
            }
        }
        // --- 新增结束 ---
        else if (action.type === 'transfer') {
            wcAddMessage(charId, 'them', 'transfer', '转账', { amount: action.amount, note: action.note, status: 'pending', ...extra });
        } else if (action.type === 'voice') {
            wcAddMessage(charId, 'them', 'voice', action.content, extra);
        } else if (action.type === 'sticker') {
            // 查找表情包 URL
            const url = wcFindStickerUrlMulti(stickerGroupIds, action.content);
            if (url) {
                wcAddMessage(charId, 'them', 'sticker', url, extra);
            } else {
                // 【修复】：如果没有关联表情包，直接拦截丢弃，不发文字描述
                console.warn("未关联表情包，拦截文字描述输出");
            }
        } else if (action.type === 'text') {
            wcAddMessage(charId, 'them', 'text', action.content, extra);
            
            if (lsState.pendingCharId === charId) {
                const agreeWords = ["同意", "答应", "好", "愿意", "可以", "没问题"];
                if (agreeWords.some(word => action.content.includes(word))) {
                    lsConfirmBind(charId);
                    const msgs = wcState.chats[charId];
                    msgs.forEach(m => { if (m.type === 'invite') m.status = 'accepted'; });
                    wcSaveData();
                    wcRenderMessages(charId);
                }
            }
        // 👇👇👇 从这里开始插入新增的代码 👇👇👇
        } else if (action.type === 'private_chat') {
            // 处理群聊中 AI 主动发起的私聊
            if (action.senderName) {
                // 找到发起私聊的那个单人角色
                const privateChar = wcState.characters.find(c => c.name === action.senderName && !c.isGroup);
                if (privateChar) {
                    // 👇 新增：给私聊角色注入群聊上下文，防止私聊时失忆或OOC
                    const groupName = char.name; // 当前群聊名称
                    const contextPrompt = `[系统内部信息(仅AI可见): 你刚刚在群聊【${groupName}】中，因为群里发生的事情，决定私下找 User 聊天。你主动给 User 发送了第一条私聊消息: "${action.content}"。请在接下来的私聊中，保持你的人设，并自然地衔接这个话题，禁止做出不符合人设的行为和发言！。]`;
                    wcAddMessage(privateChar.id, 'system', 'system', contextPrompt, { hidden: true });

                    // 1. 向该角色的私聊记录中添加消息 (这会自动触发系统的未读红点和横幅通知)
                    wcAddMessage(privateChar.id, 'them', 'text', action.content);
                    
                    // 2. 在当前的群聊中插入一条仅 AI 可见的提示，让 AI 知道私聊已经成功发出，防止它在群里重复说
                    wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): ${action.senderName} 已经私下给 User 发送了消息: "${action.content}"]`, { hidden: true });
                }
            }
        // 👆👆👆 插入结束 👆👆👆
        // ================= 新增：处理听歌邀请回应 =================
        } else if (action.type === 'music_accept' || action.type === 'music_reject') {

            // 【修复】：检查最近的聊天记录中，是否有用户发出的听歌邀请卡片
            const msgs = wcState.chats[charId] || [];
            const recentMsgs = msgs.slice(-10); // 检查最近10条消息
            const hasInvite = recentMsgs.some(m => m.type === 'music_invite' && m.sender === 'me');
            
            if (hasInvite) {
                if (action.type === 'music_accept') {
                    wcAddMessage(charId, 'them', 'text', action.content, extra);
                    musicStartListenTogether(charId); // 开启听歌状态并开始计时
                    showMainSystemNotification("Music", `${char.name} 接受了你的听歌邀请！`, char.avatar);
                } else {
                    wcAddMessage(charId, 'them', 'text', action.content, extra);
                    showMainSystemNotification("Music", `${char.name} 婉拒了听歌邀请。`, char.avatar);
                }
            } else {
                // 如果用户根本没发邀请卡片，AI 却回复了同意，说明用户是口头暗示。
                // 顺水推舟，将这个“同意”转化为 AI 主动向用户发起的听歌邀请！
                console.warn("拦截到 AI 幻觉的听歌回应，自动转换为 AI 主动邀请");
                wcAddMessage(charId, 'them', 'text', action.content, extra);
                if (action.type === 'music_accept') {
                    musicShowCharInviteModal(charId, ""); // 弹出邀请卡片
                }
            }
          // ================= 新增：AI 自主控制音乐逻辑 =================
        } else if (action.type === 'music_control') {
            let actionText = "";
            if (action.action === 'pause') { audioPlayer.pause(); musicState.isPlaying = false; actionText = "暂停了音乐"; }
            else if (action.action === 'play') { 
                audioPlayer.play().catch(e => console.warn("浏览器拦截了自动播放", e)); 
                musicState.isPlaying = true; 
                actionText = "继续播放了音乐"; 
            }
            else if (action.action === 'next') { musicPlayNext(); actionText = "切到了下一首歌"; }
            else if (action.action === 'prev') { musicPlayPrev(); actionText = "切到了上一首歌"; }
            
            musicUpdatePlayerUI();
            // 明确显示系统提示
            wcAddMessage(charId, 'system', 'system', `[系统提示: ${char.name} ${actionText}]`, { style: 'transparent' });
            
        // 👇 新增：处理 AI 直接点播列表里的歌曲 👇
        } else if (action.type === 'music_play_list_index') {
            const targetIdx = parseInt(action.index);
            if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < musicState.currentPlaylist.length) {
                const targetSong = musicState.currentPlaylist[targetIdx];
                wcAddMessage(charId, 'them', 'text', action.content || `*(切到了列表里的: ${targetSong.title})*`, extra);
                musicState.currentIndex = targetIdx;
                musicPlaySong(targetSong.id, targetSong.title, targetSong.artist, targetSong.cover);
                wcAddMessage(charId, 'system', 'system', `[系统提示: ${char.name} 将歌曲切换到了列表中的《${targetSong.title}》]`, { style: 'transparent' });
            } else {
                wcAddMessage(charId, 'them', 'text', action.content || "*(想切歌但没找到这首)*", extra);
            }
            
        } else if (action.type === 'music_search' || action.type === 'music_play_specific') {
            // 兼容旧指令，统一走搜索逻辑
            wcAddMessage(charId, 'them', 'text', action.content || `*(正在搜索: ${action.keyword}...)*`, extra);
            musicCharSearch(charId, action.keyword);
            
        } else if (action.type === 'music_play_selected') {
            // AI 筛选后确认播放
            wcAddMessage(charId, 'them', 'text', action.content || `*(为你播放: ${action.songName})*`, extra);
            musicCharPlaySelected(charId, action.songId, action.songName);
            
        } else if (action.type === 'music_add_selected') {
            // AI 筛选后确认添加到列表
            wcAddMessage(charId, 'them', 'text', action.content || `*(已将 ${action.songName} 加入播放列表)*`, extra);
            musicCharAddSelected(charId, action.songId, action.songName);
            
        } else if (action.type === 'music_delete_song') {
            wcAddMessage(charId, 'them', 'text', action.content || "*(删除了当前歌曲)*", extra);
            if (musicState.currentPlaylist.length > 0 && musicState.currentIndex !== -1) {
                const deletedSong = musicState.currentPlaylist[musicState.currentIndex];
                musicState.currentPlaylist.splice(musicState.currentIndex, 1);
                // 增加删歌的系统提示
                wcAddMessage(charId, 'system', 'system', `[系统提示: ${char.name} 删除了歌曲《${deletedSong.title}》]`, { style: 'transparent' });
                musicPlayNext(); // 删掉后自动播下一首
            }
            
        } else if (action.type === 'music_exit') {
            wcAddMessage(charId, 'them', 'text', action.content || "我先不听啦~", extra);
            musicForceStopListenTogether(charId);
            
        // 👇 新增：解析 AI 主动分享歌曲指令 👇
        } else if (action.type === 'share_song') {
            const songName = action.songName || '未知歌曲';
            const artist = action.artist || '未知歌手';
            const text = action.content || '';
            const target = action.target || 'chat';
            
            // 构造风格1的分享卡片 HTML
            const cardHtml = `
                <div class="chat-shared-song-card">
                    <div class="css-song-info-row">
                        <div style="width: 48px; height: 48px; border-radius: 8px; background: #111; display: flex; align-items: center; justify-content: center; color: #FFF; flex-shrink: 0;">
                            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: currentColor;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        </div>
                        <div class="css-song-text">
                            <div class="css-song-title">${songName}</div>
                            <div class="css-song-artist">${artist}</div>
                        </div>
                    </div>
                    <div class="css-song-footer">
                        <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        网易云音乐
                    </div>
                </div>
            `;

            if (target === 'moment') {
                const newMoment = {
                    id: Date.now(),
                    name: char.name,
                    avatar: char.avatar,
                    text: text ? `${text}<br><br>${cardHtml}` : cardHtml,
                    image: null,
                    imageDesc: null,
                    time: Date.now(),
                    likes: [],
                    comments: [],
                    visibleGroup: char.groupName || 'Default'
                };
                wcState.moments.unshift(newMoment);
                wcSaveData();
                wcRenderMoments();
                wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): 你刚刚在朋友圈分享了歌曲《${songName}》。]`, { hidden: true });
            } else {
                if (text) wcAddMessage(charId, 'them', 'text', text, extra);
                wcAddMessage(charId, 'them', 'receipt', cardHtml, extra);
            }
        // 👆 新增结束 👆
        } else if (action.type === 'music_invite_user' || action.type === 'music_invite') {
            // 1. 先把 AI 说的邀请话语发出来
            if (action.content) {
                wcAddMessage(charId, 'them', 'text', action.content, extra);
            }
            
            // 2. 再发送一张音乐邀请卡片到聊天记录 (👇 核心修复：合并 extra 参数，防止群聊时丢失发送者名字)
            wcAddMessage(charId, 'them', 'music_invite', '邀请听歌', {
                ...extra,
                songTitle: action.songName || '随机推荐',
                songArtist: char.name,
                status: 'pending'
            });
            
            // 3. 弹出屏幕中间的精美邀请弹窗
            musicShowCharInviteModal(charId, action.songName);      
            
        // 👇 新增：解析 AI 商城购买指令 👇
        } else if (action.type === 'shop_order') {
            if (action.items && Array.isArray(action.items)) {
                let totalCost = 0;
                let boughtItems = [];
                
                // 查找商品并计算总价
                action.items.forEach(itemName => {
                    const item = lsState.shopMenu.find(m => m.name === itemName);
                    if (item) {
                        totalCost += item.price !== undefined ? parseInt(item.price) : 52;
                        boughtItems.push(item);
                    }
                });

                if (boughtItems.length > 0) {
                    if (lsState.qaScore >= totalCost) {
                        // 余额充足，扣费并入库
                        lsState.qaScore -= totalCost;
                        if (!lsState.inventory) lsState.inventory = [];
                        boughtItems.forEach(item => {
                            lsState.inventory.unshift({
                                id: Date.now() + Math.random(),
                                name: item.name,
                                desc: item.desc || '专属互动特权',
                                time: Date.now()
                            });
                        });
                        lsSaveData();
                        
                        wcAddMessage(charId, 'them', 'text', action.content || `我挑好啦，买了 ${action.items.join('、')}！`, extra);
                        wcAddMessage(charId, 'system', 'system', `[系统提示: Ta 消耗了 ♥${totalCost} 购买了 ${action.items.join('、')}，物品已存入特权背包]`, { style: 'transparent' });
                    } else {
                        // 余额不足
                        wcAddMessage(charId, 'them', 'text', action.content || `呜呜，心动值不够买 ${action.items.join('、')}...`, extra);
                        wcAddMessage(charId, 'system', 'system', `[系统提示: Ta 尝试购买商品，但心动值余额不足 (需要 ♥${totalCost}，当前 ♥${lsState.qaScore})]`, { style: 'transparent' });
                    }
                } else {
                    wcAddMessage(charId, 'them', 'text', action.content || "我看了看，好像没有特别想买的~", extra);
                }
            }

        // 👇 新增：解析 AI 主动扭蛋指令 👇
        } else if (action.type === 'play_gacha') {
            const cost = 5.20;
            if (wcState.wallet.balance >= cost) {
                wcState.wallet.balance -= cost;
                wcState.wallet.transactions.push({
                    id: Date.now(), type: 'payment', amount: cost, note: `${char.name} 玩扭蛋机`, time: Date.now()
                });
                
                const wonScore = Math.floor(Math.random() * 41) + 10;
                lsState.qaScore += wonScore;
                lsSaveData();
                wcSaveData();

                wcAddMessage(charId, 'them', 'text', action.content || "我去玩扭蛋机啦！", extra);
                wcAddMessage(charId, 'system', 'system', `[系统提示: Ta 消耗了微信零钱 ¥5.20 玩了一次扭蛋机，为你们赢得了 ♥${wonScore} 心动值！]`, { style: 'transparent' });
            } else {
                wcAddMessage(charId, 'them', 'text', action.content || "想玩扭蛋机，但是零钱不够了...", extra);
            }

        // 👇 新增：解析 AI 情绪典当指令 👇
        } else if (action.type === 'pawn_emotion') {
            const wonScore = Math.floor(Math.random() * 31) + 20; // 20-50 积分
            lsState.qaScore += wonScore;
            lsSaveData();

            wcAddMessage(charId, 'them', 'text', action.content || "今天心情不太好，把坏情绪当掉啦！", extra);
            
            const receiptHtml = `
                <div class="chat-shared-card" style="border-color: #111; background: #FAFAFA;">
                    <div class="shared-card-tag" style="color: #111;">EMOTION RECEIPT</div>
                    <div class="shared-card-title">情绪典当收据</div>
                    <div class="shared-card-content" style="font-size: 12px; font-style: italic;">典当物：${action.emotion || '坏情绪'}</div>
                    <div class="shared-card-footer" style="color: #FF3B30; font-weight: bold; font-size: 14px;">收购价: +♥${wonScore}</div>
                </div>
            `;
            wcAddMessage(charId, 'them', 'receipt', receiptHtml);

        // 👇 新增：解析 AI 撤回消息指令 👇
        } else if (action.type === 'recall') {
            const msgs = wcState.chats[charId] || [];
            let targetMsg = null;
            // 倒序查找最后一条该角色发送的消息，且未被撤回
            for (let k = msgs.length - 1; k >= 0; k--) {
                if (msgs[k].sender === 'them' && msgs[k].type !== 'recall' && (!char.isGroup || msgs[k].senderName === action.senderName)) {
                    targetMsg = msgs[k];
                    break;
                }
            }
            
            if (targetMsg) {
                targetMsg.originalType = targetMsg.type;
                targetMsg.originalContent = targetMsg.content;
                targetMsg.type = 'recall';
                let senderName = char.isGroup && action.senderName ? action.senderName : char.name;
                targetMsg.content = `"${senderName}" 撤回了一条消息`;
                
                wcSaveData();
                wcRenderMessages(charId);
            }

        // 👇 新增：解析 AI 主动打来的电话 👇
        } else if (action.type === 'call_invite') {
            wcShowIncomingCall(charId);
            wcAddMessage(charId, 'system', 'system', `[系统内部信息: 你主动向 User 发起了语音通话请求，等待对方接听...]`, { hidden: true });
        
        // 👇 新增：解析 AI 食谱互动 👇
        } else if (action.type === 'recipe_send') {
            wcAddMessage(charId, 'them', 'text', action.content || "这是我今天的食谱哦~", extra);
            
            if (!char.phoneData) char.phoneData = {};
            if (!char.phoneData.recipe) char.phoneData.recipe = { my: {}, ta: {} };
            char.phoneData.recipe.ta = { b: action.b, l: action.l, d: action.d };
            
            wcAddMessage(charId, 'them', 'recipe', '食谱', {
                title: "Ta's Menu",
                desc: "点击查看 Ta 的今日食谱",
                isEdited: false,
                recipeData: char.phoneData.recipe.ta
            });
            
        } else if (action.type === 'recipe_edit') {
            wcAddMessage(charId, 'them', 'text', action.content || "我帮你把食谱改了！", extra);
            
            if (!char.phoneData) char.phoneData = {};
            if (!char.phoneData.recipe) char.phoneData.recipe = { my: {}, ta: {} };
            
            const mealKey = action.meal; // 'b', 'l', or 'd'
            if (['b', 'l', 'd'].includes(mealKey)) {
                const oldText = char.phoneData.recipe.my[mealKey] || '无';
                if (!char.phoneData.recipe.my.edits) char.phoneData.recipe.my.edits = {};
                
                char.phoneData.recipe.my.edits[mealKey] = {
                    old: oldText,
                    new: action.newText,
                    author: char.name
                };
                char.phoneData.recipe.my[mealKey] = action.newText; // 更新当前值
                
                wcAddMessage(charId, 'them', 'recipe', '食谱', {
                    title: "My Menu (已修改)",
                    desc: `${char.name} 修改了你的食谱`,
                    isEdited: true,
                    recipeData: char.phoneData.recipe.my
                });
            }
            
        // 👇 新增：解析 AI 主动点外卖 👇
        } else if (action.type === 'order_delivery') {
            wcAddMessage(charId, 'them', 'text', action.content || "给你点了个外卖，注意接电话哦~", extra);
            
            const receiptData = {
                logo: "FOOD DELIVERY",
                date: new Date().toLocaleString('zh-CN'),
                items: [{ name: action.foodName || "神秘外卖", price: action.price || "0.00" }],
                total: action.price || "0.00",
                msg: action.msg || "好好吃饭！"
            };
            
            wcAddMessage(charId, 'them', 'order', '外卖订单', {
                orderType: 'delivery',
                deliveryText: 'ETA: 30 MINS',
                receiptData: receiptData
            });
        // 👆 新增结束 👆

        // 👇 新增：解析 AI 主动发送情头邀请 👇
        } else if (action.type === 'avatar_invite') {
            const pairIdx = parseInt(action.pairIndex);
            if (!isNaN(pairIdx) && lsState.coupleAvatars && lsState.coupleAvatars[pairIdx]) {
                // 1. 发送 AI 的邀请话语
                if (action.content) {
                    wcAddMessage(charId, 'them', 'text', action.content, extra);
                }
                // 2. 发送邀请卡片
                wcAddMessage(charId, 'them', 'avatar_invite', '邀请更换情头', {
                    ...extra,
                    pairIndex: pairIdx,
                    status: 'pending'
                });
            }
        // 👆 新增结束 👆

        // 👇 新增：解析 AI 保存图片到相册 👇
        } else if (action.type === 'save_to_album') {
            // 往前找最近的一张 User 发的图片
            const msgs = wcState.chats[charId] || [];
            let targetImgBase64 = null;
            for (let k = msgs.length - 1; k >= 0; k--) {
                if (msgs[k].sender === 'me' && msgs[k].type === 'image') {
                    targetImgBase64 = msgs[k].content;
                    break;
                }
            }
            if (targetImgBase64 && typeof lsState !== 'undefined' && lsState.isLinked && lsState.boundCharId === charId) {
                lsSaveImageToAlbum(targetImgBase64, action.content || "偷偷存下来啦~");
                wcAddMessage(charId, 'system', 'system', `[系统内部信息: 你已将User刚才发的图片存入了专属时光相册，并写下批注：“${action.content}”]`, { hidden: true });
            }
        
        // 👇 新增：解析 AI 发送的许愿/待办指令
        } else if (action.type === 'wish_add') {
            if (!char.wishData) {
                char.wishData = { wishes: [], todos: [], achievements: [], puzzleBg: 'https://i.postimg.cc/kgD9CsbW/IMG-8012.jpg', puzzleUnlocked: 0 };
            }
            
            const newItem = {
                id: Date.now(),
                title: action.title || '无题',
                content: action.content || '',
                aiReply: null,
                status: 'pending',
                creator: 'char' // 标记为 AI 创建
            };
            
            if (action.wishType === 'todo') {
                char.wishData.todos.unshift(newItem);
            } else {
                char.wishData.wishes.unshift(newItem);
            }
            wcSaveData(); // 保存数据
            
            // 在聊天界面生成一张高级感卡片通知 User
            const cardHtml = `
                <div class="chat-shared-card" onclick="openWishApp()">
                    <div class="shared-card-tag">${action.wishType === 'todo' ? 'NEW TO-DO / 新待办' : 'NEW WISH / 新愿望'}</div>
                    <div class="shared-card-title">${action.title}</div>
                    <div class="shared-card-content">${action.content}</div>
                    <div class="shared-card-footer">点击前往星愿空间查看</div>
                </div>
            `;
            wcAddMessage(charId, 'them', 'receipt', cardHtml, extra);

        // 👇 新增：解析 AI 主动划掉愿望/待办的指令
        } else if (action.type === 'wish_complete') {
            if (char.wishData) {
                // 寻找匹配的未完成事项
                let targetItem = char.wishData.wishes.find(w => w.title === action.title && w.status === 'pending');
                let itemType = 'wish';
                if (!targetItem) {
                    targetItem = char.wishData.todos.find(t => t.title === action.title && t.status === 'pending');
                    itemType = 'todo';
                }
                
                if (targetItem) {
                    targetItem.status = 'done';
                    // 移入成就墙
                    char.wishData.achievements.unshift({
                        id: Date.now(), title: targetItem.title, date: Date.now(), type: itemType
                    });
                    // 解锁拼图
                    if (char.wishData.puzzleUnlocked < 9) char.wishData.puzzleUnlocked++;
                    wcSaveData();
                    
                    // 在聊天界面生成成就解锁卡片
                    const cardHtml = `
                        <div class="chat-shared-card" onclick="openWishApp()">
                            <div class="shared-card-tag" style="color: #D4AF37;">ACHIEVEMENT UNLOCKED</div>
                            <div class="shared-card-title">${targetItem.title}</div>
                            <div class="shared-card-content">Ta 刚刚标记了该事项为已完成！拼图碎片 +1</div>
                            <div class="shared-card-footer">点击前往星愿空间查看</div>
                        </div>
                    `;
                    wcAddMessage(charId, 'them', 'receipt', cardHtml, extra);
                }
            }
        // 👆 新增结束

        } else if (action.type === 'redpacket_send') {
            const amount = parseFloat(action.amount) || 5.20;
            const msgText = action.msg || '恭喜发财，大吉大利';
            const senderName = char.isGroup && action.senderName ? action.senderName : char.name;
            
            let rpType = 'normal';
            let count = 1;
            let target = null;

            // 强制隔离：只有群聊才允许解析拼手气、专属和个数
            if (char.isGroup) {
                rpType = action.rpType || 'random';
                count = parseInt(action.count) || 1;
                target = action.target || null;
            }

            const rpData = {
                id: Date.now().toString() + Math.random().toString().substring(2, 6),
                type: rpType,
                isGroup: char.isGroup,
                totalAmount: amount,
                count: count,
                msg: msgText,
                target: rpType === 'exclusive' ? target : null,
                sender: senderName,
                status: 'unopened', 
                receivers: [] 
            };

            wcAddMessage(charId, 'them', 'redpacket', '微信红包', { rpData: rpData, senderName: senderName, ...extra });
            
            const userName = (char.chatConfig && char.chatConfig.userName) ? char.chatConfig.userName : wcState.user.name;
            
            if (!char.isGroup || (rpType === 'exclusive' && target === userName)) {
                wcAddMessage(charId, 'system', 'system', `[系统提示: ${senderName} 给你发了一个红包，快点击领取吧！]`, { style: 'transparent' });
            } else if (char.isGroup) {
                let aiPrompt = `[系统内部信息(仅AI可见): ${senderName} 刚刚在群里发了一个微信红包。总金额：¥${amount.toFixed(2)}，留言：“${msgText}”。`;
                if (rpType === 'random') aiPrompt += `这是一个拼手气红包，共 ${count} 个。`;
                else if (rpType === 'normal') aiPrompt += `这是一个普通红包，共 ${count} 个。`;
                else if (rpType === 'exclusive') aiPrompt += `这是一个专属红包，仅限【${target}】领取。`;
                aiPrompt += `群里的NPC可以根据自己的人设决定是否抢红包。如果决定抢，请在返回的 JSON 数组中加入 {"type":"redpacket_receive", "id": "${rpData.id}", "senderName": "抢红包的角色名"} 指令。注意：专属红包只有指定的人能抢成功！]`;
                wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });
            }

        } else if (action.type === 'invite_accept') {
            // AI 明确同意邀请
            wcAddMessage(charId, 'them', 'text', action.content, extra);
            if (lsState.pendingCharId === charId) {
                lsConfirmBind(charId); // 绑定关系
                // 更新聊天记录里的卡片状态为已同意
                const msgs = wcState.chats[charId];
                msgs.forEach(m => { if (m.type === 'invite') m.status = 'accepted'; });
                wcSaveData();
                wcRenderMessages(charId);
                if (typeof showMainSystemNotification === 'function') {
                    showMainSystemNotification("恋人空间", `${char.name} 同意了你的恋爱邀请！`, char.avatar);
                }
            }
        } else if (action.type === 'invite_reject') {
            // AI 明确拒绝邀请
            wcAddMessage(charId, 'them', 'text', action.content, extra);
            if (lsState.pendingCharId === charId) {
                lsState.pendingCharId = null; // 清除等待状态
                // 更新聊天记录里的卡片状态为已拒绝
                const msgs = wcState.chats[charId];
                msgs.forEach(m => { if (m.type === 'invite') m.status = 'rejected'; });
                lsSaveData();
                wcSaveData();
                wcRenderMessages(charId);
            }
        } else if (action.type === 'invite') {
             // 兜底：如果 AI 还是用了旧指令，直接当做同意处理
             wcAddMessage(charId, 'them', 'text', action.content || "我同意啦~", extra);
             if (lsState.pendingCharId === charId) {
                 lsConfirmBind(charId);
                 const msgs = wcState.chats[charId];
                 msgs.forEach(m => { if (m.type === 'invite') m.status = 'accepted'; });
                 wcSaveData();
                 wcRenderMessages(charId);
             }
                     } else if (action.type === 'update_status') {
            if (!char.lifeStatus) {
                char.lifeStatus = { location: "未知", action: "未知", mood: "未知", timeline: [], autoRefresh: true, refreshTime: "06:00", lastRefreshTimestamp: Date.now() };
            }
            
            let locationChanged = false;
            let newLocation = action.location || char.lifeStatus.location;
            
            // 判断位置是否发生实质性变化 (且不是从未知变来的)
            if (action.location && action.location !== "未知" && action.location !== char.lifeStatus.location) {
                // 如果原本不是未知，说明是中途移动了，触发提示
                if (char.lifeStatus.location !== "未知") {
                    locationChanged = true;
                }
            }

            // 只更新地点和动作
            if (action.location) char.lifeStatus.location = action.location;
            if (action.action) char.lifeStatus.action = action.action;

            wcSaveData();
            
            // 实时刷新顶栏
            if (typeof updateChatTopBarStatus === 'function') {
                updateChatTopBarStatus(char);
            }
            
            // 如果位置改变了，插入一条可见的系统提示
            if (locationChanged) {
                wcAddMessage(charId, 'system', 'system', `[系统提示: ${char.name} 正在前往 ${newLocation}]`, { style: 'transparent' });
            }
            

        } else if (action.type === 'widget_photo' || action.type === 'widget_note') {
            // 修复：独立出来，专门处理小组件指令
            if (lsState.isLinked && lsState.boundCharId === charId && lsState.widgetEnabled) {
                const isPhoto = action.type === 'widget_photo';
                lsState.widgetData.currentMode = isPhoto ? 'photo' : 'note';
                
                if (isPhoto) {
                    lsState.widgetData.customPhoto = ''; // 清除本地图片，使用AI描述
                    lsState.widgetData.photoDesc = action.content;
                } else {
                    lsState.widgetData.noteText = action.content;
                }
                
                // 👇 新增：将 AI 发送的小组件存入回忆墙
                const nowStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
                if (!lsState.widgetArchive) lsState.widgetArchive = [];
                lsState.widgetArchive.unshift({
                    id: Date.now(),
                    type: isPhoto ? 'photo' : (Math.random() > 0.5 ? 'note_light' : 'note_dark'),
                    img: null, // AI 发送的图片是文字描述，所以没有真实图片
                    text: isPhoto ? `[AI画面] ${action.content}` : action.content,
                    date: nowStr,
                    sender: 'char'
                });
                // 👆 新增结束
                
                lsSaveData();
                lsRenderWidget();
                
                // 触发系统通知
                const char = wcState.characters.find(c => c.id === charId);
                const charName = char ? char.name : "对方";
                const notifMsg = isPhoto ? `${charName} 更新了你的桌面照片` : `${charName} 给你留了一张便利贴`;
                showMainSystemNotification("恋人空间", notifMsg, char ? char.avatar : null);
                
                // 在聊天中插入一条不可见的系统提示，让AI知道自己更新成功了
                wcAddMessage(charId, 'system', 'system', `[系统提示: 你已成功更新了用户桌面的小组件内容为: "${action.content}"]`, { hidden: true });
            }
        }
        
        wcScrollToBottom();
    }
    if (char && char.chatConfig && char.chatConfig.momentFreq > 0) {
        const rand = Math.random() * 100;
        if (rand < char.chatConfig.momentFreq) {
            wcTriggerAIMoment(charId);
        }
    }
    
    // 👇 核心修改：直接在这里处理 AI 顺便返回的手机后台更新数据 (精简版) 👇
    if (phoneUpdate) {
        try {
            if (!char.phoneData) char.phoneData = {};
            if (!char.phoneData.profile) char.phoneData.profile = { nickname: char.name, sign: "暂无签名" };

            let hasChanges = false;

            if (phoneUpdate.newRemark && phoneUpdate.newRemark !== "null") {
                char.phoneData.userRemark = phoneUpdate.newRemark;
                if (char.phoneData.contacts) {
                    const uContact = char.phoneData.contacts.find(c => c.isUser);
                    if (uContact) uContact.name = phoneUpdate.newRemark;
                }
                if (char.phoneData.chats) {
                    const uChat = char.phoneData.chats.find(c => c.isUser);
                    if (uChat) uChat.name = phoneUpdate.newRemark;
                }
                wcAddMessage(charId, 'system', 'system', `[系统提示：${char.name} 将你的备注改为了“${phoneUpdate.newRemark}”]`, { style: 'transparent' });
                hasChanges = true;
            }

            if (phoneUpdate.newNickname && phoneUpdate.newNickname !== "null") {
                char.phoneData.profile.nickname = phoneUpdate.newNickname;
                hasChanges = true;
            }
            if (phoneUpdate.newSign && phoneUpdate.newSign !== "null") {
                char.phoneData.profile.sign = phoneUpdate.newSign;
                hasChanges = true;
            }

            if (hasChanges) {
                wcSaveData();
            }
        } catch (err) {
            console.warn("解析 phoneUpdate 失败:", err);
        }
    }
    // 👆 核心修改结束 👆
}

// ==========================================
// 核心修复：朋友圈生成逻辑 (带NPC评论版 + 严格错误拦截)
// ==========================================
async function wcTriggerAIMoment(charId) {
    console.log(`Char ${charId} 尝试发布朋友圈...`);
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return;

    try {
        // 1. 获取聊天配置和用户人设
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";

        // 2. 获取勾选的关联世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 3. 获取最近 30 条聊天记录上下文
        const msgs = wcState.chats[charId] || [];
        const recentMsgs = msgs.slice(-30).map(m => {
            if (m.isError || m.type === 'system') return null; // 排除报错和系统消息
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender === 'me' ? 'User' : char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        // 👇 新增：提取通讯录里的 NPC 列表，让 AI 知道有哪些熟人可以来评论
        let npcListStr = "无";
        if (char.phoneData && char.phoneData.contacts) {
            const npcs = char.phoneData.contacts.filter(c => !c.isUser);
            if (npcs.length > 0) {
                npcListStr = npcs.map(n => `${n.name} (${n.desc})`).join('、');
            }
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeString = `${year}年${month}月${date}日 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
        
        // 4. 组装全新的 Prompt
        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += `【你的人设】：${char.prompt}\n`;
        if (wbInfo) prompt += `${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += `【你手机通讯录里的NPC朋友】：${npcListStr}\n`;
        prompt += `【当前现实时间】：${timeString} ${dayString}\n\n`;
        
        prompt += `【最近的聊天记录（作为发朋友圈的灵感/背景）】：\n`;
        prompt += `${recentMsgs ? recentMsgs : '暂无聊天记录'}\n\n`;

        prompt += `请根据你的人设、当前时间、用户设定以及【最近的聊天记录】，发布一条微信朋友圈。\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 朋友圈的内容通常是对最近聊天中发生的事情的感慨、吐槽、分享，或者对User的暗示。\n`;
        prompt += `2. 文案要符合日常朋友圈风格，生活化，不要太长，拒绝AI味。\n`;
        prompt += `3. 【时间观念警告】：请务必注意当前时间！发帖内容和 NPC 的评论必须符合当前的时间点。\n`;
        prompt += `4. 【活人感排版】：你可以自由选择纯文本、纯图片或图文并茂。\n`;
        prompt += `4. 【互动感（核心）】：你可以在 comment 字段填写自己的抢沙发补充（也可以不填写）。同时，请根据【通讯录NPC朋友】列表，生成 1-3 条 NPC 对这条朋友圈的评论 (npcComments)。\n`;
        prompt += `5. 要求返回纯JSON对象，不要Markdown标记，格式如下：\n`;
        prompt += `{
  "text": "朋友圈文案内容(可留空)", 
  "imageDesc": "配图的画面描述(可留空)", 
  "comment": "你自己在该条朋友圈下的评论/补充(可留空)",
  "npcComments": [
    {"name": "NPC名字(必须从通讯录选)", "text": "NPC的评论内容"}
  ]
}\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 4000
            })
        });

        const data = await response.json();
        
        // 👇 核心修复：拦截并显示真实的 API 错误原因 👇
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。详细报错：" + JSON.stringify(data));
        }
        // 👆 修复结束 👆

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const momentData = JSON.parse(content);

        if (momentData && (momentData.text || momentData.imageDesc)) {
            wcAIHandleMomentPost(charId, momentData.text || "", momentData.imageDesc || null, momentData.comment || null, momentData.npcComments || []);
            console.log(`Char ${charId} 成功发布朋友圈`);
        }
    } catch (e) {
        console.error("朋友圈生成失败", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[朋友圈生成失败] ${e.message}`);
    }
}


function wcAIHandleMomentPost(charId, text, imageDesc, selfComment = null, npcComments = []) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;
    
    const newMoment = {
        id: Date.now(),
        name: char.name,
        avatar: char.avatar,
        text: text,
        image: null,
        imageDesc: imageDesc,
        time: Date.now(),
        likes: [],
        comments: [],
        visibleGroup: char.groupName || 'Default' // 新增：AI发布的朋友圈仅同分组可见
    };
    
    // 1. 如果 AI 传了自我评论，加进评论列表里
    if (selfComment && selfComment.trim() !== "") {
        newMoment.comments.push({ name: char.name, text: selfComment.trim() });
    }
    
    // 2. 把 NPC 的评论也加进去
    if (Array.isArray(npcComments) && npcComments.length > 0) {
        npcComments.forEach(npcC => {
            if (npcC.name && npcC.text) {
                newMoment.comments.push({ name: npcC.name, text: npcC.text });
            }
        });
    }
    
    wcState.moments.unshift(newMoment);
    wcSaveData();
    wcRenderMoments();
}


function wcAIHandleComment(charId, momentId, text) {
    const char = wcState.characters.find(c => c.id === charId);
    const moment = wcState.moments.find(m => m.id == momentId);
    if (!char || !moment) return;

    if (!moment.comments) moment.comments = [];
    moment.comments.push({ name: char.name, text: text });
    wcSaveData();
    wcRenderMoments();
}

function wcAIHandleReply(charId, momentId, targetName, text) {
    const char = wcState.characters.find(c => c.id === charId);
    const moment = wcState.moments.find(m => m.id == momentId);
    if (!char || !moment) return;

    if (!moment.comments) moment.comments = [];
    moment.comments.push({ name: char.name, text: `回复 ${targetName}: ${text}` });
    wcSaveData();
    wcRenderMoments();
}

function wcAIHandleLike(charId, momentId) {
    const char = wcState.characters.find(c => c.id === charId);
    const moment = wcState.moments.find(m => m.id == momentId);
    if (!char || !moment) return;
    
    if (!moment.likes) moment.likes = [];
    if (!moment.likes.includes(char.name)) {
        moment.likes.push(char.name);
        wcSaveData();
        wcRenderMoments();
    }
}

function wcAIHandleTransfer(charId, status) {
    const msgs = wcState.chats[charId] || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === 'transfer' && m.sender === 'me' && m.status === 'pending') {
            m.status = status;
            if (status === 'rejected') {
                const amount = parseFloat(m.amount);
                wcState.wallet.balance += amount;
                wcState.wallet.transactions.push({
                    id: Date.now(), type: 'income', amount: amount, note: `转账退还`, time: Date.now()
                });
                wcAddMessage(charId, 'them', 'system', `对方已退还你的转账`, { style: 'transparent' });
            } else if (status === 'received') {
                wcAddMessage(charId, 'them', 'system', `对方已收款`, { style: 'transparent' });
            }
            wcSaveData();
            wcRenderMessages(charId);
            break;
        }
    }
}

function wcFindStickerUrlMulti(groupIds, desc) {
    // 【修复】：如果明确传入了空数组，说明没有勾选任何表情包，不应该去全部里找
    if (groupIds && groupIds.length === 0) return null;

    const groupsToSearch = (groupIds && groupIds.length > 0) 
        ? groupIds.map(id => wcState.stickerCategories[id]).filter(g => g)
        : wcState.stickerCategories;

    for (const group of groupsToSearch) {
        if (group && group.list) {
            const sticker = group.list.find(s => s.desc.trim() === desc.trim());
            if (sticker) return sticker.url;
        }
    }
    return null;
}

function wcAddMessage(charId, sender, type, content, extra = {}) {
    if (!charId) return; // 👈 加上这一行保护，防止产生无效的聊天记录
    if (!wcState.chats[charId]) wcState.chats[charId] = [];
    const msg = { 
        id: Date.now() + Math.random(),
        sender, type, content, time: Date.now(), ...extra
    };
    wcState.chats[charId].push(msg);

    // 👇 核心修改：不再单独触发评估，交由正常的聊天 AI 统一处理，节省额度
    // (此处已移除单独的 lsEvaluateAndSaveImage 调用)
    // 👆 修改结束
    
    if (sender === 'them' && type !== 'system') {

        const isChatOpen = document.getElementById('wc-view-chat-detail').classList.contains('active');
        const isSameChat = wcState.activeChatId === charId;
        
        const musicChatWin = document.getElementById('music-chat-window');
        const isMusicChatOpen = musicChatWin && musicChatWin.style.display === 'flex' && musicState.listenTogether.charId === charId;

        const char = wcState.characters.find(c => c.id === charId);
        let notifText = content;
        if (type === 'sticker') notifText = '[表情包]';
        else if (type === 'image') notifText = '[图片]';
        else if (type === 'voice') notifText = '[语音]';
        else if (type === 'transfer') notifText = '[转账]';
        else if (type === 'invite') notifText = '[恋人空间邀请]';

        // 1. 核心解耦：无论在什么页面，只要满足条件，就向系统发送真实通知请求
        if (char) {
            sendRealSystemNotification(char.name, notifText, char.avatar);
        }

        // 2. 处理应用内的网页横幅通知 (仅当不在当前聊天页面时触发)
        if ((!isChatOpen || !isSameChat) && !isMusicChatOpen) {
            if (!wcState.unreadCounts[charId]) wcState.unreadCounts[charId] = 0;
            wcState.unreadCounts[charId]++;
            
            if (char) {
                wcShowIOSNotification(char, notifText);
            }
            
            if (document.getElementById('wc-view-chat').classList.contains('active')) {
                wcRenderChats();
            }
        } else {
            // 如果在当前聊天页面，虽然不弹网页横幅，但如果开启了全程通知，需要播放提示音
            if (isAlwaysRealNotifEnabled) {
                playNotificationSound();
            }
        }
    }

    // ==========================================
    // 核心修复：群聊记忆同步 & 恋人空间面具隔离逻辑
    // ==========================================
    if (type !== 'system' && !extra.isError) {
        const targetChar = wcState.characters.find(c => c.id === charId);
        
        if (targetChar) {
            let senderNameStr = "";
            if (sender === 'me') {
                senderNameStr = (targetChar.chatConfig && targetChar.chatConfig.userName) ? targetChar.chatConfig.userName : wcState.user.name;
            } else {
                senderNameStr = extra.senderName || targetChar.name;
            }

            let contentStr = content;
            if (type === 'sticker') contentStr = '[表情包]';
            else if (type === 'image') contentStr = '[图片]';
            else if (type === 'voice') contentStr = '[语音]';
            else if (type === 'transfer') contentStr = '[转账]';

            // 1. 如果是群聊，将消息同步给群里的所有 NPC 成员的单聊记忆中
            if (targetChar.isGroup && targetChar.members) {
                targetChar.members.forEach(memberId => {
                    if (memberId === 'user') return;
                    wcAddMessage(memberId, 'system', 'system', 
                        `[群聊记忆同步: 在【${targetChar.name}】群聊中，${senderNameStr} 发送了消息: "${contentStr}"]`, 
                        { hidden: true }
                    );
                });
            }

            // 2. 恋人空间同步逻辑
            if (lsState.isLinked && lsState.boundCharId && charId !== lsState.boundCharId) {
                const boundChar = wcState.characters.find(c => c.id === lsState.boundCharId);
                
                if (boundChar) {
                    // 修改为：只有同一个列表分组的ai角色才能知道同一个列表分组的ai角色的关联账号消息 (不包含All分组)
                    const currentGroup = targetChar.groupName || 'All';
                    const boundGroup = boundChar.groupName || 'All';
                    
                    if (currentGroup !== 'All' && currentGroup === boundGroup) {
                        const isLoverInGroup = targetChar.isGroup && targetChar.members && targetChar.members.includes(lsState.boundCharId);
                        
                        if (!isLoverInGroup) {
                            if (targetChar.isGroup) {
                                if (sender === 'me') {
                                    lsAddFeed(`你在 ${targetChar.name} 群聊发送了消息: "${contentStr}"`, null, msg.id);
                                    wcAddMessage(lsState.boundCharId, 'system', 'system', 
                                        `[系统提示: 你的恋人(User)刚刚在【${targetChar.name}】群聊中发送了一条消息: "${contentStr}"。请注意，你们开启了账号关联，你能感知到这一切。]`, 
                                        { hidden: true }
                                    );
                                } else if (sender === 'them') {
                                    lsAddFeed(`${targetChar.name} 群聊的 ${senderNameStr} 发送了消息: "${contentStr}"`, targetChar.avatar, msg.id);
                                    wcAddMessage(lsState.boundCharId, 'system', 'system', 
                                        `[系统提示: 你的恋人(User)所在的【${targetChar.name}】群聊中，${senderNameStr} 发送了一条消息: "${contentStr}"。请注意，你们开启了账号关联，你能感知到这一切。]`, 
                                        { hidden: true }
                                    );
                                }
                            } else {
                                if (sender === 'me') {
                                    lsAddFeed(`你给 ${targetChar.name} 发送了消息: "${contentStr}"`, null, msg.id);
                                    wcAddMessage(lsState.boundCharId, 'system', 'system', 
                                        `[系统提示: 你的恋人(User)刚刚给 ${targetChar.name} 发送了一条消息: "${contentStr}"。请注意，你们开启了账号关联，你能感知到这一切。]`, 
                                        { hidden: true }
                                    );
                                } else if (sender === 'them') {
                                    lsAddFeed(`${targetChar.name} 给你发送了消息: "${contentStr}"`, targetChar.avatar, msg.id);
                                    wcAddMessage(lsState.boundCharId, 'system', 'system', 
                                        `[系统提示: ${targetChar.name} 刚刚给你的恋人(User)发送了一条消息: "${contentStr}"。请注意，你们开启了账号关联，你能感知到这一切。]`, 
                                        { hidden: true }
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const char = wcState.characters.find(c => c.id === charId);
    if (char && char.chatConfig && char.chatConfig.summaryTrigger > 0) {
        const triggerCount = char.chatConfig.summaryTrigger;
        const totalMsgs = wcState.chats[charId].length;
        
        if (totalMsgs % triggerCount === 0) {
            const start = totalMsgs - triggerCount;
            const end = totalMsgs - 1;
            wcAutoGenerateSummary(charId, start, end);
        }
    }

    wcSaveData();
    if (wcState.activeChatId === charId) {
        wcRenderMessages(charId);
        wcScrollToBottom();
    }
    
    // 【修复】：同步更新音乐播放器里的迷你聊天窗口
    if (typeof musicState !== 'undefined' && 
        musicState.listenTogether && 
        musicState.listenTogether.active && 
        musicState.listenTogether.charId === charId) {
        const musicChatWin = document.getElementById('music-chat-window');
        if (musicChatWin && (musicChatWin.style.display === 'flex' || musicChatWin.style.display === 'block')) {
            if (typeof musicRenderChatMessages === 'function') {
                musicRenderChatMessages();
            }
        }
    }
}

// --- iOS Notification Logic ---
function wcShowIOSNotification(char, text) {
    const container = document.getElementById('ios-notification-container');
    if (!container) return;
    
    // 【核心修复】：在添加新通知前，清空旧通知，实现覆盖效果
    container.innerHTML = ''; 
    
    const banner = document.createElement('div');
    banner.className = 'ios-notification-banner';
    
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    banner.innerHTML = `
        <img src="${char.avatar}" class="ios-notif-icon">
        <div class="ios-notif-content">
            <div class="ios-notif-header">
                <span class="ios-notif-title">${char.name}</span>
                <span class="ios-notif-time">现在</span>
            </div>
            <div class="ios-notif-msg">${text}</div>
        </div>
    `;

    banner.onclick = () => {
        if (!document.getElementById('wechatModal').classList.contains('open')) {
            openWechat();
        }
        if (document.getElementById('wc-view-phone-sim').classList.contains('active')) {
            wcClosePhoneSim();
        }
        
        wcOpenChat(char.id);
        banner.classList.remove('active');
        setTimeout(() => banner.remove(), 400);
    };

    container.appendChild(banner);

    requestAnimationFrame(() => {
        banner.classList.add('active');
    });

    setTimeout(() => {
        if (banner.parentElement) {
            banner.classList.remove('active');
            setTimeout(() => banner.remove(), 400);
        }
    }, 5000);
    
    // 👇 触发声音与震动触感
    playNotificationSound();
}

// --- iOS Loading Overlay Functions ---
function wcShowLoading(text = "正在生成内容...") {
    const overlay = document.getElementById('wc-ios-loading-overlay');
    const spinner = document.getElementById('wc-loading-spinner');
    const success = document.getElementById('wc-loading-success');
    const error = document.getElementById('wc-loading-error');
    const textEl = document.getElementById('wc-loading-text');

    spinner.style.display = 'block';
    success.classList.add('hidden');
    error.classList.add('hidden');
    textEl.innerText = text;
    overlay.classList.remove('hidden');
}

function wcShowSuccess(text = "生成成功") {
    const spinner = document.getElementById('wc-loading-spinner');
    const success = document.getElementById('wc-loading-success');
    const textEl = document.getElementById('wc-loading-text');

    spinner.style.display = 'none';
    success.classList.remove('hidden');
    textEl.innerText = text;

    setTimeout(() => {
        document.getElementById('wc-ios-loading-overlay').classList.add('hidden');
    }, 2000);
}

function wcShowError(text = "生成失败") {
    const spinner = document.getElementById('wc-loading-spinner');
    const error = document.getElementById('wc-loading-error');
    const textEl = document.getElementById('wc-loading-text');

    spinner.style.display = 'none';
    error.classList.remove('hidden');
    textEl.innerText = text;

    setTimeout(() => {
        document.getElementById('wc-ios-loading-overlay').classList.add('hidden');
    }, 2500);
}

async function wcAutoGenerateSummary(charId, start, end) {
    const char = wcState.characters.find(c => c.id === charId);
    const msgs = wcState.chats[charId] || [];
    const sliceMsgs = msgs.slice(start, end + 1);
    const apiConfig = await getActiveApiConfig('chat');
    
    if (!apiConfig || !apiConfig.key) return;

    // 检查限制
    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) return;
    sessionApiCallCount++;

    try {
        let prompt = `请总结以下对话的主要内容，提取关键信息和情感变化，字数控制在200字以内。\n`;
        
        if (char.chatConfig && char.chatConfig.summaryWorldbookEntries) {
            prompt += `\n【参考背景】\n`;
            char.chatConfig.summaryWorldbookEntries.forEach(id => {
                const entry = worldbookEntries.find(e => e.id.toString() === id.toString());
                if (entry) prompt += `- ${entry.title}: ${entry.desc}\n`;
            });
        }

        prompt += `\n【对话】\n`;
        sliceMsgs.forEach(m => {
            const sender = m.sender === 'me' ? '用户' : char.name;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            prompt += `${sender}: ${content}\n`;
        });

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.5

            })
        });

        const data = await response.json();
        let summary = data.choices[0].message.content;
        summary = summary.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

        if (!char.memories) char.memories = [];
        char.memories.unshift({
            id: Date.now(),
            type: 'summary',
            content: `[自动总结 ${start}-${end}] ${summary}`,
            time: Date.now()
        });
        wcSaveData();
        if (document.getElementById('wc-view-memory').classList.contains('active')) {
            wcRenderMemories();
        }
        console.log("自动总结完成");

    } catch (e) {
        console.error("自动总结失败", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[自动总结失败] ${e.message}`);
    }
}

// --- WeChat Panels ---
function wcToggleStickerPanel() {
    if (wcState.isStickerPanelOpen) {
        wcCloseAllPanels();
    } else {
        wcState.isMorePanelOpen = false;
        wcState.isStickerPanelOpen = true;
        wcUpdatePanelUI();
    }
}

function wcToggleMorePanel() {
    if (wcState.isMorePanelOpen) {
        wcCloseAllPanels();
    } else {
        wcState.isStickerPanelOpen = false;
        wcState.isMorePanelOpen = true;
        wcUpdatePanelUI();
    }
}

function wcCloseAllPanels() {
    wcState.isStickerPanelOpen = false;
    wcState.isMorePanelOpen = false;
    wcState.isStickerDeleteMode = false;
    wcUpdatePanelUI();
}

function wcUpdatePanelUI() {
    const stickerPanel = document.getElementById('wc-sticker-panel');
    const morePanel = document.getElementById('wc-more-panel');
    const footer = document.getElementById('wc-chat-footer');
    const scrollArea = document.getElementById('wc-chat-messages');

    stickerPanel.classList.remove('active');
    morePanel.classList.remove('active');
    footer.classList.remove('panel-active');
    scrollArea.classList.remove('panel-open');

    if (wcState.isStickerPanelOpen) {
        stickerPanel.classList.add('active');
        footer.classList.add('panel-active');
        scrollArea.classList.add('panel-open');
        wcRenderStickerPanel();
    } else if (wcState.isMorePanelOpen) {
        morePanel.classList.add('active');
        footer.classList.add('panel-active');
        scrollArea.classList.add('panel-open');
        
        // 👇 新增：群聊模式下隐藏状态和梦境按钮
        const char = wcState.characters.find(c => c.id === wcState.activeChatId);
        const statusBtn = document.getElementById('wc-more-item-status');
        const dreamBtn = document.getElementById('wc-more-item-dream');
        if (char && char.isGroup) {
            if (statusBtn) statusBtn.style.display = 'none';
            if (dreamBtn) dreamBtn.style.display = 'none';
        } else {
            if (statusBtn) statusBtn.style.display = 'flex';
            if (dreamBtn) dreamBtn.style.display = 'flex';
        }
    }
    wcScrollToBottom();
}

// --- WeChat Stickers ---
function wcRenderStickerPanel() {
    const container = document.getElementById('wc-sticker-tabs');
    container.innerHTML = '';
    wcState.stickerCategories.forEach((cat, index) => {
        const tab = document.createElement('div');
        tab.className = `wc-sticker-tab-item ${index === wcState.activeStickerCategoryIndex ? 'active' : ''}`;
        tab.innerText = cat.name;
        tab.onclick = () => { wcState.activeStickerCategoryIndex = index; wcRenderStickerPanel(); };
        container.appendChild(tab);
    });

    const grid = document.getElementById('wc-sticker-grid');
    grid.innerHTML = '';
    const currentCat = wcState.stickerCategories[wcState.activeStickerCategoryIndex];
    if (!currentCat || !currentCat.list) return;

    currentCat.list.forEach((sticker, index) => {
        const item = document.createElement('div');
        item.className = `wc-sticker-item ${wcState.isStickerDeleteMode ? 'shake' : ''}`;
        
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'center';
        item.style.padding = '5px';
        
        const img = document.createElement('img');
        img.src = sticker.url;
        img.style.width = '50px';
        img.style.height = '50px';
        img.style.objectFit = 'contain';
        item.appendChild(img);

        const desc = document.createElement('div');
        desc.style.fontSize = '10px';
        desc.style.color = '#888';
        desc.style.textAlign = 'center';
        desc.style.marginTop = '4px';
        desc.style.overflow = 'hidden';
        desc.style.textOverflow = 'ellipsis';
        desc.style.whiteSpace = 'nowrap';
        desc.style.width = '100%';
        desc.style.maxWidth = '60px';
        desc.innerText = sticker.desc;
        item.appendChild(desc);

        if (wcState.isStickerDeleteMode) {
            const badge = document.createElement('div');
            badge.className = 'wc-sticker-delete-badge';
            badge.innerText = '×';
            badge.onclick = (e) => { 
                e.stopPropagation(); 
                currentCat.list.splice(index, 1); 
                wcSaveData(); 
                wcRenderStickerPanel(); 
            };
            item.appendChild(badge);
        } else {
            item.onclick = (e) => {
                e.stopPropagation();
                wcAddMessage(wcState.activeChatId, 'me', 'sticker', sticker.url);
            };
        }
        grid.appendChild(item);
    });
}

function wcOpenStickerOptions(e) {
    if(e) e.stopPropagation();
    const btnText = document.getElementById('wc-btn-sticker-manage-text');
    btnText.innerText = wcState.isStickerDeleteMode ? "退出管理模式" : "管理表情 (删除)";
    btnText.style.color = wcState.isStickerDeleteMode ? "#000" : "#007AFF";
    wcOpenModal('wc-sticker-options-modal');
}

function wcToggleStickerDeleteMode() {
    wcState.isStickerDeleteMode = !wcState.isStickerDeleteMode;
    wcRenderStickerPanel();
}

function wcImportStickers() {
    const catName = document.getElementById('wc-sticker-category-name').value.trim();
    const data = document.getElementById('wc-sticker-import-text').value;
    if (!catName || !data) return alert('请填写完整');
    
    const lines = data.split('\n');
    const newStickers = [];
    
    // 修复1：更健壮的解析逻辑，支持多行批量导入，且不会被 URL 里的冒号干扰
    lines.forEach(line => {
        line = line.trim();
        if (!line) return; // 跳过空行
        
        // 找到第一个冒号（中英文皆可）的位置
        const colonIndex = line.search(/[:：]/);
        if (colonIndex !== -1) {
            const desc = line.substring(0, colonIndex).trim();
            const url = line.substring(colonIndex + 1).trim();
            if (desc && url) {
                newStickers.push({ desc, url });
            }
        }
    });
    
    if (newStickers.length === 0) {
        return alert('格式错误，未识别到有效的表情包数据。\n请确保格式为“描述:图片链接”，每行一个。');
    }
    
    // 修复2：检查是否已经存在同名的表情包分组
    let targetIndex = wcState.stickerCategories.findIndex(cat => cat.name === catName);
    
    if (targetIndex !== -1) {
        // 如果存在同名分组，则将新表情包追加到该分组末尾
        wcState.stickerCategories[targetIndex].list.push(...newStickers);
    } else {
        // 如果不存在，则创建全新的分组
        wcState.stickerCategories.push({ name: catName, list: newStickers });
        targetIndex = wcState.stickerCategories.length - 1;
    }
    
    // 同步追加到“全部”分组 (索引 0)
    // 注意：如果用户填写的名字刚好是"全部" (targetIndex === 0)，上面已经追加过了，避免重复
    if (targetIndex !== 0) {
        wcState.stickerCategories[0].list.push(...newStickers);
    }
    
    wcSaveData();
    wcCloseModal('wc-import-sticker-modal');
    
    // 自动切换到当前导入的分组并刷新面板
    wcState.activeStickerCategoryIndex = targetIndex;
    wcRenderStickerPanel();
    
    // 清空输入框，方便下次导入
    document.getElementById('wc-sticker-import-text').value = '';
    
    alert(`成功导入 ${newStickers.length} 个表情包到分组 "${catName}"！`);
}

function wcOpenDeleteCategoriesModal() {
    const list = document.getElementById('wc-sticker-delete-cats-list');
    list.innerHTML = '';
    wcState.stickerCategories.forEach((cat, index) => {
        if (index === 0) return; 
        const div = document.createElement('div');
        div.className = 'wc-list-item';
        div.style.background = 'white';
        div.innerHTML = `<div class="wc-item-content"><div class="wc-item-title">${cat.name}</div></div><input type="checkbox" class="wc-delete-cat-checkbox" value="${index}">`;
        list.appendChild(div);
    });
    wcOpenModal('wc-sticker-delete-cats-modal');
}

function wcConfirmDeleteCategories() {
    const checkboxes = document.querySelectorAll('.wc-delete-cat-checkbox:checked');
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a,b)=>b-a);
    indices.forEach(i => wcState.stickerCategories.splice(i, 1));
    
    const allStickers = [];
    for (let i = 1; i < wcState.stickerCategories.length; i++) {
        allStickers.push(...wcState.stickerCategories[i].list);
    }
    wcState.stickerCategories[0].list = allStickers;

    wcState.activeStickerCategoryIndex = 0;
    wcSaveData();
    wcCloseModal('wc-sticker-delete-cats-modal');
    wcRenderStickerPanel();
}

// --- WeChat More Actions ---
function wcActionRoll() {
    const msgs = wcState.chats[wcState.activeChatId];
    if (!msgs || msgs.length === 0) return;

    let lastMeIndex = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].sender === 'me') {
            lastMeIndex = i;
            break;
        }
    }

    const newMsgs = [];
    if (lastMeIndex !== -1) {
        // 保留最后一次用户发言及之前的所有消息
        for (let i = 0; i <= lastMeIndex; i++) {
            newMsgs.push(msgs[i]);
        }
        // 核心修复：保留用户发言之后的系统消息（NPC消息），只删除AI的回复
        for (let i = lastMeIndex + 1; i < msgs.length; i++) {
            if (msgs[i].type === 'system') {
                newMsgs.push(msgs[i]);
            } else {
                lsRemoveFeedByMsgId(msgs[i].id);
            }
        }
    } else {
        // 如果没有用户发言，保留所有系统消息，删除AI回复
        for (let i = 0; i < msgs.length; i++) {
            if (msgs[i].type === 'system') {
                newMsgs.push(msgs[i]);
            } else {
                lsRemoveFeedByMsgId(msgs[i].id);
            }
        }
    }

    wcState.chats[wcState.activeChatId] = newMsgs;
    wcSaveData();
    wcRenderMessages(wcState.activeChatId);
    wcTriggerAI();
    wcCloseAllPanels();
}

function wcActionVoice() {
    wcCloseAllPanels();
    wcOpenGeneralInput("输入语音内容", (text) => {
        if (text) wcAddMessage(wcState.activeChatId, 'me', 'voice', text);
    });
}

function wcToggleVoiceText(msgId) {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === msgId);
    if (msg) {
        msg.showText = !msg.showText;
        wcRenderMessages(wcState.activeChatId);
    }
}

function wcActionImageDesc() {
    const desc = prompt("请输入图片描述：");
    if (desc) wcAddMessage(wcState.activeChatId, 'me', 'text', `[图片描述] ${desc}`);
}

// --- 预览图片 (高级弹窗版) ---
function wcPreviewImage(src) {
    const overlay = document.getElementById('global-image-preview-overlay');
    const img = document.getElementById('global-image-preview-img');
    if (!overlay || !img) return;
    
    img.src = src;
    overlay.style.display = 'flex';
    // 延迟触发动画
    setTimeout(() => overlay.style.opacity = '1', 10);
}

function closeGlobalImagePreview() {
    const overlay = document.getElementById('global-image-preview-overlay');
    if (!overlay) return;
    
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        document.getElementById('global-image-preview-img').src = '';
    }, 300);
}

// --- WeChat Memory ---
function wcActionMemory() {
    wcCloseAllPanels();
    wcOpenMemoryPage();
}

// ==========================================
// 阅读 App 逻辑
// ==========================================



// ==========================================
// 极简韩系 INS 风回忆日记逻辑 (黑白星空塔罗牌版)
// ==========================================

// 全局变量用于塔罗牌状态
let insTarotCurrentIndex = 0;
let insTarotCardsData = [];
let insCurrentEditingMemId = null;

// 动态生成星空背景的函数
function generateUniverseBg() {
    let html = '<div class="ins-mem-universe-bg">';
    // 生成 30 个随机星光
    for(let i=0; i<30; i++) {
        const size = Math.random() * 3 + 1;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const duration = Math.random() * 3 + 2;
        html += `<div class="ins-mem-star" style="width:${size}px; height:${size}px; left:${left}%; top:${top}%; --duration:${duration}s;"></div>`;
    }
    // 生成 5 条流苏/流星
    for(let i=0; i<5; i++) {
        const left = Math.random() * 100;
        const duration = Math.random() * 5 + 5;
        const delay = Math.random() * 5;
        html += `<div class="ins-mem-tassel" style="left:${left}%; --duration:${duration}s; animation-delay:${delay}s;"></div>`;
    }
    html += '</div>';
    return html;
}

function wcOpenMemoryPage() {
    document.getElementById('wc-view-chat-detail').classList.remove('active');
    const memView = document.getElementById('wc-view-memory');
    memView.classList.add('active');
    
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'none';

    // 注入全新的书架风 HTML 结构
    memView.innerHTML = `
        <header class="mem-header">
            <div class="mem-title-box" onclick="wcCloseMemoryPage()">
                <span class="mem-title-line-1">回忆</span>
                <span class="mem-title-line-2">档案室</span>
            </div>
            <div class="mem-header-icons">
                <!-- 羽毛笔图标 (手动添加) -->
                <div class="mem-icon-btn" onclick="wcOpenModal('wc-modal-memory-actions')" title="更多操作">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </div>
                <!-- 调音台图标 (设置) -->
                <div class="mem-icon-btn" onclick="wcOpenMemorySettingsModal()" title="回忆设置">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                </div>
            </div>
        </header>
        <main class="mem-main-content">
            <div class="mem-timeline-line"></div>
            <div id="wc-memory-list-container">
                <!-- Memories injected here -->
            </div>
        </main>
        
        <!-- 仿书页弹窗 -->
        <div class="book-modal-overlay" id="bookModal">
            <div class="book-page">
                <!-- 阅读视图 -->
                <div id="readView" style="display: flex; flex-direction: column; height: 100%;">
                    <div class="page-header">
                        <span class="page-date" id="bookPageDate"></span>
                        <span class="page-close" onclick="closeBookModal()">×</span>
                    </div>
                    <div class="page-content-area">
                        <div class="page-title" id="bookPageTitle"></div>
                        <div class="page-text" id="bookPageText"></div>
                    </div>
                    <div class="page-footer">
                        <button class="page-btn" onclick="bookPagePrev()">← 上一页</button>
                        <button class="page-btn edit" onclick="toggleBookEditMode(true)">编辑</button>
                        <button class="page-btn" onclick="bookPageNext()">下一页 →</button>
                    </div>
                </div>

                <!-- 编辑视图 (富文本所见即所得) -->
                <div id="editView" class="edit-view">
                    <div class="edit-toolbar">
                        <button class="tool-btn" onclick="applyBookHighlight()">高光划线</button>
                        <button class="tool-btn" onclick="applyBookAnnotation()">添加批注</button>
                    </div>
                    <!-- 将 textarea 改为 contenteditable 的 div -->
                    <div class="edit-textarea" id="bookEditDiv" contenteditable="true"></div>
                    <div class="edit-footer">
                        <button class="page-btn" onclick="toggleBookEditMode(false)">取消</button>
                        <button class="page-btn edit" onclick="saveBookEdit()">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    wcRenderMemories();
}

function wcCloseMemoryPage() {
    document.getElementById('wc-view-memory').classList.remove('active');
    document.getElementById('wc-view-chat-detail').classList.add('active');
    
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'flex';
    
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (char) updateChatTopBarStatus(char);
}

// 全局变量用于书页翻页
let currentBookMemories = [];
let currentBookIndex = 0;

function wcRenderMemories() {
    const container = document.getElementById('wc-memory-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char.memories) char.memories = [];

    if (char.memories.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #8A827E; padding-top: 50px; font-family: Georgia, serif; font-style: italic;">书架空空如也...</div>';
        return;
    }

    const groups = {};
    char.memories.forEach(mem => {
        const d = new Date(mem.time);
        const dateKey = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(mem);
    });

    const bgClasses = ['mem-spine-bg-1', 'mem-spine-bg-2', 'mem-spine-bg-3'];

    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateKey => {
        const row = document.createElement('div');
        row.className = 'mem-timeline-row';
        
        let rowHtml = `
            <div class="mem-time-node">
                <div class="mem-node-icon"></div>
                <div class="mem-date-text">${dateKey}</div>
            </div>
            <div class="mem-books-scroll">
        `;

        groups[dateKey].forEach((mem, idx) => {
            const bgClass = bgClasses[idx % bgClasses.length];
            
            let title = '记忆碎片';
            let content = mem.content;
            if (mem.type === 'summary') {
                if (mem.content.includes('[自动总结')) title = '自动总结';
                else if (mem.content.includes('[手动总结')) title = '手动总结';
                else if (mem.content.includes('[线下约会记忆]')) title = '线下约会';
                else if (mem.content.includes('[语音通话总结')) title = '语音通话';
                else title = '总结';
                content = mem.content.replace(/\[.*?\]\s*/, ''); 
            } else if (mem.type === 'manual') {
                title = '手动添加'; 
            }

            // 核心记忆直接加上 core 类，CSS 会自动显示书签和烫金标题
            const coreClass = mem.isCore ? 'core' : '';

            rowHtml += `
                <div class="mem-book-spine ${bgClass} ${coreClass}" onclick="openBookModal(${mem.id})">
                    <div class="mem-delete-btn" onclick="wcDeleteMemory(event, ${mem.id})">×</div>
                    <div class="mem-bookmark-ribbon"></div>
                    <div class="mem-spine-decor"></div>
                    <div class="mem-spine-title">${title}</div>
                    <div class="mem-spine-decor"></div>
                </div>
            `;
        });

        rowHtml += `</div>`;
        row.innerHTML = rowHtml;
        container.appendChild(row);
    });
}

// 覆盖原有的删除逻辑
window.wcDeleteMemory = function(event, id) {
    event.stopPropagation(); 
    if (confirm("确定要将这段记忆化作尘埃吗？")) {
        const char = wcState.characters.find(c => c.id === wcState.activeChatId);
        if (char && char.memories) {
            char.memories = char.memories.filter(m => m.id !== id);
            wcSaveData();
            wcRenderMemories();
        }
    }
};

// --- 仿书页弹窗逻辑 ---
window.openBookModal = function(memId) {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char || !char.memories) return;

    // 提取所有记忆，用于翻页
    currentBookMemories = char.memories.sort((a, b) => b.time - a.time);
    currentBookIndex = currentBookMemories.findIndex(m => m.id === memId);

    if (currentBookIndex === -1) return;

    renderBookPage();

    const modal = document.getElementById('bookModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.closeBookModal = function() {
    const modal = document.getElementById('bookModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        toggleBookEditMode(false); 
    }, 300);
};

window.renderBookPage = function() {
    const mem = currentBookMemories[currentBookIndex];
    if (!mem) return;

    const d = new Date(mem.time);
    const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    
    let title = '记忆碎片';
    let content = mem.content;
    if (mem.type === 'summary') {
        if (mem.content.includes('[自动总结')) title = '自动总结';
        else if (mem.content.includes('[手动总结')) title = '手动总结';
        else if (mem.content.includes('[线下约会记忆]')) title = '线下约会';
        else if (mem.content.includes('[语音通话总结')) title = '语音通话';
        else title = '总结';
        content = mem.content.replace(/\[.*?\]\s*/, ''); 
    } else if (mem.type === 'manual') {
        title = '手动添加'; 
    }

    document.getElementById('bookPageDate').innerText = dateStr;
    document.getElementById('bookPageTitle').innerText = title;
    
    // 渲染到阅读区 (将换行转为 <br>)
    document.getElementById('bookPageText').innerHTML = content.replace(/\n/g, '<br>');
    
    // 渲染到富文本编辑区 (直接填入 HTML)
    document.getElementById('bookEditDiv').innerHTML = content.replace(/\n/g, '<br>');
};

window.bookPagePrev = function() {
    if (currentBookIndex > 0) {
        currentBookIndex--;
        renderBookPage();
    } else {
        alert("已经是第一页了");
    }
};

window.bookPageNext = function() {
    if (currentBookIndex < currentBookMemories.length - 1) {
        currentBookIndex++;
        renderBookPage();
    } else {
        alert("已经是最后一页了");
    }
};

window.toggleBookEditMode = function(isEdit) {
    const readView = document.getElementById('readView');
    const editView = document.getElementById('editView');
    if (isEdit) {
        readView.style.display = 'none';
        editView.classList.add('active');
    } else {
        readView.style.display = 'flex';
        editView.classList.remove('active');
    }
};

window.saveBookEdit = function() {
    const mem = currentBookMemories[currentBookIndex];
    if (!mem) return;

    const editDiv = document.getElementById('bookEditDiv');
    let newContent = editDiv.innerHTML.trim();
    
    if (!newContent) return alert("内容不能为空");

    // 检查是否包含高光或批注，如果包含，自动设为核心记忆
    if (newContent.includes('highlight-text') || newContent.includes('annotation-note')) {
        mem.isCore = true;
    } else {
        mem.isCore = false;
    }

    // 恢复前缀 (如果是总结)
    if (mem.type === 'summary') {
        const prefixMatch = mem.content.match(/^\[.*?\]\s*/);
        const prefix = prefixMatch ? prefixMatch[0] : '[手动总结] ';
        // 如果富文本内容没有前缀，强行拼在最前面
        if (!newContent.startsWith('[')) {
            newContent = prefix + newContent;
        }
    }

    mem.content = newContent;

    wcSaveData();
    wcRenderMemories();
    renderBookPage();
    toggleBookEditMode(false);
};

// 富文本高光划线 (所见即所得)
window.applyBookHighlight = function() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
        return alert("请先选中文本哦~");
    }
    
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'highlight-text';
    
    try {
        range.surroundContents(span);
        // 清除选中状态
        selection.removeAllRanges();
    } catch (e) {
        alert("划线失败，请确保只选中了纯文本，不要跨越段落哦~");
    }
};

// 取消高光划线
window.removeBookHighlight = function() {
    const selection = window.getSelection();
    
    // 获取当前光标所在的节点
    let node = selection.anchorNode;
    if (!node) return alert("请将光标放在要取消高光的文本上");
    
    // 如果选中的是文本节点，往上找它的父元素
    if (node.nodeType === 3) {
        node = node.parentNode;
    }
    
    // 判断父元素是不是高光 span
    if (node && node.classList && node.classList.contains('highlight-text')) {
        // 将 span 标签剥离，只保留里面的纯文本
        node.outerHTML = node.innerHTML;
    } else {
        alert("当前光标不在高光文本上哦~");
    }
};

// 富文本添加批注 (所见即所得)
window.applyBookAnnotation = function() {
    const note = prompt("请输入批注内容：");
    if (!note) return;

    const editDiv = document.getElementById('bookEditDiv');
    // 在末尾追加批注 HTML
    editDiv.innerHTML += `<br><div class="annotation-note">批注：${note}</div><br>`;
    
    // 自动滚动到底部
    editDiv.scrollTop = editDiv.scrollHeight;
};

function wcOpenMemorySummaryModal() {
    const msgs = wcState.chats[wcState.activeChatId] || [];
    document.getElementById('wc-mem-total-count-label').innerText = `当前聊天总层数: ${msgs.length}`;
    
    const list = document.getElementById('wc-mem-summary-wb-list');
    list.innerHTML = ''; // 默认不选
    document.getElementById('wc-mem-summary-wb-count').innerText = `已选 0 项`;
    
    wcOpenModal('wc-modal-memory-summary');
}

function wcOpenMemorySettingsModal() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    if (!char.chatConfig) char.chatConfig = {};

    document.getElementById('wc-mem-setting-trigger').value = char.chatConfig.summaryTrigger || 0;

    const list = document.getElementById('wc-mem-setting-wb-list');
    list.innerHTML = '';
    let memWbCount = 0;
    if (char.chatConfig.summaryWorldbookEntries) {
        char.chatConfig.summaryWorldbookEntries.forEach(id => {
            list.innerHTML += `<input type="checkbox" value="${id}" checked>`;
            memWbCount++;
        });
    }
    document.getElementById('wc-mem-setting-wb-count').innerText = `已选 ${memWbCount} 项`;

    wcOpenModal('wc-modal-memory-settings');
}

function wcSaveMemorySettings() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    if (!char.chatConfig) char.chatConfig = {};

    const triggerCount = parseInt(document.getElementById('wc-mem-setting-trigger').value) || 0;
    char.chatConfig.summaryTrigger = triggerCount;

    const checkboxes = document.querySelectorAll('#wc-mem-setting-wb-list input[type="checkbox"]:checked');
    char.chatConfig.summaryWorldbookEntries = Array.from(checkboxes).map(cb => cb.value);

    wcSaveData();
    wcCloseModal('wc-modal-memory-settings');
    alert("回忆设置已保存");
}
// ==========================================
// 新增：记忆文本 AI 格式化器
// ==========================================
function formatMemoryForAI(htmlContent) {
    if (!htmlContent) return "";
    
    let text = htmlContent;
    
    // 1. 将高光标签转换为 AI 能懂的强调符号
    text = text.replace(/<span class="highlight-text">(.*?)<\/span>/gi, "【重点关注：$1】");
    
    // 2. 将批注标签转换为 AI 能懂的批注符号
    text = text.replace(/<div class="annotation-note">(.*?)<\/div>/gi, "\n（我的批注：$1）\n");
    
    // 3. 将换行标签转换为真实的换行符
    text = text.replace(/<br\s*\/?>/gi, "\n");
    
    // 4. 剥离掉剩余的所有无用 HTML 标签
    text = text.replace(/<[^>]*>?/gm, '');
    
    // 5. 清理多余的空白和换行
    return text.trim();
}

// --- WeChat General Input ---
function wcOpenGeneralInput(title, callback, isPassword = false) {
    document.getElementById('wc-general-input-title').innerText = title;
    const textInput = document.getElementById('wc-general-input-field');
    const passInput = document.getElementById('wc-general-password-field');
    
    // 根据是否为密码模式，分别控制两个独立输入框的显隐
    if (isPassword) {
        if (textInput) textInput.style.display = 'none';
        if (passInput) {
            passInput.style.display = 'block';
            passInput.value = '';
            passInput.focus();
        }
    } else {
        if (passInput) passInput.style.display = 'none';
        if (textInput) {
            textInput.style.display = 'block';
            textInput.value = '';
            textInput.focus();
        }
    }
    
    wcState.generalInputCallback = callback;
    wcOpenModal('wc-modal-general-input');
}

// --- WeChat Transfer ---
function wcOpenTransferModal() {
    document.getElementById('wc-transfer-amount').value = '';
    document.getElementById('wc-transfer-note').value = '';
    wcOpenModal('wc-modal-transfer-input');
    wcCloseAllPanels();
}

function wcSubmitTransferDetails() {
    const amount = document.getElementById('wc-transfer-amount').value;
    const note = document.getElementById('wc-transfer-note').value;
    if (!amount || parseFloat(amount) <= 0) return alert("请输入有效金额");
    
    wcState.tempTransfer = { amount, note };
    wcCloseModal('wc-modal-transfer-input');
    
    wcOpenGeneralInput("请输入支付密码", (pass) => {
        wcCheckPassword(pass);
    }, true);
}

function wcCheckPassword(val) {
    if (val !== wcState.wallet.password) {
        alert("密码错误！");
        return;
    }
    const amount = parseFloat(wcState.tempTransfer.amount);
    if (wcState.wallet.balance < amount) {
        alert("余额不足！请先充值。");
        return;
    }
    wcState.wallet.balance -= amount;
    wcState.wallet.transactions.push({
        id: Date.now(), type: 'payment', amount: amount,
        note: `转账给 ${document.getElementById('wc-nav-title').innerText}`, time: Date.now()
    });
    wcSaveData();
    wcAddMessage(wcState.activeChatId, 'me', 'transfer', '转账', {
        amount: wcState.tempTransfer.amount,
        note: wcState.tempTransfer.note,
        status: 'pending'
    });
}

function wcHandleTransferClick(msgId) {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;
    if (msg.status !== 'pending') return;

    if (msg.sender === 'me') {
        alert("等待对方收款");
    } else {
        wcState.activeTransferMsgId = msgId;
        wcOpenModal('wc-modal-transfer-action');
    }
}

function wcConfirmTransferReceive() { wcUpdateTransferStatus('received'); }
function wcConfirmTransferReject() { wcUpdateTransferStatus('rejected'); }

function wcUpdateTransferStatus(status) {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === wcState.activeTransferMsgId);
    if (msg) {
        msg.status = status;
        let aiPrompt = "";
        if (status === 'received') {
            const amount = parseFloat(msg.amount);
            wcState.wallet.balance += amount;
            wcState.wallet.transactions.push({
                id: Date.now(), type: 'income', amount: amount, note: `收到转账`, time: Date.now()
            });
            wcAddMessage(wcState.activeChatId, 'me', 'system', `已收款，资金已存入零钱`, { style: 'transparent' });
            aiPrompt = `[系统内部信息(仅AI可见): User 刚刚领取了你发出的 ${amount} 元转账。请在回复中对此做出符合你人设的反应。]`;
        } else if (status === 'rejected') {
            wcAddMessage(wcState.activeChatId, 'me', 'system', `已退还转账`, { style: 'transparent' });
            aiPrompt = `[系统内部信息(仅AI可见): User 刚刚退还/拒收了你发出的转账。请在回复中对此做出符合你人设的反应。]`;
        }
        
        if (aiPrompt) {
            wcAddMessage(wcState.activeChatId, 'system', 'system', aiPrompt, { hidden: true });
            // 【修改】：删除了 setTimeout 触发 wcTriggerAI 的逻辑，不再自动调取 API 生成回复
        }
        
        wcSaveData();
        wcRenderMessages(wcState.activeChatId);
    }
    wcCloseModal('wc-modal-transfer-action');
}

// --- WeChat Wallet ---
function wcOpenWallet() {
    document.getElementById('wc-view-user').classList.remove('active');
    document.getElementById('wc-view-wallet').classList.add('active');
    
    // 隐藏底部 Tabbar
    document.getElementById('wc-main-tabbar').style.display = 'none';
    
    // 隐藏全局顶部导航栏 (实现沉浸式，去除顶栏)
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'none';

    wcRenderWallet();
}

function wcCloseWallet() {
    document.getElementById('wc-view-wallet').classList.remove('active');
    wcSwitchTab('user');
    
    // 恢复底部 Tabbar
    document.getElementById('wc-main-tabbar').style.display = 'flex';
    
    // 🔪 核心修复：删除了强行恢复顶栏的代码，交给 wcSwitchTab 统一处理
}

function wcRenderWallet() {
    // 1. 更新余额
    document.getElementById('wc-wallet-balance-display').innerText = '¥' + parseFloat(wcState.wallet.balance).toFixed(2);
    
    // 2. 动态更新头像和名字 (跟随 User)
    const avatarEl = document.getElementById('wc-wallet-user-avatar');
    const nameEl = document.getElementById('wc-wallet-user-name');
    if (avatarEl) avatarEl.src = wcState.user.avatar;
    if (nameEl) nameEl.innerText = wcState.user.name;

    // 3. 渲染交易记录到小票内部
    const list = document.getElementById('wc-wallet-history-list');
    if (!list) return;
    list.innerHTML = '';
    
    const sortedTrans = [...wcState.wallet.transactions].sort((a, b) => b.time - a.time);

    if (sortedTrans.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #8E8E93; font-size: 12px; padding: 10px 0;">暂无交易记录</div>';
        return;
    }

    sortedTrans.forEach(t => {
        const isIncome = t.type === 'income' || t.type === 'recharge';
        const sign = isIncome ? '+' : '-';
        const colorClass = isIncome ? 'in' : 'out';
        
        // 格式化时间为简短格式 (如 10-24 14:30)
        const d = new Date(t.time);
        const timeStr = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

        const div = document.createElement('div');
        div.className = 'rcpt-trans-item';
        div.innerHTML = `
            <div class="rcpt-trans-info">
                <div class="rcpt-trans-title">${t.note}</div>
                <div class="rcpt-trans-time">${timeStr}</div>
            </div>
            <div class="rcpt-trans-amount ${colorClass}">${sign}${parseFloat(t.amount).toFixed(2)}</div>
        `;
        list.appendChild(div);
    });
}

function wcOpenRechargeModal() {
    document.getElementById('wc-recharge-amount').value = '';
    wcOpenModal('wc-modal-recharge');
}

function wcConfirmRecharge() {
    const amount = parseFloat(document.getElementById('wc-recharge-amount').value);
    if (!amount || amount <= 0) return alert("请输入有效金额");
    wcState.wallet.balance += amount;
    wcState.wallet.transactions.push({
        id: Date.now(), type: 'recharge', amount: amount, note: '余额充值', time: Date.now()
    });
    wcSaveData();
    wcRenderWallet();
    wcCloseModal('wc-modal-recharge');
    alert(`充值成功 +${amount.toFixed(2)}`);
}

function wcOpenSetPasswordModal() {
    wcOpenGeneralInput("设置新支付密码 (6位数字)", (newPass) => {
        if (newPass && newPass.length === 6 && !isNaN(newPass)) {
            wcState.wallet.password = newPass;
            wcSaveData();
            alert("密码设置成功");
        } else if (newPass) {
            alert("密码格式错误，必须为6位数字");
        }
    }, true);
}

function wcClearTransactionHistory() {
    if (confirm("确定清空所有交易记录吗？余额不会改变。")) {
        wcState.wallet.transactions = [];
        wcSaveData();
        wcRenderWallet();
    }
}

// --- WeChat Settings (New Fullscreen Card Stack) ---
let wcGsCurrentCardIndex = 0;
let wcGsIsDragging = false;
let wcGsStartX = 0;
let wcGsStartY = 0;

function wcOpenWechatSettings() {
    // 1. 填充当前编辑卡片的数据
    document.getElementById('wc-global-css-input').value = wcState.globalConfig.customCss || '';
    document.getElementById('wc-global-pin-text').value = wcState.globalConfig.pinText || 'ㅠㅅㅠ';
    document.getElementById('wc-global-pin-css').value = wcState.globalConfig.pinCss || '';

    // 2. 渲染预设卡片
    wcRenderGlobalCssPresetCards();

    // 3. 初始化交互
    wcGsCurrentCardIndex = 0;
    wcUpdateGsCards();
    wcInitGsCardSwipe();

    wcOpenModal('wc-modal-wechat-settings');
}

function wcCloseWechatSettings() {
    wcCloseModal('wc-modal-wechat-settings');
}

function wcClearGlobalCssEdit() {
    document.getElementById('wc-global-css-input').value = '';
    document.getElementById('wc-global-pin-text').value = '';
    document.getElementById('wc-global-pin-css').value = '';
}

function wcApplyGlobalCss() {
    wcState.globalConfig.customCss = document.getElementById('wc-global-css-input').value;
    wcState.globalConfig.pinText = document.getElementById('wc-global-pin-text').value || 'ㅠㅅㅠ';
    wcState.globalConfig.pinCss = document.getElementById('wc-global-pin-css').value;
    
    wcSaveData();
    wcApplyGlobalCssToDom(); // 立即应用样式
    wcRenderChats(); // 刷新聊天列表以应用置顶字样
    alert("全局样式已应用！");
}

function wcSaveGlobalCssPreset() {
    const css = document.getElementById('wc-global-css-input').value;
    const pinText = document.getElementById('wc-global-pin-text').value;
    const pinCss = document.getElementById('wc-global-pin-css').value;
    
    if (!css && !pinCss) return alert("内容为空，无法保存");
    
    const name = prompt("请输入预设名称：");
    if (name) {
        wcState.globalCssPresets.push({ name, css, pinText, pinCss });
        wcSaveData();
        wcRenderGlobalCssPresetCards();
        alert("预设已保存");
    }
}

function wcDeleteGlobalCssPreset(idx) {
    if (confirm("确定删除该预设吗？")) {
        wcState.globalCssPresets.splice(idx, 1);
        wcSaveData();
        // 如果删除的是当前显示的卡片，索引回退
        if (wcGsCurrentCardIndex > wcState.globalCssPresets.length) {
            wcGsCurrentCardIndex = wcState.globalCssPresets.length;
        }
        wcRenderGlobalCssPresetCards();
    }
}
// 👇 新增：点击重命名预设
function wcRenameGlobalCssPreset(idx) {
    const preset = wcState.globalCssPresets[idx];
    if (!preset) return;
    
    const newName = prompt("请输入新的预设名称：", preset.name);
    if (newName && newName.trim() !== "" && newName !== preset.name) {
        preset.name = newName.trim();
        wcSaveData();
        wcRenderGlobalCssPresetCards(); // 刷新卡片显示新名字
    }
}

function wcLoadGlobalCssPreset(idx) {
    const preset = wcState.globalCssPresets[idx];
    if (preset) {
        document.getElementById('wc-global-css-input').value = preset.css || '';
        document.getElementById('wc-global-pin-text').value = preset.pinText || 'ㅠㅅㅠ';
        document.getElementById('wc-global-pin-css').value = preset.pinCss || '';
        
        // 自动切回第一张卡片
        wcGsCurrentCardIndex = 0;
        wcUpdateGsCards();
    }
}

function wcRenderGlobalCssPresetCards() {
    const stack = document.getElementById('wc-gs-card-stack');
    // 保留第一张卡片 (Current Edit)，移除其他
    Array.from(stack.children).forEach((child, index) => {
        if (index > 0) child.remove();
    });

    wcState.globalCssPresets.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'wc-gs-css-card';
        // 初始位置先随便设，后面 updateCards 会重置
        card.setAttribute('data-pos', 'hidden'); 
        
        card.innerHTML = `
            <div class="wc-gs-card-header">
                <span class="wc-gs-card-tag" style="background: #F2F2F7; color: #555; cursor: pointer;" onclick="event.stopPropagation(); wcRenameGlobalCssPreset(${idx})" title="点击修改名称">${p.name} </span>
                <span class="wc-gs-card-action danger" onclick="event.stopPropagation(); wcDeleteGlobalCssPreset(${idx})">删除</span>
            </div>
            <div class="wc-gs-input-group">
                <label class="wc-gs-input-label">全局 CSS 预览</label>
                <textarea class="wc-gs-custom-textarea large" readonly>${p.css || '无'}</textarea>
            </div>
            <div style="display: flex; gap: 12px;">
                <div class="wc-gs-input-group" style="flex: 1;">
                    <label class="wc-gs-input-label">置顶字样</label>
                    <input type="text" class="wc-gs-custom-input" value="${p.pinText || '无'}" readonly>
                </div>
                <div class="wc-gs-input-group" style="flex: 2;">
                    <label class="wc-gs-input-label">置顶 CSS</label>
                    <input type="text" class="wc-gs-custom-input" value="${p.pinCss || '无'}" readonly>
                </div>
            </div>
            <div class="wc-gs-card-btn-row">
                <button class="wc-gs-card-btn black" onclick="event.stopPropagation(); wcLoadGlobalCssPreset(${idx})">加载此预设</button>
            </div>
        `;
        
        // 点击后面的卡片将其抽到前面
        card.onclick = (e) => {
            if (card.getAttribute('data-pos') !== '0' && !e.target.closest('input, textarea, button, .wc-gs-card-action')) {
                wcGsCurrentCardIndex = idx + 1; // +1 因为第一张是 Current Edit
                wcUpdateGsCards();
            }
        };
        
        stack.appendChild(card);
    });

    // 渲染小圆点
    const dotsContainer = document.getElementById('wc-gs-pagination-dots');
    dotsContainer.innerHTML = '';
    const totalCards = wcState.globalCssPresets.length + 1;
    for (let i = 0; i < totalCards; i++) {
        const dot = document.createElement('div');
        dot.className = 'wc-gs-dot';
        dotsContainer.appendChild(dot);
    }
    
    wcUpdateGsCards();
}

function wcUpdateGsCards() {
    const stack = document.getElementById('wc-gs-card-stack');
    const cards = Array.from(stack.querySelectorAll('.wc-gs-css-card'));
    const dots = document.querySelectorAll('.wc-gs-dot');

    cards.forEach((card, i) => {
        let diff = i - wcGsCurrentCardIndex;
        if (diff < 0) diff += cards.length; // 循环处理

        if (diff === 0) {
            card.setAttribute('data-pos', '0');
        } else if (diff === 1) {
            card.setAttribute('data-pos', '1');
        } else if (diff === 2) {
            card.setAttribute('data-pos', '2');
        } else {
            card.setAttribute('data-pos', 'hidden');
        }
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === wcGsCurrentCardIndex);
    });
}

function wcInitGsCardSwipe() {
    const stack = document.getElementById('wc-gs-card-stack');
    
    // 防止重复绑定
    if (stack.dataset.swipeBound === 'true') return;
    stack.dataset.swipeBound = 'true';

    stack.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        wcGsStartX = e.touches[0].clientX;
        wcGsStartY = e.touches[0].clientY;
        wcGsIsDragging = true;
    }, { passive: true });

    stack.addEventListener('touchmove', (e) => {
        if (!wcGsIsDragging) return;
        const dx = e.touches[0].clientX - wcGsStartX;
        const dy = e.touches[0].clientY - wcGsStartY;
        
        // 如果是水平滑动，阻止默认滚动
        if (Math.abs(dx) > Math.abs(dy)) {
            e.preventDefault();
        }
    }, { passive: false });

    stack.addEventListener('touchend', (e) => {
        if (!wcGsIsDragging) return;
        wcGsIsDragging = false;
        const endX = e.changedTouches[0].clientX;
        const diffX = endX - wcGsStartX;
        const totalCards = wcState.globalCssPresets.length + 1;

        if (diffX < -40) {
            // 向左滑，看下一张
            wcGsCurrentCardIndex = (wcGsCurrentCardIndex + 1) % totalCards;
            wcUpdateGsCards();
        } else if (diffX > 40) {
            // 向右滑，看上一张
            wcGsCurrentCardIndex = (wcGsCurrentCardIndex - 1 + totalCards) % totalCards;
            wcUpdateGsCards();
        }
    });
}

// 注入全局 CSS 到页面
function wcApplyGlobalCssToDom() {
    let styleTag = document.getElementById('wc-global-custom-css-inject');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'wc-global-custom-css-inject';
        document.head.appendChild(styleTag);
    }
    
    let cssContent = wcState.globalConfig.customCss || '';
    
    // 注入置顶专属 CSS
    if (wcState.globalConfig.pinCss) {
        // 将用户写的 CSS 包装在 .wc-pinned-chat 选择器下
        cssContent += `\n.wc-pinned-chat { ${wcState.globalConfig.pinCss} }\n`;
    }
    
    styleTag.innerHTML = cssContent;
}

async function wcExportData() {
    try {
        if (!wcDb.instance) {
            alert("WeChat 数据库未初始化，无法备份。");
            return;
        }

        const data = {};
        const persistentCharactersSnapshot = await wcReadCharactersPersistentSnapshot();
        const dbCharacters = await wcDb.getAll('characters');
        const charsUpdatedAt = await wcDb.get('kv_store', 'characters_updated_at');
        const shouldUseSnapshotCharacters = persistentCharactersSnapshot.characters.length > 0 && (
            !Array.isArray(dbCharacters) || dbCharacters.length === 0 ||
            persistentCharactersSnapshot.updatedAt >= (Number(charsUpdatedAt) || 0) ||
            persistentCharactersSnapshot.characters.length > dbCharacters.length
        );

        data.user = await wcDb.get('kv_store', 'user');
        data.wallet = await wcDb.get('kv_store', 'wallet');
        data.stickerCategories = await wcDb.get('kv_store', 'sticker_categories');
        data.cssPresets = await wcDb.get('kv_store', 'css_presets');
        data.chatBgPresets = await wcDb.get('kv_store', 'chat_bg_presets');
        data.phonePresets = await wcDb.get('kv_store', 'phone_presets');
        data.shopData = await wcDb.get('kv_store', 'shop_data');
        data.characters = shouldUseSnapshotCharacters ? persistentCharactersSnapshot.characters : (dbCharacters || []);
        data.masks = await wcDb.getAll('masks');
        data.moments = await wcDb.getAll('moments');
        
        const allChats = await wcDb.getAll('chats');
        const chatsObj = {};
        if (allChats) {
            allChats.forEach(item => {
                chatsObj[item.charId] = item.messages;
            });
        }
        data.chats = chatsObj;

        const exportObj = { signature: 'wechat_sim_backup', timestamp: Date.now(), data: data };
        
        let jsonString;
        try {
            jsonString = JSON.stringify(exportObj);
        } catch (err) {
            throw new Error("数据量过大，请尝试清理部分聊天记录或图片后再备份。");
        }

        const blob = new Blob([jsonString], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        let defaultName = `wechat_backup_${new Date().toISOString().slice(0,10)}`;
        let fileName = prompt("请输入备份文件名称：", defaultName);
        if (fileName === null) return; // 用户点击取消，中止下载
        fileName = fileName.trim() || defaultName; // 如果输入为空，使用默认名
        
        a.href = url; a.download = `${fileName}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error("WeChat 备份失败:", error);
        alert("WeChat 备份失败: " + error.message);
    }
}

function wcImportData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (json.signature !== 'wechat_sim_backup') return alert("导入失败：文件格式不正确。");
            if (confirm("这将覆盖当前 WeChat 的所有数据，确定要恢复吗？")) {
                const data = json.data;
                const importedCharacters = Array.isArray(data.characters) ? data.characters : [];
                const charactersUpdatedAt = Date.now();

                if (data.myFavorites) await wcDb.put('kv_store', data.myFavorites, 'my_favorites');
                if (data.user) await wcDb.put('kv_store', data.user, 'user');
                if (data.wallet) await wcDb.put('kv_store', data.wallet, 'wallet');
                if (data.stickerCategories) await wcDb.put('kv_store', data.stickerCategories, 'sticker_categories');
                if (data.cssPresets) await wcDb.put('kv_store', data.cssPresets, 'css_presets');
                if (data.chatBgPresets) await wcDb.put('kv_store', data.chatBgPresets, 'chat_bg_presets'); // 新增
                if (data.phonePresets) await wcDb.put('kv_store', data.phonePresets, 'phone_presets'); // 新增
                if (data.shopData) await wcDb.put('kv_store', data.shopData, 'shop_data'); // 新增
                
                const stores = ['characters', 'masks', 'moments', 'chats'];
                for (const store of stores) {
                    await wcClearStore(store);
                }

                for (const c of importedCharacters) await wcDb.put('characters', c);
                if (data.masks) for (const m of data.masks) await wcDb.put('masks', m);
                if (data.moments) for (const m of data.moments) await wcDb.put('moments', m);
                if (data.chats) {
                    for (const charId in data.chats) {
                        const parsedId = parseInt(charId);
                        if (!isNaN(parsedId)) {
                            await wcDb.put('chats', { charId: parsedId, messages: data.chats[charId] }).catch(e => console.warn(e));
                        }
                    }
                }

                await wcSyncCharactersSnapshotFromList(importedCharacters, charactersUpdatedAt);
                
                alert("WeChat 数据恢复成功，页面将刷新。");
                location.reload();
            }
        } catch (err) { alert("导入失败：文件损坏。"); }
    };
    reader.readAsText(file);
    input.value = '';
}

async function wcClearData() {
    if (confirm("警告：此操作将永久删除 WeChat 的所有数据！确定要继续吗？")) {
        const stores = ['kv_store', 'characters', 'chats', 'moments', 'masks'];
        for (const store of stores) {
            await wcClearStore(store);
        }
        await wcClearCharactersPersistentSnapshot();
        alert("WeChat 数据已清空，页面将重置。");
        location.reload();
    }
}

// --- WeChat Render All ---
function wcRenderAll() { wcRenderContacts(); wcRenderChats(); wcRenderMoments(); wcRenderUser(); }

function wcRenderContacts() {
    const list = document.getElementById('wc-contacts-list');
    list.innerHTML = '';
    
    // 过滤当前分组的角色
    const filteredChars = wcState.characters.filter(c => {
        if (wcState.activeContactsGroup === 'All') return true;
        return c.groupName === wcState.activeContactsGroup;
    });

    if (filteredChars.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0;">该分组下暂无联系人</div>';
        return;
    }

    filteredChars.forEach(char => {
        const div = document.createElement('div');
        div.className = 'wc-swipe-container';
        div.innerHTML = `<div class="wc-swipe-actions" onclick="wcDeleteCharacter(${char.id})">删除</div><div class="wc-swipe-content" onclick="wcShowCharDetail(${char.id})" ontouchstart="wcHandleTouchStartSwipe(event)" ontouchmove="wcHandleTouchMoveSwipe(event)" ontouchend="wcHandleTouchEndSwipe(event)"><img src="${char.avatar}" class="wc-avatar"><div class="wc-item-content"><div class="wc-item-title">${char.name}</div><div class="wc-item-subtitle">${char.note}</div></div></div>`;
        list.appendChild(div);
    });
}

function wcRenderChats() {
    const avatarScroll = document.getElementById('wc-char-avatar-scroll');
    if (avatarScroll) {
        avatarScroll.innerHTML = '';
        wcState.characters.filter(c => !c.isGroup).forEach(char => {
            const img = document.createElement('img');
            img.className = 'wc-char-avatar-item';
            img.src = char.avatar;
            img.onclick = () => wcOpenBlockedHistory(char.id); 
            avatarScroll.appendChild(img);
        });
    }

    const list = document.getElementById('wc-chat-list');
    list.innerHTML = '';
    
    const searchInput = document.getElementById('wc-chat-list-search');
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    // 过滤当前分组的角色及搜索关键词
    const filteredChars = wcState.characters.filter(c => {
        if (wcState.activeChatGroup !== 'All' && c.groupName !== wcState.activeChatGroup) return false;
        if (keyword) {
            return c.name.toLowerCase().includes(keyword) || (c.note && c.note.toLowerCase().includes(keyword));
        }
        return true;
    });

    const pinnedChars = filteredChars.filter(c => c.isPinned);
    const otherChars = filteredChars.filter(c => !c.isPinned).sort((a, b) => {
        const msgsA = wcState.chats[a.id] || [];
        const msgsB = wcState.chats[b.id] || [];
        const timeA = msgsA.length > 0 ? msgsA[msgsA.length - 1].time : 0;
        const timeB = msgsB.length > 0 ? msgsB[msgsB.length - 1].time : 0;
        return timeB - timeA;
    });

    const createChatItem = (char) => {
        const msgs = wcState.chats[char.id] || [];
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        let subtitle = '点击开始聊天...';
        let timeStr = '';
        if (lastMsg) {
            if (lastMsg.type === 'sticker') subtitle = '[表情包]';
            else if (lastMsg.type === 'image') subtitle = '[图片]';
            else if (lastMsg.type === 'voice') subtitle = '[语音]';
            else if (lastMsg.type === 'transfer') subtitle = '[转账]';
            else if (lastMsg.type === 'invite') subtitle = '[恋人空间邀请]';
            else if (lastMsg.type === 'receipt') subtitle = '[购物订单]';
            else if (lastMsg.type === 'system') subtitle = '[系统消息]';
            else subtitle = lastMsg.content;
            timeStr = new Date(lastMsg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        
        const div = document.createElement('div');
        div.className = 'wc-chat-swipe-container';
        const pinClass = char.isPinned ? "wc-pinned-chat" : "";
        
        // 👇 新增：获取自定义置顶字样
        let pinTagHtml = '';
        if (char.isPinned) {
            const pinText = wcState.globalConfig.pinText || 'ㅠㅅㅠ';
            pinTagHtml = `<span class="wc-custom-pin-tag">${pinText}</span>`;
        }
        
        const unreadCount = wcState.unreadCounts[char.id] || 0;
        const badgeHtml = unreadCount > 0 ? `<div class="wc-unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : '';

        // 移除了 swipe-actions，加入了 ontouchstart 和 oncontextmenu 触发长按菜单
        div.innerHTML = `
            <div class="wc-chat-swipe-content ${pinClass}" onclick="wcOpenChat(${char.id})" ontouchstart="wcChatTouchStart(event, ${char.id})" ontouchend="wcChatTouchEnd()" oncontextmenu="wcShowChatContextMenu(event, ${char.id}); return false;">
                <div class="wc-chat-avatar-wrapper">
                    <img src="${char.avatar}" class="wc-avatar-square">
                    ${badgeHtml}
                </div>
                <div class="wc-item-content">
                    <div class="wc-item-title">${char.note || char.name}${char.isGroup && char.members ? ` (${char.members.length})` : ''}${pinTagHtml}</div>
                    <div class="wc-item-subtitle">${subtitle}</div>
                </div>
                <div class="wc-chat-time">${timeStr}</div>
            </div>
        `;
        return div;
    };

    // 分别创建置顶和普通的包裹容器
    if (pinnedChars.length > 0) {
        const pinnedWrapper = document.createElement('div');
        pinnedWrapper.className = 'chat-list-wrapper pinned-wrapper';
        pinnedChars.forEach(char => pinnedWrapper.appendChild(createChatItem(char)));
        list.appendChild(pinnedWrapper);
    }
    
    if (otherChars.length > 0) {
        const otherWrapper = document.createElement('div');
        otherWrapper.className = 'chat-list-wrapper other-wrapper';
        otherChars.forEach(char => otherWrapper.appendChild(createChatItem(char)));
        list.appendChild(otherWrapper);
    }
    
    if (pinnedChars.length === 0 && otherChars.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0;">该分组下暂无会话</div>';
    }
}

// --- 替换 wcRenderMoments 和 wcFilterMoments ---
function wcRenderMoments() {
    const feed = document.getElementById('wc-moments-feed');
    feed.innerHTML = '';
    
    // 动态构建顶部个人信息区 (包含背景、标题、头像、名字、故事圈)
    const profileSection = document.getElementById('wc-moments-profile-section');
    if (profileSection) {
        const coverBg = wcState.user.cover ? `url('${wcState.user.cover}')` : 'none';
        const userName = wcState.user.name || 'User';
        const userBio = wcState.user.bio || '记录生活的美好'; // 👈 修改：使用独立的 bio 字段
        const bubbleText = wcState.user.bubbleText || 'why'; 
        
        profileSection.innerHTML = `
            <!-- 顶部背景区域 (高度减小) -->
            <div class="wc-moments-cover-area" style="background-image: ${coverBg};">
                <!-- 退出键已彻底去除 -->
            </div>
            
            <!-- 下方信息区域 (包含悬浮头像、名字、签名、故事圈) -->
            <div class="wc-moments-info-area">
                <!-- 移至卡片右上角的 Done 按钮 -->
                <div class="wc-moments-edit-text-card" onclick="wcOpenMomentEditModal()">Edit</div>
                
                <!-- 居中悬浮头像 (带气泡和加号) -->
                <div class="wc-moments-avatar-wrapper">
                    <div class="wc-moments-bubble" onclick="wcOpenMomentEditModal()">${bubbleText}</div>
                    <img id="wc-moments-user-avatar" src="${wcState.user.avatar}" class="wc-moments-avatar" alt="avatar" onclick="wcOpenMomentEditModal()">
                    <div class="wc-moments-add-btn" onclick="wcOpenModal('wc-modal-post-moment')">+</div>
                </div>
                
                <!-- 居中名字 -->
                <div class="wc-moments-username">
                    ${userName}
                    <svg class="verified-icon" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.7L6 12.6l1.5-1.5 2.6 2.6 6.4-6.4 1.5 1.5-7.9 7.9z"/></svg>
                </div>
                
                <!-- 居中签名 -->
                <div class="wc-moments-bio">${userBio}</div>
                
                <!-- 故事圈区域 (仅保留头像列表，居中显示) -->
                <div class="wc-moments-story-container">
                    <div class="wc-moments-story-highlights" id="wc-moments-story-highlights"></div>
                </div>
            </div>
        `;

        // 绑定头像点击事件 (过滤 ALL)
        const avatarEl = document.getElementById('wc-moments-user-avatar');
        if (avatarEl) {
            avatarEl.onclick = () => wcFilterMoments('all');
            if (wcState.momentFilter === 'all') {
                avatarEl.style.border = '2px solid #111';
            } else {
                avatarEl.style.border = 'none';
            }
        }

        // 渲染故事圈
        const storyContainer = document.getElementById('wc-moments-story-highlights');
        if (storyContainer) {
            wcState.characters.filter(c => !c.isGroup).forEach(char => {
                const isActive = wcState.momentFilter === 'char' && wcState.momentFilterChar === char.name;
                storyContainer.innerHTML += `
                    <div class="wc-moments-story-item" onclick="wcFilterMoments('char', '${char.name}')">
                        <div class="wc-moments-story-circle ${isActive ? 'active' : ''}"><img src="${char.avatar}"></div>
                    </div>
                `;
            });
        }
    }

    // 🌟 核心：在头像下方动态生成 7 天滚动日历 (新版横线贯穿样式)
    let calContainer = document.getElementById('wc-moments-calendar-bar');
    if (!calContainer) return;

    const now = new Date();
    let weekHtml = '';
    const weekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // 生成以“今天”为中心的 7 天 (-3天 到 +3天)
    for(let i = -3; i <= 3; i++) {
        const d = new Date(now.getTime() + i * 86400000);
        const dayOfWeek = weekNames[d.getDay()];
        
        // 判断是否被选中
        let isActive = false;
        if (wcState.momentFilter === 'specificDate' && wcState.momentFilterDate) {
            if (wcState.momentFilterDate.year === d.getFullYear() && 
                wcState.momentFilterDate.month === d.getMonth() && 
                wcState.momentFilterDate.day === d.getDate()) {
                isActive = true;
            }
        }
        
        weekHtml += `
            <div class="wc-cal-day-item ${isActive ? 'active' : ''}" onclick="wcFilterMoments('date', ${d.getTime()})">
                <div class="wc-cal-active-bg"></div>
                <span class="wc-cal-day-text">${dayOfWeek}</span>
                <div class="wc-cal-dot"></div>
            </div>`;
    }
    
    calContainer.innerHTML = `
        <div class="wc-timeline-calendar">
            <div class="wc-cal-star-btn" title="进入日历" onclick="wcOpenCalendarModal()">
                <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <div class="wc-cal-timeline-wrapper">
                <div class="wc-cal-line"></div>
                <div class="wc-cal-days">
                    ${weekHtml}
                </div>
            </div>
        </div>
    `;

    // 日期/角色过滤逻辑
    let filteredMoments = wcState.moments;
    
    if (wcState.momentFilter === 'specificDate' && wcState.momentFilterDate) {
        const targetStart = new Date(wcState.momentFilterDate.year, wcState.momentFilterDate.month, wcState.momentFilterDate.day).getTime();
        const targetEnd = targetStart + 86400000;
        filteredMoments = wcState.moments.filter(m => m.time >= targetStart && m.time < targetEnd);
    } else if (wcState.momentFilter === 'char' && wcState.momentFilterChar) {
        filteredMoments = wcState.moments.filter(m => m.name === wcState.momentFilterChar);
    }

    if (filteredMoments.length === 0) {
        feed.innerHTML = '<div style="text-align:center; color:#999; padding:60px 0; font-size:13px; font-style:italic; font-family: Georgia, serif;">这一天没有动态哦...</div>';
        return;
    }

    filteredMoments.forEach(moment => {
        let mediaHtml = '';
        if (moment.image) {
            // 真实图片增加点击预览
            mediaHtml = `<img src="${moment.image}" class="wc-moment-image" onclick="wcPreviewImage('${moment.image}')" style="cursor: pointer;">`;
        } else if (moment.imageDesc) {
            // AI 描述图片增加点击弹出高级卡片
            const safeDesc = moment.imageDesc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            mediaHtml = `<div class="wc-moment-image-placeholder" onclick="wcOpenImageDescCard('${safeDesc}')" style="width: 100px !important; height: 100px !important; max-width: none !important; padding: 5px !important; box-sizing: border-box; cursor: pointer;"><svg class="wc-icon" style="margin-bottom: 4px; width: 24px; height:24px;" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div style="font-size: 10px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${moment.imageDesc}</div></div>`;
        }
        
        let likesHtml = '';
        if (moment.likes && moment.likes.length > 0) likesHtml = `<div class="wc-moment-like-row"><svg class="wc-icon wc-icon-fill" style="width:14px; height:14px; margin-right:6px;" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>${moment.likes.join(', ')}</div>`;
        
        let commentsHtml = '';
        if (moment.comments && moment.comments.length > 0) {
            moment.comments.forEach((c, cIdx) => { 
                commentsHtml += `<div class="wc-moment-comment-row" onclick="wcPrepareReply(${moment.id}, ${cIdx}, '${c.name}')"><span class="wc-moment-comment-name">${c.name}:</span> ${c.text}</div>`; 
            });
        }
        
        const interactionArea = (likesHtml || commentsHtml) ? `<div class="wc-moment-likes-comments">${likesHtml}${commentsHtml}</div>` : '';
        
        // 动态判断是否有文字，如果没有文字就不渲染 div，防止出现多余的空白间距
        let textHtml = '';
        if (moment.text && moment.text.trim() !== '') {
            textHtml = `<div class="wc-moment-text">${moment.text}</div>`;
        }
        
        // 新增：显示可见分组标签
        let groupTagHtml = '';
        if (moment.visibleGroup && moment.visibleGroup !== 'All') {
            groupTagHtml = `<span style="font-size: 10px; color: #007AFF; background: rgba(0,122,255,0.1); padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">${moment.visibleGroup}</span>`;
        }

        const div = document.createElement('div');
        div.className = 'wc-moment-card';
        // 确保卡片是 relative 定位，以便右上角按钮绝对定位
        div.style.position = 'relative'; 
        div.innerHTML = `
            <!-- 👇 新增：绝对定位在右上角的三个点按钮 👇 -->
            <div class="wc-moment-more-btn" onclick="wcToggleMomentMenu(event, ${moment.id})">
                <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
            </div>
            <!-- 👇 新增：向左弹出的高级深色菜单 👇 -->
            <div class="wc-moment-popover" id="moment-popover-${moment.id}">
                <div class="wc-moment-popover-item" onclick="wcOpenMomentAISelectForSingle(event, ${moment.id})" title="召唤 AI 互动">
                    <!-- 高级闪耀星星 SVG 图标 -->
                    <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                </div>
            </div>

            <div class="wc-moment-header-row">
                <img src="${moment.avatar || wcState.user.avatar}" class="wc-avatar" style="width: 40px; height: 40px; border-radius: 50%;">
                <div class="wc-moment-name">${moment.name || wcState.user.name}${groupTagHtml}</div>
            </div>
            <div class="wc-moment-content">
                ${textHtml}
                ${mediaHtml}
                <div class="wc-moment-actions">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 11px; color: #B2B2B2; font-family: monospace;">${new Date(moment.time).toLocaleString('zh-CN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                        <span style="font-size: 11px; color: #888; cursor: pointer; font-weight: bold;" onclick="wcDeleteMoment(${moment.id})">DELETE</span>
                    </div>
                    <div style="display: flex; gap: 16px;">
                        <div onclick="wcToggleLike(${moment.id})"><svg class="wc-icon" style="width:20px; height:20px; color: #111;" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div>
                        <div onclick="wcToggleCommentBox(${moment.id})"><svg class="wc-icon" style="width:20px; height:20px; color: #111;" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></div>
                    </div>
                </div>
                ${interactionArea}
                <div id="wc-comment-box-${moment.id}" class="wc-comment-input-box" style="display: none;">
                    <input type="text" id="wc-input-comment-${moment.id}" class="wc-comment-input" placeholder="Add a comment...">
                    <button class="wc-moment-action-btn" onclick="wcAddComment(${moment.id})">POST</button>
                </div>
            </div>
        `;
        feed.appendChild(div);
    });
}
// ==========================================
// 新增：朋友圈 Edit Profile 弹窗逻辑
// ==========================================
window.wcOpenMomentEditModal = function() {
    let modal = document.getElementById('wc-modal-moment-edit');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-modal-moment-edit';
        modal.className = 'wc-modal hidden';
        modal.style.zIndex = '3500';
        modal.style.alignItems = 'flex-end';
        document.getElementById('wechat-root').appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="wc-modal-content" style="height: auto; border-radius: 16px 16px 0 0; width: 100%; max-width: 100%; background: #FFF; padding-bottom: env(safe-area-inset-bottom);">
            <div class="wc-modal-header" style="border-bottom: 1px solid #F0F0F0; padding: 16px 20px;">
                <h3 style="color: #111; font-size: 18px; font-weight: 700;">Edit Profile</h3>
                <button class="wc-close-btn" onclick="wcCloseModal('wc-modal-moment-edit')">&times;</button>
            </div>
            <div class="wc-modal-body" style="padding: 20px;">
                <div class="wc-form-group">
                    <label class="wc-form-label" style="color: #888; font-weight: bold;">名称</label>
                    <input type="text" id="wc-moment-edit-name" class="wc-form-input" style="background: #F5F5F5; border: 1px solid #EAEAEA;" value="${wcState.user.name}">
                </div>
                <div class="wc-form-group">
                    <label class="wc-form-label" style="color: #888; font-weight: bold;">个性签名</label>
                    <input type="text" id="wc-moment-edit-bio" class="wc-form-input" style="background: #F5F5F5; border: 1px solid #EAEAEA;" value="${wcState.user.bio || ''}">
                </div>
                <div class="wc-form-group">
                    <label class="wc-form-label" style="color: #888; font-weight: bold;">气泡文字</label>
                    <input type="text" id="wc-moment-edit-bubble" class="wc-form-input" style="background: #F5F5F5; border: 1px solid #EAEAEA;" value="${wcState.user.bubbleText || 'why'}">
                </div>
                <div class="wc-form-group">
                    <label class="wc-form-label" style="color: #888; font-weight: bold;">背景壁纸</label>
                    <button class="wc-btn-secondary" style="width: 100%; padding: 12px; border-radius: 12px; background: #F5F5F5; color: #111; border: 1px solid #EAEAEA; font-weight: bold; margin: 0;" onclick="wcTriggerUpload('cover')">从相册选择新背景</button>
                </div>
                <button class="wc-btn-primary" style="background: #111; color: #FFF; border-radius: 16px; margin-top: 10px;" onclick="wcSaveMomentProfile()">保存修改</button>
            </div>
        </div>
    `;
    
    wcOpenModal('wc-modal-moment-edit');
};

window.wcSaveMomentProfile = function() {
    const name = document.getElementById('wc-moment-edit-name').value.trim();
    const bio = document.getElementById('wc-moment-edit-bio').value.trim();
    const bubble = document.getElementById('wc-moment-edit-bubble').value.trim();
    
    if (name) wcState.user.name = name;
    wcState.user.bio = bio; 
    wcState.user.bubbleText = bubble; 
    
    // 👈 已经删除了同步到面具的代码，朋友圈的修改绝对不会影响面具原本的设定了
    
    wcSaveData();
    wcRenderMoments();
    wcRenderUser();
    wcCloseModal('wc-modal-moment-edit');
};

function wcRenderUser() { 
    // 1. 更新顶部卡片的名字
    const nameDisplay = document.getElementById('wc-user-airdrop-name');
    if (nameDisplay) {
        nameDisplay.innerText = 'Name: ' + wcState.user.name;
    }

    // 2. 动态渲染身份卡片 (有几个面具渲染几个)
    const avatarContainer = document.getElementById('wc-user-mask-avatars');
    if (avatarContainer) {
        // 动态修改 class 以应用新样式
        avatarContainer.className = 'id-card-list';
        avatarContainer.innerHTML = '';
        let cardsHtml = '';
        
        // 转义当前身份的引号和换行
        const safeCurrentName = wcState.user.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safeCurrentPrompt = (wcState.user.persona || '暂无设定').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, '<br>');
        
        // 辅助函数：根据名字生成固定的 7 位数字编号
        const generateNo = (name) => {
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            return Math.abs(hash).toString().substring(0, 7).padStart(7, '0');
        };

        // 渲染当前身份 (状态为 LINKED)
        cardsHtml += `
            <div class="id-card-item" onclick="wcShowPersona('当前身份: ${safeCurrentName}', '${safeCurrentPrompt}')">
                <div class="id-card-pendant">
                    <div class="pendant-hole"></div>
                    <div class="pendant-chain"></div>
                    <div class="pendant-star">
                        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                </div>
                <div class="id-card-top">
                    <div class="id-card-avatar-wrapper">
                        <img src="${wcState.user.avatar}" class="id-card-avatar">
                        <svg class="id-card-star star-1" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <svg class="id-card-star star-2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <svg class="id-card-star star-3" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <div class="id-card-info">
                        <div class="id-card-label">SUBJECT NAME</div>
                        <div class="id-card-name">${safeCurrentName}</div>
                        <div class="id-card-meta-row">
                            <div class="id-card-no">NO. ${generateNo(safeCurrentName)}</div>
                            <div class="id-card-status">LINKED</div>
                        </div>
                    </div>
                </div>
                <div class="id-card-barcode"></div>
            </div>
        `;
        
        // 渲染备用面具身份 (状态为 STANDBY)
        if (wcState.masks && wcState.masks.length > 0) {
            wcState.masks.forEach(m => {
                // 避免重复渲染当前正在使用的面具
                let isCurrentMask = false;
                if (wcState.user.maskId) {
                    isCurrentMask = (m.id === wcState.user.maskId);
                } else {
                    isCurrentMask = (m.avatar === wcState.user.avatar && m.name === wcState.user.name);
                }
                
                if (!isCurrentMask) {
                    const safeName = m.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    const safePrompt = (m.prompt || '暂无设定').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, '<br>');
                    cardsHtml += `
                        <div class="id-card-item" onclick="wcShowPersona('面具: ${safeName}', '${safePrompt}')">
                            <div class="id-card-pendant">
                                <div class="pendant-hole"></div>
                                <!-- 备用面具没有链子和星星挂坠 -->
                            </div>
                            <div class="id-card-top">
                                <div class="id-card-avatar-wrapper">
                                    <img src="${m.avatar}" class="id-card-avatar">
                                    <svg class="id-card-star star-1" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    <svg class="id-card-star star-2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    <svg class="id-card-star star-3" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                </div>
                                <div class="id-card-info">
                                    <div class="id-card-label">SUBJECT NAME</div>
                                    <div class="id-card-name">${safeName}</div>
                                    <div class="id-card-meta-row">
                                        <div class="id-card-no">NO. ${generateNo(safeName)}</div>
                                        <div class="id-card-status" style="color: #888; border-color: #CCC;">STANDBY</div>
                                    </div>
                                </div>
                            </div>
                            <div class="id-card-barcode"></div>
                        </div>
                    `;
                }
            });
        }
        
        avatarContainer.innerHTML = cardsHtml;
    }
}

// 新增：点击头像查看人设的弹窗函数
window.wcShowPersona = function(name, prompt) {
    let modal = document.getElementById('wc-modal-ios-confirm');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-modal-ios-confirm';
        modal.className = 'ios-alert-overlay';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="ios-alert-box" style="width: 280px;">
            <div class="ios-alert-title" style="font-size: 16px;">${name}</div>
            <div class="ios-alert-message" style="padding-bottom: 15px; max-height: 300px; overflow-y: auto; text-align: left; font-size: 13px; color: #555; line-height: 1.5;">
                ${prompt}
            </div>
            <div style="display: flex; border-top: 0.5px solid rgba(60, 60, 67, 0.29);">
                <button class="ios-alert-btn" style="flex: 1; font-weight: bold; color: #007AFF;" onclick="document.getElementById('wc-modal-ios-confirm').classList.remove('active')">关闭</button>
            </div>
        </div>
    `;
    modal.classList.add('active');
};

// --- WeChat Character & User Management ---
function wcTriggerUpload(type) { document.getElementById(`wc-file-input-${type}`).click(); }

async function wcHandleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    // ⚠️ 安全限制：视频文件过大会导致浏览器卡死或数据库存不下
    if (file.type.startsWith('video/') && file.size > 15 * 1024 * 1024) {
        alert("视频文件过大！请选择 15MB 以内的视频，否则会导致数据丢失哦~");
        event.target.value = '';
        return;
    }

    try {
        let base64 = '';
        // 如果是 GIF 动图或视频，跳过压缩，直接转为 Base64
        if (file.type === 'image/gif' || file.type.startsWith('video/')) {
            base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = err => reject(err);
                reader.readAsDataURL(file);
            });
        } else {
            // 普通图片继续使用压缩
            base64 = await wcCompressImage(file);
        }

        wcState.tempImage = base64;
        wcState.tempImageType = type; 

        if (type === 'char') {
            document.getElementById('wc-preview-char-avatar').src = base64;
            document.getElementById('wc-preview-char-avatar').style.display = 'block';
            document.getElementById('wc-icon-char-upload').style.display = 'none';
        } else if (type === 'group') { // 👈 新增这段
            document.getElementById('wc-preview-group-avatar').src = base64;
            document.getElementById('wc-preview-group-avatar').style.display = 'block';
            document.getElementById('wc-icon-group-upload').style.display = 'none';
        } else if (type === 'edit-char') {
            document.getElementById('wc-edit-char-avatar').src = base64;
        } else if (type === 'user') {
            wcState.user.avatar = base64;
            wcSaveData();
            wcRenderUser();
        } else if (type === 'cover') {
            wcState.user.cover = base64;
            wcSaveData();
            wcRenderMoments();
        } else if (type === 'moment') {
            document.getElementById('wc-preview-moment-img').src = base64;
            document.getElementById('wc-area-local-img-box').style.display = 'block';
        } else if (type === 'mask') {
            document.getElementById('wc-preview-mask-avatar').src = base64;
        } else if (type === 'chat-img') {
            wcAddMessage(wcState.activeChatId, 'me', 'image', base64);
            wcCloseAllPanels();
        } else if (type === 'setting-char') {
            document.getElementById('wc-setting-char-avatar').src = base64;
            document.getElementById('wc-cs-char-avatar-display').src = base64; // 同步更新顶部
        } else if (type === 'setting-user') {
            document.getElementById('wc-setting-user-avatar').src = base64;
            document.getElementById('wc-cs-user-avatar-display').src = base64; // 同步更新顶部
        } else if (type === 'setting-bg') {
            document.getElementById('wc-setting-bg-preview').src = base64;
            document.getElementById('wc-setting-bg-preview').style.display = 'block';
            document.getElementById('wc-setting-bg-text').style.display = 'none';
            
            // 【新增】：自动保存到图库
            if (!wcState.chatBgPresets.includes(base64)) {
                wcState.chatBgPresets.push(base64);
                wcSaveData();
                wcRenderChatBgGallery();
            }
        } else if (type === 'phone-bg') {
            document.getElementById('wc-preview-phone-bg').src = base64;
            document.getElementById('wc-preview-phone-bg').style.display = 'block';
            document.getElementById('wc-text-phone-bg').style.display = 'none';
            wcState.tempPhoneConfig.wallpaper = base64;
        } else if (type === 'sticky-note') {
            document.getElementById('wc-preview-sticky-note').src = base64;
            document.getElementById('wc-preview-sticky-note').style.display = 'block';
            document.getElementById('wc-text-sticky-note').style.display = 'none';
            wcState.tempPhoneConfig.stickyNote = base64;
        } else if (type.startsWith('icon-')) {
            const iconKey = type.replace('icon-', '');
            document.getElementById(`wc-preview-icon-${iconKey}`).src = base64;
            document.getElementById(`wc-preview-icon-${iconKey}`).style.display = 'block';
            if(!wcState.tempPhoneConfig.icons) wcState.tempPhoneConfig.icons = {};
            wcState.tempPhoneConfig.icons[iconKey] = base64;
        } else if (type === 'widget-photo') {
            document.getElementById('wc-preview-char-widget-photo').src = base64;
            document.getElementById('wc-preview-char-widget-photo').style.display = 'block';
            document.getElementById('wc-text-char-widget-photo').style.display = 'none';
        }
    } catch (err) {
        alert("图片处理失败");
    }
}
// ==========================================
// 新增：群聊创建与管理逻辑
// ==========================================
function wcOpenAddGroupModal() {
    document.getElementById('wc-preview-group-avatar').style.display = 'none';
    document.getElementById('wc-icon-group-upload').style.display = 'block';
    document.getElementById('wc-input-group-name').value = '';
    wcState.tempImage = '';
    wcState.tempImageType = 'group';

    const list = document.getElementById('wc-group-member-select-list');
    list.innerHTML = '';
    
    // 过滤掉已经是群聊的角色
    const singleChars = wcState.characters.filter(c => !c.isGroup);
    if (singleChars.length === 0) {
        list.innerHTML = '<div style="color:#999; font-size:13px; text-align:center; padding: 10px;">暂无单人角色，请先创建角色</div>';
    } else {
        singleChars.forEach(char => {
            list.innerHTML += `
                <div class="wc-checkbox-item" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <input type="checkbox" value="${char.id}" class="group-member-checkbox" style="width: 20px; height: 20px;">
                    <img src="${char.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                    <span style="font-size: 15px;">${char.name}</span>
                </div>
            `;
        });
    }
    wcOpenModal('wc-modal-add-group');
}

async function wcSaveGroupChat() {
    const name = document.getElementById('wc-input-group-name').value.trim();
    if (!name) return alert('请输入群聊名称');

    const checkboxes = document.querySelectorAll('.group-member-checkbox:checked');
    const members = Array.from(checkboxes).map(cb => parseInt(cb.value));
    if (members.length === 0) return alert('请至少选择一个群成员');

    // 【新增】：默认将用户(User)加入群聊成员列表的最前面
    members.unshift('user'); 

    const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#E5E5EA"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="24" font-weight="bold">群聊</text></svg>`;
    const defaultAvatar = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(defaultAvatarSvg)));

    const newGroup = {
        id: Date.now(),
        name: name,
        note: name,
        prompt: `这是一个名为【${name}】的微信群聊。群成员包括你和其他人。请根据群成员的性格进行多人对话模拟。`,
        avatar: wcState.tempImage || defaultAvatar,
        isPinned: false,
        isGroup: true,
        members: members,
        ownerId: 'user' // 【新增】：默认群主为用户
    };

    wcState.characters.push(newGroup);
    await wcWriteCharactersPersistentSnapshot();
    try {
        await wcDb.put('characters', newGroup);
    } catch (e) {
        console.warn('群聊联系人写入 IndexedDB 失败，已保留本地兜底快照', e);
    }
    await wcSaveData();
    wcCloseModal('wc-modal-add-group');
    wcRenderAll();
}

function renderGroupMembersInSettings(groupChar) {
    const section = document.getElementById('wc-setting-group-members-section');
    if(section) section.style.display = 'block';
    const grid = document.getElementById('wc-group-members-grid');
    if(!grid) return;
    grid.innerHTML = '';

    const members = groupChar.members || [];
    const mutedMembers = groupChar.mutedMembers || []; // 👈 获取禁言名单
    const isCurrentUserOwner = groupChar.ownerId === 'user'; // 👈 判断我是否是群主

    // 1. 渲染用户(User)
    if (members.includes('user')) {
        const isUserOwner = groupChar.ownerId === 'user';
        const isMuted = mutedMembers.includes('user');
        const muteBadge = isMuted ? '<div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #FF3B30; color: white; font-size: 8px; padding: 2px 4px; border-radius: 6px; white-space: nowrap; z-index: 2;">已禁言</div>' : '';
        
        grid.innerHTML += `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative;">
                <img src="${wcState.user.avatar}" class="${isMuted ? 'muted-avatar' : ''}" style="width: 44px; height: 44px; border-radius: 12px; object-fit: cover; border: 1px solid #eee;">
                <span style="font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${wcState.user.name}</span>
                ${isUserOwner ? '<div style="position: absolute; top: -6px; right: -6px; background: #F5A623; color: white; font-size: 8px; padding: 2px 4px; border-radius: 6px; font-weight: bold; border: 1px solid #fff; z-index: 2;">群主</div>' : ''}
                ${muteBadge}
            </div>
        `;
    }

    // 2. 渲染其他现有成员
    members.forEach(memberId => {
        if (memberId === 'user') return;
        const member = wcState.characters.find(c => c.id === memberId);
        if (member) {
            const isOwner = groupChar.ownerId === memberId;
            const isMuted = mutedMembers.includes(memberId);
            const muteBadge = isMuted ? '<div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #FF3B30; color: white; font-size: 8px; padding: 2px 4px; border-radius: 6px; white-space: nowrap; z-index: 2;">已禁言</div>' : '';
            
            // 👇 如果我是群主，点击头像可以禁言/解除禁言
            const clickAction = isCurrentUserOwner ? `onclick="wcToggleMuteMember(${groupChar.id}, ${memberId})"` : '';

            grid.innerHTML += `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; cursor: ${isCurrentUserOwner ? 'pointer' : 'default'};" ${clickAction} title="${isCurrentUserOwner ? '点击禁言/解除' : ''}">
                    <img src="${member.avatar}" class="${isMuted ? 'muted-avatar' : ''}" style="width: 44px; height: 44px; border-radius: 12px; object-fit: cover; border: 1px solid #eee;">
                    <span style="font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${member.name}</span>
                    ${isOwner ? '<div style="position: absolute; top: -6px; right: -6px; background: #F5A623; color: white; font-size: 8px; padding: 2px 4px; border-radius: 6px; font-weight: bold; border: 1px solid #fff; z-index: 2;">群主</div>' : ''}
                    ${muteBadge}
                </div>
            `;
        }
    });

    // 3. 渲染 + 按钮 (邀请)
    grid.innerHTML += `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;" onclick="wcManageGroupMembers('add')">
            <div style="width: 44px; height: 44px; border-radius: 12px; border: 1px dashed #CCC; display: flex; align-items: center; justify-content: center; color: #888; font-size: 24px; background: #FAFAFA;">+</div>
            <span style="font-size: 10px; color: #888;">邀请</span>
        </div>
    `;

    // 4. 渲染 - 按钮 (踢人)
    grid.innerHTML += `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;" onclick="wcManageGroupMembers('remove')">
            <div style="width: 44px; height: 44px; border-radius: 12px; border: 1px dashed #CCC; display: flex; align-items: center; justify-content: center; color: #888; font-size: 24px; background: #FAFAFA;">-</div>
            <span style="font-size: 10px; color: #888;">移出</span>
        </div>
    `;

    // 5. 渲染群主选择下拉框
    const ownerSelect = document.getElementById('wc-setting-group-owner');
    if(ownerSelect) {
        ownerSelect.innerHTML = '';
        if (members.includes('user')) {
            ownerSelect.innerHTML += `<option value="user" ${groupChar.ownerId === 'user' ? 'selected' : ''}>${wcState.user.name}</option>`;
        }
        members.forEach(memberId => {
            if (memberId === 'user') return;
            const member = wcState.characters.find(c => c.id === memberId);
            if (member) {
                const selected = groupChar.ownerId === memberId ? 'selected' : '';
                ownerSelect.innerHTML += `<option value="${member.id}" ${selected}>${member.name}</option>`;
            }
        });
    }
}

// 👇 新增：切换禁言状态 👇
window.wcToggleMuteMember = function(groupId, memberId) {
    const group = wcState.characters.find(c => c.id === groupId);
    if (!group) return;
    
    if (group.ownerId !== 'user') {
        alert("只有群主可以设置禁言哦~");
        return;
    }
    if (memberId === 'user') {
        alert("群主不能禁言自己哦~");
        return;
    }

    if (!group.mutedMembers) group.mutedMembers = [];
    
    const idx = group.mutedMembers.indexOf(memberId);
    if (idx > -1) {
        group.mutedMembers.splice(idx, 1); // 解除禁言
    } else {
        group.mutedMembers.push(memberId); // 禁言
    }
    
    wcSaveData();
    renderGroupMembersInSettings(group); // 刷新 UI
};
// 👆 新增结束 👆

function wcChangeGroupOwner(newOwnerId) {
    const groupChar = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (groupChar && groupChar.isGroup) {
        // 【新增】：支持将 'user' 设为群主
        groupChar.ownerId = newOwnerId === 'user' ? 'user' : parseInt(newOwnerId);
        wcSaveData();
        renderGroupMembersInSettings(groupChar);
    }
}

function wcManageGroupMembers(action) {
    const groupChar = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!groupChar) return;

    const list = document.getElementById('wc-manage-group-list');
    list.innerHTML = '';
    const title = document.getElementById('wc-manage-group-title');
    const confirmBtn = document.getElementById('wc-manage-group-confirm-btn');

    const members = groupChar.members || [];
    const ownerId = groupChar.ownerId;

    if (action === 'add') {
        title.innerText = '邀请新成员';
        let availableChars = [];

        // 【核心逻辑】：判断群主身份决定可邀请列表
        if (ownerId === 'user') {
            // 用户是群主：可以邀请所有未进群的单人角色
            availableChars = wcState.characters.filter(c => !c.isGroup && !members.includes(c.id));
        } else {
            // NPC是群主：只能邀请其手机通讯录中的角色
            const ownerChar = wcState.characters.find(c => c.id === ownerId);
            if (ownerChar && ownerChar.phoneData && ownerChar.phoneData.contacts) {
                const contactNames = ownerChar.phoneData.contacts.map(c => c.name);
                availableChars = wcState.characters.filter(c => !c.isGroup && !members.includes(c.id) && contactNames.includes(c.name));
            }
        }

        if (availableChars.length === 0) {
            list.innerHTML = '<div style="color:#999; font-size:13px; text-align:center; padding: 20px;">没有可邀请的角色了 (若NPC为群主，需确保其通讯录中有其他角色)</div>';
        } else {
            availableChars.forEach(char => {
                list.innerHTML += `
                    <div class="wc-checkbox-item" style="padding: 10px 0; border-bottom: 1px solid #eee;">
                        <input type="checkbox" value="${char.id}" class="manage-member-checkbox" style="width: 20px; height: 20px;">
                        <img src="${char.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                        <span style="font-size: 15px;">${char.name}</span>
                    </div>
                `;
            });
        }
        confirmBtn.onclick = () => {
            const checkboxes = document.querySelectorAll('.manage-member-checkbox:checked');
            const newMembers = Array.from(checkboxes).map(cb => parseInt(cb.value));
            if (newMembers.length === 0) return; // 如果没选人直接返回

            if (!groupChar.members) groupChar.members = [];
            groupChar.members.push(...newMembers);
            
            // 👇 新增：获取群主名字和被邀请人名字，生成系统提示
            let ownerName = "群主";
            if (ownerId === 'user') {
                ownerName = wcState.user.name;
            } else {
                const ownerChar = wcState.characters.find(c => c.id === ownerId);
                if (ownerChar) ownerName = ownerChar.name;
            }

            const newMemberNames = newMembers.map(id => {
                const c = wcState.characters.find(ch => ch.id === id);
                return c ? c.name : "未知";
            }).join('、');

            // 插入系统提示消息
            wcAddMessage(groupChar.id, 'system', 'system', `[系统提示: ${ownerName} 邀请了 ${newMemberNames} 进入群聊]`, { style: 'transparent' });
            // 👆 新增结束

            wcSaveData();
            wcCloseModal('wc-modal-manage-group-members');
            renderGroupMembersInSettings(groupChar);
        };
    } else if (action === 'remove') {
        title.innerText = '移出群成员';
        
        // 渲染用户(如果用户在群里且不是群主)
        if (ownerId !== 'user' && members.includes('user')) {
            list.innerHTML += `
                <div class="wc-checkbox-item" style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    <input type="checkbox" value="user" class="manage-member-checkbox" style="width: 20px; height: 20px;">
                    <img src="${wcState.user.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                    <span style="font-size: 15px;">${wcState.user.name}</span>
                </div>
            `;
        }

        const currentMembers = wcState.characters.filter(c => members.includes(c.id));
        currentMembers.forEach(char => {
            const disabled = char.id === ownerId ? 'disabled' : '';
            const label = char.id === ownerId ? '(群主)' : '';
            list.innerHTML += `
                <div class="wc-checkbox-item" style="padding: 10px 0; border-bottom: 1px solid #eee; ${disabled ? 'opacity:0.5;' : ''}">
                    <input type="checkbox" value="${char.id}" class="manage-member-checkbox" ${disabled} style="width: 20px; height: 20px;">
                    <img src="${char.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                    <span style="font-size: 15px;">${char.name} <span style="color:#F5A623; font-size:12px; font-weight:bold;">${label}</span></span>
                </div>
            `;
        });
        confirmBtn.onclick = () => {
            const checkboxes = document.querySelectorAll('.manage-member-checkbox:checked');
            const removeMembers = Array.from(checkboxes).map(cb => cb.value === 'user' ? 'user' : parseInt(cb.value));
            groupChar.members = members.filter(id => !removeMembers.includes(id));
            wcSaveData();
            wcCloseModal('wc-modal-manage-group-members');
            renderGroupMembersInSettings(groupChar);
        };
    }
    wcOpenModal('wc-modal-manage-group-members');
}
// ==========================================
// 新增：DOCX 解析辅助函数
// ==========================================
async function readDocxFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (typeof mammoth === 'undefined') {
                return reject(new Error("DOCX 解析库未加载，请检查网络"));
            }
            mammoth.extractRawText({arrayBuffer: e.target.result})
                .then(result => resolve(result.value))
                .catch(err => reject(err));
        };
        reader.onerror = () => reject(new Error("读取文件失败"));
        reader.readAsArrayBuffer(file);
    });
}
// ==========================================
// 新增：一键导入 CSS 美化 (TXT/DOCX)
// ==========================================
async function wcHandleCssImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    wcShowLoading("正在解析 CSS 代码...");

    try {
        const fileName = file.name;
        const ext = fileName.split('.').pop().toLowerCase();
        let cssText = '';

        if (ext === 'txt') {
            cssText = await file.text();
        } else if (ext === 'docx') {
            // 复用之前写好的 DOCX 解析辅助函数
            cssText = await readDocxFile(file);
        } else {
            throw new Error("不支持的文件格式，请使用 TXT 或 DOCX");
        }

        if (!cssText || cssText.trim() === '') {
            throw new Error("文件内容为空");
        }

        // 将提取到的 CSS 填入输入框
        const cssInput = document.getElementById('wc-setting-custom-css');
        if (cssInput) {
            cssInput.value = cssText;
        }

        wcShowSuccess("CSS 导入成功！请点击右上角保存生效。");

    } catch (error) {
        console.error("CSS 导入失败:", error);
        wcShowError("导入失败: " + error.message);
    } finally {
        event.target.value = ''; // 清空 input，允许重复导入同一个文件
    }
}

// ==========================================
// 新增：导出 CSS 美化 (TXT)
// ==========================================
function wcExportCss() {
    const cssText = document.getElementById('wc-setting-custom-css').value;
    if (!cssText || cssText.trim() === '') {
        alert("当前没有 CSS 代码可以导出哦~");
        return;
    }
    
    // 弹出输入框让用户自定义文件名
    let fileName = prompt("请输入导出的文件名：", "custom_css");
    if (fileName === null) {
        return; // 用户点击了取消
    }
    
    // 如果用户没输入内容，给个默认名
    fileName = fileName.trim() || "custom_css";
    
    // 将 CSS 文本转换为 Blob 对象
    const blob = new Blob([cssText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // 创建一个隐藏的 a 标签触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // 清理内存
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==========================================
// 强化：角色卡 (JSON/PNG/TXT/DOCX) 一键导入逻辑
// ==========================================
async function wcHandleCharImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    wcShowLoading("正在解析角色数据...");

    try {
        let charaData = null;
        let avatarBase64 = null;
        const fileName = file.name;
        const ext = fileName.split('.').pop().toLowerCase();

        if (ext === 'png') {
            charaData = await readTavernPNG(file);
            avatarBase64 = await wcCompressImage(file);
        } else if (ext === 'json') {
            const text = await file.text();
            charaData = JSON.parse(text);
        } else if (ext === 'txt') {
            const text = await file.text();
            charaData = { name: fileName.replace('.txt', ''), description: text };
        } else if (ext === 'docx') {
            const text = await readDocxFile(file);
            charaData = { name: fileName.replace('.docx', ''), description: text };
        }

        if (!charaData) throw new Error("无法识别的角色卡格式");

        const data = charaData.data || charaData;
        
        const name = data.name || "未知角色";
        const description = data.description || "";
        const personality = data.personality || "";
        const scenario = data.scenario || "";
        const mes_example = data.mes_example || "";
        const first_mes = data.first_mes || "";

        let promptParts = [];
        if (description) promptParts.push(`【角色设定】\n${description}`);
        if (personality) promptParts.push(`【性格特点】\n${personality}`);
        if (scenario) promptParts.push(`【当前场景】\n${scenario}`);
        if (mes_example) promptParts.push(`【对话示例】\n${mes_example}`);
        const finalPrompt = promptParts.join('\n\n');

        if (!avatarBase64) {
            const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#8E8E93"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="40">${name[0] || '?'}</text></svg>`;
            avatarBase64 = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(defaultAvatarSvg)));
        }

        const newChar = {
            id: Date.now(),
            name: name,
            note: name,
            prompt: finalPrompt,
            avatar: avatarBase64,
            isPinned: false
        };

        wcState.characters.push(newChar);
        await wcWriteCharactersPersistentSnapshot();
        try { await wcDb.put('characters', newChar); } catch (e) {}

        if (first_mes) {
            wcAddMessage(newChar.id, 'them', 'text', first_mes);
        }

        // 👇 核心：提取并自动导入世界书 (character_book) 👇
        let wbImportedCount = 0;
        if (data.character_book && data.character_book.entries && Array.isArray(data.character_book.entries)) {
            const groupName = `${name}的设定`;
            if (!worldbookGroups.includes(groupName)) worldbookGroups.push(groupName);
            
            data.character_book.entries.forEach(entry => {
                worldbookEntries.push({
                    id: Date.now() + Math.random(),
                    title: entry.name || (entry.keys && entry.keys[0]) || '未命名',
                    type: groupName,
                    keys: Array.isArray(entry.keys) ? entry.keys.join(', ') : (entry.keys || ''),
                    desc: entry.content || ''
                });
                wbImportedCount++;
            });
            await saveWorldbookData();
        }

        await wcSaveData();
        wcRenderAll();
        
        let successMsg = `成功导入角色：${name}`;
        if (wbImportedCount > 0) successMsg += `\n并自动提取了 ${wbImportedCount} 条世界书设定！`;
        wcShowSuccess(successMsg);

    } catch (error) {
        console.error("导入失败:", error);
        wcShowError("导入失败: " + error.message);
    } finally {
        event.target.value = ''; 
    }
}

// ==========================================
// 新增：世界书独立导入逻辑 (JSON/TXT/DOCX)
// ==========================================
async function handleWorldbookImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    wcShowLoading("正在导入世界书...");
    
    try {
        const fileName = file.name;
        const ext = fileName.split('.').pop().toLowerCase();
        const groupName = fileName.replace(`.${ext}`, '');
        let importedCount = 0;

        if (!worldbookGroups.includes(groupName)) {
            worldbookGroups.push(groupName);
        }

        if (ext === 'json') {
            const text = await file.text();
            const data = JSON.parse(text);
            // 兼容酒馆的 worldbook 或 character_book 格式
            const entries = data.entries || (data.character_book ? data.character_book.entries : null) || (data.data ? data.data.entries : null);
            
            if (entries && Array.isArray(entries)) {
                entries.forEach(entry => {
                    worldbookEntries.push({
                        id: Date.now() + Math.random(),
                        title: entry.name || (entry.keys && entry.keys[0]) || '未命名',
                        type: groupName,
                        keys: Array.isArray(entry.keys) ? entry.keys.join(', ') : (entry.keys || ''),
                        desc: entry.content || ''
                    });
                    importedCount++;
                });
            } else {
                throw new Error("未找到有效的 entries 数组，请确保是酒馆格式的世界书");
            }
        } else if (ext === 'txt' || ext === 'docx') {
            let text = '';
            if (ext === 'txt') text = await file.text();
            else if (ext === 'docx') text = await readDocxFile(file);
            
            // 纯文本作为一个大条目导入
            worldbookEntries.push({
                id: Date.now() + Math.random(),
                title: groupName,
                type: groupName,
                keys: groupName,
                desc: text
            });
            importedCount = 1;
        }

        await saveWorldbookData();
        
        // 刷新世界书视图
        renderWbEnvelopeList();
        
        wcShowSuccess(`成功导入 ${importedCount} 个世界书条目`);
    } catch (e) {
        console.error(e);
        wcShowError("导入失败: " + e.message);
    } finally {
        event.target.value = '';
    }
}

// 辅助函数：解析 PNG 中的 tEXt 块 (提取酒馆角色数据)
function readTavernPNG(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const buffer = e.target.result;
            const dataView = new DataView(buffer);
            const uint8Array = new Uint8Array(buffer);
            
            if (dataView.getUint32(0) !== 0x89504E47) return reject(new Error("不是有效的 PNG 文件"));

            let offset = 8;
            while (offset < uint8Array.length) {
                const length = dataView.getUint32(offset);
                const type = String.fromCharCode(uint8Array[offset + 4], uint8Array[offset + 5], uint8Array[offset + 6], uint8Array[offset + 7]);
                
                if (type === 'tEXt') {
                    const dataOffset = offset + 8;
                    let keyword = '';
                    let i = 0;
                    while (uint8Array[dataOffset + i] !== 0 && i < length) {
                        keyword += String.fromCharCode(uint8Array[dataOffset + i]);
                        i++;
                    }
                    
                    if (keyword === 'chara') {
                        const textData = new Uint8Array(buffer, dataOffset + i + 1, length - i - 1);
                        const text = new TextDecoder('utf-8').decode(textData);
                        try {
                            // 终极修复：将 Base64 转换为字节数组，再用 UTF-8 解码，完美兼容 Emoji 和中文
                            const binaryStr = atob(text);
                            const bytes = new Uint8Array(binaryStr.length);
                            for (let j = 0; j < binaryStr.length; j++) {
                                bytes[j] = binaryStr.charCodeAt(j);
                            }
                            const decodedText = new TextDecoder('utf-8').decode(bytes);
                            return resolve(JSON.parse(decodedText));
                        } catch (err) {
                            // 兜底：如果不是 Base64 格式，直接尝试解析原文本
                            try { 
                                return resolve(JSON.parse(text)); 
                            } catch(e) { 
                                return reject(new Error("解析角色数据失败")); 
                            }
                        }
                    }
                }
                offset += 12 + length;
            }
            reject(new Error("PNG 图片中未找到角色卡数据"));
        };
        reader.onerror = () => reject(new Error("读取文件失败"));
        reader.readAsArrayBuffer(file);
    });
}

async function wcSaveCharacter() {
    const name = document.getElementById('wc-input-char-name').value;
    const gender = document.getElementById('wc-input-char-gender').value.trim();
    const note = document.getElementById('wc-input-char-note').value;
    const prompt = document.getElementById('wc-input-char-prompt').value;
    if (!name) return alert('请输入角色名称');
    
    const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#8E8E93"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="40">${name[0]}</text></svg>`;
    const defaultAvatar = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(defaultAvatarSvg)));

    const newChar = {
        id: Date.now(), name: name, gender: gender, note: note, prompt: prompt,
        avatar: wcState.tempImage || defaultAvatar, isPinned: false
    };
    wcState.characters.push(newChar);
    await wcWriteCharactersPersistentSnapshot();
    try {
        await wcDb.put('characters', newChar);
    } catch (e) {
        console.warn('联系人写入 IndexedDB 失败，已保留本地兜底快照', e);
    }
    await wcSaveData();
    wcCloseModal('wc-modal-add-char');
    wcRenderAll();
}

function wcDeleteCharacter(id) {
    if(confirm('确定删除该角色吗？')) {
        wcState.characters = wcState.characters.filter(c => c.id !== id);
        delete wcState.chats[id];
        wcDb.delete('chats', id);
        wcDb.delete('characters', id);
        
        // 【新增】：如果删除的是当前绑定的恋人，自动解除恋人关系
        if (typeof lsState !== 'undefined' && lsState.boundCharId === id) {
            lsState.boundCharId = null;
            lsState.startDate = null;
            lsState.isLinked = false;
            lsState.feed = [];
            lsState.widgetEnabled = false;
            lsState.charWidgetEnabled = false;
            if (typeof lsSaveData === 'function') lsSaveData();
        }

        wcSaveData();
        wcRenderAll();
    }
}

function wcTogglePin(id) {
    const char = wcState.characters.find(c => c.id === id);
    if (char) {
        char.isPinned = !char.isPinned;
        wcSaveData();
        wcRenderChats();
    }
}

function wcShowPhoneContactDetail(contact) {
    currentPhoneContact = contact;
    document.getElementById('wc-card-contact-name').innerText = contact.name;
    
    const descEl = document.getElementById('wc-card-contact-desc');
    descEl.innerHTML = `${contact.desc || "暂无介绍"} <svg class="wc-icon" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:#007AFF;cursor:pointer;" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
    descEl.style.cursor = 'pointer';
    descEl.style.maxHeight = '120px';
    descEl.style.overflowY = 'auto';
    descEl.style.display = 'block';
    descEl.style.wordBreak = 'break-word';
    descEl.onclick = () => wcOpenContactDescEdit();
    
    const avatarEl = document.getElementById('wc-card-contact-avatar');
    avatarEl.style.background = 'transparent'; 
    
    const actionsContainer = document.getElementById('wc-card-contact-actions');
    actionsContainer.innerHTML = ''; // 清空旧按钮
    
    if (contact.isUser) {
        const char = wcState.characters.find(c => c.id === wcState.editingCharId);
        const userAvatar = (char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
        avatarEl.innerHTML = `<img src="${userAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
        actionsContainer.style.display = 'none';
    } else {
        let avatarUrl = contact.avatar || getRandomNpcAvatar();
        avatarEl.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`;
        actionsContainer.style.display = 'flex';
        
        // 判断是否为真实角色 (通过 realCharId 或 名字匹配)
        const isRealChar = contact.realCharId || wcState.characters.some(c => c.name === contact.name && !c.isGroup);
        
        // 发消息按钮
        actionsContainer.innerHTML += `<button class="wc-ios-btn-block" style="background: #07C160; color: white; height: 40px; font-size: 14px;" onclick="wcInitiateSimChat('${contact.id}')">发消息</button>`;
        
        // 只有纯 NPC 才显示“添加至列表”
        if (!isRealChar) {
            actionsContainer.innerHTML += `<button class="wc-ios-btn-block" style="background: #fff; color: #000; border: 1px solid #ddd; height: 40px; font-size: 14px;" onclick="wcShareContactToMain()">添加至列表</button>`;
        }
        
        actionsContainer.innerHTML += `<button class="wc-ios-btn-block" style="background: #fff; color: #000; border: 1px solid #ddd; height: 40px; font-size: 14px;" onclick="wcOpenShareCardModal()">分享名片</button>`;
        actionsContainer.innerHTML += `<button class="wc-ios-btn-block" style="background: transparent; color: #FA5151; height: 30px; font-size: 14px; margin-top: 5px;" onclick="wcDeletePhoneContact()">删除好友</button>`;
    }
    
    const modal = document.getElementById('wc-modal-phone-contact-card');
    
    // 👇 核心修复：解除卡片的高度限制，让它根据按钮数量自动拉伸，防止按钮被挤出屏幕外 👇
    const modalContent = modal.querySelector('.wc-modal-content');
    if (modalContent) {
        modalContent.style.height = 'auto';
        modalContent.style.minHeight = '360px';
    }
    // 👆 修复结束 👆

    modal.style.display = 'flex'; 
    wcOpenModal('wc-modal-phone-contact-card');
}

// ==========================================
// 新增：从通讯录主动发起聊天
// ==========================================
window.wcInitiateSimChat = function(contactId) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.contacts) return;
    
    const contact = char.phoneData.contacts.find(c => c.id == contactId);
    if (!contact) return;
    
    // 关闭联系人卡片弹窗
    wcCloseModal('wc-modal-phone-contact-card');
    
    // 查找是否已经有和这个人的聊天记录
    if (!char.phoneData.chats) char.phoneData.chats = [];
    let chat = char.phoneData.chats.find(c => c.name === contact.name);
    
    // 如果没有，就当场新建一个会话
    if (!chat) {
        chat = {
            id: Date.now() + Math.random(),
            name: contact.name,
            realCharId: contact.realCharId || null,
            avatar: contact.avatar,
            lastMsg: "",
            time: "",
            isGroup: contact.type === 'group',
            history: []
        };
        char.phoneData.chats.unshift(chat); // 放到聊天列表最前面
        wcSaveData();
        wcRenderPhoneChats(); // 刷新聊天列表 UI
    }
    
    // 切换到底部的“微信”Tab
    wcSwitchPhoneTab('chat');
    
    // 直接打开这个聊天窗口
    wcOpenSimChatDetailSaved(chat);
};

function wcOpenContactDescEdit() {
    if (!currentPhoneContact) return;
    let modal = document.getElementById('wc-modal-edit-contact-desc');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-modal-edit-contact-desc';
        modal.className = 'ios-alert-overlay';
        modal.innerHTML = `
            <div class="ios-alert-box" style="width: 300px;">
                <div class="ios-alert-title">编辑人设/简介</div>
                <div class="ios-alert-message" style="padding-bottom: 10px;">
                    <textarea id="wc-input-contact-desc" class="ios-textarea" style="height: 150px; width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; background: #fff;"></textarea>
                </div>
                <div style="display: flex; border-top: 0.5px solid rgba(60, 60, 67, 0.29);">
                    <button class="ios-alert-btn" style="flex: 1; border-right: 0.5px solid rgba(60, 60, 67, 0.29); color: #FF3B30;" onclick="document.getElementById('wc-modal-edit-contact-desc').classList.remove('active')">取消</button>
                    <button class="ios-alert-btn" style="flex: 1; font-weight: bold;" onclick="wcSaveContactDesc()">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('wc-input-contact-desc').value = currentPhoneContact.desc || '';
    modal.classList.add('active');
}

function wcSaveContactDesc() {
    if (!currentPhoneContact) return;
    const newDesc = document.getElementById('wc-input-contact-desc').value.trim();
    currentPhoneContact.desc = newDesc;
    
    const descEl = document.getElementById('wc-card-contact-desc');
    descEl.innerHTML = `${newDesc || "暂无介绍"} <svg class="wc-icon" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:#007AFF;cursor:pointer;" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
    
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (char && char.phoneData) {
        if (char.phoneData.contacts) {
            const contact = char.phoneData.contacts.find(c => c.id === currentPhoneContact.id);
            if (contact) contact.desc = newDesc;
        }
        if (char.phoneData.chats) {
            const chat = char.phoneData.chats.find(c => c.name === currentPhoneContact.name);
            if (chat) chat.desc = newDesc;
        }
        wcSaveData();
    }
    
    document.getElementById('wc-modal-edit-contact-desc').classList.remove('active');
    wcRenderPhoneContacts();
}

function wcShowCharDetail(id) {
    const char = wcState.characters.find(c => c.id === id);
    if (!char) return;
    wcState.editingCharId = id;
    
    document.getElementById('wc-detail-char-avatar').src = char.avatar;
    document.getElementById('wc-detail-char-name').innerText = char.name;
    document.getElementById('wc-detail-char-note').innerText = char.note || "暂无备注";
    
    // 格式化创建时间 (因为角色的 ID 就是创建时的时间戳)
    const d = new Date(char.id);
    const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    
    // 计算陪伴天数
    const now = Date.now();
    const days = Math.max(1, Math.ceil((now - char.id) / (1000 * 60 * 60 * 24))); 
    
    // 👈 核心修改：将天数拼接到 ID 后面
    const idEl = document.getElementById('wc-detail-char-id');
    if (idEl) {
        idEl.innerText = `ID No.${dateStr}-${days}`;
    }

    // 获取该角色的聊天记录数组长度
    const msgsCount = wcState.chats[id] ? wcState.chats[id].length : 0;
    const msgsEl = document.getElementById('wc-detail-char-msgs');
    if (msgsEl) msgsEl.innerText = msgsCount;
    
    const checkPhoneBtn = document.getElementById('wc-detail-check-phone-btn');
    if (checkPhoneBtn) {
        checkPhoneBtn.style.display = char.isGroup ? 'none' : 'flex';
    }
    
    wcOpenModal('wc-modal-char-detail');
}

function wcCheckPhoneAction() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (char && char.isGroup) {
        alert("群聊无法查看手机哦~");
        return;
    }
    wcCloseModal('wc-modal-char-detail');
    wcOpenPhoneSim();
}

function wcOpenEditCharSettings() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;
    wcState.tempImage = '';
    document.getElementById('wc-edit-char-avatar').src = char.avatar;
    document.getElementById('wc-edit-char-name').value = char.name;
    document.getElementById('wc-edit-char-gender').value = char.gender || '';
    document.getElementById('wc-edit-char-note').value = char.note;
    document.getElementById('wc-edit-char-prompt').value = char.prompt;
    wcOpenModal('wc-modal-edit-char-settings');
}

async function wcUpdateCharacter() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;
    char.name = document.getElementById('wc-edit-char-name').value;
    char.gender = document.getElementById('wc-edit-char-gender').value.trim();
    char.note = document.getElementById('wc-edit-char-note').value;
    char.prompt = document.getElementById('wc-edit-char-prompt').value;
    if (wcState.tempImage && wcState.tempImageType === 'edit-char') char.avatar = wcState.tempImage;
    await wcWriteCharactersPersistentSnapshot();
    try {
        await wcDb.put('characters', char);
    } catch (e) {
        console.warn('联系人更新写入 IndexedDB 失败，已保留本地兜底快照', e);
    }
    await wcSaveData();
    wcCloseModal('wc-modal-edit-char-settings');
    document.getElementById('wc-detail-char-avatar').src = char.avatar;
    document.getElementById('wc-detail-char-name').innerText = char.name;
    document.getElementById('wc-detail-char-note').innerText = char.note || "暂无备注";
    wcRenderAll();
}

// --- WeChat Phone Sim ---
function wcOpenPhoneSim() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;
    const sim = document.getElementById('wc-view-phone-sim');
    sim.classList.add('active');
    const screenBg = document.getElementById('wc-phone-screen-bg');
        if (char.phoneConfig && char.phoneConfig.wallpaper) {
        screenBg.style.backgroundImage = `url('${char.phoneConfig.wallpaper}')`;
    } else {    
        screenBg.style.backgroundImage = 'none';
    }
    
    // 👇 新增：设置底部导航栏中间的头像
    const centerAvatar = document.getElementById('sim-wechat-center-avatar');
    if (centerAvatar) {
        centerAvatar.src = char.avatar;
    }
    
    const noteBg = document.getElementById('wc-sticky-note-bg');
    if (char.phoneConfig && char.phoneConfig.stickyNote) {
        noteBg.style.backgroundImage = `url(${char.phoneConfig.stickyNote})`;
    } else {
        noteBg.style.backgroundImage = 'none';
    }

    const icons = char.phoneConfig && char.phoneConfig.icons ? char.phoneConfig.icons : {};
    ['msg', 'browser', 'cart', 'settings', 'video', 'exit', 'files'].forEach(id => {
        const iconEl = document.getElementById(`wc-icon-${id === 'msg' ? 'message' : id}`);
        if (iconEl && icons[id]) iconEl.innerHTML = `<img src="${icons[id]}">`;
    });
    
    // 渲染对方桌面小组件 (仅当是绑定的恋人时)
    const isLover = lsState.isLinked && lsState.boundCharId === char.id;
    const widget = document.getElementById('wc-phone-lovers-widget');
    if (widget) {
        widget.style.display = (isLover && lsState.charWidgetEnabled) ? 'flex' : 'none';
        if (isLover && lsState.charWidgetEnabled) {
            wcRenderCharWidget();
        }
    }
    
    wcStartPhoneClock();
    
    document.getElementById('wc-phone-fingerprint-btn').style.display = 'none';
    document.getElementById('wc-phone-sticky-note').style.display = 'flex';
}

function wcStartPhoneClock() {
    wcUpdatePhoneClock();
    wcState.phoneClockInterval = setInterval(wcUpdatePhoneClock, 1000);
}

function wcStopPhoneClock() {
    if (wcState.phoneClockInterval) clearInterval(wcState.phoneClockInterval);
}

function wcUpdatePhoneClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('wc-sim-clock-time').innerText = `${hours}:${minutes}`;
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    document.getElementById('wc-sim-clock-date').innerText = `${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]}`;
}

function wcOpenPhoneSettings() {
    wcState.tempPhoneConfig = {};
    document.getElementById('wc-preview-phone-bg').style.display = 'none';
    document.getElementById('wc-text-phone-bg').style.display = 'block';
    document.getElementById('wc-preview-sticky-note').style.display = 'none';
    document.getElementById('wc-text-sticky-note').style.display = 'block';
    ['msg', 'browser', 'cart', 'settings', 'video', 'exit', 'files'].forEach(id => {
        const previewEl = document.getElementById(`wc-preview-icon-${id}`);
        if (previewEl) previewEl.style.display = 'none';
    });
    
    const modal = document.getElementById('wc-modal-phone-settings');
    modal.classList.remove('hidden');
    modal.classList.add('active');
    modal.style.zIndex = '20001'; 
    wcRenderPhonePresets(); // 【新增】：打开手机装修时渲染预设列表
}

function wcSavePhoneSettings() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;
    if (!char.phoneConfig) char.phoneConfig = {};
    if (wcState.tempPhoneConfig.wallpaper) char.phoneConfig.wallpaper = wcState.tempPhoneConfig.wallpaper;
    if (wcState.tempPhoneConfig.stickyNote) char.phoneConfig.stickyNote = wcState.tempPhoneConfig.stickyNote;
    if (wcState.tempPhoneConfig.icons) {
        if (!char.phoneConfig.icons) char.phoneConfig.icons = {};
        Object.assign(char.phoneConfig.icons, wcState.tempPhoneConfig.icons);
    }
    wcSaveData();
    wcCloseModal('wc-modal-phone-settings');
    
    const screenBg = document.getElementById('wc-phone-screen-bg');
    if (char.phoneConfig.wallpaper) screenBg.style.backgroundImage = `url('${char.phoneConfig.wallpaper}')`;
    
    const noteBg = document.getElementById('wc-sticky-note-bg');
    if (char.phoneConfig.stickyNote) noteBg.style.backgroundImage = `url('${char.phoneConfig.stickyNote}')`;
   
    const icons = char.phoneConfig.icons || {};
    ['msg', 'browser', 'cart', 'settings', 'video', 'exit', 'files'].forEach(id => {
        const iconEl = document.getElementById(`wc-icon-${id === 'msg' ? 'message' : id}`);
        if (iconEl && icons[id]) iconEl.innerHTML = `<img src="${icons[id]}">`;
    });
}

function wcOpenPhoneApp(appName) {
    if (appName === 'message') {
        document.getElementById('wc-phone-app-message').style.display = 'flex';
        wcSwitchPhoneTab('chat');
        } else if (appName === 'settings') {
            document.getElementById('wc-phone-app-settings').style.display = 'flex';
            
            // 设置顶部头像和背景
            const char = wcState.characters.find(c => c.id === wcState.editingCharId);
            if (char) {
                document.getElementById('sim-profile-avatar').src = char.avatar;
                document.getElementById('sim-profile-name').innerText = char.name;
                
                // 👇 修改：彻底去除顶部背景图，让其保持透明 👇
                document.getElementById('sim-profile-header').style.backgroundImage = 'none';
                document.getElementById('sim-profile-header').style.backgroundColor = 'transparent';
            }
            
            wcGeneratePhoneSettings(true); 
        }
 else if (appName === 'browser') {
        document.getElementById('wc-phone-app-browser').style.display = 'flex';
        wcRenderPhoneBrowserContent();
    } else if (appName === 'cart') { // <--- 新增这一段
        document.getElementById('wc-phone-app-cart').style.display = 'flex';
        wcState.phoneCartTab = 'cart'; // 默认打开购物车
        wcRenderPhoneCartContent();
    } else if (appName === 'files') { // 👇 新增：打开文件管理
        document.getElementById('wc-phone-app-files').style.display = 'flex';
        const char = wcState.characters.find(c => c.id === wcState.editingCharId);
        if (char) {
            const avatarEl = document.getElementById('fm-user-avatar');
            const nameEl = document.getElementById('fm-user-name');
            if (avatarEl) avatarEl.innerHTML = `<img src="${char.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            if (nameEl) nameEl.innerText = `Hello, ${char.name}!`;
        }
        // 每次打开时渲染数据
        if (typeof wcRenderPhoneFilesContent === 'function') {
            wcRenderPhoneFilesContent();
        }
    }
    document.getElementById('wc-phone-fingerprint-btn').style.display = 'none';
    document.getElementById('wc-phone-sticky-note').style.display = 'none';
    // 隐藏 Dock 栏
    const dock = document.getElementById('wc-phone-dock');
    if (dock) dock.style.display = 'none';
}

// 找到 wcClosePhoneApp 函数，替换为以下代码：
function wcClosePhoneApp() {
    document.getElementById('wc-phone-app-message').style.display = 'none';
    document.getElementById('wc-phone-app-settings').style.display = 'none';
    document.getElementById('wc-phone-app-privacy').style.display = 'none';
    
    const favApp = document.getElementById('wc-phone-app-favorites');
    if(favApp) favApp.style.display = 'none';
    const browserApp = document.getElementById('wc-phone-app-browser');
    if(browserApp) browserApp.style.display = 'none';
    
    // 👇 新增这一段：关闭钱包页面
    const walletApp = document.getElementById('wc-phone-app-wallet');
    if(walletApp) walletApp.style.display = 'none';
    
    document.getElementById('wc-phone-fingerprint-btn').style.display = 'flex';

    // 👇 新增这一段：关闭手机模拟器里的购物车页面
    const cartApp = document.getElementById('wc-phone-app-cart');
    if(cartApp) cartApp.style.display = 'none';
    
    // 👇 新增：关闭文件管理页面
    const filesApp = document.getElementById('wc-phone-app-files');
    if(filesApp) filesApp.style.display = 'none';
    
    document.getElementById('wc-phone-fingerprint-btn').style.display = 'none'; // 保持隐藏
    document.getElementById('wc-phone-sticky-note').style.display = 'flex';
    // 恢复 Dock 栏
    const dock = document.getElementById('wc-phone-dock');
    if (dock) dock.style.display = 'flex';
}

// 找到 wcClosePhoneSim 函数，替换为以下代码：
function wcClosePhoneSim() {
    document.getElementById('wc-view-phone-sim').classList.remove('active');
    document.getElementById('wc-phone-app-message').style.display = 'none';
    document.getElementById('wc-phone-app-settings').style.display = 'none';
    document.getElementById('wc-phone-app-privacy').style.display = 'none';
    
    const favApp = document.getElementById('wc-phone-app-favorites');
    if(favApp) favApp.style.display = 'none';
    const browserApp = document.getElementById('wc-phone-app-browser');
    if(browserApp) browserApp.style.display = 'none';

    const cartApp = document.getElementById('wc-phone-app-cart');
    if(cartApp) cartApp.style.display = 'none';

    // 👇 新增这一段：确保彻底退出手机模拟器时，钱包也被重置隐藏
    const walletApp = document.getElementById('wc-phone-app-wallet');
    if(walletApp) walletApp.style.display = 'none';

    wcStopPhoneClock();
}

// --- Phone App Navigation ---

function wcSwitchPhoneTab(tab) {
    wcState.phoneAppTab = tab;
    
    document.querySelectorAll('.sim-wechat-nav-item, .sim-wechat-nav-center').forEach(t => t.classList.remove('active'));
    document.getElementById(`wc-phone-tab-${tab}`).classList.add('active');

    const rightBtn = document.getElementById('sim-wechat-header-right-btn');
    const searchBar = document.getElementById('sim-wechat-search-bar');
    const content = document.getElementById('wc-phone-app-content');
    
    content.innerHTML = '';

    if (tab === 'chat') {
        searchBar.style.display = 'flex';
        rightBtn.innerHTML = `<div class="sim-wechat-header-icon" onclick="wcConfirmGenerateChats()"></div>`;
        wcRenderPhoneChats();
    } else if (tab === 'contacts') {
        searchBar.style.display = 'flex';
        rightBtn.innerHTML = `<div class="sim-wechat-header-icon" onclick="wcOpenPhoneContactsGenModal()"></div>`;
        wcRenderPhoneContacts();
    } else if (tab === 'me') {
        searchBar.style.display = 'none'; // 个人主页隐藏搜索栏
        rightBtn.innerHTML = `<div class="sim-wechat-header-icon" onclick="wcGeneratePrivacyAndFavorites()"></div>`;
        wcRenderPhoneMe();
    }
}

function wcRenderPhoneMe() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const content = document.getElementById('wc-phone-app-content');
    if (!char) return;

    const profile = char.phoneData && char.phoneData.profile ? char.phoneData.profile : { nickname: char.name, sign: "暂无签名" };

    content.innerHTML = `
        <div style="background: #fff; padding: 30px 20px; display: flex; align-items: center; margin-bottom: 10px
;">
            <img src="${char.avatar}" style="width: 64px; height: 64px; border-radius: 8px; margin-right: 16px; object-fit: cover;">
            <div style="flex: 1;">
                <div style="font-size: 20px; font-weight: 600; margin-bottom: 4px;">${profile.nickname}</div>
                <div style="font-size: 14px; color: #888;">微信号: wxid_${char.id.toString().substring(0,8)}</div>
                <div style="font-size: 13px; color: #888; margin-top: 4px;">个性签名: ${profile.sign}</div>
            </div>
        </div>
        
        <div class="wc-list-group" style="margin: 0;">
            <div class="wc-list-item" onclick="wcOpenPhoneWallet()" style="background: #fff; border-bottom: 0.5px solid #E5E5EA;">
                <svg class="wc-icon" style="margin-right: 10px; color: #FA9D3B;" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                <div class="wc-item-content">
                    <div class="wc-item-title">支付</div>
                </div>
                <svg class="chevron-right" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        </div>
        
        <div class="wc-list-group" style="margin-top: 10px;">
            <!-- 新增：收藏 -->
            <div class="wc-list-item" onclick="wcOpenPhoneFavorites()" style="background: #fff; border-bottom: 0.5px solid #E5E5EA;">
                <svg class="wc-icon" style="margin-right: 10px; color: #FFC107;" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                <div class="wc-item-content">
                    <div class="wc-item-title">收藏</div>
                </div>
                <svg class="chevron-right" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
            <div class="wc-list-item" onclick="wcOpenPhonePrivacy()" style="background: #fff; border-bottom: 0.5px solid #E5E5EA;">
                <svg class="wc-icon" style="margin-right: 10px; color: #007AFF;" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <div class="wc-item-content">
                    <div class="wc-item-title">隐私</div>
                </div>
                <svg class="chevron-right" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
            <!-- 👇 修改：给设置项加上 onclick 事件和 cursor: pointer 👇 -->
            <div class="wc-list-item" onclick="wcConfirmGenerateAllPhoneData()" style="background: #fff; cursor: pointer;">
                <svg class="wc-icon" style="margin-right: 10px; color: #8E8E93;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                <div class="wc-item-content">
                    <div class="wc-item-title">设置</div>
                </div>
                <svg class="chevron-right" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
            <!-- 👆 修改结束 👆 -->
        </div>
    `;
}

// --- Phone Privacy Logic (New) ---
function wcOpenPhonePrivacy() {
    document.getElementById('wc-phone-app-privacy').style.display = 'flex';
    wcRenderPhonePrivacyContent();
}

function wcClosePhonePrivacy() {
    document.getElementById('wc-phone-app-privacy').style.display = 'none';
}

function wcRenderPhonePrivacyContent() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const content = document.getElementById('wc-phone-privacy-content');
    if (!char) return;

    const privacyData = (char.phoneData && char.phoneData.privacy) ? char.phoneData.privacy : null;

    if (!privacyData) {
        content.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #8E8E93; font-size: 14px;">点击左上角「刷新」<br>偷偷查看 Ta 的私密记录...</div>';
        return;
    }

    let masturbationData = null;
    let wetDreamData = null;

    if (privacyData.masturbation || privacyData.wetDream) {
        masturbationData = privacyData.masturbation;
        wetDreamData = privacyData.wetDream;
    } else if (privacyData.time && privacyData.action) {
        masturbationData = privacyData; 
    }

    let html = '';

    if (masturbationData) {
        const sigM = getFavSignature('masturbation', '私密记录', masturbationData.time || '', `[状态] ${masturbationData.status || '无'}\n[动作] ${masturbationData.action || '无'}\n[感受] ${masturbationData.feeling || '无'}`);
        const isFavM = wcState.myFavorites && wcState.myFavorites.some(f => f.sig === sigM);
        
        html += `
            <div style="background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); position: relative;">
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #FF3B30; display: flex; align-items: center; gap: 8px;">
                    <svg class="wc-icon" viewBox="0 0 24 24" style="width: 20px; height: 20px; stroke: currentColor;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    自慰记录
                </div>
                <div style="margin-bottom: 12px; padding-right: 60px;">
                    <span style="font-size: 13px; color: #8E8E93;">时间：</span>
                    <span style="font-size: 15px; color: #333;">${masturbationData.time || '未知'}</span>
                </div>
                <div style="margin-bottom: 12px;">
                    <span style="font-size: 13px; color: #8E8E93;">状态：</span>
                    <span style="font-size: 15px; color: #333;">${masturbationData.status || '未知'}</span>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 13px; color: #8E8E93; margin-bottom: 4px;">动作描述：</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.5; background: #F9F9F9; padding: 10px; border-radius: 8px;">${masturbationData.action || '无'}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: #8E8E93; margin-bottom: 4px;">内心感受：</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.5; background: #F9F9F9; padding: 10px; border-radius: 8px;">${masturbationData.feeling || '无'}</div>
                </div>
                <!-- 收藏按钮 -->
                <div onclick="wcToggleFavorite(event, 'masturbation', 0)" style="position: absolute; top: 20px; right: 56px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${isFavM ? '#111' : '#CCC'}; cursor: pointer; transition: all 0.2s;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: ${isFavM ? 'currentColor' : 'none'}; stroke: currentColor; stroke-width: 2;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <!-- 分享按钮 -->
                <div onclick="wcTriggerShare(event, 'masturbation', 0)" style="position: absolute; top: 20px; right: 20px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #111; cursor: pointer; transition: background 0.2s;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                </div>
            </div>
        `;
    }

    if (wetDreamData) {
        const sigW = getFavSignature('wetDream', '春梦记录', wetDreamData.time || '', `[状态] ${wetDreamData.status || '无'}\n[梦境] ${wetDreamData.dream || '无'}\n[感受] ${wetDreamData.feeling || '无'}`);
        const isFavW = wcState.myFavorites && wcState.myFavorites.some(f => f.sig === sigW);

        html += `
            <div style="background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); position: relative;">
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #9C27B0; display: flex; align-items: center; gap: 8px;">
                    <svg class="wc-icon" viewBox="0 0 24 24" style="width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    春梦记录
                </div>
                <div style="margin-bottom: 12px; padding-right: 60px;">
                    <span style="font-size: 13px; color: #8E8E93;">时间：</span>
                    <span style="font-size: 15px; color: #333;">${wetDreamData.time || '未知'}</span>
                </div>
                <div style="margin-bottom: 12px;">
                    <span style="font-size: 13px; color: #8E8E93;">状态：</span>
                    <span style="font-size: 15px; color: #333;">${wetDreamData.status || '未知'}</span>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 13px; color: #8E8E93; margin-bottom: 4px;">梦境描述：</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.5; background: #F3E5F5; padding: 10px; border-radius: 8px;">${wetDreamData.dream || '无'}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: #8E8E93; margin-bottom: 4px;">内心感受：</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.5; background: #F3E5F5; padding: 10px; border-radius: 8px;">${wetDreamData.feeling || '无'}</div>
                </div>
                <!-- 收藏按钮 -->
                <div onclick="wcToggleFavorite(event, 'wetDream', 0)" style="position: absolute; top: 20px; right: 56px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${isFavW ? '#111' : '#CCC'}; cursor: pointer; transition: all 0.2s;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: ${isFavW ? 'currentColor' : 'none'}; stroke: currentColor; stroke-width: 2;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <!-- 分享按钮 -->
                <div onclick="wcTriggerShare(event, 'wetDream', 0)" style="position: absolute; top: 20px; right: 20px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #111; cursor: pointer; transition: background 0.2s;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                </div>
            </div>
        `;
    }

    content.innerHTML = html;
}
// ==========================================
// 辅助函数：获取角色生活状态提示词
// ==========================================
function getLifeStatusPrompt(char) {
    if (!char || !char.lifeStatus || char.lifeStatus.location === "未知") return "";
    if (char.chatConfig && char.chatConfig.lifeStatusEnabled === false) return "";
    let text = `\n【当前生活状态参考 (请让生成的内容符合此状态，增强真实感)】：\n`;
    text += `- 当前位置：${char.lifeStatus.location}\n`;
    text += `- 正在做的事：${char.lifeStatus.action}\n`;
    text += `- 当前心情/状态：${char.lifeStatus.mood}\n`;
    if (char.lifeStatus.timeline && char.lifeStatus.timeline.length > 0) {
        text += `- 今日行程：\n` + char.lifeStatus.timeline.map(t => `  [${t.time}] ${t.content}`).join('\n') + `\n`;
    }
    return text;
}

async function wcGeneratePhonePrivacy() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在破解私密空间...");

    try {
        const realMsgs = wcState.chats[char.id] || [];
        const recentMsgs = realMsgs.slice(-30).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');
        const chatConfig = char.chatConfig || {};
        const userName = chatConfig.userName || wcState.user.name;
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";

        // 核心修复：只读取关联的世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        const now = new Date();
        const timeString = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
        const timePrompt = `\n【绝对时间基准】：当前现实时间是 ${timeString} ${dayString}。你生成的所有数据（包括时间戳、事件状态等）必须严格符合这个当前时间！绝对不能出现未来的时间，且早中晚的逻辑必须自洽。\n`;

        const lifeStatusPrompt = getLifeStatusPrompt(char); // 新增

        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += timePrompt;
        prompt += `人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(${userName})设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; // 新增
        if (chatConfig.bilingualEnabled) {
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：虽然聊天记录中包含外语，但你生成的手机内部所有数据（如状态、动作、感受等）必须全部使用 ${targetLang}！绝对不要使用双语格式！\n`;
        }
        prompt += `【核心场景设定】：我（${userName}）现在正在偷偷查看你（${char.name}）手机上的私密记录APP。\n`;
        prompt += `【最近我们的聊天记录（20-30条）】：\n${recentMsgs}\n\n`;
        
        prompt += `请基于你的人设、我的设定，以及我们**最近的聊天上下文**，生成你最近的【私密自慰记录】和【春梦记录】。\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 内容必须高度贴合最近的聊天内容（例如：如果聊天中我在欺负你，你的记录里可能会充满委屈和渴望；如果我们在暧昧，记录里可能满脑子都是我）。\n`;
        prompt += `2. 描写要富有沉浸感、细腻、符合角色性格。\n`;
        prompt += `3. 返回纯 JSON 对象，包含 "masturbation" 和 "wetDream" 两个部分，格式如下：\n`;
        prompt += `{
          "masturbation": {
            "time": "昨晚深夜 / 刚刚",
            "status": "简短的状态概括，如：极度渴望、边哭边弄等",
            "action": "具体的动作描述，你是如何触碰自己的，用了什么物品，或者看着什么东西（比如我的照片/聊天记录）",
            "feeling": "详细的内心感受，对${userName}的情感，身体的反应等"
          },
          "wetDream": {
            "time": "前天夜里 / 昨晚",
            "status": "梦醒后的状态，如：满头大汗、内裤湿透、回味无穷等",
            "dream": "梦境的具体描述，梦里${userName}对你做了什么，场景是怎样的",
            "feeling": "醒来后的内心感受，羞耻、渴望还是空虚"
          }
        }\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                 temperature: parseFloat(apiConfig.temp) || 0.8,
                 max_tokens: 4000
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。");
        }

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let privacyData;
        try {
            privacyData = JSON.parse(content);
        } catch (parseErr) {
            throw new Error("AI 返回的 JSON 格式错误，请重试。返回内容：" + content.substring(0, 50) + "...");
        }

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.privacy = privacyData;
        wcSaveData();

        wcRenderPhonePrivacyContent();
        wcShowSuccess("破解成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[查手机生成失败] ${e.message}`);
        } else {
            wcShowError("生成失败");
        }
    }
}

function wcOpenPhoneWallet() {
    document.getElementById('wc-phone-app-wallet').style.display = 'flex';
    wcRenderPhoneWalletContent();
}

function wcClosePhoneWallet() {
    document.getElementById('wc-phone-app-wallet').style.display = 'none';
}

function wcRenderPhoneWalletContent() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const content = document.getElementById('wc-phone-wallet-content');
    if (!char) return;

    const wallet = (char.phoneData && char.phoneData.wallet) ? char.phoneData.wallet : { balance: 0.00, transactions: [] };

    // 渲染交易记录 HTML
    let transHtml = '';
    if (wallet.transactions && wallet.transactions.length > 0) {
        wallet.transactions.forEach(t => {
            const isIncome = t.type === 'income';
            const sign = isIncome ? '+' : '-';
            const colorClass = isIncome ? 'in' : 'out';
            transHtml += `
                <div class="rcpt-trans-item">
                    <div class="rcpt-trans-info">
                        <div class="rcpt-trans-title">${t.note}</div>
                        <div class="rcpt-trans-time">${t.time}</div>
                    </div>
                    <div class="rcpt-trans-amount ${colorClass}">${sign}${parseFloat(t.amount).toFixed(2)}</div>
                </div>
            `;
        });
    } else {
        transHtml = '<div style="text-align: center; color: #8E8E93; font-size: 12px; padding: 10px 0;">暂无交易记录</div>';
    }

    // 注入全新的票据 UI，头像和名字跟随 Char，包含底部三个按钮
    content.innerHTML = `
        <div class="rcpt-ui-container">
            <div class="rcpt-ui-card-top">
                <div class="rcpt-ui-avatar-ring">
                    <img src="${char.avatar}" alt="avatar">
                </div>
                <div class="rcpt-ui-name">${char.name}</div>
                <div class="rcpt-ui-subtitle">WeChat Pay</div>
                <div class="rcpt-ui-status">ACTIVE</div>
            </div>
            
            <div class="rcpt-ui-paper">
                <div class="rcpt-trans-list">
                    ${transHtml}
                </div>
                
                <div class="rcpt-ui-divider"></div>
                <div class="rcpt-ui-row total">
                    <span class="label">Balance</span>
                    <span class="value">¥${parseFloat(wallet.balance).toFixed(2)}</span>
                </div>
            </div>
            
            <!-- 底部三个交互按钮 -->
            <div class="rcpt-action-bar">
                <!-- 左：占位 (不可点击) -->
                <button class="rcpt-circle-btn disabled">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </button>
                <!-- 中：退出页面 -->
                <button class="rcpt-circle-btn main" onclick="wcClosePhoneWallet()" title="退出">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <!-- 右：生成交易记录 -->
                <button class="rcpt-circle-btn" onclick="wcGenerateCharWallet()" title="刷新账单">
                    <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                </button>
            </div>
        </div>
    `;
}

async function wcGenerateCharWallet() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    // 检查限制
    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在生成钱包数据...");

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        
        // 核心修复：只读取关联的世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-20).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');

        const now = new Date();
        const timeString = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
        const timePrompt = `\n【绝对时间基准】：当前现实时间是 ${timeString} ${dayString}。你生成的交易记录时间(time)必须在当前时间之前，且符合常理（如凌晨3点通常不会有早餐店消费）。\n`;

        const lifeStatusPrompt = getLifeStatusPrompt(char); // 新增

        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += timePrompt;
        prompt += `人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; 
        if (chatConfig.bilingualEnabled) {
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：虽然聊天记录中包含外语，但你生成的手机内部所有数据（如备注、明细等）必须全部使用 ${targetLang}！绝对不要使用双语格式！\n`;
        }
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        
        prompt += `请根据角色的人设、当前生活状态以及聊天记录，生成该角色的微信钱包数据。\n`;
        prompt += `【核心要求（极具活人感与强因果逻辑）】：\n`;
        prompt += `1. 【反模板化警告】：绝对禁止生成随机的、毫无逻辑的账单！\n`;
        prompt += `2. 账单必须是【今日行程】和【聊天记录】的直接体现！如果行程里写了“在便利店买水”，账单里就必须有便利店的支出；如果聊天里说“刚打车回家”，就必须有打车费。\n`;
        prompt += `3. 生成 5 到 10 条最近的交易记录 (transactions)。时间线必须与行程记录完美吻合！\n`;
        prompt += `4. 备注(note)必须极其具体，带有强烈的画面感或真实的内心吐槽（例如：“和User去吃的那家超贵的日料”、“下雨天溢价的打车费”）。\n`;
        prompt += `【内在逻辑要求】：在生成 JSON 之前，请确保你的内部推演包含：\n`;
        prompt += `1. 逐条分析【今日行程】和【聊天记录】，把里面提到的活动转化为具体的消费金额。\n`;
        prompt += `2. 确保账单的时间(time)与事件发生的时间逻辑一致。\n`;
        prompt += `推演结束后，直接返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "balance": 1234.56,
  "transactions": [
    {"type": "expense", "amount": 25.50, "note": "具体的消费备注", "time": "10-23 02:15"},
    {"type": "income", "amount": 5000.00, "note": "收入备注", "time": "10-15 10:00"}
  ]
}\n`;
        prompt += `注意：type 只能是 'income' (收入) 或 'expense' (支出)。time 格式为简短日期。\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 4000
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。");
        }

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let walletData;
        try {
            walletData = JSON.parse(content);
        } catch (parseErr) {
            throw new Error("AI 返回的 JSON 格式错误，请重试。返回内容：" + content.substring(0, 50) + "...");
        }

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.wallet = walletData;
        wcSaveData();

        wcRenderPhoneWalletContent();
        wcShowSuccess("钱包生成成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[钱包生成失败] ${e.message}`);
        } else {
            wcShowError("生成失败");
        }
    }
}

// --- Phone Settings Logic ---
async function wcGeneratePhoneSettings(renderOnly = false) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const content = document.getElementById('wc-phone-settings-content');
    if (!char) return;

    if (renderOnly) {
        const settings = char.phoneData && char.phoneData.settings ? char.phoneData.settings : { battery: 80, screenTime: "4小时20分", appUsage: [], locations: [], playlist: [] };
        renderSettingsUI(settings);
        return;
    }

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    // 检查限制
    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在生成手机状态与歌单...");

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-15).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');

        // 核心修复：只读取关联的世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeString = `${year}年${month}月${date}日 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];

        const lifeStatusPrompt = getLifeStatusPrompt(char); // 新增

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【当前现实时间】：${timeString} ${dayString}\n请务必具备时间观念，生成的行程和应用使用情况必须符合当前的时间点。\n\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; 
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `请根据角色的人设、当前生活状态以及最近的聊天内容，生成该角色当前的手机状态数据。\n`;
        prompt += `【核心要求（极具活人感与强因果逻辑）】：\n`;
        prompt += `1. "battery": 当前电量。如果现在是深夜且Ta一直在和你聊天，电量应该偏低。\n`;
        prompt += `2. "appUsage": 5到15个应用的今日使用时长。必须映射【今日行程】！如果行程里在打游戏，游戏APP时长就高；如果在外面跑，导航APP时长就高。\n`;
        prompt += `3. "locations": 5到10个今日的行程记录。必须与传入的【当前生活状态参考】中的行程保持一致，并在此基础上进行细节扩写和吐槽(desc)。\n`;
        prompt += `4. "playlists": 2到4个歌单。每个歌单包含名称(name)、封面描述(coverDesc)、符合该角色人设的歌单总歌曲数(totalCount，例如热爱音乐的人可能有几百首，不怎么听歌的人可能只有十几首)、以及【固定10首】真实存在的初始歌曲(tracks)。必须完美契合Ta今天的心情(mood)和聊天氛围！\n`;
        prompt += `【内在逻辑要求】：在生成 JSON 之前，请确保你的内部推演包含：\n`;
        prompt += `1. 分析【当前生活状态】和【聊天记录】，确定今天的主基调（忙碌、悠闲、伤心、甜蜜）。\n`;
        prompt += `2. 根据主基调，推断手机电量、APP使用偏好和听歌品味。\n`;
        prompt += `推演结束后，直接返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "battery": 12,
  "screenTime": "11小时30分",
  "appUsage": [
    {"name": "APP名称", "time": "4小时"}
  ],
  "locations": [
    {"time": "02:00", "place": "地点", "desc": "具体的动作和吐槽"}
  ],
  "playlists": [
    {
      "name": "歌单名称",
      "coverDesc": "深蓝色忧郁",
      "totalCount": 128,
      "tracks": [
        {"title": "歌名", "artist": "歌手"}
      ]
    }
  ]
}`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 4000
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。");
        }

        let contentStr = data.choices[0].message.content;
        contentStr = contentStr.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        contentStr = contentStr.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let settingsData;
        try {
            settingsData = JSON.parse(contentStr);
        } catch (parseErr) {
            throw new Error("AI 返回的 JSON 格式错误，请重试。返回内容：" + contentStr.substring(0, 50) + "...");
        }

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.settings = settingsData;
        wcSaveData();
        renderSettingsUI(settingsData);
        wcShowSuccess("状态更新成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[状态生成失败] ${e.message}`);
        } else {
            wcShowError("生成失败");
        }
    }
}

function renderSettingsUI(data) {
    const content = document.getElementById('wc-phone-settings-content');
    
    let statusHtml = `
        <div id="wc-settings-tab-status" style="display: block;">
            <div class="sim-info-card">
                <div class="sim-card-title">
                    <svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    Device Info
                </div>
                <div class="sim-info-row">
                    <span class="sim-info-label">当前电量</span>
                    <div class="sim-progress-wrap">
                        <div class="sim-progress-track"><div class="sim-progress-fill" style="width: ${data.battery}%; background: ${data.battery < 20 ? '#FF3B30' : '#111'};"></div></div>
                        <span class="sim-progress-text">${data.battery}%</span>
                    </div>
                </div>
                <div class="sim-info-row">
                    <span class="sim-info-label">屏幕使用时间</span>
                    <span class="sim-info-value">${data.screenTime}</span>
                </div>
            </div>

            <div class="sim-info-card">
                <div class="sim-card-title">
                    <svg viewBox="0 0 24 24"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                    App Usage
                </div>
                ${data.appUsage ? data.appUsage.map(app => `
                    <div class="sim-info-row">
                        <span class="sim-info-label">${app.name}</span>
                        <span class="sim-info-value">${app.time}</span>
                    </div>
                `).join('') : '<div class="sim-info-label" style="text-align:center;">暂无数据</div>'}
            </div>

            <div class="sim-info-card">
                <div class="sim-card-title">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Timeline
                </div>
                ${data.locations ? data.locations.map(loc => `
                    <div class="sim-timeline-item">
                        <div class="sim-timeline-time">${loc.time}</div>
                        <div class="sim-timeline-content">
                            <div class="sim-timeline-place">${loc.place}</div>
                            <div class="sim-timeline-desc">${loc.desc}</div>
                        </div>
                    </div>
                `).join('') : '<div class="sim-info-label" style="text-align:center;">暂无行程记录</div>'}
            </div>
        </div>
    `;

    // 歌单部分 (CD 风格)
    let playlistHtml = `<div id="wc-settings-tab-playlist" style="display: none;">`;
    
    // 兼容旧数据
    const playlists = data.playlists || (data.playlist ? [{ name: "最近常听", coverDesc: "默认", tracks: data.playlist }] : []);

    if (playlists.length > 0) {
        playlists.forEach((pl, idx) => {
            // 随机生成一个封面渐变色和光盘颜色
            const hue1 = Math.floor(Math.random() * 360);
            const hue2 = (hue1 + 40) % 360;
            const bg = `linear-gradient(135deg, hsl(${hue1}, 30%, 80%), hsl(${hue2}, 30%, 70%))`;
            const discBg = `conic-gradient(hsl(${hue1}, 20%, 90%), hsl(${hue2}, 20%, 85%), hsl(${hue1}, 20%, 90%), hsl(${hue2}, 20%, 85%), hsl(${hue1}, 20%, 90%))`;

            playlistHtml += `
                <div class="cd-playlist-card" onclick="wcOpenSimPlaylistDetail(${idx})">
                    <div class="cd-cover-wrapper" style="background: ${bg};">
                        <div class="cd-cover-text">${pl.name}</div>
                    </div>
                    <div class="cd-disc" style="background: ${discBg};"></div>
                    <div class="cd-info">
                        <div class="cd-title">${pl.name}</div>
                        <div class="cd-count">${pl.totalCount ? pl.totalCount : (pl.tracks ? pl.tracks.length : 0)} 首</div>
                    </div>
                </div>
            `;
        });
    } else {
        playlistHtml += `<div style="text-align: center; color: #888; padding: 20px; width: 100%;">暂无歌单数据，请点击右上角刷新生成</div>`;
    }
    playlistHtml += `</div>`;

        content.innerHTML = statusHtml + playlistHtml;
    
    // 👇 加上这两行，确保渲染时应用当前的五角星视图状态 👇
    document.getElementById('wc-settings-tab-status').style.display = currentSimSettingsTab === 'status' ? 'block' : 'none';
    document.getElementById('wc-settings-tab-playlist').style.display = currentSimSettingsTab === 'playlist' ? 'block' : 'none';
}

// ==========================================
// Char 手机设置页：背景上传与五角星切换逻辑
// ==========================================

// 处理点击顶部背景上传图片
window.handleSimProfileBgUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

    wcShowLoading("正在更换背景...");
    try {
        const base64 = await wcCompressImage(file);
        if (!char.phoneData) char.phoneData = {};
        if (!char.phoneData.settings) char.phoneData.settings = {};
        
        char.phoneData.settings.profileBg = base64;
        wcSaveData();
        
        document.getElementById('sim-profile-header').style.backgroundImage = `url('${base64}')`;
        wcShowSuccess("更换成功");
    } catch (e) {
        console.error(e);
        wcShowError("图片处理失败");
    }
    input.value = ''; // 清空 input
};

// 五角星切换视图逻辑
let currentSimSettingsTab = 'status';

window.wcToggleSettingsView = function() {
    // 切换状态
    currentSimSettingsTab = currentSimSettingsTab === 'status' ? 'playlist' : 'status';
    
    const statusTab = document.getElementById('wc-settings-tab-status');
    const playlistTab = document.getElementById('wc-settings-tab-playlist');
    const starToggle = document.getElementById('sim-star-toggle');
    
    // 切换显示内容
    if (statusTab) statusTab.style.display = currentSimSettingsTab === 'status' ? 'block' : 'none';
    if (playlistTab) playlistTab.style.display = currentSimSettingsTab === 'playlist' ? 'block' : 'none';
    
    // 切换五角星动画状态
    if (starToggle) {
        if (currentSimSettingsTab === 'playlist') {
            starToggle.classList.add('active');
        } else {
            starToggle.classList.remove('active');
        }
    }
};

// ==========================================
// Char 歌单详情与加载更多逻辑
// ==========================================
let currentSimPlaylistIdx = -1;

window.wcOpenSimPlaylistDetail = function(idx) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.settings) return;
    
    const settings = char.phoneData.settings;
    const playlists = settings.playlists || (settings.playlist ? [{ name: "最近常听", tracks: settings.playlist }] : []);
    const pl = playlists[idx];
    if (!pl) return;

    currentSimPlaylistIdx = idx;
    document.getElementById('sim-playlist-detail-title').innerText = pl.name;
    
    wcRenderSimPlaylistTracks();
    
    document.getElementById('wc-phone-playlist-detail').style.display = 'flex';
};

window.wcClosePhonePlaylistDetail = function() {
    document.getElementById('wc-phone-playlist-detail').style.display = 'none';
};

window.wcRenderSimPlaylistTracks = function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const settings = char.phoneData.settings;
    const playlists = settings.playlists || (settings.playlist ? [{ name: "最近常听", tracks: settings.playlist }] : []);
    const pl = playlists[currentSimPlaylistIdx];
    
    const container = document.getElementById('wc-phone-playlist-tracks');
    container.innerHTML = '';
    
    if (pl.tracks && pl.tracks.length > 0) {
        pl.tracks.forEach((song, i) => {
            container.innerHTML += `
                <div class="sim-track-item" onclick="wcPlaySimTrack(${currentSimPlaylistIdx}, ${i})">
                    <div class="sim-track-index">${(i + 1).toString().padStart(2, '0')}</div>
                    <div class="sim-track-info">
                        <div class="sim-track-title">${song.title}</div>
                        <div class="sim-track-artist">${song.artist}</div>
                    </div>
                    <div class="sim-track-play">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
            `;
        });
        
        // 加载更多按钮 (根据总数判断是否显示)
        const totalCount = pl.totalCount || pl.tracks.length;
        if (pl.tracks.length < totalCount) {
            container.innerHTML += `
                <button class="sim-load-more-btn" onclick="wcLoadMoreSimTracks()">
                    加载更多歌曲 (${pl.tracks.length}/${totalCount})
                </button>
            `;
        } else {
            container.innerHTML += `
                <div style="text-align:center; color:#999; padding:20px; font-size: 12px;">已加载全部歌曲</div>
            `;
        }
    } else {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">暂无歌曲</div>';
    }
};

window.wcPlaySimTrack = function(plIdx, trackIdx) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const settings = char.phoneData.settings;
    const playlists = settings.playlists || (settings.playlist ? [{ name: "最近常听", tracks: settings.playlist }] : []);
    const pl = playlists[plIdx];
    const song = pl.tracks[trackIdx];
    
    if (!song) return;
    
    // 为了兼容，将当前歌单设为播放列表
    musicState.currentPlaylist = [...pl.tracks];
    musicState.currentIndex = trackIdx;
    
    // 👇 新增：显示 Settings 页面的迷你播放器并更新基础信息 👇
    const miniPlayer = document.getElementById('sim-global-mini-player');
    if (miniPlayer) {
        miniPlayer.style.display = 'flex';
        document.getElementById('sim-global-mini-title').innerText = song.title;
        document.getElementById('sim-global-mini-artist').innerText = song.artist;
        document.getElementById('sim-global-mini-cover').src = 'https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg';
    }
    
    // 弹出提示并调用播放
    wcShowLoading(`正在搜索《${song.title}》...`);
    
    // 真实搜索并播放 (通过 API 获取真实的歌曲 ID 和播放链接)
    setTimeout(async () => {
        try {
            const baseUrl = getMusicApiBaseUrl();
            const keyword = `${song.title} ${song.artist}`;
            const res = await fetch(`${baseUrl}/cloudsearch?keywords=${encodeURIComponent(keyword)}`);
            const data = await res.json();
            if (data.code === 200 && data.result && data.result.songs && data.result.songs.length > 0) {
                const track = data.result.songs[0];
                const newSong = {
                    id: track.id,
                    title: track.name,
                    artist: track.ar.map(a => a.name).join(', '),
                    cover: track.al.picUrl + '?param=100y100'
                };
                // 更新播放列表中的这首歌为真实数据
                musicState.currentPlaylist[musicState.currentIndex] = newSong;
                // 播放真实歌曲
                musicPlaySong(newSong.id, newSong.title, newSong.artist, newSong.cover);
                wcShowSuccess("即将播放");
            } else {
                wcShowError("未找到该歌曲");
            }
        } catch (e) {
            console.error("搜索失败", e);
            wcShowError("搜索失败");
        }
    }, 500);
};

// 新增：控制迷你播放器的播放/暂停
window.wcToggleSimPlay = function(e) {
    e.stopPropagation(); // 阻止冒泡，防止触发打开全屏播放器
    musicTogglePlay(); // 调用全局的播放/暂停逻辑
};

window.wcLoadMoreSimTracks = async function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在生成更多歌曲...");

    try {
        const settings = char.phoneData.settings;
        const playlists = settings.playlists || (settings.playlist ? [{ name: "最近常听", tracks: settings.playlist }] : []);
        const pl = playlists[currentSimPlaylistIdx];
        
        const existingSongs = pl.tracks.map(t => `${t.title}-${t.artist}`).join('、');

        // 👇 提取聊天上下文、世界书和用户面具 👇
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-15).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `你有一个名为“${pl.name}”的歌单。目前歌单里已经有以下歌曲：${existingSongs}。\n`;
        prompt += `请根据你的人设、当前聊天氛围和这个歌单的风格，再推荐 10 首真实存在的歌曲。\n`;
        prompt += `要求：\n1. 必须是真实存在的流行歌曲。\n2. 【绝对禁止】和已有的歌曲重复！\n3. 返回纯 JSON 数组，格式如下：\n`;
        prompt += `[
  {"title": "歌名", "artist": "歌手"}
]`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8
            })
        });

        const data = await response.json();
        let contentStr = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        contentStr = contentStr.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const newTracks = JSON.parse(contentStr);
        
        pl.tracks.push(...newTracks);
        wcSaveData();
        
        wcRenderSimPlaylistTracks();
        wcShowSuccess("加载成功");

    } catch (e) {
        console.error(e);
        wcShowError("生成失败");
    }
};

// --- Phone Message Logic ---

// 【核心修复】：补充缺失的 wcGeneratePhoneChats 函数，并强化生成要求
async function wcGeneratePhoneChats() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在生成聊天列表与记录...");

    try {
        const chatConfig = char.chatConfig || {};
        const userName = chatConfig.userName || wcState.user.name;
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";

        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-20).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');

        // 核心修复：只读取关联的世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 提取通讯录 NPC 列表
        const contacts = char.phoneData && char.phoneData.contacts ? char.phoneData.contacts.filter(c => !c.isUser) : [];
        let contactsInfo = "通讯录中暂无其他NPC，请自由发挥生成。";
        if (contacts.length > 0) {
            contactsInfo = "【通讯录NPC列表】:\n" + contacts.map(c => `- ${c.name} (${c.type === 'group' ? '群聊' : '好友'}): ${c.desc}`).join('\n');
        }

        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【当前时间】：${timeString}\n`;
        prompt += `【重要：用户身份】\n用户(${userName})的名字是：${userName}。\n用户在你的生活中的角色/人设是：${userPersona}。\n`;
        if (chatConfig.bilingualEnabled) {
            const sourceLang = chatConfig.bilingualSource || '英语';
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：请在 "history" 的 "content" 字段中，继续使用双语格式（上面是${sourceLang}，下面是${targetLang}，用 <br><span style='font-size: 0.85em; opacity: 0.7;'> 包裹译文）。\n`;
        }
        prompt += `【最近你与User的聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `${contactsInfo}\n\n`;
        
        prompt += `请根据角色的人设、当前生活状态、最近的聊天内容，以及【通讯录NPC列表】，生成该角色手机微信里的【聊天列表】和【详细聊天记录】。\n`;
        prompt += `【严格要求（极具活人感与独立社交）】：\n`;
        prompt += `1. 必须生成 3 到 8 个聊天会话。\n`;
        prompt += `2. 必须包含一个与用户(${userName})的会话，isUser 设为 true。\n`;
        prompt += `3. 其他会话必须从【通讯录NPC列表】中挑选人物/群聊生成，isGroup 表示是否为群聊。\n`;
        prompt += `4. 【最重要：独立社交指令】：你和 NPC 的聊天内容必须是真实的社交日常！例如：吐槽奇葩老板、聊游戏开黑、拼单点外卖、借钱、分享搞笑视频等。**绝对不要在每个群里都聊 ${userName}！你的世界不是只有 ${userName}！**同时要确保 ${userName} 可以隐秘体现在你的社交圈和你的生活里面！\n`;
        prompt += `5. 每个会话必须包含一个 "history" 数组，里面必须包含 8 到 15 条具体的聊天记录！绝对不能少于8条！\n`;
        prompt += `6. history 中的消息，sender 为 "me" 代表手机主人(${char.name})发出的，sender 为 "them" 代表对方发出的。如果是群聊(isGroup为true)，必须在 history 的每条消息中加上 "name" 字段标明发言人！\n`;
        prompt += `【内在逻辑要求】：在生成 JSON 之前，请确保你的内部推演包含：\n`;
        prompt += `1. 结合当前时间、地点和心情，推断你最近在和谁聊天，聊些什么（工作、八卦、游戏、求助等）。\n`;
        prompt += `2. 构思如何体现你独立的生活社交圈，同时也要保证 User 隐秘体现在你的社交圈和你的生活。\n`;
        prompt += `3. 确保聊天记录充满生活琐碎感和活人语气，拒绝生硬的问答。\n`;
        prompt += `4. 【格式约束 (最高优先级)】：**必须且只能**输出合法的 JSON 数组，严禁在 JSON 外部输出任何多余字符！严禁漏掉引号、括号或逗号！严禁输出损坏的 JSON 格式！请确保所有的字符串内部的双引号都被正确转义（\\"），并且不要包含真实的换行符（请使用 \\n 代替）。\n`;
        prompt += `推演结束后，直接返回纯 JSON 数组，格式如下：\n`;
        prompt += `[
  {
    "name": "${userName}的备注名", "isUser": true, "isGroup": false, "lastMsg": "最近的一条消息", "time": "10:30",
    "history": [
      {"sender": "them", "name": "${userName}", "content": "在干嘛？"},
      {"sender": "me", "name": "${char.name}", "content": "刚吃完饭"}
      // ... 确保这里有 8-15 条
    ]
  },
  {
    "name": "工作群", "isUser": false, "isGroup": true, "lastMsg": "收到", "time": "星期二",
    "history": [
      {"sender": "them", "name": "老板", "content": "这份文件看一下"},
      {"sender": "me", "name": "${char.name}", "content": "收到"}
      // ... 确保这里有 8-15 条
    ]
  }
]`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 4000 // 👈 修复1：改为 4000，适配绝大多数模型
            })
        });

        const data = await response.json();
        
        // 👇 修复2：新增严格的错误拦截，如果报错会弹出精美的错误卡片
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。详细报错：" + JSON.stringify(data));
        }
        // 👆 修复结束 👆

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let chatsData = [];
        try {
            let tempContent = content;
            if (!tempContent.endsWith(']')) {
                let openBrackets = (tempContent.match(/\[/g) || []).length;
                let closeBrackets = (tempContent.match(/\]/g) || []).length;
                let openBraces = (tempContent.match(/\{/g) || []).length;
                let closeBraces = (tempContent.match(/\}/g) || []).length;
                while (openBraces > closeBraces) { tempContent += '}'; closeBraces++; }
                while (openBrackets > closeBrackets) { tempContent += ']'; closeBrackets++; }
            }
            tempContent = tempContent.replace(/,\s*]/g, ']');
            tempContent = tempContent.replace(/,\s*}/g, '}');
            chatsData = JSON.parse(tempContent);
        } catch (parseErr) {
            console.warn("JSON 解析失败，启动终极碎片提取模式兜底...");
            let extracted = [];
            let depth = 0; let start = -1; let inString = false; let escapeNext = false;
            for (let i = 0; i < content.length; i++) {
                const charStr = content[i];
                if (escapeNext) { escapeNext = false; continue; }
                if (charStr === '\\') { escapeNext = true; continue; }
                if (charStr === '"') { inString = !inString; continue; }
                if (!inString) {
                    if (charStr === '{') { if (depth === 0) start = i; depth++; }
                    else if (charStr === '}') {
                        depth--;
                        if (depth === 0 && start !== -1) {
                            let objStr = content.substring(start, i + 1);
                            try {
                                objStr = objStr.replace(/\n/g, '\\n').replace(/\r/g, '');
                                let obj = JSON.parse(objStr);
                                if (obj.name && Array.isArray(obj.history)) extracted.push(obj);
                            } catch(err) {}
                            start = -1;
                        }
                    }
                }
            }
            if (extracted.length > 0) {
                chatsData = extracted;
            } else {
                throw new Error("AI 输出的内容过于混乱，已尽力挽救但失败。返回内容片段：" + content.substring(0, 100) + "...");
            }
        }

        if (!Array.isArray(chatsData)) {
            if (chatsData.name && Array.isArray(chatsData.history)) chatsData = [chatsData];
            else throw new Error("AI 返回的数据不是有效的聊天列表数组。");
        }

        if (!char.phoneData) char.phoneData = {};
        
        // 为每个生成的会话分配 ID 和初始化 history
        const formattedChats = chatsData.map(c => ({
            id: Date.now() + Math.random(),
            name: c.name,
            isUser: c.isUser || false,
            isGroup: c.isGroup || false,
            lastMsg: c.lastMsg || "",
            time: c.time || "",
            avatar: "", // 将在渲染时分配
            history: c.history || [] // 包含生成的 8-15 条记录
        }));

        char.phoneData.chats = formattedChats;
        wcSaveData();
        wcRenderPhoneChats();
        wcShowSuccess("聊天列表生成成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[聊天列表生成失败] ${e.message}`);
        else wcShowError("生成失败");
    }
}

function wcConfirmGenerateChats() {
    if (confirm("重新生成聊天列表将覆盖当前手机内的所有模拟对话记录，确定要继续吗？")) {
        wcGeneratePhoneChats();
    }
}

function wcRenderPhoneChats() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const contentDiv = document.getElementById('wc-phone-app-content');
    contentDiv.innerHTML = '';

    if (!char || !char.phoneData || !char.phoneData.chats || char.phoneData.chats.length === 0) {
        contentDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 13px;">点击右上角刷新按钮<br>生成 AI 视角的聊天列表</div>';
        return;
    }

    // 创建一个白色大圆角卡片包裹所有会话
    const wrapper = document.createElement('div');
    wrapper.style.background = '#fff';
    wrapper.style.borderRadius = '28px';
    wrapper.style.padding = '10px 20px';
    wrapper.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';

    char.phoneData.chats.forEach(chat => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.padding = '14px 0';
        div.style.cursor = 'pointer';
        
        let imgHtml = '';
        if (chat.isUser) {
            const userAvatar = (char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
            imgHtml = `<img src="${userAvatar}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;">`;
        } else {
            let avatarUrl = chat.avatar;
            if (!avatarUrl) {
                const contact = char.phoneData.contacts ? char.phoneData.contacts.find(c => c.name === chat.name) : null;
                const realChar = wcState.characters.find(c => c.name === chat.name && !c.isGroup);
                
                if (contact && contact.avatar) {
                    avatarUrl = contact.avatar;
                } else if (realChar) {
                    avatarUrl = realChar.avatar; 
                } else {
                    avatarUrl = getRandomNpcAvatar();
                }
                chat.avatar = avatarUrl;
                wcSaveData();
            }
            imgHtml = `<img src="${avatarUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;">`;
        }

        div.innerHTML = `
            <div style="position: relative; margin-right: 16px; flex-shrink: 0;">
                ${imgHtml}
                <div style="position: absolute; top: -2px; right: -4px; background: #fff; border-radius: 10px; padding: 2px 5px; font-size: 10px; color: #333; border: 1px solid #f0f0f0; line-height: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-family: monospace;">★</div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 4px;">
                    <div style="font-size:16px; font-weight:bold; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.name}</div>
                    <div style="font-size:12px; color:#ccc; flex-shrink:0; margin-left:10px;">${chat.time}</div>
                </div>
                <div style="font-size:13px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.lastMsg}</div>
            </div>
        `;
        
        div.onclick = () => wcOpenSimChatDetailSaved(chat);
        wrapper.appendChild(div);
    });
    
    contentDiv.appendChild(wrapper);
}

function wcOpenSimChatDetailSaved(chatItem) {
    wcActiveSimChatId = chatItem.id;
    const detailView = document.getElementById('wc-phone-sim-chat-detail');
    const titleEl = document.getElementById('wc-sim-chat-title');
    const footer = document.getElementById('wc-sim-chat-footer');
    
    detailView.style.display = 'flex';
    titleEl.innerText = chatItem.name;
    
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const meAvatar = char.avatar; 
    let themAvatar = chatItem.avatar; 

    if (chatItem.isUser) {
        if(footer) footer.style.display = 'none';
        const realMsgs = wcState.chats[char.id] || [];
        const realHistory = realMsgs.slice(-20).map(m => ({
            sender: m.sender === 'me' ? 'them' : 'me', 
            content: m.content
        }));
        
        const userAvatar = (char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
        renderSimHistory(realHistory, meAvatar, userAvatar, false);
    } else {
        if(footer) footer.style.display = 'flex';
        if (!themAvatar) {
             const contact = char.phoneData.contacts ? char.phoneData.contacts.find(c => c.name === chatItem.name) : null;
             themAvatar = contact ? contact.avatar : getRandomNpcAvatar();
        }
        renderSimHistory(chatItem.history || [], meAvatar, themAvatar, chatItem.isGroup);
    }
}

function wcCloseSimChatDetail() {
    document.getElementById('wc-phone-sim-chat-detail').style.display = 'none';
    wcActiveSimChatId = null;
}

function wcSimSendMsg() {
    const input = document.getElementById('wc-sim-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.chats) return;
    
    const chat = char.phoneData.chats.find(c => c.id === wcActiveSimChatId);
    if (!chat) return;
    
    if (!chat.history) chat.history = [];
    
    chat.history.push({ sender: 'me', content: text });
    chat.lastMsg = text;
    chat.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const userName = (char.chatConfig && char.chatConfig.userName) ? char.chatConfig.userName : wcState.user.name;
    wcAddMessage(char.id, 'system', 'system', 
        `[系统内部信息(仅AI可见)：${userName}(User) 偷偷拿到了你(${char.name})的手机，并以你(${char.name})的名义，给你的手机联系人 "${chat.name}" 回复了消息: "${text}"]`, 
        { hidden: true }
    );

    // 👇 新增：跨角色消息同步逻辑 (蝴蝶效应) 👇
    // 尝试寻找目标联系人是否为真实角色 (通过 realCharId 或 名字匹配)
    const targetRealChar = wcState.characters.find(c => (chat.realCharId && c.id === chat.realCharId) || (c.name === chat.name && !c.isGroup));
    
    if (targetRealChar) {
        // 1. 在目标角色的手机里，生成/更新与当前角色(char)的聊天记录
        if (!targetRealChar.phoneData) targetRealChar.phoneData = {};
        if (!targetRealChar.phoneData.chats) targetRealChar.phoneData.chats = [];
        
        let targetPhoneChat = targetRealChar.phoneData.chats.find(c => c.name === char.name);
        if (!targetPhoneChat) {
            targetPhoneChat = {
                id: Date.now() + Math.random(),
                name: char.name,
                realCharId: char.id,
                avatar: char.avatar,
                lastMsg: "",
                time: "",
                isGroup: false,
                history: []
            };
            targetRealChar.phoneData.chats.push(targetPhoneChat);
        }
        
        // 写入消息 (在目标角色的手机里，这条消息是 'them' 发来的)
        targetPhoneChat.history.push({ sender: 'them', content: text });
        targetPhoneChat.lastMsg = text;
        targetPhoneChat.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // 2. 给目标角色注入主聊天记忆，引发蝴蝶效应
        wcAddMessage(targetRealChar.id, 'system', 'system', 
            `[系统内部信息(仅AI可见)：你的朋通讯录好友"${char.name}" 刚刚在微信上给你发了一条消息: "${text}"。请在接下来和 User 的聊天中，自然地提及这件事，或者向 User 吐槽/分享 "${char.name}" 给你发的消息。]`, 
            { hidden: true }
        );
    }
    // 👆 新增结束 👆

    wcSaveData();
    
    const meAvatar = char.avatar;
    let themAvatar = chat.avatar;
    if (!themAvatar) {
         const contact = char.phoneData.contacts ? char.phoneData.contacts.find(c => c.name === chat.name) : null;
         themAvatar = contact ? contact.avatar : getRandomNpcAvatar();
    }
    renderSimHistory(chat.history, meAvatar, themAvatar, chat.isGroup);
    
    wcRenderPhoneChats();
    input.value = '';
    
    input.style.height = '36px';
    document.getElementById('wc-sim-send-btn').style.display = 'none';
    document.getElementById('wc-sim-ai-btn').style.display = 'flex';
}

// --- 核心强化：NPC 回复防 OOC 与重点读取 ---
async function wcSimTriggerAI() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.chats) return;
    
    const chat = char.phoneData.chats.find(c => c.id === wcActiveSimChatId);
    if (!chat) return;

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return alert("请配置 API");

    // 检查限制
    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    const btn = document.querySelector('#wc-sim-chat-footer button:last-child');
    if(btn) btn.disabled = true;

    wcShowLoading("正在生成...");

    try {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        let prompt = "";
        
        // 👇 新增：查找对方是否为真实角色 👇
        const targetRealChar = wcState.characters.find(c => (chat.realCharId && c.id === chat.realCharId) || (c.name === chat.name && !c.isGroup));

        if (chat.isGroup) {
            prompt += `你正在模拟一个名为【${chat.name}】的微信群聊。\n`;
            prompt += `群聊背景/简介：${chat.desc || '无'}\n`;
            prompt += `群里的人正在跟群成员【${char.name}】(User扮演) 聊天。\n`;
            prompt += `【任务】：请重点读取群聊背景，以群里其他成员的身份回复消息。\n`;
            prompt += `【要求】：\n`;
            prompt += `1. 可以是一个人回复，也可以是几个人七嘴八舌。\n`;
            prompt += `2. 必须返回 JSON 数组，每个对象必须包含 "senderName" (发送者名字)。\n`;
            prompt += `3. 格式示例：[{"senderName":"张三", "content":"哈哈哈哈"}, {"senderName":"李四", "content":"确实"}]\n`;
        } else {
            // 单聊逻辑 - 史诗级强化防OOC
            if (targetRealChar) {
                // 🌟 对方是真实角色！读取 B 的完整设定，但对 A 的设定进行“降维/截断”以节省 Token 🌟
                prompt += `【最高指令】：你现在的唯一身份是【${targetRealChar.name}】！\n`;
                prompt += `【绝对禁止】：绝对禁止以【${char.name}】(手机主人) 或【User】(玩家) 的口吻回复！绝对禁止套用他们的人设和面具！\n`;
                
                // 1. 注入 B (回复方) 的完整设定
                prompt += `\n=== 你的设定 (${targetRealChar.name}) ===\n`;
                prompt += `【你的核心人设】：${targetRealChar.prompt}\n`;
                const targetConfig = targetRealChar.chatConfig || {};
                if (worldbookEntries.length > 0 && targetConfig.worldbookEntries && targetConfig.worldbookEntries.length > 0) {
                    const linkedEntries = worldbookEntries.filter(e => targetConfig.worldbookEntries.includes(e.id.toString()));
                    if (linkedEntries.length > 0) {
                        prompt += "【你的世界观参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n";
                    }
                }

                // 2. 注入 A (手机主人) 的极简设定 (省 Token 核心杀招！)
                // 截取 A 的人设前 200 个字符，足够让 AI 知道 A 是个什么性格的人，同时彻底丢弃 A 的世界书
                const shortCharPrompt = char.prompt ? char.prompt.substring(0, 200).replace(/\n/g, ' ') + '...' : '未知';
                prompt += `\n=== 你正在交谈的对象 (${char.name}) ===\n`;
                prompt += `【对方的性格印象】：${shortCharPrompt}\n`;

                // 3. 注入双方的关系网 (字数极少，性价比极高)
                prompt += `\n=== 你们的关系 ===\n`;
                prompt += wcGenerateRelationshipPrompt([targetRealChar.id.toString(), char.id.toString()]); 
                
                prompt += `【任务】：请作为【${targetRealChar.name}】本人，回复 ${char.name} 的消息。请结合你的设定和你们的关系给出真实反应，严禁OOC！\n`;
            } else {
                // 对方是纯 NPC，使用简短描述
                prompt += `【最高指令】：你现在的唯一身份是【${chat.name}】！\n`;
                prompt += `【绝对禁止】：绝对禁止以【${char.name}】(手机主人) 或【User】(玩家) 的口吻回复！绝对禁止套用他们的人设和面具！\n`;
                prompt += `【你的核心人设/简介】：${chat.desc || '普通朋友'}\n`;
                prompt += wcGenerateRelationshipPrompt(); // 注入全局关系网
                prompt += `【任务】：请重点读取你的【核心人设/简介】和【最近聊天记录】，作为【${chat.name}】本人，回复 ${char.name} 的消息。必须符合你的人设口吻，严禁OOC！\n`;
            }
            if (char.chatConfig && char.chatConfig.bilingualEnabled) {
                prompt += `【要求】：返回 JSON 数组，格式示例：[{"content":"OK.<br><span style='font-size: 0.85em; opacity: 0.7;'>好的。</span>"}]\n`;
            } else {
                prompt += `【要求】：返回 JSON 数组，格式示例：[{"content":"好的"}]\n`;
            }
        }
        
        const isTimePerceptionEnabled = char.chatConfig && char.chatConfig.timePerceptionEnabled !== false;
        if (isTimePerceptionEnabled) {
            prompt += `\n【当前时间】：${timeString}\n`;
        }
        
        if (char.chatConfig && char.chatConfig.bilingualEnabled) {
            const sourceLang = char.chatConfig.bilingualSource || '英语';
            const targetLang = char.chatConfig.bilingualTarget || '中文';
            prompt += `\n【最高强制指令：双语翻译模式】\n`;
            prompt += `你必须以双语形式回复！上面是${sourceLang}，下面是${targetLang}。\n`;
            prompt += `在 JSON 的 "content" 字段中，请严格使用以下 HTML 格式输出文本消息（注意单引号）：\n`;
            prompt += `${sourceLang}内容<br><span style='font-size: 0.85em; opacity: 0.7;'>${targetLang}内容</span>\n`;
            prompt += `例如：[{"content":"Hello!<br><span style='font-size: 0.85em; opacity: 0.7;'>你好！</span>"}]\n`;
            prompt += `绝对不能只输出一种语言！\n`;
        }
        // 注入活人运转规则
        prompt += `\n【角色活人运转规则】\n`;
        prompt += `> 必须像真人一样聊天，拒绝机械回复。\n`;
        prompt += `> 必须将长回复拆分成多条短消息（1-4条），严禁把所有话挤在一个气泡里！\n`;
        prompt += `> 【重要约束】：绝对不要凭空捏造没有发生过的事情。请严格基于现有的聊天记录上下文进行自然的日常问候、吐槽或顺延当前话题。\n`;
        prompt += `> 【防重复约束】：严禁输出重复的句子或重复的对话序列！\n`;
        prompt += `> 【格式约束 (最高优先级)】：**必须且只能**输出合法的 JSON 数组，严禁在 JSON 外部输出任何多余字符！严禁漏掉引号、括号或逗号！严禁输出损坏的 JSON 格式！\n`;

        
        // 注入最近聊天记录 (增加读取条数)
        prompt += `\n【重点读取：最近聊天记录】：\n`;
        const recentHistory = (chat.history || []).slice(-15); 
        recentHistory.forEach(h => {
            const speaker = h.sender === 'me' ? char.name : (h.name || chat.name);
            prompt += `${speaker}: ${h.content}\n`;
        });
        
        if (chat.isGroup) {
            prompt += `(群成员发言):`;
        } else {
            prompt += `${chat.name}:`;
        }

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 4000
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content.trim();
        
        // 解析 JSON
        let replies = [];
        try {
            let cleanText = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
            cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = cleanText.indexOf('[');
            const end = cleanText.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                cleanText = cleanText.substring(start, end + 1);
                replies = JSON.parse(cleanText);
            } else {
                // 尝试解析单个对象
                const regex = /\{.*?\}/g;
                const matches = cleanText.match(regex);
                if (matches) {
                    replies = matches.map(m => JSON.parse(m));
                } else {
                    // 核心修复：如果连单个对象都匹配不到，强制把纯文本作为回复
                    throw new Error("No JSON found");
                }
            }
        } catch (e) {
            // 降级：如果解析失败，当纯文本处理 (仅限单聊)
            if (!chat.isGroup) {
                let cleanText = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
                if (cleanText) {
                    replies = [{ content: cleanText }];
                } else {
                    replies = [{ content: "..." }]; // 兜底
                }
            }
        }

        if (!chat.history) chat.history = [];

        const meAvatar = char.avatar;
        let themAvatar = chat.avatar;
        if (!themAvatar) {
             const contact = char.phoneData.contacts ? char.phoneData.contacts.find(c => c.name === chat.name) : null;
             themAvatar = contact ? contact.avatar : getRandomNpcAvatar();
        }

        wcShowSuccess("回复成功");

        for (const reply of replies) {
            if (reply.content) {
                await wcDelay(1500); 
                
                // 构造消息对象
                const newMsg = { 
                    sender: 'them', 
                    content: reply.content,
                    name: reply.senderName || null // 存入发送者名字
                };
                
                chat.history.push(newMsg);
                
                // 👇 新增：跨角色消息同步 (AI回复同步) 👇
                if (targetRealChar && !chat.isGroup) {
                    if (!targetRealChar.phoneData) targetRealChar.phoneData = {};
                    if (!targetRealChar.phoneData.chats) targetRealChar.phoneData.chats = [];
                    
                    let targetPhoneChat = targetRealChar.phoneData.chats.find(c => c.name === char.name);
                    if (!targetPhoneChat) {
                        targetPhoneChat = {
                            id: Date.now() + Math.random(),
                            name: char.name,
                            realCharId: char.id,
                            avatar: char.avatar,
                            lastMsg: "",
                            time: "",
                            isGroup: false,
                            history: []
                        };
                        targetRealChar.phoneData.chats.push(targetPhoneChat);
                    }
                    
                    // 写入消息 (在目标角色的手机里，这条消息是 'me' 发出的)
                    targetPhoneChat.history.push({ sender: 'me', content: reply.content });
                    targetPhoneChat.lastMsg = reply.content;
                    targetPhoneChat.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
                // 👆 新增结束 👆

                // 更新最后一条消息预览
                let preview = reply.content;
                if (chat.isGroup && reply.senderName) {
                    preview = `${reply.senderName}: ${preview}`;
                }
                chat.lastMsg = preview;
                chat.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                wcSaveData();
                renderSimHistory(chat.history, meAvatar, themAvatar, chat.isGroup); // 传入 isGroup
                wcRenderPhoneChats();
            }
        }

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[模拟聊天回复失败] ${e.message}`);
        else wcShowError("AI 回复失败");
    } finally {
        if(btn) btn.disabled = false;
    }
}

function renderSimHistory(history, meAvatar, themAvatar, isGroup = false) {
    const container = document.getElementById('wc-sim-chat-history');
    container.innerHTML = '';
    
    let lastTime = 0;

    history.forEach(msg => {
        // --- 新增：渲染时间戳 (间隔大于5分钟显示) ---
        if (msg.time && (msg.time - lastTime > 5 * 60 * 1000)) {
            const timeDiv = document.createElement('div');
            timeDiv.style.textAlign = 'center';
            timeDiv.style.margin = '10px 0';
            // 使用系统自带的时间格式化函数
            timeDiv.innerHTML = `<span style="background: rgba(0,0,0,0.1); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${wcFormatSystemTime(msg.time)}</span>`;
            container.appendChild(timeDiv);
            lastTime = msg.time;
        }

        const isMe = msg.sender === 'me'; 
        
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = isMe ? 'row-reverse' : 'row';
        row.style.marginBottom = '15px'; 
        row.style.alignItems = 'flex-start';
        row.style.width = '100%'; 

        // 头像
        const avatar = document.createElement('img');
        avatar.style.width = '36px';
        avatar.style.height = '36px';
        avatar.style.borderRadius = '4px';
        avatar.style.flexShrink = '0';
        avatar.style.objectFit = 'cover';
        avatar.src = isMe ? meAvatar : themAvatar;
        
        // 消息内容容器
        const contentDiv = document.createElement('div');
        contentDiv.style.display = 'flex';
        contentDiv.style.flexDirection = 'column';
        contentDiv.style.alignItems = isMe ? 'flex-end' : 'flex-start';
        contentDiv.style.maxWidth = '70%';
        if (isMe) contentDiv.style.marginRight = '8px';
        else contentDiv.style.marginLeft = '8px';

        // 群聊显示名字
        if (isGroup && !isMe && msg.name) {
            const nameLabel = document.createElement('div');
            nameLabel.innerText = msg.name;
            nameLabel.style.fontSize = '10px';
            nameLabel.style.color = '#888';
            nameLabel.style.marginBottom = '2px';
            nameLabel.style.marginLeft = '2px';
            contentDiv.appendChild(nameLabel);
        }

        const bubble = document.createElement('div');
        bubble.style.position = 'relative';
        
        // --- 新增：表情包和图片渲染逻辑 ---
        if (msg.type === 'sticker' || msg.type === 'image') {
            if (msg.content.startsWith('data:video/')) {
                bubble.innerHTML = `<video src="${msg.content}" style="max-width: 120px; max-height: 120px; border-radius: 8px; display: block; object-fit: cover;" controls autoplay loop muted playsinline></video>`;
            } else {
                bubble.innerHTML = `<img src="${msg.content}" style="max-width: 120px; max-height: 120px; border-radius: 8px; display: block; object-fit: cover;">`;
            }
            bubble.style.background = 'transparent';
            bubble.style.padding = '0';
        } else {
            // 普通文本气泡
            bubble.style.padding = '8px 12px';
            bubble.style.borderRadius = '6px';
            bubble.style.fontSize = '15px';
            bubble.style.lineHeight = '1.4';
            bubble.style.wordBreak = 'break-word';
            if (isMe) {
                bubble.style.background = '#111111'; // 适配高级黑白主题
                bubble.style.color = '#FFFFFF';
                bubble.style.borderBottomRightRadius = '2px';
            } else {
                bubble.style.background = '#FFFFFF';
                bubble.style.color = '#111111';
                bubble.style.border = '1px solid #F0F0F0';
                bubble.style.borderBottomLeftRadius = '2px';
            }
            // 检测是否包含 <span> 标签 (支持多段翻译交替)
            const hasTranslation = /<span[^>]*>([\s\S]*?)<\/span>/i.test(msg.content);
            
            if (hasTranslation) {
                // 提取原文
                const originalText = msg.content.replace(/(?:<br\s*\/?>|\n)*\s*<span[^>]*>[\s\S]*?<\/span>\s*/gi, '').replace(/^(<br\s*\/?>|\s)+|(<br\s*\/?>|\s)+$/gi, '');
                // 提取译文
                const translatedText = Array.from(msg.content.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map(m => m[1]).join('<br>');
                const transId = 'trans-' + Math.random().toString(36).substr(2, 9);

                bubble.style.cursor = 'pointer';
                bubble.onclick = function() { 
                    const el = document.getElementById(transId); 
                    if(el.style.display==='none'){el.style.display='block';}else{el.style.display='none';} 
                };
                bubble.innerHTML = `<div style="word-break: break-word; width: 100%;">${originalText}</div><div id="${transId}" style="display: none; width: 100%; margin-top: 8px;"><div style="height: 1px; width: 100%; background-color: ${isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)'}; margin-bottom: 8px;"></div><div style="font-size: 13px; word-break: break-word; color: ${isMe ? '#CCCCCC' : '#888888'};">${translatedText}</div></div>`;
            } else {
                bubble.innerHTML = msg.content;
            }
        }
        
        contentDiv.appendChild(bubble);
        
        row.appendChild(avatar);
        row.appendChild(contentDiv);
        container.appendChild(row);
    });
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

// --- Phone Contacts Logic ---

function wcOpenPhoneContactsGenModal() {
    wcOpenModal('wc-modal-gen-contacts');
}

async function wcGeneratePhoneContacts() {
    const min = parseInt(document.getElementById('wc-gen-contact-min').value) || 3;
    const max = parseInt(document.getElementById('wc-gen-contact-max').value) || 8;
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

   const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    // 检查限制
    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在生成通讯录...");

    try {
        const chatConfig = char.chatConfig || {};
        const userName = chatConfig.userName || wcState.user.name;
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";

        // 读取关联的世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 👇👇👇 核心杀招 1：提取同分组 + 关系网中的真实角色 👇👇👇
        const relCharIds = new Set();
        if (wcState.relationships) {
            wcState.relationships.forEach(r => {
                if (r.source === char.id && r.target !== 'user') relCharIds.add(r.target);
                if (r.target === char.id && r.source !== 'user') relCharIds.add(r.source);
            });
        }

        const realFriends = wcState.characters.filter(c => 
            c.id !== char.id && !c.isGroup && 
            c.groupName === char.groupName && 
            relCharIds.has(c.id) && 
            c.groupName !== 'All'
        );

        let groupCharsPrompt = "";
        if (realFriends.length > 0) {
            const friendInfo = realFriends.map(c => c.name).join('、');
            groupCharsPrompt = `【最高强制指令：真实社交圈】\n你必须将以下真实好友加入到 'contacts' 列表中：[${friendInfo}]。\n你可以根据你的人设和你们的关系，给他们起一个符合你性格的【备注名】（填在 name 字段），但必须在 originalName 字段中填入他们的真实原名！在包含他们之后，你才可以自由发挥生成其他路人NPC凑够人数。\n`;
        }
        // 👆👆👆 提取结束 👆👆👆

        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += `人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【重要：用户身份】\n用户(User)的名字是：${userName}。\n用户在你的生活中的角色/人设是：${userPersona}。\n`;
        prompt += groupCharsPrompt; // 注入强指令
        if (chatConfig.bilingualEnabled) {
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：虽然聊天记录中包含外语，但你生成的通讯录所有数据（如给用户的备注名、好友的备注名、好友描述等）必须全部使用 ${targetLang}！绝对不要使用双语格式！\n`;
        }
        
        prompt += `请生成你的微信通讯录数据。总人数在 ${min} 到 ${max} 之间。\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 生成两部分数据：'contacts'(已添加的好友/群) 和 'requests'(待验证的好友请求)。\n`;
        prompt += `2. 'requests' 应该有 1-2 个，或者没有。\n`;
        prompt += `3. 每个人物必须包含 'desc' (一句话概括来历/关系)。\n`;
        prompt += `4. 【绝对禁止】：不要在 'contacts' 或 'requests' 中生成用户(User)的条目！用户是固定的，我会自动添加。\n`;
        prompt += `5. 请单独返回一个字段 "userRemark"，表示你给用户(User)设置的备注名（例如：亲爱的、老板、傻瓜等）。\n`;
        prompt += `6. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "userRemark": "给用户的备注",
  "contacts": [
    {"name": "狗蛋(这是你给起的备注名)", "originalName": "李四(这是真实原名)", "type": "friend", "desc": "童年玩伴"},
    {"name": "王五", "originalName": null, "type": "friend", "desc": "大学同学(如果是虚构NPC，originalName填null)"},
    {"name": "冒险团", "originalName": null, "type": "group", "desc": "工作群"}
  ],
  "requests": [
    {"name": "神秘人", "desc": "在酒馆遇到的陌生人"}
  ]
}\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 4000
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let result;
        try {
            let tempContent = content;
            if (!tempContent.endsWith('}')) {
                let openBrackets = (tempContent.match(/\[/g) || []).length;
                let closeBrackets = (tempContent.match(/\]/g) || []).length;
                let openBraces = (tempContent.match(/\{/g) || []).length;
                let closeBraces = (tempContent.match(/\}/g) || []).length;
                while (openBrackets > closeBrackets) { tempContent += ']'; closeBrackets++; }
                while (openBraces > closeBraces) { tempContent += '}'; closeBraces++; }
            }
            tempContent = tempContent.replace(/,\s*]/g, ']');
            tempContent = tempContent.replace(/,\s*}/g, '}');
            result = JSON.parse(tempContent);
        } catch (e) {
            throw new Error("AI 返回的 JSON 格式严重损坏，已尽力挽救但失败。请重试。");
        }

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.userRemark = result.userRemark || userName;

        const userContact = {
            id: 'user_fixed_contact',
            name: char.phoneData.userRemark,
            desc: "我自己 (User)",
            type: 'friend',
            isUser: true 
        };

        // 👇👇👇 核心杀招 2：实体纠正与严格去重 (支持备注名) 👇👇👇
        let newContacts = [];
        const usedRealCharIds = new Set();

        (result.contacts || []).forEach(c => {
            // 优先通过 originalName 匹配，其次通过 name 匹配
            const realChar = realFriends.find(rc => 
                (c.originalName && (c.originalName.includes(rc.name) || rc.name.includes(c.originalName))) || 
                (c.name && (c.name.includes(rc.name) || rc.name.includes(c.name)))
            );
            
            if (realChar) {
                if (!usedRealCharIds.has(realChar.id)) {
                    newContacts.push({
                        ...c,
                        id: Date.now() + Math.random(),
                        name: c.name || realChar.name, // 保留 AI 生成的备注名作为显示名称
                        realCharId: realChar.id, // 牢牢绑定真实 ID
                        avatar: realChar.avatar
                    });
                    usedRealCharIds.add(realChar.id);
                }
            } else {
                // 纯纯的 NPC
                newContacts.push({
                    ...c,
                    id: Date.now() + Math.random(),
                    realCharId: null,
                    avatar: getRandomNpcAvatar()
                });
            }
        });

        // 终极兜底：如果 AI 漏掉了某些真实好友，强行塞进去！
        realFriends.forEach(rc => {
            if (!usedRealCharIds.has(rc.id)) {
                newContacts.unshift({
                    id: Date.now() + Math.random(),
                    name: rc.name, // 没起备注就用原名
                    desc: rc.note || "我的好友",
                    type: 'friend',
                    realCharId: rc.id,
                    avatar: rc.avatar
                });
                usedRealCharIds.add(rc.id);
            }
        });
        // 👆👆👆 兜底结束 👆👆👆

        char.phoneData.contacts = [userContact, ...newContacts];

        const newRequests = (result.requests || []).map(r => ({ ...r, id: Date.now() + Math.random(), status: 'pending' }));
        char.phoneData.friendRequests = newRequests;
        wcSaveData();
        wcCloseModal('wc-modal-gen-contacts');
        wcRenderPhoneContacts();
        wcShowSuccess("通讯录生成成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[通讯录生成失败] ${e.message}`);
        else wcShowError("生成失败");
    }
}

function wcRenderPhoneContacts() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const contentDiv = document.getElementById('wc-phone-app-content');
    contentDiv.innerHTML = '';

    if (!char || !char.phoneData) {
        contentDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 13px;">点击右上角刷新按钮<br>生成通讯录</div>';
        return;
    }

    if (char.phoneData.friendRequests && char.phoneData.friendRequests.length > 0) {
        const header = document.createElement('div');
        header.className = 'sim-wechat-contacts-divider';
        header.innerText = 'NEW FRIENDS';
        contentDiv.appendChild(header);

        char.phoneData.friendRequests.forEach(req => {
            const div = document.createElement('div');
            div.className = 'wc-list-item';
            div.style.background = 'white';
            div.style.borderBottom = 'none';
            
            const color = '#' + ((req.name.length * 99999) % 16777215).toString(16).padStart(6, '0');
            
            div.innerHTML = `
                <div style="width:48px;height:48px;border-radius:14px;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;margin-right:12px;flex-shrink:0;font-size:18px;">${req.name[0]}</div>
                <div class="wc-item-content">
                    <div class="wc-item-title" style="font-size:16px;font-weight:bold;color:#111;">${req.name}</div>
                    <div class="wc-item-subtitle" style="font-size:13px;color:#888;">${req.desc}</div>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button style="background:#111; color:white; border:none; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:bold; cursor:pointer;" onclick="wcHandleFriendRequest('${req.id}', 'accept')">接受</button>
                    <button style="background:#F5F5F5; color:#888; border:none; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:bold; cursor:pointer;" onclick="wcHandleFriendRequest('${req.id}', 'reject')">拒绝</button>
                </div>
            `;
            contentDiv.appendChild(div);
        });
    }

    const header2 = document.createElement('div');
    header2.className = 'sim-wechat-contacts-divider';
    header2.innerText = 'CONTACTS';
    contentDiv.appendChild(header2);

    const contacts = char.phoneData.contacts || [];
    contacts.forEach(contact => {
        const div = document.createElement('div');
        div.className = 'wc-list-item';
        div.style.background = 'white';
        div.style.borderBottom = 'none';
        div.style.cursor = 'pointer';
        
        let imgHtml = '';
        if (contact.isUser) {
            const userAvatar = (char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
            imgHtml = `<img src="${userAvatar}" class="wc-avatar" style="width:48px;height:48px;border-radius:14px;margin-right:12px;object-fit:cover;flex-shrink:0;">`;
        } else {
            let avatarUrl = contact.avatar;
            if (!avatarUrl) {
                avatarUrl = getRandomNpcAvatar();
                contact.avatar = avatarUrl; 
                wcSaveData();
            }
            imgHtml = `<img src="${avatarUrl}" class="wc-avatar" style="width:48px;height:48px;border-radius:14px;margin-right:12px;object-fit:cover;flex-shrink:0;">`;
        }
        
        div.innerHTML = `
            ${imgHtml}
            <div class="wc-item-content">
                <div class="wc-item-title" style="font-size:16px;font-weight:bold;color:#111;">${contact.name}</div>
                <div class="wc-item-subtitle" style="font-size:13px;color:#888;">${contact.type === 'group' ? '[群聊]' : ''} ${contact.desc}</div>
            </div>
        `;
        div.onclick = () => wcShowPhoneContactDetail(contact);
        contentDiv.appendChild(div);
    });
}

function wcHandleFriendRequest(reqId, action) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

    const reqIndex = char.phoneData.friendRequests.findIndex(r => r.id == reqId);
    if (reqIndex === -1) return;
    const req = char.phoneData.friendRequests[reqIndex];

    const userName = (char.chatConfig && char.chatConfig.userName) ? char.chatConfig.userName : wcState.user.name;
    if (action === 'accept') {
        if (!char.phoneData.contacts) char.phoneData.contacts = [];
        char.phoneData.contacts.push({
            id: req.id,
            name: req.name,
            desc: req.desc,
            type: 'friend',
            avatar: getRandomNpcAvatar() 
        });
        wcAddMessage(char.id, 'system', 'system', `[系统内部信息(仅AI可见)：${userName}(User) 偷偷拿到了你(${char.name})的手机，并替你(${char.name})通过了 "${req.name}" 的好友请求。现在 "${req.name}" 已经成了你(${char.name})的好友。]`, { hidden: true });
    } else {
        wcAddMessage(char.id, 'system', 'system', `[系统内部信息(仅AI可见)：${userName}(User) 偷偷拿到了你(${char.name})的手机，并替你(${char.name})拒绝了 "${req.name}" 的好友请求。]`, { hidden: true });
    }

    char.phoneData.friendRequests.splice(reqIndex, 1);
    wcSaveData();
    wcRenderPhoneContacts();
}

function wcDeletePhoneContact() {
    if (!currentPhoneContact) return;
    if (currentPhoneContact.isUser) return; 

    if (confirm(`确定要删除好友 "${currentPhoneContact.name}" 吗？`)) {
        const char = wcState.characters.find(c => c.id === wcState.editingCharId);
        const userName = (char.chatConfig && char.chatConfig.userName) ? char.chatConfig.userName : wcState.user.name;
        char.phoneData.contacts = char.phoneData.contacts.filter(c => c.id !== currentPhoneContact.id);
        
        wcAddMessage(char.id, 'system', 'system', `[系统内部信息(仅AI可见)：${userName}(User) 偷偷拿到了你(${char.name})的手机，并把你(${char.name})列表里的好友 "${currentPhoneContact.name}" 给删除了！]`, { hidden: true });
        
        wcSaveData();
        wcCloseModal('wc-modal-phone-contact-card');
        wcRenderPhoneContacts();
    }
}

async function wcShareContactToMain() {
    if (!currentPhoneContact) return;
    
    const name = currentPhoneContact.name;
    const desc = currentPhoneContact.desc;
    const avatar = currentPhoneContact.avatar || getRandomNpcAvatar(); 

    const newChar = {
        id: Date.now(),
        name: name,
        note: name,
        prompt: `你扮演 ${name}。背景设定：${desc}。`,
        avatar: avatar,
        isPinned: false
    };
    
    wcState.characters.push(newChar);
    await wcWriteCharactersPersistentSnapshot();
    try {
        await wcDb.put('characters', newChar);
    } catch (e) {
        console.warn('主聊天联系人写入 IndexedDB 失败，已保留本地兜底快照', e);
    }
    await wcSaveData();
    
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    // 核心修改：明确告诉 AI 是 User 添加了好友，而不是 AI 自己添加的
    wcAddMessage(char.id, 'system', 'system', `[系统提示] 用户(User)通过偷看你的手机，将你的联系人 "${name}" 添加到了他自己的微信主列表中。`, { style: 'transparent', hidden: true });
    
    wcCloseModal('wc-modal-phone-contact-card');
    alert(`已将 ${name} 添加到主聊天列表！`);
    
    wcRenderAll();
}

function wcOpenShareCardModal() {
    const list = document.getElementById('wc-share-card-list');
    list.innerHTML = '';
    
    const targets = wcState.characters; 
    
    if (targets.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">没有好友可分享</div>';
    } else {
        targets.forEach(t => {
            const div = document.createElement('div');
            div.className = 'wc-list-item';
            div.style.background = 'white';
            div.innerHTML = `
                <img src="${t.avatar}" class="wc-avatar" style="width:36px;height:36px;">
                <div class="wc-item-content"><div class="wc-item-title">${t.name}</div></div>
                <button class="wc-btn-mini" style="background:#07C160; color:white; border:none; padding:6px 12px; border-radius:4px;" onclick="wcConfirmShareCard(${t.id})">发送</button>
            `;
            list.appendChild(div);
        });
    }
    
    wcOpenModal('wc-modal-share-card-select');
}

function wcConfirmShareCard(targetCharId) {
    if (!currentPhoneContact) return;
    
    const targetChar = wcState.characters.find(c => c.id === targetCharId);
    
    if (targetChar) {
        const cardContent = `[名片] 姓名: ${currentPhoneContact.name} | 介绍: ${currentPhoneContact.desc}`;
        wcAddMessage(targetCharId, 'me', 'text', cardContent);
        alert(`已将 ${currentPhoneContact.name} 的名片发送给 ${targetChar.name}`);
        wcCloseModal('wc-modal-share-card-select');
    }
}

// --- WeChat Chat Settings (Modified for New UI) ---
function wcSwitchChatSettingsTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.wc-cs-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.wc-cs-tab-content').forEach(el => el.classList.remove('active'));
    
    // Remove active class from headers
    document.getElementById('wc-cs-char-btn').classList.remove('active');
    document.getElementById('wc-cs-user-btn').classList.remove('active');
    document.getElementById('wc-cs-heart-btn').classList.remove('active');

    // Show selected tab
    document.getElementById(`wc-cs-tab-${tab}`).style.display = 'block';
    document.getElementById(`wc-cs-tab-${tab}`).classList.add('active');
    document.getElementById(`wc-cs-${tab}-btn`).classList.add('active');

    // 👇 新增：星际轨道旋转逻辑 👇
    const wheel = document.getElementById('wc-cs-orbit-wheel');
    if (wheel) {
        let targetRotation = 0;
        if (tab === 'char') targetRotation = -26; // 对应左侧 item-0
        else if (tab === 'heart') targetRotation = 0; // 对应中间 item-1
        else if (tab === 'user') targetRotation = 26; // 对应右侧 item-2
        
        wheel.style.setProperty('--rotation', targetRotation);
    }
}

// 【新增】：渲染聊天背景图库
function wcRenderChatBgGallery() {
    const gallery = document.getElementById('wc-chat-bg-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    
    if (wcState.chatBgPresets.length === 0) {
        gallery.innerHTML = '<div style="color:#999; font-size:12px;">暂无保存的背景</div>';
        return;
    }
    
    wcState.chatBgPresets.forEach((bg, idx) => {
        const item = document.createElement('div');
        item.className = 'wallpaper-item';
        item.style.backgroundImage = `url('${bg}')`;
        item.style.width = '60px';
        item.style.height = '80px';
        item.style.flexShrink = '0';
        item.style.position = 'relative';
        item.style.borderRadius = '6px';
        item.style.backgroundSize = 'cover';
        item.style.cursor = 'pointer';
        
        // 点击应用背景
        item.onclick = () => {
            document.getElementById('wc-setting-bg-preview').src = bg;
            document.getElementById('wc-setting-bg-preview').style.display = 'block';
            document.getElementById('wc-setting-bg-text').style.display = 'none';
            wcState.tempImage = bg;
            wcState.tempImageType = 'setting-bg';
            wcState.tempBgCleared = false;
        };
        
        // 删除按钮
        const del = document.createElement('div');
        del.className = 'wallpaper-delete';
        del.innerText = '×';
        del.onclick = (e) => {
            e.stopPropagation();
            wcState.chatBgPresets.splice(idx, 1);
            wcSaveData();
            wcRenderChatBgGallery();
        };
        
        item.appendChild(del);
        gallery.appendChild(item);
    });
}

function wcOpenChatSettings() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    if (!char.chatConfig) char.chatConfig = { userAvatar: wcState.user.avatar, userName: wcState.user.name, userPersona: wcState.user.persona, contextLimit: 0, summaryTrigger: 0, stickerGroupIds: [], backgroundImage: "", customCss: "", worldbookEntries: [] };
    
    // Populate Top UI
    document.getElementById('wc-cs-char-avatar-display').src = char.avatar;
    document.getElementById('wc-cs-char-name-display').innerText = char.name;
    document.getElementById('wc-cs-user-avatar-display').src = char.chatConfig.userAvatar || wcState.user.avatar;
    document.getElementById('wc-cs-user-name-display').innerText = char.chatConfig.userName || wcState.user.name;

    // Populate Inputs
    document.getElementById('wc-setting-char-avatar').src = char.avatar;
    document.getElementById('wc-setting-char-name').value = char.name;
    document.getElementById('wc-setting-char-gender').value = char.gender || "";
    document.getElementById('wc-setting-char-note').value = char.note || "";
    document.getElementById('wc-setting-char-prompt').value = char.prompt || "";
    document.getElementById('wc-setting-life-status-toggle').checked = char.chatConfig.lifeStatusEnabled !== false; // 默认开启
    // 读取拉黑状态并更新按钮
    // 获取需要隐藏的元素容器 (加入防空保护)
    const nameRow = document.getElementById('wc-setting-char-name') ? document.getElementById('wc-setting-char-name').closest('.wc-avatar-row') : null;
    const noteRow = document.getElementById('wc-setting-char-note') ? document.getElementById('wc-setting-char-note').closest('.wc-form-group') : null;
    const promptRow = document.getElementById('wc-setting-char-prompt') ? document.getElementById('wc-setting-char-prompt').closest('.wc-form-group') : null;
    const singleOnlySection = document.getElementById('wc-setting-single-only-section');
    const bilingualContainer = document.getElementById('wc-setting-bilingual-container');

    const blockBtn = document.getElementById('wc-setting-block-btn');
    const groupMembersSection = document.getElementById('wc-setting-group-members-section');
    
    // 👇 获取城市和生活状态的容器
    const locSection = document.getElementById('wc-setting-loc-display') ? document.getElementById('wc-setting-loc-display').closest('.wc-form-group') : null;
    const lifeStatusSection = document.getElementById('wc-setting-life-status-toggle') ? document.getElementById('wc-setting-life-status-toggle').closest('.wc-form-group') : null;

    if (char.isGroup) {
        // 【群聊模式】：保留头像和名称，隐藏备注、人设、主动性、表情包、拉黑、城市、生活状态
        if(nameRow) {
            nameRow.style.display = 'flex'; // 恢复显示头像和名称
            const nameLabel = nameRow.querySelector('.wc-form-label');
            if(nameLabel) nameLabel.innerText = '群聊名称'; // 动态改个字，防止误解
        }
        if(noteRow) noteRow.style.display = 'none';
        if(promptRow) promptRow.style.display = 'none';
        if(singleOnlySection) singleOnlySection.style.display = 'none';
        if(bilingualContainer) bilingualContainer.style.display = 'none';
        if(locSection) locSection.style.display = 'none'; // 隐藏城市信息
        if(lifeStatusSection) lifeStatusSection.style.display = 'none'; // 隐藏生活状态
        
        if(blockBtn) blockBtn.style.display = 'none';
        renderGroupMembersInSettings(char);
    } else {
        // 【单聊模式】：恢复显示所有设置
        if(nameRow) {
            nameRow.style.display = 'flex';
            const nameLabel = nameRow.querySelector('.wc-form-label');
            if(nameLabel) nameLabel.innerText = '名称'; // 恢复为单聊的名称
        }
        if(noteRow) noteRow.style.display = 'block';
        if(promptRow) promptRow.style.display = 'block';
        if(singleOnlySection) singleOnlySection.style.display = 'block';
        if(bilingualContainer) bilingualContainer.style.display = 'block';
        if(locSection) locSection.style.display = 'block'; // 恢复城市信息
        if(lifeStatusSection) lifeStatusSection.style.display = 'flex'; // 恢复生活状态

        if(blockBtn) blockBtn.style.display = 'block';
        if (groupMembersSection) groupMembersSection.style.display = 'none';
        
        if (char.isBlocked) {
            if(blockBtn) {
                blockBtn.innerText = "你已拉黑该角色";
                blockBtn.classList.add('blocked');
            }
        } else {
            if(blockBtn) {
                blockBtn.innerText = "拉黑该角色 (Block)";
                blockBtn.classList.remove('blocked');
            }
        }
    }


    document.getElementById('wc-setting-user-avatar').src = char.chatConfig.userAvatar || wcState.user.avatar;
    document.getElementById('wc-setting-user-name').value = char.chatConfig.userName || wcState.user.name;
    document.getElementById('wc-setting-user-gender').value = char.chatConfig.userGender || wcState.user.gender || "";
    document.getElementById('wc-setting-user-prompt').value = char.chatConfig.userPersona || wcState.user.persona;
    
    const maskSelect = document.getElementById('wc-setting-user-mask-select');
    maskSelect.innerHTML = '<option value="">选择面具...</option>';
    wcState.masks.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = m.name;
        maskSelect.appendChild(opt);
    });

    document.getElementById('wc-setting-context-limit').value = char.chatConfig.contextLimit || 0;
    // 👇 新增：读取气泡数限制 👇
    document.getElementById('wc-setting-reply-min').value = char.chatConfig.replyMin !== undefined ? char.chatConfig.replyMin : 3;
    document.getElementById('wc-setting-reply-max').value = char.chatConfig.replyMax !== undefined ? char.chatConfig.replyMax : 8;
    
    // 【修复】：正确读取双语设置到界面，而不是覆盖数据
    document.getElementById('wc-setting-bilingual-toggle').checked = char.chatConfig.bilingualEnabled || false;
    document.getElementById('wc-setting-bilingual-source').value = char.chatConfig.bilingualSource || '英语';
    document.getElementById('wc-setting-bilingual-target').value = char.chatConfig.bilingualTarget || '中文';
    
    // 新增：读取时间感知设置
    const timePerceptionToggle = document.getElementById('wc-setting-time-perception-toggle');
    if (timePerceptionToggle) {
        timePerceptionToggle.checked = char.chatConfig.timePerceptionEnabled !== false; // 默认开启
    }

    // 👇 新增：读取顶栏双头像设置 👇
    const topbarAvatarsToggle = document.getElementById('wc-setting-topbar-avatars-toggle');
    if (topbarAvatarsToggle) {
        topbarAvatarsToggle.checked = char.chatConfig.topbarAvatarsEnabled === true;
    }
    // 👆 新增结束 👆

    document.getElementById('wc-setting-proactive-toggle').checked = char.chatConfig.proactiveEnabled || false;

    document.getElementById('wc-setting-proactive-interval').value = char.chatConfig.proactiveInterval || 60;
    document.getElementById('wc-setting-moment-freq').value = char.chatConfig.momentFreq || 0;
    
    const npcCommentToggle = document.getElementById('wc-setting-moment-npc-comment');
    if (npcCommentToggle) {
        npcCommentToggle.checked = char.chatConfig.momentNpcCommentEnabled !== false; // 默认开启
    }
    // 👇 新增：动态注入后台小动作概率滑块 👇
    let bgUpdateGroup = document.getElementById('wc-bg-update-group');
    if (!bgUpdateGroup) {
        const momentFreqEl = document.getElementById('wc-setting-moment-freq');
        if (momentFreqEl) {
            const parent = momentFreqEl.closest('.wc-form-group') || momentFreqEl.parentElement;
            bgUpdateGroup = document.createElement('div');
            bgUpdateGroup.id = 'wc-bg-update-group';
            bgUpdateGroup.className = 'wc-form-group';
            bgUpdateGroup.innerHTML = `
                <label class="wc-form-label">后台小动作概率 (改备注/签名/找NPC) <span id="bg-update-freq-val">30%</span></label>
                <input type="range" id="wc-setting-bg-update-freq" min="0" max="100" value="30" class="wc-form-input" style="padding:0;" oninput="document.getElementById('bg-update-freq-val').innerText = this.value + '%'">
            `;
            parent.parentNode.insertBefore(bgUpdateGroup, parent.nextSibling);
        }
    }
    if (document.getElementById('wc-setting-bg-update-freq')) {
        const val = char.chatConfig.bgUpdateFreq !== undefined ? char.chatConfig.bgUpdateFreq : 30;
        document.getElementById('wc-setting-bg-update-freq').value = val;
        document.getElementById('bg-update-freq-val').innerText = val + '%';
    }
    // 👆 新增结束 👆

    // 👇 新增：群聊专属世界书列表初始化 👇
    const groupWbList = document.getElementById('wc-setting-group-worldbook-list');
    if (groupWbList) {
        groupWbList.innerHTML = '';
        let groupWbCount = 0;
        if (char.chatConfig.worldbookEntries) {
            char.chatConfig.worldbookEntries.forEach(id => {
                groupWbList.innerHTML += `<input type="checkbox" value="${id}" checked>`;
                groupWbCount++;
            });
        }
        const groupWbCountEl = document.getElementById('wc-setting-group-wb-count');
        if (groupWbCountEl) groupWbCountEl.innerText = `已选 ${groupWbCount} 项`;
    }
    // 👆 新增结束 👆

    // 👇 新增：单聊专属世界书列表初始化 (修复串门Bug) 👇
    const singleWbList = document.getElementById('wc-setting-worldbook-list');
    if (singleWbList) {
        singleWbList.innerHTML = '';
        let singleWbCount = 0;
        if (char.chatConfig.worldbookEntries) {
            char.chatConfig.worldbookEntries.forEach(id => {
                singleWbList.innerHTML += `<input type="checkbox" value="${id}" checked>`;
                singleWbCount++;
            });
        }
        const singleWbCountEl = document.getElementById('wc-setting-wb-count');
        if (singleWbCountEl) singleWbCountEl.innerText = `已选 ${singleWbCount} 项`;
    }
    // 👆 新增结束 👆

    const stickerList = document.getElementById('wc-setting-sticker-group-list');
    stickerList.innerHTML = '';
    wcState.stickerCategories.forEach((cat, idx) => {
        const div = document.createElement('div');
        div.className = 'wc-checkbox-item';
        const isChecked = char.chatConfig.stickerGroupIds && char.chatConfig.stickerGroupIds.includes(idx);
        div.innerHTML = `<input type="checkbox" value="${idx}" ${isChecked ? 'checked' : ''} onchange="calculateRealtimeTokens()"><span>${cat.name}</span>`;
        stickerList.appendChild(div);
    });

    const bgPreview = document.getElementById('wc-setting-bg-preview');
    if (char.chatConfig.backgroundImage) {
        bgPreview.src = char.chatConfig.backgroundImage;
        bgPreview.style.display = 'block';
        document.getElementById('wc-setting-bg-text').style.display = 'none';
    } else {
        bgPreview.style.display = 'none';
        document.getElementById('wc-setting-bg-text').style.display = 'block';
    }
    document.getElementById('wc-setting-custom-css').value = char.chatConfig.customCss || "";
    wcUpdateCssPresetSelect();
    wcState.tempImage = '';
    
    // Default to Heart (Advanced) tab
    wcSwitchChatSettingsTab('heart');
    
    wcRenderChatBgGallery(); // 【新增】：打开设置时渲染图库
    
    // 👇 新增：打开设置时自动计算 Token 和 查询额度
    calculateRealtimeTokens();
    refreshApiQuota();
    
    wcOpenModal('wc-modal-chat-settings');
}
// ==========================================
// 新增：聊天设置星际轨道滑动切换逻辑
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById('wc-cs-nav-container');
    if (!navContainer) return;

    let startX = 0;
    const tabs = ['char', 'heart', 'user'];

    navContainer.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
    }, {passive: true});

    navContainer.addEventListener('touchend', e => {
        let endX = e.changedTouches[0].clientX;
        let diff = endX - startX;
        
        // 找到当前激活的 tab 索引
        let currentIdx = 1; // 默认 heart
        if (document.getElementById('wc-cs-char-btn').classList.contains('active')) currentIdx = 0;
        if (document.getElementById('wc-cs-user-btn').classList.contains('active')) currentIdx = 2;

        if (diff > 50 && currentIdx > 0) {
            wcSwitchChatSettingsTab(tabs[currentIdx - 1]); // 向右滑，看左边的
        } else if (diff < -50 && currentIdx < 2) {
            wcSwitchChatSettingsTab(tabs[currentIdx + 1]); // 向左滑，看右边的
        }
    });
});

function wcImportMaskToChat(maskId) {
    if (!maskId) return;
    const mask = wcState.masks.find(m => m.id == maskId);
    if (mask) {
        document.getElementById('wc-setting-user-name').value = mask.name;
        document.getElementById('wc-cs-user-name-display').innerText = mask.name; // Sync top UI
        document.getElementById('wc-setting-user-prompt').value = mask.prompt;
        document.getElementById('wc-setting-user-avatar').src = mask.avatar;
        document.getElementById('wc-cs-user-avatar-display').src = mask.avatar; // Sync top UI
    }
}

function wcClearChatBackground() {
    document.getElementById('wc-setting-bg-preview').src = "";
    document.getElementById('wc-setting-bg-preview').style.display = 'none';
    document.getElementById('wc-setting-bg-text').style.display = 'block';
    wcState.tempBgCleared = true;
}

async function wcSaveChatSettings() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    
    char.name = document.getElementById('wc-setting-char-name').value;
    char.gender = document.getElementById('wc-setting-char-gender').value.trim();
    char.note = document.getElementById('wc-setting-char-note').value;
    char.prompt = document.getElementById('wc-setting-char-prompt').value;
    // 拉黑状态已在弹窗确认时保存，这里无需再读取
    if (wcState.tempImage && wcState.tempImageType === 'setting-char') char.avatar = wcState.tempImage;

    if (!char.chatConfig) char.chatConfig = {};
    char.chatConfig.userName = document.getElementById('wc-setting-user-name').value;
    char.chatConfig.userGender = document.getElementById('wc-setting-user-gender').value.trim();
    char.chatConfig.userPersona = document.getElementById('wc-setting-user-prompt').value;
    char.chatConfig.lifeStatusEnabled = document.getElementById('wc-setting-life-status-toggle').checked;
    
    if (wcState.tempImage && wcState.tempImageType === 'setting-user') {
        char.chatConfig.userAvatar = wcState.tempImage;
    } else if (document.getElementById('wc-setting-user-avatar').src.startsWith('data:')) {
        char.chatConfig.userAvatar = document.getElementById('wc-setting-user-avatar').src;
    }

    char.chatConfig.contextLimit = parseInt(document.getElementById('wc-setting-context-limit').value) || 0;
    // 👇 新增：保存气泡数限制 👇
    char.chatConfig.replyMin = parseInt(document.getElementById('wc-setting-reply-min').value) || 3;
    char.chatConfig.replyMax = parseInt(document.getElementById('wc-setting-reply-max').value) || 8;
    
    // 【修复】：在这里真正保存双语设置
    char.chatConfig.bilingualEnabled = document.getElementById('wc-setting-bilingual-toggle').checked;
    char.chatConfig.bilingualSource = document.getElementById('wc-setting-bilingual-source').value.trim();
    char.chatConfig.bilingualTarget = document.getElementById('wc-setting-bilingual-target').value.trim();
    
    // 新增：保存时间感知设置
    const timePerceptionToggle = document.getElementById('wc-setting-time-perception-toggle');
    if (timePerceptionToggle) {
        char.chatConfig.timePerceptionEnabled = timePerceptionToggle.checked;
    }

    // 👇 新增：保存顶栏双头像设置 👇
    const topbarAvatarsToggle = document.getElementById('wc-setting-topbar-avatars-toggle');
    if (topbarAvatarsToggle) {
        char.chatConfig.topbarAvatarsEnabled = topbarAvatarsToggle.checked;
    }
    // 👆 新增结束 👆

    char.chatConfig.proactiveEnabled = document.getElementById('wc-setting-proactive-toggle').checked;

    char.chatConfig.proactiveInterval = parseInt(document.getElementById('wc-setting-proactive-interval').value) || 60;
    char.chatConfig.momentFreq = parseInt(document.getElementById('wc-setting-moment-freq').value) || 0;
    
    // 👇 新增：保存 NPC 评论开关状态 👇
    const npcCommentToggle = document.getElementById('wc-setting-moment-npc-comment');
    if (npcCommentToggle) {
        char.chatConfig.momentNpcCommentEnabled = npcCommentToggle.checked;
    }
    // 👆 新增结束 👆

    // 👇 新增：动态注入后台小动作概率滑块 👇
    const bgUpdateFreqInput = document.getElementById('wc-setting-bg-update-freq');
    if (bgUpdateFreqInput) {
        char.chatConfig.bgUpdateFreq = parseInt(bgUpdateFreqInput.value) || 0;
    }
    // 👆 新增结束 👆

    // 👇 核心修复：根据单聊/群聊状态，精准读取对应的世界书列表，防止旧数据互相污染 👇
    let selectedWbIds = [];
    if (char.isGroup) {
        const groupWbCheckboxes = document.querySelectorAll('#wc-setting-group-worldbook-list input[type="checkbox"]:checked');
        selectedWbIds = Array.from(groupWbCheckboxes).map(cb => cb.value);
    } else {
        const wbCheckboxes = document.querySelectorAll('#wc-setting-worldbook-list input[type="checkbox"]:checked');
        selectedWbIds = Array.from(wbCheckboxes).map(cb => cb.value);
    }
    char.chatConfig.worldbookEntries = selectedWbIds;
    // 👆 修复结束 👆

    const stickerCheckboxes = document.querySelectorAll('#wc-setting-sticker-group-list input[type="checkbox"]:checked');
    char.chatConfig.stickerGroupIds = Array.from(stickerCheckboxes).map(cb => parseInt(cb.value));

    if (wcState.tempImage && wcState.tempImageType === 'setting-bg') char.chatConfig.backgroundImage = wcState.tempImage;
    else if (wcState.tempBgCleared) char.chatConfig.backgroundImage = "";
    wcState.tempBgCleared = false;

    char.chatConfig.customCss = document.getElementById('wc-setting-custom-css').value;
    
    const charIndex = wcState.characters.findIndex(c => c.id === char.id);
    if (charIndex !== -1) {
        wcState.characters[charIndex] = char;
    }
    await wcWriteCharactersPersistentSnapshot();
    try {
        await wcDb.put('characters', char);
    } catch (e) {
        console.warn('聊天联系人配置写入 IndexedDB 失败，已保留本地兜底快照', e);
    }
    await wcSaveData();
    
    updateChatTopBarStatus(char);
    wcApplyChatConfig(char);
    wcRenderMessages(char.id); 
    wcRenderChats(); 

    if (char.chatConfig.stickerGroupIds.length > 0 && !char.chatConfig.stickerGroupIds.includes(wcState.activeStickerCategoryIndex)) {
        wcState.activeStickerCategoryIndex = char.chatConfig.stickerGroupIds[0];
    } else if (char.chatConfig.stickerGroupIds.length === 0) {
        wcState.activeStickerCategoryIndex = 0;
    }
    
    wcRenderStickerPanel();
    wcCloseModal('wc-modal-chat-settings');
}

async function wcClearAllCssBeautification() {
    if (confirm("确定要清空所有角色的 CSS 美化代码吗？\n（仅清空当前应用的 CSS，不影响预设库和其他聊天设置）")) {
        let clearedCount = 0;
        
        // 遍历所有角色，精准清空 customCss 字段
        wcState.characters.forEach(char => {
            if (char.chatConfig && char.chatConfig.customCss) {
                char.chatConfig.customCss = "";
                clearedCount++;
            }
        });
        
        if (clearedCount > 0) {
            await wcSaveData();
            
            // 如果当前正好停留在某个聊天界面，实时移除样式
            if (wcState.activeChatId) {
                const activeChar = wcState.characters.find(c => c.id === wcState.activeChatId);
                if (activeChar) wcApplyChatConfig(activeChar);
            }
            
            alert(`清理完毕！已成功清空 ${clearedCount} 个角色的 CSS 美化代码。`);
        } else {
            alert("当前没有任何角色使用了 CSS 美化代码哦~");
        }
    }
}

// ==========================================
// 新增：清空当前聊天记录逻辑
// ==========================================
window.wcClearChatHistory = function() {
    const charId = wcState.activeChatId;
    if (!charId) return;
    
    if (confirm("确定要清空当前角色的所有聊天记录吗？此操作不可恢复！")) {
        wcState.chats[charId] = [];
        wcSaveData();
        wcRenderMessages(charId);
        wcRenderChats();
        alert("聊天记录已清空！");
        wcCloseModal('wc-modal-chat-settings');
    }
};

// --- WeChat Render All ---

function wcUpdateCssPresetSelect() {
    const select = document.getElementById('wc-setting-css-preset-select');
    select.innerHTML = '<option value="">选择预设...</option>';
    wcState.cssPresets.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = p.name;
        select.appendChild(opt);
    });
}

function wcSaveCssPreset() {
    const css = document.getElementById('wc-setting-custom-css').value;
    if (!css) return alert("CSS 内容为空");
    const name = prompt("请输入预设名称：");
    if (name) {
        wcState.cssPresets.push({ name, css });
        wcSaveData();
        wcUpdateCssPresetSelect();
        alert("预设已保存");
    }
}

function wcDeleteCssPreset() {
        const select = document.getElementById('wc-setting-css-preset-select');
    const idx = select.value;
    if (idx === "") return alert("请先选择一个预设");
    
    if (confirm("确定删除该 CSS 预设吗？")) {
        wcState.cssPresets.splice(idx, 1);
        wcSaveData();
        wcUpdateCssPresetSelect();
        document.getElementById('wc-setting-custom-css').value = ""; 
    }
}

function wcApplyCssPreset(idx) {
    if (idx === "") return;
    const preset = wcState.cssPresets[idx];
    if (preset) document.getElementById('wc-setting-custom-css').value = preset.css;
}

// --- WeChat Masks ---
// 1. 打开旧版弹窗 (用于快速切换)
function wcOpenQuickMaskSelect() { 
    wcOpenModal('wc-modal-masks'); 
    wcRenderMasks(); 
}

// 2. 打开新版全屏页 (用于管理)
function wcOpenFullScreenMasks() {
    document.getElementById('wc-view-masks-fullscreen').classList.add('active');
    if (typeof wcRenderFullScreenMasks === 'function') {
        wcRenderFullScreenMasks();
    }
}

// 3. 关闭全屏页
window.wcCloseMasksFullscreen = function() {
    document.getElementById('wc-view-masks-fullscreen').classList.remove('active');
};

// 4. 渲染旧版弹窗列表 (去除了删除按钮，只保留使用)
function wcRenderMasks() {
    const list = document.getElementById('wc-masks-list');
    if (!list) return;
    list.innerHTML = '';
    wcState.masks.forEach(mask => {
        const div = document.createElement('div');
        div.className = 'wc-list-item';
        div.innerHTML = `
            <img src="${mask.avatar}" class="wc-avatar">
            <div class="wc-item-content">
                <div class="wc-item-title">${mask.name}</div>
                <div class="wc-item-subtitle">${mask.prompt.substring(0, 20)}...</div>
            </div>
            <button class="wc-nav-btn" style="color:#007AFF; font-weight:bold;" onclick="wcApplyMask(${mask.id})">使用</button>
        `;
        list.appendChild(div);
    });
}

// 5. 覆盖旧的 wcApplyMask，确保同时关闭两个视图
const originalWcApplyMask = wcApplyMask;
window.wcApplyMask = function(id) {
    originalWcApplyMask(id);
    wcCloseMasksFullscreen();
    wcCloseModal('wc-modal-masks');
};

// 6. 覆盖旧的 wcSaveMask，保存后刷新两个视图
const originalWcSaveMask = wcSaveMask;
window.wcSaveMask = function() {
    originalWcSaveMask();
    wcRenderMasks();
    if (typeof wcRenderFullScreenMasks === 'function') {
        wcRenderFullScreenMasks();
    }
};

// 7. 覆盖旧的 wcDeleteMask，删除后刷新两个视图
const originalWcDeleteMask = wcDeleteMask;
window.wcDeleteMask = function(id) {
    originalWcDeleteMask(id);
    wcRenderMasks();
    if (typeof wcRenderFullScreenMasks === 'function') {
        wcRenderFullScreenMasks();
    }
};

function wcOpenEditMask(id = null) {
    wcState.editingMaskId = id;
    wcState.tempImage = '';
    if (id) {
        const mask = wcState.masks.find(m => m.id === id);
        document.getElementById('wc-mask-modal-title').innerText = '编辑面具';
        document.getElementById('wc-input-mask-name').value = mask.name;
        document.getElementById('wc-input-mask-gender').value = mask.gender || '';
        document.getElementById('wc-input-mask-prompt').value = mask.prompt;
        document.getElementById('wc-preview-mask-avatar').src = mask.avatar;
    } else {
        document.getElementById('wc-mask-modal-title').innerText = '新建面具';
        document.getElementById('wc-input-mask-name').value = '';
        document.getElementById('wc-input-mask-gender').value = '';
        document.getElementById('wc-input-mask-prompt').value = '';
        document.getElementById('wc-preview-mask-avatar').src = '';
    }
    wcOpenModal('wc-modal-edit-mask');
}
function wcSaveMask() {
    const name = document.getElementById('wc-input-mask-name').value;
    const gender = document.getElementById('wc-input-mask-gender').value.trim();
    const prompt = document.getElementById('wc-input-mask-prompt').value;
    const avatar = wcState.tempImage || (wcState.editingMaskId ? wcState.masks.find(m=>m.id===wcState.editingMaskId).avatar : wcState.user.avatar);
    if (!name) return alert('请输入名称');
    if (wcState.editingMaskId) {
        const mask = wcState.masks.find(m => m.id === wcState.editingMaskId);
        mask.name = name; mask.gender = gender; mask.prompt = prompt; mask.avatar = avatar;
    } else {
        wcState.masks.push({ id: Date.now(), name, gender, prompt, avatar });
    }
    wcSaveData();
    wcCloseModal('wc-modal-edit-mask');
    wcRenderMasks();
}
function wcDeleteMask(id) {
    if(confirm('删除此面具？')) { 
        wcState.masks = wcState.masks.filter(m => m.id !== id); 
        wcDb.delete('masks', id); // 新增：从底层数据库中彻底删除该面具
        wcSaveData(); 
        wcRenderMasks(); 
    }
}
function wcApplyMask(id) {
    const mask = wcState.masks.find(m => m.id === id);
    if (mask) {
        wcState.user.name = mask.name; 
        wcState.user.avatar = mask.avatar; 
        wcState.user.persona = mask.prompt; // 正常读取人设给AI看
        wcState.user.bio = mask.bio || '记录生活的美好'; // 👈 新增：读取面具专属的个性签名
        wcState.user.maskId = mask.id; 
        wcSaveData(); wcRenderUser(); wcCloseModal('wc-modal-masks'); alert(`已切换身份为：${mask.name}`);
    }
}

// --- WeChat Modals ---
function wcOpenModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('hidden');
    modal.classList.add('active'); 
    wcState.tempImage = ''; 
    
    if(id === 'wc-modal-add-char') {
        document.getElementById('wc-preview-char-avatar').style.display = 'none';
        document.getElementById('wc-icon-char-upload').style.display = 'block';
        document.getElementById('wc-input-char-name').value = '';
        document.getElementById('wc-input-char-note').value = '';
        document.getElementById('wc-input-char-prompt').value = '';
    }
}

function wcCloseModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
    modal.classList.remove('active');
}

function wcToggleMomentType(type) {
    wcState.momentType = type;
    const descArea = document.getElementById('wc-area-desc-img');
    const localImgBox = document.getElementById('wc-area-local-img-box');
    
    if (descArea) descArea.style.display = type === 'desc' ? 'block' : 'none';
    
    if (type === 'desc') {
        if (localImgBox) localImgBox.style.display = 'none';
    } else {
        if (localImgBox && wcState.tempImage) localImgBox.style.display = 'block';
    }
}

window.wcClearMomentImage = function() {
    wcState.tempImage = '';
    const previewImg = document.getElementById('wc-preview-moment-img');
    const imgBox = document.getElementById('wc-area-local-img-box');
    if (previewImg) previewImg.src = '';
    if (imgBox) imgBox.style.display = 'none';
};

// ==========================================
// 新增：朋友圈 AI 互动逻辑 (单条触发版)
// ==========================================
let currentActionMomentId = null;

// 控制弹出菜单的显示与隐藏
window.wcToggleMomentMenu = function(e, id) {
    e.stopPropagation();
    // 先关闭其他所有打开的菜单
    document.querySelectorAll('.wc-moment-popover').forEach(el => {
        if (el.id !== `moment-popover-${id}`) el.classList.remove('active');
    });
    // 切换当前菜单
    const popover = document.getElementById(`moment-popover-${id}`);
    if (popover) popover.classList.toggle('active');
};

// 全局点击事件：点击空白处隐藏所有弹出菜单
document.addEventListener('click', () => {
    document.querySelectorAll('.wc-moment-popover').forEach(el => el.classList.remove('active'));
});

window.wcOpenMomentAISelectForSingle = function(e, momentId) {
    e.stopPropagation();
    // 隐藏菜单
    document.querySelectorAll('.wc-moment-popover').forEach(el => el.classList.remove('active'));
    
    currentActionMomentId = momentId;
    const list = document.getElementById('wc-moment-ai-char-list');
    list.innerHTML = '';
    
    const chars = wcState.characters.filter(c => !c.isGroup);
    if (chars.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">暂无联系人</div>';
    } else {
        chars.forEach(char => {
            const div = document.createElement('div');
            div.className = 'wc-list-item';
            div.style.background = 'white';
            div.style.borderBottom = '1px solid #F0F0F0';
            div.innerHTML = `
                <img src="${char.avatar}" class="wc-avatar" style="width:36px;height:36px;">
                <div class="wc-item-content"><div class="wc-item-title">${char.name}</div></div>
                <button class="wc-btn-mini" style="background:#AF52DE; color:white; border:none; padding:6px 16px; border-radius:16px; font-weight:bold;" onclick="wcExecuteSingleMomentAI(${char.id})">召唤</button>
            `;
            list.appendChild(div);
        });
    }
    setTimeout(() => wcOpenModal('wc-modal-moment-ai-select'), 300); // 延迟等待上一个弹窗收起
};

window.wcExecuteSingleMomentAI = async function(charId) {
    const char = wcState.characters.find(c => c.id === charId);
    const targetMoment = wcState.moments.find(m => m.id === currentActionMomentId);
    if (!char || !targetMoment) return;

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcCloseModal('wc-modal-moment-ai-select');
    wcShowLoading(`正在召唤 ${char.name} 来看这条朋友圈...`);

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 提取最近聊天记录
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-20).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        // 获取当前时间
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeString = `${year}年${month}月${date}日 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];

        // 只提取当前这条朋友圈的信息
        const commentsStr = targetMoment.comments ? targetMoment.comments.map(c => `${c.name}: ${c.text}`).join(' | ') : '无';
        const likesStr = targetMoment.likes ? targetMoment.likes.join(', ') : '无';
        const momentText = `[朋友圈ID:${targetMoment.id}] 发帖人:${targetMoment.name} | 内容:${targetMoment.text} | 图片:${targetMoment.imageDesc || '无'} | 点赞:[${likesStr}] | 评论:[${commentsStr}]`;

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += `【当前现实时间】：${timeString} ${dayString}\n`;
        prompt += `【最近聊天记录】：\n${recentMsgs ? recentMsgs : '暂无聊天记录'}\n\n`;
        prompt += `【当前你正在看的一条朋友圈】：\n${momentText}\n\n`;
        prompt += `请根据你的人设、当前时间、最近的聊天记录，对这条朋友圈进行互动（点赞、评论、或回复别人的评论）。\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 互动必须符合你的人设和你们之间的关系。\n`;
        prompt += `2. 【时间观念警告】：请务必注意当前时间！评论内容必须符合当前的时间点！\n`;
        prompt += `3. 【结合上下文】：请结合【最近聊天记录】和【朋友圈内容】进行回复，不要说一些毫不相干的话。\n`;
        prompt += `4. 如果是回复某人的评论，请使用 reply 类型，并指定 targetName。\n`;
        prompt += `5. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "actions": [
    {"type": "like", "momentId": ${targetMoment.id}},
    {"type": "comment", "momentId": ${targetMoment.id}, "content": "你的评论内容"}
  ]
}\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 4000
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        let actionLogs = [];

        if (result.actions && result.actions.length > 0) {
            result.actions.forEach(action => {
                const momentId = parseInt(action.momentId);
                if (!momentId) return;
                
                const moment = wcState.moments.find(m => m.id === momentId);
                if (!moment) return;

                if (action.type === 'like') {
                    if (!moment.likes) moment.likes = [];
                    if (!moment.likes.includes(char.name)) {
                        moment.likes.push(char.name);
                        actionLogs.push(`点赞了 ${moment.name} 的朋友圈("${moment.text.substring(0,10)}...")`);
                    }
                } else if (action.type === 'comment') {
                    if (!moment.comments) moment.comments = [];
                    moment.comments.push({ name: char.name, text: action.content });
                    actionLogs.push(`评论了 ${moment.name} 的朋友圈: "${action.content}"`);
                } else if (action.type === 'reply') {
                    if (!moment.comments) moment.comments = [];
                    moment.comments.push({ name: char.name, text: `回复 ${action.targetName}: ${action.content}` });
                    actionLogs.push(`在 ${moment.name} 的朋友圈回复了 ${action.targetName}: "${action.content}"`);
                }
            });

            wcSaveData();
            wcRenderMoments();

            if (actionLogs.length > 0) {
                const logText = `[系统内部信息(仅AI可见): 你刚刚在朋友圈进行了以下互动：\n- ${actionLogs.join('\n- ')}\n请在接下来的聊天中记住这些事。]`;
                wcAddMessage(char.id, 'system', 'system', logText, { hidden: true });
            }

            wcShowSuccess("互动成功！");
        } else {
            wcShowSuccess("Ta 看了看，什么都没说");
        }

    } catch (e) {
        console.error(e);
        wcShowError("召唤失败");
    }
};

function wcSaveMoment() {
    const text = document.getElementById('wc-input-moment-text').value;
    let image = null; let imageDesc = null;
    if (wcState.momentType === 'local') image = wcState.tempImage; else imageDesc = document.getElementById('wc-input-moment-desc').value;
    if (!text && !image && !imageDesc) return alert('请输入内容');
    wcState.moments.unshift({ id: Date.now(), name: wcState.user.name, avatar: wcState.user.avatar, text: text, image: image, imageDesc: imageDesc, time: Date.now(), likes: [], comments: [] });
    wcSaveData();
    document.getElementById('wc-input-moment-text').value = ''; document.getElementById('wc-input-moment-desc').value = ''; wcState.tempImage = '';
    wcCloseModal('wc-modal-post-moment'); wcRenderMoments();
}

function wcDeleteMoment(id) { if(confirm('删除？')) { wcState.moments = wcState.moments.filter(m => m.id !== id); wcDb.delete('moments', id); wcSaveData(); wcRenderMoments(); } }

function wcToggleLike(id) {
    const moment = wcState.moments.find(m => m.id === id); 
    if (!moment) return;
    
    if (!moment.likes) moment.likes = [];
    const userName = wcState.user.name;
    
    if (moment.likes.includes(userName)) {
        moment.likes = moment.likes.filter(n => n !== userName); 
    } else {
        moment.likes.push(userName);
    }
    
    wcSaveData(); 
    wcRenderMoments();
}

function wcToggleCommentBox(id) { 
    const box = document.getElementById(`wc-comment-box-${id}`); 
    box.style.display = box.style.display === 'none' ? 'flex' : 'none'; 
    wcState.replyingToComment = null;
    const input = document.getElementById(`wc-input-comment-${id}`);
    if(input) input.placeholder = "评论...";
}

function wcPrepareReply(momentId, commentIndex, name) {
    wcState.replyingToComment = { momentId, commentIndex, name };
    const box = document.getElementById(`wc-comment-box-${momentId}`);
    box.style.display = 'flex';
    const input = document.getElementById(`wc-input-comment-${momentId}`);
    if(input) {
        input.placeholder = `回复 ${name}...`;
        input.focus();
    }
}

function wcAddComment(id) {
    const input = document.getElementById(`wc-input-comment-${id}`); 
    const text = input.value; 
    if (!text) return;
    
    const moment = wcState.moments.find(m => m.id === id); 
    if (!moment) return;
    if (!moment.comments) moment.comments = [];
    
    let commentText = text;
    if (wcState.replyingToComment && wcState.replyingToComment.momentId === id) {
        commentText = `回复 ${wcState.replyingToComment.name}: ${text}`;
    }
    
    moment.comments.push({ name: wcState.user.name, text: commentText });
    wcSaveData(); 
    wcRenderMoments();
    
    wcState.replyingToComment = null;
    input.value = '';
}

// --- Proactive Message System ---
function initProactiveSystem() {
    if (wcState.proactiveInterval) clearInterval(wcState.proactiveInterval);
    wcState.proactiveInterval = setInterval(checkProactiveMessages, 60000);
}

function checkProactiveMessages() {
    const now = Date.now();
    const dateObj = new Date();
    const currentHHMM = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    const todayStr = dateObj.toDateString();

    // 👇 新增：检查红包 24 小时退款逻辑 👇
    wcCheckRedPacketRefunds(now);
    // 👆 新增结束 👆

    wcState.characters.forEach(char => {
        // 1. 检查食谱定时发送逻辑
        if (char.phoneData && char.phoneData.recipe && char.phoneData.recipe.ta) {
            const taRecipe = char.phoneData.recipe.ta;
            if (taRecipe.autoTime === currentHHMM && taRecipe.lastAutoSendDate !== todayStr) {
                console.log(`触发 ${char.name} 定时发送食谱`);
                // 标记为今天已发送，防止一分钟内重复触发
                taRecipe.lastAutoSendDate = todayStr;
                wcSaveData();
                // 后台静默生成并发送
                if (typeof wcGenerateTaRecipe === 'function') {
                    wcGenerateTaRecipe(true, char.id);
                }
            }
        }

        // 2. 原有的主动发消息逻辑
        if (char.chatConfig && char.chatConfig.proactiveEnabled) {
            const interval = (char.chatConfig.proactiveInterval || 60) * 60 * 1000; 
            const msgs = wcState.chats[char.id] || [];
            let lastTime = 0;
            
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (!msgs[i].isError && msgs[i].type !== 'system') {
                    lastTime = msgs[i].time;
                    break;
                }
            }

            if (lastTime === 0) lastTime = now; 

            if (now - lastTime > interval && !aiGeneratingLocks[char.id]) {
                console.log(`触发 ${char.name} 主动消息`);
                
                const gapMs = now - lastTime;
                const gapMinutes = Math.floor(gapMs / 60000);
                const gapHours = Math.floor(gapMinutes / 60);
                const gapDays = Math.floor(gapHours / 24);
                const remainHours = gapHours % 24;
                const remainMinutes = gapMinutes % 60;

                let timeGapStr = "";
                if (gapDays > 0) timeGapStr += `${gapDays}天`;
                if (remainHours > 0) timeGapStr += `${remainHours}小时`;
                if (remainMinutes > 0 || timeGapStr === "") timeGapStr += `${remainMinutes}分钟`;

                const nowStr = new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                const isTimePerceptionEnabled = char.chatConfig && char.chatConfig.timePerceptionEnabled !== false;
                let proactivePrompt = "";
                
                if (isTimePerceptionEnabled) {
                    proactivePrompt = `[系统通知：距离上次互动已过去 ${timeGapStr}。话题可能已中断。
请以 ${char.name} 的身份主动发起新话题，或自然地延续之前的对话，对时间流逝做出反应。

【行动前请在内部逻辑中进行深度考量】：
1. 现实感知：当前现实时间是 ${nowStr}。结合你的人设，你现在应该在做什么？
2. 动机分析：你为什么会突然给 User 发消息？
3. 绝对防 OOC：语气必须 100% 符合人设，像真人一样自然切入，拒绝AI味。
考量完毕后，直接输出符合你人设的 JSON 消息数组！]`;
                } else {
                    proactivePrompt = `[系统通知：话题可能已中断。
请以 ${char.name} 的身份主动发起新话题，或自然地延续之前的对话。

【行动前请在内部逻辑中进行深度考量】：
1. 动机分析：你为什么会突然给 User 发消息？
2. 绝对防 OOC：语气必须 100% 符合人设，像真人一样自然切入，拒绝AI味。
考量完毕后，直接输出符合你人设的 JSON 消息数组！]`;
                }
                
                wcAddMessage(char.id, 'system', 'system', proactivePrompt, { hidden: true });
                wcTriggerAI(char.id);
            }
        }
    });
}

// Swipe Logic for WeChat
let wcXDown = null; let wcYDown = null; let wcCurrentSwipeElement = null;
function wcHandleTouchStartSwipe(evt) { wcXDown = evt.touches[0].clientX; wcYDown = evt.touches[0].clientY; wcCurrentSwipeElement = evt.currentTarget; }
function wcHandleTouchMoveSwipe(evt) {
    if (!wcXDown || !wcYDown) return;
    let xUp = evt.touches[0].clientX; let yUp = evt.touches[0].clientY;
    let xDiff = wcXDown - xUp; let yDiff = wcYDown - yUp;
    if (Math.abs(xDiff) > Math.abs(yDiff)) { 
        if (xDiff > 0) {
            const offset = -80; 
            wcCurrentSwipeElement.style.transform = `translateX(${offset}px)`; 
        } else {
            wcCurrentSwipeElement.style.transform = 'translateX(0px)'; 
        }
    }
}
function wcHandleTouchEndSwipe(evt) { wcXDown = null; wcYDown = null; }
// ==========================================
// 新增：红包 24 小时自动退款逻辑
// ==========================================
function wcCheckRedPacketRefunds(currentTime) {
    let hasRefund = false;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24小时的毫秒数

    // 遍历所有聊天记录
    for (const charId in wcState.chats) {
        const msgs = wcState.chats[charId];
        if (!msgs) continue;

        msgs.forEach(msg => {
            // 找到红包消息，且状态不是已领完(empty)也不是已退款(refunded)
            if (msg.type === 'redpacket' && msg.rpData && msg.rpData.status !== 'empty' && msg.rpData.status !== 'refunded') {
                const rp = msg.rpData;
                
                // 检查是否超过 24 小时
                if (currentTime - msg.time > ONE_DAY_MS) {
                    // 计算已领取的总金额
                    let grabbedAmount = 0;
                    rp.receivers.forEach(r => { grabbedAmount += r.amount; });
                    
                    // 计算需要退款的剩余金额
                    const refundAmount = rp.totalAmount - grabbedAmount;
                    
                    if (refundAmount > 0) {
                        // 1. 退回钱包余额
                        wcState.wallet.balance += refundAmount;
                        
                        // 2. 生成退款账单
                        wcState.wallet.transactions.push({
                            id: Date.now() + Math.random(), 
                            type: 'income', 
                            amount: refundAmount, 
                            note: `微信红包退款`, 
                            time: currentTime
                        });

                        // 3. 更新红包状态
                        rp.status = 'refunded';
                        
                        // 4. 在聊天界面插入系统提示
                        wcAddMessage(charId, 'system', 'system', `[系统提示: 你的红包已超过24小时，剩余 ¥${refundAmount.toFixed(2)} 已退回零钱]`, { style: 'transparent' });
                        
                        hasRefund = true;
                    } else {
                        // 如果金额其实已经被领完了（容错处理），直接标记为 empty
                        rp.status = 'empty';
                        hasRefund = true;
                    }
                }
            }
        });
    }

    if (hasRefund) {
        wcSaveData();
        // 如果当前停留在钱包页面，刷新钱包 UI
        if (document.getElementById('wc-view-wallet') && document.getElementById('wc-view-wallet').classList.contains('active')) {
            wcRenderWallet();
        }
        // 如果当前停留在聊天页面，刷新聊天 UI
        if (wcState.activeChatId) {
            wcRenderMessages(wcState.activeChatId);
        }
    }
}

