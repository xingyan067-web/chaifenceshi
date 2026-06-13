// --- Lovers Space State ---
const lsState = {
    timeAlbum: [], // 新增：时光相册日记数据
    decorImages: [], // 新增：桌面装修图库
    shopCategories: [], // 商城分类
    shopMenu: [], // 商城菜品列表
    shopCart: [], // 购物车
    shopOrders: [], // 历史订单
    inventory: [], // 新增：特权背包
    activeShopCategoryId: null, // 当前选中的分类
    isShopEditMode: false, // 是否处于修改模式
    editingShopItemId: null, // 当前正在编辑的菜品ID
    boundCharId: null, 
    pendingCharId: null, 
    startDate: null, 
    isLinked: false, 
    locationSyncEnabled: false, 
    npcFreq: 30, 
    npcInterval: null, 
    feed: [], 
    widgetArchive: [], // 👈 新增：用于存储小组件回忆墙数据
    widgetEnabled: false,
    widgetUpdateFreq: 20, 
    widgetData: {
        type: 'photo', 
        photoDesc: '一张拍立得照片',
        noteText: '今天也要开心哦！',
        decorText: '• ୨ ✧ ୧ •',
        currentMode: 'photo',
        customPhoto: '', 
        position: { top: '380px', left: '50%', transform: 'translateX(-50%)' } 
    },
    charWidgetEnabled: false,
    charWidgetData: {
        type: 'photo',
        content: ''
    },
    qaScore: 0,
    qaCurrentSession: null,
    qaHistory: [],
    letters: [],
    // 👇 新增这一段
    lettersConfig: {
        bg: 'https://i.postimg.cc/KvnvwWS3/dong-tai-bei-jing1.gif',
        img1: 'https://i.postimg.cc/7YgYdR84/Image-1770474411684-498.jpg',
        img2: 'https://i.postimg.cc/GhkhVfwd/Image-1770474415295-455.jpg',
        text: '休戀逝水 早悟蘭因'
    },
    coupleAvatars: [], // 情头图库数据
    avatarInviteEnabled: true // 允许AI主动邀请更换情头
};

// --- Lovers Space Core Functions ---
async function lsLoadData() {
    const data = await idb.get('ls_data');
    if (data) {
        lsState.boundCharId = data.boundCharId;
        lsState.pendingCharId = data.pendingCharId;
        lsState.startDate = data.startDate;
        lsState.isLinked = data.isLinked || false;
        lsState.locationSyncEnabled = data.locationSyncEnabled || false; 
        lsState.npcFreq = data.npcFreq !== undefined ? data.npcFreq : 30;
        lsState.feed = data.feed || [];
        lsState.widgetEnabled = data.widgetEnabled || false;
        lsState.widgetUpdateFreq = data.widgetUpdateFreq || 20;
        if (data.widgetData) lsState.widgetData = data.widgetData;
        
        lsState.charWidgetEnabled = data.charWidgetEnabled || false;
        if (data.charWidgetData) lsState.charWidgetData = data.charWidgetData;
        
        lsState.qaScore = data.qaScore || 0;
        lsState.qaCurrentSession = data.qaCurrentSession || null;
        lsState.qaHistory = data.qaHistory || [];
        lsState.letters = data.letters || [];
        if (data.lettersConfig) lsState.lettersConfig = data.lettersConfig;
        if (data.timeAlbum) lsState.timeAlbum = data.timeAlbum;
        if (data.decorImages) lsState.decorImages = data.decorImages;
        if (data.coupleAvatars) lsState.coupleAvatars = data.coupleAvatars;
        if (data.avatarInviteEnabled !== undefined) lsState.avatarInviteEnabled = data.avatarInviteEnabled;
        if (data.inventory) lsState.inventory = data.inventory;
        if (data.widgetArchive) lsState.widgetArchive = data.widgetArchive; // 👈 新增：读取回忆墙数据
        
        // 👇 新增：读取商城数据 👇
        if (data.shopCategories) lsState.shopCategories = data.shopCategories;
        if (data.shopMenu) lsState.shopMenu = data.shopMenu;
        if (data.shopCart) lsState.shopCart = data.shopCart;
        if (data.shopOrders) lsState.shopOrders = data.shopOrders;
    }
}

async function lsSaveData() {
    await idb.set('ls_data', {
        boundCharId: lsState.boundCharId,
        pendingCharId: lsState.pendingCharId,
        startDate: lsState.startDate,
        isLinked: lsState.isLinked,
        locationSyncEnabled: lsState.locationSyncEnabled, 
        npcFreq: lsState.npcFreq,
        feed: lsState.feed,
        widgetEnabled: lsState.widgetEnabled,
        widgetUpdateFreq: lsState.widgetUpdateFreq,
        widgetData: lsState.widgetData,
        charWidgetEnabled: lsState.charWidgetEnabled,
        charWidgetData: lsState.charWidgetData,
        qaScore: lsState.qaScore,
        qaCurrentSession: lsState.qaCurrentSession,
        qaHistory: lsState.qaHistory,
        letters: lsState.letters,
        lettersConfig: lsState.lettersConfig,
        timeAlbum: lsState.timeAlbum,
        decorImages: lsState.decorImages,
        inventory: lsState.inventory,
        widgetArchive: lsState.widgetArchive, // 👈 新增：保存回忆墙数据
        coupleAvatars: lsState.coupleAvatars,
        avatarInviteEnabled: lsState.avatarInviteEnabled,
        // 👇 新增：保存商城数据 👇
        shopCategories: lsState.shopCategories,
        shopMenu: lsState.shopMenu,
        shopCart: lsState.shopCart,
        shopOrders: lsState.shopOrders
    });
}


function openLoversSpace() {
    document.getElementById('loversSpaceModal').classList.add('open');
    lsRenderView();
}

function closeLoversSpace() {
    document.getElementById('loversSpaceModal').classList.remove('open');
}

function lsRenderView() {
    document.querySelectorAll('.ls-view').forEach(el => el.classList.remove('active'));
    
    if (lsState.boundCharId) {
        document.getElementById('ls-view-main').classList.add('active');
        lsRenderMain();
    } else if (lsState.pendingCharId) {
        document.getElementById('ls-view-pending').classList.add('active');
        lsRenderPending();
    } else {
        document.getElementById('ls-view-bind').classList.add('active');
        lsRenderBindList();
    }
}

// --- Bind Logic ---
function lsRenderBindList() {
    const list = document.getElementById('ls-bind-list');
    list.innerHTML = '';
    
    const availableChars = wcState.characters.filter(c => !c.isGroup);
    if (availableChars.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">请先在 WeChat 中添加单人角色</div>';
        return;
    }

    availableChars.forEach(char => {
        const div = document.createElement('div');
        div.className = 'ls-char-item';
        div.innerHTML = `
            <img src="${char.avatar}" class="ls-char-avatar">
            <div class="ls-char-name">${char.name}</div>
        `;
        div.onclick = () => lsSendInvite(char.id);
        list.appendChild(div);
    });
}

function lsSendInvite(charId) {
    if (confirm("确定向该角色发送恋爱邀请吗？")) {
        lsState.pendingCharId = charId;
        lsSaveData();
        
        wcAddMessage(charId, 'me', 'invite', '邀请开启恋人空间', { status: 'pending' });
        
        lsRenderView();
    }
}

function lsRenderPending() {
    const char = wcState.characters.find(c => c.id === lsState.pendingCharId);
    if (char) {
        // 【修复】：给 url 内部加上单引号，防止 base64 解析失败
        document.getElementById('ls-pending-avatar').style.backgroundImage = `url('${char.avatar}')`;
        document.getElementById('ls-pending-name').innerText = char.name;
    }
}
function lsCancelInvite() {
    if (confirm("取消邀请？")) {
        lsState.pendingCharId = null;
        lsSaveData();
        lsRenderView();
    }
}

function lsResendInvite() {
    if (lsState.pendingCharId) {
        wcAddMessage(lsState.pendingCharId, 'me', 'invite', '邀请开启恋人空间', { status: 'pending' });
        alert("邀请已重新发送");
    }
}

function lsConfirmBind(charId) {
    if (lsState.boundCharId) return; 
    
    lsState.boundCharId = charId;
    lsState.pendingCharId = null;
    lsState.startDate = Date.now();
    lsState.isLinked = true; 
    lsSaveData();
    
    const msgs = wcState.chats[charId] || [];
    msgs.forEach(m => {
        if (m.type === 'invite') m.status = 'accepted';
    });
    wcSaveData();
    
    if (document.getElementById('loversSpaceModal').classList.contains('open')) {
        lsRenderView();
    }
}

function wcHandleInviteClick(msgId) {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;
    
    if (msg.status === 'accepted') {
        openLoversSpace();
    } else if (msg.status === 'pending') {
        if (confirm("强制让对方同意并开启空间？")) {
            lsConfirmBind(wcState.activeChatId);
            openLoversSpace();
        }
    }
}

// --- Main Space Logic ---
function lsRenderMain() {
    const char = wcState.characters.find(c => c.id === lsState.boundCharId);
    if (!char) return;             
        
    // ==========================================
    // 1. 渲染双方头像 (主页和侧边栏)
    // ==========================================
    const userAvatarEl = document.getElementById('ls-main-user-avatar');
    const charAvatarEl = document.getElementById('ls-main-char-avatar');
    const sidebarUserAvatarEl = document.getElementById('ls-sidebar-user-avatar');
    const sidebarCharAvatarEl = document.getElementById('ls-sidebar-char-avatar');
    
    if (userAvatarEl) userAvatarEl.src = wcState.user.avatar;
    if (charAvatarEl) charAvatarEl.src = char.avatar;
    if (sidebarUserAvatarEl) sidebarUserAvatarEl.src = wcState.user.avatar;
    if (sidebarCharAvatarEl) sidebarCharAvatarEl.src = char.avatar;

    // 渲染名字
    const spaceTitle = document.getElementById('ls-space-title');
    const sidebarTitle = document.getElementById('ls-sidebar-title');
    if (spaceTitle) spaceTitle.innerText = `${wcState.user.name} & ${char.name}`;
    if (sidebarTitle) sidebarTitle.innerText = `${wcState.user.name} & ${char.name}`;

    // ==========================================
    // 2. 恢复开关状态逻辑
    // ==========================================
    const toggleLink = document.getElementById('ls-toggle-link');
    if (toggleLink) toggleLink.checked = lsState.isLinked;
    
    const toggleLocation = document.getElementById('ls-toggle-location');
    if (toggleLocation) toggleLocation.checked = lsState.locationSyncEnabled;
    
    // ==========================================
    // 3. 修复 NPC 频率输入框的重复声明报错
    // ==========================================
    const npcFreqInput = document.getElementById('ls-npc-freq');
    if (npcFreqInput) npcFreqInput.value = lsState.npcFreq;

    // 计算天数和日期
    const days = Math.floor((Date.now() - lsState.startDate) / (1000 * 60 * 60 * 24)) + 1;
    const daysNumEl = document.getElementById('ls-days-num');
    if (daysNumEl) daysNumEl.innerText = days;
    
    const sidebarSubtitle = document.getElementById('ls-sidebar-subtitle');
    if (sidebarSubtitle) sidebarSubtitle.innerText = `Connected for ${days} Days`;
    
    // ==========================================
    // 4. 桌面小组件逻辑
    // ==========================================
    const toggleWidget = document.getElementById('ls-toggle-widget');
    if (toggleWidget) {
        toggleWidget.checked = lsState.widgetEnabled;
        document.getElementById('ls-my-widget-controls').style.display = lsState.widgetEnabled ? 'flex' : 'none';
        document.getElementById('ls-widget-freq').value = lsState.widgetUpdateFreq;
        
        if (lsState.widgetData.customPhoto && lsState.widgetData.customPhoto.startsWith('data:')) {
            document.getElementById('ls-widget-photo-url').value = '已选择本地图片';
        } else {
            document.getElementById('ls-widget-photo-url').value = lsState.widgetData.customPhoto || '';
        }
    }
    
    const toggleCharWidget = document.getElementById('ls-toggle-char-widget');
    if (toggleCharWidget) {
        toggleCharWidget.checked = lsState.charWidgetEnabled;
        document.getElementById('ls-char-widget-controls').style.display = lsState.charWidgetEnabled ? 'flex' : 'none';
    }
    
    // 更新隐藏日历的默认值并绑定修改事件
    const datePicker = document.getElementById('ls-date-picker');
    if (datePicker) {
        if (lsState.startDate) {
            datePicker.value = new Date(lsState.startDate).toISOString().slice(0,10);
        }
        // 【修复】：动态绑定 change 事件，确保用户修改日期后能保存并刷新
        datePicker.onchange = function(e) {
            lsUpdateStartDate(e.target.value);
        };
    }            

    lsRenderFeed();
    lsRenderWidgetArchive(); // 👈 新增：渲染回忆墙
}    

function lsSwitchTab(tabName) {
    document.querySelectorAll('.ls-tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`ls-tab-${tabName}`).classList.add('active');
    
    document.querySelectorAll('.ls-tab-item').forEach(el => el.classList.remove('active'));
    const tabs = ['feed', 'album', 'archive']; // 👈 修改：第三个 Tab 变成了 archive
    const idx = tabs.indexOf(tabName);
    if (idx !== -1) {
        document.querySelectorAll('.ls-tab-item')[idx].classList.add('active');
    }
}

// 新增：侧边栏开关函数
function lsToggleSidebar(show) {
    const sidebar = document.getElementById('ls-sidebar');
    const overlay = document.getElementById('ls-sidebar-overlay');
    if (show) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// 覆盖原有的 closeLoversSpace 函数，确保关闭时收起侧边栏
const originalCloseLoversSpace = closeLoversSpace;
closeLoversSpace = function() {
    lsToggleSidebar(false);
    setTimeout(() => {
        originalCloseLoversSpace();
    }, 200); // 等待侧边栏收起动画
};

function lsToggleLink(checkbox) {
    lsState.isLinked = checkbox.checked;
    lsSaveData();
}
function lsToggleLocationSync(checkbox) {
    lsState.locationSyncEnabled = checkbox.checked;
    lsSaveData();
    if (checkbox.checked) {
        alert("位置与运动同步已开启，对方将能感知你的实时状态。");
    }
}
function lsUpdateNpcFreq(val) {
    lsState.npcFreq = parseInt(val) || 0;
    lsSaveData();
    lsInitNpcLoop(); 
}
// 【新增】：处理恋人空间日期修改
function lsUpdateStartDate(dateString) {
    if (!dateString) return;
    // 将选择的日期字符串 (YYYY-MM-DD) 转换为时间戳
    const newDate = new Date(dateString).getTime();
    if (!isNaN(newDate)) {
        lsState.startDate = newDate;
        lsSaveData();
        lsRenderMain(); // 重新渲染以更新天数显示
    }
}
function lsToggleWidget(checkbox) {
    lsState.widgetEnabled = checkbox.checked;
    document.getElementById('ls-my-widget-controls').style.display = checkbox.checked ? 'flex' : 'none';
    lsSaveData();
    lsRenderWidget();
}

function lsUpdateWidgetFreq(val) {
    lsState.widgetUpdateFreq = parseInt(val);
    lsSaveData();
}

function lsUpdateWidgetPhoto(url) {
    if (url === '已选择本地图片') return; 
    lsState.widgetData.customPhoto = url;
    lsSaveData();
    lsRenderWidget();
}

async function lsHandleWidgetPhotoUpload(input) {
    const file = input.files[0];
    if (file) {
        try {
            const base64 = await wcCompressImage(file);
            lsState.widgetData.customPhoto = base64;
            document.getElementById('ls-widget-photo-url').value = '已选择本地图片';
            lsSaveData();
            lsRenderWidget();
        } catch (e) {
            alert("图片处理失败");
        }
    }
    input.value = '';
}


function lsResetWidgetPosition() {
    lsState.widgetData.position = { top: '380px', left: '50%', transform: 'translateX(-50%)' };
    lsSaveData();
    lsRenderWidget();
    alert("小组件位置已重置");
}

// --- 对方桌面小组件控制 ---
function lsToggleCharWidget(checkbox) {
    lsState.charWidgetEnabled = checkbox.checked;
    document.getElementById('ls-char-widget-controls').style.display = checkbox.checked ? 'flex' : 'none';
    lsSaveData();
}

let lsTempCharWidgetPhoto = ''; // 临时存储上传的图片

function lsToggleCharWidgetInputType(type) {
    const input = document.getElementById('ls-char-widget-input');
    const localArea = document.getElementById('ls-char-widget-local-area');
    if (type === 'photo') {
        input.placeholder = '描述图片画面 (AI将生成图片)...';
        if (localArea) localArea.style.display = 'flex';
    } else {
        input.placeholder = '输入便利贴留言...';
        if (localArea) localArea.style.display = 'none';
    }
}

async function lsHandleCharWidgetLocalUpload(input) {
    const file = input.files[0];
    if (file) {
        try {
            // 使用现有的压缩函数，防止图片过大导致存储失败
            const base64 = await wcCompressImage(file);
            lsTempCharWidgetPhoto = base64;
            const preview = document.getElementById('ls-char-widget-preview');
            if (preview) {
                preview.src = base64;
                preview.style.display = 'block';
            }
            document.getElementById('ls-char-widget-input').value = ''; // 清空文字描述
        } catch (e) {
            alert("图片处理失败");
        }
    }
    input.value = '';
}

// ==========================================
// 替换后：
// ==========================================
function lsSendToCharWidget() {
    const type = document.getElementById('ls-char-widget-type').value;
    let content = document.getElementById('ls-char-widget-input').value.trim();
    let isLocal = false;
    
    // 如果是照片模式且上传了本地图片，优先使用本地图片
    if (type === 'photo' && lsTempCharWidgetPhoto) {
        content = lsTempCharWidgetPhoto;
        isLocal = true;
    }
    
    if (!content) return alert("请输入内容或上传图片");
    
    lsState.charWidgetData = { type, content };

    // 👇 新增：将侧边栏发送的小组件也存入回忆墙 👇
    const nowStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
    if (!lsState.widgetArchive) lsState.widgetArchive = [];
    lsState.widgetArchive.unshift({
        id: Date.now(),
        type: type === 'photo' ? 'photo' : (Math.random() > 0.5 ? 'note_light' : 'note_dark'),
        img: (type === 'photo' && isLocal) ? content : null,
        text: (type === 'photo' && !isLocal) ? `[画面描述] ${content}` : (type === 'photo' ? '' : content),
        date: nowStr,
        sender: 'user'
    });
    // 👆 新增结束 👆

    lsSaveData();
    alert("已成功发送到对方桌面！");
    
    // 清空状态
    document.getElementById('ls-char-widget-input').value = '';
    lsTempCharWidgetPhoto = '';
    const preview = document.getElementById('ls-char-widget-preview');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    
    // 如果对方手机模拟器开着，实时刷新一下小组件
    if (typeof wcRenderCharWidget === 'function') {
        wcRenderCharWidget();
    }
    
    // 实时刷新回忆墙
    if (typeof lsRenderWidgetArchive === 'function') {
        lsRenderWidgetArchive();
    }
}


// --- 手机模拟器内对方桌面小组件渲染与交互 ---
function wcRenderCharWidget() {
    const widget = document.getElementById('wc-phone-lovers-widget');
    if (!widget) return; 
    
    if (!lsState.charWidgetEnabled) {
        widget.style.display = 'none';
        return;
    }
    
    widget.style.display = 'flex';
    
    const inner = document.getElementById('wc-lovers-widget-inner');
    const photoDesc = document.getElementById('wc-lovers-widget-photo-label');
    const noteText = document.getElementById('wc-lovers-widget-note-text');
    const photoBg = document.getElementById('wc-lovers-widget-photo');
    
    if (lsState.charWidgetData.type === 'note') {
        widget.classList.add('flipped');
        noteText.innerText = lsState.charWidgetData.content || '暂无留言';
    } else {
        widget.classList.remove('flipped');
        if (lsState.charWidgetData.content) {
            if (lsState.charWidgetData.content.startsWith('data:')) {
                photoBg.style.backgroundImage = `url('${lsState.charWidgetData.content}')`;
                photoBg.innerHTML = '';
                photoDesc.innerText = "• ୨ ✧ ୧ •";
            } else {
                photoBg.style.backgroundImage = 'none';
                photoBg.innerHTML = `<div style="font-size:10px; color:#999; padding:5px; text-align:center; line-height:1.3;">[AI画面]<br>${lsState.charWidgetData.content.substring(0,20)}...</div>`;
                photoDesc.innerText = "• ୨ ✧ ୧ •";
            }
        } else {
            photoBg.style.backgroundImage = 'none';
            photoBg.innerHTML = `<svg viewBox="0 0 24 24" style="width:50%;height:50%;color:#ccc;"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
            photoDesc.innerText = "• ୨ ✧ ୧ •";
        }
    }
}

function wcOpenCharWidgetInteractModal() {
    wcOpenModal('wc-modal-char-widget-interact');
    wcToggleCharWidgetType('photo');
    wcToggleCharWidgetPhotoSource('desc');
}

function wcToggleCharWidgetType(type) {
    document.getElementById('wc-seg-widget-photo').classList.toggle('active', type === 'photo');
    document.getElementById('wc-seg-widget-note').classList.toggle('active', type === 'note');
    document.getElementById('wc-area-widget-photo').style.display = type === 'photo' ? 'block' : 'none';
    document.getElementById('wc-area-widget-note').style.display = type === 'note' ? 'block' : 'none';
}

function wcToggleCharWidgetPhotoSource(source) {
    document.getElementById('wc-seg-widget-photo-desc').classList.toggle('active', source === 'desc');
    document.getElementById('wc-seg-widget-photo-local').classList.toggle('active', source === 'local');
    document.getElementById('wc-area-widget-photo-desc').style.display = source === 'desc' ? 'block' : 'none';
    document.getElementById('wc-area-widget-photo-local').style.display = source === 'local' ? 'block' : 'none';
}
// ==========================================
// 替换后：
// ==========================================
async function wcHandleCharWidgetPhotoUpload(input) {
    const file = input.files[0];
    if (file) {
        try {
            // 核心修复：使用压缩函数，防止原图过大导致数据库保存失败
            const base64 = await wcCompressImage(file);
            wcState.tempImage = base64;
            document.getElementById('wc-preview-char-widget-photo').src = base64;
            document.getElementById('wc-preview-char-widget-photo').style.display = 'block';
            document.getElementById('wc-text-char-widget-photo').style.display = 'none';
        } catch (e) {
            alert("图片处理失败，请重试");
        }
    }
    input.value = ''; // 清空 input，允许重复上传同一张图片
}

// --- 修复：发送到对方桌面小组件并触发系统通知 ---
function wcSendToCharWidgetFromSim() {
    const isPhoto = document.getElementById('wc-seg-widget-photo').classList.contains('active');
    const type = isPhoto ? 'photo' : 'note';
    let content = '';
    let aiMsg = '';
    let notifMsg = '';
    let isLocal = false; // 👈 新增：在外部提前声明 isLocal 变量，扩大其作用域

    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const charName = char ? char.name : "对方";

    if (isPhoto) {
        isLocal = document.getElementById('wc-seg-widget-photo-local').classList.contains('active'); // 👈 修改：去掉 const，直接赋值
        if (isLocal) {
            if (!wcState.tempImage) return alert("请先上传图片");
            content = wcState.tempImage;
            aiMsg = `[系统提示: 用户刚刚更新了你桌面上的拍立得小组件，换成了一张新的照片。]`;
            notifMsg = `${charName} 在你的桌面发送了一张图片`;
        } else {
            content = document.getElementById('wc-input-widget-photo-desc').value.trim();
            if (!content) return alert("请输入图片描述");
            aiMsg = `[系统提示: 用户刚刚更新了你桌面上的拍立得小组件，画面描述为: "${content}"]`;
            notifMsg = `${charName} 在你的桌面发送了一张图片`;
        }
    } else {
        content = document.getElementById('wc-input-widget-note-text').value.trim();
        if (!content) return alert("请输入留言内容");
        aiMsg = `[系统提示: 用户刚刚更新了你桌面上的便利贴小组件，留言内容为: "${content}"]`;
        notifMsg = `${charName} 在你的桌面发送了一张便利贴`;
    }
    
    lsState.charWidgetData = { type, content };
    
    // 👇 新增：将 User 发送的小组件存入回忆墙
    const nowStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
    if (!lsState.widgetArchive) lsState.widgetArchive = [];
    lsState.widgetArchive.unshift({
        id: Date.now(),
        type: isPhoto ? 'photo' : (Math.random() > 0.5 ? 'note_light' : 'note_dark'),
        img: (isPhoto && isLocal) ? content : null,
        text: (isPhoto && !isLocal) ? `[画面描述] ${content}` : (isPhoto ? '' : content),
        date: nowStr,
        sender: 'user'
    });
    // 👆 新增结束
    
    lsSaveData();
    wcRenderCharWidget();
    
    if (char) {
        wcAddMessage(char.id, 'system', 'system', aiMsg, { hidden: true });
    }

    wcCloseModal('wc-modal-char-widget-interact');
    
    document.getElementById('wc-input-widget-photo-desc').value = '';
    document.getElementById('wc-input-widget-note-text').value = '';
    wcState.tempImage = '';
    document.getElementById('wc-preview-char-widget-photo').style.display = 'none';
    document.getElementById('wc-text-char-widget-photo').style.display = 'block';
    
    // 触发主屏幕系统通知
    showMainSystemNotification("恋人空间", notifMsg);
}

function wcToggleLoversWidgetMode(e) {
    e.stopPropagation();
    const widget = document.getElementById('wc-phone-lovers-widget');
    if (!widget) return; 
    
    if (widget.classList.contains('flipped')) {
        // 修复：当前在背面，点击时询问是否要修改留言
        if (confirm(`【当前留言】\n${lsState.charWidgetData.content || '暂无留言'}\n\n是否要发送新的内容到 Ta 的桌面？`)) {
            wcOpenCharWidgetInteractModal();
        } else {
            widget.classList.remove('flipped');
            lsState.charWidgetData.type = 'photo';
            lsSaveData();
        }
    } else {
        widget.classList.add('flipped');
        lsState.charWidgetData.type = 'note';
        lsSaveData();
    }
}

function wcShowLoversWidgetPhotoDesc(e) {
    e.stopPropagation();
    if (lsState.charWidgetData.type === 'photo' && lsState.charWidgetData.content && !lsState.charWidgetData.content.startsWith('data:')) {
        // 修复：如果有描述，先弹窗显示描述，然后询问是否要重新发送
        if (confirm(`【照片画面描述】\n${lsState.charWidgetData.content}\n\n是否要发送新的内容到 Ta 的桌面？`)) {
            wcOpenCharWidgetInteractModal();
        }
    } else {
        wcOpenCharWidgetInteractModal();
    }
}


function lsUnbind() {
    if (confirm("确定要解除恋人关系吗？所有记录将被清空。")) {
        lsState.boundCharId = null;
        lsState.startDate = null;
        lsState.feed = [];
        lsState.widgetEnabled = false;
        lsState.charWidgetEnabled = false;
        lsSaveData();
        lsRenderWidget();
        lsRenderView();
    }
}

function lsClearFeed() {
    if (confirm("确定清空所有关联消息记录吗？")) {
        lsState.feed = [];
        lsSaveData();
        lsRenderFeed();
    }
}

// --- Feed & NPC Logic ---
function lsAddFeed(text, avatar = null, msgId = null) {
    const item = {
        id: Date.now(),
        text: text,
        time: Date.now(),
        avatar: avatar || wcState.user.avatar,
        msgId: msgId 
    };
    lsState.feed.unshift(item);
    if (lsState.feed.length > 50) lsState.feed.pop(); 
    lsSaveData();
    
    if (document.getElementById('ls-view-main').classList.contains('active')) {
        lsRenderFeed();
    }
}

function lsRemoveFeedByMsgId(msgId) {
    if (!msgId || !lsState.feed) return; // <--- 增加 !lsState.feed 保护
    const initialLen = lsState.feed.length;
    lsState.feed = lsState.feed.filter(item => item.msgId !== msgId);
    
    if (lsState.feed.length !== initialLen) {
        lsSaveData();
        const mainView = document.getElementById('ls-view-main');
        if (mainView && mainView.classList.contains('active')) {
            lsRenderFeed();
        }
    }
}

function lsRenderFeed() {
    const list = document.getElementById('ls-feed-list');
    list.innerHTML = '';
    
    if (lsState.feed.length === 0) {
        list.innerHTML = '<div class="ls-empty-state"><p>暂无动态</p></div>';
        return;
    }

    lsState.feed.forEach(item => {
        const div = document.createElement('div');
        div.className = 'ls-timeline-item';
        div.innerHTML = `
            <div class="ls-timeline-dot"></div>
            <div class="ls-timeline-time">${new Date(item.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            <div class="ls-timeline-card">
                <div class="ls-feed-item">
                    <img src="${item.avatar}" class="ls-feed-avatar">
                    <div class="ls-feed-content">
                        <div class="ls-feed-text">${item.text}</div>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- NPC Loop ---
function lsInitNpcLoop() {
    if (lsState.npcInterval) clearInterval(lsState.npcInterval);
    if (lsState.npcFreq > 0) {
        lsState.npcInterval = setInterval(lsCheckNpcTrigger, 60000); 
    }
}

async function lsCheckNpcTrigger() {
    if (!lsState.boundCharId || lsState.npcFreq <= 0) return;
    
    const rand = Math.random();
    if (rand < (1 / lsState.npcFreq)) {
        await lsTriggerNpcMessage();
    }
}
// ==========================================
// 恋人空间：渲染小组件回忆墙 (瀑布流)
// ==========================================
function lsRenderWidgetArchive() {
    const wall = document.getElementById('archive-wall');
    if (!wall) return;
    wall.innerHTML = '';

    if (!lsState.widgetArchive || lsState.widgetArchive.length === 0) {
        wall.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px; font-style:italic; width: 200%;">墙上空空如也，快互相发送小组件吧~</div>';
        return;
    }

    // 图钉颜色库 (低饱和马卡龙色系)
    const pinColors = ['#A8D5BA', '#F9E79F', '#B39DDB', '#F5B7B1', '#85C1E9', '#D7BDE2', '#FAD7A1'];

    lsState.widgetArchive.forEach((item, index) => {
        // 利用 ID 生成固定的伪随机数，保证每次渲染倾斜角度和颜色不变
        const pseudoRandom = (item.id % 100) / 100; 
        const rotateDeg = (pseudoRandom * 8 - 4).toFixed(1); // -4 到 4 度
        const pinColor = pinColors[item.id % pinColors.length];

        const card = document.createElement('div');
        card.className = `archive-card ${item.type === 'photo' ? 'photo-card' : (item.type === 'note_dark' ? 'note-card-dark' : 'note-card-light')}`;
        card.style.transform = `rotate(${rotateDeg}deg)`;
        
        // 点击卡片可以删除
        card.onclick = () => {
            if (confirm("确定要从回忆墙上撕下这张卡片吗？")) {
                lsState.widgetArchive.splice(index, 1);
                lsSaveData();
                lsRenderWidgetArchive();
            }
        };

        let innerHtml = `<div class="archive-pin" style="background-color: ${pinColor};"></div>`;

        if (item.type === 'photo') {
            if (item.img) {
                innerHtml += `<img src="${item.img}">`;
            } else {
                // 如果没有真实图片（比如 AI 发的描述），用灰色方块代替
                innerHtml += `<div style="width:100%; aspect-ratio:1; background:#F5F5F5; border:1px solid #F0F0F0; display:flex; align-items:center; justify-content:center; color:#CCC;"><svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:currentColor;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`;
            }
            if (item.text) {
                innerHtml += `<div class="note-text">${item.text.replace(/\n/g, '<br>')}</div>`;
            }
            innerHtml += `<div class="card-date">${item.date}</div>`;
        } else {
            innerHtml += `
                <div class="note-text">${item.text.replace(/\n/g, '<br>')}</div>
                <div class="card-date">${item.date}</div>
            `;
        }

        card.innerHTML = innerHtml;
        wall.appendChild(card);
    });
}

// ==========================================
// 核心修复：NPC 消息接收不全与群聊 OOC (带严格错误拦截)
// ==========================================
async function lsTriggerNpcMessage() {
    const char = wcState.characters.find(c => c.id === lsState.boundCharId);
    if (!char || !char.phoneData || !char.phoneData.contacts) return;
    
    const contacts = char.phoneData.contacts.filter(c => !c.isUser);
    if (contacts.length === 0) return;
    
    const npc = contacts[Math.floor(Math.random() * contacts.length)];
    
    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return;

    try {
        const chatConfig = char.chatConfig || {};
        
        // 核心修复：只读取关联的世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        const now = new Date();
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        let prompt = "";
        if (npc.type === 'group') {
            prompt += `你正在模拟一个名为【${npc.name}】的微信群聊。\n`;
            prompt += `群聊背景/描述：${npc.desc}\n`;
            prompt += `群里的人正在跟群成员【${char.name}】(User扮演) 聊天。\n`;
            prompt += `【任务】：请重点读取群聊背景，以群里其他成员的身份回复消息。\n`;
            prompt += `【要求】：\n`;
            prompt += `1. 可以是一个人回复，也可以是几个人七嘴八舌。\n`;
            prompt += `2. 必须返回 JSON 数组，每个对象必须包含 "senderName" (发言人名字)。\n`;
            prompt += `3. 格式示例：[{"type":"text", "senderName":"老王", "content":"今晚去哪吃？"}, {"type":"text", "senderName":"小李", "content":"吃火锅吧"}]\n`;
        } else {
            prompt += `【最高指令】：你现在的唯一身份是【${npc.name}】！\n`;
            prompt += `【绝对禁止】：绝对禁止以【${char.name}】(手机主人) 或【User】(玩家) 的口吻回复！绝对禁止套用他们的人设和面具！\n`;
            prompt += `你的身份/背景：${npc.desc}\n`;
            prompt += `你正在给你的熟人【${char.name}】发微信。\n`;
            prompt += `【输出格式】：JSON数组。\n`;
            if (chatConfig.bilingualEnabled) {
                prompt += `示例：[{"type":"text", "content":"Are you there?<br><span style='font-size: 0.85em; opacity: 0.7;'>在吗？</span>"}, {"type":"text", "content":"I have something to tell you.<br><span style='font-size: 0.85em; opacity: 0.7;'>有个事想跟你说。</span>"}]\n`;
            } else {
                prompt += `示例：[{"type":"text", "content":"在吗？"}, {"type":"text", "content":"有个事想跟你说"}]\n`;
            }
        }
        
        const isTimePerceptionEnabled = chatConfig.timePerceptionEnabled !== false;
        if (isTimePerceptionEnabled) {
            prompt += `\n【现实感知】：当前时间是 ${timeString} ${dayString}。你的发言必须符合这个时间点的常理（如深夜不要说刚起床）。\n`;
        } else {
            prompt += `\n【现实感知】：你当前处于一个模糊的时间维度，不需要关注具体的时间流逝。\n`;
        }
        
        prompt += `【${char.name} 的人设】：${char.prompt}\n`;
        prompt += `${wbInfo}\n`;
        prompt += `【防OOC要求】：你是一个拥有独立生活的真人。发言必须极度口语化、生活化，完全符合你(${npc.name})的人设。绝对拒绝油腻、做作和AI味。不要像客服一样说话！\n`;
        if (chatConfig.bilingualEnabled) {
            const sourceLang = chatConfig.bilingualSource || '英语';
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【最高强制指令：双语翻译模式】\n`;
            prompt += `你必须以双语形式回复！上面是${sourceLang}，下面是${targetLang}。\n`;
            prompt += `在 JSON 的 "content" 字段中，请严格使用以下 HTML 格式输出文本消息（注意单引号）：\n`;
            prompt += `${sourceLang}内容<br><span style='font-size: 0.85em; opacity: 0.7;'>${targetLang}内容</span>\n`;
            prompt += `例如：[{"type":"text", "content":"Hello!<br><span style='font-size: 0.85em; opacity: 0.7;'>你好！</span>"}]\n`;
            prompt += `绝对不能只输出一种语言！\n`;
        }
        // 注入活人运转与思维链规则
        prompt += `【角色活人运转规则】\n`;
        prompt += `> 必须像真人一样聊天，拒绝机械回复。\n`;
        prompt += `> 必须将长回复拆分成多条短消息（1-4条），严禁把所有话挤在一个气泡里！\n`;
        prompt += `> 【重要约束】：绝对不要凭空捏造没有发生过的事情、没有做过的约定或不存在的剧情。请严格基于现有的聊天记录上下文进行自然的日常问候、吐槽或顺延当前话题。\n`;
        prompt += `> 【防重复约束】：严禁输出重复的句子或重复的对话序列！\n`;
        prompt += `> 【格式约束 (最高优先级)】：**必须且只能**输出合法的 JSON 数组，严禁在 JSON 外部输出任何多余字符！严禁漏掉引号、括号或逗号！严禁输出损坏的 JSON 格式！\n`;


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

        let content = data.choices[0].message.content.trim();
        
        let actions = [];
        try {
            let cleanText = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
            cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = cleanText.indexOf('[');
            const end = cleanText.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                cleanText = cleanText.substring(start, end + 1);
                actions = JSON.parse(cleanText);
            } else {
                const regex = /\{"type":\s*"[^"]+",.*?\}/g;
                const matches = cleanText.match(regex);
                if (matches) actions = matches.map(m => JSON.parse(m));
            }
        } catch (e) {
            console.error("JSON Parse Error", e);
        }

        if (actions.length === 0) return;

        if (!char.phoneData.chats) char.phoneData.chats = [];
        let chat = char.phoneData.chats.find(c => c.name === npc.name);
        
        if (!chat) {
            chat = {
                id: Date.now(),
                name: npc.name,
                avatar: npc.avatar || getRandomNpcAvatar(),
                lastMsg: "",
                time: "",
                isGroup: npc.type === 'group',
                history: []
            };
            char.phoneData.chats.push(chat);
        }
        
        if (!chat.history) chat.history = [];
        
        let allContentCombined = "";
        
        for (const action of actions) {
            let msgContent = action.content;
            let senderName = action.senderName || null; 

            if (action.type === 'sticker') {
                msgContent = `[表情: ${action.content}]`;
            }
            
            chat.history.push({ sender: 'them', name: senderName, content: msgContent });
            
            if (npc.type === 'group' && senderName) {
                allContentCombined += `${senderName}: ${msgContent} `;
            } else {
                allContentCombined += `${msgContent} `;
            }
        }
        
        const lastAction = actions[actions.length - 1];
        let lastPreview = lastAction.content;
        if (lastAction.type === 'sticker') lastPreview = '[表情]';
        if (npc.type === 'group' && lastAction.senderName) {
            lastPreview = `${lastAction.senderName}: ${lastPreview}`;
        }
        
        chat.lastMsg = lastPreview;
        chat.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        lsAddFeed(`${npc.name} 给 ${char.name} 发送了消息: "${allContentCombined.trim()}"`, chat.avatar);

        wcAddMessage(char.id, 'system', 'system', 
            `[系统提示: ${npc.name} 给 ${char.name} 发送了微信消息]`, 
            { style: 'transparent' } 
        );

        const userName = (char.chatConfig && char.chatConfig.userName) ? char.chatConfig.userName : wcState.user.name;
        if (lsState.isLinked) {
            wcAddMessage(char.id, 'system', 'system', 
                `[系统内部信息(仅AI可见)：你(${char.name})的手机联系人 "${npc.name}" 刚刚在微信上给你发了消息: "${allContentCombined.trim()}"。\n【重要警告】：因为你(${char.name})和 ${userName}(User) 开启了“恋人空间账号关联”，${userName}(User) 的手机上同步弹出了提示，${userName}(User) 已经完全知道 ${npc.name} 给你(${char.name})发了消息！请在接下来的聊天中，根据你的人设对 ${userName}(User) 做出反应。]`, 
                { hidden: true }
            );
        } else {
            wcAddMessage(char.id, 'system', 'system', 
                `[系统内部信息(仅AI可见)：你(${char.name})的手机联系人 "${npc.name}" 刚刚在微信上给你发了具体消息: "${allContentCombined.trim()}"]`, 
                { hidden: true }
            );
        }

        wcSaveData(); 
        
    } catch (e) {
        console.error("NPC Gen Error", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[NPC消息生成失败] ${e.message}`);
    }
}

// --- 桌面小组件渲染与交互 ---
function lsRenderWidget() {
    let widget = document.getElementById('ls-desktop-widget');
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'ls-desktop-widget';
        const decorText = lsState.widgetData.decorText || '• ୨ ✧ ୧ •';
        const ringsHtml = Array(7).fill('<div class="binding-ring"><div class="binding-hole"></div><div class="binding-metal-1"></div><div class="binding-metal-2"></div></div>').join('');

        widget.innerHTML = `
            <div class="ls-widget-inner" id="ls-widget-inner">
                <div class="ls-widget-front" onmousedown="lsStartWidgetDrag(event)" ontouchstart="lsStartWidgetDrag(event)" onclick="if(!isHomeEditMode) lsToggleWidgetMode(event)">
                    <div class="binding-area">${ringsHtml}</div>
                    <div class="ls-widget-photo" id="ls-widget-photo" onclick="lsShowWidgetPhotoDesc(); event.stopPropagation();">
                        <svg viewBox="0 0 24 24" style="width:50%;height:50%;color:#ccc;"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    </div>
                    <div class="ls-widget-decor-text" onclick="lsEditWidgetDecorText(); event.stopPropagation();">
                        <div class="ls-widget-decor-line"></div>
                        <span id="ls-widget-decor-span">${decorText}</span>
                        <div class="ls-widget-decor-line"></div>
                    </div>
                </div>
                <div class="ls-widget-back" onmousedown="lsStartWidgetDrag(event)" ontouchstart="lsStartWidgetDrag(event)" onclick="if(!isHomeEditMode) lsToggleWidgetMode(event)">
                    <div class="binding-area-back">${ringsHtml}</div>
                    <div class="ls-widget-note-text" id="ls-widget-note-text"></div>
                </div>
            </div>
        `;
        
        const homeGrid = document.getElementById('homeGrid');
        if (homeGrid) {
            homeGrid.appendChild(widget);
        }
        
        if (!document.getElementById('ls-widget-style')) {
            const style = document.createElement('style');
            style.id = 'ls-widget-style';
            style.innerHTML = `
                #ls-desktop-widget {
                    position: absolute;
                    width: 180px; height: 180px; 
                    z-index: 10;
                    perspective: 1000px;
                }
                .ls-widget-inner {
                    position: relative; width: 100%; height: 100%;
                    transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);
                    transform-style: preserve-3d;
                    will-change: transform;
                    box-shadow: 2px 6px 15px rgba(0,0,0,0.3);
                    border-radius: 12px;
                }
                #ls-desktop-widget.flipped .ls-widget-inner { transform: rotateY(180deg); }
                
                .ls-widget-front, .ls-widget-back {
                    position: absolute; width: 100%; height: 100%;
                    backface-visibility: hidden; border-radius: 12px;
                    background: #fff; display: flex; flex-direction: column;
                    box-sizing: border-box;
                }
                .ls-widget-front { padding: 12px 12px 12px 28px; }
                .ls-widget-back { 
                    transform: rotateY(180deg); 
                    justify-content: center; align-items: center;
                    padding: 12px 28px 12px 12px;
                    border: 1px solid rgba(0,0,0,0.05);
                    box-shadow: inset 0 0 20px rgba(0,0,0,0.02);
                }
                
                /* 活页装订线样式 */
                .binding-area { position: absolute; left: -8px; top: 0; width: 30px; height: 100%; display: flex; flex-direction: column; justify-content: space-evenly; padding: 12px 0; box-sizing: border-box; }
                .binding-area-back { position: absolute; right: -8px; top: 0; width: 30px; height: 100%; display: flex; flex-direction: column; justify-content: space-evenly; padding: 12px 0; box-sizing: border-box; }
                .binding-ring { position: relative; width: 100%; height: 14px; }
                .binding-hole { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 6px; height: 10px; background: #333; border-radius: 2px; box-shadow: inset 1px 1px 3px rgba(0,0,0,0.8); }
                .binding-area-back .binding-hole { left: 6px; right: auto; }
                .binding-metal-1, .binding-metal-2 { position: absolute; right: 8px; width: 18px; height: 5px; border: 1.5px solid #e0e0e0; border-right-color: #fff; border-radius: 8px; box-shadow: -1px 2px 3px rgba(0,0,0,0.2), inset 1px 1px 1px rgba(255,255,255,0.8); background: linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.1) 50%, transparent 80%); }
                .binding-area-back .binding-metal-1, .binding-area-back .binding-metal-2 { left: 8px; right: auto; border-right-color: #e0e0e0; border-left-color: #fff; box-shadow: 1px 2px 3px rgba(0,0,0,0.2), inset -1px 1px 1px rgba(255,255,255,0.8); }
                .binding-metal-1 { top: 0px; }
                .binding-metal-2 { bottom: 0px; }
                
                .ls-widget-photo {
                    width: 100%; flex: 1; background: #f4f4f4;
                    border: 1px solid #eee; display:flex; justify-content:center; align-items:center;
                    overflow: hidden; cursor: pointer; background-size: cover; background-position: center;
                }
                
                /* 底部虚线装饰样式 */
                .ls-widget-decor-text {
                    font-size: 12px; color: #999; display: flex; align-items: center; justify-content: center;
                    width: 100%; margin-top: 10px; margin-bottom: 2px; cursor: pointer;
                }
                .ls-widget-decor-line { flex: 1; height: 1px; border-top: 1px dashed #ccc; margin: 0 8px; }
                
                .ls-widget-note-text { 
                    font-size: 16px; 
                    color: #444; 
                    font-family: 'Comic Sans MS', 'Chalkboard SE', cursive, sans-serif; 
                    line-height: 1.6; 
                    text-align: center; 
                    width: 100%; 
                    padding: 10px; 
                    word-break: break-word;
                    font-style: italic;
                }
            `;
            document.head.appendChild(style);
        }
    }

    if (lsState.widgetEnabled && lsState.boundCharId) {
        widget.style.display = 'block';
        const data = lsState.widgetData;
        
        if (data.position) {
            widget.style.top = data.position.top;
            widget.style.left = data.position.left;
            widget.style.transform = data.position.transform || 'translateX(-50%)';
        } else {
            widget.style.top = '380px';
            widget.style.left = '50%';
            widget.style.transform = 'translateX(-50%)';
        }
        
        if (data.currentMode === 'note') {
            widget.classList.add('flipped');
        } else {
            widget.classList.remove('flipped');
        }
        
        document.getElementById('ls-widget-note-text').innerText = data.noteText || '暂无留言';
        
        const photoContainer = document.getElementById('ls-widget-photo');
        
        if (data.customPhoto) {
            photoContainer.style.backgroundImage = `url('${data.customPhoto}')`;
            photoContainer.innerHTML = ''; 
        } else {
            photoContainer.style.backgroundImage = 'none';
            if (data.photoDesc) {
                photoContainer.innerHTML = `<div style="font-size:12px; color:#999; padding:10px; text-align:center; line-height:1.3;">[AI画面]<br>${data.photoDesc.substring(0,20)}...</div>`;
            } else {
                photoContainer.innerHTML = `<svg viewBox="0 0 24 24" style="width:50%;height:50%;color:#ccc;"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
            }
        }
        
    } else {
        widget.style.display = 'none';
    }
}

function lsStartWidgetDrag(e) {
    if (!isHomeEditMode) {
        return; // 👈 核心修复：非编辑模式下什么都不做，把翻转交给 onclick 处理
    }

    const touch = e.touches ? e.touches[0] : e;
    lsWidgetDrag.active = true;
    lsWidgetDrag.startX = touch.clientX;
    lsWidgetDrag.startY = touch.clientY;
    
    const widget = document.getElementById('ls-desktop-widget');
    const rect = widget.getBoundingClientRect();
    
    lsWidgetDrag.initialLeft = rect.left;
    lsWidgetDrag.initialTop = rect.top;
    
    widget.style.left = rect.left + 'px';
    widget.style.top = rect.top + 'px';
    widget.style.transform = 'scale(1.05)'; 
    widget.style.zIndex = 100;
    
    if (navigator.vibrate) navigator.vibrate(50);
    
    document.addEventListener('mousemove', lsOnWidgetDrag);
    document.addEventListener('touchmove', lsOnWidgetDrag, { passive: false });
    document.addEventListener('mouseup', lsEndWidgetDrag);
    document.addEventListener('touchend', lsEndWidgetDrag);
}

let lsWidgetDrag = { active: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

function lsOnWidgetDrag(e) {
// 修改为：
if (!lsWidgetDrag.active) return;
if (e.cancelable) { e.preventDefault(); }

    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - lsWidgetDrag.startX;
    const dy = touch.clientY - lsWidgetDrag.startY;
    
    const widget = document.getElementById('ls-desktop-widget');
    widget.style.left = (lsWidgetDrag.initialLeft + dx) + 'px';
    widget.style.top = (lsWidgetDrag.initialTop + dy) + 'px';
}

function lsEndWidgetDrag(e) {
    if (lsWidgetDrag.active) {
        const widget = document.getElementById('ls-desktop-widget');
        widget.style.transform = 'none'; 
        widget.style.zIndex = 10;
        
        lsState.widgetData.position = {
            top: widget.style.top,
            left: widget.style.left,
            transform: 'none'
        };
        
        lsWidgetDrag.active = false;
        document.removeEventListener('mousemove', lsOnWidgetDrag);
        document.removeEventListener('touchmove', lsOnWidgetDrag);
        document.removeEventListener('mouseup', lsEndWidgetDrag);
        document.removeEventListener('touchend', lsEndWidgetDrag);
    }
}

function lsToggleWidgetMode(e) {
    e.stopPropagation();
    const widget = document.getElementById('ls-desktop-widget');
    if (widget.classList.contains('flipped')) {
        widget.classList.remove('flipped');
        lsState.widgetData.currentMode = 'photo';
    } else {
        widget.classList.add('flipped');
        lsState.widgetData.currentMode = 'note';
    }
    lsSaveData();
}

function lsShowWidgetPhotoDesc() {
    if (isHomeEditMode) return; 
    if (lsState.widgetData.photoDesc) {
        alert(`【照片画面描述】\n${lsState.widgetData.photoDesc}`);
    } else {
        alert("暂无照片描述");
    }
}
// ==========================================
// 新增：修改小组件底部装饰文字
// ==========================================
window.lsEditWidgetDecorText = function() {
    if (isHomeEditMode) return; // 编辑模式下不触发修改
    const currentText = lsState.widgetData.decorText || '• ୨ ✧ ୧ •';
    openTextEditModal("修改底部装饰", "请输入新的装饰符号或文字", currentText, (val) => {
        if (val !== null) {
            lsState.widgetData.decorText = val.trim() || '• ୨ ✧ ୧ •';
            lsSaveData();
            // 强制删除旧的 DOM 并重新渲染
            const widget = document.getElementById('ls-desktop-widget');
            if (widget) widget.remove();
            lsRenderWidget();
        }
    });
};

// ==========================================
// 回忆功能补丁
// ==========================================

async function wcGenerateSummary() {
    const charId = wcState.activeChatId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const startInput = parseInt(document.getElementById('wc-mem-start-idx').value);
    const endInput = parseInt(document.getElementById('wc-mem-end-idx').value);
    const msgs = wcState.chats[charId] || [];

    if (isNaN(startInput) || isNaN(endInput)) return alert("请输入有效的起始和结束层数");

    // 将用户输入的层数 (1~N) 转换为程序的数组索引 (0~N-1)
    const startIdx = startInput - 1;
    const endIdx = endInput - 1;

    if (startIdx < 0 || endIdx >= msgs.length || startIdx > endIdx) {
        return alert(`层数范围无效！当前有效层数范围是 1 到 ${msgs.length}`);
    }

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const checkboxes = document.querySelectorAll('#wc-mem-summary-wb-list input[type="checkbox"]:checked');
    const selectedWbIds = Array.from(checkboxes).map(cb => cb.value);

    const btn = document.getElementById('wc-btn-generate-summary');
    const originalText = btn.innerText;
    btn.innerText = "生成中...";
    btn.disabled = true;

    try {
        const sliceMsgs = msgs.slice(startIdx, endIdx + 1);
        
        let prompt = `请总结以下对话的主要内容，提取关键信息和情感变化，字数控制在300字以内。\n`;
        
        if (selectedWbIds.length > 0) {
            prompt += `\n【参考背景】\n`;
            selectedWbIds.forEach(id => {
                const entry = worldbookEntries.find(e => e.id.toString() === id.toString());
                if (entry) prompt += `- ${entry.title}: ${entry.desc}\n`;
            });
        }

        prompt += `\n【对话内容】\n`;
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
                temperature: 0.5
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

        let summary = data.choices[0].message.content;
        summary = summary.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

        if (!char.memories) char.memories = [];
        char.memories.unshift({
            id: Date.now(),
            type: 'summary',
            content: `[手动总结 ${startIdx}-${endIdx}] ${summary}`,
            time: Date.now()
        });
        
        wcSaveData();
        wcCloseModal('wc-modal-memory-summary');
        wcRenderMemories(); 
        alert("总结生成成功！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[回忆总结生成失败] ${e.message}`);
        else alert("生成失败：" + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function wcAddManualMemory() {
    const text = document.getElementById('wc-mem-manual-text').value.trim();
    if (!text) return alert("请输入记忆内容");

    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;

    if (!char.memories) char.memories = [];
    
    char.memories.unshift({
        id: Date.now(),
        type: 'manual',
        content: text,
        time: Date.now()
    });

    wcSaveData();
    document.getElementById('wc-mem-manual-text').value = '';
    wcCloseModal('wc-modal-memory-add');
    wcRenderMemories(); 
}

function wcSaveAiMemoryCount() {
    const count = parseInt(document.getElementById('wc-mem-ai-read-count').value);
    if (isNaN(count) || count < 0) return alert("请输入有效的数字");

    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;

    if (!char.chatConfig) char.chatConfig = {};
    char.chatConfig.aiMemoryCount = count;

    wcSaveData();
    wcCloseModal('wc-modal-memory-ai-count');
    alert(`设置已保存：AI 将读取最新的 ${count} 条记忆。`);
}

// --- 新增：主屏幕系统通知 ---
function showMainSystemNotification(title, message, iconUrl = null) {
    const container = document.getElementById('ios-notification-container');
    if (!container) return;
    
    // 【核心修复】：在添加新通知前，清空旧通知，实现覆盖效果
    container.innerHTML = ''; 
    
    const banner = document.createElement('div');
    banner.className = 'ios-notification-banner';
    
    if (!iconUrl && wcState.editingCharId) {
        const char = wcState.characters.find(c => c.id === wcState.editingCharId);
        if (char) iconUrl = char.avatar;
    }
    if (!iconUrl) iconUrl = "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg";

    banner.innerHTML = `
        <img src="${iconUrl}" class="ios-notif-icon">
        <div class="ios-notif-content">
            <div class="ios-notif-header">
                <span class="ios-notif-title">${title}</span>
                <span class="ios-notif-time">现在</span>
            </div>
            <div class="ios-notif-msg">${message}</div>
        </div>
    `;

    banner.onclick = () => {
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
}

// ==========================================================================
// 新增：一键破解 (同时生成隐私和收藏)
// ==========================================================================
async function wcGeneratePrivacyAndFavorites() {
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

    wcShowLoading("正在一键破解手机数据...");

    try {
        const realMsgs = wcState.chats[char.id] || [];
        const recentMsgs = realMsgs.slice(-30).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');
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

        const now = new Date();
        const timeString = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
        const timePrompt = `\n【绝对时间基准】：当前现实时间是 ${timeString} ${dayString}。你生成的所有数据（包括私密记录时间、备忘录时间、日记时间）必须严格符合这个当前时间！绝对不能出现未来的时间，且早中晚的逻辑必须自洽。\n`;

        const lifeStatusPrompt = getLifeStatusPrompt(char); // 新增

        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += timePrompt;
        prompt += `人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; 
        prompt += `【核心场景设定】：我（User）现在正在偷偷查看你（${char.name}）手机上的私密记录和微信收藏。\n`;
        prompt += `【最近我们的聊天记录（20-30条）】：\n${recentMsgs}\n\n`;
        
        prompt += `请基于你的人设、当前生活状态，以及我们**最近的聊天上下文**，一次性生成你的【私密自慰与春梦记录】和【微信收藏内容】。\n`;
        prompt += `【核心要求（极具活人感与强因果逻辑）】：\n`;
        prompt += `1. 【反模板化警告】：绝对禁止生成空泛的随笔！所有的内容必须是对【今天发生的事情】和【聊天中的情绪】的深刻复盘！\n`;
        prompt += `2. 私密记录 (privacy)：必须夹杂着对 User 的幻想，且情绪要承接最近聊天中的氛围（如：聊天中吵架了，私密记录里可能是带着恨意的发泄；聊天很甜，则是温柔的渴望）。\n`;
        prompt += `3. 收藏-备忘录 (memos) 3-8个：记录今天行程中遇到的琐事，或者为了下次和User见面做的攻略/计划也可以是记录关于User的一些事情和小事。\n`;
        prompt += `4. 收藏-手写日记 (diaries) 1-2个：这是你深夜写下的真心话。必须是对今天某件具体事情（行程或聊天中的某句话）的深刻反思、纠结或偏执。\n`;
        prompt += `   - **字数要求**：每篇日记必须不少于 100 字！\n`;
        prompt += `   - **排版与手账风格**：请在文本中随机使用以下标记：[涂改]写错的话[/涂改]、[高亮]重要的词[/高亮]、[拼贴]引用的聊天记录[/拼贴]\n`;
        prompt += `【内在逻辑要求】：在生成 JSON 之前，请确保你的内部推演包含：\n`;
        prompt += `1. 提炼【今日行程】和【聊天记录】中让你情绪波动最大的点。\n`;
        prompt += `2. 围绕这个情绪点，构思你的日记和私密记录。\n`;
        prompt += `推演结束后，直接返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "privacy": {
    "masturbation": {
      "time": "昨晚深夜 / 刚刚",
      "status": "简短的状态概括",
      "action": "具体的动作描述",
      "feeling": "详细的内心感受"
    },
    "wetDream": {
      "time": "前天夜里 / 昨晚",
      "status": "梦醒后的状态",
      "dream": "梦境的具体描述",
      "feeling": "醒来后的内心感受"
    }
  },
  "favorites": {
    "memos": [
      {"title": "备忘录标题", "content": "详细的备忘录正文内容...", "time": "2023-10-24 14:30"}
    ],
    "diaries": [
      {"content": "手写日记的正文内容...", "time": "昨天深夜 03:15"}
    ]
  }
}\n`;


        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 10000
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
        
        let resultData;
        try {
            resultData = JSON.parse(content);
        } catch (parseErr) {
            throw new Error("AI 返回的 JSON 格式错误，请重试。返回内容：" + content.substring(0, 50) + "...");
        }

        if (!char.phoneData) char.phoneData = {};
        
        if (resultData.privacy) char.phoneData.privacy = resultData.privacy;
        if (resultData.favorites) char.phoneData.favorites = resultData.favorites;
        
        wcSaveData();

        // 如果当前停留在隐私或收藏页面，刷新一下UI
        if (document.getElementById('wc-phone-app-privacy').style.display === 'flex') {
            wcRenderPhonePrivacyContent();
        }
        if (document.getElementById('wc-phone-app-favorites').style.display === 'flex') {
            wcRenderPhoneFavoritesContent();
        }

        wcShowSuccess("一键破解成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[一键破解失败] ${e.message}`);
        } else {
            wcShowError("生成失败");
        }
    }
}
// ==========================================
// 新增：AI 后台暗中更新手机数据 (改备注/改签名/和NPC多回合聊天)
// ==========================================
async function wcTriggerBackgroundPhoneUpdate(charId) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return;

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-20).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        let npcListStr = "无";
        if (char.phoneData && char.phoneData.contacts) {
            const npcs = char.phoneData.contacts.filter(c => !c.isUser);
            if (npcs.length > 0) {
                npcListStr = npcs.map(n => `${n.name} (${n.desc})`).join('、');
            }
        }

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += `【最近你与User的聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `【你手机通讯录里的NPC】：${npcListStr}\n\n`;
        
        prompt += `请根据最近和 User 的聊天内容、情绪变化，决定是否要在你自己的手机里偷偷做一些更改，或者找通讯录里的 NPC 聊聊天，注意需要按需使用，禁止频繁使用！。\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 如果聊天让你很开心/生气/暧昧，你可以修改【你手机里给 User 的备注名】 (newRemark)。\n`;
        prompt += `2. 你可以修改你自己的个人主页网名 (newNickname) 和 个性签名 (newSign)。\n`;
        prompt += `3. 你可以找通讯录里的某个 NPC 吐槽或分享刚才发生的事 (npcInteraction)。必须是一段有来有回的多句对话（至少3-6句）！\n`;
prompt += `4. 在对话中，你可以发送文本(text)或表情包(sticker)。\n`;
prompt += `5. 【极度克制警告】：正常人绝对不会频繁修改备注和个性签名！除非你们的关系刚刚发生了**重大突破、严重争吵或极度暧昧**，否则 newRemark, newNickname, newSign 必须全部填 null！\n`;
prompt += `6. NPC聊天也一样，除非今天发生了特别值得吐槽的大事，否则 npcInteraction 必须填 null！宁可什么都不做，也不要为了改而改！\n`;
prompt += `7. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "newRemark": "给User的新备注名(不改填null)",
  "newNickname": "你的新网名(不改填null)",
  "newSign": "你的新个性签名(不改填null)",
  "npcInteraction": {
    "npcName": "你要联系的NPC名字(必须从通讯录选，不联系填null)",
    "dialogue": [
      {"sender": "me", "type": "text", "content": "在吗？刚才发生了一件事..."},
      {"sender": "them", "type": "text", "content": "怎么了？"},
      {"sender": "me", "type": "sticker", "content": "委屈"}
    ]
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
        
        // 👇 核心修复：拦截并显示真实的 API 错误原因 👇
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error(data.error?.message || "API 返回数据异常：" + JSON.stringify(data));
        }
        // 👆 修复结束 👆

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

        const result = JSON.parse(content);

        if (!char.phoneData) char.phoneData = {};
        if (!char.phoneData.profile) char.phoneData.profile = { nickname: char.name, sign: "暂无签名" };

        let hasChanges = false;

        if (result.newRemark && result.newRemark !== "null") {
            char.phoneData.userRemark = result.newRemark;
            if (char.phoneData.contacts) {
                const uContact = char.phoneData.contacts.find(c => c.isUser);
                if (uContact) uContact.name = result.newRemark;
            }
            if (char.phoneData.chats) {
                const uChat = char.phoneData.chats.find(c => c.isUser);
                if (uChat) uChat.name = result.newRemark;
            }
            wcAddMessage(charId, 'system', 'system', `[系统提示：${char.name} 将你的备注改为了“${result.newRemark}”]`, { style: 'transparent' });
            hasChanges = true;
        }

        if (result.newNickname && result.newNickname !== "null") {
            char.phoneData.profile.nickname = result.newNickname;
            hasChanges = true;
        }
        if (result.newSign && result.newSign !== "null") {
            char.phoneData.profile.sign = result.newSign;
            hasChanges = true;
        }

        // 处理：和 NPC 多回合聊天
        if (result.npcInteraction && result.npcInteraction.npcName && result.npcInteraction.npcName !== "null" && result.npcInteraction.dialogue) {
            const npcName = result.npcInteraction.npcName;
            const dialogue = result.npcInteraction.dialogue;

            if (!char.phoneData.chats) char.phoneData.chats = [];
            let pChat = char.phoneData.chats.find(c => c.name === npcName);
            if (!pChat) {
                pChat = { id: Date.now(), name: npcName, avatar: getRandomNpcAvatar(), history: [] };
                char.phoneData.chats.push(pChat);
            }
            
            let feedText = `你感知到 ${char.name} 和 ${npcName} 进行了聊天：\n`;
            let lastContent = "";

            // 遍历对话数组，推入手机聊天记录
            dialogue.forEach(msg => {
                let finalContent = msg.content;
                let finalType = msg.type || 'text';

                // 解析表情包
                if (finalType === 'sticker') {
                    const stickerUrl = wcFindStickerUrlMulti(char.chatConfig.stickerGroupIds, msg.content);
                    if (stickerUrl) {
                        finalContent = stickerUrl;
                    } else {
                        finalType = 'text';
                        finalContent = `[表情: ${msg.content}]`;
                    }
                }

                pChat.history.push({ 
                    sender: msg.sender, 
                    type: finalType,
                    content: finalContent,
                    time: Date.now() - Math.floor(Math.random() * 10000) // 制造一点时间差
                });
                
                const speaker = msg.sender === 'me' ? char.name : npcName;
                let displayContent = finalType === 'sticker' ? '[表情包]' : finalContent;
                feedText += `${speaker}: ${displayContent}\n`;
                lastContent = displayContent;
            });

            pChat.lastMsg = lastContent;
            pChat.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            if (typeof lsState !== 'undefined' && lsState.isLinked && lsState.boundCharId === charId) {
                if (typeof lsAddFeed === 'function') {
                    lsAddFeed(feedText.trim(), char.avatar);
                }
                wcAddMessage(charId, 'system', 'system', `[账号关联感知：${char.name} 刚刚和 ${npcName} 聊了天。]`, { style: 'transparent' });
            }
            hasChanges = true;
        }

        if (hasChanges) {
            wcSaveData();
        }

    } catch (e) {
        console.error("后台暗中更新手机数据失败:", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[后台暗中更新失败] ${e.message}`);
    }
}

// ==========================================================================
// 新增：微信收藏 (Favorites) 逻辑
// ==========================================================================
function wcOpenPhoneFavorites() {
    document.getElementById('wc-phone-app-favorites').style.display = 'flex';
    wcRenderPhoneFavoritesContent();
}

function wcClosePhoneFavorites() {
    document.getElementById('wc-phone-app-favorites').style.display = 'none';
}

function wcRenderPhoneFavoritesContent() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const content = document.getElementById('wc-phone-favorites-content');
    if (!char) return;

    const favData = (char.phoneData && char.phoneData.favorites) ? char.phoneData.favorites : null;

    if (!favData) {
        content.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8E8E93; font-size: 14px; text-align: center; margin-top: 40%;">
                <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; stroke: #CCC; fill: none; stroke-width: 1; margin-bottom: 15px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                点击右上角刷新按钮<br>偷偷查看 Ta 的微信收藏...
            </div>`;
        return;
    }

    let html = `
        <!-- 胶囊形切换栏 -->
        <div style="display: flex; justify-content: center; margin: 5px 0 20px 0;">
            <div style="background: #EAECEF; border-radius: 30px; padding: 4px; display: flex; gap: 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                <div onclick="wcToggleFavoritesTab('memos')" style="padding: 8px 24px; border-radius: 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; ${wcFavoritesTab === 'memos' ? 'background: #FFF; color: #111; box-shadow: 0 4px 12px rgba(0,0,0,0.05);' : 'color: #888;'}">备忘录</div>
                <div onclick="wcToggleFavoritesTab('diaries')" style="padding: 8px 24px; border-radius: 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; ${wcFavoritesTab === 'diaries' ? 'background: #FFF; color: #111; box-shadow: 0 4px 12px rgba(0,0,0,0.05);' : 'color: #888;'}">手账日记</div>
            </div>
        </div>
        <div style="padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 12px;">
    `;

    if (wcFavoritesTab === 'memos') {
        if (favData.memos && favData.memos.length > 0) {
            html += `<div class="folder-grid">`; // 开启网格容器
            
            favData.memos.forEach((memo, idx) => {
                const sig = getFavSignature('memo', memo.title, memo.time, memo.content);
                const isFav = wcState.myFavorites && wcState.myFavorites.some(f => f.sig === sig);
                
                // 随机生成纸张上的线条，增加真实感
                const linesHtml = Math.random() > 0.5 
                    ? `<div class="folder-paper-line long"></div><div class="folder-paper-line short"></div><div class="folder-paper-line long"></div>`
                    : `<div class="folder-paper-line long"></div><div class="folder-paper-line long"></div>`;

                html += `
                    <div class="folder-item" onclick="wcOpenMemoDetail(${idx})">
                        <div class="folder-back"></div>
                        <div class="folder-papers">
                            <div class="folder-paper folder-paper-1">${linesHtml}</div>
                            <div class="folder-paper folder-paper-2"><div class="folder-paper-line long"></div><div class="folder-paper-line short"></div></div>
                        </div>
                        <div class="folder-front"></div>
                        <div class="folder-decor"></div>
                        <div class="folder-info">
                            <div class="folder-title">${memo.title}</div>
                            <div class="folder-subtitle">${memo.time ? memo.time.split(' ')[0] : ''}</div>
                        </div>
                        
                        <!-- 悬浮操作区 (收藏/分享) -->
                        <div class="folder-actions" onclick="event.stopPropagation()">
                            <div class="folder-action-btn" onclick="wcToggleFavorite(event, 'memo', ${idx})" style="color: ${isFav ? '#FFD700' : '#FFF'};">
                                <svg viewBox="0 0 24 24" style="fill: ${isFav ? 'currentColor' : 'none'};"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            </div>
                            <div class="folder-action-btn" onclick="wcTriggerShare(event, 'memo', ${idx})">
                                <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`; // 闭合网格容器
        } else {
            html += `<div style="text-align:center; color:#999; padding:20px;">暂无备忘录</div>`;
        }
    } else {
        if (favData.diaries && favData.diaries.length > 0) {
            favData.diaries.forEach((diary, idx) => {
                const sig = getFavSignature('diary', '手写日记', diary.time, diary.content);
                const isFav = wcState.myFavorites && wcState.myFavorites.some(f => f.sig === sig);

                // 保留 AI 生成的涂改、高亮等特殊标记解析
                let processedContent = diary.content
                    .replace(/\[涂改\](.*?)\[\/涂改\]/g, '<span style="text-decoration: line-through; text-decoration-color: #333; text-decoration-thickness: 2px; opacity: 0.7;">$1</span>')
                    .replace(/\[高亮\](.*?)\[\/高亮\]/g, '<span style="background: linear-gradient(transparent 60%, rgba(255,255,0,0.6) 60%);">$1</span>')
                    .replace(/\[拼贴\](.*?)\[\/拼贴\]/g, `<span style="background: #f5f5f5; border: 1px dashed #ccc; padding: 2px 4px; font-family: monospace; display: inline-block; border-radius: 4px; margin: 2px;">$1</span>`);

                // 动态判断收藏图标状态
                const favIconSvg = isFav 
                    ? `<svg viewBox="0 0 24 24" style="fill: #111; stroke: #111;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`
                    : `<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path><line x1="12" y1="7" x2="12" y2="13"></line><line x1="9" y1="10" x2="15" y2="10"></line></svg>`;

                html += `
                    <div class="icity-card">
                        <div class="icity-header">
                            <img src="${char.avatar}" class="icity-avatar" alt="avatar">
                            <div class="icity-info">
                                <div class="icity-name">${char.name}</div>
                                <div class="icity-handle">@${char.name}</div>
                            </div>
                        </div>
                        
                        <div class="icity-content">
                            ${processedContent}
                        </div>
                        
                        <div class="icity-time">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${diary.time}
                        </div>
                        
                        <div class="icity-divider"></div>
                        
                        <div class="icity-actions">
                            <!-- 喜欢 (仅视觉反馈) -->
                            <div class="icity-action-btn" onclick="this.style.color='#FF3B30'; this.querySelector('svg').style.fill='#FF3B30'; this.querySelector('svg').style.stroke='#FF3B30';">
                                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                <span>喜欢</span>
                            </div>
                            
                            <div class="icity-action-divider"></div>
                            
                            <!-- 小纸条 (收藏) -->
                            <div class="icity-action-btn" onclick="wcToggleFavorite(event, 'diary', ${idx})" style="color: ${isFav ? '#111' : '#B2B2B2'};">
                                ${favIconSvg}
                                <span>小纸条</span>
                            </div>
                            
                            <div class="icity-action-divider"></div>
                            
                            <!-- 存为图片 (分享给 Char) -->
                            <div class="icity-action-btn" onclick="wcTriggerShare(event, 'diary', ${idx})">
                                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <span>存为图片</span>
                            </div>
                            
                            <div class="icity-action-divider"></div>
                            
                            <!-- 更多 -->
                            <div class="icity-action-btn more" onclick="alert('更多功能开发中...')">
                                <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<div style="text-align:center; color:#999; padding:20px;">暂无日记</div>`;
        }
    }

    html += '</div>';
    content.innerHTML = html;
}

window.wcToggleFavoritesTab = function(tab) {
    wcFavoritesTab = tab;
    wcRenderPhoneFavoritesContent();
}

function wcOpenMemoDetail(idx) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.favorites || !char.phoneData.favorites.memos) return;
    
    const memo = char.phoneData.favorites.memos[idx];
    if (!memo) return;

    const detailView = document.getElementById('wc-phone-memo-detail');
    const contentEl = document.getElementById('wc-phone-memo-detail-content');
    
    contentEl.innerHTML = `
        <div style="font-size: 22px; font-weight: bold; margin-bottom: 10px;">${memo.title}</div>
        <div style="font-size: 12px; color: #888; margin-bottom: 20px;">${memo.time}</div>
        <div>${memo.content}</div>
    `;
    
    detailView.style.display = 'flex';
}

async function wcGeneratePhoneFavorites() {
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

    wcShowLoading("正在破解收藏夹...");

    try {
        const realMsgs = wcState.chats[char.id] || [];
        const recentMsgs = realMsgs.slice(-30).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');
        const chatConfig = char.chatConfig || {};
        const userName = chatConfig.userName || wcState.user.name; // 👈 新增这一行，定义 userName
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
        const timePrompt = `\n【绝对时间基准】：当前现实时间是 ${timeString} ${dayString}。你生成的备忘录和日记的时间戳必须合理，不能超过当前时间，且内容要符合当前的时间段氛围。\n`;

        const lifeStatusPrompt = getLifeStatusPrompt(char); // 新增

        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += timePrompt;
        prompt += `人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(${userName})设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; // 新增
        if (chatConfig.bilingualEnabled) {
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：虽然聊天记录中包含外语，但你生成的手机内部所有数据（如备忘录、日记等）必须全部使用 ${targetLang}！绝对不要使用双语格式！\n`;
        }
        prompt += `【核心场景设定】：我（${userName}）现在正在偷偷查看你（${char.name}）手机上的微信“我的收藏”。\n`;
        prompt += `【最近我们的聊天记录（20-30条）】：\n${recentMsgs}\n\n`;               
        prompt += `请基于你的人设、当前生活状态，以及我们**最近的聊天上下文**，生成你的微信收藏内容。\n`;       
        prompt += `【核心要求（极具活人感与强因果逻辑）】：\n`;
        prompt += `1. 【反模板化警告】：绝对禁止生成空泛的随笔！所有的内容必须是对【今天发生的事情】和【聊天中的情绪】的深刻复盘！\n`;
        prompt += `2. 私密记录 (privacy)：必须夹杂着对 ${userName} 的幻想，且情绪要承接最近聊天中的氛围（如：聊天中吵架了，私密记录里可能是带着恨意的发泄；聊天很甜，则是温柔的渴望）。\n`;
        prompt += `3. 收藏-备忘录 (memos) 3-8个：记录今天行程中遇到的琐事，或者为了下次和${userName}见面做的攻略/计划也可以是记录关于${userName}的一些事情和小事。\n`;
        prompt += `4. 收藏-手写日记 (diaries) 1-2个：这是你深夜写下的真心话。必须是对今天某件具体事情（行程或聊天中的某句话）的深刻反思、纠结或偏执。\n`;
        prompt += `   - **字数要求**：每篇日记必须不少于 100 字！\n`;
        prompt += `   - **排版与手账风格**：为了模拟真实的手写草稿和拼贴手账感，请在文本中随机使用以下标记：\n`;
        prompt += `     - [涂改]写错或不想承认的话[/涂改] （例如：我[涂改]一点也不[/涂改]很想你）\n`;
        prompt += `     - [高亮]特别重要的情绪或词语[/高亮]\n`;
        prompt += `     - [拼贴]引用的聊天记录或突兀的想法[/拼贴]\n`;
        prompt += `【内在逻辑要求】：在生成 JSON 之前，请确保你的内部推演包含：\n`;
        prompt += `1. 结合当前时间、地点和心情，今日发生的事情和聊天记录，推断你最近遇到了什么烦心事或有趣的事，需要记在备忘录里。\n`;
        prompt += `2. 构思日记的情感基调，确保情绪真实、细腻、不僵硬。\n`;
        prompt += `推演结束后，直接返回纯 JSON 对象，格式如下：\n`;
        prompt += `{

  "memos": [
    {"title": "${userName}的饲养观察守则", "content": "1. 不能给Ta喝冰水会胃痛。2. 撒谎的时候眼睛会往右下角看。3. 极度吃软不吃硬。", "time": "2023-10-24 14:30"}
  ],
  "diaries": [
    {"content": "今天Ta又对着别人笑了。[涂改]真想把那个人杀了[/涂改] 我必须克制自己。可是[高亮]Ta只能看着我[/高亮]不是吗？[拼贴]“我们只是普通朋友”[/拼贴] 这句话真刺耳。", "time": "昨天深夜 03:15"}
  ]
}\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 10000
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const favData = JSON.parse(content);

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.favorites = favData;
        wcSaveData();

        wcRenderPhoneFavoritesContent();
        wcShowSuccess("破解成功");

    } catch (e) {
        console.error(e);
        wcShowError("生成失败");
    }
}

// ==========================================================================
// 新增：浏览器 (Browser) 逻辑
// ==========================================================================
function wcRenderPhoneBrowserContent() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const content = document.getElementById('wc-phone-browser-content');
    if (!char) return;

    const browserData = (char.phoneData && char.phoneData.browser) ? char.phoneData.browser : null;

    if (!browserData) {
        content.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #8E8E93; font-size: 14px;">点击底栏中间的「刷新」<br>偷偷查看 Ta 的浏览器记录...</div>';
        return;
    }

    let html = ''; // 移除了旧的顶部分段控制器

    html += `<div id="wc-browser-tab-history" style="display: block; padding-top: 10px;">`;
    if (browserData.history && browserData.history.length > 0) {
        browserData.history.forEach((item, idx) => {
            const sig = getFavSignature('history', item.title, item.time, `[内心批注] ${item.annotation}`);
            const isFav = wcState.myFavorites && wcState.myFavorites.some(f => f.sig === sig);

            html += `
                <div style="background: #fff; border-radius: 16px; padding: 18px; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); position: relative;">
                    <div style="padding-right: 30px;">
                        <div style="font-size: 16px; font-weight: 600; color: #007AFF; margin-bottom: 6px; word-break: break-all;">${item.title}</div>
                        <div style="font-size: 12px; color: #8E8E93; font-family: monospace;">${item.url_placeholder}</div>
                        <div style="font-size: 11px; color: #B2B2B2; margin-top: 8px;">${item.time}</div>
                    </div>
                    
                    <!-- 右上角小圆点 -->
                    <div class="dot-btn" onclick="wcToggleAnnotation('anno-${idx}', this, event)">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>
                    </div>
                    
                    <!-- 悬浮批注卡片 -->
                    <div class="annotation-popover" id="anno-${idx}" onclick="event.stopPropagation()">
                        <div class="anno-tag">INNER OS</div>
                        <div class="anno-text">“${item.annotation}”</div>
                    </div>

                    <!-- 收藏按钮 -->
                    <div onclick="wcToggleFavorite(event, 'history', ${idx})" style="position: absolute; bottom: 16px; right: 52px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${isFav ? '#111' : '#CCC'}; cursor: pointer; transition: all 0.2s;">
                        <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: ${isFav ? 'currentColor' : 'none'}; stroke: currentColor; stroke-width: 2;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <!-- 分享按钮 -->
                    <div onclick="wcTriggerShare(event, 'history', ${idx})" style="position: absolute; bottom: 16px; right: 16px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #111; cursor: pointer; transition: background 0.2s;">
                        <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                    </div>
                </div>
            `;
        });
    }
 else {
        html += `<div style="text-align: center; color: #888; padding: 20px;">暂无浏览记录</div>`;
    }
    html += `</div>`;

    html += `<div id="wc-browser-tab-posts" style="display: none; padding: 0 16px 16px 16px;">`;
    if (browserData.posts && browserData.posts.length > 0) {
        browserData.posts.forEach((post, idx) => {
            const sig = getFavSignature('post', post.title, '', post.content);
            const isFav = wcState.myFavorites && wcState.myFavorites.some(f => f.sig === sig);

            html += `
                <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer; position: relative;" onclick="wcOpenPostDetail(${idx})">
                    <div style="padding-right: 60px;">
                        <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 8px;">${post.title}</div>
                        <div style="font-size: 14px; color: #666; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 10px;">${post.content}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #8E8E93;">
                            <span>楼主: ${post.author}</span>
                            <span>💬 ${post.comments ? post.comments.length : 0} 评论</span>
                        </div>
                    </div>
                    <!-- 收藏按钮 -->
                    <div onclick="wcToggleFavorite(event, 'post', ${idx})" style="position: absolute; top: 16px; right: 52px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${isFav ? '#111' : '#CCC'}; transition: all 0.2s;">
                        <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: ${isFav ? 'currentColor' : 'none'}; stroke: currentColor; stroke-width: 2;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <!-- 分享按钮 -->
                    <div onclick="wcTriggerShare(event, 'post', ${idx})" style="position: absolute; top: 16px; right: 16px; width: 28px; height: 28px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #111; transition: background 0.2s;">
                        <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                    </div>
                </div>
            `;
        });
    } else {
        html += `<div style="text-align: center; color: #888; padding: 20px;">暂无帖子</div>`;
    }
    html += `</div>`;

    content.innerHTML = html;
}

function wcToggleBrowserTab(tab) {
    const btnHistory = document.getElementById('browser-nav-history');
    const btnPosts = document.getElementById('browser-nav-posts');
    if (btnHistory) btnHistory.classList.toggle('active', tab === 'history');
    if (btnPosts) btnPosts.classList.toggle('active', tab === 'posts');
    
    const tabHistory = document.getElementById('wc-browser-tab-history');
    const tabPosts = document.getElementById('wc-browser-tab-posts');
    if (tabHistory) tabHistory.style.display = tab === 'history' ? 'block' : 'none';
    if (tabPosts) tabPosts.style.display = tab === 'posts' ? 'block' : 'none';
}

// 👇 新增：切换批注卡片显示/隐藏的逻辑 👇
window.wcToggleAnnotation = function(id, btn, event) {
    event.stopPropagation();
    const popover = document.getElementById(id);
    const isShowing = popover.classList.contains('show');
    
    // 先关闭所有的批注卡片和圆点高亮
    document.querySelectorAll('.annotation-popover').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.dot-btn').forEach(el => el.classList.remove('active'));

    // 如果点击的原本是隐藏的，则展开它
    if (!isShowing) {
        popover.classList.add('show');
        btn.classList.add('active');
    }
};

// 全局点击关闭批注卡片
document.addEventListener('click', function(e) {
    if (!e.target.closest('.dot-btn') && !e.target.closest('.annotation-popover')) {
        document.querySelectorAll('.annotation-popover').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.dot-btn').forEach(el => el.classList.remove('active'));
    }
});

function wcOpenPostDetail(idx) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.browser || !char.phoneData.browser.posts) return;
    
    const post = char.phoneData.browser.posts[idx];
    if (!post) return;

    const detailView = document.getElementById('wc-phone-post-detail');
    const contentEl = document.getElementById('wc-phone-post-detail-content');
    
    let commentsHtml = '';
    if (post.comments && post.comments.length > 0) {
        post.comments.forEach((c, i) => {
            const isChar = c.author === char.name || c.author === "楼主" && post.author === char.name;
            const bg = isChar ? '#E3F2FD' : '#F9F9F9';
            commentsHtml += `
                <div style="background: ${bg}; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                    <div style="font-size: 12px; color: #576B95; font-weight: bold; margin-bottom: 4px;">${i+1}楼 - ${c.author}</div>
                    <div style="font-size: 14px; color: #333;">${c.content}</div>
                </div>
            `;
        });
    } else {
        commentsHtml = '<div style="text-align: center; color: #888; font-size: 13px;">暂无评论</div>';
    }

    contentEl.innerHTML = `
        <div style="padding: 20px; background: #fff; margin-bottom: 10px;">
            <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px; color: #000;">${post.title}</div>
            <div style="font-size: 12px; color: #888; margin-bottom: 16px;">楼主: ${post.author}</div>
            <div style="font-size: 16px; line-height: 1.6; color: #333; white-space: pre-wrap;">${post.content}</div>
        </div>
        <div style="padding: 16px; background: #fff;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #8E8E93;">全部评论</div>
            ${commentsHtml}
        </div>
    `;
    
    detailView.style.display = 'flex';
}

async function wcGeneratePhoneBrowser() {
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

    wcShowLoading("正在提取浏览器数据...");

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
        const timePrompt = `\n【绝对时间基准】：当前现实时间是 ${timeString} ${dayString}。你生成的浏览记录时间(time)必须在当前时间之前，且搜索内容要符合当前的时间点（如深夜可能会搜索情感问题，白天可能会搜索工作/学习内容）。\n`;

        const lifeStatusPrompt = getLifeStatusPrompt(char); // 新增

        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += timePrompt;
        prompt += `人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(${userName})设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; 
        if (chatConfig.bilingualEnabled) {
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：虽然聊天记录中包含外语，但你生成的手机内部所有数据（如浏览记录、帖子等）必须全部使用 ${targetLang}！绝对不要使用双语格式！\n`;
        }
        prompt += `【核心场景设定】：我（${userName}）现在正在偷偷查看你（${char.name}）手机上的浏览器APP。\n`;
        prompt += `【最近我们的聊天记录（20-30条）】：\n${recentMsgs}\n\n`;
        
        prompt += `请基于你的人设、当前生活状态，以及我们**最近的聊天上下文**，生成你的浏览器数据。\n`;
        prompt += `【核心要求（极具活人感与强因果逻辑）】：\n`;
        prompt += `1. 【反模板化警告】：绝对禁止生成毫无关联的随机搜索！每一条浏览记录都必须能在【今日行程】或【聊天记录】中找到原因！\n`;
        prompt += `2. 浏览记录(history) 4-8条：如果今天行程里去了超市，可能会搜某个菜的做法；如果聊天里${userName}提到了某部电影，可能会搜影评；如果今天心情烦躁，可能会搜缓解焦虑的方法。必须是顺理成章的延伸！\n`;
        prompt += `3. 内心批注(annotation)：这是你浏览该网页时的真实想法。必须结合你当下的心情(mood)来写，展现你最真实的心理活动。\n`;
        prompt += `4. 论坛帖子(posts) 2-5个：你在匿名论坛发帖求助/吐槽。帖子的内容必须是对【今天发生的事情】或【刚刚和${userName}聊天的内容】的复盘、纠结或吐槽！\n`;
        prompt += `5. 帖子评论5-10个：可以是各种路人或者的NPC评论，也可以是你回复路人或NPC的评论，评论要模拟真实论坛，具备活人感！\n`;
        prompt += `【内在逻辑要求】：在生成 JSON 之前，请确保你的内部推演包含：\n`;
        prompt += `1. 仔细阅读【今日行程】和【聊天记录】，提取出 3-5 个关键事件或情绪点。\n`;
        prompt += `2. 针对这些事件，推断你会在浏览器里搜索什么，或者在论坛里发什么帖子。\n`;
        prompt += `推演结束后，直接返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "history": [
    {"title": "搜索的网页标题", "url_placeholder": "zhidao.baidu.com/question/...", "annotation": "你真实的内心批注", "time": "今天 02:20"}
  ],
  "posts": [
    {
      "title": "论坛帖子标题", 
      "content": "帖子正文内容...", 
      "author": "匿名用户", 
      "comments": [
        {"author": "网友A", "content": "评论内容"}
      ]
    }
  ]
}\n`;


        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 6000
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
        
        let browserData;
        try {
            browserData = JSON.parse(content);
        } catch (parseErr) {
            throw new Error("AI 返回的 JSON 格式错误，请重试。返回内容：" + content.substring(0, 50) + "...");
        }

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.browser = browserData;
        wcSaveData();

        wcRenderPhoneBrowserContent();
        wcShowSuccess("提取成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[浏览器生成失败] ${e.message}`);
        } else {
            wcShowError("生成失败");
        }
    }
}
// ==========================================================================
// 新增：分享到聊天核心逻辑 (Share to Chat)
// ==========================================================================
let pendingShareItem = null;

function wcTriggerShare(event, type, index) {
    // 阻止事件冒泡，防止触发卡片本身的点击事件
    if (event) event.stopPropagation();

    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData) return;

    let title = '';
    let content = '';
    let time = '';
    let item = null; // 增加安全检查变量

    // 根据类型提取数据，并加入防空保护
    if (type === 'memo') {
        item = char.phoneData.favorites?.memos?.[index];
        if (item) { title = item.title; content = item.content; time = item.time; }
    } else if (type === 'diary') {
        item = char.phoneData.favorites?.diaries?.[index];
        if (item) { title = "手写日记"; content = item.content; time = item.time; }
    } else if (type === 'history') {
        item = char.phoneData.browser?.history?.[index];
        if (item) { title = item.title; content = `[内心批注] ${item.annotation}`; time = item.time; }
    } else if (type === 'post') {
        item = char.phoneData.browser?.posts?.[index];
        if (item) { title = item.title; content = item.content; time = ""; }
    } else if (type === 'masturbation') {
        // 兼容新旧数据结构
        item = char.phoneData.privacy?.masturbation || char.phoneData.privacy;
        if (item) { 
            title = "私密记录"; 
            content = `[状态] ${item.status || '无'}\n[动作] ${item.action || '无'}\n[感受] ${item.feeling || '无'}`; 
            time = item.time || ""; 
        }
    } else if (type === 'wetDream') {
        item = char.phoneData.privacy?.wetDream;
        if (item) { 
            title = "春梦记录"; 
            content = `[状态] ${item.status || '无'}\n[梦境] ${item.dream || '无'}\n[感受] ${item.feeling || '无'}`; 
            time = item.time || ""; 
        }
    }

    // 核心修复：如果找不到数据，直接拦截，防止报错
    if (!item) {
        alert("无法读取该数据，可能数据为空或已损坏。");
        return;
    }

    // 清理 HTML 标签（针对日记中的涂改/高亮等标签），用于在弹窗中纯文本预览
    const cleanContent = content.replace(/<[^>]*>?/gm, '');

    pendingShareItem = { type, title, content, time };

    // 填充弹窗内容
    document.getElementById('share-confirm-title').innerText = title;
    document.getElementById('share-confirm-desc').innerText = cleanContent;

    // 显示弹窗
    const modal = document.getElementById('wc-modal-share-confirm');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function wcCancelShare() {
    const modal = document.getElementById('wc-modal-share-confirm');
    modal.classList.add('hidden');
    setTimeout(() => modal.style.display = 'none', 300);
    pendingShareItem = null;
}

// 新增：短视频分享触发函数
window.vTriggerShare = function(source, index) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp) return;

    let video = null;
    if (source === 'home') video = char.phoneData.videoApp.homeFeed[index];
    else if (source === 'posts') video = char.phoneData.videoApp.profile.posts[index];
    else if (source === 'private') video = char.phoneData.videoApp.profile.privatePosts[index];
    else if (source === 'likes') video = char.phoneData.videoApp.profile.likedPosts[index];
    else if (source === 'drafts') video = char.phoneData.videoApp.drafts[index];

    if (!video) return alert("无法读取视频数据");

    const title = (video.author || char.name) + " 的短视频";
    const content = `画面：${video.imageDesc || '无'}\n文案：${video.desc || '无'}`;

    pendingShareItem = { type: 'video', title: title, content: content, time: "" };

    document.getElementById('share-confirm-title').innerText = title;
    document.getElementById('share-confirm-desc').innerText = content;

    const modal = document.getElementById('wc-modal-share-confirm');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

function wcExecuteShare() {
    if (!pendingShareItem) return;

    const charId = wcState.editingCharId; 
    if (!charId) return;

    let tagText = "";
    if (pendingShareItem.type === 'memo') tagText = "MEMO / 备忘录";
    else if (pendingShareItem.type === 'diary') tagText = "DIARY / 手账日记";
    else if (pendingShareItem.type === 'history') tagText = "WEB HISTORY / 浏览记录";
    else if (pendingShareItem.type === 'post') tagText = "FORUM POST / 论坛帖子";
    else if (pendingShareItem.type === 'masturbation') tagText = "SECRET / 私密记录";
    else if (pendingShareItem.type === 'wetDream') tagText = "SECRET / 春梦记录";
    else if (pendingShareItem.type === 'video') tagText = "SHORT VIDEO / 短视频"; // 👈 新增视频类型

    // 构造高级感聊天卡片 HTML
    const cardHtml = `
        <div class="chat-shared-card">
            <div class="shared-card-tag">${tagText}</div>
            <div class="shared-card-title">${pendingShareItem.title}</div>
            <div class="shared-card-content">${pendingShareItem.content}</div>
            ${pendingShareItem.time ? `<div class="shared-card-footer">${pendingShareItem.time}</div>` : ''}
        </div>
    `;

    // 【核心修复】：先将 pendingShareItem 的数据保存到局部变量，防止被 wcCancelShare 清空
    const currentShareItem = pendingShareItem;

    // 1. 关闭手机模拟器
    wcClosePhoneSim();
    
    // 2. 关闭分享弹窗 (这里会将全局的 pendingShareItem 置为 null)
    wcCancelShare();

    // 3. 将卡片作为 receipt 类型发送到聊天界面 (receipt 类型支持直接渲染 HTML)
    wcAddMessage(charId, 'me', 'receipt', cardHtml);

    // 4. 给 AI 发送隐藏的系统提示，强制让它做出反应 (使用保存好的 currentShareItem)
    const aiPrompt = `[系统内部信息(仅AI可见): 用户偷偷查看了你的手机，并把你的【${tagText}】截图发给了你。内容是：“${currentShareItem.title} - ${currentShareItem.content.replace(/<[^>]*>?/gm, '')}”。]`;
    wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });

    // 5. 提示用户
    setTimeout(() => {
        alert("已成功发送给 Ta！快看看 Ta 的反应吧~");
    }, 300);
}

// ==========================================================================
// 新增：全局收藏功能 (Favorites) 核心逻辑
// ==========================================================================

// 生成唯一标识符，用于判断是否已收藏
function getFavSignature(type, title, time, content) {
    const cleanContent = (content || '').replace(/<[^>]*>?/gm, '').substring(0, 30);
    return `${type}_${title}_${time}_${cleanContent}`;
}

// 切换收藏状态
function wcToggleFavorite(event, type, index) {
    if (event) event.stopPropagation();
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData) return;

    let title = ''; let content = ''; let time = ''; let item = null;

    if (type === 'memo') {
        item = char.phoneData.favorites?.memos?.[index];
        if (item) { title = item.title; content = item.content; time = item.time; }
    } else if (type === 'diary') {
        item = char.phoneData.favorites?.diaries?.[index];
        if (item) { title = "手写日记"; content = item.content; time = item.time; }
    } else if (type === 'history') {
        item = char.phoneData.browser?.history?.[index];
        if (item) { title = item.title; content = `[内心批注] ${item.annotation}`; time = item.time; }
    } else if (type === 'post') {
        item = char.phoneData.browser?.posts?.[index];
        if (item) { title = item.title; content = item.content; time = ""; }
    } else if (type === 'masturbation') {
        item = char.phoneData.privacy?.masturbation || char.phoneData.privacy;
        if (item) { title = "私密记录"; content = `[状态] ${item.status || '无'}\n[动作] ${item.action || '无'}\n[感受] ${item.feeling || '无'}`; time = item.time || ""; }
    } else if (type === 'wetDream') {
        item = char.phoneData.privacy?.wetDream;
        if (item) { title = "春梦记录"; content = `[状态] ${item.status || '无'}\n[梦境] ${item.dream || '无'}\n[感受] ${item.feeling || '无'}`; time = item.time || ""; }
    }

    if (!item) return alert("无法读取该数据");

    const sig = getFavSignature(type, title, time, content);
    if (!wcState.myFavorites) wcState.myFavorites = [];

    const existingIdx = wcState.myFavorites.findIndex(f => f.sig === sig);
    if (existingIdx > -1) {
        // 取消收藏
        wcState.myFavorites.splice(existingIdx, 1);
    } else {
        // 添加收藏
        wcState.myFavorites.unshift({
            id: Date.now(),
            sig, type, title, content, time,
            charName: char.name,
            charAvatar: char.avatar,
            savedAt: Date.now()
        });
        showFavoriteAlert();
    }
    
    wcSaveData();
    wcRefreshCurrentPhoneView();
}

// 刷新当前正在查看的手机页面
function wcRefreshCurrentPhoneView() {
    if (document.getElementById('wc-phone-app-privacy').style.display === 'flex') wcRenderPhonePrivacyContent();
    if (document.getElementById('wc-phone-app-browser').style.display === 'flex') wcRenderPhoneBrowserContent();
    if (document.getElementById('wc-phone-app-favorites').style.display === 'flex') wcRenderPhoneFavoritesContent();
}

// 显示高级感收藏成功弹窗
function showFavoriteAlert() {
    const modal = document.getElementById('wc-modal-favorite-alert');
    modal.classList.remove('hidden');
    modal.classList.add('active');
    
    setTimeout(() => {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 400);
    }, 1500);
}

// ==========================================================================
// 新增：WeChat 主界面的「我的收藏」页面逻辑
// ==========================================================================

function wcOpenMyFavorites() {
    document.getElementById('wc-view-user').classList.remove('active');
    document.getElementById('wc-view-my-favorites').classList.add('active');
    
    // 隐藏底部导航栏
    document.getElementById('wc-main-tabbar').style.display = 'none';
    
    // 🔪 核心修改：彻底隐藏全局的微信顶栏，使用我们自己的路径栏
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'none';
    
    wcRenderMyFavorites();
}

function wcCloseMyFavorites() {
    document.getElementById('wc-view-my-favorites').classList.remove('active');
    wcSwitchTab('user');
    
    // 恢复底部导航栏
    document.getElementById('wc-main-tabbar').style.display = 'flex';
    
    // 🔪 核心修复：删除了强行恢复顶栏的代码，交给 wcSwitchTab 统一处理
}

// 预设的文件夹颜色库 (后层深色, 前层浅色)
const folderColors = [
    { back: '#e6c35c', front: '#f8d775' }, // 经典黄
    { back: '#5a9df8', front: '#7ebeff' }, // 蓝
    { back: '#ff8a8a', front: '#ffb3b3' }, // 粉
    { back: '#af52de', front: '#d28cff' }, // 紫
    { back: '#34c759', front: '#6be388' }, // 绿
    { back: '#ff9500', front: '#ffc04d' }  // 橙
];

// 根据角色名字计算哈希值，分配固定颜色
function getFolderColorByChar(charName) {
    let hash = 0;
    for (let i = 0; i < charName.length; i++) {
        hash = charName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % folderColors.length;
    return folderColors[index];
}

// 类别名称映射
const favTypeNames = {
    'memo': '备忘录',
    'diary': '手写日记',
    'history': '浏览记录',
    'post': '论坛帖子',
    'masturbation': '私密记录',
    'wetDream': '春梦记录'
};

// 渲染文件夹主视图
function wcRenderMyFavorites() {
    // 确保显示文件夹视图，隐藏详情视图
    document.getElementById('fav-folder-view').style.display = 'flex';
    document.getElementById('fav-detail-view').style.display = 'none';

    const container = document.getElementById('wc-my-favorites-folders');
    container.innerHTML = '';

    if (!wcState.myFavorites || wcState.myFavorites.length === 0) {
        container.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #8E8E93; padding-top: 50px; font-size: 14px;">文件夹空空如也</div>';
        return;
    }

    // 按 角色 + 类别 进行分组
    const folders = {};
    wcState.myFavorites.forEach(fav => {
        const key = `${fav.charName}_${fav.type}`;
        if (!folders[key]) {
            folders[key] = {
                charName: fav.charName,
                type: fav.type,
                items: []
            };
        }
        folders[key].items.push(fav);
    });

    // 渲染文件夹
    Object.values(folders).forEach(folder => {
        const typeName = favTypeNames[folder.type] || '其他收藏';
        const folderName = `${folder.charName} - ${typeName}`;
        const colors = getFolderColorByChar(folder.charName);

        const div = document.createElement('div');
        div.className = 'folder-item';
        div.onclick = () => wcOpenFavoriteFolder(folder.charName, folder.type, folderName);
        
        div.innerHTML = `
            <div class="folder-icon">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <!-- 后层文件夹 -->
                    <path d="M5 20 h35 l10 10 h45 v60 h-90 z" fill="${colors.back}"/>
                    <!-- 里面的纸张 -->
                    <rect x="20" y="25" width="60" height="60" fill="#ffffff" stroke="#cccccc" stroke-width="1"/>
                    <line x1="30" y1="40" x2="70" y2="40" stroke="#e0e0e0" stroke-width="3"/>
                    <line x1="30" y1="55" x2="70" y2="55" stroke="#e0e0e0" stroke-width="3"/>
                    <line x1="30" y1="70" x2="50" y2="70" stroke="#e0e0e0" stroke-width="3"/>
                    <!-- 前层文件夹 -->
                    <path d="M5 35 h90 l-5 55 h-80 z" fill="${colors.front}"/>
                </svg>
            </div>
            <div class="folder-name">${folderName}</div>
        `;
        container.appendChild(div);
    });
}

// 打开特定文件夹详情
function wcOpenFavoriteFolder(charName, type, folderName) {
    document.getElementById('fav-folder-view').style.display = 'none';
    document.getElementById('fav-detail-view').style.display = 'flex';
    document.getElementById('fav-detail-path-name').innerText = folderName;

    const list = document.getElementById('wc-my-favorites-list');
    list.innerHTML = '';

    // 过滤出该文件夹下的内容
    const items = wcState.myFavorites.filter(f => f.charName === charName && f.type === type);

    items.forEach(fav => {
        const dateStr = new Date(fav.savedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const div = document.createElement('div');
        div.className = 'fav-accordion-item';
        div.innerHTML = `
            <div class="fav-accordion-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="fav-header-left">
                    <img src="${fav.charAvatar}" class="fav-char-avatar">
                    <div class="fav-header-info">
                        <div class="fav-title">${fav.title}</div>
                        <div class="fav-time">${dateStr}</div>
                    </div>
                </div>
                <svg class="fav-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="fav-accordion-body">
                <div class="fav-content-inner">
                    <div class="fav-original-time">记录时间: ${fav.time || '未知'}</div>
                    <div class="fav-text">${fav.content}</div>
                    <div class="fav-delete-btn" onclick="wcDeleteFavorite(${fav.id}, '${charName}', '${type}', '${folderName}')">取消收藏</div>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

// 关闭文件夹详情，返回文件夹列表
function wcCloseFavoriteFolder() {
    document.getElementById('fav-detail-view').style.display = 'none';
    document.getElementById('fav-folder-view').style.display = 'flex';
    wcRenderMyFavorites(); // 刷新文件夹列表（以防有文件夹被清空）
}

// 删除收藏 (带参数，以便删除后刷新当前详情页)
function wcDeleteFavorite(id, charName, type, folderName) {
    if (confirm("确定要取消收藏吗？")) {
        wcState.myFavorites = wcState.myFavorites.filter(f => f.id !== id);
        wcSaveData();
        
        // 检查该文件夹下是否还有内容
        const remainingItems = wcState.myFavorites.filter(f => f.charName === charName && f.type === type);
        if (remainingItems.length === 0) {
            // 如果删空了，自动退回文件夹列表
            wcCloseFavoriteFolder();
        } else {
            // 否则刷新当前详情页
            wcOpenFavoriteFolder(charName, type, folderName);
        }
    }
}

// 【新增】：渲染手机预设列表
function wcRenderPhonePresets() {
    const select = document.getElementById('wc-phone-preset-select');
    if (!select) return;
    select.innerHTML = '<option value="">选择预设...</option>';
    wcState.phonePresets.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = p.name;
        select.appendChild(opt);
    });
}

// 【新增】：保存当前手机装修为预设
function wcSavePhonePreset() {
    const name = prompt("请输入手机预设名称：");
    if (!name) return;
    
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const currentConfig = char && char.phoneConfig ? char.phoneConfig : {};
    
    const preset = {
        name: name,
        wallpaper: wcState.tempPhoneConfig.wallpaper || currentConfig.wallpaper || '',
        stickyNote: wcState.tempPhoneConfig.stickyNote || currentConfig.stickyNote || '',
        icons: {
            msg: (wcState.tempPhoneConfig.icons && wcState.tempPhoneConfig.icons.msg) || (currentConfig.icons && currentConfig.icons.msg) || '',
            browser: (wcState.tempPhoneConfig.icons && wcState.tempPhoneConfig.icons.browser) || (currentConfig.icons && currentConfig.icons.browser) || '',
            cart: (wcState.tempPhoneConfig.icons && wcState.tempPhoneConfig.icons.cart) || (currentConfig.icons && currentConfig.icons.cart) || '',
            settings: (wcState.tempPhoneConfig.icons && wcState.tempPhoneConfig.icons.settings) || (currentConfig.icons && currentConfig.icons.settings) || '',
            video: (wcState.tempPhoneConfig.icons && wcState.tempPhoneConfig.icons.video) || (currentConfig.icons && currentConfig.icons.video) || '',
            exit: (wcState.tempPhoneConfig.icons && wcState.tempPhoneConfig.icons.exit) || (currentConfig.icons && currentConfig.icons.exit) || '',
            files: (wcState.tempPhoneConfig.icons && wcState.tempPhoneConfig.icons.files) || (currentConfig.icons && currentConfig.icons.files) || ''
        }
    };
    
    wcState.phonePresets.push(preset);
    wcSaveData();
    wcRenderPhonePresets();
    alert("手机预设已保存！");
}

// 【新增】：应用手机预设
function wcApplyPhonePreset(idx) {
    if (idx === "") return;
    const preset = wcState.phonePresets[idx];
    if (!preset) return;
    
    wcState.tempPhoneConfig.wallpaper = preset.wallpaper;
    wcState.tempPhoneConfig.stickyNote = preset.stickyNote;
    wcState.tempPhoneConfig.icons = { ...preset.icons };
    
    // 更新预览图
    if (preset.wallpaper) {
        document.getElementById('wc-preview-phone-bg').src = preset.wallpaper;
        document.getElementById('wc-preview-phone-bg').style.display = 'block';
        document.getElementById('wc-text-phone-bg').style.display = 'none';
    }
    if (preset.stickyNote) {
        document.getElementById('wc-preview-sticky-note').src = preset.stickyNote;
        document.getElementById('wc-preview-sticky-note').style.display = 'block';
        document.getElementById('wc-text-sticky-note').style.display = 'none';
    }
    ['msg', 'browser', 'cart', 'settings', 'video', 'exit', 'files'].forEach(id => {
        if (preset.icons[id]) {
            const previewEl = document.getElementById(`wc-preview-icon-${id}`);
            if (previewEl) {
                previewEl.src = preset.icons[id];
                previewEl.style.display = 'block';
            }
        }
    });
}

// 【新增】：删除手机预设
function wcDeletePhonePreset() {
    const select = document.getElementById('wc-phone-preset-select');
    const idx = select.value;
    if (idx === "") return alert("请先选择一个预设");
    
    if (confirm("确定删除该手机预设吗？")) {
        wcState.phonePresets.splice(idx, 1);
        wcSaveData();
        wcRenderPhonePresets();
    }
}

// ==========================================================================
// 新增：购物 (Shopping) 逻辑
// ==========================================================================
function wcActionShopping() {
    wcCloseAllPanels();
    wcOpenShoppingPage();
}

function wcOpenShoppingPage() {
    document.getElementById('wc-view-chat-detail').classList.remove('active');
    const shopPage = document.getElementById('wc-view-shopping');
    shopPage.classList.add('active');
    // 【修复】：强制设置为 flex，覆盖可能存在的 none
    shopPage.style.display = 'flex';
    
    if (!wcState.shopData) {
        wcState.shopData = { mall: [], takeout: [], cart: [], config: { worldbookEntries: [] } };
    }
    
    wcSwitchShopTab('mall');
    wcUpdateCartBadge();
}

function wcCloseShoppingPage() {
    const shopPage = document.getElementById('wc-view-shopping');
    shopPage.classList.remove('active');
    // 【修复】：强制设置为 none，防止它挤占空间
    shopPage.style.display = 'none';
    document.getElementById('wc-view-chat-detail').classList.add('active');
}

function wcSwitchShopTab(tab) {
    // 兼容旧的 shop-tab 和新的 shop-cap-tab
    document.querySelectorAll('.shop-tab, .shop-cap-tab').forEach(el => el.classList.remove('active'));
    const activeTab = document.getElementById(`shop-tab-${tab}`) || document.getElementById(`cap-tab-${tab}`);
    if (activeTab) activeTab.classList.add('active');
    
    document.querySelectorAll('.shop-list').forEach(el => el.style.display = 'none');
    const activeList = document.getElementById(`shop-list-${tab}`);
    if (activeList) activeList.style.display = 'block';
    
    wcRenderShopItems(tab);
}

function wcOpenShopSettingsModal() {
    const list = document.getElementById('wc-shop-setting-wb-list');
    list.innerHTML = '';
    let shopWbCount = 0;
    if (wcState.shopData.config && wcState.shopData.config.worldbookEntries) {
        wcState.shopData.config.worldbookEntries.forEach(id => {
            list.innerHTML += `<input type="checkbox" value="${id}" checked>`;
            shopWbCount++;
        });
    }
    document.getElementById('wc-shop-setting-wb-count').innerText = `已选 ${shopWbCount} 项`;

    wcOpenModal('wc-modal-shop-settings');
}

function wcSaveShopSettings() {
    const checkboxes = document.querySelectorAll('#wc-shop-setting-wb-list input[type="checkbox"]:checked');
    wcState.shopData.config.worldbookEntries = Array.from(checkboxes).map(cb => cb.value);
    wcSaveData();
    wcCloseModal('wc-modal-shop-settings');
    alert("商城设置已保存");
}

async function wcGenerateShopItems() {
    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在进货中...");

    try {
        // 1. 获取当前角色和用户设定
        const charId = wcState.activeChatId || wcState.editingCharId;
        const char = wcState.characters.find(c => c.id === charId);
        let charInfo = "";
        let userInfo = "";
        if (char) {
            charInfo = `【角色设定 (${char.name})】：${char.prompt}\n`;
            const chatConfig = char.chatConfig || {};
            userInfo = `【用户设定】：${chatConfig.userPersona || wcState.user.persona || "无"}\n`;
        }

        // 2. 获取勾选的世界书
        let wbInfo = "";
        const selectedWbs = wcState.shopData.config.worldbookEntries || [];
        if (worldbookEntries.length > 0 && selectedWbs.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => selectedWbs.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 3. 组装强大的 Prompt
        let prompt = `你现在是一个商城和外卖平台的后台引擎。请根据以下设定，生成商城商品和外卖商品。\n`;
        prompt += charInfo;
        prompt += userInfo;
        if (wbInfo) prompt += wbInfo + "\n";
        
        prompt += `【要求】：\n`;
        prompt += `1. 总共生成 30 个商品：商城 (mall) 15 个，外卖 (takeout) 15 个。\n`;
        prompt += `2. 商城商品 (mall) 包含两类：\n`;
        prompt += `   - 前 8 个为【日常用品DAILY】：符合世界观和角色日常生活的普通物品。\n`;
        prompt += `   - 后 7 个为【可能喜欢FAV】：根据角色和用户的设定，专门为他们推荐的特殊物品、礼物或情趣用品。\n`;
        prompt += `   - 注意：日常用品和可能喜欢的商品必须完全不同，不互通！\n`;
        prompt += `3. 外卖商品 (takeout) 包含两类：\n`;
        prompt += `   - 前 8 个为【普通小吃/餐饮SNACK】：符合世界观的常见食物。\n`;
        prompt += `   - 后 7 个为【可能喜欢的小吃FAV】：根据角色和用户的口味偏好，专门推荐的特色美食或饮品。\n`;
        prompt += `   - 注意：普通小吃和可能喜欢的小吃必须完全不同，不互通！\n`;
        prompt += `4. 每个商品包含物品名称 (name)、符合设定的简短描述 (desc)、以及合理的价格 (price，数字格式)。\n`;
        prompt += `5. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
          "mall": [
            {"name": "商品名", "desc": "描述", "price": 99.00}
          ],
          "takeout": [
            {"name": "外卖名", "desc": "描述", "price": 25.50}
          ]
        }\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 10000
            })
        });

        const data = await response.json();
        
        // 👇👇👇 新增：核心修复，拦截并显示真实的 API 错误原因 👇👇👇
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。详细报错：" + JSON.stringify(data));
        }
        // 👆👆👆 新增结束 👆👆👆

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedData = JSON.parse(content);

        wcState.shopData.mall = generatedData.mall || [];
        wcState.shopData.takeout = generatedData.takeout || [];
        wcSaveData();

        wcUpdateCatOrbit(); // 刷新当前视图
        wcShowSuccess("进货成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[商城进货失败] ${e.message}`);
        else wcShowError("生成失败");
    }
}

// ==========================================
// 商城全局状态与侧边栏逻辑 (支持商城与外卖双模式)
// ==========================================
let wcShopCurrentTab = 'mall'; // 记录当前是大 Tab 是商城还是外卖
let wcShopCurrentItems = [];
let wcCatCurrentIndex = 0;

// 动态获取当前 Tab 的分类
function getShopCategories() {
    if (wcShopCurrentTab === 'mall') {
        return [
            { id: 'all', label: '全部' },
            { id: 'daily', label: '日常' },
            { id: 'fav', label: '推荐' },
            { id: 'add', label: '自选' }
        ];
    } else {
        return [
            { id: 'all', label: '全部' },
            { id: 'snack', label: '小吃' },
            { id: 'fav', label: '推荐' },
            { id: 'add', label: '自选' }
        ];
    }
}

function wcSwitchShopTab(tab) {
    wcShopCurrentTab = tab; // 更新当前大 Tab 状态
    
    document.querySelectorAll('.shop-tab, .shop-cap-tab').forEach(el => el.classList.remove('active'));
    const activeTab = document.getElementById(`shop-tab-${tab}`) || document.getElementById(`cap-tab-${tab}`);
    if (activeTab) activeTab.classList.add('active');
    
    document.querySelectorAll('.shop-list').forEach(el => el.style.display = 'none');
    const activeList = document.getElementById(`shop-list-${tab}`);
    if (activeList) activeList.style.display = 'flex'; // 保持 flex 布局
    
    // 切换大 Tab 时，重置侧边栏到 ALL 分类
    wcCatCurrentIndex = 0;
    wcRenderShopSidebar();
}

function wcRenderShopSidebar() {
    const sidebar = document.getElementById('shop-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';
    
    const categories = getShopCategories();
    categories.forEach((cat, i) => {
        const node = document.createElement('div');
        node.className = `shop-sidebar-item ${i === wcCatCurrentIndex ? 'active' : ''}`;
        node.innerText = cat.label;
        node.onclick = () => {
            wcCatCurrentIndex = i;
            wcUpdateShopSidebar();
        };
        sidebar.appendChild(node);
    });
    wcUpdateShopSidebar();
}

function wcUpdateShopSidebar() {
    const sidebar = document.getElementById('shop-sidebar');
    if (!sidebar) return;

    const categories = getShopCategories();
    Array.from(sidebar.children).forEach((node, i) => {
        if (i === wcCatCurrentIndex) {
            node.classList.add('active');
        } else {
            node.classList.remove('active');
        }
    });

    // 动态过滤数据 (严格隔离前8个和后7个)
    const catId = categories[wcCatCurrentIndex].id;
    const allItems = wcState.shopData[wcShopCurrentTab] || [];
    
    if (catId === 'add') {
        // 仅显示手动添加的商品
        wcShopCurrentItems = allItems.filter(item => item.isManual);
    } else if (catId === 'all') {
        // 显示所有商品
        wcShopCurrentItems = [...allItems];
    } else if (catId === 'daily' || catId === 'snack') {
        // 显示前半部分 AI 生成的商品 (前8个)
        const aiItems = allItems.filter(item => !item.isManual);
        wcShopCurrentItems = aiItems.slice(0, 8);
    } else if (catId === 'fav') {
        // 显示后半部分 AI 生成的商品 (后7个)
        const aiItems = allItems.filter(item => !item.isManual);
        wcShopCurrentItems = aiItems.slice(8, 15);
    }
    
    // 渲染当前 Tab 的商品列表
    wcRenderShopItems(wcShopCurrentTab, catId === 'add');
}

// ==========================================
// 商品列表渲染与添加/编辑/删除逻辑
// ==========================================
function wcRenderShopItems(tab, isAddMode = false) {
    const container = document.getElementById(`shop-list-${tab}`);
    if (!container) return;
    container.innerHTML = '';
    
    const items = wcShopCurrentItems;

    if (isAddMode) {
        // 渲染手动添加的商品（去除了卡片表面的编辑删除按钮，保持极简）
        items.forEach((item, idx) => {
            const icon = tab === 'mall' 
                ? '<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.5;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>' 
                : '<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.5;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>';
            const card = document.createElement('div');
            card.className = 'ins-shop-card manual-card';
            card.innerHTML = `
                <div class="ins-shop-card-icon">${icon}</div>
                <div class="ins-shop-card-info">
                    <div class="ins-shop-card-name">${item.name}</div>
                    <div class="ins-shop-card-desc">${item.desc || ''}</div>
                    <div class="ins-shop-card-price">¥${parseFloat(item.price).toFixed(2)}</div>
                </div>
            `;
            card.onclick = () => wcOpenTarotModal(tab, idx);
            container.appendChild(card);
        });


        // 渲染添加按钮卡片 (换成了高级的 SVG 加号)
        const addCard = document.createElement('div');
        addCard.className = 'ins-shop-card add-card';
        addCard.onclick = () => {
            document.getElementById('wc-add-modal-title').innerText = `添加新${tab === 'mall' ? '商品' : '外卖'}`;
            document.getElementById('wc-add-id').value = '';
            document.getElementById('wc-add-name').value = '';
            document.getElementById('wc-add-desc').value = '';
            document.getElementById('wc-add-price').value = '';
            document.getElementById('wc-add-product-modal').classList.add('active');
        };
        addCard.innerHTML = `
            <div class="ins-shop-card-icon">
                <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.5;"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <div class="ins-shop-card-name">添加新${tab === 'mall' ? '商品' : '外卖'}</div>
        `;
        container.appendChild(addCard);
        return;
    }

    if (items.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; margin: 50px auto; width: 100%;">空空如也</div>';
        return;
    }

    items.forEach((item, idx) => {
        const icon = tab === 'mall' 
            ? '<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.5;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>' 
            : '<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.5;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>';
        const card = document.createElement('div');
        card.className = 'ins-shop-card';
        card.onclick = () => wcOpenTarotModal(tab, idx);
        card.innerHTML = `
            <div class="ins-shop-card-icon">${icon}</div>
            <div class="ins-shop-card-info">
                <div class="ins-shop-card-name">${item.name}</div>
                <div class="ins-shop-card-desc">${item.desc || ''}</div>
                <div class="ins-shop-card-price">¥${parseFloat(item.price).toFixed(2)}</div>
            </div>
            <div class="ins-shop-card-add-btn" onclick="event.stopPropagation(); wcAddToCart('${tab}', ${idx})">+</div>
        `;
        container.appendChild(card);
    });
}

window.wcSaveNewProduct = function() {
    const idField = document.getElementById('wc-add-id').value;
    const name = document.getElementById('wc-add-name').value.trim();
    const desc = document.getElementById('wc-add-desc').value.trim();
    const price = document.getElementById('wc-add-price').value.trim();
    
    if (!name || !price) return alert("请填写名称和价格");

    if (!wcState.shopData[wcShopCurrentTab]) wcState.shopData[wcShopCurrentTab] = [];
    
    if (idField) {
        // 编辑模式
        const item = wcState.shopData[wcShopCurrentTab].find(i => i.id === idField);
        if (item) {
            item.name = name;
            item.desc = desc;
            item.price = parseFloat(price).toFixed(2);
        }
    } else {
        // 新增模式
        wcState.shopData[wcShopCurrentTab].push({
            id: 'manual_' + Date.now(),
            isManual: true, // 标记为手动添加
            name: name,
            desc: desc || '神秘的未知物品',
            price: parseFloat(price).toFixed(2)
        });
    }
    
    wcSaveData();
    
    document.getElementById('wc-add-product-modal').classList.remove('active');
    wcUpdateCatOrbit(); // 刷新当前视图
    alert(idField ? "修改成功！" : "添加成功！");
};

window.wcDeleteProduct = function(tab, id) {
    if (confirm("确定要删除这个商品吗？")) {
        wcState.shopData[tab] = wcState.shopData[tab].filter(i => i.id !== id);
        wcSaveData();
        wcUpdateCatOrbit(); // 刷新当前视图
    }
};

window.wcEditProduct = function(tab, id) {
    const item = wcState.shopData[tab].find(i => i.id === id);
    if (!item) return;
    document.getElementById('wc-add-modal-title').innerText = "编辑商品";
    document.getElementById('wc-add-id').value = item.id;
    document.getElementById('wc-add-name').value = item.name;
    document.getElementById('wc-add-desc').value = item.desc;
    document.getElementById('wc-add-price').value = item.price;
    document.getElementById('wc-add-product-modal').classList.add('active');
};


// ==========================================
// 塔罗牌弹窗与星际轨道逻辑
// ==========================================
let wcTarotCurrentTab = 'mall';
let wcTarotCurrentIdx = 0;
const wcTarotRadius = 200;
const wcTarotStepAngle = 25;

window.wcOpenTarotModal = function(tab, idx) {
    wcTarotCurrentTab = tab;
    wcTarotCurrentIdx = idx;
    wcRenderTarotCards(tab);
    wcRenderTarotOrbit(tab);
    wcUpdateTarotTransforms();
    const modal = document.getElementById('wc-tarot-modal');
    modal.style.display = 'flex'; // 👈 核心修复：先显示容器，彻底解决阻挡点击的Bug
    setTimeout(() => modal.classList.add('active'), 10);
};

window.wcCloseTarotModal = function() {
    const modal = document.getElementById('wc-tarot-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 400); // 👈 核心修复：动画结束后彻底隐藏容器
};
// 修改后的代码
window.wcRenderTarotCards = function(tab) {
    const slider = document.getElementById('wc-tarot-slider');
    slider.innerHTML = '';
    const items = tab === 'mall' ? wcShopCurrentItems : (wcState.shopData[tab] || []);
    
    items.forEach((item, index) => {
        const icon = tab === 'mall' 
            ? '<svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:none;stroke:currentColor;stroke-width:1.5;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>' 
            : '<svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:none;stroke:currentColor;stroke-width:1.5;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>';
        const card = document.createElement('div');
        card.className = 'tarot-card';
        card.id = `tarot-card-${index}`;
        
        const displayId = String(index + 1).padStart(2, '0');
        
        // 👇 判断是否为手动添加的商品，如果是，注入高级 SVG 编辑/删除按钮
        let manageActionsHtml = '';
        if (item.isManual) {
            manageActionsHtml = `
                <div class="tarot-manage-actions">
                    <div class="tarot-action-btn edit" onclick="event.stopPropagation(); wcEditProduct('${tab}', '${item.id}'); wcCloseTarotModal();" title="编辑">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                    <div class="tarot-action-btn delete" onclick="event.stopPropagation(); wcDeleteProduct('${tab}', '${item.id}'); wcCloseTarotModal();" title="删除">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </div>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="tarot-header">
                <span class="tarot-tag">NO.${displayId}</span>
                <span class="tarot-close" onclick="wcCloseTarotModal()">×</span>
            </div>
            ${manageActionsHtml}
            <div class="tarot-icon">${icon}</div>
            <div class="tarot-title">${item.name}</div>
            <div class="tarot-desc">${item.desc}</div>
            <div class="tarot-price">¥${parseFloat(item.price).toFixed(2)}</div>
            <button class="tarot-btn" onclick="wcAddToCartFromTarot('${tab}', ${index})">ADD TO CART</button>
        `;
        slider.appendChild(card);
    });
};

window.wcRenderTarotOrbit = function(tab) {
    const wheel = document.getElementById('wc-tarot-orbit-wheel');
    if (!wheel) return;
    wheel.innerHTML = '';
    const items = tab === 'mall' ? wcShopCurrentItems : (wcState.shopData[tab] || []);
    
    items.forEach((_, i) => {
        const angleDeg = i * wcTarotStepAngle;
        const angleRad = (angleDeg - 90) * (Math.PI / 180);
        const x = wcTarotRadius * Math.cos(angleRad);
        const y = wcTarotRadius * Math.sin(angleRad);

        const node = document.createElement('div');
        node.className = `tarot-orbit-node ${i === wcTarotCurrentIdx ? 'active' : ''}`;
        node.style.transform = `translate(${x}px, ${y}px)`;
        node.innerHTML = `<div class="tarot-orbit-dot"></div>`;
        node.onclick = () => {
            wcTarotCurrentIdx = i;
            wcUpdateTarotTransforms();
        };
        wheel.appendChild(node);
    });
};

window.wcUpdateTarotTransforms = function() {
    // 👈 增加父级限制，防止误伤恋人空间里的同名卡片导致索引错位
    const cards = document.querySelectorAll('#wc-tarot-slider .tarot-card');
    cards.forEach((card, index) => {
        const offset = index - wcTarotCurrentIdx;
        if (offset === 0) {
            card.style.transform = `translateX(0) scale(1) translateZ(0)`;
            card.style.zIndex = 10; card.style.opacity = 1; card.style.pointerEvents = 'auto';
        } else if (offset < 0) {
            card.style.transform = `translateX(${offset * 120}px) scale(0.85) rotateY(15deg) translateZ(-100px)`;
            card.style.zIndex = 5 + offset; card.style.opacity = 1 - Math.abs(offset) * 0.4; card.style.pointerEvents = 'none';
        } else {
            card.style.transform = `translateX(${offset * 120}px) scale(0.85) rotateY(-15deg) translateZ(-100px)`;
            card.style.zIndex = 5 - offset; card.style.opacity = 1 - Math.abs(offset) * 0.4; card.style.pointerEvents = 'none';
        }
    });

    const wheel = document.getElementById('wc-tarot-orbit-wheel');
    if (wheel) {
        const rotation = -wcTarotCurrentIdx * wcTarotStepAngle;
        wheel.style.transform = `rotate(${rotation}deg)`;
        Array.from(wheel.children).forEach((node, i) => {
            if (i === wcTarotCurrentIdx) node.classList.add('active');
            else node.classList.remove('active');
        });
    }
};

let wcTarotStartX = 0;
let wcTarotIsDragging = false;
window.wcTarotTouchStart = function(e) { wcTarotStartX = e.touches[0].clientX; wcTarotIsDragging = true; };
window.wcTarotTouchMove = function(e) { if (wcTarotIsDragging && e.cancelable) e.preventDefault(); };
window.wcTarotTouchEnd = function(e) {
    if (!wcTarotIsDragging) return;
    wcTarotIsDragging = false;
    const diff = e.changedTouches[0].clientX - wcTarotStartX;
    const items = wcTarotCurrentTab === 'mall' ? wcShopCurrentItems : (wcState.shopData[wcTarotCurrentTab] || []);

    if (diff > 40 && wcTarotCurrentIdx > 0) {
        wcTarotCurrentIdx--; wcUpdateTarotTransforms();
    } else if (diff < -40 && wcTarotCurrentIdx < items.length - 1) {
        wcTarotCurrentIdx++; wcUpdateTarotTransforms();
    }
};

window.wcAddToCartFromTarot = function(tab, idx) {
    // 找到真实的商品数据
    const items = tab === 'mall' ? wcShopCurrentItems : (wcState.shopData[tab] || []);
    const item = items[idx];
    if (!item) return;
    
    if (!wcState.shopData.cart) wcState.shopData.cart = [];
    wcState.shopData.cart.push({ ...item, id: Date.now() + Math.random() });
    wcSaveData();
    wcUpdateCartBadge();
    
    wcCloseTarotModal();
    alert("已化作星光落入购物车");
};

function wcAddToCart(tab, idx) {
    const item = wcState.shopData[tab][idx];
    if (!item) return;
    
    if (!wcState.shopData.cart) wcState.shopData.cart = [];
    wcState.shopData.cart.push({ ...item, id: Date.now() + Math.random() });
    wcSaveData();
    wcUpdateCartBadge();
    
    // 简单的加入购物车动画提示
    const badge = document.getElementById('shop-cart-badge');
    badge.style.transform = 'scale(1.5)';
    setTimeout(() => badge.style.transform = 'scale(1)', 200);
}

function wcUpdateCartBadge() {
    const badge = document.getElementById('shop-cart-badge');
    const count = wcState.shopData.cart ? wcState.shopData.cart.length : 0;
    badge.innerText = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

function wcOpenCartModal() {
    wcRenderCart();
    wcOpenModal('wc-modal-shop-cart');
}

function wcRenderCart() {
    const container = document.getElementById('shop-cart-list');
    const cart = wcState.shopData.cart || [];
    
    if (cart.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; margin-top: 50px;">购物车是空的</div>';
        document.getElementById('shop-cart-total').innerText = '¥0.00';
        return;
    }

    let html = '';
    let total = 0;
    
    // 将商品按名称和价格分组，计算数量
    const groupedCart = {};
    cart.forEach((item, idx) => {
        const key = item.name + '_' + item.price;
        if (!groupedCart[key]) {
            groupedCart[key] = { ...item, quantity: 0, indices: [] };
        }
        groupedCart[key].quantity += 1;
        groupedCart[key].indices.push(idx);
        total += parseFloat(item.price);
    });

    Object.values(groupedCart).forEach(group => {
        html += `
            <div class="cart-item" style="display: flex; align-items: center; gap: 12px; padding: 15px 0; border-bottom: 1px solid #F0F0F0;">
                <div class="cart-item-checkbox" style="width: 20px; height: 20px; border-radius: 50%; background: #111; display: flex; align-items: center; justify-content: center; color: #FFF; flex-shrink: 0;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke: currentColor; stroke-width: 3; fill: none;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="cart-item-img" style="width: 60px; height: 60px; border-radius: 8px; background: #F5F5F5; flex-shrink: 0;"></div>
                <div class="cart-item-info" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; height: 60px;">
                    <div class="cart-item-title" style="font-size: 15px; font-weight: 600; color: #111;">${group.name}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="color:#111; font-size:16px; font-weight:bold;">¥${parseFloat(group.price).toFixed(2)}</div>
                        <div class="cart-item-quantity-control" style="display: flex; align-items: center; gap: 10px;">
                            <div class="qty-btn minus" onclick="wcRemoveOneFromCart('${group.name}', '${group.price}')" style="width: 24px; height: 24px; background: #F5F5F5; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #111; font-weight: bold;">-</div>
                            <span class="qty-num" style="font-size: 14px; font-weight: 600; color: #111; min-width: 16px; text-align: center;">${group.quantity}</span>
                            <div class="qty-btn plus" onclick="wcAddOneToCart('${group.name}', '${group.price}')" style="width: 24px; height: 24px; background: #F5F5F5; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #111; font-weight: bold;">+</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    document.getElementById('shop-cart-total').innerText = `¥ ${total.toFixed(2)}`;
}

window.wcRemoveOneFromCart = function(name, price) {
    if (!wcState.shopData.cart) return;
    const idx = wcState.shopData.cart.findIndex(item => item.name === name && item.price == price);
    if (idx !== -1) {
        wcState.shopData.cart.splice(idx, 1);
        wcSaveData();
        wcUpdateCartBadge();
        wcRenderCart();
    }
};

window.wcAddOneToCart = function(name, price) {
    if (!wcState.shopData.cart) return;
    const item = wcState.shopData.cart.find(item => item.name === name && item.price == price);
    if (item) {
        wcState.shopData.cart.push({ ...item, id: Date.now() + Math.random() });
        wcSaveData();
        wcUpdateCartBadge();
        wcRenderCart();
    }
};

// --- 找到 wcCheckoutCart 函数，替换为以下内容 ---
function wcCheckoutCart() {
    const cart = wcState.shopData.cart || [];
    if (cart.length === 0) return alert("购物车是空的");

    // 计算总价并更新到新的结算卡片上
    let total = 0;
    cart.forEach(item => {
        total += parseFloat(item.price);
    });
    document.getElementById('checkout-card-total').innerText = `¥${total.toFixed(2)}`;

    // 打开新的卡片式结算弹窗
    wcOpenModal('wc-modal-shop-checkout-card');
}

// 新增：微信商城购物车删除商品逻辑
window.wcRemoveFromCart = function(idx) {
    if (!wcState.shopData.cart) return;
    wcState.shopData.cart.splice(idx, 1);
    wcSaveData();
    wcUpdateCartBadge();
    wcRenderCart();
};

// --- 找到 wcOpenDeliveryTypeModal 函数，替换为以下内容 ---
function wcOpenDeliveryTypeModal(method) {
    // 存储支付方式（赠送或代付）
    wcState.tempShopTransaction = { method: method };
    // 关闭结算卡片
    wcCloseModal('wc-modal-shop-checkout-card');
    // 打开新的配送方式卡片
    wcOpenModal('wc-modal-delivery-card');
}


// --- 找到 wcProceedToPay 函数，替换为以下内容 ---
function wcProceedToPay(deliveryType) {
    // 关闭配送方式卡片
    wcCloseModal('wc-modal-delivery-card');
    if (!wcState.tempShopTransaction) return;

    if (deliveryType === 'now') {
        // 如果是立即配送，直接进入支付/发送流程
        wcPayAndSend(wcState.tempShopTransaction.method, '立即配送');
    } else if (deliveryType === 'reserve') {
        // 如果是预约，打开时间选择器
        wcOpenTimePickerModal();
    }
}


// --- 在脚本中任意位置（建议放在购物逻辑附近）新增以下三个函数 ---

/**
 * 新增：打开时间选择器弹窗
 */
function wcOpenTimePickerModal() {
    // 清空之前可能输入的值
    const customTimeInput = document.getElementById('custom-time-input');
    if (customTimeInput) {
        customTimeInput.value = '';
    }
    wcOpenModal('wc-modal-time-picker');
}

/**
 * 新增：处理时间选择并继续流程
 * @param {string} timeOption - 'now', 'tomorrow_am', 'tomorrow_pm', 或 'custom'
 */
function wcSetDeliveryTime(timeOption) {
    let deliveryTimeText = '';
    const now = new Date();

    switch (timeOption) {
        case 'now':
            deliveryTimeText = '立即配送';
            break;
        case 'tomorrow_am':
            now.setDate(now.getDate() + 1);
            now.setHours(10, 0, 0, 0);
            deliveryTimeText = `预约: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 10:00`;
            break;
        case 'tomorrow_pm':
            now.setDate(now.getDate() + 1);
            now.setHours(15, 0, 0, 0);
            deliveryTimeText = `预约: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 15:00`;
            break;
        case 'custom':
            const customTime = document.getElementById('custom-time-input').value;
            if (!customTime) {
                alert('请选择一个自定义时间！');
                return;
            }
            const selectedDate = new Date(customTime);
            if (selectedDate < new Date()) {
                alert('预约时间不能早于当前时间！');
                return;
            }
            deliveryTimeText = `预约: ${customTime.replace('T', ' ')}`;
            break;
    }

    // 关闭时间选择器
    wcCloseModal('wc-modal-time-picker');

    // 继续支付/发送流程
    if (wcState.tempShopTransaction) {
        wcPayAndSend(wcState.tempShopTransaction.method, deliveryTimeText);
    }
}

function wcPayAndSend(method, deliveryText) {
    const cart = wcState.shopData.cart || [];
    if (cart.length === 0) return;

    let total = 0;
    let itemNames = [];
    const receiptItems = [];
    
    cart.forEach(item => {
        total += parseFloat(item.price);
        itemNames.push(item.name);
        receiptItems.push({ name: item.name, price: parseFloat(item.price).toFixed(2) });
    });

    const itemsStr = itemNames.join('、');

    // 构造基础小票数据
    const receiptData = {
        logo: method === 'gift' ? "LUXURY ORDER" : "PAYMENT REQUEST",
        date: new Date().toLocaleString('zh-CN'),
        items: receiptItems,
        total: total.toFixed(2),
        msg: "" // 稍后由用户输入填充
    };

    if (method === 'gift') {
        // 👇 核心修复：调用通用输入框，并开启密码模式 (true)
        wcOpenGeneralInput(`支付 ¥${total.toFixed(2)} (输入支付密码)`, (pass) => {
            // 1. 校验密码
            if (pass !== wcState.wallet.password) {
                alert("密码错误！");
                return;
            }
            // 2. 校验余额
            if (wcState.wallet.balance < total) {
                alert("余额不足！请先前往「我-钱包」充值哦~");
                return;
            }
            
            // 3. 扣除余额并记录账单
            wcState.wallet.balance -= total;
            wcState.wallet.transactions.push({
                id: Date.now(), 
                type: 'payment', 
                amount: total,
                note: `商城购物赠送`, 
                time: Date.now()
            });
            
            // 4. 清空购物车并保存
            wcState.shopData.cart = [];
            wcSaveData();
            wcUpdateCartBadge();
            
            // 5. 关闭相关弹窗
            wcCloseModal('wc-modal-shop-cart');
            wcCloseShoppingPage();

            // 6. 支付成功后，弹出留言输入框
            setTimeout(() => {
                wcOpenGeneralInput("给 Ta 留个言吧 (选填)", (customMsg) => {
                    receiptData.msg = customMsg || "“给你买了一点小礼物，希望你喜欢。”";
                    
                    const aiSystemMessage = `[系统内部信息(仅AI可见): 用户刚刚为你购买了以下物品：${itemsStr}。配送方式：${deliveryText}。用户的留言是：“${receiptData.msg}”。请在回复中做出反应。]`;
                    
                    wcAddMessage(wcState.activeChatId, 'system', 'system', aiSystemMessage, { hidden: true });
                    setTimeout(() => {
                        wcAddMessage(wcState.activeChatId, 'me', 'order', '购物订单', {
                            orderType: 'gift',
                            deliveryText: deliveryText,
                            receiptData: receiptData
                        });
                    }, 300);
                });
            }, 300);
            
        }, true); // 👈 这里的 true 表示这是一个密码输入框

    } else if (method === 'daifu') {
        wcCloseModal('wc-modal-shop-cart');
        wcCloseShoppingPage();

        // 直接弹出留言输入框
        setTimeout(() => {
            wcOpenGeneralInput("输入代付留言 (选填)", (customMsg) => {
                receiptData.msg = customMsg || "“帮我付一下这个好不好~”";
                
                const aiSystemMessage = `[系统内部信息(仅AI可见): 用户刚刚向你发送了一个代付请求，希望你帮忙支付以下物品：${itemsStr}。总价：¥${total.toFixed(2)}。配送方式：${deliveryText}。用户的留言是：“${receiptData.msg}”。请在回复中做出回应（同意付款或拒绝付款等）。]`;

                wcState.shopData.cart = [];
                wcSaveData();
                wcUpdateCartBadge();
                
                wcAddMessage(wcState.activeChatId, 'system', 'system', aiSystemMessage, { hidden: true });
                setTimeout(() => {
                    wcAddMessage(wcState.activeChatId, 'me', 'order', '代付请求', {
                        orderType: 'daifu',
                        deliveryText: deliveryText,
                        receiptData: receiptData
                    });
                }, 300);
            });
        }, 300);
    }
}

// ==========================================================================
// 新增：手机模拟器 - 购物车 (Cart) 逻辑
// ==========================================================================

function wcSwitchPhoneCartTab(tab) {
    wcState.phoneCartTab = tab;
    document.getElementById('cap-tab-cart').classList.toggle('active', tab === 'cart');
    document.getElementById('cap-tab-history').classList.toggle('active', tab === 'history');
    wcRenderPhoneCartContent();
}

function wcRenderPhoneCartContent() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const content = document.getElementById('wc-phone-cart-content');
    if (!char) return;

    const cartData = (char.phoneData && char.phoneData.cartApp) ? char.phoneData.cartApp : null;

    if (!cartData) {
        content.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8E8E93; font-size: 14px; text-align: center; margin-top: 50%;">
                <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; stroke: #CCC; fill: none; stroke-width: 1; margin-bottom: 15px;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                点击左上角「偷看购物车」<br>生成 Ta 的私密购物数据...
            </div>`;
        return;
    }

    const currentList = wcState.phoneCartTab === 'cart' ? cartData.cart : cartData.history;
    const titleText = wcState.phoneCartTab === 'cart' ? 'Shopping Cart' : 'Purchase History';
    
    let html = `<div style="font-family: 'Georgia', serif; font-size: 22px; font-weight: bold; color: #111; margin: 10px 0 20px 0; letter-spacing: -0.5px;">${titleText}</div>`;

    if (currentList && currentList.length > 0) {
        currentList.forEach((item, index) => { // <--- 注意这里加了 index
            // 随机生成一个柔和的背景色作为占位图
            const hue = Math.floor(Math.random() * 360);
            const imgBg = `hsl(${hue}, 20%, 95%)`;
            const icon = wcState.phoneCartTab === 'cart' ? '🛒' : '📦';

            // 新增：如果是购物车页面，显示买单按钮
            let actionHtml = '';
            if (wcState.phoneCartTab === 'cart') {
                // 🔪 核心修改：加上 event.stopPropagation() 防止点击买单时触发卡片详情
                actionHtml = `<div style="background: #111; color: #fff; font-size: 12px; padding: 6px 12px; border-radius: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" onclick="event.stopPropagation(); wcBuyCharCartItem(${index})">帮Ta买单</div>`;
            }

            html += `
                <!-- 🔪 核心修改：给整个卡片加上 onclick 事件，打开详情弹窗 -->
                <div class="phone-cart-item-card" onclick="wcOpenCartItemDetail(${index}, '${wcState.phoneCartTab}')">
                    <div class="phone-cart-img-box" style="background: ${imgBg};">${icon}</div>
                    <div class="phone-cart-info">
                        <div class="phone-cart-title">${item.name}</div>
                        <div class="phone-cart-desc">${item.desc}</div>
                        <div class="phone-cart-bottom">
                            <div class="phone-cart-price">¥${item.price}</div>
                            ${item.date ? `<div class="phone-cart-date">${item.date}</div>` : actionHtml}
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html += `<div style="text-align: center; color: #999; padding: 40px 0; font-size: 13px;">空空如也</div>`;
    }

    content.innerHTML = html;
}

async function wcGeneratePhoneCart() {
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

    wcShowLoading("正在潜入 Ta 的购物车...");

    try {
        const realMsgs = wcState.chats[char.id] || [];
        const recentMsgs = realMsgs.slice(-30).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');
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

        const lifeStatusPrompt = getLifeStatusPrompt(char); // 新增

        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += `人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(${userName})设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; 
        if (chatConfig.bilingualEnabled) {
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：虽然聊天记录中包含外语，但你生成的手机内部所有数据（如商品名、内心OS等）必须全部使用 ${targetLang}！绝对不要使用双语格式！\n`;
        }
        prompt += `【核心场景设定】：我（${userName}）现在正在偷偷查看你（${char.name}）手机上的购物APP。\n`;
        prompt += `【最近我们的聊天记录（20-30条）】：\n${recentMsgs}\n\n`;
        
        prompt += `请基于你的人设、当前生活状态，以及我们**最近的聊天上下文**，生成你的私密购物数据。\n`;
        prompt += `【核心要求（极具活人感与强因果逻辑）】：\n`;
        prompt += `1. 【反模板化警告】：绝对禁止生成老套的“防小人”、“智商税”等固定模板商品！商品必须与今天发生的事强相关！\n`;
        prompt += `2. 购物车(cart) 5-10条：如果聊天里${userName}说冷，你可能会加购暖宝宝；如果今天行程里你去了健身房，可能会加购蛋白粉；如果你们吵架了，可能会加购道歉礼物。必须有明确的因果关系！\n`;
        prompt += `3. 购买记录(history) 5-10条：最近已经买下的东西。同样必须映射你们最近的聊天话题或你的生活状态。\n`;
        prompt += `4. 内心OS(desc)：商品描述必须是你添加购物车时的【真实内心OS】。要体现出你买这个东西的动机（是因为${userName}，还是因为今天遇到的某件事）。\n`;
        prompt += `【内在逻辑要求】：在生成 JSON 之前，请确保你的内部推演包含：\n`;
        prompt += `1. 仔细阅读【今日行程】和【聊天记录】，找出你目前最缺什么，或者最想给User买什么。\n`;
        prompt += `2. 构思具体的商品名称（带品牌或定语，显得真实）。\n`;
        prompt += `推演结束后，直接返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "cart": [
    {"name": "具体的商品名称", "desc": "你加购时的真实内心OS", "price": "129.00"}
  ],
  "history": [
    {"name": "具体的商品名称", "desc": "购买原因OS", "price": "45.00", "date": "10-24"}
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
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。");
        }

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let cartData;
        try {
            cartData = JSON.parse(content);
        } catch (parseErr) {
            throw new Error("AI 返回的 JSON 格式错误，请重试。返回内容：" + content.substring(0, 50) + "...");
        }

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.cartApp = cartData;
        wcSaveData();

        wcRenderPhoneCartContent();
        wcShowSuccess("偷看成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[购物车生成失败] ${e.message}`);
        } else {
            wcShowError("生成失败");
        }
    }
}
// ==========================================
// 新增：购物车商品详情弹窗逻辑
// ==========================================
window.wcOpenCartItemDetail = function(index, tab) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.cartApp) return;

    const list = tab === 'cart' ? char.phoneData.cartApp.cart : char.phoneData.cartApp.history;
    const item = list[index];
    if (!item) return;

    // 填充数据
    document.getElementById('cart-detail-tag').innerText = tab === 'cart' ? 'IN CART / 购物车' : 'PURCHASED / 已购买';
    document.getElementById('cart-detail-icon').innerText = tab === 'cart' ? '🛒' : '📦';
    
    // 随机生成一个柔和的背景色
    const hue = Math.floor(Math.random() * 360);
    document.getElementById('cart-detail-icon').style.background = `hsl(${hue}, 20%, 95%)`;

    document.getElementById('cart-detail-title').innerText = item.name;
    document.getElementById('cart-detail-os').innerText = item.desc;
    document.getElementById('cart-detail-price').innerText = `¥${item.price}`;

    // 底部操作区：购物车显示买单按钮，历史记录显示日期
    const actionContainer = document.getElementById('cart-detail-action');
    if (tab === 'cart') {
        actionContainer.innerHTML = `<button class="cart-detail-buy-btn" onclick="wcBuyCharCartItem(${index}); wcCloseCartItemDetail();">帮 Ta 买单</button>`;
    } else {
        actionContainer.innerHTML = `<span class="cart-detail-date">${item.date || '未知时间'}</span>`;
    }

    // 显示弹窗
    const modal = document.getElementById('wc-modal-cart-item-detail');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.wcCloseCartItemDetail = function() {
    const modal = document.getElementById('wc-modal-cart-item-detail');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }, 300);
};

// ==========================================================================
// 新增：帮 Char 清空购物车的支付逻辑
// ==========================================================================
function wcBuyCharCartItem(index) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.cartApp || !char.phoneData.cartApp.cart) return;

    const item = char.phoneData.cartApp.cart[index];
    if (!item) return;

    const price = parseFloat(item.price);
    if (isNaN(price)) return alert("商品价格异常，无法支付");

    // 弹出密码输入框
    wcOpenGeneralInput(`帮Ta买单 ¥${price.toFixed(2)} (输入支付密码)`, (pass) => {
        // 1. 校验密码和余额
        if (pass !== wcState.wallet.password) {
            alert("密码错误！");
            return;
        }
        if (wcState.wallet.balance < price) {
            alert("余额不足！请先在「我」-「钱包」中充值哦~");
            return;
        }

        // 2. 扣除用户钱包余额并记录账单
        wcState.wallet.balance -= price;
        wcState.wallet.transactions.push({
            id: Date.now(),
            type: 'payment',
            amount: price,
            note: `帮 ${char.name} 清空购物车: ${item.name}`,
            time: Date.now()
        });

        // 3. 将商品从 Ta 的购物车移出，放入 Ta 的购买记录中
        char.phoneData.cartApp.cart.splice(index, 1);
        if (!char.phoneData.cartApp.history) char.phoneData.cartApp.history = [];
        
        const now = new Date();
        const dateStr = `${now.getMonth() + 1}-${now.getDate()}`;
        
        char.phoneData.cartApp.history.unshift({
            name: item.name,
            desc: item.desc + " (User 偷偷买给我的🎁)",
            price: item.price,
            date: dateStr
        });

        wcSaveData();

        // 4. 刷新购物车页面 UI
        wcRenderPhoneCartContent();

        // 5. 弹出留言输入框，并发送结构化的高级卡片
        wcOpenGeneralInput("给 Ta 留个言吧 (选填)", (customMsg) => {
            const finalMsg = customMsg || "“偷偷看了你的购物车，就当是给你的小惊喜吧。”";
            
            const receiptData = {
                logo: "LUXURY ORDER",
                date: new Date().toLocaleString('zh-CN'),
                items: [{ name: item.name, price: price.toFixed(2) }],
                total: price.toFixed(2),
                msg: finalMsg
            };

            const aiSystemMessage = `[系统内部信息(仅AI可见): 用户偷偷查看了你的手机购物车，并花钱帮你买下了你一直想买的物品："${item.name}" (价格: ¥${price.toFixed(2)})。用户的留言是：“${finalMsg}”。请在回复中做出反应。]`;

            wcAddMessage(char.id, 'system', 'system', aiSystemMessage, { hidden: true });
            setTimeout(() => {
                wcAddMessage(char.id, 'me', 'order', '购物订单', {
                    orderType: 'gift',
                    deliveryText: '惊喜送达',
                    receiptData: receiptData
                });
            }, 300);

            alert(`支付成功！已帮 Ta 买下 ${item.name}，快去聊天界面看看 Ta 的反应吧！`);
        });
    }, true); // true 表示这是一个密码输入框
}


// ==========================================================================
// 全局补丁与覆盖 (Global Patches & Overrides)
// ==========================================================================
(function applyGlobalPatches() {
    const style = document.createElement('style');
    style.innerHTML = `
        .wc-wallet-header { padding-top: 60px !important; }
        #wc-modal-phone-settings { z-index: 20001 !important; }
        
        /* 【修复】：强制购物页面隐藏，防止破坏布局 */
        #wc-view-shopping {
            display: none !important;
        }
        #wc-view-shopping.active {
            display: flex !important;
        }
                /* 【修复】：防止朋友圈、聊天列表等被底部导航栏遮挡 */
        #wc-view-moments, #wc-view-chat, #wc-view-contacts, #wc-view-user {
            padding-bottom: 85px !important;
            box-sizing: border-box;
        }
        /* 确保长按菜单层级最高，防止被遮挡无法点击 */
        #wc-context-menu {
            z-index: 99999 !important;
        }

        body.edit-mode-active .app-item {
            animation: shake 0.3s infinite;
        }
        body.edit-mode-active .ls-widget-inner {
            animation: shake 0.3s infinite;
        }
        @keyframes shake {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(1deg); }
            50% { transform: rotate(0deg); }
            75% { transform: rotate(-1deg); }
            100% { transform: rotate(0deg); }
        }
        #home-edit-bar {
            position: fixed; 
            bottom: calc(env(safe-area-inset-bottom) + 15px); 
            top: auto;
            left: 50%; 
            transform: translateX(-50%);
            width: calc(100% - 30px); 
            max-width: 400px;
            height: 70px;
            background: rgba(255,255,255,0.85); 
            backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
            z-index: 9999; 
            display: none; 
            justify-content: space-between; 
            align-items: center;
            padding: 0 20px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            border-radius: 35px;
            border: 1px solid rgba(255,255,255,0.5);
        }
        .edit-btn {
            padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .edit-btn.cancel { background: #E5E5EA; color: #000; }
        .edit-btn.save { background: #007AFF; color: #fff; }
        
        /* 限制真实图片的最大尺寸 */
        .wc-bubble-img { 
            max-width: 160px !important; 
            max-height: 200px !important; 
            border-radius: 10px; 
            display: block; 
            object-fit: cover; 
            cursor: pointer;
        }

        /* 👇 新增：@ 列表与禁言样式 👇 */
        .wc-at-list {
            position: absolute;
            bottom: 100%;
            left: 0;
            width: 100%;
            max-height: 200px;
            background: rgba(249, 249, 249, 0.95);
            backdrop-filter: blur(10px);
            border-top: 1px solid #E5E5EA;
            overflow-y: auto;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            box-shadow: 0 -4px 15px rgba(0,0,0,0.05);
        }
        .wc-at-list.hidden { display: none !important; }
        .wc-at-item {
            display: flex;
            align-items: center;
            padding: 10px 15px;
            border-bottom: 1px solid #E5E5EA;
            cursor: pointer;
        }
        .wc-at-item:active { background: #E5E5EA; }
        .wc-at-item img { width: 30px; height: 30px; border-radius: 4px; margin-right: 10px; object-fit: cover; }
        .wc-at-item span { font-size: 15px; color: #111; font-weight: 500; }
        .muted-avatar { filter: grayscale(100%) opacity(0.6); }
        /* 👆 新增结束 👆 */
    `;
    document.head.appendChild(style);
    
    const editBar = document.createElement('div');
    editBar.id = 'home-edit-bar';
    editBar.innerHTML = `
        <div class="edit-btn cancel" onclick="cancelHomeEdit()">取消</div>
        <div class="edit-bar-center-btn" onclick="openWidgetDrawer()">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div class="edit-btn save" onclick="saveHomeEdit()">完成</div>
    `;
    document.body.appendChild(editBar);

})();
// --- 快捷进入手机的 iOS 风格通用弹窗 ---
window.wcPromptEnterPhone = function(charId, charName) {
    const char = wcState.characters.find(c => c.id === charId);
    if (char && char.isGroup) {
        alert("群聊无法查看手机哦~");
        return;
    }
    let modal = document.getElementById('wc-modal-ios-confirm');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-modal-ios-confirm';
        modal.className = 'ios-alert-overlay';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="ios-alert-box" style="width: 280px;">
            <div class="ios-alert-title">系统提示</div>
            <div class="ios-alert-message" style="padding-bottom: 15px;">是否要偷偷查看 ${charName} 的手机？</div>
            <div style="display: flex; border-top: 0.5px solid rgba(60, 60, 67, 0.29);">
                <button class="ios-alert-btn" style="flex: 1; border-right: 0.5px solid rgba(60, 60, 67, 0.29); color: #007AFF;" onclick="document.getElementById('wc-modal-ios-confirm').classList.remove('active')">取消</button>
                <button class="ios-alert-btn" style="flex: 1; font-weight: bold; color: #FF3B30;" onclick="wcConfirmEnterPhone(${charId})">确定</button>
            </div>
        </div>
    `;
    modal.classList.add('active');
};

window.wcConfirmEnterPhone = function(charId) {
    document.getElementById('wc-modal-ios-confirm').classList.remove('active');
    wcState.editingCharId = charId;
    wcOpenPhoneSim();
};

// ==========================================
// 真实浏览器后台通知与保活逻辑 (重构版)
// ==========================================

// 1. 页面交互逻辑
function openNotificationSettings() {
    updateNotifUI();
    document.getElementById('notificationSettingsModal').classList.add('open');
}

function closeNotificationSettings() {
    document.getElementById('notificationSettingsModal').classList.remove('open');
}

function updateNotifUI() {
    // 每次打开面板时，重新从本地存储读取最新状态，防止变量不同步
    isRealNotifEnabled = localStorage.getItem('ios_theme_real_notif_enabled') === 'true';
    isAlwaysRealNotifEnabled = localStorage.getItem('ios_theme_always_real_notif_enabled') === 'true';

    const notifToggle = document.getElementById('toggle-real-notif');
    const alwaysNotifToggle = document.getElementById('toggle-always-real-notif');
    const keepAliveToggle = document.getElementById('toggle-keep-alive');
    const autoKeepAliveToggle = document.getElementById('toggle-auto-keep-alive'); // 👈 新增
    const mainStatus = document.getElementById('main-notif-status');

    if (notifToggle) notifToggle.checked = isRealNotifEnabled;
    if (alwaysNotifToggle) alwaysNotifToggle.checked = isAlwaysRealNotifEnabled;
    if (keepAliveToggle) keepAliveToggle.checked = isKeepAliveEnabled;
    if (autoKeepAliveToggle) autoKeepAliveToggle.checked = isAutoKeepAliveEnabled; // 👈 新增

    if (mainStatus) {
        let statusText = '未开启';
        if (isAlwaysRealNotifEnabled) statusText = '全程开启';
        else if (isRealNotifEnabled) statusText = '后台开启';
        
        mainStatus.innerHTML = statusText + '<svg class="chevron-right" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
    }
}

// 2. 通知开关逻辑
function requestNotificationPermission(callback) {
    if (!("Notification" in window)) {
        alert("宝宝，你当前的浏览器不支持系统通知哦~");
        callback(false);
    } else if (Notification.permission === "granted") {
        callback(true);
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                alert("太棒啦！真实通知已开启！");
                callback(true);
            } else {
                alert("通知权限被拒绝了，请在浏览器设置中手动允许哦。");
                callback(false);
            }
        });
    } else {
        alert("通知权限已被系统拒绝，请在浏览器或系统设置中手动打开！");
        callback(false);
    }
}

function handleNotifToggle(checkbox) {
    if (checkbox.checked) {
        requestNotificationPermission((granted) => {
            isRealNotifEnabled = granted;
            checkbox.checked = granted;
            localStorage.setItem('ios_theme_real_notif_enabled', granted);
            
            // 互斥逻辑：开启仅后台时，关闭全程
            if (granted && isAlwaysRealNotifEnabled) {
                isAlwaysRealNotifEnabled = false;
                localStorage.setItem('ios_theme_always_real_notif_enabled', false);
            }
            updateNotifUI();
        });
    } else {
        isRealNotifEnabled = false;
        localStorage.setItem('ios_theme_real_notif_enabled', false);
        updateNotifUI();
    }
}

function handleAlwaysNotifToggle(checkbox) {
    if (checkbox.checked) {
        requestNotificationPermission((granted) => {
            isAlwaysRealNotifEnabled = granted;
            checkbox.checked = granted;
            localStorage.setItem('ios_theme_always_real_notif_enabled', granted);
            
            // 互斥逻辑：开启全程时，关闭仅后台
            if (granted && isRealNotifEnabled) {
                isRealNotifEnabled = false;
                localStorage.setItem('ios_theme_real_notif_enabled', false);
            }
            updateNotifUI();
        });
    } else {
        isAlwaysRealNotifEnabled = false;
        localStorage.setItem('ios_theme_always_real_notif_enabled', false);
        updateNotifUI();
    }
}
// 3. 发送真实通知的函数 (核心修复：解决保活状态下的后台判定与通知覆盖)
function sendRealSystemNotification(title, body, iconUrl) {
    // 如果两个都没开，直接返回
    if (!isRealNotifEnabled && !isAlwaysRealNotifEnabled) return;

    let shouldSend = false;

    // 1. 如果开启了“全程真实通知”，无视前后台状态，直接发送
    if (isAlwaysRealNotifEnabled) {
        shouldSend = true;
    } 
    // 2. 如果开启了“仅后台真实通知”，则判断当前页面是否不可见
    else if (isRealNotifEnabled) {
        if (document.hidden || document.visibilityState !== 'visible') {
            shouldSend = true;
        }
    }

    if (!shouldSend) return;

    if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(function(registration) {
            registration.showNotification(title, {
                body: body,
                icon: iconUrl || 'https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg',
                badge: 'https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg',
                vibrate: [200, 100, 200],
                // 核心修改：使用动态 tag，防止旧消息被新消息覆盖
                tag: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                renotify: true
            });
        });
    }
}

// 4. 后台通知测试逻辑
function testRealNotification() {
    if (!isRealNotifEnabled) {
        alert("宝宝，请先开启上方的【允许后台真实通知】开关哦~");
        return;
    }
    if (Notification.permission !== "granted") {
        alert("浏览器通知权限未授予，请检查系统设置！");
        return;
    }
    
    alert("测试已启动！\n请在 5 秒内将浏览器切换到后台，或者锁屏...");
    
    setTimeout(() => {
        if (Notification.permission === "granted") {
            navigator.serviceWorker.ready.then(function(registration) {
                registration.showNotification("后台通知测试", {
                    body: "成功啦！你能在后台收到这条消息，说明通知功能正常工作哦~",
                    icon: "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg",
                    badge: "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg",
                    vibrate: [200, 100, 200],
                    tag: 'honey-chat-test',
                    renotify: true
                });
            });
        }
    }, 5000);
}
// ==========================================
// 5. 网页后台保活 (防休眠) 逻辑 (强化兼容版)
// ==========================================
let isKeepAliveEnabled = false;
let keepAliveAudio = null;
let isAutoKeepAliveEnabled = localStorage.getItem('ios_theme_auto_keep_alive') === 'true';
let hasAttemptedAutoKeepAlive = false;

function handleAutoKeepAliveToggle(checkbox) {
    isAutoKeepAliveEnabled = checkbox.checked;
    localStorage.setItem('ios_theme_auto_keep_alive', isAutoKeepAliveEnabled);
}

function handleKeepAliveToggle() {
    const keepAliveToggle = document.getElementById('toggle-keep-alive');

    if (isKeepAliveEnabled) {
        // --- 当前是开启状态，现在需要关闭 ---
        isKeepAliveEnabled = false; 
        if (keepAliveAudio) {
            keepAliveAudio.pause();
        }
        console.log("后台保活已关闭。");
        updateNotifUI();
    } else {
        // --- 当前是关闭状态，现在需要开启 ---
        if (!keepAliveAudio) {
            keepAliveAudio = new Audio();
            keepAliveAudio.src = "https://img.heliar.top/file/1772516513350_30min-osbvow_2.mp4";
            keepAliveAudio.loop = true;
            keepAliveAudio.volume = 0.1; 
            
            // 【已修改】：删除了强制抢夺音频焦点的流氓逻辑
            // 这样打开抖音等其他媒体软件时，系统会自动暂停这里的保活音频，而不会互相打架暂停了。
        }

        keepAliveAudio.load();
        const playPromise = keepAliveAudio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                isKeepAliveEnabled = true;
                console.log("后台保活已成功开启。");
                
                // 【核心防杀补丁】：利用 MediaSession 欺骗系统这是一个音乐播放器，极大提升后台存活率
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: '小元机后台运行中',
                        artist: '保持连接',
                        album: 'Theme Studio',
                        artwork: [
                            { src: 'https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg', sizes: '512x512', type: 'image/jpeg' }
                        ]
                    });
                }
                
                if (keepAliveToggle) keepAliveToggle.checked = true;
                updateNotifUI();
            }).catch(error => {
                console.error("后台保活开启失败:", error);
                // 如果是用户手动点击失败才弹窗，自动触发失败不打扰用户
                if (hasAttemptedAutoKeepAlive && event && event.type === 'click' && event.target.id === 'toggle-keep-alive') {
                    alert("开启保活失败！音频正在缓冲或被浏览器拦截，请稍等两秒后再次点击开关。");
                }
                isKeepAliveEnabled = false;
                if (keepAliveToggle) keepAliveToggle.checked = false;
                updateNotifUI();
            });
        }
    }
}

// 【新增】：全局点击监听，用于自动开启保活（绕过浏览器自动播放限制）
document.body.addEventListener('click', () => {
    if (isAutoKeepAliveEnabled && !isKeepAliveEnabled && !hasAttemptedAutoKeepAlive) {
        hasAttemptedAutoKeepAlive = true; // 标记已尝试，避免每次点击都触发
        console.log("检测到用户交互，尝试自动开启后台保活...");
        handleKeepAliveToggle();
    }
}, { capture: true });

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isKeepAliveEnabled && keepAliveAudio) {
        keepAliveAudio.play().catch(e => console.log("切后台恢复播放失败", e));
    }
});

/* ==========================================================================
   APP 3: INS MUSIC PLAYER LOGIC (Advanced iOS Style)
   ========================================================================== */

const musicState = {
    profile: {
        name: 'Aesthetic User',
        avatar: 'https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg',
        bg: 'https://i.postimg.cc/kgD9CsbW/IMG-8012.jpg'
    },
    playlists: [],
    currentSong: null,
    isPlaying: false,
    playMode: 'loop', 
    currentPlaylist: [], 
    currentIndex: -1,
    lyrics: [],
    listenTogether: {
        active: false,
        charId: null,
        startTime: 0,
        timerInterval: null,
        totalListenSeconds: 0,
        sessionSongCount: 0
    },
    pendingAddSong: null
};
// 👇 就是在这里加上这一行！创造出播放器实体！
const audioPlayer = new Audio();
// --- 初始化与数据加载 ---
async function musicLoadData() {
    const data = await idb.get('ins_music_data');
    if (data) {
        if (data.profile) musicState.profile = data.profile;
        if (data.playlists) musicState.playlists = data.playlists;
        if (data.listenTogether) {
            musicState.listenTogether.active = data.listenTogether.active;
            musicState.listenTogether.charId = data.listenTogether.charId;
            musicState.listenTogether.startTime = data.listenTogether.startTime;
        }
    }
}

async function musicSaveData() {
    await idb.set('ins_music_data', {
        profile: musicState.profile,
        playlists: musicState.playlists,
        listenTogether: {
            active: musicState.listenTogether.active,
            charId: musicState.listenTogether.charId,
            startTime: musicState.listenTogether.startTime,
            totalListenSeconds: musicState.listenTogether.totalListenSeconds,
            sessionSongCount: musicState.listenTogether.sessionSongCount
        }
    });
}
// 新增：页面加载时恢复一起听歌状态

// --- 系统更新日志数据 ---
const systemUpdateLogs = [
   {
        version: "小元机 03.22",
        date: "2026.03.22",
        title: "欢迎来到小元机^这里是小元。",
        content: [
            "1.依旧爆改了几个UI页面",
            "2.增加了API额度查询和token计算，这个API额度查询有一些站子会出现查询不了显示充足的情况（显示充足就是没有查询到）",          
            "3.增加了主副API，可以选择一些板块使用副API，如果没有开启副API，默认使用主API，并且我修了一些小问题嗯嗯对",
            "不接受许愿和点菜，我也不在审核群和小红书群，有问题可以前往我的小红书@小元元元"
        ],
        notes: [
            "更新后若遇到界面显示异常，请尝试清除浏览器缓存。",
            "请妥善保管您的数据，建议定期在设置中进行备份。",
            "一机一码，禁止二传二贩"
        ]
    },
   {
        version: "小元机 03.20",
        date: "2026.03.20",
        title: "欢迎来到小元机^这里是小元。",
        content: [
            "1.APP4论坛功能更新，还在完善，感觉差不多了",
            "2.爆改了桌面和几个页面的UI嗯嗯对",            
            "3.增加了语音通话",
            "不想写更新日志，具体可以看我小红书@小元元元，可以去我评论区许愿，然后：我鸟都不鸟你"
        ],
        notes: [
            "更新后若遇到界面显示异常，请尝试清除浏览器缓存。",
            "请妥善保管您的数据，建议定期在设置中进行备份。",
            "一机一码，禁止二传二贩"
        ]
    },
    {
        version: "小元机 03.16",
        date: "2026.03.16",
        title: "欢迎来到小元机^这里是小元。",
        content: [
            "1.音乐无法搜索已修复orz",
            "2.APP4论坛还未完善，不用点击浪费额度！！我还在完善论坛！！",
            "最后非常感谢喜欢小元机的宝宝，我没有跑路！也不会跑路的！一直在更新TvT",
            "感谢支持，感谢喜欢，过几天打算爆改UI，，，"
        ],
        notes: [
            "更新后若遇到界面显示异常，请尝试清除浏览器缓存。",
            "请妥善保管您的数据，建议定期在设置中进行备份。",
            "一机一码，禁止二传二贩"
        ]
    },

    {
        version: "小元机 03.13",
        date: "2026.03.13",
        title: "欢迎来到小元机^这里是小元。",
        content: [
            "非常非常抱歉！orz滑跪，报错bug已修复",
            "1. 新增微信群聊功能。支持拉入多个角色一起聊天。（因为我没玩过群聊，一直是一个char，所以可能做的不太好）",
            "2. 情侣空间新增未来信件（时空信箱）功能。可以互相写信。嗯嗯对",
            "3. 有问题请多多反馈啦orz"
        ],
        notes: [
            "更新后若遇到界面显示异常，请尝试清除浏览器缓存。",
            "请妥善保管您的数据，建议定期在设置中进行备份。",
            "一机一码，禁止二传二贩"
        ]
    },

    {
        version: "小元机 03.12",
        date: "2026.03.12",
        title: "欢迎来到小元机^这里是小元。",
        content: [
            "1.增加了双语翻译模式（可以自定义翻译和被翻译的语言，你甚至可以把中文翻译成英文。英文翻译成日语。）",
            "2.情侣空间新增默契大挑战。",
            "3.强化了输出格式防止掉格式，以及修复了一点小问题。"
        ],
        notes: [
            "请妥善保管您的数据，建议定期在设置中进行备份。",
            "一机一码，禁止二传二贩"
        ]
    },
    {
        version: "小元机 03.10",
        date: "2026.03.10",
        title: "小元机更新",
        content: [
            "这里是小元，本次更新在设置中更新日志中放置了一个教程，不会的宝宝建议先去看看教程啦^^", 
            "1. 朋友圈ui爆改，增加了朋友圈日历系统（可以查看对应日期的朋友圈）点击头像查看全部朋友圈，默认查看今日朋友圈，增加了纪念日等等。",
            "2. 新增消息提示音，和全程真实系统通知和后台真实通知",
            "3. 修复导入歌单只能导入50首的问题。"        
        ],
        notes: [
            "请妥善保管您的数据，建议定期在设置中进行备份。",
            "一机一码，禁止二传二贩"
        ]
    },
];
const CURRENT_VERSION = systemUpdateLogs[0].version;

// --- 系统更新弹窗逻辑 ---
function checkSystemUpdate() {
    const lastVersion = localStorage.getItem('ios_theme_last_version');
    if (lastVersion !== CURRENT_VERSION) {
        showSystemUpdatePopup();
    }
}

function showSystemUpdatePopup() {
    const popup = document.getElementById('system-update-popup');
    if (!popup) return;
    const latestLog = systemUpdateLogs[0];
    
    document.getElementById('sys-update-version-text').innerText = `VERSION ${latestLog.version.replace('v', '')}`;
    document.getElementById('sys-update-title-text').innerText = latestLog.title;
    
    const contentList = document.getElementById('sys-update-content-list');
    contentList.innerHTML = latestLog.content.map(item => `<li>${item}</li>`).join('');
    
    const notesList = document.getElementById('sys-update-notes-list');
    notesList.innerHTML = latestLog.notes.map(item => `<li>${item}</li>`).join('');
    
    popup.classList.remove('hidden');
    requestAnimationFrame(() => {
        popup.classList.add('active');
    });
}

function closeSystemUpdatePopup() {
    const popup = document.getElementById('system-update-popup');
    popup.classList.remove('active');
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 300);
    localStorage.setItem('ios_theme_last_version', CURRENT_VERSION);
}

// --- 更新日志设置页逻辑 ---
function openUpdateLogSettings() {
    document.getElementById('updateLogSettingsModal').classList.add('open');
    renderUpdateLogs();
}

function closeUpdateLogSettings() {
    document.getElementById('updateLogSettingsModal').classList.remove('open');
}

function renderUpdateLogs() {
    const container = document.getElementById('updateLogContainer');
    container.innerHTML = '';
    
    // --- 新增：固定在最顶部的实用指南卡片 ---
    const tutorialCard = document.createElement('div');
    tutorialCard.style.cssText = 'background: #F2F2F7; border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #333; font-size: 14px; line-height: 1.6; text-align: left; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);';
    tutorialCard.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #000; border-bottom: 1px solid #E5E5EA; padding-bottom: 8px;">小元机食用指南：</h3>
        
        <div style="margin-bottom: 8px;"><strong>1. 底部Dock栏</strong>从左到右分别为桌面美化，设置，世界书</div>
        
        <div style="margin-bottom: 8px;"><strong>设置页面又分：</strong><br>
        ① AppleID：备份的地方（可以备份桌面美化和全局）<br>
        ② API设置，真实系统弹窗，系统提示音</div>
        
        <div style="margin-bottom: 8px;"><strong>桌面APP介绍：</strong></div>
        <ul style="padding-left: 20px; margin: 0 0 12px 0;">
            <li style="margin-bottom: 8px;"><strong>APP1为聊天：</strong>点击角色可以查手机，聊天页面点击对方头像可以快捷进入查手机。回车键为用户发送键，那个小飞机图标是char回复键，拉黑角色后点击是以弹窗形式出现角色消息，角色消息会储存在chat页面（就是会话列表页面）的小卡片头像里面，点击朋友圈头像显示全部朋友圈，点击单个日期可查看单日朋友圈</li>
            <li style="margin-bottom: 8px;"><strong>APP2为情侣空间：</strong><br>
            ① 可以选择开启桌面小组件（有便利贴和拍立得两种模式），选择发送概率，char就会在桌面发送消息或图片。<br>
            ② 关联账号：开启后，char会实时感知用户和其他人聊天，你可以选择NPC回复频率（注意：这个比较耗费额度），你也可以知道NPC给char发送消息，并且可以进入查手机，帮char回复。</li>
            <li style="margin-bottom: 8px;"><strong>APP3为音乐：</strong>主页面为邀请一起听歌，点击主页面的角色卡邀请对方听歌，个人页面的五角星符号为音乐胶囊，点击后桌面会有一个小胶囊（实则迷你音乐播放器）</li>
            <li style="margin-bottom: 8px;"><strong>APP4论坛，每个网页窗口为独立世界观互不干扰，网址栏的搜索键点击为热搜</strong></li>
        </ul>
        
        <div style="background: #E5E5EA; padding: 10px; border-radius: 8px;">
            <strong>线下在梦境里面</strong><br>       
        </div>
    `;
    container.appendChild(tutorialCard);

    // --- 原有的更新日志折叠栏渲染逻辑 ---
    systemUpdateLogs.forEach((log, index) => {
        const item = document.createElement('div');
        item.className = 'update-log-item';
        if (index === 0) item.classList.add('expanded'); // 默认展开最新版本
        
        let contentHtml = `<div class="update-log-section"><h4>更新内容</h4><ul class="update-log-list">${log.content.map(c => `<li>${c}</li>`).join('')}</ul></div>`;
        if (log.notes && log.notes.length > 0) {
            contentHtml += `<div class="update-log-section"><h4>注意事项</h4><ul class="update-log-list">${log.notes.map(n => `<li>${n}</li>`).join('')}</ul></div>`;
        }
        
        item.innerHTML = `
            <div class="update-log-header" onclick="toggleUpdateLog(this)">
                <div class="update-log-title-wrap">
                    <span class="update-log-version">${log.version}</span>
                    <span class="update-log-title-text">${log.title}</span>
                </div>
                <div class="update-log-right">
                    <span class="update-log-date">${log.date}</span>
                    <svg class="update-log-chevron" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                </div>
            </div>
            <div class="update-log-content">
                <div class="update-log-content-inner">
                    ${contentHtml}
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function toggleUpdateLog(headerEl) {
    const item = headerEl.parentElement;
    item.classList.toggle('expanded');
}
// ==========================================
// 新增：拉黑弹窗队列与全屏记录页控制逻辑
// ==========================================

let blockedAlertQueue = [];
let isBlockedAlertShowing = false;

// 处理弹窗队列
function processBlockedAlertQueue() {
    if (isBlockedAlertShowing || blockedAlertQueue.length === 0) return;
    
    isBlockedAlertShowing = true;
    const item = blockedAlertQueue.shift(); // 取出队列第一条
    showBlockedAlert(item.char, item.msg);
}

function showBlockedAlert(char, msgObj) {
    document.getElementById('blocked-alert-avatar').src = char.avatar;
    document.getElementById('blocked-alert-name').innerText = char.name;
    
    const contentContainer = document.getElementById('blocked-alert-content');
    
    // 支持渲染表情包和图片
    if (msgObj.type === 'sticker' || msgObj.type === 'image') {
        contentContainer.innerHTML = `<img src="${msgObj.content}" style="max-width: 120px; border-radius: 8px; display: block; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">`;
    } else {
        contentContainer.innerText = msgObj.content;
    }

    const modal = document.getElementById('wc-modal-blocked-alert');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeBlockedAlert() {
    const modal = document.getElementById('wc-modal-blocked-alert');
    modal.classList.add('hidden');
    
    setTimeout(() => {
        modal.style.display = 'none';
        isBlockedAlertShowing = false;
        // 延迟一点点时间，继续弹出下一条，制造“消息轰炸”的压迫感
        setTimeout(processBlockedAlertQueue, 200); 
    }, 300);
}

function wcOpenBlockedHistory(charId) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    // 动态绑定清空按钮事件
    const clearBtn = document.getElementById('blocked-history-clear-btn');
    if (clearBtn) {
        clearBtn.onclick = () => wcClearBlockedHistory(charId);
    }

    document.getElementById('blocked-history-avatar').src = char.avatar;
    document.getElementById('blocked-history-name').innerText = char.name;

    const list = document.getElementById('blocked-history-list');
    list.innerHTML = '';

    if (!char.blockedMessages || char.blockedMessages.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; margin-top:50px; font-size:14px; font-style:italic;">暂无拦截记录</div>';
    } else {
        char.blockedMessages.forEach((msg, index) => {
            const div = document.createElement('div');
            div.className = 'blocked-msg-card';
            
            let contentHtml = msg.content;
            if (msg.type === 'sticker' || msg.type === 'image') {
                contentHtml = `<img src="${msg.content}" style="max-width: 120px; border-radius: 8px; display: block; margin-top: 8px;">`;
            }
            
            // 👇 修改：加入了右上角的单条删除按钮 👇
            div.innerHTML = `
                <div class="blocked-msg-delete-btn" onclick="wcDeleteSingleBlockedMsg(${charId}, ${index})">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="blocked-msg-time">${new Date(msg.time).toLocaleString()}</div>
                <div class="blocked-msg-text">${contentHtml}</div>
            `;
            list.appendChild(div);
        });
    }

    document.getElementById('wc-view-blocked-history').classList.add('active');
}

// 👇 新增：单条删除拦截消息的函数 👇
function wcDeleteSingleBlockedMsg(charId, index) {
    if (confirm("确定要删除这条拦截记录吗？")) {
        const char = wcState.characters.find(c => c.id === charId);
        if (char && char.blockedMessages) {
            char.blockedMessages.splice(index, 1); // 删除指定索引的消息
            wcSaveData();
            wcOpenBlockedHistory(charId); // 重新渲染列表
        }
    }
    document.getElementById('wc-view-blocked-history').classList.add('active');
}

function wcCloseBlockedHistory() {
    document.getElementById('wc-view-blocked-history').classList.remove('active');
}

function wcClearBlockedHistory(charId) {
    if (confirm("确定要清空该角色的所有拦截记录吗？")) {
        const char = wcState.characters.find(c => c.id === charId);
        if (char) {
            char.blockedMessages = [];
            wcSaveData();
            wcOpenBlockedHistory(charId); // 重新渲染
        }
    }
}

// ==========================================
// 新增：拉黑确认弹窗逻辑
// ==========================================
let pendingBlockCharId = null;
let pendingBlockState = false;

function handleBlockBtnClick() {
    const charId = wcState.activeChatId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    pendingBlockCharId = charId;
    pendingBlockState = !char.isBlocked; // 目标状态：如果当前未拉黑，则目标是拉黑；反之亦然

    const titleEl = document.getElementById('block-confirm-title');
    const descEl = document.getElementById('block-confirm-desc');
    const btnEl = document.getElementById('block-confirm-btn');

    if (pendingBlockState) {
        titleEl.innerText = "确认拉黑？";
        descEl.innerText = `拉黑后，你将不再接收 ${char.name} 的消息，Ta 的消息会被拦截到小黑屋。`;
        btnEl.innerText = "确认拉黑";
        btnEl.style.background = "#FF3B30";
        btnEl.style.boxShadow = "0 4px 12px rgba(255, 59, 48, 0.2)";
    } else {
        titleEl.innerText = "取消拉黑？";
        descEl.innerText = `取消拉黑后，你将恢复接收 ${char.name} 的消息。`;
        btnEl.innerText = "取消拉黑";
        btnEl.style.background = "#111";
        btnEl.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
    }

    document.getElementById('wc-modal-block-confirm').classList.add('active');
}

function closeBlockConfirmModal() {
    document.getElementById('wc-modal-block-confirm').classList.remove('active');
    pendingBlockCharId = null;
}

function executeBlockToggle() {
    if (!pendingBlockCharId) return;
    const char = wcState.characters.find(c => c.id === pendingBlockCharId);
    
    if (char) {
        const wasBlocked = char.isBlocked; // 记录之前的状态
        char.isBlocked = pendingBlockState; // 更新为新状态
        char.blockedCount = 0; // 👈 新增：重置拉黑拦截计数器
        wcSaveData();
        
        // 更新按钮 UI
        const blockBtn = document.getElementById('wc-setting-block-btn');
        if (char.isBlocked) {
            blockBtn.innerText = "你已拉黑该角色";
            blockBtn.classList.add('blocked');
        } else {
            blockBtn.innerText = "拉黑该角色 (Block)";
            blockBtn.classList.remove('blocked');
        }

        // 👇 修改：解除拉黑时只注入记忆，不主动发消息 👇
        if (wasBlocked && !char.isBlocked) {
            // 只有从“已拉黑”变成“未拉黑”时才触发
            let blockedContext = "【系统强制提示：你刚刚被 User 解除拉黑了！你现在终于可以正常发送消息了。】\n";
            
            if (char.blockedMessages && char.blockedMessages.length > 0) {
                // 提取小黑屋里的消息（取最近的10条，并反转顺序让时间线顺畅）
                const recentBlocked = char.blockedMessages.slice(0, 10).reverse();
                blockedContext += "【以下是你被拉黑期间，疯狂发送但被系统拒收的消息记录（User 刚刚才看到这些记录）】：\n";
                
                recentBlocked.forEach(msg => {
                    let content = msg.content;
                    if (msg.type !== 'text') content = `[${msg.type}]`;
                    blockedContext += `你当时试图发送: ${content}\n`;
                });
                
                blockedContext += "请在下一次回复 User 时，结合以上你发过的无效消息，以及你现在终于被放出来的心情进行回应（可以抱怨、委屈、质问、或者假装无事发生，必须符合你的人设）。";
            } else {
                blockedContext += "你在被拉黑期间没有发送任何消息。请在下一次回复 User 时，自然地表达你重见天日的心情。";
            }

            // 将这段记忆作为一条“隐藏的系统消息”插入聊天记录，用户看不见，但 AI 下次读取上下文时能看到
            wcAddMessage(char.id, 'system', 'system', blockedContext, { hidden: true });    
        }
        // 👆 修改结束 👆
    }
    closeBlockConfirmModal();
}
// ==========================================
// 声音与触感逻辑 (修复版)
// ==========================================
let isSoundEnabled = localStorage.getItem('ios_theme_sound_enabled') !== 'false'; // 默认开启

function handleSoundToggle(checkbox) {
    isSoundEnabled = checkbox.checked;
    localStorage.setItem('ios_theme_sound_enabled', isSoundEnabled);
}

function openSoundSettings() {
    const toggle = document.getElementById('toggle-sound-enabled');
    if (toggle) toggle.checked = isSoundEnabled;
    document.getElementById('soundSettingsModal').classList.add('open');
}

function closeSoundSettings() {
    document.getElementById('soundSettingsModal').classList.remove('open');
}

async function saveSoundUrl() {
    const url = document.getElementById('soundUrlInput').value.trim();
    if (url && url !== '已选择本地音频') {
        customNotificationSound = url;
        await idb.set('ios_theme_sound', { url: customNotificationSound });
        alert("提示音 URL 已保存！");
    }
}

function handleAudioUpload(input) {
    const file = input.files[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            alert("音频文件过大，请选择 2MB 以内的文件！");
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async function(e) {
            customNotificationSound = e.target.result;
            document.getElementById('soundUrlInput').value = '已选择本地音频';
            await idb.set('ios_theme_sound', { url: customNotificationSound });
            alert("本地提示音已保存！");
        };
        reader.readAsDataURL(file);
    }
}

async function resetSound() {
    customNotificationSound = null;
    document.getElementById('soundUrlInput').value = '';
    await idb.set('ios_theme_sound', { url: null });
    alert("已恢复默认提示音！");
}

// 修复：测试声音无视开关，直接播放当前选中的音频
function playTestSound() {
    try {
        const audio = new Audio();
        audio.src = customNotificationSound || "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"; 
        audio.play().catch(e => alert("播放失败，请检查音频格式: " + e.message));
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) {
        console.error("测试提示音失败", e);
    }
}

// 核心播放函数 (受开关控制)
function playNotificationSound() {
    if (!isSoundEnabled) return; // 如果开关关闭，直接返回不播放
    try {
        const audio = new Audio();
        audio.src = customNotificationSound || "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"; 
        audio.play().catch(e => console.log("浏览器限制了自动播放:", e));
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) {
        console.error("播放提示音失败", e);
    }
}

// ==========================================
// 全新：全屏高级感日历 & 事件管理系统
// ==========================================
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

window.wcOpenCalendarModal = function() {
    let view = document.getElementById('wc-view-full-calendar');
    if (!view) {
        view = document.createElement('div');
        view.id = 'wc-view-full-calendar';
        view.className = 'ins-full-calendar-view';
        document.getElementById('wechat-root').appendChild(view);
    }
    
    currentCalYear = new Date().getFullYear();
    currentCalMonth = new Date().getMonth();
    
    view.innerHTML = `
        <div class="ins-cal-navbar">
            <div class="ins-cal-nav-btn" onclick="wcOpenAddEventModal()">
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div class="ins-cal-nav-title">CALENDAR</div>
            <div class="ins-cal-nav-btn" onclick="wcCloseCalendarModal()">
                <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </div>
        </div>
        
        <div class="ins-cal-header-area">
            <div class="ins-cal-month-selector">
                <button onclick="wcChangeCalMonth(-1)"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                <div class="ins-cal-title-large" id="ins-cal-title">2023<br><span>OCTOBER</span></div>
                <button onclick="wcChangeCalMonth(1)"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
            </div>
            <div class="ins-cal-weekdays">
                <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
            </div>
        </div>
        
        <div class="ins-cal-body-area">
            <div class="ins-cal-days-grid" id="ins-cal-days"></div>
            <!-- 事件列表区域 -->
            <div class="ins-cal-events-list" id="ins-cal-events-list" style="margin-top: 30px; padding-bottom: 30px;"></div>
        </div>
        
        <!-- 添加事件的底部弹窗 -->
        <div id="ins-cal-add-modal" class="ins-cal-add-overlay hidden">
            <div class="ins-cal-add-card">
                <div class="ins-cal-add-header">
                    <h3>添加记事</h3>
                    <button onclick="wcCloseAddEventModal()">&times;</button>
                </div>
                <div class="wc-form-group">
                    <label class="wc-form-label">日期</label>
                    <input type="date" id="cal-event-date" class="wc-form-input">
                </div>
                <div class="wc-form-group">
                    <label class="wc-form-label">类型</label>
                    <select id="cal-event-type" class="wc-form-input" onchange="wcToggleEventCharSelect()">
                        <option value="todo">待办事项</option>
                        <option value="period">生理期</option>
                        <option value="anniversary">纪念日</option>
                        <option value="birthday">生日</option>
                    </select>
                </div>
                <div class="wc-form-group" id="cal-event-title-group">
                    <label class="wc-form-label">标题/内容</label>
                    <input type="text" id="cal-event-title" class="wc-form-input" placeholder="例如：看电影 / 恋爱纪念日">
                </div>
                
                <!-- 双重关联设置 -->
                <div style="display: flex; gap: 10px; margin-bottom: 16px;">
                    <div style="flex: 1;">
                        <label class="wc-form-label">关联我方</label>
                        <select id="cal-event-user-target" class="wc-form-input" style="font-size: 14px; padding: 10px;">
                            <!-- JS 动态注入 -->
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label class="wc-form-label">关联对方</label>
                        <select id="cal-event-char-target" class="wc-form-input" style="font-size: 14px; padding: 10px;">
                            <!-- JS 动态注入 -->
                        </select>
                    </div>
                </div>

                <div class="wc-form-group" style="display: flex; align-items: center; gap: 10px; background: #F9F9F9; padding: 12px; border-radius: 10px; border: 1px solid #F0F0F0;">
                    <input type="checkbox" id="cal-event-inject" checked style="width: 20px; height: 20px; accent-color: #111;">
                    <label class="wc-form-label" style="margin: 0; font-size: 13px; color: #333;">注入角色记忆 (AI将感知此事件)</label>
                </div>
                <button class="wc-btn-primary" style="background:#111; border-radius: 16px; height: 50px;" onclick="wcSaveCalendarEvent()">保存</button>
            </div>
        </div>
    `;

    wcRenderCalendar();
    
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
}

window.wcCloseCalendarModal = function() {
    const view = document.getElementById('wc-view-full-calendar');
    if (view) {
        view.classList.remove('active');
        setTimeout(() => view.style.display = 'none', 300);
    }
}

window.wcChangeCalMonth = function(dir) {
    currentCalMonth += dir;
    if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; } 
    else if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; }
    wcRenderCalendar();
}

window.wcRenderCalendar = function() {
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    document.getElementById('ins-cal-title').innerHTML = `${currentCalYear}<br><span>${monthNames[currentCalMonth]}</span>`;
    
    const daysContainer = document.getElementById('ins-cal-days');
    daysContainer.innerHTML = '';

    const firstDay = new Date(currentCalYear, currentCalMonth, 1).getDay();
    const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
    
    // 1. 找出有朋友圈的日期
    const momentsDays = new Set();
    wcState.moments.forEach(m => {
        const d = new Date(m.time);
        if (d.getFullYear() === currentCalYear && d.getMonth() === currentCalMonth) {
            momentsDays.add(d.getDate());
        }
    });

    // 2. 找出有事件的日期
    const eventsMap = {};
    if (!wcState.calendarEvents) wcState.calendarEvents = [];
    wcState.calendarEvents.forEach(e => {
        const [y, m, d] = e.date.split('-');
        if (parseInt(y) === currentCalYear && parseInt(m) === currentCalMonth + 1) {
            const dayNum = parseInt(d);
            if (!eventsMap[dayNum]) eventsMap[dayNum] = [];
            eventsMap[dayNum].push(e);
        }
    });

    // 填充空白
    for (let i = 0; i < firstDay; i++) {
        daysContainer.innerHTML += `<div class="ins-cal-cell empty"></div>`;
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentCalYear && today.getMonth() === currentCalMonth;

    for (let i = 1; i <= daysInMonth; i++) {
        const hasMoment = momentsDays.has(i);
        const isToday = isCurrentMonth && today.getDate() === i;
        const dayEvents = eventsMap[i] || [];
        
        let classes = 'ins-cal-cell';
        if (isToday) classes += ' today';
        
        let indicatorsHtml = '';
        
        // 朋友圈提示点 (灰色)
        if (hasMoment) indicatorsHtml += `<div class="cal-dot moment-dot"></div>`;
        
        // 事件提示点 (不同颜色)
        dayEvents.forEach(e => {
            if (e.type === 'period') indicatorsHtml += `<div class="cal-dot period-dot"></div>`;
            else if (e.type === 'birthday') indicatorsHtml += `<div class="cal-dot bday-dot"></div>`;
            else if (e.type === 'anniversary') indicatorsHtml += `<div class="cal-dot anniv-dot"></div>`;
            else indicatorsHtml += `<div class="cal-dot todo-dot"></div>`;
        });

                // 节假日文字
                const holiday = getHoliday(currentCalMonth, i);
                const holidayHtml = holiday ? `<div class="cal-holiday-text">${holiday}</div>` : '';

                daysContainer.innerHTML += `
                    <div class="${classes}" onclick="wcSelectCalendarDate(${currentCalYear}, ${currentCalMonth}, ${i})">
                        <span class="cal-num">${i}</span>
                        ${holidayHtml}
                        <div class="cal-indicators">${indicatorsHtml}</div>
                    </div>
                `;
            }
            
            // 👇👇👇 就是在这里加上这一行 👇👇👇
            wcRenderCalendarEventsList();
        }

function getHoliday(month, day) {
    const holidays = {
        "01-01": "元旦", "02-14": "情人节", "03-08": "妇女节", "04-01": "愚人节", 
        "05-01": "劳动节", "05-20": "520", "06-01": "儿童节", "10-01": "国庆节", 
        "12-24": "平安夜", "12-25": "圣诞节", "12-31": "跨年"
    };
    const key = `${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return holidays[key] || "";
}


// ==========================================
// 下方是全新的事件列表渲染与添加逻辑
// ==========================================

// ==========================================
// 全新：高级感 INS 风事件列表与双重关联逻辑
// ==========================================

window.wcRenderCalendarEventsList = function() {
    const listContainer = document.getElementById('ins-cal-events-list');
    if (!listContainer) return;
    
    // 极简标题
    listContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; padding: 0 5px;">
            <div style="font-family: 'Georgia', serif; font-size: 18px; font-weight: bold; color: #111; letter-spacing: -0.5px;">Events</div>
            <div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">This Month</div>
        </div>
    `;
    
    if (!wcState.calendarEvents) wcState.calendarEvents = [];
    
    const monthEvents = wcState.calendarEvents.filter(e => {
        const [y, m, d] = e.date.split('-');
        return parseInt(y) === currentCalYear && parseInt(m) === currentCalMonth + 1;
    });
    
    monthEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (monthEvents.length === 0) {
        listContainer.innerHTML += `
            <div style="background: #FAFAFA; border-radius: 20px; padding: 30px; text-align: center; border: 1px dashed #E5E5EA;">
                <div style="font-size: 13px; color: #888; font-style: italic;">No events for this month.</div>
            </div>`;
        return;
    }
    
    monthEvents.forEach(e => {
        const typeMap = {
            'todo': { label: 'TODO', color: '#111', bg: '#F5F5F5' },
            'period': { label: 'PERIOD', color: '#FF3B30', bg: 'rgba(255,59,48,0.08)' },
            'anniversary': { label: 'ANNIV', color: '#AF52DE', bg: 'rgba(175,82,222,0.08)' },
            'birthday': { label: 'BDAY', color: '#FF9500', bg: 'rgba(255,149,0,0.08)' }
        };
        const tInfo = typeMap[e.type] || { label: 'EVENT', color: '#888', bg: '#F5F5F5' };
        
        // 解析双重关联文本
        let relationTextArr = [];
        if (e.userTarget) relationTextArr.push(e.userTarget.name);
        if (e.charTarget) relationTextArr.push(e.charTarget.name);
        
        // 兼容旧数据
        if (!e.userTarget && !e.charTarget) {
            if (e.targetName) relationTextArr.push(e.targetName);
            else if (e.isUser) relationTextArr.push('User');
            else if (e.charId) {
                const c = wcState.characters.find(ch => ch.id === e.charId);
                if (c) relationTextArr.push(c.name);
            }
        }
        
        let relationHtml = '';
        if (relationTextArr.length > 0) {
            relationHtml = `<div style="font-size: 11px; color: #888; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
                <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                ${relationTextArr.join(' & ')}
            </div>`;
        }

        const injectIcon = e.inject !== false 
            ? `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: #34C759; stroke-width: 2;" title="已注入AI记忆"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` 
            : `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: #CCC; stroke-width: 2;" title="未注入AI记忆"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;

        const dayNum = e.date.split('-')[2];

        // 高级感卡片 HTML
        const div = document.createElement('div');
        div.style.cssText = "background: #FFF; border-radius: 20px; padding: 16px; margin-bottom: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #F9F9F9; display: flex; align-items: center; gap: 15px; position: relative; overflow: hidden;";
        div.innerHTML = `
            <!-- 左侧日期块 -->
            <div style="width: 48px; height: 48px; border-radius: 14px; background: ${tInfo.bg}; color: ${tInfo.color}; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                <span style="font-size: 18px; font-weight: 800; font-family: 'Georgia', serif; line-height: 1;">${dayNum}</span>
            </div>
            
            <!-- 中间内容区 -->
            <div style="flex: 1; overflow: hidden;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 9px; font-weight: 800; letter-spacing: 1px; color: ${tInfo.color}; border: 1px solid ${tInfo.color}; padding: 2px 6px; border-radius: 6px;">${tInfo.label}</span>
                    ${injectIcon}
                </div>
                <div style="font-size: 15px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.title}</div>
                ${relationHtml}
            </div>
            
            <!-- 右侧极简删除按钮 -->
            <div onclick="wcDeleteCalendarEvent(${e.id})" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #CCC; cursor: pointer; transition: color 0.2s;">
                <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

window.wcDeleteCalendarEvent = function(id) {
    if (confirm("确定要删除这个事件吗？")) {
        wcState.calendarEvents = wcState.calendarEvents.filter(e => e.id !== id);
        wcSaveData();
        wcRenderCalendar();
    }
}

window.wcOpenAddEventModal = function() {
    const userSelect = document.getElementById('cal-event-user-target');
    const charSelect = document.getElementById('cal-event-char-target');
    
    // 填充我方下拉框
    userSelect.innerHTML = '<option value="none">无</option><option value="user_default">默认 User</option>';
    if (wcState.masks && wcState.masks.length > 0) {
        const maskGroup = document.createElement('optgroup');
        maskGroup.label = "我的面具";
        wcState.masks.forEach(m => {
            maskGroup.innerHTML += `<option value="mask_${m.id}">${m.name}</option>`;
        });
        userSelect.appendChild(maskGroup);
    }

    // 填充对方下拉框
    charSelect.innerHTML = '<option value="none">无</option>';
    if (wcState.characters && wcState.characters.length > 0) {
        const charGroup = document.createElement('optgroup');
        charGroup.label = "角色";
        wcState.characters.forEach(c => {
            charGroup.innerHTML += `<option value="char_${c.id}">${c.name}</option>`;
        });
        charSelect.appendChild(charGroup);
    }
    
    // 默认选中今天
    const today = new Date();
    document.getElementById('cal-event-date').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    
    document.getElementById('ins-cal-add-modal').classList.remove('hidden');
    wcToggleEventCharSelect();
}

window.wcCloseAddEventModal = function() {
    document.getElementById('ins-cal-add-modal').classList.add('hidden');
}

window.wcToggleEventCharSelect = function() {
    const type = document.getElementById('cal-event-type').value;
    const titleGroup = document.getElementById('cal-event-title-group');
    if (type === 'period') titleGroup.style.display = 'none';
    else titleGroup.style.display = 'block';
}

window.wcSaveCalendarEvent = function() {
    const date = document.getElementById('cal-event-date').value;
    const type = document.getElementById('cal-event-type').value;
    let title = document.getElementById('cal-event-title').value.trim();
    const userVal = document.getElementById('cal-event-user-target').value;
    const charVal = document.getElementById('cal-event-char-target').value;
    const inject = document.getElementById('cal-event-inject').checked;
    
    if (!date) return alert("请选择日期");
    if (type !== 'period' && !title) return alert("请输入标题");
    if (type === 'period') title = "生理期";

    // 解析我方关联
    let userTarget = null;
    if (userVal === 'user_default') {
        userTarget = { type: 'user', id: null, name: wcState.user.name };
    } else if (userVal.startsWith('mask_')) {
        const id = parseInt(userVal.replace('mask_', ''));
        const mask = wcState.masks.find(m => m.id === id);
        if (mask) userTarget = { type: 'mask', id: id, name: mask.name };
    }

    // 解析对方关联
    let charTarget = null;
    if (charVal.startsWith('char_')) {
        const id = parseInt(charVal.replace('char_', ''));
        const char = wcState.characters.find(c => c.id === id);
        if (char) charTarget = { type: 'char', id: id, name: char.name };
    }

    // ... 前面的代码保持不变 ...
    const newEvent = {
        id: Date.now(),
        date: date,
        type: type,
        title: title,
        userTarget: userTarget,
        charTarget: charTarget,
        inject: inject
    };

    if (!wcState.calendarEvents) wcState.calendarEvents = [];
    wcState.calendarEvents.push(newEvent);
    wcSaveData();
    
    wcRenderCalendar();
    wcCloseAddEventModal();
    alert("添加成功！"); // <--- 加上这一行提示
}

// --- 新增：点击日历具体日期过滤朋友圈 ---
window.wcSelectCalendarDate = function(year, month, day) {
    wcState.momentFilter = 'specificDate';
    wcState.momentFilterDate = { year, month, day };
    
    // 移除顶部导航栏的其他高亮
    document.querySelectorAll('.cal-item').forEach(el => el.classList.remove('active'));
    
    // 关闭日历弹窗
    wcCloseCalendarModal();
    
    // 重新渲染朋友圈
    wcRenderMoments();
}

// ==========================================
// 高级感长文本编辑弹窗逻辑 (全局挂载，防止找不到)
// ==========================================
window.currentTextEditCallback = null;

window.openIosTextEditModal = function(title, initialText, callback) {
    document.getElementById('ios-text-edit-title').innerText = title;
    document.getElementById('ios-text-edit-textarea').value = initialText;
    window.currentTextEditCallback = callback;
    document.getElementById('ios-text-edit-modal').classList.add('active');
};

window.closeIosTextEditModal = function() {
    document.getElementById('ios-text-edit-modal').classList.remove('active');
    window.currentTextEditCallback = null;
};

document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('ios-text-edit-confirm');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (window.currentTextEditCallback) {
                const newText = document.getElementById('ios-text-edit-textarea').value.trim();
                window.currentTextEditCallback(newText);
            }
            window.closeIosTextEditModal();
        });
    }
});
// ==========================================
// 恋人空间：默契大挑战 (Q&A) 逻辑 (支持存档与历史)
// ==========================================

function openLsQaView() {
    if (!lsState.boundCharId) {
        alert("请先在首页绑定一位恋人哦~");
        return;
    }
    document.getElementById('ls-view-main').classList.remove('active');
    document.getElementById('ls-view-qa').classList.add('active');
    document.getElementById('ls-qa-score-display').innerText = lsState.qaScore;
    
    // 检查是否有未完成的会话
    if (lsState.qaCurrentSession && lsState.qaCurrentSession.questions && lsState.qaCurrentSession.questions.length > 0) {
        renderQaList(lsState.qaCurrentSession.source);
    } else {
        document.getElementById('ls-qa-list').innerHTML = `
            <div class="ls-empty-state" style="margin-top: 50px;">
                <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:#CCC;fill:none;stroke-width:1;margin-bottom:10px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <p style="font-family: 'Georgia', serif; font-style: italic; color: #999;">点击上方按钮开始挑战</p>
            </div>
        `;
    }
}

function closeLsQaView() {
    document.getElementById('ls-view-qa').classList.remove('active');
    document.getElementById('ls-view-main').classList.add('active');
}

function updateQaScore(points) {
    lsState.qaScore += points;
    lsSaveData();
    document.getElementById('ls-qa-score-display').innerText = lsState.qaScore;
}

// --- AI 出题逻辑 ---
async function generateCharQa() {
    if (lsState.qaCurrentSession) {
        if (!confirm("当前还有未完成的挑战，重新出题将覆盖当前进度，确定吗？")) return;
    }

    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("Ta 正在认真思考题目...");

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-40).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        const topics = [
            "基于我们最近聊天的某个极其微小的细节（比如我随口提过的一句话、某个小动作）",
            "极端的假设性脑洞题（比如：如果我变成了一只猫/丧尸爆发，我第一件事会做什么？）",
            "关于我内心深处的情感、小怪癖或不为人知的秘密",
            "情境反应题（比如：如果我们在街上遇到前任/我突然生气了，我会怎么做？）",
            "送命题（故意挖坑给 User 跳，选项里充满陷阱）"
        ];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `现在你和User正在玩“情侣默契大挑战”。请根据你的人设、User的设定以及你们最近的聊天记录，出 5 道单选题来考验 User。\n`;
        
        prompt += `【核心出题要求（最高优先级）】：\n`;
        prompt += `1. 本次出题请侧重于这个方向：**${randomTopic}**。\n`;
        prompt += `2. 【绝对禁止】：严禁出老套、无聊、表面的题目（绝对不要问：我最喜欢的颜色、食物、季节、动物、想去哪里玩）。\n`;
        prompt += `3. 题目必须刁钻、有趣、有画面感，选项要具有迷惑性。\n`;
        prompt += `4. 语气要完全符合你的人设（可以调皮、傲娇、温柔、腹黑等），在 explanation (解析) 中要对 User 的回答进行吐槽或撒娇。\n`;
        // 👇👇👇 插入这一行，明确禁止 D 选项 👇👇👇
        prompt += `5. 【严格限制】：每道题必须且只能有 A、B、C 三个选项！绝对不能生成 D 选项！在解析(explanation)中也绝对不能提及 D 选项！\n`;
        // 👇👇👇 原来的第 5 点改为第 6 点 👇👇👇
        prompt += `6. 必须返回纯 JSON 数组，格式如下：\n`;
        prompt += `[
  {
    "q": "如果明天就是世界末日，你觉得我今晚会拉着你做什么？",
    "options": {"A": "疯狂囤积物资", "B": "躺在床上相拥等死", "C": "去抢劫超市"},
    "answer": "B",
    "explanation": "笨蛋，末日都要来了，我只想和你待在一起呀。"
  }
]\n`;

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
        
        // 👇 新增：严格的错误拦截，防止 undefined 报错
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        }
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("API 返回数据异常，请检查模型名称是否正确。详细报错：" + JSON.stringify(data));
        }
        // 👆 新增结束

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const questions = JSON.parse(content);
        
        // 初始化当前会话并保存
        lsState.qaCurrentSession = {
            id: Date.now(),
            source: 'char',
            scoreEarned: 0,
            questions: questions.map(q => ({ ...q, userChoice: null, isCorrect: null }))
        };
        lsSaveData();

        renderQaList('char');
        wcShowSuccess("出题完成！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[默契挑战出题失败] ${e.message}`);
        else wcShowError("出题失败，请重试");
    }
}

// --- 渲染题目列表 (支持恢复状态) ---
function renderQaList(source) {
    const container = document.getElementById('ls-qa-list');
    container.innerHTML = '';

    const session = lsState.qaCurrentSession;
    if (!session || !session.questions) return;

    let titleHtml = `<div style="font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #111;">${source === 'char' ? 'Ta 的考验' : 'Ta 的作答结果'}</div>`;
    container.innerHTML = titleHtml;

    session.questions.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'qa-item-card';
        div.id = `qa-card-${index}`;
        
        // 如果已经答过，标记状态
        if (item.userChoice) {
            div.dataset.answered = 'true';
        }
        
        let optionsHtml = '';
        ['A', 'B', 'C'].forEach(key => {
            if (item.options[key]) {
                let optClass = 'qa-option';
                // 恢复已答状态的样式
                if (item.userChoice) {
                    if (key === item.answer) optClass += ' correct';
                    else if (key === item.userChoice && !item.isCorrect) optClass += ' wrong';
                }

                optionsHtml += `
                    <div class="${optClass}" id="qa-opt-${index}-${key}" onclick="answerQa(${index}, '${key}', '${item.answer}', '${source}')">
                        <span class="qa-option-letter">${key}</span>
                        <span class="qa-option-text">${item.options[key]}</span>
                    </div>
                `;
            }
        });

        const expDisplay = item.userChoice ? 'block' : 'none';
        let expContent = `<strong>解析：</strong>${item.explanation || '无'}`;
        if (source === 'user') {
            expContent = `<strong>Ta 的内心OS：</strong>${item.os || '无'}<br><br><strong>正确答案：</strong>${item.answer}`;
        }

        div.innerHTML = `
            <div class="qa-question-text">${index + 1}. ${item.q}</div>
            <div class="qa-options-container">${optionsHtml}</div>
            <div class="qa-explanation" id="qa-exp-${index}" style="display: ${expDisplay};">
                ${expContent}
            </div>
        `;
        container.appendChild(div);
    });
}

// --- 答题逻辑 (带保存) ---
function answerQa(qIndex, selectedKey, correctKey, source) {
    if (source === 'user') return; // 用户出题模式下，是AI答题，用户不能点

    const session = lsState.qaCurrentSession;
    if (!session) return;

    const card = document.getElementById(`qa-card-${qIndex}`);
    if (card.dataset.answered === 'true') return; 
    card.dataset.answered = 'true';

    const isCorrect = (selectedKey === correctKey);
    
    // 记录状态
    session.questions[qIndex].userChoice = selectedKey;
    session.questions[qIndex].isCorrect = isCorrect;

    const selectedOpt = document.getElementById(`qa-opt-${qIndex}-${selectedKey}`);
    const correctOpt = document.getElementById(`qa-opt-${qIndex}-${correctKey}`);
    const expDiv = document.getElementById(`qa-exp-${qIndex}`);

    if (isCorrect) {
        selectedOpt.classList.add('correct');
        updateQaScore(20);
        session.scoreEarned += 20;
    } else {
        selectedOpt.classList.add('wrong');
        if (correctOpt) correctOpt.classList.add('correct');
        updateQaScore(-10);
        session.scoreEarned -= 10;
    }

    if (expDiv) expDiv.style.display = 'block';
    
    lsSaveData(); // 实时保存进度
    checkAllAnswered();
}

function checkAllAnswered() {
    const session = lsState.qaCurrentSession;
    if (!session) return;

    const allAnswered = session.questions.every(q => q.userChoice !== null);
    
    if (allAnswered) {
        const correctCount = session.questions.filter(q => q.isCorrect).length;
        
        setTimeout(() => {
            if (correctCount === 5) {
                alert("太棒了！5题全对，额外奖励 20 积分！");
                updateQaScore(20);
                session.scoreEarned += 20;
            } else {
                alert(`挑战结束！答对了 ${correctCount} 题。`);
            }
            
            // 归档到历史记录
            archiveCurrentSession();
        }, 500);
    }
}

// --- 修复：深拷贝归档，确保数据不丢失 ---
function archiveCurrentSession() {
    if (!lsState.qaCurrentSession) return;
    
    if (!lsState.qaHistory) lsState.qaHistory = [];
    
    // 【关键修复】：使用 JSON 深拷贝，防止当前会话清空时影响历史记录
    const sessionSnapshot = JSON.parse(JSON.stringify(lsState.qaCurrentSession));
    sessionSnapshot.date = Date.now();
    
    // 将当前会话推入历史最前面
    lsState.qaHistory.unshift(sessionSnapshot);
    
    // 清空当前会话
    lsState.qaCurrentSession = null;
    lsSaveData();
}

// --- 用户出题逻辑 ---
function openUserQaInput() {
    if (lsState.qaCurrentSession) {
        if (!confirm("当前还有未完成的挑战，重新出题将覆盖当前进度，确定吗？")) return;
    }

    const container = document.getElementById('ls-qa-input-container');
    container.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        container.innerHTML += `
            <div class="qa-input-block">
                <div class="qa-input-block-title">QUESTION ${i + 1}</div>
                <input type="text" class="qa-input-field" id="uqa-q-${i}" placeholder="输入问题...">
                <input type="text" class="qa-input-field" id="uqa-a-${i}" placeholder="选项 A">
                <input type="text" class="qa-input-field" id="uqa-b-${i}" placeholder="选项 B">
                <input type="text" class="qa-input-field" id="uqa-c-${i}" placeholder="选项 C">
                <select class="qa-select-field" id="uqa-ans-${i}" style="margin-top: 8px;">
                    <option value="A">正确答案：A</option>
                    <option value="B">正确答案：B</option>
                    <option value="C">正确答案：C</option>
                </select>
            </div>
        `;
    }
    wcOpenModal('ls-modal-qa-input');
}

async function submitUserQa() {
    const userQuestions = [];
    for (let i = 0; i < 5; i++) {
        const q = document.getElementById(`uqa-q-${i}`).value.trim();
        const a = document.getElementById(`uqa-a-${i}`).value.trim();
        const b = document.getElementById(`uqa-b-${i}`).value.trim();
        const c = document.getElementById(`uqa-c-${i}`).value.trim();
        const ans = document.getElementById(`uqa-ans-${i}`).value;

        if (!q || !a || !b || !c) {
            return alert(`请完整填写第 ${i + 1} 题的所有内容！`);
        }

        userQuestions.push({
            q: q,
            options: { "A": a, "B": b, "C": c },
            answer: ans
        });
    }

    wcCloseModal('ls-modal-qa-input');
    await aiAnswerUserQa(userQuestions);
}

async function aiAnswerUserQa(questions) {
    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("Ta 正在紧张作答中...");

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        
        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n\n`;
        prompt += `User 给你出了 5 道默契测试题，请你根据人设和对 User 的了解进行作答。\n`;
        prompt += `题目如下：\n${JSON.stringify(questions, null, 2)}\n\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 返回纯 JSON 数组，包含你选择的答案和你的内心OS。\n`;
        prompt += `2. 格式如下：\n`;
        prompt += `[
  {"choice": "A", "os": "这题太简单了，肯定是A！"},
  {"choice": "B", "os": "有点拿不准，猜个B吧。"}
]\n`;

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
        
        const aiAnswers = JSON.parse(content);
        
        // 构造完整的会话数据
        let scoreEarned = 0;
        const fullQuestions = questions.map((q, i) => {
            const aiAns = aiAnswers[i];
            const isCorrect = (aiAns.choice === q.answer);
            if (isCorrect) scoreEarned += 20;
            else scoreEarned -= 10;
            
            return {
                ...q,
                userChoice: aiAns.choice, // AI的选择存在 userChoice 里方便复用渲染逻辑
                isCorrect: isCorrect,
                os: aiAns.os
            };
        });

        if (fullQuestions.filter(q => q.isCorrect).length === 5) {
            scoreEarned += 20; // 全对额外奖励
        }

        // 存入当前会话并立即归档
        lsState.qaCurrentSession = {
            id: Date.now(),
            source: 'user',
            scoreEarned: scoreEarned,
            questions: fullQuestions
        };
        
        // 渲染界面播放动画
        renderQaList('user');
        wcShowSuccess("作答完毕！");
        
        // 模拟动画展示
        let correctCount = 0;
        for (let i = 0; i < 5; i++) {
            await wcDelay(800);
            const q = fullQuestions[i];
            const selectedOpt = document.getElementById(`qa-opt-${i}-${q.userChoice}`);
            const correctOpt = document.getElementById(`qa-opt-${i}-${q.answer}`);
            const expDiv = document.getElementById(`qa-exp-${i}`);
            
            if (q.isCorrect) {
                selectedOpt.classList.add('correct');
                correctCount++;
            } else {
                selectedOpt.classList.add('wrong');
                if (correctOpt) correctOpt.classList.add('correct');
            }
            expDiv.style.display = 'block';
        }

        setTimeout(() => {
            if (correctCount === 5) {
                alert(`Ta 竟然全答对了！看来你们真的很默契！\n为你增加 20 积分！`);
            } else {
                alert(`Ta 答对了 ${correctCount} 题。继续培养默契吧！`);
            }
            updateQaScore(scoreEarned);
            archiveCurrentSession(); // 动画播完后归档
        }, 1000);

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[默契挑战答题失败] ${e.message}`);
        else wcShowError("Ta 思考太久睡着了，请重试");
    }
}

// --- 历史仓库逻辑 ---
function openQaArchive() {
    document.getElementById('ls-view-qa').classList.remove('active');
    document.getElementById('ls-view-qa-archive').classList.add('active');
    renderQaArchive();
}

function closeQaArchive() {
    document.getElementById('ls-view-qa-archive').classList.remove('active');
    document.getElementById('ls-view-qa').classList.add('active');
}

// --- 新增：极致丝滑的动态高度折叠引擎 ---
window.toggleQaArchiveCard = function(headerEl) {
    const card = headerEl.parentElement;
    const body = card.querySelector('.qa-archive-body');
    const inner = card.querySelector('.qa-archive-content-inner');
    
    if (card.classList.contains('expanded')) {
        // 【收起动作】
        // 1. 先把高度固定为当前的真实高度
        body.style.height = body.scrollHeight + 'px';
        // 2. 强制浏览器重绘
        void body.offsetHeight; 
        // 3. 触发动画，高度变为 0
        body.style.height = '0px';
        card.classList.remove('expanded');
    } else {
        // 【展开动作】
        card.classList.add('expanded');
        // 1. 精准获取内部内容的真实高度，并赋值给外层
        body.style.height = inner.scrollHeight + 'px';
        
        // 2. 动画结束后，把高度设为 auto，防止后续内容变化被截断
        body.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'height' && card.classList.contains('expanded')) {
                body.style.height = 'auto';
            }
            body.removeEventListener('transitionend', handler);
        });
    }
};

// --- 修复：适配 JS 动画引擎的渲染逻辑 ---
function renderQaArchive() {
    const container = document.getElementById('ls-qa-archive-list');
    container.innerHTML = '';

    if (!lsState.qaHistory || lsState.qaHistory.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; margin-top:50px; font-style:italic;">仓库空空如也，快去挑战吧~</div>';
        return;
    }

    lsState.qaHistory.forEach((session, index) => {
        const dateStr = new Date(session.date).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const title = session.source === 'char' ? 'Ta 的考验' : '我的出题';
        const scoreClass = session.scoreEarned >= 0 ? '' : 'negative';
        const scoreSign = session.scoreEarned >= 0 ? '+' : '';

        let questionsHtml = '';
        session.questions.forEach((q, qIdx) => {
            const isCorrect = q.isCorrect;
            const statusIcon = isCorrect 
                ? '<span style="color:#34C759; font-weight:bold;">✅ 答对了</span>' 
                : '<span style="color:#FF3B30; font-weight:bold;">❌ 答错了</span>';
            
            let expHtml = '';
            if (session.source === 'char') {
                expHtml = `<div class="qa-archive-exp"><strong>解析:</strong> ${q.explanation || '无'}</div>`;
            } else {
                expHtml = `<div class="qa-archive-exp"><strong>Ta的OS:</strong> ${q.os || '无'}</div>`;
            }

            questionsHtml += `
                <div class="qa-archive-q-block">
                    <div class="qa-archive-q-text">${qIdx + 1}. ${q.q}</div>
                    <div class="qa-archive-ans-row">正确答案: <strong style="color:#111;">${q.answer}</strong></div>
                    <div class="qa-archive-ans-row">作答选择: <strong>${q.userChoice || '未作答'}</strong> ${statusIcon}</div>
                    ${expHtml}
                </div>
            `;
        });

        const card = document.createElement('div');
        card.className = 'qa-archive-card';
        card.innerHTML = `
            <!-- 👇 注意这里：onclick 改成了调用我们新写的 JS 引擎 👇 -->
            <div class="qa-archive-header" onclick="toggleQaArchiveCard(this)">
                <div class="qa-archive-info">
                    <div class="qa-archive-title">${title}</div>
                    <div class="qa-archive-meta">${dateStr}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="qa-archive-score ${scoreClass}">${scoreSign}${session.scoreEarned}</div>
                    <svg class="qa-archive-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </div>
            <div class="qa-archive-body">
                <div class="qa-archive-content-inner">
                    ${questionsHtml}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}
// ==========================================
// 恋人空间：时空信箱 (Shrine & Stars) 核心逻辑
// ==========================================
// 1. 打开时空信箱全屏主页
function lsOpenLettersView() {
    if (!lsState.boundCharId) return alert("请先在首页绑定一位恋人哦~");
    
    let view = document.getElementById('ls-view-letters');
    if (!view) {
        view = document.createElement('div');
        view.id = 'ls-view-letters';
        view.className = 'ins-shrine-view';
        document.getElementById('loversSpaceModal').appendChild(view);
    }
    
    const char = wcState.characters.find(c => c.id === lsState.boundCharId);
    const charName = char ? char.name : "You";

    // 动态生成信件列表 HTML
    let lettersHtml = '';
    if (lsState.letters && lsState.letters.length > 0) {
        const sortedLetters = [...lsState.letters].sort((a, b) => b.time - a.time);
        sortedLetters.forEach(l => {
            const dateStr = new Date(l.time).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
            lettersHtml += `<li onclick="lsOpenLetterDetail(${l.id})"><span>${l.title}</span><span>${dateStr}</span></li>`;
        });
    } else {
        lettersHtml = '<li style="justify-content:center; color:#999;">暂无信件记录</li>';
    }

    view.innerHTML = `
        <div class="shrine-nav">
            <div class="shrine-nav-btn" onclick="lsCloseLettersView()">
                <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </div>
            <div class="shrine-nav-title">TIME MAILBOX</div>
            <div style="width: 40px;"></div>
        </div>

        <div class="shrine-space">
            <!-- 主纸片 (未来信件) -->
            <div class="paper-main">
                <div class="tape tape-1"></div>
                <h2>TIME MAILBOX</h2>
                <div class="greeting">To My Beloved：</div>
                <div class="paragraph">
                    你好。<br>
                    这是一封来自未来的信件。时间在这里失去了意义，只有思念被折叠成文字，投递进无垠的星海。请查收属于我们的记忆碎片。
                </div>

                <div class="bill-title">未来信件</div>
                <div class="bill-subtitle">ARCHIVES OF TIME</div>
                
                <!-- 可滑动的信件列表 -->
                <div class="bill-list-container">
                    <ul class="bill-list">
                        ${lettersHtml}
                    </ul>
                </div>

                <div class="signature-box">
                    <span class="signature-label">Recipient</span>
                    <span class="signature-name">${charName}</span>
                </div>
            </div>

            <!-- 副纸片 (祈愿卡 - 绑定点击事件，内含下雨特效) -->
            <div class="paper-sub" onclick="lsOpenShrineModal()">
                <div class="rain-container">
                    <div class="drop"></div><div class="drop"></div><div class="drop"></div><div class="drop"></div><div class="drop"></div>
                </div>
                <div class="paper-sub-content">
                    <p>PRAYER</p>
                    <h3>聆听星空的回音</h3>
                    <div class="tags">点击开启祈愿<br>抽取命运的羁绊</div>
                </div>
                <div class="tape tape-2"></div>
            </div>
        </div>

        <div class="shrine-footer">
            <button class="shrine-write-btn" onclick="lsOpenUserLetterInput()">
                <svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                <span>提笔写信</span>
            </button>
        </div>

        <!-- 祈愿弹窗 -->
        <div id="ls-shrine-modal" class="shrine-modal-overlay" onclick="lsCloseShrineModal()">
            <div class="shrine-modal-box" onclick="event.stopPropagation()">
                <div class="shrine-modal-title">星空の指引</div>
                <button class="shrine-modal-btn primary" onclick="lsGenerateAILetter()" id="btn-ai-pray">生成未来信件</button>
                <button class="shrine-modal-btn secondary" onclick="lsOpenLetterList()">查看过去信件</button>
            </div>
        </div>

        <!-- 祈愿生成动画覆盖层 (心电图 + 塔罗牌) -->
        <div id="ls-pray-animation-overlay" class="pray-anim-overlay">
            <!-- 方案三：命运交叉线 SVG -->
            <div class="ecg-container" id="ecg-anim">
                <svg viewBox="0 0 200 120" width="100%" height="100%">
                    <path class="ecg-path" d="M 0 96 L 50 96 L 55 66 L 62.5 120 L 70 84 L 75 96 L 100 96 C 125 96, 155 66, 155 36 C 155 6, 100 6, 100 36" />
                    <path class="ecg-path" d="M 200 96 L 150 96 L 145 66 L 137.5 120 L 130 84 L 125 96 L 100 96 C 75 96, 45 66, 45 36 C 45 6, 100 6, 100 36" />
                </svg>
            </div>

            <!-- 塔罗牌 3D 容器 -->
            <div class="tarot-glow"></div>
            <div class="tarot-container" id="tarot-anim" onclick="lsFlipTarot()">
                <div class="tarot-card" id="tarot-card">
                    <div class="tarot-face tarot-back"></div>
                    <div class="tarot-face tarot-front">
                        <img id="tarot-front-img" src="" alt="命运的指引">
                    </div>
                </div>
                <div class="tarot-hint">点击翻开命运的指引</div>
                <div class="tarot-desc-box">
                    <div class="tarot-name" id="tarot-name-display"></div>
                    <div class="tarot-meaning" id="tarot-meaning-display"></div>
                </div>
            </div>
        </div>

        <!-- 信件列表全屏页 -->
        <div id="ls-letter-list-view" class="shrine-list-view">
            <div class="shrine-nav" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div class="shrine-nav-btn" onclick="lsCloseLetterList()">
                    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </div>
                <div class="shrine-nav-title">STAR ARCHIVES</div>
                <div style="width: 40px;"></div>
            </div>
            <div class="shrine-list-content" id="ls-shrine-list-content"></div>
        </div>
        
        <!-- 用户写信全屏页面 -->
        <div id="ls-user-write-view" class="ins-paper-view">
            <div class="ins-paper-nav">
                <div onclick="lsCloseUserLetterInput()" style="cursor:pointer; color:#888;">CANCEL</div>
                <div onclick="lsSubmitUserLetter()" style="cursor:pointer; color:#111; font-weight:bold;">SEND</div>
            </div>
            <div class="ins-paper-content">
                <input type="text" id="ls-write-title" class="ins-paper-title-input" placeholder="信件标题 (如：写在失眠的夜)">
                <textarea id="ls-write-body" class="ins-paper-textarea" placeholder="提笔写下你想对 Ta 说的话..."></textarea>
            </div>
        </div>

        <!-- 阅读信件全屏页面 -->
        <div id="ls-letter-detail-modal" class="ins-paper-view">
            <div class="ins-paper-nav">
                <div onclick="lsCloseLetterDetail()" style="cursor:pointer; color:#888;">CLOSE</div>
                <div id="ls-letter-detail-date" style="font-family: monospace; color:#CCC;"></div>
            </div>
            <div class="ins-paper-content">
                <h3 id="ls-letter-detail-title" class="ins-paper-read-title"></h3>
                <div id="ls-letter-detail-content" class="ins-paper-read-text"></div>
                <div class="ins-paper-read-author" id="ls-letter-detail-author"></div>
            </div>
            <div class="ins-paper-actions">
                <div class="ins-paper-action-btn delete" onclick="lsDeleteCurrentLetter()">销毁此信</div>
                <div class="ins-paper-action-btn reply" id="ls-btn-request-reply" onclick="lsRequestReply()">祈求 Ta 的回信</div>
            </div>
        </div>
    `;
    
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
}

function lsCloseLettersView() {
    const view = document.getElementById('ls-view-letters');
    if (view) {
        view.classList.remove('active');
        setTimeout(() => view.style.display = 'none', 400);
    }
    const audio = document.getElementById('ls-letters-audio');
    if (audio) audio.pause();
}

// 音乐播放控制
function lsToggleLettersMusic() {
    const audio = document.getElementById('ls-letters-audio');
    const icon = document.getElementById('ls-letters-play-icon');
    if (!audio || !icon) return;

    if (audio.paused) {
        audio.play();
        icon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>';
    } else {
        audio.pause();
        icon.innerHTML = '<path d="M8 5v14l11-7z" fill="currentColor"/>';
    }
}

// 图片上传、文案编辑
function lsHandleLettersUpload(input, type) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (!lsState.lettersConfig) lsState.lettersConfig = {};
            lsState.lettersConfig[type] = e.target.result;
            lsSaveData();
            
            if (type === 'bg') {
                document.getElementById('ls-letters-bg').style.backgroundImage = `url('${e.target.result}')`;
                document.getElementById('ls-letters-bg').style.backgroundSize = 'cover';
                document.getElementById('ls-letters-bg').style.backgroundPosition = 'center';
            } else if (type === 'img1') {
                const el = document.getElementById('ls-letters-img1');
                el.style.backgroundImage = `url('${e.target.result}')`;
                const placeholder = document.getElementById('ls-img1-placeholder');
                if (placeholder) placeholder.style.display = 'none';
            } else if (type === 'img2') {
                const el = document.getElementById('ls-letters-img2');
                el.style.backgroundImage = `url('${e.target.result}')`;
                const placeholder = document.getElementById('ls-img2-placeholder');
                if (placeholder) placeholder.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }
}

function lsEditLettersText() {
    const currentText = lsState.lettersConfig?.text || '在这个宇宙，我们终会相遇';
    openTextEditModal("编辑文案", "请输入图片下方的文案", currentText, (val) => {
        if (val) {
            if (!lsState.lettersConfig) lsState.lettersConfig = {};
            lsState.lettersConfig.text = val;
            lsSaveData();
            const textEl = document.getElementById('ls-letters-text');
            if (textEl) textEl.innerText = val;
        }
    });
}

function lsEditLettersPoem() {
    const currentPoem = lsState.lettersConfig?.poem || 'In the universe of time,<br>we will eventually meet.';
    // 将 <br> 转换回换行符方便编辑
    const plainText = currentPoem.replace(/<br>/g, '\n');
    
    openIosTextEditModal("编辑诗句", plainText, (val) => {
        if (val) {
            // 将换行符转换为 <br>
            const htmlText = val.replace(/\n/g, '<br>');
            if (!lsState.lettersConfig) lsState.lettersConfig = {};
            lsState.lettersConfig.poem = htmlText;
            lsSaveData();
            const poemEl = document.getElementById('ls-letters-poem');
            if (poemEl) poemEl.innerHTML = htmlText;
        }
    });
}

window.lsGlobalRipple = function(e) {
    const target = document.getElementById('ls-view-letters');
    if (!target) return;

    const ripple = document.createElement('div');
    ripple.className = 'water-ripple';
    
    const size = 150; 
    ripple.style.width = ripple.style.height = `${size}px`;
    
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.zIndex = '9999'; // 确保涟漪在最上层显示
    
    target.appendChild(ripple);
    
    setTimeout(() => { ripple.remove(); }, 600);
};

function lsTriggerRippleAndModal(e) {
    e.stopPropagation(); // 阻止冒泡，防止触发两次涟漪
    lsGlobalRipple(e);   // 触发涟漪
    lsOpenShrineModal(); // 打开祈愿弹窗
}

function lsOpenUploadMenu() {
    const modal = document.getElementById('ls-upload-menu-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function lsCloseUploadMenu() {
    const modal = document.getElementById('ls-upload-menu-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}
// 2. 渲染闪烁且瞬移的星光
function lsRenderStarlights() {
    const space = document.getElementById('ls-shrine-space');
    if (!space) return;

    const oldStars = space.querySelectorAll('.shrine-starlight');
    oldStars.forEach(star => star.remove());

    if (!lsState.letters) lsState.letters = [];

    lsState.letters.forEach((letter) => {
        const isFromChar = letter.from === 'char';
        const star = document.createElement('div');
        
        // 改为小圆点类名
        star.className = `shrine-starlight dot-star ${isFromChar ? 'star-gold' : 'star-blue'}`;
        
        star.style.left = Math.random() * 90 + 5 + '%';
        star.style.top = Math.random() * 90 + 5 + '%';
        
        const duration = 1.5 + Math.random() * 2; 
        const delay = Math.random() * 2;
        star.style.animationDuration = `${duration}s`;
        star.style.animationDelay = `${delay}s`;

        star.onclick = () => lsOpenLetterDetail(letter.id);
        space.appendChild(star);
    });
}

// 3. 弹窗与列表控制
function lsOpenShrineModal() {
    const modal = document.getElementById('ls-shrine-modal');
    modal.style.display = 'flex'; // 👈 先显示出来
    setTimeout(() => modal.classList.add('active'), 10); // 👈 再触发透明度动画
}
function lsCloseShrineModal() {
    const modal = document.getElementById('ls-shrine-modal');
    modal.classList.remove('active'); // 👈 先触发透明度消失动画
    setTimeout(() => modal.style.display = 'none', 300); // 👈 动画结束后彻底隐藏
}

function lsOpenLetterList() {
    lsCloseShrineModal();
    const container = document.getElementById('ls-shrine-list-content');
    container.innerHTML = '';

    if (!lsState.letters || lsState.letters.length === 0) {
        container.innerHTML = '<div class="shrine-list-empty">星空档案室空空如也</div>';
    } else {
        const sortedLetters = [...lsState.letters].sort((a, b) => b.time - a.time);
        sortedLetters.forEach(letter => {
            const dateStr = new Date(letter.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isFromChar = letter.from === 'char';
            const tagText = isFromChar ? 'FROM TA' : 'FROM ME';
            const tagClass = isFromChar ? 'tag-gold' : 'tag-blue';

            const div = document.createElement('div');
            div.className = 'shrine-list-card';
            div.innerHTML = `
                <div class="shrine-list-card-top">
                    <span class="shrine-list-tag ${tagClass}">${tagText}</span>
                    <span class="shrine-list-date">${dateStr}</span>
                </div>
                <div class="shrine-list-card-title">${letter.title}</div>
                <div class="shrine-list-card-preview">${letter.content.substring(0, 30)}...</div>
            `;
            div.onclick = () => lsOpenLetterDetail(letter.id);
            container.appendChild(div);
        });
    }

    // 👇 修改这里：先设置为 flex 显示，再延迟触发滑入动画
    const view = document.getElementById('ls-letter-list-view');
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
}

function lsCloseLetterList() {
    // 👇 修改这里：先触发滑出动画，等动画结束（400ms）后再彻底隐藏
    const view = document.getElementById('ls-letter-list-view');
    view.classList.remove('active');
    setTimeout(() => view.style.display = 'none', 400);
}

// ==========================================
// 塔罗牌数据库 (多节点自动切换，确保 100% 加载成功)
// ==========================================
const globalTarotDeck = [
    { id: "06", name: "恋人 (The Lovers)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/d/db/Rider-Waite_Tarot_06_Lovers.jpg", "https://www.trustedtarot.com/img/cards/the-lovers.png", "https://sacred-texts.com/tarot/pkt/img/ar06.jpg"] },
    { id: "17", name: "星星 (The Star)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/c/cd/RWS_Tarot_17_Star.jpg", "https://www.trustedtarot.com/img/cards/the-star.png", "https://sacred-texts.com/tarot/pkt/img/ar17.jpg"] },
    { id: "19", name: "太阳 (The Sun)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/1/17/RWS_Tarot_19_Sun.jpg", "https://www.trustedtarot.com/img/cards/the-sun.png", "https://sacred-texts.com/tarot/pkt/img/ar19.jpg"] },
    { id: "10", name: "命运之轮 (Wheel of Fortune)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/3/3c/RWS_Tarot_10_Wheel_of_Fortune.jpg", "https://www.trustedtarot.com/img/cards/wheel-of-fortune.png", "https://sacred-texts.com/tarot/pkt/img/ar10.jpg"] },
    { id: "00", name: "愚者 (The Fool)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/9/90/RWS_Tarot_00_Fool.jpg", "https://www.trustedtarot.com/img/cards/the-fool.png", "https://sacred-texts.com/tarot/pkt/img/ar00.jpg"] },
    { id: "02", name: "女祭司 (The High Priestess)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/8/88/RWS_Tarot_02_High_Priestess.jpg", "https://www.trustedtarot.com/img/cards/the-high-priestess.png", "https://sacred-texts.com/tarot/pkt/img/ar02.jpg"] },
    { id: "03", name: "女皇 (The Empress)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/d/d2/RWS_Tarot_03_Empress.jpg", "https://www.trustedtarot.com/img/cards/the-empress.png", "https://sacred-texts.com/tarot/pkt/img/ar03.jpg"] },
    { id: "08", name: "力量 (Strength)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/f/f5/RWS_Tarot_08_Strength.jpg", "https://www.trustedtarot.com/img/cards/strength.png", "https://sacred-texts.com/tarot/pkt/img/ar08.jpg"] },
    { id: "14", name: "节制 (Temperance)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/f/f8/RWS_Tarot_14_Temperance.jpg", "https://www.trustedtarot.com/img/cards/temperance.png", "https://sacred-texts.com/tarot/pkt/img/ar14.jpg"] },
    { id: "21", name: "世界 (The World)", sources: ["https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/en/f/ff/RWS_Tarot_21_World.jpg", "https://www.trustedtarot.com/img/cards/the-world.png", "https://sacred-texts.com/tarot/pkt/img/ar21.jpg"] }
];

// 4. AI 生成信件 (带心电图与塔罗牌动画)
async function lsGenerateAILetter() {
    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    // 1. 关闭祈愿菜单，显示动画覆盖层
    lsCloseShrineModal();
    const animOverlay = document.getElementById('ls-pray-animation-overlay');
    animOverlay.style.display = 'flex';

    // 2. 显示心电图并播放动画
    const ecg = document.getElementById('ecg-anim');
    ecg.style.display = 'block';
    void ecg.offsetWidth; // 强制重绘
    ecg.classList.add('active');

    // 记录动画开始时间，确保心电图至少播放 4 秒
    const animStartTime = Date.now();

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
       
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-40).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        let memoryText = "暂无特殊记忆。";
        let memoryCount = 0;
        if (char.memories && char.memories.length > 0) {
            memoryCount = char.memories.length;
            memoryText = char.memories.slice(0, 15).map(m => `- ${m.content}`).join('\n');
        }

        // 提取塔罗牌列表供 AI 选择
        const tarotOptions = globalTarotDeck.map(t => `${t.id}: ${t.name}`).join(', ');

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)面具/设定】：${userPersona}\n`;
        prompt += `【你们的共同记忆（共 ${memoryCount} 条记录）】：\n${memoryText}\n\n`;
        prompt += `【最近的聊天记录（40条上下文）】：\n${recentMsgs}\n\n`;
        
        prompt += `请以 ${char.name} 的口吻，给 User 写一封跨越时空的信，并为 User 抽取一张命运的塔罗牌。\n`;
        prompt += `【核心要求】：\n`;
        prompt += `1. 文风要求：极具高级感、日系/韩系文艺风、意识流、细腻且克制。不要太直白，要像深夜里的呢喃或散文诗。\n`;
        prompt += `2. 内容要求：必须结合【共同记忆】和【聊天记录】中的细节，表达你对 User 的深层情感。\n`;
        prompt += `3. 塔罗牌抽取：请根据当前的聊天氛围和你的心情，从以下列表中选择最合适的一张塔罗牌：[${tarotOptions}]。\n`;
        prompt += `4. 【绝对禁止】：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！\n`;
        prompt += `5. 必须严格按照以下 JSON 格式返回：\n`;
        prompt += `{
  "title": "信件标题（如：写在星轨交汇时 / 听雨时的随笔）",
  "salutation": "对User的亲昵称呼：\\n见字如晤，",
  "content": "信件正文内容（支持使用 \\n 换行，字数400-600字左右）",
  "signature": "你的署名（如：永远爱你的 ${char.name}）",
  "tarotId": "你选择的塔罗牌ID（必须是两位数字，如 06）",
  "tarotMeaning": "结合当前语境，你给出的专属塔罗牌判词（一句话，文艺且深情）"
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
        const letterData = JSON.parse(content);

        const newLetterId = Date.now();
        if (!lsState.letters) lsState.letters = [];
        lsState.letters.push({
            id: newLetterId,
            from: 'char',
            title: letterData.title || '无题',
            salutation: letterData.salutation || '',
            content: letterData.content || '...',
            signature: letterData.signature || '',
            time: Date.now()
        });
        
        lsSaveData();
        
        // 3. 处理塔罗牌图片加载
        const tId = letterData.tarotId || "06";
        let selectedCard = globalTarotDeck.find(t => t.id === tId);
        if (!selectedCard) selectedCard = globalTarotDeck[0]; // 兜底恋人牌

        const imgEl = document.getElementById('tarot-front-img');
        let currentSourceIndex = 0;
        
        imgEl.onerror = function() {
            currentSourceIndex++;
            if (currentSourceIndex < selectedCard.sources.length) {
                imgEl.src = selectedCard.sources[currentSourceIndex];
            } else {
                imgEl.alt = "图片加载失败，请检查网络";
            }
        };
        imgEl.src = selectedCard.sources[0];

        document.getElementById('tarot-name-display').innerText = selectedCard.name;
        document.getElementById('tarot-meaning-display').innerText = letterData.tarotMeaning || "命运的齿轮已经开始转动。";

        // 4. 确保心电图至少播放了 4 秒
        const elapsedTime = Date.now() - animStartTime;
        const remainingTime = Math.max(0, 4000 - elapsedTime);

        setTimeout(() => {
            ecg.style.display = 'none';
            ecg.classList.remove('active');
            
            // 显示塔罗牌
            const tarot = document.getElementById('tarot-anim');
            tarot.classList.add('show');

            // 绑定点击翻转事件
            tarot.onclick = function() {
                const card = document.getElementById('tarot-card');
                if (card.classList.contains('flipped')) {
                    // 再次点击结束动画
                    animOverlay.style.display = 'none';
                    tarot.classList.remove('show');
                    card.classList.remove('flipped');
                    
                    // 刷新主页信件列表并打开信件详情
                    lsOpenLettersView();
                    setTimeout(() => {
                        lsOpenLetterDetail(newLetterId);
                    }, 300);
                } else {
                    // 第一次点击翻转
                    card.classList.add('flipped');
                }
            };

        }, remainingTime);

        if (typeof showMainSystemNotification === 'function') {
            showMainSystemNotification("星の神社", `收到了一封来自 ${char.name} 的誓言信件`, char.avatar);
        }

    } catch (e) {
        console.error(e);
        document.getElementById('ls-pray-animation-overlay').style.display = 'none';
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[时空信箱生成失败] ${e.message}`);
        else alert("祈愿失败，信号在星空中迷失了...");
    }
}

// 供全局调用的翻转函数 (兼容旧代码)
window.lsFlipTarot = function() {
    const card = document.getElementById('tarot-card');
    if (card) card.classList.add('flipped');
};


// 5. 用户写信逻辑
function lsOpenUserLetterInput() {
    document.getElementById('ls-write-title').value = '';
    document.getElementById('ls-write-body').value = '';
    
    const view = document.getElementById('ls-user-write-view');
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
}

function lsCloseUserLetterInput() {
    const view = document.getElementById('ls-user-write-view');
    view.classList.remove('active');
    setTimeout(() => view.style.display = 'none', 400);
}

function lsSubmitUserLetter() {
    const title = document.getElementById('ls-write-title').value.trim() || '写给你的信';
    const text = document.getElementById('ls-write-body').value.trim();
    
    if (!text) return alert("信件内容不能为空哦~");

    if (!lsState.letters) lsState.letters = [];
    lsState.letters.push({
        id: Date.now(),
        from: 'user',
        title: title,
        content: text,
        time: Date.now()
    });
    
    lsSaveData();
    lsRenderStarlights();
    lsCloseUserLetterInput();
    alert("信件已化作星光投递。你可以在星空中点击它，并祈求 Ta 的回信。");
}

// 6. 阅读信件与手动请求回信
let currentReadingLetterId = null;

function lsOpenLetterDetail(id) {
    const letter = lsState.letters.find(l => l.id === id);
    if (!letter) return;

    currentReadingLetterId = id;
    const char = wcState.characters.find(c => c.id === lsState.boundCharId);
    const authorName = letter.from === 'char' ? (char ? char.name : 'Ta') : 'Me';

    document.getElementById('ls-letter-detail-date').innerText = new Date(letter.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('ls-letter-detail-title').innerText = letter.title;
    
    // 拼装称呼和正文
    let fullContent = '';
    if (letter.salutation) {
        fullContent += `<div style="font-weight: bold; margin-bottom: 15px; color: #3A3533;">${letter.salutation.replace(/\n/g, '<br>')}</div>`;
    }
    fullContent += letter.content.replace(/\n/g, '<br>');
    document.getElementById('ls-letter-detail-content').innerHTML = fullContent;

    // 渲染署名
    if (letter.signature) {
        document.getElementById('ls-letter-detail-author').innerHTML = letter.signature.replace(/\n/g, '<br>');
    } else {
        document.getElementById('ls-letter-detail-author').innerText = `— ${authorName}`;
    }

    // 控制回信按钮的显示与隐藏
    const replyBtn = document.getElementById('ls-btn-request-reply');
    if (letter.from === 'user') {
        replyBtn.style.display = 'block';
    } else {
        replyBtn.style.display = 'none';
    }

    const modal = document.getElementById('ls-letter-detail-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function lsCloseLetterDetail() {
    const modal = document.getElementById('ls-letter-detail-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 400);
    currentReadingLetterId = null;
}

function lsDeleteCurrentLetter() {
    if (!currentReadingLetterId) return;
    if (confirm("确定要将这封信化作宇宙尘埃吗？")) {
        lsState.letters = lsState.letters.filter(l => l.id !== currentReadingLetterId);
        lsSaveData();
        lsRenderStarlights();
        lsCloseLetterDetail();
    }
}

// 7. 手动点击按钮，请求 AI 回信
async function lsRequestReply() {
    if (!currentReadingLetterId) return;
    const letter = lsState.letters.find(l => l.id === currentReadingLetterId);
    if (!letter || letter.from !== 'user') return;

    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const replyBtn = document.getElementById('ls-btn-request-reply');
    const originalText = replyBtn.innerText;
    replyBtn.innerText = "Ta 正在提笔回信...";
    replyBtn.style.pointerEvents = 'none';
    replyBtn.style.opacity = '0.5';

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

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)面具/设定】：${userPersona}\n\n`;
        
        prompt += `【核心事件】：User 刚刚在时空信箱中给你写了一封信，并祈求你的回信。\n`;
        prompt += `User 的信件标题：【${letter.title}】\n`;
        prompt += `User 的信件内容：\n${letter.content}\n\n`;
        
        prompt += `请你仔细阅读 User 的信件后，以 ${char.name} 的身份给 User 写一封回信。\n`;
        prompt += `【核心要求】：\n`;
        prompt += `1. 文风要求：极具高级感、日系/韩系文艺风、意识流、细腻且克制。要针对 User 信中的内容进行深情的回应。\n`;
        prompt += `2. 【绝对禁止】：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！\n`;
        prompt += `3. 必须严格按照以下 JSON 格式返回：\n`;
        prompt += `{
  "title": "回信标题（如：展信佳 / 见字如面）",
  "salutation": "对User的亲昵称呼：\\n见字如晤，",
  "content": "回信正文内容（支持使用 \\n 换行，字数400-600字左右）",
  "signature": "你的署名（如：永远爱你的 ${char.name}）"
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
        const letterData = JSON.parse(content);

        lsState.letters.push({
            id: Date.now(),
            from: 'char',
            title: letterData.title || '回信',
            salutation: letterData.salutation || '',
            content: letterData.content || '...',
            signature: letterData.signature || '',
            time: Date.now()
        });
        
        lsSaveData();
        lsRenderStarlights();
        
        alert("回信已送达！请退出当前信件，在星空中寻找那颗新出现的金色星光吧。");
        lsCloseLetterDetail();

    } catch (e) {
        console.error("回信失败", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[时空信箱回信失败] ${e.message}`);
        else alert("回信在时空中迷失了，请重试...");
    } finally {
        replyBtn.innerText = originalText;
        replyBtn.style.pointerEvents = 'auto';
        replyBtn.style.opacity = '1';
    }
}
/* ========================================== */
/* 恋人空间：时光相册 (Time Album) 核心逻辑 */
/* ========================================== */

function lsOpenTimeAlbum() {
    if (!lsState.boundCharId) return alert("请先在首页绑定一位恋人哦~");
    document.getElementById('ls-view-main').classList.remove('active');
    document.getElementById('ls-view-time-album').classList.add('active');
    lsSwitchAlbumTab('diary');
}

function lsCloseTimeAlbum() {
    document.getElementById('ls-view-time-album').classList.remove('active');
    document.getElementById('ls-view-main').classList.add('active');
}

function lsSwitchAlbumTab(tabId) {
    document.querySelectorAll('.ta-cap-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.ta-content-view').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`ta-tab-${tabId}`).classList.add('active');
    document.getElementById(`ta-view-${tabId}`).classList.add('active');

    if (tabId === 'diary') lsRenderTimeDiary();
    if (tabId === 'decor') lsRenderDecorPreview();
    if (tabId === 'gallery') lsRenderAvatarGallery();
}

// --- 时光纪要 (日记) ---
function lsRenderTimeDiary() {
    const container = document.getElementById('ta-timeline-container');
    container.innerHTML = '';

    if (!lsState.timeAlbum || lsState.timeAlbum.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px; font-style:italic;">暂无照片记录，快去上传或在聊天中发送图片吧~</div>';
        return;
    }

    lsState.timeAlbum.forEach(entry => {
        const tagText = entry.type === 'chat_saved' ? 'SAVED FROM CHAT' : 'DAILY MEMO';
        
        let userTextHtml = '';
        if (entry.userText) {
            userTextHtml = `<div class="ta-diary-user-text">${entry.userText}</div>`;
        }

        let charCommentHtml = '';
        if (entry.charComment) {
            charCommentHtml = `
                <div class="ta-char-comment-box">
                    <div class="ta-char-name">Ta's Reply</div>
                    <div class="ta-char-text">“${entry.charComment}”</div>
                </div>
            `;
        } else {
            charCommentHtml = `
                <div class="ta-char-comment-box" style="opacity: 0.6;">
                    <div class="ta-char-name">Ta's Reply</div>
                    <div class="ta-char-text" style="font-size: 12px;">Ta 正在认真看照片...</div>
                </div>
            `;
        }

        const html = `
            <div class="ta-timeline-item">
                <div class="ta-timeline-dot"></div>
                <div class="ta-diary-date">${entry.date}</div>
                <div class="ta-diary-card">
                    <!-- 新增：删除按钮 -->
                    <div class="ta-diary-delete-btn" onclick="lsDeleteTimeDiary(${entry.id})" title="删除此记录">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                    <div class="ta-diary-tag">${tagText}</div>
                    <img src="${entry.img}" class="ta-diary-img" onclick="wcPreviewImage('${entry.img}')">
                    ${userTextHtml}
                    ${charCommentHtml}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// 新增：删除时光纪要记录
function lsDeleteTimeDiary(id) {
    if (confirm("确定要删除这条时光纪要吗？")) {
        lsState.timeAlbum = lsState.timeAlbum.filter(e => e.id !== id);
        lsSaveData();
        lsRenderTimeDiary();
    }
}

// 修复：使用 wcCompressImage 压缩图片，防止上传失败
async function lsHandleDiaryUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const base64 = await wcCompressImage(file);
        const userText = prompt("给这张照片写点备忘录吧 (选填)：") || "";
        
        const now = new Date();
        const dateStr = `${now.getMonth()+1}.${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        const newEntry = {
            id: Date.now(),
            type: 'upload',
            img: base64,
            date: dateStr,
            userText: userText,
            charComment: null
        };

        if (!lsState.timeAlbum) lsState.timeAlbum = [];
        lsState.timeAlbum.unshift(newEntry);
        lsSaveData();
        lsRenderTimeDiary();

        // 触发 AI 评价
        lsTriggerDiaryAIComment(newEntry.id);
    } catch (e) {
        console.error("图片处理失败", e);
        alert("图片处理失败，请重试");
    }
    event.target.value = '';
}

async function lsTriggerDiaryAIComment(entryId) {
    const char = wcState.characters.find(c => c.id === lsState.boundCharId);
    if (!char) return;

    const entry = lsState.timeAlbum.find(e => e.id === entryId);
    if (!entry) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return;

    try {
        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n`;
        if (entry.type === 'chat_saved') {
            prompt += `User 刚刚在微信聊天里发了一张图片，你偷偷把它存到了你们的专属相册里。\n`;
        } else {
            prompt += `User 刚刚在你们的专属相册里上传了一张日常照片，并配文：“${entry.userText || '无'}”。\n`;
        }
        prompt += `请根据你的人设，给这张照片写一条简短的评论（就像在朋友圈或备忘录里的留言）。\n`;
        prompt += `要求：语气自然，符合人设，不要超过50字。直接输出评论内容，不要任何多余格式和引号。`;

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
        let content = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        
        entry.charComment = content;
        lsSaveData();
        
        if (document.getElementById('ta-view-diary').classList.contains('active')) {
            lsRenderTimeDiary();
        }
    } catch (e) {
        console.error("AI 评价照片失败", e);
        entry.charComment = "照片很好看哦~"; // 兜底
        lsSaveData();
        lsRenderTimeDiary();
    }
}
// ==========================================
// 恋人空间：情头图库 (Couple Avatar Gallery) 逻辑
// ==========================================

let isAvatarEditMode = false;
let currentEditingDescBox = null;

function lsToggleAvatarInvite(checkbox) {
    lsState.avatarInviteEnabled = checkbox.checked;
    lsSaveData();
}

function lsRenderAvatarGallery() {
    const toggle = document.getElementById('ls-toggle-avatar-invite');
    if (toggle) toggle.checked = lsState.avatarInviteEnabled !== false;

    const grid = document.getElementById('ls-avatar-gallery-grid');
    grid.innerHTML = '';

    if (!lsState.coupleAvatars || lsState.coupleAvatars.length === 0) {
        grid.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #999; padding: 40px 0; font-size: 13px; font-style: italic;">图库空空如也，快去上传情头吧~</div>';
        return;
    }

    lsState.coupleAvatars.forEach((pair, idx) => {
        const group = document.createElement('div');
        group.className = `ls-gallery-group ${isAvatarEditMode ? 'edit-mode' : ''}`;
        group.dataset.index = idx;
        
        group.innerHTML = `
            <input type="checkbox" class="ls-gallery-checkbox" value="${idx}">
            <div class="ls-gallery-img-box" draggable="true" data-pos="1">
                <img src="${pair.url1}">
                <div class="ls-gallery-img-desc">${pair.desc1}</div>
            </div>
            <div class="ls-gallery-img-box" draggable="true" data-pos="2">
                <img src="${pair.url2}">
                <div class="ls-gallery-img-desc">${pair.desc2}</div>
            </div>
        `;
        
        lsBindAvatarBoxEvents(group, idx);
        grid.appendChild(group);
    });
}

function lsToggleAvatarEditMode() {
    isAvatarEditMode = !isAvatarEditMode;
    const editBtn = document.getElementById('ls-avatar-edit-btn');
    const deleteBtn = document.getElementById('ls-avatar-delete-btn');
    
    if (isAvatarEditMode) {
        editBtn.innerText = '完成';
        deleteBtn.style.display = 'block';
    } else {
        editBtn.innerText = '编辑图库';
        deleteBtn.style.display = 'none';
    }
    lsRenderAvatarGallery();
}

function lsDeleteSelectedAvatars() {
    const checkboxes = document.querySelectorAll('.ls-gallery-checkbox:checked');
    if (checkboxes.length === 0) return alert("请先选择要删除的情头组");
    
    if (confirm(`确定要删除选中的 ${checkboxes.length} 组情头吗？`)) {
        const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => b - a);
        indicesToDelete.forEach(idx => { lsState.coupleAvatars.splice(idx, 1); });
        lsSaveData();
        lsToggleAvatarEditMode(); 
    }
}

// URL 批量导入
function lsOpenAvatarUrlModal() {
    document.getElementById('ls-avatar-url-textarea').value = '';
    wcOpenModal('ls-modal-avatar-url');
}

function lsCloseAvatarUrlModal() {
    wcCloseModal('ls-modal-avatar-url');
}

function lsSubmitAvatarUrlUpload() {
    const text = document.getElementById('ls-avatar-url-textarea').value.trim();
    if (!text) return alert("请输入图片 URL！");
    
    const urls = text.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length < 2) return alert("请至少输入 2 个 URL 才能组成一对情头哦！");

    if (!lsState.coupleAvatars) lsState.coupleAvatars = [];

    for (let i = 0; i < urls.length - 1; i += 2) {
        lsState.coupleAvatars.push({
            url1: urls[i], desc1: "点击修改描述",
            url2: urls[i+1], desc2: "点击修改描述"
        });
    }

    if (urls.length % 2 !== 0) {
        alert(`检测到输入了奇数个 URL，最后一个 URL 已被忽略，请凑齐一对后重新添加。`);
    }

    lsSaveData();
    lsRenderAvatarGallery();
    lsCloseAvatarUrlModal();
}

// 本地多选上传
async function lsHandleAvatarLocalUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length < 2) return alert("请至少选择 2 张图片作为情头！");
    
    wcShowLoading("正在处理图片...");
    if (!lsState.coupleAvatars) lsState.coupleAvatars = [];

    try {
        for (let i = 0; i < files.length - 1; i += 2) {
            const base64_1 = await wcCompressImage(files[i]);
            const base64_2 = await wcCompressImage(files[i+1]);
            lsState.coupleAvatars.push({
                url1: base64_1, desc1: "点击修改描述",
                url2: base64_2, desc2: "点击修改描述"
            });
        }
        
        if (files.length % 2 !== 0) {
            alert(`检测到选择了奇数张图片，最后一张已被忽略，请凑齐一对后重新添加。`);
        }
        
        lsSaveData();
        lsRenderAvatarGallery();
    } catch (e) {
        console.error(e);
        alert("图片处理失败");
    } finally {
        wcShowSuccess("上传成功");
        event.target.value = '';
    }
}

// 修改描述
function lsOpenAvatarDescModal(descBox, pairIdx, pos) {
    currentEditingDescBox = { pairIdx, pos };
    const currentText = descBox.innerText;
    document.getElementById('ls-avatar-desc-input').value = currentText === '点击修改描述' ? '' : currentText;
    wcOpenModal('ls-modal-avatar-desc');
    setTimeout(() => document.getElementById('ls-avatar-desc-input').focus(), 100);
}

function lsCloseAvatarDescModal() {
    wcCloseModal('ls-modal-avatar-desc');
    currentEditingDescBox = null;
}

function lsSubmitAvatarDesc() {
    if (currentEditingDescBox) {
        const val = document.getElementById('ls-avatar-desc-input').value.trim() || '点击修改描述';
        const pair = lsState.coupleAvatars[currentEditingDescBox.pairIdx];
        if (currentEditingDescBox.pos === '1') pair.desc1 = val;
        else pair.desc2 = val;
        
        lsSaveData();
        lsRenderAvatarGallery();
    }
    lsCloseAvatarDescModal();
}

// 兼容移动端的丝滑拖拽交换逻辑
let lsGalleryDrag = {
    active: false,
    sourceEl: null,
    ghostEl: null,
    sourcePairIdx: null,
    sourcePos: null,
    offsetX: 0,
    offsetY: 0
};

function lsBindAvatarBoxEvents(group, pairIdx) {
    const boxes = group.querySelectorAll('.ls-gallery-img-box');
    boxes.forEach(box => {
        // 点击修改描述 (非编辑模式)
        box.addEventListener('click', function(e) {
            if (!isAvatarEditMode) {
                lsOpenAvatarDescModal(this.querySelector('.ls-gallery-img-desc'), pairIdx, this.dataset.pos);
            }
        });

        // 绑定触摸和鼠标按下事件 (编辑模式拖拽)
        box.addEventListener('touchstart', handleGalleryDragStart, { passive: false });
        box.addEventListener('mousedown', handleGalleryDragStart);
    });
}

function handleGalleryDragStart(e) {
    if (!isAvatarEditMode) return;
    if (e.touches && e.touches.length > 1) return; // 防止多指触控干扰
    if (e.target.classList.contains('ls-gallery-checkbox')) return; // 忽略复选框点击

    e.preventDefault(); // 阻止默认滚动

    const touch = e.touches ? e.touches[0] : e;
    const targetBox = e.currentTarget;
    
    lsGalleryDrag.active = true;
    lsGalleryDrag.sourceEl = targetBox;
    lsGalleryDrag.sourcePairIdx = targetBox.closest('.ls-gallery-group').dataset.index;
    lsGalleryDrag.sourcePos = targetBox.dataset.pos;

    // 计算手指点击位置与元素左上角的偏移量
    const rect = targetBox.getBoundingClientRect();
    lsGalleryDrag.offsetX = touch.clientX - rect.left;
    lsGalleryDrag.offsetY = touch.clientY - rect.top;

    // 创建跟随手指的幽灵元素
    lsGalleryDrag.ghostEl = targetBox.cloneNode(true);
    lsGalleryDrag.ghostEl.style.position = 'fixed';
    lsGalleryDrag.ghostEl.style.zIndex = '99999';
    lsGalleryDrag.ghostEl.style.opacity = '0.8';
    lsGalleryDrag.ghostEl.style.pointerEvents = 'none'; // 关键：让事件穿透幽灵元素，才能检测到下方的目标
    lsGalleryDrag.ghostEl.style.width = rect.width + 'px';
    lsGalleryDrag.ghostEl.style.height = rect.height + 'px';
    lsGalleryDrag.ghostEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    lsGalleryDrag.ghostEl.style.transform = 'scale(1.05)';
    
    document.body.appendChild(lsGalleryDrag.ghostEl);
    updateGalleryGhostPosition(touch.clientX, touch.clientY);
    
    targetBox.style.opacity = '0.3'; // 原元素变暗

    // 绑定全局移动和松开事件
    document.addEventListener('touchmove', handleGalleryDragMove, { passive: false });
    document.addEventListener('mousemove', handleGalleryDragMove);
    document.addEventListener('touchend', handleGalleryDragEnd);
    document.addEventListener('mouseup', handleGalleryDragEnd);
}

function updateGalleryGhostPosition(x, y) {
    if (lsGalleryDrag.ghostEl) {
        lsGalleryDrag.ghostEl.style.left = (x - lsGalleryDrag.offsetX) + 'px';
        lsGalleryDrag.ghostEl.style.top = (y - lsGalleryDrag.offsetY) + 'px';
    }
}

function handleGalleryDragMove(e) {
    if (!lsGalleryDrag.active) return;
    e.preventDefault(); // 拖拽时禁止页面滚动
    const touch = e.touches ? e.touches[0] : e;
    updateGalleryGhostPosition(touch.clientX, touch.clientY);
}

function handleGalleryDragEnd(e) {
    if (!lsGalleryDrag.active) return;
    
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    
    // 获取手指松开位置下方的元素
    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetBox = elemBelow ? elemBelow.closest('.ls-gallery-img-box') : null;

    // 如果落在了另一个图片框上，执行数据交换
    if (targetBox && targetBox !== lsGalleryDrag.sourceEl) {
        const targetPairIdx = targetBox.closest('.ls-gallery-group').dataset.index;
        const targetPos = targetBox.dataset.pos;
        
        const sourcePair = lsState.coupleAvatars[lsGalleryDrag.sourcePairIdx];
        const targetPair = lsState.coupleAvatars[targetPairIdx];
        
        // 交换数据
        const tempUrl = sourcePair[`url${lsGalleryDrag.sourcePos}`];
        const tempDesc = sourcePair[`desc${lsGalleryDrag.sourcePos}`];
        
        sourcePair[`url${lsGalleryDrag.sourcePos}`] = targetPair[`url${targetPos}`];
        sourcePair[`desc${lsGalleryDrag.sourcePos}`] = targetPair[`desc${targetPos}`];
        
        targetPair[`url${targetPos}`] = tempUrl;
        targetPair[`desc${targetPos}`] = tempDesc;
        
        lsSaveData();
    }

    // 清理拖拽状态和 DOM
    if (lsGalleryDrag.sourceEl) lsGalleryDrag.sourceEl.style.opacity = '1';
    if (lsGalleryDrag.ghostEl) lsGalleryDrag.ghostEl.remove();
    
    lsGalleryDrag = { active: false, sourceEl: null, ghostEl: null, sourcePairIdx: null, sourcePos: null, offsetX: 0, offsetY: 0 };
    
    document.removeEventListener('touchmove', handleGalleryDragMove);
    document.removeEventListener('mousemove', handleGalleryDragMove);
    document.removeEventListener('touchend', handleGalleryDragEnd);
    document.removeEventListener('mouseup', handleGalleryDragEnd);
    
    lsRenderAvatarGallery(); // 重新渲染刷新视图
}

// ==========================================
// 聊天界面：情头邀请弹窗逻辑
// ==========================================
let pendingAvatarInviteData = null;

function lsOpenAvatarInviteModal(charId, msgId, pairIndex) {
    const msgs = wcState.chats[charId];
    const msg = msgs.find(m => m.id.toString() === msgId.toString());
    if (!msg || msg.status !== 'pending') return; // 只有 pending 状态才能点开

    const pair = lsState.coupleAvatars[pairIndex];
    if (!pair) return alert("该情头组已被删除，无法查看");

    pendingAvatarInviteData = { charId, msgId, pairIndex, selectedPos: null };

    document.getElementById('avatar-invite-img-1').src = pair.url1;
    document.getElementById('avatar-invite-img-2').src = pair.url2;
    
    // 重置状态
    document.getElementById('avatar-select-1').style.opacity = '1';
    document.getElementById('avatar-select-2').style.opacity = '1';
    document.getElementById('avatar-invite-img-1').style.borderColor = 'transparent';
    document.getElementById('avatar-invite-img-2').style.borderColor = 'transparent';
    document.getElementById('avatar-invite-label-1').innerText = '未选择';
    document.getElementById('avatar-invite-label-1').style.color = '#888';
    document.getElementById('avatar-invite-label-2').innerText = '未选择';
    document.getElementById('avatar-invite-label-2').style.color = '#888';
    
    document.getElementById('avatar-invite-confirm-btn').style.opacity = '0.5';
    document.getElementById('avatar-invite-confirm-btn').style.pointerEvents = 'none';

    wcOpenModal('ls-modal-avatar-invite');
}

function lsSelectAvatarRole(pos) {
    if (!pendingAvatarInviteData) return;
    pendingAvatarInviteData.selectedPos = pos;

    const char = wcState.characters.find(c => c.id === pendingAvatarInviteData.charId);
    const charName = char ? char.name : "Ta";

    if (pos === 1) {
        document.getElementById('avatar-invite-img-1').style.borderColor = '#111';
        document.getElementById('avatar-invite-label-1').innerText = '我使用 (User)';
        document.getElementById('avatar-invite-label-1').style.color = '#111';
        
        document.getElementById('avatar-invite-img-2').style.borderColor = '#CCC';
        document.getElementById('avatar-invite-label-2').innerText = `${charName} 使用`;
        document.getElementById('avatar-invite-label-2').style.color = '#CCC';
    } else {
        document.getElementById('avatar-invite-img-2').style.borderColor = '#111';
        document.getElementById('avatar-invite-label-2').innerText = '我使用 (User)';
        document.getElementById('avatar-invite-label-2').style.color = '#111';
        
        document.getElementById('avatar-invite-img-1').style.borderColor = '#CCC';
        document.getElementById('avatar-invite-label-1').innerText = `${charName} 使用`;
        document.getElementById('avatar-invite-label-1').style.color = '#CCC';
    }

    document.getElementById('avatar-invite-confirm-btn').style.opacity = '1';
    document.getElementById('avatar-invite-confirm-btn').style.pointerEvents = 'auto';
}

function lsRejectAvatarInvite() {
    if (!pendingAvatarInviteData) return;
    const { charId, msgId } = pendingAvatarInviteData;
    
    const msgs = wcState.chats[charId];
    const msg = msgs.find(m => m.id.toString() === msgId.toString());
    if (msg) msg.status = 'rejected';
    
    wcSaveData();
    wcRenderMessages(charId);
    
    wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): User 拒绝了你的情头更换邀请。]`, { hidden: true });
    
    wcCloseModal('ls-modal-avatar-invite');
    pendingAvatarInviteData = null;
}

async function lsConfirmAvatarInvite() {
    if (!pendingAvatarInviteData || !pendingAvatarInviteData.selectedPos) return;
    
    const { charId, msgId, pairIndex, selectedPos } = pendingAvatarInviteData;
    const pair = lsState.coupleAvatars[pairIndex];
    const char = wcState.characters.find(c => c.id === charId);
    
    if (!pair || !char) return;

    // 分配头像
    if (selectedPos === 1) {
        wcState.user.avatar = pair.url1;
        char.avatar = pair.url2;
    } else {
        wcState.user.avatar = pair.url2;
        char.avatar = pair.url1;
    }

    // 更新消息状态
    const msgs = wcState.chats[charId];
    const msg = msgs.find(m => m.id.toString() === msgId.toString());
    if (msg) msg.status = 'accepted';

    // 同步到恋人空间和设置页
    if (char.chatConfig) char.chatConfig.userAvatar = wcState.user.avatar;
    
    await wcWriteCharactersPersistentSnapshot();
    try { await wcDb.put('characters', char); } catch (e) {}
    wcSaveData();
    
    wcRenderUser();
    wcRenderMessages(charId);
    
    wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): User 同意了你的情头邀请，你们现在已经换上了新的情侣头像！请在回复中表现出开心或甜蜜。]`, { hidden: true });
    
    wcCloseModal('ls-modal-avatar-invite');
    pendingAvatarInviteData = null;
    
    alert("情侣头像更换成功！");
}

// --- 桌面装修 ---
// 终极修复：使用 for...of 严格等待异步压缩完成，防止 input 被提前清空导致文件丢失
async function lsHandleDecorUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!lsState.decorImages) lsState.decorImages = [];

    // 提取为数组，防止 files 对象丢失
    const fileArray = Array.from(files);
    
    // 开启 loading 动画，防止用户在处理大图时以为卡住了
    const loading = document.getElementById('ta-loading-overlay');
    if (loading) {
        loading.querySelector('.ta-spinner').nextElementSibling.innerText = "正在处理图片...";
        loading.classList.add('active');
    }

    try {
        // 严格排队处理每一张图片，确保压缩完毕再进行下一张
        for (let file of fileArray) {
            const base64 = await wcCompressImage(file);
            lsState.decorImages.push(base64);
        }
        
        lsSaveData();
        lsRenderDecorPreview();
    } catch (e) {
        console.error("图片处理失败", e);
        alert("部分图片处理失败，请重试");
    } finally {
        if (loading) {
            loading.classList.remove('active');
            loading.querySelector('.ta-spinner').nextElementSibling.innerText = "Ta 正在为你搭配..."; // 恢复文字
        }
        // 必须在所有图片都处理完之后，才能清空 input！
        event.target.value = '';
    }
}

// --- 新增：双图库多选管理逻辑 ---
let isWpManageMode = false;
let isIconManageMode = false;

// 1. 壁纸图库管理
function lsToggleWpManageMode() {
    isWpManageMode = !isWpManageMode;
    const previewContainer = document.getElementById('ta-wp-preview');
    const manageActions = document.getElementById('ta-wp-manage-actions');
    const manageBtn = document.getElementById('ta-wp-manage-btn');
    
    if (isWpManageMode) {
        previewContainer.classList.add('manage-mode');
        manageActions.style.display = 'flex';
        manageBtn.innerText = '完成';
    } else {
        previewContainer.classList.remove('manage-mode');
        manageActions.style.display = 'none';
        manageBtn.innerText = '管理';
        previewContainer.querySelectorAll('.ta-image-checkbox').forEach(cb => cb.checked = false);
    }
}

function lsDeleteSelectedWallpapers() {
    const checkboxes = document.querySelectorAll('#ta-wp-preview .ta-image-checkbox:checked');
    if (checkboxes.length === 0) return alert("请先选择要删除的壁纸");
    
    if (confirm(`确定要删除选中的 ${checkboxes.length} 张壁纸吗？`)) {
        const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => b - a);
        indicesToDelete.forEach(idx => { lsState.decorWallpapers.splice(idx, 1); });
        lsSaveData();
        lsToggleWpManageMode(); 
        lsRenderWallpaperPreview(); 
    }
}

// 2. 图标图库管理
function lsToggleIconManageMode() {
    isIconManageMode = !isIconManageMode;
    const previewContainer = document.getElementById('ta-icon-preview');
    const manageActions = document.getElementById('ta-icon-manage-actions');
    const manageBtn = document.getElementById('ta-icon-manage-btn');
    
    if (isIconManageMode) {
        previewContainer.classList.add('manage-mode');
        manageActions.style.display = 'flex';
        manageBtn.innerText = '完成';
    } else {
        previewContainer.classList.remove('manage-mode');
        manageActions.style.display = 'none';
        manageBtn.innerText = '管理';
        previewContainer.querySelectorAll('.ta-image-checkbox').forEach(cb => cb.checked = false);
    }
}

function lsDeleteSelectedIcons() {
    const checkboxes = document.querySelectorAll('#ta-icon-preview .ta-image-checkbox:checked');
    if (checkboxes.length === 0) return alert("请先选择要删除的图标");
    
    if (confirm(`确定要删除选中的 ${checkboxes.length} 张图标吗？`)) {
        const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => b - a);
        indicesToDelete.forEach(idx => { lsState.decorIcons.splice(idx, 1); });
        lsSaveData();
        lsToggleIconManageMode(); 
        lsRenderIconPreview(); 
    }
}

// --- 桌面装修上传与渲染 ---
async function lsHandleWallpaperUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!lsState.decorWallpapers) lsState.decorWallpapers = [];

    const fileArray = Array.from(files);
    const loading = document.getElementById('ta-loading-overlay');
    if (loading) {
        loading.querySelector('.ta-spinner').nextElementSibling.innerText = "正在处理壁纸...";
        loading.classList.add('active');
    }

    try {
        for (let file of fileArray) {
            const base64 = await wcCompressImage(file);
            lsState.decorWallpapers.push(base64);
        }
        lsSaveData();
        lsRenderWallpaperPreview();
        checkDecorateBtnState();
    } catch (e) {
        console.error("壁纸处理失败", e);
    } finally {
        if (loading) loading.classList.remove('active');
        event.target.value = '';
    }
}

async function lsHandleIconUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!lsState.decorIcons) lsState.decorIcons = [];

    const fileArray = Array.from(files);
    const loading = document.getElementById('ta-loading-overlay');
    if (loading) {
        loading.querySelector('.ta-spinner').nextElementSibling.innerText = "正在处理图标...";
        loading.classList.add('active');
    }

    try {
        for (let file of fileArray) {
            const base64 = await wcCompressImage(file);
            lsState.decorIcons.push(base64);
        }
        lsSaveData();
        lsRenderIconPreview();
        checkDecorateBtnState();
    } catch (e) {
        console.error("图标处理失败", e);
    } finally {
        if (loading) loading.classList.remove('active');
        event.target.value = '';
    }
}
// ==========================================
// 修复：补充缺失的桌面装修综合渲染函数
// ==========================================
window.lsRenderDecorPreview = function() {
    // 渲染壁纸预览区
    if (typeof lsRenderWallpaperPreview === 'function') {
        lsRenderWallpaperPreview();
    }
    // 渲染图标预览区
    if (typeof lsRenderIconPreview === 'function') {
        lsRenderIconPreview();
    }
    // 检查并更新“让 Ta 帮忙装修”按钮的可用状态
    if (typeof checkDecorateBtnState === 'function') {
        checkDecorateBtnState();
    }
};
function lsRenderWallpaperPreview() {
    const previewContainer = document.getElementById('ta-wp-preview');
    const countSpan = document.getElementById('ta-wp-count');
    if (!lsState.decorWallpapers) lsState.decorWallpapers = [];
    countSpan.innerText = lsState.decorWallpapers.length;

    if (lsState.decorWallpapers.length === 0) {
        previewContainer.innerHTML = '<div class="ta-empty-text">上传一些竖屏图片作为壁纸备选吧</div>';
        return;
    }

    previewContainer.innerHTML = '';
    lsState.decorWallpapers.forEach((imgSrc, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'ta-image-wrapper';
        // 壁纸预览比例调整为竖屏
        wrapper.style.width = '50px'; wrapper.style.height = '90px';
        
        wrapper.innerHTML = `
            <img src="${imgSrc}" class="ta-image-item" style="width:100%; height:100%; object-fit:cover;" onclick="if(!isWpManageMode) wcPreviewImage('${imgSrc}')">
            <input type="checkbox" class="ta-image-checkbox" value="${idx}">
        `;
        wrapper.onclick = (e) => {
            if (isWpManageMode && e.target.tagName !== 'INPUT') {
                const cb = wrapper.querySelector('.ta-image-checkbox');
                cb.checked = !cb.checked;
            }
        };
        previewContainer.appendChild(wrapper);
    });
}

function lsRenderIconPreview() {
    const previewContainer = document.getElementById('ta-icon-preview');
    const countSpan = document.getElementById('ta-icon-count');
    if (!lsState.decorIcons) lsState.decorIcons = [];
    countSpan.innerText = lsState.decorIcons.length;

    if (lsState.decorIcons.length === 0) {
        previewContainer.innerHTML = '<div class="ta-empty-text">上传一些透明底图或正方形图片作为图标吧</div>';
        return;
    }

    previewContainer.innerHTML = '';
    lsState.decorIcons.forEach((imgSrc, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'ta-image-wrapper';
        
        wrapper.innerHTML = `
            <img src="${imgSrc}" class="ta-image-item" style="object-fit:contain; background:transparent;" onclick="if(!isIconManageMode) wcPreviewImage('${imgSrc}')">
            <input type="checkbox" class="ta-image-checkbox" value="${idx}">
        `;
        wrapper.onclick = (e) => {
            if (isIconManageMode && e.target.tagName !== 'INPUT') {
                const cb = wrapper.querySelector('.ta-image-checkbox');
                cb.checked = !cb.checked;
            }
        };
        previewContainer.appendChild(wrapper);
    });
}

function checkDecorateBtnState() {
    const btn = document.getElementById('ta-decorate-btn');
    if (lsState.decorWallpapers && lsState.decorWallpapers.length > 0 && lsState.decorIcons && lsState.decorIcons.length > 0) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

// 记录 AI 生成的装修结果，用于应用到真实桌面
let tempDecorResult = null;

// --- 核心：真正的 AI 视觉选图逻辑 (壁纸 + 图标分离) ---
async function lsStartDecoration() {
    if (!lsState.decorWallpapers || lsState.decorWallpapers.length === 0 || !lsState.decorIcons || lsState.decorIcons.length === 0) {
        return alert("请确保壁纸图库和图标图库中都有图片哦~");
    }

    const char = wcState.characters.find(c => c.id === lsState.boundCharId);
    if (!char) return;

    const loading = document.getElementById('ta-loading-overlay');
    loading.classList.add('active');
    document.getElementById('ta-apply-btn').style.display = 'none';

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) {
        setTimeout(() => {
            loading.classList.remove('active');
            lsApplyDecorationFallback(); // 降级为随机
        }, 1500);
        return;
    }

    try {
        // 1. 收集上下文
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-30).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        // 2. 判断是否为视觉模型
        const isVisionModel = /vision|gpt-4o|claude-3|gemini|pixtral|qwen-vl|llava/i.test(apiConfig.model);

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `User 让你帮忙“装修”Ta的手机桌面。壁纸图库有 ${lsState.decorWallpapers.length} 张，图标图库有 ${lsState.decorIcons.length} 张。\n`;
        
        if (isVisionModel) {
            prompt += `我已经将图库中的图片附在下方，分为【壁纸备选】和【图标备选】。\n`;
            prompt += `请你真正地“看”这些图片，根据你的人设、User的设定以及最近的聊天氛围，挑选最合适的 1 张壁纸和 7 张图标！\n`;
        } else {
            prompt += `(注意：当前模型不支持视觉识别，请你随机分配 0 到 ${lsState.decorWallpapers.length - 1} 之间的数字作为壁纸索引，0 到 ${lsState.decorIcons.length - 1} 之间的数字作为图标索引)。\n`;
        }

        prompt += `【任务要求】：\n`;
        prompt += `1. 挑选 1 张壁纸索引（wallpaperIndex）。\n`;
        prompt += `2. 写一句对壁纸和图标，对桌面装修的简短留言（message）或者评价，需要体现你的性格。\n`;
        prompt += `3. 为 7 个常用APP（微信, 相册, 音乐, 论坛, 主题, 设置, 世界书）分别起一个符合你性格的昵称（每个不超过4个字），并为它们分别挑选一张图标索引（iconIndex）。\n`;
        prompt += `返回纯JSON格式：\n`;
        prompt += `{
  "wallpaperIndex": 0,
  "message": "留言内容",
  "apps": [
    {"name": "微信的新名字", "iconIndex": 1},
    {"name": "恋人空间的新名字", "iconIndex": 2},
    {"name": "音乐的新名字", "iconIndex": 3},
    {"name": "论坛的新名字", "iconIndex": 4},
    {"name": "主题的新名字", "iconIndex": 5},
    {"name": "设置的新名字", "iconIndex": 6},
    {"name": "世界书的新名字", "iconIndex": 7}
  ]
}`;

        // 3. 构造 payload
        let messagesContent = [];
        if (isVisionModel) {
            messagesContent.push({ type: "text", text: prompt });
            
            // 限制最多传 5 张壁纸，10 张图标给 AI，防止 Token 爆炸
            const maxWp = Math.min(lsState.decorWallpapers.length, 5);
            for (let i = 0; i < maxWp; i++) {
                messagesContent.push({ type: "text", text: `【壁纸备选】[索引 ${i}]:` });
                messagesContent.push({ type: "image_url", image_url: { url: lsState.decorWallpapers[i] } });
            }
            
            const maxIcon = Math.min(lsState.decorIcons.length, 10);
            for (let i = 0; i < maxIcon; i++) {
                messagesContent.push({ type: "text", text: `【图标备选】[索引 ${i}]:` });
                messagesContent.push({ type: "image_url", image_url: { url: lsState.decorIcons[i] } });
            }
        } else {
            messagesContent = prompt;
        }

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: messagesContent }],
                temperature: 0.8,
                max_tokens: 2000
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "API 请求失败");

        let content = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        loading.classList.remove('active');
        lsApplyDecorationAI(result);

    } catch (e) {
        console.error("AI 装修失败", e);
        loading.classList.remove('active');
        lsApplyDecorationFallback(); // 降级为随机
    }
}

// AI 视觉选图应用逻辑
function lsApplyDecorationAI(aiResult) {
    const getWpByIndex = (idx) => {
        const safeIdx = (typeof idx === 'number' && idx >= 0 && idx < lsState.decorWallpapers.length) ? idx : Math.floor(Math.random() * lsState.decorWallpapers.length);
        return lsState.decorWallpapers[safeIdx];
    };
    const getIconByIndex = (idx) => {
        const safeIdx = (typeof idx === 'number' && idx >= 0 && idx < lsState.decorIcons.length) ? idx : Math.floor(Math.random() * lsState.decorIcons.length);
        return lsState.decorIcons[safeIdx];
    };

    // 1. 桌面壁纸与留言
    const wpSrc = getWpByIndex(aiResult.wallpaperIndex);
    document.getElementById('ta-desktop-bg-preview').style.backgroundImage = `url('${wpSrc}')`;
    
    const msgText = aiResult.message || "今天也要开心哦！";
    const bubble = document.getElementById('ta-ai-message-bubble');
    bubble.innerText = msgText;
    bubble.style.opacity = '1';

    // 2. 7 个 APP
    const appNames = [];
    const appIcons = [];
    const defaultNames = ["聊天", "恋人空间", "音乐", "论坛", "主题", "设置", "世界书"];
    
    for (let i = 0; i < 7; i++) {
        const appData = (aiResult.apps && aiResult.apps[i]) ? aiResult.apps[i] : {};
        const iconSrc = getIconByIndex(appData.iconIndex);
        const name = appData.name || defaultNames[i];
        
        appIcons.push(iconSrc);
        appNames.push(name);
        
        const appIconEl = document.getElementById(`ta-app-icon-${i}`);
        const appNameEl = document.getElementById(`ta-app-name-${i}`);
        
        if (appIconEl) { appIconEl.src = iconSrc; appIconEl.style.opacity = '1'; }
        if (appNameEl) { appNameEl.innerText = name; }
    }

    // 3. 保存临时结果
    tempDecorResult = {
        wallpaper: wpSrc,
        appNames: appNames,
        appIcons: appIcons
    };
    document.getElementById('ta-apply-btn').style.display = 'flex';
}

// 降级随机应用逻辑
function lsApplyDecorationFallback() {
    const getRandomWp = () => lsState.decorWallpapers[Math.floor(Math.random() * lsState.decorWallpapers.length)];
    const getRandomIcon = () => lsState.decorIcons[Math.floor(Math.random() * lsState.decorIcons.length)];

    const wpSrc = getRandomWp();
    document.getElementById('ta-desktop-bg-preview').style.backgroundImage = `url('${wpSrc}')`;
    
    const bubble = document.getElementById('ta-ai-message-bubble');
    bubble.innerText = "照片很好看，我帮你换上啦~";
    bubble.style.opacity = '1';

    const names = ["聊天", "恋人空间", "音乐", "论坛", "主题", "设置", "世界书"];
    const appIcons = [];
    
    for (let i = 0; i < 7; i++) {
        const iconSrc = getRandomIcon();
        appIcons.push(iconSrc);
        
        const appIconEl = document.getElementById(`ta-app-icon-${i}`);
        const appNameEl = document.getElementById(`ta-app-name-${i}`);
        
        if (appIconEl) { appIconEl.src = iconSrc; appIconEl.style.opacity = '1'; }
        if (appNameEl) { appNameEl.innerText = names[i]; }
    }

    tempDecorResult = {
        wallpaper: wpSrc,
        appNames: names,
        appIcons: appIcons
    };
    document.getElementById('ta-apply-btn').style.display = 'flex';
}

// 新增：将预览结果应用到真实的手机桌面
function lsApplyDecorationToRealDesktop() {
    if (!tempDecorResult) return alert("请先让 Ta 帮忙装修哦~");
    
    // 1. 更新真实桌面壁纸
    document.getElementById('mainScreen').style.backgroundImage = `url('${tempDecorResult.wallpaper}')`;
    saveThemeSettings(); // 保存壁纸设置

    // 2. 更新真实 7 个 APP
    for (let i = 0; i < 7; i++) {
        const realIcon = document.getElementById(`icon-${i}`);
        const realName = document.getElementById(`name-${i}`);
        
        if (realIcon) {
            realIcon.style.backgroundImage = `url('${tempDecorResult.appIcons[i]}')`;
            realIcon.style.backgroundColor = 'transparent';
        }
        if (realName) {
            realName.innerText = tempDecorResult.appNames[i];
        }
    }
    saveAppsData(); // 保存真实 APP 数据
    renderAppEditors(); // 刷新设置里的编辑器
    
    alert("装修已成功应用到你的真实桌面！");
    lsCloseTimeAlbum();
}

// 修复：在初始化时渲染图库
const originalLsLoadData = lsLoadData;
lsLoadData = async function() {
    await originalLsLoadData();
    // 初始化时确保数组存在
    if (!lsState.decorWallpapers) lsState.decorWallpapers = [];
    if (!lsState.decorIcons) lsState.decorIcons = [];
    // 如果之前存的是旧的 decorImages，迁移到壁纸库
    if (lsState.decorImages && lsState.decorImages.length > 0) {
        lsState.decorWallpapers = [...lsState.decorImages];
        delete lsState.decorImages;
        lsSaveData();
    }
};
// ==========================================
// 辅助函数：将图片和评价写入时光相册
// ==========================================
function lsSaveImageToAlbum(imgBase64, comment) {
    const now = new Date();
    const dateStr = `${now.getMonth()+1}.${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    const newEntry = {
        id: Date.now() + Math.random(),
        type: 'chat_saved',
        img: imgBase64,
        date: dateStr,
        userText: '',
        charComment: comment
    };
    
    if (!lsState.timeAlbum) lsState.timeAlbum = [];
    lsState.timeAlbum.unshift(newEntry);
    lsSaveData();
    
    // 如果当前正停留在时光相册页面，实时刷新 UI
    const diaryView = document.getElementById('ta-view-diary');
    if (diaryView && diaryView.classList.contains('active')) {
        lsRenderTimeDiary();
    }
}

