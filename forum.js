async function openForumApp() {
    await forumLoadData();
    document.getElementById('forumModal').classList.add('open');
    forumRenderWindows(); // 👈 新增：渲染顶部窗口列表
    forumSwitchTab('home');
}

function closeForumApp() {
    document.getElementById('forumModal').classList.remove('open');
}

// ==========================================
// 新增：多窗口管理核心逻辑
// ==========================================
function forumRenderWindows() {
    const container = document.getElementById('forum-windows-container');
    if (!container) return;
    container.innerHTML = '';

    forumState.windows.forEach(win => {
        const isActive = win.id === forumState.activeWindowId;
        const div = document.createElement('div');
        div.className = `forum-tab-item ${isActive ? 'active' : ''}`;
        div.onclick = () => forumSwitchWindow(win.id);
        
        div.innerHTML = `
            <svg class="tab-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg>
            <span>${win.name}</span>
            <div class="tab-close" onclick="forumOpenWindowAction(event, '${win.id}')">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
        `;
        container.appendChild(div);
    });

    // 重新添加 + 号按钮
    const addBtn = document.createElement('div');
    addBtn.className = 'add-tab-btn';
    addBtn.innerText = '+';
    addBtn.onclick = forumOpenCreateWindow;
    container.appendChild(addBtn);

    // 滚动到激活的 Tab
    setTimeout(() => {
        const activeTab = container.querySelector('.forum-tab-item.active');
        if (activeTab) {
            // 修复：弃用 scrollIntoView，改用容器内部 scrollTo，彻底解决页面整体左移/偏移的 Bug
            const scrollLeft = activeTab.offsetLeft - (container.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }, 50);
}

function forumSwitchWindow(windowId) {
    if (forumState.activeWindowId === windowId) {
        // 如果点击的是当前窗口，且当前卡在热搜页或书城页，则强制回到主页
        const isSearchActive = document.getElementById('forum-view-search').classList.contains('active');
        const isBookstoreActive = document.getElementById('forum-view-bookstore').classList.contains('active');
        const isBookDetailActive = document.getElementById('forum-view-book-detail').classList.contains('active');
        if (isSearchActive || isBookstoreActive || isBookDetailActive) {
            forumSwitchTab('home');
        }
        return;
    }
    
    forumState.activeWindowId = windowId;
    forumSaveData();
    forumRenderWindows();
    
    // 检查当前是否在热搜页 (search) 或 书城页 (bookstore) 等没有底部高亮Tab的页面
    const isSearchActive = document.getElementById('forum-view-search').classList.contains('active');
    const isBookstoreActive = document.getElementById('forum-view-bookstore').classList.contains('active');
    const isBookDetailActive = document.getElementById('forum-view-book-detail').classList.contains('active');
    
    if (isSearchActive || isBookstoreActive || isBookDetailActive) {
        // 如果在热搜页或书城页点击了窗口，强制跳转回该窗口的 home 页面
        forumSwitchTab('home');
    } else {
        // 否则，保持在当前的底部 Tab (如 home, fanfic, profile)
        const activeTabBtn = document.querySelector('.tab-item.active');
        if (activeTabBtn) {
            const tabId = activeTabBtn.id.replace('forum-tab-', '');
            forumSwitchTab(tabId);
        } else {
            forumSwitchTab('home'); // 兜底
        }
    }
}

function forumOpenCreateWindow() {
    forumState.actionWindowId = null; // null 代表新建
    document.getElementById('forum-window-modal-title').innerText = '创建新窗口';
    document.getElementById('forum-window-name').value = '';
    document.getElementById('forum-window-prompt').value = '';
    wcOpenModal('forum-window-modal');
}

function forumOpenEditWindow() {
    wcCloseModal('forum-window-action-sheet');
    const win = forumState.windows.find(w => w.id === forumState.actionWindowId);
    if (!win) return;
    
    document.getElementById('forum-window-modal-title').innerText = '编辑窗口信息';
    document.getElementById('forum-window-name').value = win.name;
    document.getElementById('forum-window-prompt').value = win.prompt;
    wcOpenModal('forum-window-modal');
}

function forumSaveWindow() {
    const name = document.getElementById('forum-window-name').value.trim();
    const prompt = document.getElementById('forum-window-prompt').value.trim();
    
    if (!name) return alert("请输入窗口名称");

    if (forumState.actionWindowId) {
        // 编辑
        const win = forumState.windows.find(w => w.id === forumState.actionWindowId);
        if (win) {
            win.name = name;
            win.prompt = prompt;
        }
    } else {
        // 新建
        const newId = 'win_' + Date.now();
        forumState.windows.push({ id: newId, name: name, prompt: prompt });
        forumState.activeWindowId = newId; // 自动切换到新窗口
    }

    forumSaveData();
    wcCloseModal('forum-window-modal');
    forumRenderWindows();
    
    // 刷新 URL 显示
    const activeTabBtn = document.querySelector('.tab-item.active');
    if (activeTabBtn) {
        const tabId = activeTabBtn.id.replace('forum-tab-', '');
        forumSwitchTab(tabId);
    }
}

function forumOpenWindowAction(event, windowId) {
    event.stopPropagation(); // 阻止触发切换窗口
    forumState.actionWindowId = windowId;
    wcOpenModal('forum-window-action-sheet');
}

function forumDeleteWindow() {
    if (forumState.windows.length <= 1) {
        return alert("至少需要保留一个窗口哦！");
    }
    if (confirm("确定要删除这个窗口吗？该窗口下的所有帖子也将被删除！")) {
        const winId = forumState.actionWindowId;
        // 删除窗口
        forumState.windows = forumState.windows.filter(w => w.id !== winId);
        // 删除该窗口下的帖子
        forumState.posts = forumState.posts.filter(p => p.windowId !== winId);
        
        // 如果删除的是当前激活的窗口，自动切换到第一个
        if (forumState.activeWindowId === winId) {
            forumState.activeWindowId = forumState.windows[0].id;
        }
        
        forumSaveData();
        wcCloseModal('forum-window-action-sheet');
        forumRenderWindows();
        
        const activeTabBtn = document.querySelector('.tab-item.active');
        if (activeTabBtn) {
            const tabId = activeTabBtn.id.replace('forum-tab-', '');
            forumSwitchTab(tabId);
        }
    }
}

function forumSwitchTab(tab) {
    // 1. 隐藏所有页面和取消所有底部按钮高亮
    document.querySelectorAll('.ins-forum-view').forEach(el => {
        el.classList.remove('active');
        el.style.display = ''; 
    });
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    
    // 👇 新增：切换 Tab 时，确保底部导航栏始终显示（兜底保护）
    const tabbar = document.querySelector('#forum-root .custom-tabbar');
    if (tabbar) tabbar.style.display = 'flex';
    
    // 2. 处理私信页面的特殊逻辑
    if (tab === 'messages') {
        forumOpenPrivateMessages();
    } else {
        const view = document.getElementById(`forum-view-${tab}`);
        if (view) view.classList.add('active');
    }
    
    // 3. 激活对应的底部按钮
    const tabBtn = document.getElementById(`forum-tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('active');
    
    // 4. 渲染对应页面的数据
    if (tab === 'home') {
        forumRenderPosts('home');
    } else if (tab === 'fanfic') {
        forumRenderPosts('fanfic');
    } else if (tab === 'post') {
        document.getElementById('forum-post-user-avatar').src = forumState.profile.avatar;
        document.getElementById('forum-post-user-name').innerText = forumState.profile.name;
    } else if (tab === 'profile') {
        forumRenderProfile();
    } else if (tab === 'search') {
        forumRenderHotSearches(); // 👈 新增
    } else if (tab === 'bookstore') {
        forumRenderBookstore(); // 👈 新增
    }

    // 5. 动态更新顶部电脑浏览器的 URL (跟随当前窗口名称)
    const currentWin = forumState.windows.find(w => w.id === forumState.activeWindowId);
    const winName = currentWin ? currentWin.name : 'Expansion Notice';
    
    let url = `https://forum.local/${encodeURIComponent(winName)}/home`;
    if (tab === 'fanfic') { url = `https://forum.local/${encodeURIComponent(winName)}/fanfic`; }
    else if (tab === 'post') { url = `https://forum.local/${encodeURIComponent(winName)}/compose`; }
    else if (tab === 'messages') { url = `https://forum.local/${encodeURIComponent(winName)}/messages`; }
    else if (tab === 'profile') { url = `https://forum.local/${encodeURIComponent(winName)}/profile`; }
    
    const topUrl = document.getElementById('urlInput'); // 👈 注意这里改成了 urlInput
    if (topUrl) topUrl.value = url;

    // 👇 6. 核心修改：控制右上角按钮的显隐 👇
    const genBtn = document.getElementById('forum-top-btn-generate');
    const setBtn = document.getElementById('forum-top-btn-settings');
    const customFanficBtn = document.getElementById('forum-top-btn-custom-fanfic');
    const genFanficBtn = document.getElementById('forum-top-btn-gen-fanfic');
    const hotSearchBtn = document.getElementById('forum-top-btn-hot-search'); // 👈 获取热搜按钮
    
    if (genBtn && setBtn && customFanficBtn && genFanficBtn) {
        // 先全部隐藏
        genBtn.style.display = 'none';
        setBtn.style.display = 'none';
        customFanficBtn.style.display = 'none';
        genFanficBtn.style.display = 'none';
        if (hotSearchBtn) hotSearchBtn.style.display = 'none'; // 👈 隐藏热搜按钮

        if (tab === 'profile') {
            setBtn.style.display = 'block';
        } else if (tab === 'home') {
            genBtn.style.display = 'block';
            // 👇 核心修改：把直接生成，改成打开我们刚刚写好的弹窗
            genBtn.setAttribute('onclick', `forumOpenGenCountModal('home')`);
        } else if (tab === 'fanfic') {
            // 同人区显示专属的两个按键
            customFanficBtn.style.display = 'block';
            genFanficBtn.style.display = 'block';
        } else if (tab === 'search') {
            // 👈 热搜页专属：只显示热搜刷新按钮，其他按钮保持隐藏
            if (hotSearchBtn) hotSearchBtn.style.display = 'block';
        }
    }
}

// --- 渲染帖子列表 (推特风) ---
function forumRenderPosts(type) {
    const container = document.getElementById(`forum-post-list-${type}`);
    container.innerHTML = '';
    
    // 👈 核心修改：只渲染当前激活窗口的帖子
    const filteredPosts = forumState.posts.filter(p => p.type === type && p.windowId === forumState.activeWindowId).sort((a, b) => b.time - a.time);
    
    if (filteredPosts.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 60px 20px; font-size: 14px; font-style: italic;">这里空空如也<br>点击右上角让 AI 注入灵魂吧</div>';
        return;
    }
    
    filteredPosts.forEach(post => {
        container.appendChild(forumCreatePostElement(post));
    });
}

function forumCreatePostElement(post) {
    const div = document.createElement('div');
    div.className = 'ins-forum-post-card';
    
    const timeStr = new Date(post.time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const isLiked = Array.isArray(post.likes) && post.likes.includes(forumState.profile.name);
    const likeIconFill = isLiked ? '#FF3B30' : 'none';
    const likeIconStroke = isLiked ? '#FF3B30' : '#888';

    const isSaved = Array.isArray(post.saves) && post.saves.includes(forumState.profile.name);
    const saveIconFill = isSaved ? '#111' : 'none';
    const saveIconStroke = isSaved ? '#111' : '#888';

    // 渲染标题
    let titleHtml = '';
    if (post.title) {
        // 增大字号到20px，字重900(最粗)，纯黑色，增加底部间距
        titleHtml = `<div style="font-size: 20px; font-weight: 900; color: #000; margin-bottom: 12px; line-height: 1.4; letter-spacing: 0.5px;">${post.title}</div>`;
    }

    // 渲染图片或占位符
    let imageHtml = '';
    if (post.image) {
        imageHtml = `<img src="${post.image}" class="ins-forum-post-image" onclick="event.stopPropagation(); wcPreviewImage('${post.image}')">`;
    } else if (post.imageDesc) {
        const safeDesc = post.imageDesc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        imageHtml = `<div class="wc-moment-image-placeholder" onclick="event.stopPropagation(); wcOpenImageDescCard('${safeDesc}')" style="margin-top: 12px;"><svg class="wc-icon" style="margin-bottom: 4px; width: 24px; height:24px;" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div style="font-size: 10px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${post.imageDesc}</div></div>`;
    }

    // 如果是同人小说，增加专属 Tag 和排版类名
    let tagHtml = '';
    let textClass = 'ins-forum-post-text';
    let moreOptionsHtml = ''; // 👈 新增
    
    // 核心修复：只要是同人区的帖子，或者带有 isStory 标签，都显示菜单键和排版
    if (post.isStory || post.type === 'fanfic') {
        tagHtml = `<div style="font-size: 12px; color: #AF52DE; background: rgba(175,82,222,0.1); padding: 4px 10px; border-radius: 6px; font-weight: bold; margin-bottom: 12px; display: inline-block;">📖 同人小说</div>`;
        textClass += ' ins-forum-story-text line-clamp-5'; 
        
        // 👈 新增：同人文专属的右上角菜单按钮
        moreOptionsHtml = `
            <div class="ins-forum-more-options" onclick="event.stopPropagation(); forumOpenFanficMenu(${post.id})">
                <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
            </div>
        `;
    }


    // 👇 新增：如果是用户自己发的帖子，且还没有评论，显示 AI 注入按钮 👇
    let aiInjectBtnHtml = '';
    if (post.author.name === forumState.profile.name && (!post.comments || post.comments.length === 0)) {
        aiInjectBtnHtml = `
            <div class="ins-forum-action-btn" onclick="event.stopPropagation(); forumGenerateInteractions(${post.id})" title="让AI注入互动">
                <svg viewBox="0 0 24 24" style="stroke: #AF52DE;"><path d="M21 16.05L15.95 21 4 9.05 9.05 4 21 16.05zM15.95 21l-5.05-5.05M9.05 4l5.05 5.05M13 3l1.5 3.5L18 8l-3.5 1.5L13 13l-1.5-3.5L8 8l3.5-1.5L13 3z"/></svg>
            </div>
        `;
    }
    div.innerHTML = `
        <div class="ins-forum-post-header">
            <img src="${post.author.avatar}" class="ins-forum-avatar-small">
            <div class="ins-forum-post-info">
                <span class="ins-forum-post-name">${post.author.name}</span>
                <span class="ins-forum-post-handle">${post.author.handle || '@' + post.author.name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
                ${aiInjectBtnHtml}
                ${moreOptionsHtml}
            </div>
        </div>
        <div class="ins-forum-post-body" onclick="forumOpenPostDetail(${post.id})">

            ${tagHtml}
            ${titleHtml}
            <div class="${textClass}">${post.content}</div>
            ${imageHtml}
        </div>
        <div class="ins-forum-post-actions">
            <div class="action-btn" onclick="event.stopPropagation(); forumToggleLike(${post.id})">
                <svg viewBox="0 0 24 24" style="fill: ${likeIconFill}; stroke: ${likeIconStroke};"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span style="color: ${isLiked ? '#FF3B30' : '#888'}">${Array.isArray(post.likes) ? post.likes.length : (post.likes || 0)}</span>
            </div>
            <div class="action-btn" onclick="forumOpenPostDetail(${post.id})">
                <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                <span>${post.comments ? post.comments.length : 0}</span>
            </div>
            <div class="action-btn" onclick="event.stopPropagation(); forumOpenShareModal(${post.id})">
                <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </div>
            <div class="action-btn" onclick="event.stopPropagation(); forumToggleSave(${post.id})">
                <svg viewBox="0 0 24 24" style="fill: ${saveIconFill}; stroke: ${saveIconStroke};"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div class="action-btn delete-btn" onclick="event.stopPropagation(); forumDeletePost(${post.id})">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
        </div>
        <div class="post-time">${timeStr}</div>
    `;
    return div;
}

// --- 发布与上传 ---
// 新增：切换图片上传类型
window.forumTogglePostImageType = function(type) {
    forumState.postImageType = type;
    document.getElementById('forum-seg-img-local').classList.toggle('active', type === 'local');
    document.getElementById('forum-seg-img-desc').classList.toggle('active', type === 'desc');
    document.getElementById('forum-area-img-local').style.display = type === 'local' ? 'block' : 'none';
    document.getElementById('forum-area-img-desc').style.display = type === 'desc' ? 'block' : 'none';
};

function forumHandleImageUpload(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            forumState.tempImage = e.target.result;
            document.getElementById('forum-post-image-preview').src = e.target.result;
            document.getElementById('forum-post-image-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function forumSubmitPost() {
    const title = document.getElementById('forum-post-title-input').value.trim();
    const content = document.getElementById('forum-post-input').value.trim();
    const postType = document.getElementById('forum-post-type-select').value; 
    const isAnonymous = document.getElementById('forum-post-anonymous').checked; 
    
    let image = null;
    let imageDesc = null;
    
    if (forumState.postImageType === 'desc') {
        imageDesc = document.getElementById('forum-post-img-desc-input').value.trim();
    } else {
        image = forumState.tempImage;
    }
    
    if (!content && !image && !imageDesc && !title) {
        return alert("请输入内容、标题或上传图片");
    }
    
    let authorName = forumState.profile.name;
    let authorHandle = forumState.profile.handle;
    let authorAvatar = forumState.profile.avatar;

    if (isAnonymous) {
        authorName = "匿名网友";
        authorHandle = "@anonymous";
        const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#E5E5EA"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="30" font-weight="bold">匿</text></svg>`;
        authorAvatar = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(defaultAvatarSvg)));
    }

    const newPost = {
        id: Date.now(),
        windowId: forumState.activeWindowId, // 👈 核心修改：绑定当前窗口ID
        type: postType, 
        isStory: postType === 'fanfic', 
        title: title, 
        author: {
            name: authorName,
            handle: authorHandle,
            avatar: authorAvatar
        },
        content: content,
        image: image,
        imageDesc: imageDesc, // 👈 存入图片描述
        time: Date.now(),
        likes: [], 
        saves: [],
        comments: []
    };
    
    forumState.posts.unshift(newPost);
    forumSaveData();
    
    // 清空所有输入
    document.getElementById('forum-post-title-input').value = '';
    document.getElementById('forum-post-input').value = '';
    document.getElementById('forum-post-img-desc-input').value = '';
    document.getElementById('forum-post-image-preview').style.display = 'none';
    document.getElementById('forum-post-anonymous').checked = false; 
    forumState.tempImage = null;
    if (typeof forumTogglePostImageType === 'function') forumTogglePostImageType('local');
    
    forumSwitchTab(postType); 
}


// --- 互动：点赞、评论、分享 ---
function forumToggleLike(postId) {
    const post = forumState.posts.find(p => p.id === postId);
    if (!post) return;
    
    if (!Array.isArray(post.likes)) post.likes = [];
    const idx = post.likes.indexOf(forumState.profile.name);
    
    if (idx > -1) {
        post.likes.splice(idx, 1);
    } else {
        post.likes.push(forumState.profile.name);
    }
    
    forumSaveData();
    
    if (document.getElementById('forum-view-home').classList.contains('active')) forumRenderPosts('home');
    if (document.getElementById('forum-view-fanfic').classList.contains('active')) forumRenderPosts('fanfic');
    if (document.getElementById('forum-view-profile').classList.contains('active')) forumRenderProfileList();
    if (document.getElementById('forum-post-detail-view').classList.contains('active')) forumRenderPostDetailContent();
}
function forumToggleSave(postId) {
    const post = forumState.posts.find(p => p.id === postId);
    if (!post) return;
    
    if (!Array.isArray(post.saves)) post.saves = [];
    const idx = post.saves.indexOf(forumState.profile.name);
    if (idx > -1) {
        post.saves.splice(idx, 1);
    } else {
        post.saves.push(forumState.profile.name);
    }
    
    forumSaveData();
    
    // 刷新当前视图
    if (document.getElementById('forum-view-home').classList.contains('active')) forumRenderPosts('home');
    if (document.getElementById('forum-view-fanfic').classList.contains('active')) forumRenderPosts('fanfic');
    if (document.getElementById('forum-view-profile').classList.contains('active')) forumRenderProfileList();
    if (document.getElementById('forum-post-detail-view').classList.contains('active')) forumRenderPostDetailContent();
}

function forumOpenPostDetail(postId) {
    forumState.currentDetailPostId = postId;
    document.getElementById('forum-post-detail-view').classList.add('active');
    
    // 👇 新增：进入详情页时隐藏底部导航栏，防止遮挡输入框
    const tabbar = document.querySelector('#forum-root .custom-tabbar');
    if (tabbar) tabbar.style.display = 'none';
    
    forumRenderPostDetailContent();
}

function forumClosePostDetail() {
    document.getElementById('forum-post-detail-view').classList.remove('active');
    forumState.currentDetailPostId = null;
    
    // 👇 新增：退出详情页时恢复显示底部导航栏
    const tabbar = document.querySelector('#forum-root .custom-tabbar');
    if (tabbar) tabbar.style.display = 'flex';
    
    // 关闭详情页时清理回复状态
    if (typeof forumCancelReply === 'function') {
        forumCancelReply();
    }
    
    if (document.getElementById('forum-view-home').classList.contains('active')) forumRenderPosts('home');
    if (document.getElementById('forum-view-fanfic').classList.contains('active')) forumRenderPosts('fanfic');
    if (document.getElementById('forum-view-profile').classList.contains('active')) forumRenderProfileList();
}
// --- 删除帖子逻辑 ---
function forumDeletePost(postId, isFromDetail = false) {
    if (confirm("确定要将这条帖子化作赛博尘埃吗？")) {
        // 从数据中过滤掉该帖子
        forumState.posts = forumState.posts.filter(p => p.id !== postId);
        forumSaveData();
        
        if (isFromDetail) {
            // 如果是在详情页删除的，关闭详情页（关闭时会自动刷新列表）
            forumClosePostDetail();
        } else {
            // 如果是在列表页删除的，直接刷新当前激活的 Tab
            if (document.getElementById('forum-view-home').classList.contains('active')) forumRenderPosts('home');
            if (document.getElementById('forum-view-fanfic').classList.contains('active')) forumRenderPosts('fanfic');
            if (document.getElementById('forum-view-profile').classList.contains('active')) forumRenderProfileList();
        }
    }
}

function forumRenderPostDetailContent() {
    const post = forumState.posts.find(p => p.id === forumState.currentDetailPostId);
    if (!post) return;
    
    const container = document.getElementById('forum-post-detail-content');
    
    const timeStr = new Date(post.time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const isLiked = Array.isArray(post.likes) && post.likes.includes(forumState.profile.name);
    const likeIconFill = isLiked ? '#FF3B30' : 'none';
    const likeIconStroke = isLiked ? '#FF3B30' : '#888';

    const isSaved = Array.isArray(post.saves) && post.saves.includes(forumState.profile.name);
    const saveIconFill = isSaved ? '#111' : 'none';
    const saveIconStroke = isSaved ? '#111' : '#888';
    
    // 渲染标题 (详情页字号更大)
    let titleHtml = '';
    if (post.title) {
        // 增大字号到24px，纯黑色，增加底部间距，并加上一条极浅的分割线与正文彻底区分
        titleHtml = `<div style="font-size: 24px; font-weight: 900; color: #000; margin-bottom: 16px; line-height: 1.4; letter-spacing: 0.5px; border-bottom: 1px solid #F0F0F0; padding-bottom: 12px;">${post.title}</div>`;
    }

    // 渲染图片或占位符
    let imageHtml = '';
    if (post.image) {
        imageHtml = `<img src="${post.image}" class="ins-forum-post-image" style="margin-top: 15px;" onclick="wcPreviewImage('${post.image}')">`;
    } else if (post.imageDesc) {
        const safeDesc = post.imageDesc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        imageHtml = `<div class="wc-moment-image-placeholder" onclick="wcOpenImageDescCard('${safeDesc}')" style="margin-top: 15px;"><svg class="wc-icon" style="margin-bottom: 4px; width: 24px; height:24px;" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div style="font-size: 10px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${post.imageDesc}</div></div>`;
    }

    let tagHtml = '';
    let textClass = 'ins-forum-post-text';
    if (post.isStory) {
        tagHtml = `<div style="font-size: 12px; color: #AF52DE; background: rgba(175,82,222,0.1); padding: 4px 10px; border-radius: 6px; font-weight: bold; margin-bottom: 12px; display: inline-block;">📖 同人小说</div>`;
        textClass += ' ins-forum-story-text'; // 详情页不截断
    }
    
    let commentsHtml = '';
    if (post.comments && post.comments.length > 0) {
        post.comments.forEach(c => {
            // 👇 新增：处理回复文本的高亮显示 👇
            let displayContent = c.content;
            const replyMatch = displayContent.match(/^(回复\s+@[^:]+[:：])\s*(.*)/);
            if (replyMatch) {
                displayContent = `<span style="color: #007AFF; font-weight: 500;">${replyMatch[1]}</span> ${replyMatch[2]}`;
            }

            // 👇 修改：给评论加上点击事件，触发回复 👇
            commentsHtml += `
                <div class="ins-forum-comment-item" onclick="forumPrepareReplyComment('${c.name}')" style="cursor: pointer;">
                    <img src="${c.avatar}" class="ins-forum-avatar-small">
                    <div class="ins-forum-comment-info">
                        <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px;">
                            <span class="ins-forum-comment-name">${c.name}</span>
                            <span class="ins-forum-post-handle">${c.handle || '@'+c.name}</span>
                        </div>
                        <div class="ins-forum-comment-text">${displayContent}</div>
                    </div>
                </div>
            `;
        });
    } else {
        commentsHtml = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">暂无评论，快来抢沙发</div>';
    }

    // 👇 新增：底部 AI 互动按钮 👇
    let aiActionHtml = '';
    if (!post.comments || post.comments.length === 0) {
        aiActionHtml = `
            <div style="text-align: center; padding: 20px 15px;">
                <button class="wc-btn-primary" style="background: #111; color: #FFF; border-radius: 20px; padding: 10px 24px; font-size: 14px; width: auto; margin: 0 auto; display: inline-flex; align-items: center; gap: 8px;" onclick="forumGenerateInteractions(${post.id})">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M21 16.05L15.95 21 4 9.05 9.05 4 21 16.05zM15.95 21l-5.05-5.05M9.05 4l5.05 5.05M13 3l1.5 3.5L18 8l-3.5 1.5L13 13l-1.5-3.5L8 8l3.5-1.5L13 3z"/></svg>
                    让 AI 注入点赞与评论
                </button>
            </div>
        `;
    } else {
        aiActionHtml = `
            <div style="text-align: center; padding: 20px 15px;">
                <button class="wc-btn-primary" style="background: #F5F5F5; color: #111; border: 1px solid #EAEAEA; border-radius: 20px; padding: 10px 24px; font-size: 14px; width: auto; margin: 0 auto; display: inline-flex; align-items: center; gap: 8px;" onclick="forumGenerateMoreComments(${post.id})">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M21 16.05L15.95 21 4 9.05 9.05 4 21 16.05zM15.95 21l-5.05-5.05M9.05 4l5.05 5.05M13 3l1.5 3.5L18 8l-3.5 1.5L13 13l-1.5-3.5L8 8l3.5-1.5L13 3z"/></svg>
                    加载更多 AI 评论
                </button>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="ins-forum-post-header" style="padding: 20px 20px 10px 20px; position: relative;">
            <img src="${post.author.avatar}" class="ins-forum-avatar-small">
            <div class="ins-forum-post-info">
                <span class="ins-forum-post-name">${post.author.name}</span>
                <span class="ins-forum-post-handle">${post.author.handle || '@'+post.author.name}</span>
            </div>
            <!-- 新增：右上角高级感关闭按钮 -->
            <div class="ins-forum-detail-close" onclick="forumClosePostDetail()">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
        </div>
        <div class="ins-forum-post-body" style="padding: 0 20px 20px 20px; border-bottom: 1px solid #F0F0F0;">
            ${tagHtml}
            ${titleHtml}
            <div class="${textClass}" style="font-size: 16px;">${post.content}</div>
            ${imageHtml}
            
            <div class="ins-forum-post-actions" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #F9F9F9;">
                <div class="action-btn" onclick="forumToggleLike(${post.id})">
                    <svg viewBox="0 0 24 24" style="fill: ${likeIconFill}; stroke: ${likeIconStroke};"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    <span style="color: ${isLiked ? '#FF3B30' : '#888'}">${Array.isArray(post.likes) ? post.likes.length : (post.likes || 0)}</span>
                </div>
                <div class="action-btn">
                    <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    <span>${post.comments ? post.comments.length : 0}</span>
                </div>
                <div class="action-btn" onclick="forumOpenShareModal(${post.id})">
                    <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                </div>
                <div class="action-btn" onclick="forumToggleSave(${post.id})">
                    <svg viewBox="0 0 24 24" style="fill: ${saveIconFill}; stroke: ${saveIconStroke};"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div class="action-btn delete-btn" onclick="forumDeletePost(${post.id}, true)">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </div>
            </div>
            <div class="post-time" style="margin-top: 10px;">${timeStr}</div>
        </div>
        <div class="ins-forum-comments-section">
            ${commentsHtml}
            ${aiActionHtml}
        </div>
    `;
}

function forumSubmitComment() {
    const input = document.getElementById('forum-comment-input');
    const text = input.value.trim();
    if (!text) return;
    
    const post = forumState.posts.find(p => p.id === forumState.currentDetailPostId);
    if (!post) return;
    
    let finalContent = text;
    if (forumState.replyingToComment) {
        finalContent = `回复 @${forumState.replyingToComment}: ${text}`;
    }
    
    // 👇 新增：判断是否勾选了匿名评论 👇
    const isAnonymous = document.getElementById('forum-comment-anonymous') && document.getElementById('forum-comment-anonymous').checked;
    let commenterName = forumState.profile.name;
    let commenterHandle = forumState.profile.handle;
    let commenterAvatar = forumState.profile.avatar;

    if (isAnonymous) {
        commenterName = "匿名网友";
        commenterHandle = "@anonymous";
        // 生成一个带“匿”字的默认灰色头像
        const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#E5E5EA"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="30" font-weight="bold">匿</text></svg>`;
        commenterAvatar = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(defaultAvatarSvg)));
    }
    // 👆 新增结束 👆

    if (!post.comments) post.comments = [];
    post.comments.push({
        name: commenterName,       // 👈 使用处理后的名字
        handle: commenterHandle,   // 👈 使用处理后的ID
        avatar: commenterAvatar,   // 👈 使用处理后的头像
        content: finalContent,
        time: Date.now()
    });
    
    forumSaveData();
    input.value = '';
    input.placeholder = "发布评论...";
    forumState.replyingToComment = null; 
    
    // 👇 新增：隐藏回复预览区 👇
    const previewArea = document.getElementById('forum-reply-preview-area');
    if (previewArea) previewArea.style.display = 'none';
    
    // 评论完后自动取消勾选匿名，防止下次忘记关掉
    if (document.getElementById('forum-comment-anonymous')) {
        document.getElementById('forum-comment-anonymous').checked = false;
    }
    
    forumRenderPostDetailContent();
}

// --- 新增：用户评论后，AI 自动回复并概率掉落私信 ---
window.forumTriggerReactionToUser = async function(postId, userCommentText) {
    const post = forumState.posts.find(p => p.id === postId);
    if (!post) return;

    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return;

    // 静默加载，不打断用户浏览
    const loadingToast = document.createElement('div');
    loadingToast.style.cssText = 'position:fixed; top:60px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:#fff; padding:8px 16px; border-radius:20px; font-size:12px; z-index:9999;';
    loadingToast.innerText = '网友正在回复你...';
    document.body.appendChild(loadingToast);

    try {
        let contextInfo = "";
        if (forumState.config.charIds.length > 0) {
            const chars = wcState.characters.filter(c => forumState.config.charIds.includes(c.id.toString()));
            if (chars.length > 0) contextInfo += "【你认识的熟人(NPC)设定】:\n" + chars.map(c => `${c.name}: ${c.prompt}`).join('\n') + "\n\n";
        }
        contextInfo += wcGenerateRelationshipPrompt(forumState.config.charIds); // 注入关系网

        let prompt = `你现在是一个社交论坛的后台引擎。用户（${forumState.profile.name}）刚刚在帖子里发表了一条评论。\n`;
        prompt += `【原帖发帖人】：${post.author.name}\n`;
        prompt += `【原帖标题】：${post.title || '无题'}\n`;
        prompt += `【原帖内容】：\n${post.content}\n\n`;
        prompt += `【用户的评论】：\n${userCommentText}\n\n`;
        prompt += `${contextInfo}`;
        prompt += `【要求】：\n`;
        
        const cMin = forumState.config.commentMin !== undefined ? forumState.config.commentMin : 3;
        const cMax = forumState.config.commentMax !== undefined ? forumState.config.commentMax : 8;
        
        prompt += `1. 请生成 ${cMin} 到 ${cMax} 条其他网友或 NPC 针对用户这条评论的【回复】。\n`;
        prompt += `2. 语气要极度口语化、有网感（如：确实、笑死、抱抱楼主等）。请注意【原帖发帖人】、评论人（User）和回复人之间的身份关系，绝对不要认错人！\n`;
        prompt += `3. 【私信掉落机制】：你有 35% 的概率生成一条发给用户的【私信】（比如有人想私下认识用户、或者 NPC 私下吐槽）。如果不生成私信，请将 privateMessage 设为 null。\n`;
        prompt += `4. 【最高防OOC指令】：你绝对不能以用户的身份（${forumState.profile.name}）发表评论！所有评论人和私信发送人只能是 NPC 或 虚构网友！\n`;
        prompt += `5. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "comments": [
    {"name": "网友名字", "handle": "@ID", "content": "回复 @${forumState.profile.name}: 评论内容"}
  ],
  "privateMessage": {
    "senderName": "发件人名字",
    "content": "私信内容"
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
        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        // 1. 处理追加的评论
        if (result.comments && result.comments.length > 0) {
            const processedComments = result.comments.map(c => {
                const cNpc = wcState.characters.find(char => char.name === c.name);
                return {
                    name: c.name,
                    handle: c.handle || '@' + c.name,
                    avatar: cNpc ? cNpc.avatar : getRandomNpcAvatar(),
                    content: c.content,
                    time: Date.now()
                };
            });
            post.comments.push(...processedComments);
        }

        // 2. 处理掉落的私信
        if (result.privateMessage && result.privateMessage.senderName && result.privateMessage.content) {
            const pm = result.privateMessage;
            const npc = wcState.characters.find(c => c.name === pm.senderName);
            const avatar = npc ? npc.avatar : getRandomNpcAvatar();

            if (!forumState.privateMessages) forumState.privateMessages = [];
            forumState.privateMessages.unshift({
                id: Date.now(),
                senderName: pm.senderName,
                avatar: avatar,
                content: pm.content,
                contextPreview: userCommentText.substring(0, 15) + '...',
                time: Date.now()
            });
            
            if (typeof showMainSystemNotification === 'function') {
                showMainSystemNotification("论坛私信", `收到来自 ${pm.senderName} 的新私信`, avatar);
            }
            
            // 👇 新增：同步 AI 主动发起的私信到主聊天记忆 👇
            if (npc) {
                wcAddMessage(npc.id, 'system', 'system', `[系统内部信息(仅AI可见): 你刚刚在论坛私信里主动给 User 发送了消息: "${pm.content}"]`, { hidden: true });
            }
            // 👆 新增结束 👆
        }

        forumSaveData();
        if (forumState.currentDetailPostId === postId) {
            forumRenderPostDetailContent();
        }

    } catch (e) {
        console.error("AI 回复用户评论失败", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[论坛回复用户失败] ${e.message}`);
    } finally {
        loadingToast.remove();
    }
};

// ==========================================
// 👇 新增：AI 注入互动与加载更多评论逻辑 👇
// ==========================================

window.forumPrepareReplyComment = function(name) {
    forumState.replyingToComment = name;
    const input = document.getElementById('forum-comment-input');
    const previewArea = document.getElementById('forum-reply-preview-area');
    const previewText = document.getElementById('forum-reply-text-content');
    
    if (previewArea && previewText) {
        previewText.innerText = `回复 @${name}`;
        previewArea.style.display = 'flex';
    }
    
    if (input) {
        input.placeholder = `回复 @${name}...`;
        input.focus();
    }
};

// 👇 新增：取消回复功能 👇
window.forumCancelReply = function() {
    forumState.replyingToComment = null;
    const input = document.getElementById('forum-comment-input');
    const previewArea = document.getElementById('forum-reply-preview-area');
    
    if (previewArea) {
        previewArea.style.display = 'none';
    }
    
    if (input) {
        input.placeholder = "发布评论...";
    }
};

window.forumGenerateInteractions = async function(postId) {
    const post = forumState.posts.find(p => p.id === postId);
    if (!post) return;

    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("正在召唤网友...");

    try {
        let contextInfo = "";
        if (forumState.config.worldbookIds.length > 0) {
            const wbs = worldbookEntries.filter(e => forumState.config.worldbookIds.includes(e.id.toString()));
            if (wbs.length > 0) contextInfo += "【世界观背景】:\n" + wbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
        }
        if (forumState.config.charIds.length > 0) {
            const chars = wcState.characters.filter(c => forumState.config.charIds.includes(c.id.toString()));
            if (chars.length > 0) contextInfo += "【你认识的熟人(NPC)设定】:\n" + chars.map(c => `${c.name}: ${c.prompt}`).join('\n') + "\n\n";
        }
        contextInfo += wcGenerateRelationshipPrompt(forumState.config.charIds); // 注入关系网

        const cMin = forumState.config.commentMin !== undefined ? forumState.config.commentMin : 3;
        const cMax = forumState.config.commentMax !== undefined ? forumState.config.commentMax : 8;

        let prompt = `你现在是一个社交论坛的后台引擎。请为以下帖子生成 ${cMin} 到 ${cMax} 条极具“活人感”的评论。\n`;
        prompt += `【原帖发帖人】：${post.author.name}\n`;
        prompt += `【帖子标题】：${post.title || '无题'}\n`;
        prompt += `【帖子内容】：\n${post.content}\n\n`;
        prompt += `${contextInfo}`;
        prompt += `【要求】：\n`;
        prompt += `1. 评论人可以是【你认识的熟人(NPC)】，也可以是虚构的网友。请根据【原帖发帖人】的身份，生成符合逻辑的互动评论，绝对不要把发帖人当成 User（除非发帖人真的是 User）！\n`;
        prompt += `2. 语气要极度口语化、有网感。评论区要有互动感（网友互相回复、吐槽等）。\n`;
        prompt += `3. 【私信掉落机制】：你有 35% 的概率生成一条发给用户的【私信】。如果不生成私信，请将 privateMessage 设为 null。\n`;
        prompt += `4. 【绝对禁止】：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！\n`;
        prompt += `5. 【最高防OOC指令】：你绝对不能以用户的身份（${forumState.profile.name}）发表评论！所有评论人和私信发送人只能是 NPC 或 虚构网友！\n`;
        prompt += `6. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "comments": [
    {"name": "评论人名字", "handle": "@ID", "content": "评论内容"}
  ],
  "privateMessage": {
    "senderName": "发件人名字",
    "content": "私信内容"
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
        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        // 1. 增加点赞和评论
        const newLikes = forumGenerateFakeLikes();
        if (!Array.isArray(post.likes)) post.likes = [];
        post.likes.push(...newLikes);

        if (result.comments && result.comments.length > 0) {
            if (!post.comments) post.comments = [];
            const processedComments = result.comments.map(c => {
                const cNpc = wcState.characters.find(char => char.name === c.name);
                return {
                    name: c.name,
                    handle: c.handle || '@' + c.name,
                    avatar: cNpc ? cNpc.avatar : getRandomNpcAvatar(),
                    content: c.content,
                    time: Date.now()
                };
            });
            post.comments.push(...processedComments);
        }

        // 2. 处理掉落的私信 (升级为会话模式)
        if (result.privateMessage && result.privateMessage.senderName && result.privateMessage.content) {
            const pm = result.privateMessage;
            
            // 核心修复：查找是否已有该人在【当前窗口】的会话
            let chat = forumState.privateChats.find(c => c.targetName === pm.senderName && c.windowId === forumState.activeWindowId);
            const npc = wcState.characters.find(c => c.name === pm.senderName); // 提取 npc 变量
            
            if (!chat) {
                chat = {
                    id: Date.now().toString(),
                    windowId: forumState.activeWindowId, // 👈 绑定当前窗口
                    targetName: pm.senderName,
                    targetAvatar: npc ? npc.avatar : getRandomNpcAvatar(),
                    messages: [],
                    lastUpdateTime: Date.now()
                };
                forumState.privateChats.push(chat);
            }
            
            // 将新消息推入会话
            chat.messages.push({
                id: Date.now(),
                sender: 'them',
                content: pm.content,
                time: Date.now()
            });
            chat.lastUpdateTime = Date.now();
            
            if (typeof showMainSystemNotification === 'function') {
                showMainSystemNotification("论坛私信", `收到来自 ${pm.senderName} 的新私信`, chat.targetAvatar);
            }
            
            // 👇 新增：同步 AI 主动发起的私信到主聊天记忆 👇
            if (npc) {
                wcAddMessage(npc.id, 'system', 'system', `[系统内部信息(仅AI可见): 你刚刚在论坛私信里主动给 User 发送了消息: "${pm.content}"]`, { hidden: true });
            }
            // 👆 新增结束 👆
        }

        forumSaveData();
        forumRenderPostDetailContent();
        if (document.getElementById('forum-view-home').classList.contains('active')) forumRenderPosts('home');
        if (document.getElementById('forum-view-fanfic').classList.contains('active')) forumRenderPosts('fanfic');
        if (document.getElementById('forum-view-profile').classList.contains('active')) forumRenderProfileList();
        
        wcShowSuccess("互动注入成功！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[论坛注入互动失败] ${e.message}`);
        else wcShowError("生成失败");
    }
}

window.forumGenerateMoreComments = async function(postId) {

    const post = forumState.posts.find(p => p.id === postId);
    if (!post) return;

    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("正在加载更多评论...");

    try {
        let contextInfo = "";
        if (forumState.config.worldbookIds.length > 0) {
            const wbs = worldbookEntries.filter(e => forumState.config.worldbookIds.includes(e.id.toString()));
            if (wbs.length > 0) contextInfo += "【世界观背景】:\n" + wbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
        }
        if (forumState.config.charIds.length > 0) {
            const chars = wcState.characters.filter(c => forumState.config.charIds.includes(c.id.toString()));
            if (chars.length > 0) contextInfo += "【你认识的熟人(NPC)设定】:\n" + chars.map(c => `${c.name}: ${c.prompt}`).join('\n') + "\n\n";
        }
        contextInfo += wcGenerateRelationshipPrompt(forumState.config.charIds); // 注入关系网

        const existingComments = (post.comments || []).slice(-10).map(c => `${c.name}: ${c.content}`).join('\n');

        const cMin = forumState.config.commentMin !== undefined ? forumState.config.commentMin : 3;
        const cMax = forumState.config.commentMax !== undefined ? forumState.config.commentMax : 8;

        let prompt = `你现在是一个社交论坛的后台引擎。请为以下帖子继续生成 ${cMin} 到 ${cMax} 条后续评论。\n`;
        prompt += `【原帖发帖人】：${post.author.name}\n`;
        prompt += `【帖子标题】：${post.title || '无题'}\n`;
        prompt += `【帖子内容】：\n${post.content}\n\n`;
        if (existingComments) {
            prompt += `【已有评论上下文】：\n${existingComments}\n\n`;
        }
        prompt += `${contextInfo}`;
        prompt += `【要求】：\n`;
        prompt += `1. 评论人可以是【你认识的熟人(NPC)】，也可以是虚构的网友。请根据【原帖发帖人】和【已有评论上下文】的身份关系进行回复，绝对不要认错人！\n`;
        prompt += `2. 语气要极度口语化、有网感。可以针对【已有评论上下文】进行回复（如：回复 @某某）。\n`;
        prompt += `3. 【私信掉落机制】：你有 35% 的概率生成一条发给用户的【私信】。如果不生成私信，请将 privateMessage 设为 null。\n`;
        prompt += `4. 【最高防OOC指令】：你绝对不能以用户的身份（${forumState.profile.name}）发表评论！所有评论人和私信发送人只能是 NPC 或 虚构网友！\n`;
        prompt += `5. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "comments": [
    {"name": "评论人名字", "handle": "@ID", "content": "评论内容"}
  ],
  "privateMessage": {
    "senderName": "发件人名字",
    "content": "私信内容"
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
        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        // 1. 处理追加的评论
        if (result.comments && result.comments.length > 0) {
            if (!post.comments) post.comments = [];
            const processedComments = result.comments.map(c => {
                const cNpc = wcState.characters.find(char => char.name === c.name);
                return {
                    name: c.name,
                    handle: c.handle || '@' + c.name,
                    avatar: cNpc ? cNpc.avatar : getRandomNpcAvatar(),
                    content: c.content,
                    time: Date.now()
                };
            });
            post.comments.push(...processedComments);
        }

        // 2. 处理掉落的私信 (升级为会话模式)
        if (result.privateMessage && result.privateMessage.senderName && result.privateMessage.content) {
            const pm = result.privateMessage;
            
            // 核心修复：查找是否已有该人在【当前窗口】的会话
            let chat = forumState.privateChats.find(c => c.targetName === pm.senderName && c.windowId === forumState.activeWindowId);
            const npc = wcState.characters.find(c => c.name === pm.senderName); // 提取 npc 变量
            
            if (!chat) {
                chat = {
                    id: Date.now().toString(),
                    windowId: forumState.activeWindowId, // 👈 绑定当前窗口
                    targetName: pm.senderName,
                    targetAvatar: npc ? npc.avatar : getRandomNpcAvatar(),
                    messages: [],
                    lastUpdateTime: Date.now()
                };
                forumState.privateChats.push(chat);
            }
            
            // 将新消息推入会话
            chat.messages.push({
                id: Date.now(),
                sender: 'them',
                content: pm.content,
                time: Date.now()
            });
            chat.lastUpdateTime = Date.now();
            
            if (typeof showMainSystemNotification === 'function') {
                showMainSystemNotification("论坛私信", `收到来自 ${pm.senderName} 的新私信`, chat.targetAvatar);
            }
            
            // 👇 新增：同步 AI 主动发起的私信到主聊天记忆 👇
            if (npc) {
                wcAddMessage(npc.id, 'system', 'system', `[系统内部信息(仅AI可见): 你刚刚在论坛私信里主动给 User 发送了消息: "${pm.content}"]`, { hidden: true });
            }
            // 👆 新增结束 👆
        }

        forumSaveData();
        forumRenderPostDetailContent();
        if (document.getElementById('forum-view-home').classList.contains('active')) forumRenderPosts('home');
        if (document.getElementById('forum-view-fanfic').classList.contains('active')) forumRenderPosts('fanfic');
        if (document.getElementById('forum-view-profile').classList.contains('active')) forumRenderProfileList();
        
        wcShowSuccess("评论加载成功！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[论坛加载评论失败] ${e.message}`);
        else wcShowError("生成失败");
    }
};
// --- 分享帖子给 Char ---
function forumOpenShareModal(postId) {
    forumState.pendingSharePostId = postId;
    const list = document.getElementById('forum-share-char-list');
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
                <button class="wc-btn-mini" style="background:#111; color:white; border:none; padding:6px 16px; border-radius:16px; font-weight:bold;" onclick="forumConfirmShare(${char.id})">发送</button>
            `;
            list.appendChild(div);
        });
    }
    wcOpenModal('forum-modal-share');
}

function forumConfirmShare(charId) {
    const post = forumState.posts.find(p => p.id === forumState.pendingSharePostId);
    if (!post) return;

    // 构造高级感分享卡片
    const cardHtml = `
        <div class="chat-shared-card">
            <div class="shared-card-tag">FORUM POST</div>
            <div class="shared-card-title">${post.author.name} 的帖子</div>
            <div class="shared-card-content">${post.content}</div>
        </div>
    `;

    // 发送卡片到聊天
    wcAddMessage(charId, 'me', 'receipt', cardHtml);

    // 👇 新增：提取评论内容 👇
    let commentsStr = "无";
    if (post.comments && post.comments.length > 0) {
        commentsStr = post.comments.map(c => `${c.name}: ${c.content}`).join(' | ');
    }

    // 给 AI 发送隐藏的系统提示 (包含评论)
    const aiPrompt = `[系统内部信息(仅AI可见): 用户在论坛看到了一篇帖子并分享给了你。发帖人：${post.author.name}。内容：“${post.content}”。该帖子的评论区：[${commentsStr}]。请在回复中针对这篇帖子或评论发表你的看法或吐槽。]`;
    wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });

    wcCloseModal('forum-modal-share');
    alert("已成功分享给 Ta！快去微信看看 Ta 的反应吧~");
}

// --- 个人信息与设置 (推特风重构) ---
function forumRenderProfile() {
    // 渲染背景图和头像
    const bgEl = document.getElementById('forum-profile-bg');
    if (forumState.profile.bg) {
        bgEl.style.backgroundImage = `url('${forumState.profile.bg}')`;
    } else {
        bgEl.style.backgroundImage = `url('https://i.postimg.cc/kgD9CsbW/IMG-8012.jpg')`; // 默认图
    }
    
    document.getElementById('forum-profile-avatar').src = forumState.profile.avatar;
    document.getElementById('forum-profile-name').innerText = forumState.profile.name;
    document.getElementById('forum-profile-handle').innerText = forumState.profile.handle;
    document.getElementById('forum-profile-bio').innerText = forumState.profile.bio;
    
    // 随机生成关注数 (仅作装饰)
    document.getElementById('forum-following-count').innerText = Math.floor(Math.random() * 50) + 10;
    document.getElementById('forum-follower-count').innerText = Math.floor(Math.random() * 500) + 50;
    
    forumSwitchProfileTab(forumState.profileTab);
}

function forumSwitchProfileTab(tab) {
    forumState.profileTab = tab;
    document.querySelectorAll('.ins-forum-profile-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`forum-profile-tab-${tab}`).classList.add('active');
    forumRenderProfileList();
}

function forumRenderProfileList() {
    const container = document.getElementById('forum-my-post-list');
    container.innerHTML = '';
    
    let list = [];
    
    if (forumState.profileTab === 'posts') {
        // 发布的帖子：与当前窗口独立
        list = forumState.posts.filter(p => p.author.name === forumState.profile.name && p.windowId === forumState.activeWindowId);
    } else if (forumState.profileTab === 'likes') {
        // 点赞的帖子：与当前窗口独立
        list = forumState.posts.filter(p => Array.isArray(p.likes) && p.likes.includes(forumState.profile.name) && p.windowId === forumState.activeWindowId);
    } else if (forumState.profileTab === 'saves') {
        // 核心修改：收藏的帖子是全局的！去掉 windowId 的限制
        list = forumState.posts.filter(p => Array.isArray(p.saves) && p.saves.includes(forumState.profile.name));
    }

    list.sort((a, b) => b.time - a.time);
    
    if (list.length === 0) {
        const emptyText = forumState.profileTab === 'saves' ? '暂无收藏的帖子' : '当前频道空空如也';
        container.innerHTML = `<div style="text-align: center; color: #888; padding: 60px 20px; font-size: 14px; font-style: italic;">${emptyText}</div>`;
        return;
    }
    
    list.forEach(post => {
        container.appendChild(forumCreatePostElement(post));
    });
}

function forumOpenEditProfile() {
    document.getElementById('forum-edit-name').value = forumState.profile.name;
    document.getElementById('forum-edit-handle').value = forumState.profile.handle;
    document.getElementById('forum-edit-bio').value = forumState.profile.bio;
    
    document.getElementById('forum-edit-avatar-url').value = '';
    document.getElementById('forum-edit-bg-url').value = '';
    
    forumState.tempAvatar = null;
    forumState.tempProfileBg = null;

    // 填充面具下拉框
    const maskSelect = document.getElementById('forum-edit-mask-select');
    if (maskSelect) {
        maskSelect.innerHTML = '<option value="">默认身份 (User)</option>';
        wcState.masks.forEach(m => {
            const isSelected = forumState.profile.boundMaskId == m.id ? 'selected' : '';
            maskSelect.innerHTML += `<option value="${m.id}" ${isSelected}>扮演: ${m.name}</option>`;
        });
    }

    wcOpenModal('forum-modal-edit-profile');
}

// 统一处理头像和背景图的本地上传
function forumHandleImageUploadForProfile(input, type) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (type === 'avatar') {
                forumState.tempAvatar = e.target.result;
                document.getElementById('forum-edit-avatar-url').value = '已选择本地图片';
            } else if (type === 'bg') {
                forumState.tempProfileBg = e.target.result;
                document.getElementById('forum-edit-bg-url').value = '已选择本地图片';
            }
        };
        reader.readAsDataURL(file);
    }
}

// 新增：切换面具时自动同步名称到输入框
function forumHandleMaskChange(maskId) {
    if (!maskId) {
        document.getElementById('forum-edit-name').value = wcState.user.name;
    } else {
        const mask = wcState.masks.find(m => m.id == maskId);
        if (mask) {
            document.getElementById('forum-edit-name').value = mask.name;
        }
    }
}

function forumSaveProfile() {
    const name = document.getElementById('forum-edit-name').value.trim();
    const handle = document.getElementById('forum-edit-handle').value.trim();
    const bio = document.getElementById('forum-edit-bio').value.trim();
    
    const avatarUrl = document.getElementById('forum-edit-avatar-url').value.trim();
    const bgUrl = document.getElementById('forum-edit-bg-url').value.trim();
    const maskId = document.getElementById('forum-edit-mask-select').value;

    // 1. 处理面具绑定
    if (!maskId) {
        forumState.profile.boundMaskId = null;
        forumState.profile.name = name || wcState.user.name;
        // 如果没有填新的头像，才恢复默认头像
        if (!avatarUrl && !forumState.tempAvatar) {
            forumState.profile.avatar = wcState.user.avatar;
        }
    } else {
        const mask = wcState.masks.find(m => m.id == maskId);
        if (mask) {
            forumState.profile.boundMaskId = mask.id;
            // 【修改点】：优先使用输入框的 name，如果为空才使用面具的 name
            forumState.profile.name = name || mask.name;
            // 如果没有填新的头像，才使用面具头像
            if (!avatarUrl && !forumState.tempAvatar) {
                forumState.profile.avatar = mask.avatar;
            }
        }
    }

    // 2. 处理手动修改的名称和签名
    // 【修改点】：去掉了 !maskId 的限制，让选择面具时也能修改名称
    if (name) forumState.profile.name = name;
    if (handle) forumState.profile.handle = handle.startsWith('@') ? handle : '@' + handle;
    if (bio) forumState.profile.bio = bio;
    
    // 3. 处理头像更新 (URL 优先，本地其次)
    if (avatarUrl && avatarUrl !== '已选择本地图片') {
        forumState.profile.avatar = avatarUrl;
    } else if (forumState.tempAvatar) {
        forumState.profile.avatar = forumState.tempAvatar;
    }
    
    // 4. 处理背景图更新
    if (bgUrl && bgUrl !== '已选择本地图片') {
        forumState.profile.bg = bgUrl;
    } else if (forumState.tempProfileBg) {
        forumState.profile.bg = forumState.tempProfileBg;
    }
    
    forumState.tempAvatar = null;
    forumState.tempProfileBg = null;
    
    forumSaveData();
    forumRenderProfile();
    wcCloseModal('forum-modal-edit-profile');
}
function forumOpenSettings() {
    // 渲染世界书列表
    const wbList = document.getElementById('forum-setting-wb-list');
    wbList.innerHTML = '';
    let forumWbCount = 0;
    if (forumState.config.worldbookIds) {
        forumState.config.worldbookIds.forEach(id => {
            wbList.innerHTML += `<input type="checkbox" value="${id}" class="forum-wb-cb" checked>`;
            forumWbCount++;
        });
    }
    document.getElementById('forum-setting-wb-count').innerText = `已选 ${forumWbCount} 项`;

    // 渲染角色列表
    const charList = document.getElementById('forum-setting-char-list');
    charList.innerHTML = '';
    wcState.characters.filter(c => !c.isGroup).forEach(char => {
        const isChecked = forumState.config.charIds.includes(char.id.toString());
        charList.innerHTML += `<div class="wc-checkbox-item"><input type="checkbox" value="${char.id}" class="forum-char-cb" ${isChecked ? 'checked' : ''}><span>${char.name}</span></div>`;
    });

    // 渲染面具列表
    const maskList = document.getElementById('forum-setting-mask-list');
    maskList.innerHTML = '';
    wcState.masks.forEach(mask => {
        const isChecked = forumState.config.maskIds.includes(mask.id.toString());
        maskList.innerHTML += `<div class="wc-checkbox-item"><input type="checkbox" value="${mask.id}" class="forum-mask-cb" ${isChecked ? 'checked' : ''}><span>${mask.name}</span></div>`;
    });

    wcOpenModal('forum-modal-settings');
}

function forumSaveSettings() {
    const wbCbs = document.querySelectorAll('.forum-wb-cb:checked');
    forumState.config.worldbookIds = Array.from(wbCbs).map(cb => cb.value);

    const charCbs = document.querySelectorAll('.forum-char-cb:checked');
    forumState.config.charIds = Array.from(charCbs).map(cb => cb.value);

    const maskCbs = document.querySelectorAll('.forum-mask-cb:checked');
    forumState.config.maskIds = Array.from(maskCbs).map(cb => cb.value);

    forumSaveData();
    wcCloseModal('forum-modal-settings');
    alert("设定已保存！AI 生成帖子时将参考这些背景。");
}

// --- 核心：高强度活人感 AI 生成 (8帖 + 6评 + 绝对禁止生成User + 覆盖未收藏的旧帖) ---
async function forumGenerateAIPosts(type, min = 6, max = 10, selectedPostIds = [], keepPosts = false) {
    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在刷新高浓度活人动态...");

    try {
        if (!keepPosts) {
            forumState.posts = forumState.posts.filter(p => {
                if (p.type !== type) return true;
                if (p.windowId !== forumState.activeWindowId) return true; // 修复：只清理当前窗口的帖子
                if (p.author.name === forumState.profile.name) return true;
                if (Array.isArray(p.likes) && p.likes.includes(forumState.profile.name)) return true;
                if (Array.isArray(p.saves) && p.saves.includes(forumState.profile.name)) return true;
                return false;
            });
        }

        let contextInfo = "";
        const currentWin = forumState.windows.find(w => w.id === forumState.activeWindowId);
        if (currentWin && currentWin.prompt) {
            contextInfo += `【当前论坛板块专属背景设定 (${currentWin.name})】:\n${currentWin.prompt}\n\n`;
        }
        
        if (forumState.config.worldbookIds.length > 0) {
            const wbs = worldbookEntries.filter(e => forumState.config.worldbookIds.includes(e.id.toString()));
            if (wbs.length > 0) {
                contextInfo += "【世界观背景】:\n" + wbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
            }
        }
        
        let npcNames = [];
        if (forumState.config.charIds.length > 0) {
            const chars = wcState.characters.filter(c => forumState.config.charIds.includes(c.id.toString()));
            if (chars.length > 0) {
                contextInfo += "【你认识的熟人(NPC)设定】:\n" + chars.map(c => {
                    npcNames.push(c.name);
                    return `${c.name}: ${c.prompt}`;
                }).join('\n') + "\n\n";
            }
        }
        contextInfo += wcGenerateRelationshipPrompt(forumState.config.charIds); // 注入关系网

        let userNames = [forumState.profile.name, wcState.user.name];
        if (forumState.config.maskIds.length > 0) {
            const masks = wcState.masks.filter(m => forumState.config.maskIds.includes(m.id.toString()));
            if (masks.length > 0) {
                contextInfo += "【关于我(User)的设定/马甲】:\n" + masks.map(m => {
                    userNames.push(m.name);
                    return `${m.name}: ${m.prompt}`;
                }).join('\n') + "\n\n";
            }
        }

        // 👇 新增：注入选中的特定帖子作为上下文 (包含评论) 👇
        if (selectedPostIds && selectedPostIds.length > 0) {
            const associatedPosts = forumState.posts.filter(p => selectedPostIds.includes(p.id));
            if (associatedPosts.length > 0) {
                contextInfo += "【当前频道已有帖子参考（请根据这些帖子的话题、氛围或评论区的讨论进行延伸或互动）】:\n";
                associatedPosts.forEach(p => {
                    let commentsStr = "无";
                    if (p.comments && p.comments.length > 0) {
                        // 提取前 10 条评论，防止 Token 爆炸
                        commentsStr = p.comments.slice(0, 10).map(c => `${c.name}: ${c.content}`).join(' | ');
                    }
                    contextInfo += `标题: ${p.title || '无题'}\n内容: ${p.content.substring(0, 200)}...\n评论区: [${commentsStr}]\n\n`;
                });
            }
        }
        // 👆 新增结束 👆

        let prompt = `你现在是一个社交论坛的后台引擎。请生成一批极具“活人感”的论坛帖子和评论。\n`;
        if (type === 'home') {
            prompt += `论坛类型：日常主页。内容是生活吐槽、情感分享、日常记录、发疯文学等。\n`;
        } else {
            prompt += `论坛类型：同人论坛。内容是关于某些角色（可以是设定的NPC或虚构人物）的同人段子、脑洞、CP向发言、泥塑等。\n`;
        }
        
        prompt += `\n${contextInfo}`;
        
        const cMin = forumState.config.commentMin !== undefined ? forumState.config.commentMin : 3;
        const cMax = forumState.config.commentMax !== undefined ? forumState.config.commentMax : 8;

        prompt += `【核心强制要求（最高优先级）】：\n`;
        prompt += `1. 数量要求：必须一次性生成 ${min} 到 ${max} 条帖子！每条帖子必须包含 ${cMin} 到 ${cMax} 条评论！(减少数量防止截断)\n`;
        prompt += `2. 角色穿插：发帖人和评论人中，必须穿插出现【你认识的熟人(NPC)】（如果有的话：${npcNames.join(', ')}），以及大量虚构的网友。请严格根据【全局角色关系网设定】来决定他们之间的互动态度（如：情侣会秀恩爱，仇人会互怼）。\n`;
        prompt += `3. 活人感：语气要极度口语化、有网感（如：笑死、救命、谁懂啊、破防了）。评论区要有互动感（网友互相回复、楼主回复网友）。\n`;
        prompt += `4. 【绝对禁止扮演用户】：上面提供的【关于我(User)的设定/马甲】仅供你作为背景参考（NPC可以发关于User的帖子或吐槽User）。但是，你绝对不能以 User（${userNames.join('、')}）的身份发帖或评论！User 会自己操作，不需要你代劳！所有发帖人和评论人只能是 NPC 或 虚构网友！\n`;                
        prompt += `5. 【身份隔离警告】：在生成 comments 时，必须清楚认知该帖子的 authorName 是谁！不要让 NPC 误以为帖子是 User 发的，除非帖子内容明确提到了 User！\n`;
        prompt += `6. 【绝对禁止】：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！\n`;
        prompt += `7. 返回纯 JSON 数组，格式如下：\n`;
        prompt += `[
  {
    "title": "帖子标题(必须有，吸引眼球)",
    "authorName": "发帖人名字(NPC或网友)",
    "handle": "@英文ID",
    "content": "帖子的正文内容...",
    "comments": [
      {"name": "评论人名字", "handle": "@ID", "content": "评论内容"}
    ]
  }
]\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.9 
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let generatedPosts = [];
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
            generatedPosts = JSON.parse(tempContent);
        } catch (e) {
            console.warn("JSON 解析失败，启用终极碎片提取模式兜底", e);
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
                                if (typeof obj === 'object' && obj !== null) extracted.push(obj);
                            } catch(err) {}
                            start = -1;
                        }
                    }
                }
            }
            if (extracted.length > 0) {
                generatedPosts = extracted;
            } else {
                throw new Error("JSON 解析彻底失败，AI 输出的内容过于混乱。");
            }
        }

        generatedPosts.forEach(p => {
            let finalAuthorName = p.authorName;
            if (userNames.includes(finalAuthorName)) {
                finalAuthorName = "匿名网友" + Math.floor(Math.random() * 10000);
            }

            const npc = wcState.characters.find(c => c.name === finalAuthorName);
            const avatar = npc ? npc.avatar : getRandomNpcAvatar();
            
            const processedComments = (p.comments || []).map(c => {
                let finalCommentName = c.name;
                if (userNames.includes(finalCommentName)) {
                    finalCommentName = "热心网友" + Math.floor(Math.random() * 10000);
                }
                const cNpc = wcState.characters.find(char => char.name === finalCommentName);
                return {
                    name: finalCommentName,
                    handle: c.handle || '@' + finalCommentName,
                    avatar: cNpc ? cNpc.avatar : getRandomNpcAvatar(),
                    content: c.content,
                    time: Date.now() - Math.floor(Math.random() * 3600000)
                };
            });

            forumState.posts.unshift({
                id: Date.now() + Math.random(),
                windowId: forumState.activeWindowId,
                type: type,
                title: p.title || '', // 确保保存标题
                author: {
                    name: finalAuthorName,
                    handle: p.handle || '@' + finalAuthorName,
                    avatar: avatar
                },
                content: p.content,
                image: null,
                time: Date.now() - Math.floor(Math.random() * 3600000),
                likes: forumGenerateFakeLikes(), 
                saves: [],
                comments: processedComments
            });
        });

        forumSaveData();
        forumRenderPosts(type);
        wcShowSuccess("刷新成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[论坛刷新失败] ${e.message}`);
        else wcShowError("刷新失败，可能生成内容过长");
    }
}

// ==========================================
// 同人文书城生成逻辑 (Fanfic Generator)
// ==========================================

// --- 打开同人文设定弹窗 ---
async function forumOpenGenFanficModal() {
    // 👇 新增：强制加载梦境数据，确保能读到你在聊天更多面板(梦境)里保存的预设
    if (typeof dreamLoadData === 'function') {
        await dreamLoadData();
    }

    // 1. 填充文风预设 (读取梦境预设)
    const styleSelect = document.getElementById('fanfic-style-select');
    styleSelect.innerHTML = '<option value="">默认文风 (细腻/意识流)</option>';
    if (typeof dreamState !== 'undefined' && dreamState.presets) {
        dreamState.presets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.content; // 直接把内容作为 value
            opt.innerText = p.name;
            styleSelect.appendChild(opt);
        });
    }

    // 2. 填充角色 A 和 B
    const charASelect = document.getElementById('fanfic-char-a');
    const charBSelect = document.getElementById('fanfic-char-b');
    
    let charOptionsHtml = '<option value="">随机/不指定</option>';
    charOptionsHtml += `<option value="${wcState.user.name} (User)">${wcState.user.name} (我)</option>`;
    
    wcState.characters.filter(c => !c.isGroup).forEach(c => {
        charOptionsHtml += `<option value="${c.name}">${c.name}</option>`;
    });
    
    wcState.masks.forEach(m => {
        charOptionsHtml += `<option value="${m.name} (我的马甲)">${m.name} (面具)</option>`;
    });

    charASelect.innerHTML = charOptionsHtml;
    charBSelect.innerHTML = charOptionsHtml;

    // 3. 恢复已保存的设定
    styleSelect.value = forumState.config.fanficStyle || '';
    charASelect.value = forumState.config.fanficCharA || '';
    charBSelect.value = forumState.config.fanficCharB || '';
    document.getElementById('fanfic-trope-input').value = forumState.config.fanficTrope || '';

    wcOpenModal('forum-modal-gen-fanfic');
}

// --- 保存同人文设定 ---
function forumSaveFanficSettings() {
    forumState.config.fanficStyle = document.getElementById('fanfic-style-select').value;
    forumState.config.fanficCharA = document.getElementById('fanfic-char-a').value;
    forumState.config.fanficCharB = document.getElementById('fanfic-char-b').value;
    forumState.config.fanficTrope = document.getElementById('fanfic-trope-input').value.trim();

    forumSaveData();
    wcCloseModal('forum-modal-gen-fanfic');
    alert("同人文设定已保存！点击右上角闪电图标即可一键生成。");
}

// --- 一键生成同人文 ---
function forumDirectGenFanfic(min = 2, max = 3, selectedPostIds = [], keepPosts = false) {
    const charA = forumState.config.fanficCharA || '随机角色A';
    const charB = forumState.config.fanficCharB || '随机角色B';
    const trope = forumState.config.fanficTrope || '随机日常/发疯脑洞';
    const style = forumState.config.fanficStyle || '极具高级感、日系/韩系文艺风、意识流、细腻且克制。';

    // 尝试查找性别
    let genderA = ''; let genderB = '';
    const findGender = (name) => {
        if (name.includes('(User)') || name.includes('(我)')) return wcState.user.gender || '';
        const c = wcState.characters.find(ch => name.includes(ch.name));
        if (c && c.gender) return c.gender;
        const m = wcState.masks.find(mk => name.includes(mk.name));
        if (m && m.gender) return m.gender;
        return '';
    };
    genderA = findGender(charA);
    genderB = findGender(charB);

    let basePrompt = `你现在是一个同人论坛的驻站神仙太太（同人文作者）。\n`;
    basePrompt += `请根据以下设定，创作同人文：\n`;
    basePrompt += `【主角 A】：${charA} ${genderA ? '(性别:'+genderA+')' : ''}\n`;
    basePrompt += `【主角 B】：${charB} ${genderB ? '(性别:'+genderB+')' : ''}\n`;
    basePrompt += `【小说类型/梗】：${trope}\n`;
    basePrompt += `【文风要求】：${style}\n`;

    // 附加世界书和角色设定作为背景参考
    let contextInfo = "";
    
    // 👇 核心修改：读取当前窗口的专属世界观设定 👇
    const currentWin = forumState.windows.find(w => w.id === forumState.activeWindowId);
    if (currentWin && currentWin.prompt) {
        contextInfo += `【当前论坛板块专属背景设定 (${currentWin.name})】:\n${currentWin.prompt}\n\n`;
    }

    if (forumState.config.worldbookIds.length > 0) {
        const wbs = worldbookEntries.filter(e => forumState.config.worldbookIds.includes(e.id.toString()));
        if (wbs.length > 0) {
            contextInfo += "【世界观背景参考】:\n" + wbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
        }
    }
    if (forumState.config.charIds.length > 0) {
        const chars = wcState.characters.filter(c => forumState.config.charIds.includes(c.id.toString()));
        if (chars.length > 0) {
            contextInfo += "【角色性格参考】:\n" + chars.map(c => `${c.name}: ${c.prompt}`).join('\n') + "\n\n";
        }
    }

    // 👇 新增：注入选中的特定同人文作为上下文 (包含评论) 👇
    if (selectedPostIds && selectedPostIds.length > 0) {
        const associatedPosts = forumState.posts.filter(p => selectedPostIds.includes(p.id));
        if (associatedPosts.length > 0) {
            contextInfo += "【当前频道已有同人文参考（请根据这些文章的剧情、设定或读者评论进行续写或延伸）】:\n";
            associatedPosts.forEach(p => {
                let commentsStr = "无";
                if (p.comments && p.comments.length > 0) {
                    // 提取前 10 条评论，防止 Token 爆炸
                    commentsStr = p.comments.slice(0, 10).map(c => `${c.name}: ${c.content}`).join(' | ');
                }
                contextInfo += `标题: ${p.title || '无题'}\n内容: ${p.content.substring(0, 200)}...\n读者评论: [${commentsStr}]\n\n`;
            });
        }
    }
    // 👆 新增结束 👆

    if (contextInfo) {
        basePrompt += `\n${contextInfo}`;
    }

    _executeGenFanfic(basePrompt, min, max, keepPosts);
}

// 内部核心：执行同人文 API 请求 (覆盖未收藏的旧文)
async function _executeGenFanfic(basePrompt, min = 2, max = 3, keepPosts = false) {
    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在生成同人文，请耐心等待...");

    try {
        if (!keepPosts) {
            forumState.posts = forumState.posts.filter(p => {
                if (p.type !== 'fanfic') return true;
                if (p.windowId !== forumState.activeWindowId) return true; // 修复：只清理当前窗口的帖子
                if (p.author.name === forumState.profile.name) return true;
                if (Array.isArray(p.likes) && p.likes.includes(forumState.profile.name)) return true;
                if (Array.isArray(p.saves) && p.saves.includes(forumState.profile.name)) return true;
                return false;
            });
        }

        const cMin = forumState.config.commentMin !== undefined ? forumState.config.commentMin : 3;
        const cMax = forumState.config.commentMax !== undefined ? forumState.config.commentMax : 8;

        let prompt = basePrompt;
        prompt += `\n【核心强制要求（最高优先级）】：\n`;
        prompt += `1. 数量与长度：必须一次性生成 ${min} 至 ${max} 篇不同视角的同人文！为了防止输出截断，每篇字数控制在 500-800 字左右，但必须保证故事结构完整！\n`;
        prompt += `2. 评论互动：每篇小说必须附带 ${cMin} 到 ${cMax} 条读者评论（虚构的网友名字），评论要像真实的追更读者（如：太太饿饿饭饭、神仙绝美爱情、刀死我了等）。\n`;
        prompt += `3. 【绝对禁止】：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！\n`;
        prompt += `4. 返回纯 JSON 数组，格式如下：\n`;
        prompt += `[
  {
    "title": "同人文标题(必须有)",
    "authorName": "虚构的作者笔名",
    "handle": "@作者ID",
    "content": "小说的正文内容（支持使用 \\n 换行排版）...",
    "comments": [
      {"name": "读者A", "handle": "@ID", "content": "评论内容"}
    ]
  }
]\n`;

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
        
        let generatedPosts = [];
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
            generatedPosts = JSON.parse(tempContent);
        } catch (e) {
            console.warn("JSON 解析失败，启用终极碎片提取模式兜底", e);
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
                                if (typeof obj === 'object' && obj !== null) extracted.push(obj);
                            } catch(err) {}
                            start = -1;
                        }
                    }
                }
            }
            if (extracted.length > 0) {
                generatedPosts = extracted;
            } else {
                throw new Error("JSON 解析彻底失败，AI 输出的内容过于混乱。");
            }
        }

        generatedPosts.forEach(p => {
            const processedComments = (p.comments || []).map(c => ({
                name: c.name,
                handle: c.handle || '@' + c.name,
                avatar: getRandomNpcAvatar(),
                content: c.content,
                time: Date.now() - Math.floor(Math.random() * 3600000)
            }));

            forumState.posts.unshift({
                id: Date.now() + Math.random(),
                windowId: forumState.activeWindowId,
                type: 'fanfic',
                isStory: true, 
                title: p.title || '无题', // 确保保存标题
                author: {
                    name: p.authorName,
                    handle: p.handle || '@' + p.authorName,
                    avatar: getRandomNpcAvatar()
                },
                content: p.content,
                image: null,
                time: Date.now(),
                likes: forumGenerateFakeLikes(), 
                saves: [],
                comments: processedComments
            });
        });

        forumSaveData();
        forumRenderPosts('fanfic');
        wcShowSuccess("神仙太太更新啦！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[同人文生成失败] ${e.message}`);
        else wcShowError("生成失败，可能是字数太多导致截断");
    }
}
// ==========================================
// 论坛新增：生成数量弹窗逻辑 (范围版)
// ==========================================
let forumPendingGenType = '';

function forumOpenGenCountModal(type) {
    forumPendingGenType = type;
    const titleEl = document.getElementById('forum-gen-count-title');
    const minInput = document.getElementById('forum-gen-count-min');
    const maxInput = document.getElementById('forum-gen-count-max');
    
    if (type === 'home') {
        titleEl.innerText = '生成主页帖子';
        minInput.value = 6;
        maxInput.value = 10;
    } else if (type === 'fanfic') {
        titleEl.innerText = '生成同人文';
        minInput.value = 2;
        maxInput.value = 3;
    }
    
    // 读取评论数量设置
    document.getElementById('forum-setting-comment-min').value = forumState.config.commentMin !== undefined ? forumState.config.commentMin : 3;
    document.getElementById('forum-setting-comment-max').value = forumState.config.commentMax !== undefined ? forumState.config.commentMax : 8;
    
    // 👇 新增：渲染当前窗口的帖子列表供选择关联 👇
    const postListContainer = document.getElementById('forum-gen-post-select-list');
    postListContainer.innerHTML = '';
    const currentPosts = forumState.posts.filter(p => p.type === type && p.windowId === forumState.activeWindowId);
    if (currentPosts.length === 0) {
        postListContainer.innerHTML = '<div style="color:#999; font-size:12px; text-align:center; padding: 10px;">当前频道暂无帖子可关联</div>';
    } else {
        currentPosts.forEach(p => {
            const shortTitle = p.title ? p.title : p.content.substring(0, 15) + '...';
            postListContainer.innerHTML += `
                <div class="wc-checkbox-item" style="padding: 6px 0; border-bottom: 1px solid #F9F9F9;">
                    <input type="checkbox" value="${p.id}" class="forum-post-associate-cb" style="width: 16px; height: 16px;">
                    <span style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${shortTitle}</span>
                </div>
            `;
        });
    }
    // 👆 新增结束 👆

    document.getElementById('forum-gen-count-confirm').onclick = function() {
        const min = parseInt(minInput.value) || (type === 'home' ? 6 : 2);
        const max = parseInt(maxInput.value) || (type === 'home' ? 10 : 3);
        
        // 👇 获取选中的帖子 ID 和保留选项 👇
        const selectedPostCbs = document.querySelectorAll('.forum-post-associate-cb:checked');
        const selectedPostIds = Array.from(selectedPostCbs).map(cb => parseFloat(cb.value));
        const keepPosts = document.getElementById('forum-gen-keep-posts').checked;
        
        if (min > max) {
            alert("最小值不能大于最大值哦~");
            return;
        }
        
        // 保存评论数量设置
        forumState.config.commentMin = parseInt(document.getElementById('forum-setting-comment-min').value) || 3;
        forumState.config.commentMax = parseInt(document.getElementById('forum-setting-comment-max').value) || 8;
        forumSaveData();
        
        wcCloseModal('forum-modal-gen-count');
        if (type === 'home') {
            forumGenerateAIPosts('home', min, max, selectedPostIds, keepPosts);
        } else if (type === 'fanfic') {
            forumDirectGenFanfic(min, max, selectedPostIds, keepPosts);
        }
    };
    
    wcOpenModal('forum-modal-gen-count');
}

// ==========================================
// 论坛私信系统 (会话列表 + 聊天界面)
// ==========================================

// 1. 打开私信会话列表
function forumOpenPrivateMessages() {
    let view = document.getElementById('forum-pm-list-view');
    if (!view) {
        view = document.createElement('div');
        view.id = 'forum-pm-list-view';
        view.className = 'ins-forum-view';
        // 去掉了旧的 ins-forum-header，直接渲染内容区
        view.innerHTML = `
            <div class="ins-forum-content" id="forum-pm-list-container" style="padding: 0; background: #FFF;"></div>
        `;
        // 插入到 pages-container 中，而不是 forumModal 最外层
        const pagesContainer = document.querySelector('.pages-container');
        if (pagesContainer) {
            pagesContainer.appendChild(view);
        } else {
            document.getElementById('forumModal').appendChild(view);
        }
    }
    forumRenderPMList();
    // 修复：不使用内联 display: flex，直接依赖 active 类，防止切换 tab 时页面重叠
    view.classList.add('active');
}
function forumClosePrivateMessages() {
    const view = document.getElementById('forum-pm-list-view');
    if (view) {
        view.classList.remove('active');
        setTimeout(() => view.style.display = 'none', 300);
    }
}

// 2. 渲染会话列表 (支持左滑删除)
function forumRenderPMList() {
    const container = document.getElementById('forum-pm-list-container');
    container.innerHTML = '';
    
    // 核心修复：只提取当前窗口的私信
    const currentChats = (forumState.privateChats || []).filter(c => c.windowId === forumState.activeWindowId);
    
    if (currentChats.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 50px 20px; font-size: 13px;">当前频道暂无私信</div>';
        return;
    }

    // 按最后更新时间排序
    const sortedChats = [...currentChats].sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
    
    sortedChats.forEach(chat => {
        const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
        const lastMsgText = lastMsg ? lastMsg.content : '...';
        const timeStr = lastMsg ? new Date(lastMsg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

        const div = document.createElement('div');
        div.className = 'forum-pm-swipe-wrapper';
        
        div.innerHTML = `
            <div class="forum-pm-swipe-action" onclick="forumDeletePMChat('${chat.id}')">删除</div>
            <div class="forum-pm-swipe-content" onclick="forumOpenPMChat('${chat.id}')" ontouchstart="forumPMTouchStart(event)" ontouchmove="forumPMTouchMove(event)" ontouchend="forumPMTouchEnd(event)">
                <img src="${chat.targetAvatar}" class="forum-pm-avatar">
                <div class="forum-pm-info">
                    <div class="forum-pm-name-row">
                        <span class="forum-pm-name">${chat.targetName}</span>
                        <span class="forum-pm-time">${timeStr}</span>
                    </div>
                    <div class="forum-pm-preview">${lastMsgText}</div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 👇👇👇 在 forumRenderPMList 函数下方，紧接着粘贴这段滑动与删除逻辑 👇👇👇

let forumPMSwipeXDown = null;
let forumPMSwipeYDown = null;
let forumPMCurrentSwipeElement = null;

window.forumPMTouchStart = function(evt) {
    forumPMSwipeXDown = evt.touches[0].clientX;
    forumPMSwipeYDown = evt.touches[0].clientY;
    forumPMCurrentSwipeElement = evt.currentTarget;
};

window.forumPMTouchMove = function(evt) {
    if (!forumPMSwipeXDown || !forumPMSwipeYDown || !forumPMCurrentSwipeElement) return;
    let xUp = evt.touches[0].clientX;
    let yUp = evt.touches[0].clientY;
    let xDiff = forumPMSwipeXDown - xUp;
    let yDiff = forumPMSwipeYDown - yUp;
    
    // 确保是水平滑动
    if (Math.abs(xDiff) > Math.abs(yDiff)) { 
        if (xDiff > 0) {
            // 向左滑，露出删除按钮 (宽度70px)
            forumPMCurrentSwipeElement.style.transform = `translateX(-70px)`; 
        } else {
            // 向右滑，恢复原位
            forumPMCurrentSwipeElement.style.transform = 'translateX(0px)'; 
        }
    }
};

window.forumPMTouchEnd = function(evt) {
    forumPMSwipeXDown = null;
    forumPMSwipeYDown = null;
};

window.forumDeletePMChat = function(chatId) {
    if (confirm("确定要删除这个私信会话吗？")) {
        forumState.privateChats = forumState.privateChats.filter(c => c.id !== chatId);
        forumSaveData();
        forumRenderPMList();
    }
};
// 👆👆👆 粘贴结束 👆👆👆


// 3. 打开具体的私信聊天页面
function forumOpenPMChat(chatId) {
    forumState.activePMChatId = chatId;
    const chat = forumState.privateChats.find(c => c.id === chatId);
    if (!chat) return;

    let view = document.getElementById('forum-pm-chat-view');
    if (!view) {
        view = document.createElement('div');
        view.id = 'forum-pm-chat-view';
        view.className = 'ins-forum-view';
        view.style.zIndex = '3100'; 
        view.style.paddingBottom = '0'; 
        
        // 核心修复：增加 padding-top 避开刘海屏，整体下移
        view.innerHTML = `
            <div class="ins-forum-header" style="background: #F9F9F9; display: flex; justify-content: space-between; align-items: center; padding: calc(env(safe-area-inset-top, 20px) + 15px) 20px 15px 20px; border-bottom: 1px solid #E5E5EA;">
                <div class="ins-forum-header-left" onclick="forumClosePMChat()" style="cursor: pointer; display: flex; align-items: center; width: 40px;">
                    <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: none; stroke: #111; stroke-width: 2;"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </div>
                <div class="ins-forum-title" id="forum-pm-chat-title" style="font-size: 16px; font-weight: bold; color: #111; text-align: center; flex: 1;">名字</div>
                <div style="width: 40px;"></div> 
            </div>
            <div class="forum-pm-chat-history" id="forum-pm-chat-history"></div>
            <div class="forum-pm-chat-footer" style="display: flex; align-items: center; gap: 8px; padding: 10px; border-top: 1px solid #E5E5EA; background: #FFF;">
                <div class="ins-forum-action-btn" onclick="forumTriggerPMAI(forumState.activePMChatId)" style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #F5F5F5; border-radius: 50%; cursor: pointer; flex-shrink: 0;" title="让AI回复">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: #AF52DE; stroke-width: 2;"><path d="M21 16.05L15.95 21 4 9.05 9.05 4 21 16.05zM15.95 21l-5.05-5.05M9.05 4l5.05 5.05M13 3l1.5 3.5L18 8l-3.5 1.5L13 13l-1.5-3.5L8 8l3.5-1.5L13 3z"/></svg>
                </div>
                <input type="text" id="forum-pm-chat-input" placeholder="发私信..." style="flex: 1; border: 1px solid #E5E5EA; border-radius: 16px; padding: 0 12px; height: 32px; outline: none; font-size: 14px; background: transparent;">
                <button onclick="forumSendPM()" style="background: #111; color: #FFF; border: none; border-radius: 16px; padding: 0 16px; height: 32px; font-weight: bold; cursor: pointer; flex-shrink: 0;">发送</button>
            </div>
        `;
        document.getElementById('forumModal').appendChild(view);
        document.getElementById('forum-pm-chat-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') forumSendPM();
        });
    }

    document.getElementById('forum-pm-chat-title').innerText = chat.targetName;
    forumRenderPMChatHistory();
    
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
}

function forumClosePMChat() {
    const view = document.getElementById('forum-pm-chat-view');
    if (view) {
        view.classList.remove('active');
        setTimeout(() => view.style.display = 'none', 300);
    }
    forumState.activePMChatId = null;
    forumRenderPMList(); // 退回列表时刷新一下最后一条消息
}

// 4. 渲染聊天记录
function forumRenderPMChatHistory() {
    const container = document.getElementById('forum-pm-chat-history');
    container.innerHTML = '';
    
    const chat = forumState.privateChats.find(c => c.id === forumState.activePMChatId);
    if (!chat) return;

    chat.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `forum-pm-bubble-row ${msg.sender === 'me' ? 'me' : 'them'}`;
        
        let avatarHtml = '';
        if (msg.sender === 'them') {
            avatarHtml = `<img src="${chat.targetAvatar}" class="forum-pm-bubble-avatar">`;
        } else {
            avatarHtml = `<img src="${forumState.profile.avatar}" class="forum-pm-bubble-avatar">`;
        }
        
        const hasTranslation = /<span[^>]*>([\s\S]*?)<\/span>/i.test(msg.content);
        
        let bubbleContentHtml = msg.content;
        let onClickAttr = "";
        const isMe = msg.sender === 'me';

        if (hasTranslation) {
            const originalText = msg.content.replace(/(?:<br\s*\/?>|\n)*\s*<span[^>]*>[\s\S]*?<\/span>\s*/gi, '').replace(/^(<br\s*\/?>|\s)+|(<br\s*\/?>|\s)+$/gi, '');
            const translatedText = Array.from(msg.content.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map(m => m[1]).join('<br>');
            const transId = 'pm-trans-' + Math.random().toString(36).substr(2, 9);
            
            onClickAttr = `onclick="const el = document.getElementById('${transId}'); if(el.style.display==='none'){el.style.display='block';}else{el.style.display='none';}" style="cursor: pointer; -webkit-tap-highlight-color: transparent;"`;
            bubbleContentHtml = `<div style="word-break: break-word; width: 100%;">${originalText}</div><div id="${transId}" style="display: none; width: 100%; margin-top: 8px;"><div style="height: 1px; width: 100%; background-color: ${isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)'}; margin-bottom: 8px;"></div><div style="font-size: 13px; word-break: break-word; color: ${isMe ? '#CCCCCC' : '#888888'};">${translatedText}</div></div>`;
        }

        const touchEvents = `ontouchstart="handleForumPMTouchStart(event, ${msg.id})" ontouchend="handleForumPMTouchEnd()" oncontextmenu="showForumPMContextMenu(event, ${msg.id})"`;

        div.innerHTML = `
            ${avatarHtml}
            <div class="forum-pm-bubble" ${onClickAttr} ${touchEvents}>${bubbleContentHtml}</div>
        `;
        
        container.appendChild(div);
    });

    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

// 5. 用户发送私信
function forumSendPM() {
    const input = document.getElementById('forum-pm-chat-input');
    const text = input.value.trim();
    if (!text) return;

    const chat = forumState.privateChats.find(c => c.id === forumState.activePMChatId);
    if (!chat) return;

    // 存入用户消息
    chat.messages.push({
        id: Date.now(),
        sender: 'me',
        content: text,
        time: Date.now()
    });
    chat.lastUpdateTime = Date.now();
    
    // 👇 新增：同步到主聊天记忆 👇
    const npc = wcState.characters.find(c => c.name === chat.targetName);
    if (npc) {
        wcAddMessage(npc.id, 'system', 'system', `[系统内部信息(仅AI可见): User 刚刚在论坛私信里对你说: "${text}"]`, { hidden: true });
    }
    // 👆 新增结束 👆

    forumSaveData();
    
    input.value = '';
    forumRenderPMChatHistory();
}

// 6. 专属的私信 AI 回复逻辑 (终极增强版：精准读取帖子、评论与私信上下文)
async function forumTriggerPMAI(chatId) {
    const chat = forumState.privateChats.find(c => c.id === chatId);
    if (!chat) return;

    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return;

    // 插入一个临时的“正在输入”气泡
    const container = document.getElementById('forum-pm-chat-history');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'forum-pm-bubble-row them';
    loadingDiv.id = 'forum-pm-loading';
    loadingDiv.innerHTML = `<img src="${chat.targetAvatar}" class="forum-pm-bubble-avatar"><div class="forum-pm-bubble" style="color:#888;">正在输入...</div>`;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;

    try {
        // 提取最近的私信聊天记录 (上下文)
        const recentMsgs = chat.messages.slice(-20).map(m => {
            const speaker = m.sender === 'me' ? forumState.profile.name : chat.targetName;
            return `${speaker}: ${m.content}`;
        }).join('\n');

        // 查找对方是否是已知的 NPC，如果不是，赋予路人设定
        const npc = wcState.characters.find(c => c.name === chat.targetName);
        let npcPersona = npc ? npc.prompt : "一个在论坛上关注你的热心网友/路人。请根据你们的聊天记录推断你的性格，语气要像真实的活人网友。";

        // 提取微信主聊天记录作为参考
        let mainChatHistory = "";
        if (npc) {
            const msgs = wcState.chats[npc.id] || [];
            mainChatHistory = msgs.slice(-15).map(m => {
                if (m.isError || m.type === 'system') return null;
                let content = m.content;
                if (m.type !== 'text') content = `[${m.type}]`;
                return `${m.sender==='me'?'User':npc.name}: ${content}`;
            }).filter(Boolean).join('\n');
        }

        // 读取世界书和窗口设定
        let wbInfo = "";
        if (forumState.config.worldbookIds && forumState.config.worldbookIds.length > 0) {
            const wbs = worldbookEntries.filter(e => forumState.config.worldbookIds.includes(e.id.toString()));
            if (wbs.length > 0) {
                wbInfo = "【世界观背景参考】:\n" + wbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
            }
        }

        let windowInfo = "";
        const currentWin = forumState.windows.find(w => w.id === chat.windowId);
        if (currentWin && currentWin.prompt) {
            windowInfo = `【当前论坛板块专属背景设定 (${currentWin.name})】:\n${currentWin.prompt}\n\n`;
        }

        // 👇 强化：精准读取 User 参与过的帖子及评论，作为私信的直接触发背景 👇
        let userActivePostsInfo = "";
        const userPosts = forumState.posts.filter(p => 
            p.windowId === chat.windowId && 
            (p.author.name === forumState.profile.name || (p.comments && p.comments.some(c => c.name === forumState.profile.name)))
        ).slice(0, 3);
        
        if (userPosts.length > 0) {
            userActivePostsInfo = "【User 最近参与的论坛帖子（你极有可能是因为看了这些帖子或评论，才来找 User 私聊的）】:\n";
            userPosts.forEach(p => {
                userActivePostsInfo += `发帖人：${p.author.name} | 标题：${p.title || '无题'} | 帖子内容：${p.content.substring(0, 200)}...\n`;
                const userComments = (p.comments || []).filter(c => c.name === forumState.profile.name);
                if (userComments.length > 0) {
                    userActivePostsInfo += `User 在此帖的评论：${userComments.map(c => c.content).join(' | ')}\n`;
                }
                userActivePostsInfo += "\n";
            });
        } else {
            // 如果 User 没发帖也没评论，就随便取最近的帖子作为大背景
            const recentPosts = forumState.posts.filter(p => p.windowId === chat.windowId).slice(0, 3);
            if (recentPosts.length > 0) {
                userActivePostsInfo = "【当前论坛最近的热门帖子（作为论坛大背景）】:\n";
                recentPosts.forEach(p => {
                    userActivePostsInfo += `发帖人：${p.author.name} | 标题：${p.title || '无题'} | 内容摘要：${p.content.substring(0, 100)}...\n`;
                });
                userActivePostsInfo += "\n";
            }
        }

        let prompt = `你现在正在一个社交论坛的私信界面里，和用户（${forumState.profile.name}）进行一对一私聊。\n`;
        prompt += `【你的身份】：${chat.targetName}\n`;
        prompt += `【你的人设】：${npcPersona}\n\n`;
        prompt += windowInfo;
        prompt += wbInfo;
        prompt += userActivePostsInfo;
        prompt += wcGenerateRelationshipPrompt(forumState.config.charIds); // 注入关系网
        if (mainChatHistory) {
            prompt += `【你们在微信上的最近聊天记录（作为参考）】：\n${mainChatHistory}\n\n`;
        }
        prompt += `【最近的私信聊天记录（这是你们当前的对话上下文，请顺着这个话题继续聊）】：\n${recentMsgs}\n\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 请根据你的人设、世界观背景、论坛帖子/评论内容以及私信上下文，回复用户的最后一条消息。\n`;
        prompt += `2. 如果私信刚开始，请结合上面的【User 最近参与的论坛帖子】作为开场白（比如吐槽帖子内容、回应 User 的评论等）。如果私信已经聊起来了，请重点顺着【最近的私信聊天记录】继续聊。\n`;
        prompt += `3. 语气要符合论坛私聊的氛围（可以是网感、暧昧、吐槽等，取决于你的人设）。\n`;
        prompt += `4. 【碎片化口语化强制指令】：必须像真人聊天一样，将长回复拆分成 2-4 条短消息！严禁把所有话挤在一个气泡里！确保每一条短消息本身在语义上是完整的，不能将一句话从中间断开。\n`;
        prompt += `5. 【最高防OOC指令】：你绝对不能以用户的身份（${forumState.profile.name}）说话！你只能扮演 ${chat.targetName}！\n`;
        prompt += `6. 返回纯 JSON 数组，格式如下：\n`;
        prompt += `[
  {"content": "第一句短消息"},
  {"content": "第二句短消息"}
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
        
        // 解析数组，并遍历推入聊天记录
        let replies = [];
        try {
            replies = JSON.parse(content);
            if (!Array.isArray(replies)) {
                replies = [replies]; // 兜底：如果AI还是返回了对象，转成数组
            }
        } catch (e) {
            replies = [{"content": content}]; // 兜底：解析失败直接作为纯文本
        }

        // 移除 loading
        const loadingEl = document.getElementById('forum-pm-loading');
        if (loadingEl) loadingEl.remove();

        // 存入 AI 回复 (遍历数组)
        let combinedReply = "";
        for (const reply of replies) {
            if (reply.content) {
                chat.messages.push({
                    id: Date.now() + Math.random(),
                    sender: 'them',
                    content: reply.content,
                    time: Date.now()
                });
                combinedReply += reply.content + " ";
            }
        }
        
        // 同步 AI 的回复到主聊天记忆
        if (npc && combinedReply) {
            wcAddMessage(npc.id, 'system', 'system', `[系统内部信息(仅AI可见): 你刚刚在论坛私信里回复了 User: "${combinedReply.trim()}"]`, { hidden: true });
        }
        
        chat.lastUpdateTime = Date.now();
        forumSaveData();

        // 如果当前还在这个聊天页面，刷新界面
        if (forumState.activePMChatId === chatId) {
            forumRenderPMChatHistory();
        }

    } catch (e) {
        console.error("私信回复失败", e);
        const loadingEl = document.getElementById('forum-pm-loading');
        if (loadingEl) loadingEl.remove();
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[论坛私信回复失败] ${e.message}`);
    }
}

// ==========================================
// 论坛私信长按菜单 (编辑/删除/重Roll)
// ==========================================
let forumPMLongPressTimer = null;
let forumPMSelectedMsgId = null;

window.handleForumPMTouchStart = function(e, msgId) {
    forumPMLongPressTimer = setTimeout(() => {
        const touch = e.touches[0];
        showForumPMContextMenu(touch.clientX, touch.clientY, msgId);
    }, 500);
};

window.handleForumPMTouchEnd = function() {
    if (forumPMLongPressTimer) {
        clearTimeout(forumPMLongPressTimer);
        forumPMLongPressTimer = null;
    }
};

window.showForumPMContextMenu = function(eOrX, yOrMsgId, msgIdIfTouch) {
    let x, y, msgId;
    if (typeof eOrX === 'object') {
        eOrX.preventDefault();
        eOrX.stopPropagation();
        x = eOrX.pageX || eOrX.clientX;
        y = eOrX.pageY || eOrX.clientY;
        msgId = yOrMsgId;
    } else {
        x = eOrX;
        y = yOrMsgId;
        msgId = msgIdIfTouch;
    }

    forumPMSelectedMsgId = msgId;
    
    let menu = document.getElementById('forum-pm-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'forum-pm-context-menu';
        menu.className = 'dream-context-menu'; // 复用梦境的横向菜单样式
        document.body.appendChild(menu);
    }
    
    const chat = forumState.privateChats.find(c => c.id === forumState.activePMChatId);
    if (!chat) return;
    const msg = chat.messages.find(m => m.id === msgId);
    const isAI = msg && msg.sender === 'them';

    let menuHtml = '';
    if (isAI) {
        menuHtml += `
            <div class="dream-ctx-item" onclick="forumPMActionRoll()">
                <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </div>
        `;
    }
    menuHtml += `
        <div class="dream-ctx-item" onclick="forumPMActionEdit()">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </div>
        <div class="dream-ctx-item" onclick="forumPMActionDelete()">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </div>
    `;
    menu.innerHTML = menuHtml;

    const menuWidth = isAI ? 180 : 120;
    const menuHeight = 44; 
    const screenW = window.innerWidth;
    
    let leftPos = x - (menuWidth / 2);
    let topPos = y - menuHeight - 20;

    if (leftPos < 10) leftPos = 10;
    if (leftPos + menuWidth > screenW - 10) leftPos = screenW - menuWidth - 10;

    if (topPos < 10) {
        topPos = y + 30;
        menu.style.setProperty('--triangle-top', '-7px');
        menu.style.setProperty('--triangle-bottom', 'auto');
        menu.style.setProperty('--triangle-rotate', '180deg');
    } else {
        menu.style.setProperty('--triangle-top', '100%');
        menu.style.setProperty('--triangle-bottom', 'auto');
        menu.style.setProperty('--triangle-rotate', '0deg');
    }

    menu.style.left = leftPos + 'px';
    menu.style.top = topPos + 'px';
    menu.style.display = 'flex';
};

// 修复：改用 click 监听，并排除气泡本身的点击，防止长按松手时触发隐藏
document.addEventListener('click', (e) => {
    const menu = document.getElementById('forum-pm-context-menu');
    if (menu && menu.style.display === 'flex') {
        if (!e.target.closest('#forum-pm-context-menu') && !e.target.closest('.forum-pm-bubble')) {
            menu.style.display = 'none';
            forumPMSelectedMsgId = null;
        }
    }
});

window.forumPMActionEdit = function() {
    const chat = forumState.privateChats.find(c => c.id === forumState.activePMChatId);
    if (!chat) return;
    const msg = chat.messages.find(m => m.id === forumPMSelectedMsgId);
    if (!msg) return;

    document.getElementById('forum-pm-context-menu').style.display = 'none';

    openIosTextEditModal("编辑私信", msg.content, (newText) => {
        if (newText) {
            msg.content = newText;
            forumSaveData();
            forumRenderPMChatHistory();
        }
    });
};

window.forumPMActionDelete = function() {
    const chat = forumState.privateChats.find(c => c.id === forumState.activePMChatId);
    if (!chat) return;

    document.getElementById('forum-pm-context-menu').style.display = 'none';

    if (confirm("确定删除这条私信吗？")) {
        chat.messages = chat.messages.filter(m => m.id !== forumPMSelectedMsgId);
        forumSaveData();
        forumRenderPMChatHistory();
    }
};

window.forumPMActionRoll = function() {
    const chat = forumState.privateChats.find(c => c.id === forumState.activePMChatId);
    if (!chat) return;

    document.getElementById('forum-pm-context-menu').style.display = 'none';

    const msgIndex = chat.messages.findIndex(m => m.id === forumPMSelectedMsgId);
    if (msgIndex > -1) {
        const isLastMsg = msgIndex === chat.messages.length - 1;
        if (!isLastMsg) {
            if (!confirm("重生成此条消息，将会删除它之后的所有对话记录，确定要继续吗？")) {
                return;
            }
        }
        // 截断数组
        chat.messages = chat.messages.slice(0, msgIndex);
        forumSaveData();
        forumRenderPMChatHistory();
        
        // 重新触发 AI
        forumTriggerPMAI(forumState.activePMChatId);
    }
};

/* ==========================================================================
   语音通话系统 (Voice Call Logic - 沉浸互通版)
   ========================================================================== */

// 1. 我呼叫 Ta
async function wcActionVoiceCall() {
    wcCloseAllPanels();
    const charId = wcState.activeChatId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    if (char.isGroup) {
        alert("群聊暂不支持语音通话哦~");
        return;
    }

    // 初始化额外 DOM (打字机和小窗)
    initCallExtras();

    // 初始化 UI (居中状态)
    const callView = document.getElementById('wc-view-call-screen');
    callView.classList.remove('active-call'); 
    
    document.getElementById('ins-call-bg').style.backgroundImage = `url('${char.avatar}')`;
    document.getElementById('ins-call-avatar').src = char.avatar;
    document.getElementById('ins-call-name').innerText = char.name;
    document.getElementById('ins-call-status').innerText = "正在呼叫...";
    document.getElementById('ins-call-voice-wave').classList.add('hidden'); 
    
    document.getElementById('ins-call-actions-ringing').style.display = 'flex';
    document.getElementById('ins-call-actions-incoming').style.display = 'none';
    document.getElementById('ins-call-actions-active').style.display = 'none';
    document.getElementById('ins-call-chat-area').style.display = 'none';
    document.getElementById('ins-call-messages').innerHTML = '';
    
    callView.classList.remove('hidden');

    wcState.callState.charId = charId;
    wcState.callState.isActive = false;

    // 触发 AI 决定是否接听
    await wcProcessCallDecision(char);
}

// 2. AI 决定是否接听 (读取世界书、面具、记忆，严禁emoji)
async function wcProcessCallDecision(char) {
    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) {
        setTimeout(() => wcHangUpCall('rejected', "未配置API，无法接通"), 2000);
        return;
    }

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-15).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');
        
        // 读取世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 读取记忆
        let memoryText = "暂无特殊记忆。";
        if (char.memories && char.memories.length > 0) {
            const readCount = chatConfig.aiMemoryCount || 5;
            memoryText = char.memories.slice(0, readCount).map(m => {
                // 👇 核心修改：调用翻译器，保留全文但标记重点
                return `- ${formatMemoryForAI(m.content).replace(/^\[.*?\]\s*/, '')}`;
            }).join('\n');
        }

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定/面具】：${userPersona}\n`;
        prompt += `【你们的共同记忆】：\n${memoryText}\n\n`;
        prompt += `【当前情境】：User 突然给你打来了一个语音电话。\n`;
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `请根据你的人设、记忆、世界观以及最近的聊天氛围，决定是否接听这个电话。\n`;
        prompt += `【核心表现要求】：\n`;
        prompt += `1. 如果接听，请给出接通后的第一句话。必须包含动作描写和语言描写，并且可以像小说一样互相穿插。\n`;
        prompt += `2. 动作描写绝对不要使用括号！语言描写必须使用中文双引号“”包裹！\n`;
        prompt += `3. 语气必须像真人一样自然、口语化，不要太死板！\n`;
        prompt += `4. 【绝对禁止】：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！\n`;
        prompt += `如果拒接，请给出拒接的理由（内心OS）。\n`;
        prompt += `返回纯 JSON 对象，格式如下：\n`;
        prompt += `{"accept": true, "content": "接起电话，伴随着走路的喘息声。“喂？怎么突然打电话来了？”"}\n`;
        prompt += `或 {"accept": false, "reason": "现在在开会，不方便接。"}\n`;

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
        let content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const decision = JSON.parse(content);

        if (!document.getElementById('wc-view-call-screen') || document.getElementById('wc-view-call-screen').classList.contains('hidden')) return;

        if (decision.accept) {
            wcStartActiveCall();
            // 👈 修改：存入专属通话记录，不再污染主聊天
            wcState.callState.transcript.push({ sender: 'them', text: decision.content });
            
            // 开启说话状态
            wcState.callState.isSpeaking = true;
            document.getElementById('ins-call-avatar-wrapper').classList.add('speaking');
            document.getElementById('ins-call-status').innerText = "对方正在说话...";
            document.getElementById('ins-call-voice-wave').classList.remove('hidden');
            
            playCallSequence(decision.content);
        } else {
            wcHangUpCall('rejected', decision.reason);
        }

    } catch (e) {
        console.error("AI 决策失败", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[语音通话决策失败] ${e.message}`);
        
        wcStartActiveCall();
        wcState.callState.isSpeaking = true;
        document.getElementById('ins-call-avatar-wrapper').classList.add('speaking');
        document.getElementById('ins-call-status').innerText = "对方正在说话...";
        document.getElementById('ins-call-voice-wave').classList.remove('hidden');
        playCallSequence("接通电话。“喂？”");
    }
}

// 3. Ta 呼叫我 (AI 主动来电)
window.wcShowIncomingCall = function(charId) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    wcState.callState.charId = charId;
    wcState.callState.isActive = false;

    const callView = document.getElementById('wc-view-call-screen');
    callView.classList.remove('active-call'); 
    
    document.getElementById('ins-call-bg').style.backgroundImage = `url('${char.avatar}')`;
    document.getElementById('ins-call-avatar').src = char.avatar;
    document.getElementById('ins-call-name').innerText = char.name;
    document.getElementById('ins-call-status').innerText = "邀请你进行语音通话...";
    document.getElementById('ins-call-voice-wave').classList.add('hidden');
    
    document.getElementById('ins-call-actions-ringing').style.display = 'none';
    document.getElementById('ins-call-actions-incoming').style.display = 'flex'; 
    document.getElementById('ins-call-actions-active').style.display = 'none';
    document.getElementById('ins-call-chat-area').style.display = 'none';
    document.getElementById('ins-call-messages').innerHTML = '';
    
    callView.classList.remove('hidden');
    
    if (typeof showMainSystemNotification === 'function') {
        showMainSystemNotification("语音通话", `${char.name} 邀请你进行语音通话`, char.avatar);
    }
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
};

// 4. 我接听 Ta 的来电
window.wcAcceptIncomingCall = function() {
    const charId = wcState.callState.charId;
    if (!charId) return;

    document.getElementById('ins-call-actions-incoming').style.display = 'none';
    
    wcAddMessage(charId, 'system', 'system', `[系统内部信息: User 接听了你的语音通话！请立刻说第一句话。]`, { hidden: true });
    
    wcStartActiveCall(); 
    wcTriggerCallAI();
};

// 5. 我拒绝 Ta 的来电
window.wcRejectIncomingCall = function() {
    const charId = wcState.callState.charId;
    if (!charId) return;

    document.getElementById('wc-view-call-screen').classList.add('hidden');
    wcAddMessage(charId, 'me', 'call_record', '已拒绝', { status: 'rejected' });
    wcAddMessage(charId, 'system', 'system', `[系统内部信息: User 挂断/拒绝了你的语音通话。]`, { hidden: true });
    
    wcState.callState.isActive = false;
    wcState.callState.charId = null;
};

// 6. 正式接通电话 (UI 变化)
function wcStartActiveCall() {
    initCallExtras(); // 确保特效和小窗 DOM 被初始化

    wcState.callState.isActive = true;
    wcState.callState.startTime = Date.now();

    const callView = document.getElementById('wc-view-call-screen');
    callView.classList.add('active-call'); 

    document.getElementById('ins-call-actions-ringing').style.display = 'none';
    document.getElementById('ins-call-actions-incoming').style.display = 'none';
    document.getElementById('ins-call-actions-active').style.display = 'flex';
    document.getElementById('ins-call-chat-area').style.display = 'flex';

    wcState.callState.timerInterval = setInterval(() => {
        const diff = Math.floor((Date.now() - wcState.callState.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        
        if (!wcState.callState.isSpeaking) {
            document.getElementById('ins-call-status').innerText = `${m}:${s}`;
        }
        // 同步更新小窗时间
        const floatTime = document.getElementById('floatTime');
        if(floatTime) floatTime.innerText = `${m}:${s}`;
    }, 1000);
}

// 7. 挂断电话 (注入强力记忆)
window.wcHangUpCall = function(reason, aiReason = "") {
    const charId = wcState.callState.charId;
    if (!charId) return;

    clearInterval(wcState.callState.timerInterval);
    document.getElementById('wc-view-call-screen').classList.add('hidden');
    document.getElementById('ins-call-voice-wave').classList.add('hidden');
    
    // 挂断时确保小窗也关闭
    const floatWin = document.getElementById('floatingWindow');
    if(floatWin) floatWin.style.display = 'none';

    if (reason === 'cancel') {
        wcAddMessage(charId, 'me', 'call_record', '已取消', { status: 'canceled' });
    } else if (reason === 'rejected') {
        wcAddMessage(charId, 'them', 'call_record', '已拒绝接听', { status: 'rejected' });
        if (aiReason) {
            wcAddMessage(charId, 'system', 'system', `[系统内部信息: 对方拒接了电话，Ta的内心OS是: "${aiReason}"]`, { hidden: true });
        }
    } else if (reason === 'end') {
        const diff = Math.floor((Date.now() - wcState.callState.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        const durationStr = `${m}:${s}`;
        
        // 👈 修改：把 transcript 绑定到这条消息上，方便点击查看
        const finalTranscript = JSON.parse(JSON.stringify(wcState.callState.transcript));
        wcAddMessage(charId, 'me', 'call_record', '通话时长', { duration: durationStr, status: 'ended', transcript: finalTranscript });
        
        const memoryPrompt = `[系统强制提示：你们刚刚结束了一通长达 ${durationStr} 的语音通话。在接下来的文字聊天中，请你自然地顺延刚刚电话里聊过的话题或情绪，不要表现得像刚认识一样！]`;
        wcAddMessage(charId, 'system', 'system', memoryPrompt, { hidden: true });

        // 👈 新增：触发后台自动总结通话记录
        if (finalTranscript.length > 0) {
            wcAutoSummarizeCall(charId, durationStr, finalTranscript);
        }
    }

    wcState.callState.isActive = false;
    wcState.callState.transcript = []; // 👈 清空记录
    wcState.callState.charId = null;
    wcState.callState.isSpeaking = false;
    document.getElementById('ins-call-avatar-wrapper').classList.remove('speaking');
};

// 8. 通话中发送消息 (User)
window.wcSendCallMessage = function() {
    const input = document.getElementById('ins-call-input');
    const text = input.value.trim();
    if (!text) return;

    wcAddCallMessage('me', text);
    // 👈 修改：存入专属通话记录
    wcState.callState.transcript.push({ sender: 'me', text: text });

    input.value = '';
    // 删除了 setTimeout(wcTriggerCallAI, 500); 
    // 现在发送消息后不会自动触发 AI，需要手动点击左侧的魔法棒按钮
};

// 9. 通话中 AI 回复 (深度记忆互通、活人感、严禁emoji)
window.wcTriggerCallAI = async function() {
    const charId = wcState.callState.charId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char || !wcState.callState.isActive) return;

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return;

    // 开启说话动画和 SVG 音波
    wcState.callState.isSpeaking = true;
    document.getElementById('ins-call-avatar-wrapper').classList.add('speaking');
    document.getElementById('ins-call-status').innerText = "对方正在思考...";
    document.getElementById('ins-call-voice-wave').classList.remove('hidden');

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

        let memoryText = "暂无特殊记忆。";
        if (char.memories && char.memories.length > 0) {
            const readCount = chatConfig.aiMemoryCount || 5;
            memoryText = char.memories.slice(0, readCount).map(m => {
                // 👇 核心修改：调用翻译器，保留全文但标记重点
                return `- ${formatMemoryForAI(m.content).replace(/^\[.*?\]\s*/, '')}`;
            }).join('\n');
        }

        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-20).map(m => {
            if (m.type === 'system' && m.content.includes('[语音通话中]')) return m.content;
            if (m.type === 'system' && m.content.includes('[语音通话已接通]')) return m.content;
            if (m.type === 'text') return `${m.sender==='me'?'User':char.name}: ${m.content}`;
            return null;
        }).filter(Boolean).join('\n');

        // 👇 核心修复：重构 Prompt 结构，赋予 AI 真实的对话身份 👇
        let systemPrompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        systemPrompt += `【用户(User)设定/面具】：${userPersona}\n`;
        systemPrompt += `【你们的共同记忆】：\n${memoryText}\n\n`;
        systemPrompt += `【当前情境】：你正在和 User 打语音电话。\n`;
        systemPrompt += `【最近的文字聊天记录（作为背景参考）】：\n${recentMsgs}\n\n`;
        systemPrompt += `【核心表现要求（最高优先级）】：\n`;
        systemPrompt += `1. 语气要像真实的语音通话一样自然、口语化，可以带点语气词（嗯、啊、哦），绝对不要像机器或客服！不要太死板！\n`;
        systemPrompt += `2. 必须包含动作描写和语言描写，并且可以像小说一样互相穿插。\n`;
        systemPrompt += `3. 动作描写绝对不要使用括号！语言描写必须使用中文双引号“”包裹！\n`;
        systemPrompt += `4. 【绝对禁止】：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！\n`;
        systemPrompt += `5. 【防重复/防鬼打墙约束】：绝对不要重复你刚才已经说过的话题、提议或动作！必须结合前面的对话，顺着最后一句对话继续往下聊，推动剧情发展！\n`;
        systemPrompt += `返回纯 JSON 对象，格式如下：\n`;
        systemPrompt += `{"content": "微微低头，看着你的眼睛。“我一直都在这里陪着你。”轻轻握住你的手，“无论发生什么事情，都不会离开。”"}\n`;

        let messages = [{ role: "system", content: systemPrompt }];
        
        // 将通话记录拆分为真实的对话历史喂给 AI，彻底解决意思重复的问题
        if (wcState.callState.transcript && wcState.callState.transcript.length > 0) {
            wcState.callState.transcript.forEach(t => {
                messages.push({
                    role: t.sender === 'me' ? 'user' : 'assistant',
                    content: t.text
                });
            });
        } else {
            // 兜底，如果没有任何记录，模拟用户说了一句喂
            messages.push({ role: "user", content: "喂？" });
        }

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: messages, // 👈 使用组装好的真实对话历史
                temperature: 0.8
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const reply = JSON.parse(content);

        if (wcState.callState.isActive) {
            // 👈 修改：存入专属通话记录
            wcState.callState.transcript.push({ sender: 'them', text: reply.content });
            
            document.getElementById('ins-call-status').innerText = "对方正在说话...";
            playCallSequence(reply.content);
        }

    } catch (e) {
        console.error("通话回复失败", e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[语音通话回复失败] ${e.message}`);
        
        // 发生错误时手动关闭动画
        wcState.callState.isSpeaking = false;
        document.getElementById('ins-call-avatar-wrapper').classList.remove('speaking');
        document.getElementById('ins-call-voice-wave').classList.add('hidden');
        const diff = Math.floor((Date.now() - wcState.callState.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        document.getElementById('ins-call-status').innerText = `${m}:${s}`;
    }
};

// 10. 渲染单条通话消息到屏幕 (居中排版)
window.wcAddCallMessage = function(sender, text, isAction = false) {
    const container = document.getElementById('ins-call-messages');
    const div = document.createElement('div');
    
    div.className = `ins-call-msg-centered ${sender} ${isAction ? 'action' : 'speech'}`;
    div.innerText = text;
    
    // 如果是对方发来的消息，绑定点击事件显示“重新生成”
    if (sender === 'them') {
        div.onclick = (e) => showCallMsgMenu(e);
    }
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
};
// ==========================================
// 语音通话：打字机特效、小窗模式与重新生成逻辑
// ==========================================

// 初始化额外 DOM
function initCallExtras() {
    const callView = document.getElementById('wc-view-call-screen');
    
    // 注入缩小按钮
    if (!document.getElementById('minimizeCallBtn')) {
        const minBtn = document.createElement('div');
        minBtn.id = 'minimizeCallBtn';
        minBtn.className = 'ins-call-minimize-btn';
        minBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
        minBtn.onclick = minimizeCall;
        callView.appendChild(minBtn);
    }

    // 注入打字机遮罩
    if (!document.getElementById('typewriterOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'typewriterOverlay';
        overlay.className = 'typewriter-overlay';
        overlay.innerHTML = '<div class="typewriter-text" id="typewriterText"></div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', handleTypewriterClick);
    }

    // 注入小窗
    if (!document.getElementById('floatingWindow')) {
        const floatWin = document.createElement('div');
        floatWin.id = 'floatingWindow';
        floatWin.className = 'floating-window';
        floatWin.innerHTML = '<div class="float-avatar" id="floatAvatar"></div><div class="float-time" id="floatTime">00:00</div>';
        floatWin.onclick = restoreCall;
        document.body.appendChild(floatWin);
        initFloatingDrag(floatWin);
    }
}

// --- 文本解析与队列播放逻辑 (强化双引号兼容) ---
function parseCallContent(text) {
    // 兼容中文双引号 “” 和英文双引号 ""
    const regex = /(["“][^"”]*["”])/g;
    const parts = text.split(regex);
    const result = [];
    parts.forEach(part => {
        let p = part.trim(); // 核心修复：去除首尾空格，防止正则误判
        if (!p) return;
        if (p.match(/^["“]/) && p.match(/["”]$/)) {
            result.push({ type: 'speech', text: p });
        } else {
            // 清理可能残留的括号（防 AI 幻觉）
            let cleanAction = p.replace(/[()（）]/g, '').trim();
            if (cleanAction) {
                result.push({ type: 'action', text: cleanAction });
            }
        }
    });
    return result;
}

window.playCallSequence = async function(content) {
    const sequence = parseCallContent(content);
    
    for (const item of sequence) {
        if (!wcState.callState.isActive) break; // 如果中途挂断了，停止播放
        
        if (item.type === 'action') {
            wcAddCallMessage('them', item.text, true);
            await new Promise(resolve => setTimeout(resolve, 500)); // 动作显示后稍微停顿
        } else if (item.type === 'speech') {
            await playTypewriterEffectAsync(item.text);
        }
    }
    
    // 播放完毕后恢复状态
    if (wcState.callState.isActive) {
        wcState.callState.isSpeaking = false;
        document.getElementById('ins-call-avatar-wrapper').classList.remove('speaking');
        document.getElementById('ins-call-voice-wave').classList.add('hidden');
        
        const diff = Math.floor((Date.now() - wcState.callState.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        document.getElementById('ins-call-status').innerText = `${m}:${s}`;
    }
};

// --- 异步打字机特效核心逻辑 ---
let typewriterInterval = null;
let typewriterTimeout = null;
let isTyping = false;
let currentSpeechText = "";
let typewriterResolve = null;

function playTypewriterEffectAsync(speechText) {
    return new Promise((resolve) => {
        currentSpeechText = speechText;
        typewriterResolve = resolve;
        
        const overlay = document.getElementById('typewriterOverlay');
        const textEl = document.getElementById('typewriterText');
        overlay.style.display = 'flex';
        textEl.innerText = '';
        
        clearInterval(typewriterInterval);
        clearTimeout(typewriterTimeout);
        
        isTyping = true;
        let i = 0;
        
        typewriterInterval = setInterval(() => {
            textEl.innerText += currentSpeechText[i];
            i++;
            if(i >= currentSpeechText.length) {
                finishTypingAsync();
            }
        }, 100);
    });
}

function finishTypingAsync() {
    clearInterval(typewriterInterval);
    isTyping = false;
    typewriterTimeout = setTimeout(() => {
        closeTypewriterAsync();
    }, 1500);
}

function closeTypewriterAsync() {
    clearTimeout(typewriterTimeout);
    const overlay = document.getElementById('typewriterOverlay');
    if (overlay.style.display === 'none') return; 
    
    overlay.style.display = 'none';
    wcAddCallMessage('them', currentSpeechText, false);
    
    if (typewriterResolve) {
        typewriterResolve();
        typewriterResolve = null;
    }
}

window.handleTypewriterClick = function() {
    if (isTyping) {
        // 状态1：正在打字 -> 瞬间显示全部文字，并开始1.5秒倒计时
        clearInterval(typewriterInterval);
        isTyping = false;
        document.getElementById('typewriterText').innerText = currentSpeechText;
        clearTimeout(typewriterTimeout);
        typewriterTimeout = setTimeout(() => {
            closeTypewriterAsync();
        }, 1500);
    } else {
        // 状态2：已经打完字在等待 -> 瞬间关闭并写入记录
        closeTypewriterAsync();
    }
};

// --- 重新生成逻辑 ---
window.showCallMsgMenu = function(e) {
    e.stopPropagation();
    if (isTyping) return; // 打字时不允许操作

    let menu = document.getElementById('callMsgMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'callMsgMenu';
        menu.className = 'call-msg-menu';
        menu.innerText = '重新生成';
        menu.onclick = regenerateCallMsg;
        document.body.appendChild(menu);
    }
    
    // 定位菜单到点击位置附近
    menu.style.left = e.clientX + 'px';
    menu.style.top = (e.clientY - 40) + 'px';
    menu.style.display = 'block';
    
    // 点击其他地方隐藏菜单
    const hideMenu = () => {
        menu.style.display = 'none';
        document.removeEventListener('click', hideMenu);
    };
    setTimeout(() => document.addEventListener('click', hideMenu), 10);
};

window.regenerateCallMsg = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('callMsgMenu');
    if (menu) menu.style.display = 'none';

    const container = document.getElementById('ins-call-messages');
    
    // 1. 从屏幕上移除最后一次 AI 的所有消息（直到遇到 User 的消息为止）
    let lastChild = container.lastElementChild;
    while (lastChild && lastChild.classList.contains('them')) {
        container.removeChild(lastChild);
        lastChild = container.lastElementChild;
    }

    // 2. 从专属通话记录中移除最后一次 AI 的回复
    const charId = wcState.callState.charId;
    if (charId && wcState.callState.transcript) {
        const trans = wcState.callState.transcript;
        while (trans.length > 0) {
            const lastMsg = trans[trans.length - 1];
            if (lastMsg.sender === 'them') {
                trans.pop();
            } else {
                break;
            }
        }
    }

    // 3. 重新触发 AI 回复
    wcTriggerCallAI();
};

// --- 小窗模式逻辑 ---
window.minimizeCall = function() {
    document.getElementById('wc-view-call-screen').style.display = 'none';
    const floatWin = document.getElementById('floatingWindow');
    const char = wcState.characters.find(c => c.id === wcState.callState.charId);
    if(char) {
        document.getElementById('floatAvatar').style.backgroundImage = `url('${char.avatar}')`;
    }
    floatWin.style.display = 'flex';
};

window.restoreCall = function() {
    document.getElementById('floatingWindow').style.display = 'none';
    document.getElementById('wc-view-call-screen').style.display = 'flex';
};

function initFloatingDrag(floatWin) {
    let isDragging = false, startX, startY, initialX, initialY, moved = false;
    
    floatWin.addEventListener('mousedown', e => {
        isDragging = true; moved = false; startX = e.clientX; startY = e.clientY;
        const rect = floatWin.getBoundingClientRect();
        initialX = rect.left; initialY = rect.top;
    });
    window.addEventListener('mousemove', e => {
        if(!isDragging) return;
        moved = true;
        const dx = e.clientX - startX; const dy = e.clientY - startY;
        floatWin.style.left = initialX + dx + 'px';
        floatWin.style.top = initialY + dy + 'px';
        floatWin.style.right = 'auto';
    });
    window.addEventListener('mouseup', (e) => {
        isDragging = false;
        if(moved) e.stopPropagation();
    });
    
    floatWin.addEventListener('touchstart', e => {
        isDragging = true; moved = false; startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        const rect = floatWin.getBoundingClientRect();
        initialX = rect.left; initialY = rect.top;
    }, {passive: false});
    window.addEventListener('touchmove', e => {
        if(!isDragging) return;
        moved = true;
        e.preventDefault();
        const dx = e.touches[0].clientX - startX; const dy = e.touches[0].clientY - startY;
        floatWin.style.left = initialX + dx + 'px';
        floatWin.style.top = initialY + dy + 'px';
        floatWin.style.right = 'auto';
    }, {passive: false});
    window.addEventListener('touchend', (e) => {
        isDragging = false;
    });
}

// ==========================================
// 新增：全局高级世界书选择弹窗逻辑
// ==========================================
let currentWbTargetListId = '';
let currentWbTargetCountId = '';
let currentWbCheckboxClass = '';
let currentWbCallback = null;

function openGlobalWbModal(listId, countId, checkboxClass = '', callback = null) {
    currentWbTargetListId = listId;
    currentWbTargetCountId = countId;
    currentWbCheckboxClass = checkboxClass;
    currentWbCallback = callback;

    // 1. 读取当前已选的 ID
    const hiddenInputs = document.querySelectorAll(`#${listId} input[type="checkbox"]:checked`);
    const selectedIds = Array.from(hiddenInputs).map(input => input.value);

    // 2. 渲染弹窗内容
    const container = document.getElementById('global-wb-modal-body');
    container.innerHTML = '';

    if (!worldbookGroups || worldbookGroups.length === 0 || !worldbookEntries || worldbookEntries.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 20px; font-size:14px;">暂无世界书，请先在主界面添加哦~</div>';
    } else {
        worldbookGroups.forEach((group, index) => {
            const entries = worldbookEntries.filter(e => e.type === group);
            if (entries.length === 0) return;

            const selectedInGroup = entries.filter(e => selectedIds.includes(e.id.toString())).length;
            const isExpanded = index === 0 ? 'expanded' : ''; // 默认展开第一个

            let html = `
                <div class="ins-wb-group ${isExpanded}">
                    <div class="ins-wb-group-header" onclick="this.parentElement.classList.toggle('expanded')">
                        <div class="ins-wb-group-title">${group} <span class="ins-wb-group-count">${selectedInGroup}/${entries.length}</span></div>
                        <svg class="ins-wb-group-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                    <div class="ins-wb-group-content">
            `;

            entries.forEach(entry => {
                const isChecked = selectedIds.includes(entry.id.toString()) ? 'checked' : '';
                html += `
                    <label class="ins-wb-item">
                        <input type="checkbox" value="${entry.id}" class="global-wb-checkbox" ${isChecked} onchange="updateGlobalWbGroupCount(this)">
                        <span class="ins-wb-item-title">${entry.title}</span>
                    </label>
                `;
            });

            html += `</div></div>`;
            container.innerHTML += html;
        });
    }

    // 3. 显示弹窗
    const modal = document.getElementById('global-wb-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function updateGlobalWbGroupCount(checkbox) {
    const groupEl = checkbox.closest('.ins-wb-group');
    const total = groupEl.querySelectorAll('.global-wb-checkbox').length;
    const checked = groupEl.querySelectorAll('.global-wb-checkbox:checked').length;
    groupEl.querySelector('.ins-wb-group-count').innerText = `${checked}/${total}`;
}

function closeGlobalWbModal() {
    const modal = document.getElementById('global-wb-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function confirmGlobalWbSelect() {
    // 1. 获取弹窗中所有勾选的 ID
    const selectedCheckboxes = document.querySelectorAll('#global-wb-modal-body .global-wb-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);

    // 2. 更新隐藏的列表 (完美兼容原有的保存逻辑)
    const hiddenList = document.getElementById(currentWbTargetListId);
    if (hiddenList) {
        hiddenList.innerHTML = '';
        selectedIds.forEach(id => {
            hiddenList.innerHTML += `<input type="checkbox" value="${id}" class="${currentWbCheckboxClass}" checked>`;
        });
    }

    // 3. 更新按钮上的数量显示
    const countDisplay = document.getElementById(currentWbTargetCountId);
    if (countDisplay) {
        countDisplay.innerText = `已选 ${selectedIds.length} 项`;
    }

    // 4. 触发回调 (如果有)
    if (currentWbCallback) {
        currentWbCallback(selectedIds);
    }

    // 触发实时 Token 计算 (如果当前在聊天设置页面)
    if (typeof calculateRealtimeTokens === 'function') {
        calculateRealtimeTokens();
    }

    closeGlobalWbModal();
}
// ==========================================
// 新增：Token 计算与 API 额度查询逻辑 (增强版)
// ==========================================

// 粗略估算 Token (中文按 1.2 算，英文按 0.3 算)
function estimateTokens(text) {
    if (!text) return 0;
    let tokens = 0;
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) > 255) {
            tokens += 1.2;
        } else {
            tokens += 0.3;
        }
    }
    return Math.ceil(tokens);
}

// 实时计算当前聊天的各项 Token 占用 (已剔除内置提示词)
function calculateRealtimeTokens() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    
    let wbTokens = 0;
    let chatTokens = 0;
    let memTokens = 0;
    let stickerTokens = 0;

    // 1. 计算世界书 (从当前勾选的复选框读取)
    const wbCheckboxes = document.querySelectorAll('#wc-setting-worldbook-list input[type="checkbox"]:checked');
    const selectedWbIds = Array.from(wbCheckboxes).map(cb => cb.value);
    if (selectedWbIds.length > 0) {
        const linkedWbs = worldbookEntries.filter(e => selectedWbIds.includes(e.id.toString()));
        linkedWbs.forEach(wb => {
            wbTokens += estimateTokens(wb.title + wb.desc);
        });
    }

    // 2. 计算聊天上下文 (从当前输入的限制条数读取)
    const msgs = wcState.chats[char.id] || [];
    let limit = parseInt(document.getElementById('wc-setting-context-limit').value);
    // 如果没填或者填了0，则计算全部上下文的 Token
    const recentMsgs = (isNaN(limit) || limit <= 0) ? msgs : msgs.slice(-limit);
    recentMsgs.forEach(m => {
        if (!m.isError) {
            chatTokens += estimateTokens(m.content);
        }
    });

    // 3. 计算记忆 (记忆条数不在当前面板修改，直接读 config)
    if (char.memories && char.memories.length > 0) {
        const readCount = (char.chatConfig && char.chatConfig.aiMemoryCount !== undefined) ? char.chatConfig.aiMemoryCount : 5;
        const recentMemories = char.memories.slice(0, readCount);
        recentMemories.forEach(m => {
            memTokens += estimateTokens(m.content);
        });
    }

    // 4. 计算表情包 (从当前勾选的复选框读取)
    const stickerCheckboxes = document.querySelectorAll('#wc-setting-sticker-group-list input[type="checkbox"]:checked');
    const selectedStickerIds = Array.from(stickerCheckboxes).map(cb => parseInt(cb.value));
    if (selectedStickerIds.length > 0) {
        selectedStickerIds.forEach(groupId => {
            const group = wcState.stickerCategories[groupId];
            if (group && group.list) {
                group.list.forEach(s => {
                    stickerTokens += estimateTokens(s.desc);
                });
            }
        });
    }

    const totalTokens = wbTokens + chatTokens + memTokens + stickerTokens;

    // 更新 UI
    const uiTotal = document.getElementById('ui-total-token');
    if (uiTotal) uiTotal.innerText = `约 ${totalTokens.toLocaleString()}`;
    
    const dWb = document.getElementById('detail-token-wb');
    if (dWb) dWb.innerText = wbTokens.toLocaleString();
    
    const dChat = document.getElementById('detail-token-chat');
    if (dChat) dChat.innerText = chatTokens.toLocaleString();
    
    const dMem = document.getElementById('detail-token-mem');
    if (dMem) dMem.innerText = memTokens.toLocaleString();
    
    const dSticker = document.getElementById('detail-token-sticker');
    if (dSticker) dSticker.innerText = stickerTokens.toLocaleString();
    
    const dTotal = document.getElementById('detail-token-total');
    if (dTotal) dTotal.innerText = totalTokens.toLocaleString();
}

// 打开/关闭弹窗
function openTokenModal() {
    const modal = document.getElementById('tokenDetailModal');
    if (!modal) return;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeTokenModal() {
    const modal = document.getElementById('tokenDetailModal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

// 查询 API 额度 (终极完美适配版)
async function refreshApiQuota() {
    const quotaEl = document.getElementById('ui-api-quota');
    if (!quotaEl) return;
    
    quotaEl.innerText = "查询中...";
    quotaEl.style.opacity = "0.5";

    try {
        const apiConfig = await getActiveApiConfig('chat');
        if (!apiConfig || !apiConfig.key || !apiConfig.baseUrl) {
            throw new Error("未配置API");
        }

        const baseUrlMatch = apiConfig.baseUrl.match(/^(https?:\/\/[^\/]+)/);
        const host = baseUrlMatch ? baseUrlMatch[1] : apiConfig.baseUrl;

        const response = await fetch(`${host}/v1/dashboard/billing/subscription`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiConfig.key}` }
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
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const startDate = `${year}-${month}-01`;
                    const endDate = `${year}-${month}-${day}`;
                    
                    const usageRes = await fetch(`${host}/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, {
                        headers: { 'Authorization': `Bearer ${apiConfig.key}` }
                    });
                    const usageData = await usageRes.json();
                    if (usageData.total_usage !== undefined) {
                        total_usage = usageData.total_usage / 100;
                    }
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
            
            // 👇 新增：触发短信 APP 的话费检查 👇
            if (typeof checkApiQuotaForSms === 'function') {
                checkApiQuotaForSms(finalBalance);
            }
        } else {
            quotaEl.innerText = "格式不支持";
        }

    } catch (e) {
        console.warn("额度查询失败:", e);
        quotaEl.innerText = "接口不支持";
    } finally {
        quotaEl.style.opacity = "1";
    }
}

// ==========================================
// 新增：位置功能核心逻辑 (发送位置 & 角色城市 & 查看地图)
// ==========================================

let sendLocMapInstance = null;
let sendLocCurrentType = 'real'; 
let sendLocRealAddress = "正在获取高精度定位...";
let sendLocLat = 0;
let sendLocLon = 0;

// 1. 打开发送位置弹窗 (User)
function wcOpenSendLocationModal() {
    wcCloseAllPanels(); 
    const modal = document.getElementById('wc-modal-send-location');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    wcSwitchSendLocTab('real'); 
    fetchSendLocation(); 
}

function wcCloseSendLocationModal() {
    const modal = document.getElementById('wc-modal-send-location');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function wcSwitchSendLocTab(tab) {
    sendLocCurrentType = tab;
    document.getElementById('send-loc-seg-real').classList.toggle('active', tab === 'real');
    document.getElementById('send-loc-seg-virtual').classList.toggle('active', tab === 'virtual');
    document.getElementById('send-loc-view-real').style.display = tab === 'real' ? 'block' : 'none';
    document.getElementById('send-loc-view-virtual').style.display = tab === 'virtual' ? 'block' : 'none';
    
    if (tab === 'real' && sendLocMapInstance) {
        setTimeout(() => sendLocMapInstance.invalidateSize(), 100);
    }
}

// 获取真实定位并渲染地图
function fetchSendLocation() {
    const titleEl = document.getElementById('send-loc-real-address');
    titleEl.innerText = "正在获取高精度定位...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            sendLocLat = pos.coords.latitude;
            sendLocLon = pos.coords.longitude;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${sendLocLat}&lon=${sendLocLon}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'zh-CN' }
                });
                const data = await res.json();
                
                let address = data.display_name;
                if (data.address) {
                    const a = data.address;
                    address = `${a.city || a.town || a.province || ''} ${a.suburb || a.county || ''} ${a.road || ''}`.trim();
                    if (!address) address = data.display_name;
                }
                
                sendLocRealAddress = address || `${sendLocLat.toFixed(4)}, ${sendLocLon.toFixed(4)}`;
                titleEl.innerText = sendLocRealAddress;

                // 渲染 Leaflet 地图
                if (typeof L !== 'undefined') {
                    if (!sendLocMapInstance) {
                        sendLocMapInstance = L.map('send-real-map-container', {
                            zoomControl: false, attributionControl: false
                        }).setView([sendLocLat, sendLocLon], 16);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(sendLocMapInstance);
                    } else {
                        sendLocMapInstance.setView([sendLocLat, sendLocLon], 16);
                    }
                    setTimeout(() => { sendLocMapInstance.invalidateSize(); }, 100);
                }
            } catch (e) {
                sendLocRealAddress = `${sendLocLat.toFixed(4)}, ${sendLocLon.toFixed(4)}`;
                titleEl.innerText = sendLocRealAddress;
            }
        }, (err) => {
            sendLocRealAddress = "定位失败或未授权";
            titleEl.innerText = sendLocRealAddress;
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    } else {
        sendLocRealAddress = "设备不支持定位";
        titleEl.innerText = sendLocRealAddress;
    }
}

// 发送位置到聊天 (带上经纬度参数)
function wcSubmitSendLocation() {
    const charId = wcState.activeChatId;
    if (!charId) return;

    let locTitle = "";
    let locDesc = "";
    let isVirtual = false;
    let lat = 0, lon = 0;

    if (sendLocCurrentType === 'real') {
        locTitle = sendLocRealAddress;
        locDesc = "真实地理位置";
        lat = sendLocLat;
        lon = sendLocLon;
    } else {
        const virtualInput = document.getElementById('send-loc-virtual-input').value.trim();
        if (!virtualInput) return alert("请输入虚拟地名哦~");
        locTitle = virtualInput;
        locDesc = "自定义虚拟坐标";
        isVirtual = true;
    }

    const mapClass = isVirtual ? "wc-bubble-location-map virtual" : "wc-bubble-location-map";
    const markerClass = isVirtual ? "ins-loc-marker virtual-marker" : "ins-loc-marker";
    
    // 👇 新增：对标题和描述进行安全转义，防止单引号和换行符破坏 onclick 语法
    const safeLocTitle = locTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");
    const safeLocDesc = locDesc.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");

    // 核心：给卡片绑定 onclick 事件，传入参数打开地图弹窗
    // 👇 修改：将 locTitle 和 locDesc 替换为 safeLocTitle 和 safeLocDesc
    const cardHtml = `
        <div class="wc-bubble-location-card" onclick="window.wcOpenMapView(${isVirtual}, '${safeLocTitle}', '${safeLocDesc}', ${lat}, ${lon})">
            <div class="${mapClass}">
                <div class="${markerClass}"></div>
            </div>
            <div class="wc-bubble-location-info">
                <div class="wc-bubble-location-title">${locTitle}</div>
                <div class="wc-bubble-location-desc">${locDesc}</div>
            </div>
        </div>
    `;

    wcAddMessage(charId, 'me', 'receipt', cardHtml);

    const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚向你发送了一个地理位置。位置名称是：“${locTitle}”。请在接下来的回复中，根据这个地点做出自然的反应。]`;
    wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });

    wcCloseSendLocationModal();
}

// ==========================================
// 2. 角色所在城市设定逻辑 (Char)
// ==========================================
let charLocCurrentType = 'real';
let charLocMapInstance = null;
let charLocLat = 0;
let charLocLon = 0;

function wcOpenCharLocationModal() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    
    const config = char.chatConfig || {};
    const locType = config.locationType || 'real';

    wcSwitchCharLocTab(locType);
    
    if (locType === 'virtual') {
        document.getElementById('char-loc-virtual-input').value = config.locationName || '';
        document.getElementById('char-loc-virtual-distance').value = config.virtualDistance || ''; // 读取自定义距离
    } else {
        document.getElementById('char-loc-real-country').value = config.locationCountry || '';
        document.getElementById('char-loc-real-province').value = config.locationProvince || '';
        document.getElementById('char-loc-real-city').value = config.locationCity || '';
        
        // 如果之前存过经纬度，直接渲染地图
        if (config.locationLat && config.locationLon) {
            charLocLat = config.locationLat;
            charLocLon = config.locationLon;
            document.getElementById('char-loc-coords-display').innerText = `经纬度: ${charLocLat.toFixed(4)}, ${charLocLon.toFixed(4)}`;
            renderCharLocMap(charLocLat, charLocLon);
        }
    }

    const modal = document.getElementById('wc-modal-char-location');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function wcCloseCharLocationModal() {
    const modal = document.getElementById('wc-modal-char-location');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function wcSwitchCharLocTab(tab) {
    charLocCurrentType = tab;
    document.getElementById('char-loc-seg-real').classList.toggle('active', tab === 'real');
    document.getElementById('char-loc-seg-virtual').classList.toggle('active', tab === 'virtual');
    document.getElementById('char-loc-view-real').style.display = tab === 'real' ? 'block' : 'none';
    document.getElementById('char-loc-view-virtual').style.display = tab === 'virtual' ? 'block' : 'none';
    
    if (tab === 'real' && charLocMapInstance) {
        setTimeout(() => charLocMapInstance.invalidateSize(), 100);
    }
}

// 搜索 Char 的真实地理位置
async function searchCharLocation() {
    const country = document.getElementById('char-loc-real-country').value.trim();
    const province = document.getElementById('char-loc-real-province').value.trim();
    const city = document.getElementById('char-loc-real-city').value.trim();
    
    if (!country && !province && !city) return alert("请至少输入一个地名进行搜索哦~");
    
    const query = [country, province, city].filter(Boolean).join('+');
    const coordsDisplay = document.getElementById('char-loc-coords-display');
    coordsDisplay.innerText = "正在搜索地图坐标...";

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
            headers: { 'Accept-Language': 'zh-CN' }
        });
        const data = await res.json();
        
        if (data && data.length > 0) {
            charLocLat = parseFloat(data[0].lat);
            charLocLon = parseFloat(data[0].lon);
            coordsDisplay.innerText = `经纬度: ${charLocLat.toFixed(4)}, ${charLocLon.toFixed(4)}`;
            renderCharLocMap(charLocLat, charLocLon);
        } else {
            coordsDisplay.innerText = "未找到该地点的坐标，请检查拼写";
        }
    } catch (e) {
        coordsDisplay.innerText = "搜索失败，网络异常";
    }
}

function renderCharLocMap(lat, lon) {
    if (typeof L !== 'undefined') {
        if (!charLocMapInstance) {
            charLocMapInstance = L.map('char-real-map-container', {
                zoomControl: false, attributionControl: false
            }).setView([lat, lon], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(charLocMapInstance);
        } else {
            charLocMapInstance.setView([lat, lon], 12);
        }
        setTimeout(() => { charLocMapInstance.invalidateSize(); }, 100);
    }
}

function wcSubmitCharLocation() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    if (!char.chatConfig) char.chatConfig = {};

    let locName = "";
    let aiPrompt = "";
    let displayLoc = "";

    if (charLocCurrentType === 'virtual') {
        locName = document.getElementById('char-loc-virtual-input').value.trim();
        const virtualDist = document.getElementById('char-loc-virtual-distance').value.trim(); // 获取自定义距离
        if (!locName) return alert("请输入虚拟城市名称哦~");
        
        char.chatConfig.locationType = 'virtual';
        char.chatConfig.locationName = locName;
        char.chatConfig.virtualDistance = virtualDist; // 保存自定义距离
        
        displayLoc = locName;
        aiPrompt = `[系统设定更新：你现在的居住地设定为“${locName}”。请在后续聊天中，严格符合该城市/异世界的背景设定，并保持与 User 异地/跨次元的逻辑。]`;
    } else {
        const country = document.getElementById('char-loc-real-country').value.trim();
        const province = document.getElementById('char-loc-real-province').value.trim();
        const city = document.getElementById('char-loc-real-city').value.trim();
        if (!country && !province && !city) return alert("请至少输入国家、省份或城市名称哦~");
        
        locName = [country, province, city].filter(Boolean).join(' ');
        
        char.chatConfig.locationType = 'real';
        char.chatConfig.locationCountry = country;
        char.chatConfig.locationProvince = province;
        char.chatConfig.locationCity = city;
        char.chatConfig.locationName = locName;
        char.chatConfig.locationLat = charLocLat;
        char.chatConfig.locationLon = charLocLon;
        
        displayLoc = locName;
        aiPrompt = `[系统设定更新：你现在的居住地设定为现实世界中的“${locName}”。请在后续聊天中，符合该地的气候、时差、文化背景，并保持与 User 异地的逻辑。]`;
    }

    wcSaveData();

    const displayEl = document.getElementById('wc-setting-loc-display');
    if (displayEl) displayEl.innerText = displayLoc;

    wcAddMessage(char.id, 'system', 'system', aiPrompt, { hidden: true });

    wcCloseCharLocationModal();
    alert("Ta 的城市设定已保存！");
}

const originalWcOpenChatSettings = wcOpenChatSettings;
wcOpenChatSettings = function() {
    originalWcOpenChatSettings(); 
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (char && char.chatConfig) {
        const displayEl = document.getElementById('wc-setting-loc-display');
        if (displayEl) {
            if (char.chatConfig.locationName) {
                displayEl.innerText = char.chatConfig.locationName;
            } else {
                displayEl.innerText = '未设置';
            }
        }
    }
};

// ==========================================
// 3. 查看地图详情弹窗 (点击聊天卡片触发)
// ==========================================
let viewMapInstance = null;
let viewMapMarker = null;

window.wcOpenMapView = function(isVirtual, title, desc, lat, lon) {
    const modal = document.getElementById('wc-modal-map-view');
    document.getElementById('view-map-title').innerText = title;
    document.getElementById('view-map-desc').innerText = desc;
    
    const mapContainer = document.getElementById('view-map-container');
    const virtualBg = document.getElementById('view-map-virtual-bg');
    const coordsEl = document.getElementById('view-map-coords');

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    if (isVirtual) {
        // 虚拟位置：显示紫色网格背景，隐藏真实地图
        virtualBg.style.display = 'flex';
        coordsEl.innerText = "经纬度: 异世界坐标无法解析";
        if (viewMapInstance) {
            viewMapInstance.remove();
            viewMapInstance = null;
        }
    } else {
        // 真实位置：隐藏虚拟背景，渲染 Leaflet 地图
        virtualBg.style.display = 'none';
        coordsEl.innerText = `经纬度: ${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`;
        
        setTimeout(() => {
            if (typeof L !== 'undefined') {
                if (!viewMapInstance) {
                    viewMapInstance = L.map('view-map-container', {
                        zoomControl: false, attributionControl: false
                    }).setView([lat, lon], 16);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(viewMapInstance);
                    
                    // 添加一个红色的定位大头针
                    const customIcon = L.divIcon({
                        className: 'custom-pin',
                        html: `<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:#FF3B30;stroke:#FFF;stroke-width:2;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#FFF"></circle></svg>`,
                        iconSize: [36, 36],
                        iconAnchor: [18, 36]
                    });
                    viewMapMarker = L.marker([lat, lon], {icon: customIcon}).addTo(viewMapInstance);
                } else {
                    viewMapInstance.setView([lat, lon], 16);
                    viewMapMarker.setLatLng([lat, lon]);
                }
                viewMapInstance.invalidateSize();
            }
        }, 300); // 等待弹窗动画结束再渲染地图，防止尺寸计算错误
    }
}

window.wcCloseMapView = function() {
    const modal = document.getElementById('wc-modal-map-view');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}
// ==========================================
// 新增：API 报错弹窗控制逻辑
// ==========================================
window.showApiErrorModal = function(errorMsg) {
    // 👇 新增：在弹出报错卡片时，强制隐藏底层的转圈 loading 动画
    const loadingOverlay = document.getElementById('wc-ios-loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
    // 👆 新增结束

    const modal = document.getElementById('api-error-modal');
    const textContainer = document.getElementById('api-error-text');
    const btnText = document.getElementById('copy-btn-text');
    
    if (modal && textContainer) {
        textContainer.innerText = errorMsg;
        if (btnText) btnText.innerText = '一键复制报错信息'; // 重置按钮文字
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

window.closeApiErrorModal = function() {
    const modal = document.getElementById('api-error-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
};

window.copyApiErrorText = function() {
    const text = document.getElementById('api-error-text').innerText;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        const btnText = document.getElementById('copy-btn-text');
        if (btnText) btnText.innerText = '复制成功！';
        if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
        alert('复制失败，请手动长按上方灰色区域的文本进行复制哦~');
    }
    document.body.removeChild(textArea);
};
// ==========================================
// 角色生活状态系统 (Life Status)
// ==========================================

// 初始化或获取角色的状态数据
function getCharLifeStatus(charId) {
    let char = wcState.characters.find(c => c.id === charId);
    if (!char) return null;
    
    if (!char.lifeStatus) {
        char.lifeStatus = {
            location: "未知",
            action: "未知",
            mood: "未知",
            timeline: [],
            autoRefresh: true,
            refreshTime: "06:00",
            lastRefreshTimestamp: 0 // 记录上次刷新的时间戳
        };
    }
    return char.lifeStatus;
}

// 打开状态弹窗
function wcOpenCharStatusModal() {
    if (!wcState.activeChatId) {
        alert("请在单人聊天中使用");
        return;
    }
    wcCloseAllPanels(); // 关闭更多面板
    
    const status = getCharLifeStatus(wcState.activeChatId);
    if (!status) return;
    // 如果跨天了，只清空 timeline，保留当前状态(模拟在线)
    if (status.autoRefresh && isNewDayForStatus(status)) {
        status.timeline = [];
        wcSaveData();
    }

    // 渲染设置
    document.getElementById('ins-status-time-picker').value = status.refreshTime || "06:00";
    document.getElementById('ins-status-auto-toggle').checked = status.autoRefresh !== false;
    
    // 渲染内容
    renderCharStatusUI(status);
    
    wcOpenModal('wc-modal-char-status');
    
    // 👇 新增：异步加载天气数据 👇
    fetchAndRenderStatusWeather(wcState.activeChatId);
}

// 👇 新增：异步获取并渲染天气 👇
async function fetchAndRenderStatusWeather(charId) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char || !char.chatConfig) return;

    const weatherModule = document.getElementById('ins-status-weather-module');
    const iconEl = document.getElementById('ins-weather-icon');
    const tempEl = document.getElementById('ins-weather-temp');
    const descEl = document.getElementById('ins-weather-desc');
    const diffEl = document.getElementById('ins-weather-diff');
    if (!weatherModule) return;

    // 1. 获取 User 天气
    const userWeather = await getUserWeather();

    // 2. 获取 Char 天气
    if (char.chatConfig.locationType === 'real' && char.chatConfig.locationLat) {
        weatherModule.style.display = 'flex';
        const charWeather = await getRealWeather(char.chatConfig.locationLat, char.chatConfig.locationLon);
        
        if (charWeather) {
            iconEl.innerText = getWeatherEmoji(charWeather.weathercode);
            tempEl.innerText = `${Math.round(charWeather.temperature)}°C`;
            descEl.innerText = "现实同步";
            
            if (userWeather) {
                const diff = Math.round(charWeather.temperature - userWeather.temperature);
                if (diff > 0) diffEl.innerText = `比你热 ${diff}°C`;
                else if (diff < 0) diffEl.innerText = `比你冷 ${Math.abs(diff)}°C`;
                else diffEl.innerText = `温度与你相同`;
            } else {
                diffEl.innerText = "无法获取你的温度";
            }
        } else {
            descEl.innerText = "天气获取失败";
        }
    } else if (char.chatConfig.locationType === 'virtual') {
        if (wcState.virtualWorldData && wcState.virtualWorldData.weather) {
            weatherModule.style.display = 'flex';
            iconEl.innerText = '✨';
            tempEl.innerText = wcState.virtualWorldData.weather.temp || '未知';
            descEl.innerText = wcState.virtualWorldData.weather.desc || '异星气候';
            diffEl.innerText = "跨越次元";
        } else {
            weatherModule.style.display = 'none';
        }
    } else {
        weatherModule.style.display = 'none';
    }
}

// 保存设置
function wcSaveCharStatusSettings() {
    if (!wcState.activeChatId) return;
    const status = getCharLifeStatus(wcState.activeChatId);
    if (!status) return;
    
    status.refreshTime = document.getElementById('ins-status-time-picker').value;
    status.autoRefresh = document.getElementById('ins-status-auto-toggle').checked;
    wcSaveData();
}

// 渲染 UI
function renderCharStatusUI(status) {
    document.getElementById('ins-status-loc').innerText = status.location || "未知";
    document.getElementById('ins-status-act').innerText = status.action || "未知";
    document.getElementById('ins-status-mood').innerText = status.mood || "暂无状态";
    
    // 每次重新渲染时，先隐藏天气模块，等待异步加载
    const weatherModule = document.getElementById('ins-status-weather-module');
    if (weatherModule) weatherModule.style.display = 'none';
    
    const timelineContainer = document.getElementById('ins-status-timeline');
    timelineContainer.innerHTML = '';
    
    if (!status.timeline || status.timeline.length === 0) {
        timelineContainer.innerHTML = '<div style="font-size: 12px; color: #888; text-align: center; padding: 20px 0;">暂无行程记录，点击刷新生成</div>';
        return;
    }
    
    status.timeline.forEach((item, index) => {
        const isLast = index === status.timeline.length - 1;
        const html = `
            <div class="ins-timeline-item ${isLast ? 'active' : ''}">
                <div class="ins-timeline-dot"></div>
                <div class="ins-timeline-time">${item.time} ${isLast ? '(Now)' : ''}</div>
                <div class="ins-timeline-content">${item.content}</div>
            </div>
        `;
        timelineContainer.insertAdjacentHTML('beforeend', html);
    });
}

// 判断是否跨越了设定的刷新时间 (即是否是新的一天)
function isNewDayForStatus(status) {
    const now = new Date();
    const lastRefresh = new Date(status.lastRefreshTimestamp || 0);
    
    // 解析设定的刷新时间 (如 "06:00")
    const [refreshHour, refreshMinute] = (status.refreshTime || "06:00").split(':').map(Number);
    
    // 获取今天的刷新时间点
    const todayRefreshTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), refreshHour, refreshMinute, 0);
    
    // 如果当前时间已经过了今天的刷新点，且上次刷新时间在今天的刷新点之前，说明跨天了
    if (now >= todayRefreshTime && lastRefresh < todayRefreshTime) {
        return true;
    }
    
    // 如果当前时间还没到今天的刷新点，但上次刷新时间在昨天的刷新点之前，也算跨天
    const yesterdayRefreshTime = new Date(todayRefreshTime.getTime() - 24 * 60 * 60 * 1000);
    if (now < todayRefreshTime && lastRefresh < yesterdayRefreshTime) {
        return true;
    }
    
    return false;
}

// 核心：请求 AI 生成/刷新状态 (极致活人感与时间感知版 - 极简模糊化)
async function wcGenerateCharStatus() {
    const charId = wcState.activeChatId;
    if (!charId) return;
    
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;
    
    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const status = getCharLifeStatus(charId);
    const isNewDay = isNewDayForStatus(status);
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
    
    // 强力时间段感知
    let timeSlotVibe = "";
    if (hours >= 0 && hours < 6) timeSlotVibe = "凌晨/深夜：绝大多数人都在睡觉。如果行程更新在这个时间，大概率是‘睡得正香’、‘翻了个身’、‘起夜喝水’，或者‘被手机震动吵醒，有点懵/烦躁’。";
    else if (hours >= 6 && hours < 9) timeSlotVibe = "清晨：刚醒、洗漱、买早饭、通勤挤地铁。可能带有起床气、没睡醒的迷糊感，或者匆忙感。";
    else if (hours >= 9 && hours < 12) timeSlotVibe = "上午：正常上课或工作时间。状态可能是‘认真听讲/干活’，也可能是‘偷偷摸鱼刷手机’、‘喝咖啡续命’。";
    else if (hours >= 12 && hours < 14) timeSlotVibe = "中午：午休时间。干饭、排队拿外卖、趴在桌上睡午觉。";
    else if (hours >= 14 && hours < 18) timeSlotVibe = "下午：下午的课程或工作。容易犯困、发呆、盯着窗外、期待下班/放学。";
    else if (hours >= 18 && hours < 21) timeSlotVibe = "傍晚：下班/放学、吃晚饭、通勤回家、在沙发上瘫着。";
    else timeSlotVibe = "夜晚：私人放松时间。洗澡、打游戏、看剧、护肤、躺在床上酝酿睡意。";

    // 准备已有行程文本
    let existingTimelineText = "无";
    if (!isNewDay && status.timeline && status.timeline.length > 0) {
        existingTimelineText = status.timeline.map(t => `[${t.time}] ${t.content}`).join('\n');
    }

    const prompt = `
你是一个极具“活人感”的角色扮演辅助系统。请根据角色的设定和当前极其具体的时间点，推断角色【现在】正在经历的生活碎片，并生成行程记录。

【角色设定】：${char.prompt || char.name}
【当前现实时间】：${dayString} ${currentTimeStr}
【当前时间段状态参考】：${timeSlotVibe}

【核心生成要求（最高优先级）】：
1. **极度模糊与简练**：不要写具体的长句！"location"、"action"、"mood" 这三个字段【绝对不能超过10个字】！越短越好，越模糊越有真实感。
   - "location" (地点)：如：被窝里、路上、工位、阳台、便利店。
   - "action" (动作)：如：发呆、刚睡醒、走路、摸鱼中、吃东西。
   - "mood" (状态/心情)：如：有点困、很烦躁、心情不错、饿了、懵懵的。
2. **严格符合当前时间**：如果现在是凌晨3点，Ta大概率在睡觉，被吵醒了可能有点懵或起床气；如果是中午12点，Ta可能在干饭或午休。绝对不能出现时间逻辑错误！
3. **行程记录要求**：
   - ${isNewDay ? '这是新的一天！请清空之前的行程，根据当前时间生成 1 到 3 条从今天早上到现在的【生活碎片记录】。' : '这是同一天的状态更新！请在以下已有行程的基础上，推断角色现在的新状态，并追加 1 条当前时间的【最新生活碎片】。'}
   - 行程内容可以稍微长一点，写成有画面的小事（例如：“差点没赶上公交，匆忙咽下了一个冷掉的包子”）。
4. **已有行程记录**：\n${existingTimelineText}
5. **绝对禁止**：全文严禁使用任何 emoji 表情符号！严禁出现颜文字！

请严格返回以下 JSON 格式（不要包含 markdown 代码块，直接返回纯 JSON）：
{
  "location": "极简地点(10字内)",
  "action": "极简动作(10字内)",
  "mood": "极简状态(10字内)",
  "newTimeline": [
    {"time": "时间(如 08:15)", "content": "充满画面的生活碎片记录"}
  ]
}`;

    wcShowLoading("正在感知 Ta 的生活...");
    try {
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
        let cleanText = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanText);

        // 更新状态数据
        status.location = result.location;
        status.action = result.action;
        status.mood = result.mood;
        status.lastRefreshTimestamp = now.getTime();

        // 更新行程
        if (isNewDay) {
            status.timeline = result.newTimeline || []; // 新的一天，直接覆盖
        } else {
            if (result.newTimeline && result.newTimeline.length > 0) {
                status.timeline.push(...result.newTimeline); // 同一天，追加
            }
        }

        wcSaveData();
        renderCharStatusUI(status);
        // 手动刷新后，同步更新聊天顶栏
        if (wcState.activeChatId === charId) {
            const char = wcState.characters.find(c => c.id === charId);
            if (char) updateChatTopBarStatus(char);
        }
        wcShowSuccess("状态已更新");

    } catch (error) {
        console.error(error);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[获取状态失败] ${error.message}`);
        else wcShowError("获取状态失败");
    }
}
// ==========================================
// 新增：食谱系统 (Recipe) 核心逻辑
// ==========================================

// 初始化食谱数据
function initRecipeData(char) {
    if (!char.phoneData) char.phoneData = {};
    if (!char.phoneData.recipe) {
        char.phoneData.recipe = {
            my: { b: '', l: '', d: '', edits: {}, history: [] },
            ta: { b: '', l: '', d: '', edits: {}, history: [] }
        };
    }
    // 兼容旧数据，补充 history 数组
    if (!char.phoneData.recipe.my.history) char.phoneData.recipe.my.history = [];
    if (!char.phoneData.recipe.ta.history) char.phoneData.recipe.ta.history = [];
    return char.phoneData.recipe;
}

// 打开食谱主页
function wcActionRecipe() {
    wcCloseAllPanels();
    document.getElementById('wc-view-chat-detail').classList.remove('active');
    document.getElementById('wc-view-recipe').classList.add('active');
    
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'none';

    wcSwitchRecipeTab('my');
}

function wcCloseRecipePage() {
    document.getElementById('wc-view-recipe').classList.remove('active');
    document.getElementById('wc-view-chat-detail').classList.add('active');
    
    const globalNavbar = document.querySelector('.wc-navbar');
    if (globalNavbar) globalNavbar.style.display = 'flex';
}

function wcSwitchRecipeTab(tab) {
    // 切换钢琴键状态
    document.querySelectorAll('.piano-key').forEach(el => el.classList.remove('active'));
    document.getElementById(`recipe-tab-${tab}`).classList.add('active');
    wcRenderRecipeContent(tab);
}

function wcRenderRecipeContent(tab) {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    const recipeData = initRecipeData(char);
    const data = tab === 'my' ? recipeData.my : recipeData.ta;
    const container = document.getElementById('wc-recipe-content-area');
    
    const title = tab === 'my' ? "TODAY'S MENU" : "TA'S MENU";
    
    let html = `
        <div class="recipe-card active">
            <div class="recipe-card-header">
                <div class="recipe-date">${title}</div>
                <div class="recipe-edit-btn" onclick="wcEditRecipe('${tab}')">
                    <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    编辑
                </div>
            </div>
    `;

    const meals = [
        { key: 'b', icon: '🥐', name: 'Breakfast' },
        { key: 'l', icon: '🍱', name: 'Lunch' },
        { key: 'd', icon: '🍲', name: 'Dinner' }
    ];

    meals.forEach(m => {
        let desc = data[m.key] || '暂无记录，点击右上角编辑';
        if (data.edits && data.edits[m.key]) {
            desc = `<span style="color:#FF9500; font-weight:bold;">[已修改]</span> ${desc}`;
        }
        html += `
            <div class="meal-item">
                <div class="meal-icon-box">${m.icon}</div>
                <div class="meal-info">
                    <div class="meal-name">${m.name}</div>
                    <div class="meal-desc">${desc}</div>
                </div>
            </div>
        `;
    });

    // 动态生成底部操作区
    if (tab === 'ta') {
        const autoTime = data.autoTime || '12:00';
        html += `
            <div style="background: #F9F9F9; border-radius: 16px; padding: 16px; margin-top: 20px; border: 1px solid #F0F0F0;">
                <div style="font-size: 13px; font-weight: bold; color: #111; margin-bottom: 10px;">定时报备设置</div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 12px; color: #888;">到达设定时间自动发送食谱</span>
                    <input type="time" value="${autoTime}" onchange="wcSaveRecipeAutoTime(this.value)" style="background: #FFF; border: 1px solid #EAEAEA; padding: 6px 10px; border-radius: 8px; font-family: monospace; outline: none; color: #111;">
                </div>
            </div>
            <button class="recipe-action-btn btn-dark" onclick="wcGenerateTaRecipe(true)">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                让 Ta 立即生成并主动报备
            </button>
        `;
    } else {
        html += `
            <button class="recipe-action-btn btn-dark" onclick="wcSendRecipe('my')">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                发送给 Ta
            </button>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// 保存定时发送时间
window.wcSaveRecipeAutoTime = function(timeVal) {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    const recipeData = initRecipeData(char);
    recipeData.ta.autoTime = timeVal;
    wcSaveData();
};

// ==========================================
// 新增：高级食谱编辑弹窗逻辑
// ==========================================
let currentRecipeEditTab = 'my';

function wcEditRecipe(tab) {
    currentRecipeEditTab = tab;
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    const recipeData = initRecipeData(char);
    const data = tab === 'my' ? recipeData.my : recipeData.ta;

    // 填充当前数据到输入框
    document.getElementById('re-input-b').value = data.b || '';
    document.getElementById('re-input-l').value = data.l || '';
    document.getElementById('re-input-d').value = data.d || '';

    // 设置标题
    const title = tab === 'my' ? "编辑我的食谱" : "修改 Ta 的食谱";
    document.getElementById('re-modal-title').innerText = title;

    // 打开弹窗
    const modal = document.getElementById('wc-modal-recipe-edit');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function wcCloseRecipeEdit() {
    const modal = document.getElementById('wc-modal-recipe-edit');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function wcSaveRecipeEdit() {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    const recipeData = initRecipeData(char);
    const data = currentRecipeEditTab === 'my' ? recipeData.my : recipeData.ta;

    // 获取新输入的数据
    const newB = document.getElementById('re-input-b').value.trim();
    const newL = document.getElementById('re-input-l').value.trim();
    const newD = document.getElementById('re-input-d').value.trim();

    let isModified = false;
    const currentEdits = {}; // 临时记录本次修改

    // 辅助函数：检查并记录修改
    const checkAndRecord = (key, newVal) => {
        const oldVal = data[key] || '';
        if (oldVal !== newVal) {
            isModified = true;
            // 如果是修改对方的食谱，记录修改痕迹
            if (currentRecipeEditTab === 'ta') {
                if (!data.edits) data.edits = {};
                data.edits[key] = {
                    old: oldVal || '无',
                    new: newVal,
                    author: wcState.user.name
                };
                currentEdits[key] = { old: oldVal || '无', new: newVal };
            }
            data[key] = newVal; // 更新数据
        }
    };

    checkAndRecord('b', newB);
    checkAndRecord('l', newL);
    checkAndRecord('d', newD);

    if (isModified) {
        // 构建新版本推入 history
        if (currentRecipeEditTab === 'ta') {
            if (!data.history) data.history = [];
            
            // 如果之前没有历史记录，先补一个初始版本
            if (data.history.length === 0) {
                data.history.push({
                    version: 1, author: "系统 记录", time: "未知时间", tag: "ORIGINAL",
                    meals: {
                        b: { status: 'normal', text: data.edits['b'] ? data.edits['b'].old : (data.b || '无') },
                        l: { status: 'normal', text: data.edits['l'] ? data.edits['l'].old : (data.l || '无') },
                        d: { status: 'normal', text: data.edits['d'] ? data.edits['d'].old : (data.d || '无') }
                    }
                });
            }

            // 将之前的 LATEST 标签改为 UPDATED
            if (data.history.length > 0) {
                data.history[data.history.length - 1].tag = "UPDATED";
            }

            const now = new Date();
            const timeStr = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            
            const newVersion = {
                version: data.history.length + 1,
                author: `${wcState.user.name} 修改`,
                time: timeStr,
                tag: "LATEST",
                meals: {
                    b: currentEdits['b'] ? { status: 'edited', old: currentEdits['b'].old, new: currentEdits['b'].new } : { status: 'normal', text: data.b || '无' },
                    l: currentEdits['l'] ? { status: 'edited', old: currentEdits['l'].old, new: currentEdits['l'].new } : { status: 'normal', text: data.l || '无' },
                    d: currentEdits['d'] ? { status: 'edited', old: currentEdits['d'].old, new: currentEdits['d'].new } : { status: 'normal', text: data.d || '无' }
                }
            };
            data.history.push(newVersion);
        }

        wcSaveData();
        wcRenderRecipeContent(currentRecipeEditTab);

        // 如果修改了对方的食谱，发送卡片并通知 AI
        if (currentRecipeEditTab === 'ta') {
            wcAddMessage(char.id, 'me', 'recipe', '食谱', {
                title: "Ta's Menu (已修改)",
                desc: `我帮你把食谱改了`,
                isEdited: true,
                recipeData: JSON.parse(JSON.stringify(data)) // 深拷贝当前状态
            });
            
            wcAddMessage(char.id, 'system', 'system', `[系统内部信息: User 刚刚强行修改了你的今日食谱。请在回复中对此做出反应（比如抗议、撒娇或顺从）。]`, { hidden: true });
        }
    }

    wcCloseRecipeEdit();
}

// 发送我的食谱到聊天
function wcSendRecipe(tab) {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    const recipeData = initRecipeData(char);
    const data = tab === 'my' ? recipeData.my : recipeData.ta;

    wcAddMessage(char.id, 'me', 'recipe', '食谱', {
        title: "My Menu",
        desc: "这是我今天的食谱哦~",
        isEdited: false,
        recipeData: JSON.parse(JSON.stringify(data))
    });
    
    wcAddMessage(char.id, 'system', 'system', `[系统内部信息: User 刚刚向你发送了Ta的今日食谱。早餐:${data.b||'无'}，午餐:${data.l||'无'}，晚餐:${data.d||'无'}。请在回复中对此做出反应。]`, { hidden: true });
    
    wcCloseRecipePage();
    alert("已发送给 Ta！");
}

// AI 生成 Ta 的食谱 (支持主动发送到聊天)
window.wcGenerateTaRecipe = async function(sendToChat = false, targetCharId = null) {
    const charId = targetCharId || wcState.activeChatId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) {
        if (!targetCharId) alert("请先配置 API");
        return;
    }

    if (!targetCharId) wcShowLoading("正在感知 Ta 的饮食...");

    try {
        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n`;
        prompt += `请根据你的人设和当前的生活状态，生成你今天的【一日三餐食谱】。\n`;
        prompt += `要求：\n1. 必须符合你的性格（比如：养生人吃沙拉，打工人吃外卖，发疯人吃泡面）。\n`;
        prompt += `2. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{"b": "早餐内容", "l": "午餐内容", "d": "晚餐内容"}\n`;

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
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        const recipeData = initRecipeData(char);
        // 保留原有的 autoTime 设置
        const currentAutoTime = recipeData.ta.autoTime || '12:00';
        
        // 构建初始版本记录
        const now = new Date();
        const timeStr = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const initialHistory = [{
            version: 1,
            author: `${char.name} 创建`,
            time: timeStr,
            tag: "ORIGINAL",
            meals: {
                b: { status: 'normal', text: result.b || '无' },
                l: { status: 'normal', text: result.l || '无' },
                d: { status: 'normal', text: result.d || '无' }
            }
        }];

        recipeData.ta = { b: result.b, l: result.l, d: result.d, edits: {}, history: initialHistory, autoTime: currentAutoTime };
        
        // 如果是定时触发，记录今天已经发送过
        if (targetCharId) {
            const todayStr = new Date().toDateString();
            recipeData.ta.lastAutoSendDate = todayStr;
        }
        
        wcSaveData();
        
        // 如果当前停留在食谱页，刷新 UI
        if (!targetCharId && document.getElementById('wc-view-recipe').classList.contains('active')) {
            wcRenderRecipeContent('ta');
        }

        // 如果要求发送到聊天界面
        if (sendToChat) {
            wcAddMessage(char.id, 'them', 'recipe', '食谱', {
                title: "Ta's Menu",
                desc: "这是我今天的食谱哦~",
                isEdited: false,
                recipeData: JSON.parse(JSON.stringify(recipeData.ta))
            });
            
            // 发送一条配套的文本消息
            wcAddMessage(char.id, 'them', 'text', "给你看看我今天吃了什么~");
            
            // 触发系统通知
            if (typeof showMainSystemNotification === 'function') {
                showMainSystemNotification("今日食谱", `${char.name} 向你报备了今日食谱`, char.avatar);
            }
        }

        if (!targetCharId) wcShowSuccess("生成并发送成功！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[食谱生成失败] ${e.message}`);
        else if (!targetCharId) wcShowError("生成失败");
    }
};

// 全局变量用于食谱翻页
let currentRecipeHistory = [];
let currentRecipePage = 0;

// 打开聊天记录中的食谱详情弹窗 (日记本翻页版)
window.wcOpenRecipeDetail = function(msgId) {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id.toString() === msgId.toString());
    if (!msg || !msg.recipeData) return;

    document.getElementById('recipe-detail-title').innerText = msg.title;
    
    const data = msg.recipeData;
    
    // 如果有 history 数组，使用翻页逻辑
    if (data.history && data.history.length > 0) {
        currentRecipeHistory = data.history;
        currentRecipePage = currentRecipeHistory.length - 1; // 默认显示最新一页
    } else {
        // 兼容旧数据：如果没有 history，动态构造一个单页数据
        currentRecipeHistory = [{
            version: 1,
            author: "系统 记录",
            time: "未知时间",
            tag: msg.isEdited ? "UPDATED" : "ORIGINAL",
            meals: {
                b: (data.edits && data.edits['b']) ? { status: 'edited', old: data.edits['b'].old, new: data.edits['b'].new, author: data.edits['b'].author } : { status: 'normal', text: data.b || '无' },
                l: (data.edits && data.edits['l']) ? { status: 'edited', old: data.edits['l'].old, new: data.edits['l'].new, author: data.edits['l'].author } : { status: 'normal', text: data.l || '无' },
                d: (data.edits && data.edits['d']) ? { status: 'edited', old: data.edits['d'].old, new: data.edits['d'].new, author: data.edits['d'].author } : { status: 'normal', text: data.d || '无' }
            }
        }];
        currentRecipePage = 0;
    }

    wcRenderRecipePage();

    const modal = document.getElementById('wc-modal-recipe-detail');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.wcRenderRecipePage = function() {
    const data = currentRecipeHistory[currentRecipePage];
    const renderArea = document.getElementById('recipe-detail-render-area');
    
    // 重新触发动画
    renderArea.classList.remove('rm-fade-content');
    void renderArea.offsetWidth; 
    renderArea.classList.add('rm-fade-content');

    let mealsHtml = '';
    const mealKeys = [
        { key: 'b', label: 'BRKF' },
        { key: 'l', label: 'LNCH' },
        { key: 'd', label: 'DINR' }
    ];

    mealKeys.forEach(m => {
        const mealData = data.meals[m.key];
        let contentHtml = '';
        if (mealData.status === 'edited') {
            contentHtml = `
                <div class="rm-edit-group">
                    <div class="rm-text-old">${mealData.old}</div>
                    <div class="rm-text-new">${mealData.new}</div>
                    ${mealData.author ? `<div class="rm-edit-author">${mealData.author} 修改了此项</div>` : ''}
                </div>
            `;
        } else {
            contentHtml = `<div class="rm-text-normal">${mealData.text}</div>`;
        }

        mealsHtml += `
            <div class="rm-meal-item">
                <div class="rm-meal-label">${m.label}</div>
                <div class="rm-meal-detail">${contentHtml}</div>
            </div>
        `;
    });

    const tagBg = data.tag === 'LATEST' ? '#111' : (data.tag === 'ORIGINAL' ? '#34C759' : '#888');

    renderArea.innerHTML = `
        <div class="rm-version-info">
            <span class="rm-version-tag" style="background: ${tagBg}">${data.tag}</span>
            <span class="rm-edit-author">${data.author}</span>
            <span class="rm-edit-time">${data.time}</span>
        </div>
        <div class="rm-content">
            ${mealsHtml}
        </div>
    `;

    // 更新翻页按钮状态
    document.getElementById('recipe-page-indicator').innerText = `${currentRecipePage + 1} / ${currentRecipeHistory.length}`;
    document.getElementById('recipe-btn-prev').disabled = currentRecipePage === 0;
    document.getElementById('recipe-btn-next').disabled = currentRecipePage === currentRecipeHistory.length - 1;
};

window.wcChangeRecipePage = function(dir) {
    currentRecipePage += dir;
    wcRenderRecipePage();
};

window.wcCloseRecipeDetail = function(e) {
    if (e && e.target.id !== 'wc-modal-recipe-detail') return;
    const modal = document.getElementById('wc-modal-recipe-detail');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};
// ==========================================
// 新增：高级小票弹窗逻辑
// ==========================================
window.wcOpenReceiptDetail = function(msgId) {
    const msgs = wcState.chats[wcState.activeChatId];
    const msg = msgs.find(m => m.id.toString() === msgId.toString());
    if (!msg || !msg.receiptData) return;

    const data = msg.receiptData;
    
    document.getElementById('rcpt-logo').innerText = data.logo || 'RECEIPT';
    document.getElementById('rcpt-date').innerText = data.date || new Date().toLocaleString();
    
    let itemsHtml = '';
    if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
            itemsHtml += `
                <div class="rcpt-row">
                    <div class="rcpt-col-left">1x ${item.name}</div>
                    <div class="rcpt-col-right">¥${item.price}</div>
                </div>
            `;
        });
    }
    document.getElementById('rcpt-items').innerHTML = itemsHtml;
    
    document.getElementById('rcpt-subtotal').innerText = `¥${data.total}`;
    document.getElementById('rcpt-total').innerText = `¥${data.total}`;
    document.getElementById('rcpt-msg').innerText = data.msg || '';
    
    // 随机生成一个订单号
    document.getElementById('rcpt-order-no').innerText = `ORD-${Math.floor(Math.random() * 900000000) + 100000000}`;

    const modal = document.getElementById('wc-modal-receipt');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.wcCloseReceiptDetail = function(e) {
    if (e && e.target.id !== 'wc-modal-receipt' && !e.target.classList.contains('rcpt-close')) return;
    const modal = document.getElementById('wc-modal-receipt');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};
// ==========================================
// 听歌总结弹窗逻辑
// ==========================================
window.musicOpenSummaryModal = function(msgId) {
    const charId = wcState.activeChatId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const msgs = wcState.chats[charId];
    const msg = msgs.find(m => m.id.toString() === msgId.toString());
    if (!msg || !msg.summaryData) return alert("报告数据已丢失");

    const data = msg.summaryData;

    // 渲染头像
    const userAvatar = (char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
    document.getElementById('summary-avatar-user').src = userAvatar;
    document.getElementById('summary-avatar-char').src = char.avatar;

    // 👇 新增：判断是否为婉拒状态 👇
    if (data.isRejected) {
        document.getElementById('summary-duration').innerText = `00:00:00`;
        document.getElementById('summary-song-count').innerText = `0 首 (已婉拒)`;
        document.getElementById('summary-start-time').innerText = '--';
        document.getElementById('summary-end-time').innerText = '--';
    } else {
        // 格式化时长 (HH:MM:SS)
        const totalSecs = Math.floor(data.durationMs / 1000);
        const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSecs % 60).toString().padStart(2, '0');
        document.getElementById('summary-duration').innerText = `${h}:${m}:${s}`;

        // 歌曲数量
        document.getElementById('summary-song-count').innerText = `${data.songCount} 首`;

        // 格式化开始和结束时间 (YYYY-MM-DD HH:MM:SS)
        const formatFullTime = (ts) => {
            const d = new Date(ts);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
        };
        document.getElementById('summary-start-time').innerText = formatFullTime(data.startTime);
        document.getElementById('summary-end-time').innerText = formatFullTime(data.endTime);
    }

    // 显示弹窗
    const modal = document.getElementById('music-modal-summary');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.musicCloseSummaryModal = function(e) {
    if (e && e.target.id !== 'music-modal-summary') return;
    const modal = document.getElementById('music-modal-summary');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};
// ==========================================
// 论坛新增：热搜功能逻辑
// ==========================================
async function forumGenerateHotSearches() {
    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const list = document.getElementById('forum-hot-search-list');
    list.innerHTML = '<div style="text-align:center; padding:40px 0;"><div class="wc-ios-spinner" style="margin: 0 auto;"></div><div style="color:#888; margin-top:10px; font-size:13px;">正在获取全网热点...</div></div>';

    try {
        // 👇 新增：读取关联的世界书和角色设定 👇
        let contextInfo = "";
        if (forumState.config.worldbookIds && forumState.config.worldbookIds.length > 0) {
            const wbs = worldbookEntries.filter(e => forumState.config.worldbookIds.includes(e.id.toString()));
            if (wbs.length > 0) {
                contextInfo += "【世界观背景参考】:\n" + wbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
            }
        }
        if (forumState.config.charIds && forumState.config.charIds.length > 0) {
            const chars = wcState.characters.filter(c => forumState.config.charIds.includes(c.id.toString()));
            if (chars.length > 0) {
                contextInfo += "【相关人物设定参考】:\n" + chars.map(c => `${c.name}: ${c.prompt}`).join('\n') + "\n\n";
            }
        }

        let prompt = `你现在是一个社交论坛的后台引擎。请生成 10 个当前最热门的搜索词条（热搜）。\n`;
        
        // 👈 将背景设定注入到 Prompt 中
        if (contextInfo) {
            prompt += `请务必结合以下背景设定来生成热搜内容，让热搜看起来是发生在这个世界里的真实事件：\n${contextInfo}`;
        }
        
        prompt += `要求：\n`;
        prompt += `1. 词条内容可以是：社会新闻、娱乐八卦、重大事件、或者带有悬疑/科幻色彩的事件。\n`;
        prompt += `2. 词条要简短有力，像真实的微博/B站热搜（例如：赛博朋克边缘行者大结局、魔法学院新生入学指南、某某角色深夜密会）。\n`;
        prompt += `3. 返回纯 JSON 数组，格式如下：\n`;
        prompt += `["词条1", "词条2", "词条3"]\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.9
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const topics = JSON.parse(content);

        forumState.hotSearches = topics.map(t => ({
            title: t,
            heat: Math.floor(Math.random() * 500) + 100
        }));
        forumSaveData();
        forumRenderHotSearches();

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; color:#FF3B30; padding:40px 0; font-size:13px;">获取失败，请重试</div>';
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[论坛热搜生成失败] ${e.message}`);
    }
}

function forumRenderHotSearches() {
    const list = document.getElementById('forum-hot-search-list');
    list.innerHTML = '';
    
    if (!forumState.hotSearches || forumState.hotSearches.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">点击顶栏右侧刷新图标获取全网热点</div>';
        return;
    }

    forumState.hotSearches.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'hot-item';
        div.onclick = () => forumClickHotSearch(item.title);
        div.innerHTML = `
            <div class="hot-rank">${index + 1}</div>
            <div class="hot-title">${item.title}</div>
            <div class="hot-heat">${item.heat}w</div>
        `;
        list.appendChild(div);
    });
}

function forumClickHotSearch(topic) {
    // 取前三个字加省略号作为窗口名
    const shortName = topic.length > 3 ? topic.substring(0, 3) + '...' : topic;
    
    // 检查是否已经存在同名窗口
    const existingWin = forumState.windows.find(w => w.name === shortName);
    
    if (existingWin) {
        // 如果存在，直接切换到该窗口
        forumState.activeWindowId = existingWin.id;
    } else {
        // 如果不存在，创建新窗口
        const newId = 'win_' + Date.now();
        forumState.windows.push({ 
            id: newId, 
            name: shortName, 
            prompt: `这是关于【${topic}】的专属讨论频道。请生成与此话题高度相关的帖子和讨论。` 
        });
        forumState.activeWindowId = newId;
    }
    
    forumSaveData();
    
    // 刷新顶栏窗口列表
    forumRenderWindows();
    
    // 切换回主页视图
    forumSwitchTab('home');
    
    // 如果是新创建的，或者里面没帖子，给个提示
    const currentPosts = forumState.posts.filter(p => p.windowId === forumState.activeWindowId && p.type === 'home');
    if (currentPosts.length === 0) {
        const container = document.getElementById('forum-post-list-home');
        if (container) {
            container.innerHTML = `<div style="text-align:center; color:#999; padding:60px 20px; font-size:14px; line-height:1.6;">欢迎来到【${topic}】专属频道<br>点击右上角让AI生成相关内容吧</div>`;
        }
    }
}

// ==========================================
// 论坛新增：同人文菜单与催更逻辑
// ==========================================
function forumOpenFanficMenu(postId) {
    forumState.actionPostId = postId;
    wcOpenModal('forum-fanfic-action-sheet');
}

function forumAddToBookstore() {
    const post = forumState.posts.find(p => p.id === forumState.actionPostId);
    if (!post) return;

    // 检查是否已存在
    const exists = forumState.books.find(b => b.originalPostId === post.id);
    if (exists) {
        wcCloseModal('forum-fanfic-action-sheet');
        return alert("这本书已经在你的书城里啦！");
    }

    // 随机生成一个封面颜色
    const colors = ['#4A5568', '#2D3748', '#8E54E9', '#4776E6', '#FF9A9E', '#FECFEF', '#43E97B', '#38F9D7'];
    const bg1 = colors[Math.floor(Math.random() * colors.length)];
    const bg2 = colors[Math.floor(Math.random() * colors.length)];

    const newBook = {
        id: Date.now(),
        originalPostId: post.id,
        title: post.title || '无题',
        author: post.author.name,
        desc: post.content.substring(0, 50) + '...',
        coverBg: `linear-gradient(135deg, ${bg1}, ${bg2})`,
        chapters: [
            { title: '第一章', content: post.content, time: post.time }
        ]
    };

    forumState.books.unshift(newBook);
    forumSaveData();
    wcCloseModal('forum-fanfic-action-sheet');
    alert("已成功加入书城！点击左上角 LABEL 即可查看。");
}

function forumOpenUrgeModal() {
    wcCloseModal('forum-fanfic-action-sheet');
    setTimeout(() => {
        document.getElementById('forum-urge-prompt').value = '';
        wcOpenModal('forum-urge-modal');
    }, 300);
}

async function forumSubmitUrge() {
    const post = forumState.posts.find(p => p.id === forumState.actionPostId);
    if (!post) return;

    const urgeText = document.getElementById('forum-urge-prompt').value.trim();
    
    const apiConfig = await getActiveApiConfig('forum');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcCloseModal('forum-urge-modal');
    wcShowLoading("作者正在快马加鞭码字中...");

    try {
        let prompt = `你是一个同人文作者。你的读者正在催更你的小说。\n`;
        prompt += `【小说作者（你现在的笔名）】：${post.author.name}\n`;
        prompt += `【前文内容】：\n${post.content}\n\n`;
        if (urgeText) {
            prompt += `【读者的剧情期望】：${urgeText}\n\n`;
        }
        prompt += `请根据前文和读者的期望，续写下一章的内容。\n`;
        prompt += `【核心要求】：\n`;
        prompt += `1. 续写正文：字数 500-1000 字，保持文风一致，推动剧情发展。\n`;
        prompt += `2. 读者评论：生成 3-5 条读者看到最新更新后的激动评论（如：啊啊啊终于更新了、太太太会写了、好甜/好虐等）。\n`;
        prompt += `3. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "content": "续写的正文内容（支持使用 \\n 换行排版）...",
  "comments": [
    {"name": "读者A", "content": "评论内容"}
  ]
}\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8,
                max_tokens: 10000
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        let result;
        try {
            result = JSON.parse(content);
        } catch (e) {
            console.warn("JSON 解析失败，降级为纯文本", e);
            result = { content: content, comments: [] };
        }

        const newContent = result.content || "作者卡文了...";
        const newComments = result.comments || [];

        // 1. 更新原帖内容 (追加)
        post.content += `\n\n【更新分割线】\n\n${newContent}`;
        
        // 2. 追加新评论
        if (newComments.length > 0) {
            if (!post.comments) post.comments = [];
            const processedComments = newComments.map(c => ({
                name: c.name || "热心读者",
                handle: '@' + (c.name || "reader"),
                avatar: getRandomNpcAvatar(),
                content: c.content,
                time: Date.now()
            }));
            post.comments.push(...processedComments);
        }

        // 3. 如果这本书在书城里，同步更新章节
        const book = forumState.books.find(b => b.originalPostId === post.id);
        if (book) {
            book.chapters.push({
                title: `第 ${book.chapters.length + 1} 章`,
                content: newContent,
                time: Date.now()
            });
        }

        forumSaveData();
        
        // 刷新当前视图
        if (document.getElementById('forum-view-fanfic').classList.contains('active')) {
            forumRenderPosts('fanfic');
        }
        if (forumState.currentDetailPostId === post.id) {
            forumRenderPostDetailContent();
        }
        // 如果当前在书城详情页，也需要刷新评论区
        if (document.getElementById('forum-view-book-detail').classList.contains('active') && forumState.currentBookId) {
            forumOpenBookDetail(forumState.currentBookId);
        }

        wcShowSuccess("催更成功，已更新！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[论坛催更失败] ${e.message}`);
        else wcShowError("作者卡文了，请重试");
    }
}

// ==========================================
// 论坛新增：书城与全屏阅读器逻辑
// ==========================================
function forumRenderBookstore() {
    const grid = document.getElementById('forum-book-grid');
    grid.innerHTML = '';
    
    if (!forumState.books || forumState.books.length === 0) {
        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #888; padding: 40px 0; font-size: 13px;">书架空空如也<br>去同人区把喜欢的文章加入书城吧</div>';
        return;
    }

    forumState.books.forEach(book => {
        const shortTitle = book.title.length > 4 ? book.title.substring(0, 4) : book.title;
        const div = document.createElement('div');
        div.className = 'book-item';
        div.onclick = () => forumOpenBookDetail(book.id);
        div.innerHTML = `
            <div class="book-cover" style="background: ${book.coverBg};">
                <span class="book-title-cover">${shortTitle}</span>
            </div>
            <div class="book-name">${book.title}</div>
            <div class="book-author">${book.author}</div>
        `;
        grid.appendChild(div);
    });
}

function forumOpenBookDetail(bookId) {
    forumState.currentBookId = bookId;
    const book = forumState.books.find(b => b.id === bookId);
    if (!book) return;

    const shortTitle = book.title.length > 4 ? book.title.substring(0, 4) : book.title;
    document.getElementById('forum-bd-cover').style.background = book.coverBg;
    document.getElementById('forum-bd-cover-text').innerText = shortTitle;
    
    // 👇 核心修改：注入带“催更”按钮的标题 👇
    document.getElementById('forum-bd-title').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 18px; font-weight: bold; color: #111; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${book.title}</span>
            <span onclick="forumTriggerUrgeFromBook(${book.originalPostId})" style="font-size: 12px; color: #AF52DE; background: rgba(175,82,222,0.1); padding: 4px 12px; border-radius: 12px; cursor: pointer; flex-shrink: 0; margin-left: 10px; font-weight: bold;">催更</span>
        </div>
    `;
    
    document.getElementById('forum-bd-author').innerText = `作者：${book.author}`;
    document.getElementById('forum-bd-desc').innerText = book.desc;

    const list = document.getElementById('forum-bd-chapter-list');
    list.innerHTML = '';
    book.chapters.forEach((ch, idx) => {
        const timeStr = new Date(ch.time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        const div = document.createElement('div');
        div.className = 'chapter-item';
        // 👇 核心修改：点击章节不再直接进阅读器，而是打开选择弹窗 👇
        div.onclick = () => forumOpenChapterActionModal(idx);
        div.innerHTML = `<span>${ch.title}</span> <span style="color:#999; font-size:12px;">${timeStr}</span>`;
        list.appendChild(div);
    });

    // 👇 核心修改：渲染原帖的评论到下方 👇
    const commentsSection = document.getElementById('forum-bd-comments-section');
    if (commentsSection) {
        const originalPost = forumState.posts.find(p => p.id === book.originalPostId);
        let commentsHtml = '<div style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #111;">读者评论</div>';
        
        if (originalPost && originalPost.comments && originalPost.comments.length > 0) {
            originalPost.comments.forEach(c => {
                commentsHtml += `
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <img src="${c.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #F0F0F0;">
                        <div>
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px; font-weight: bold;">${c.name}</div>
                            <div style="font-size: 14px; color: #333; line-height: 1.5;">${c.content}</div>
                        </div>
                    </div>
                `;
            });
        } else {
            commentsHtml += '<div style="text-align: center; color: #999; font-size: 12px; padding: 20px 0;">暂无评论</div>';
        }
        commentsSection.innerHTML = commentsHtml;
    }

    forumSwitchTab('book-detail');
}

// --- 阅读器核心逻辑 ---
function forumOpenReader(chapterIndex) {
    const book = forumState.books.find(b => b.id === forumState.currentBookId);
    if (!book || !book.chapters[chapterIndex]) return;

    forumState.currentChapterIndex = chapterIndex;
    const chapter = book.chapters[chapterIndex];

    document.getElementById('reader-book-title').innerText = book.title;
    document.getElementById('reader-chapter-title').innerText = chapter.title;

    // 简单的分页逻辑：按字数切割 (每页约 300 字)
    const text = chapter.content;
    const pageSize = 300;
    forumState.readerPages = [];
    for (let i = 0; i < text.length; i += pageSize) {
        forumState.readerPages.push(text.substring(i, i + pageSize));
    }
    
    forumState.currentReaderPage = 0;
    forumRenderReaderPage();

    // 更新时间
    const now = new Date();
    document.getElementById('reader-time-display').innerText = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    document.getElementById('forum-reader-overlay').style.display = 'flex';
    setTimeout(() => document.getElementById('forum-reader-overlay').classList.add('active'), 10);
}

function forumRenderReaderPage() {
    const content = forumState.readerPages[forumState.currentReaderPage];
    // 将换行符转换为 <br>
    document.getElementById('reader-content-text').innerHTML = content.replace(/\n/g, '<br>');
    document.getElementById('reader-page-num').innerText = `${forumState.currentReaderPage + 1} / ${forumState.readerPages.length}`;
}

function forumReaderNextPage() {
    if (forumState.currentReaderPage < forumState.readerPages.length - 1) {
        forumState.currentReaderPage++;
        forumRenderReaderPage();
    } else {
        // 尝试进入下一章
        const book = forumState.books.find(b => b.id === forumState.currentBookId);
        if (book && forumState.currentChapterIndex < book.chapters.length - 1) {
            forumOpenReader(forumState.currentChapterIndex + 1);
        } else {
            alert("已经是最后一页了，快去催更吧！");
        }
    }
}

function forumReaderPrevPage() {
    if (forumState.currentReaderPage > 0) {
        forumState.currentReaderPage--;
        forumRenderReaderPage();
    } else {
        // 尝试进入上一章
        if (forumState.currentChapterIndex > 0) {
            forumOpenReader(forumState.currentChapterIndex - 1);
            // 跳转到上一章的最后一页
            setTimeout(() => {
                forumState.currentReaderPage = forumState.readerPages.length - 1;
                forumRenderReaderPage();
            }, 50);
        }
    }
}

function forumToggleReaderMenu() {
    document.getElementById('forum-reader-menu').classList.toggle('active');
}

function forumCloseReader() {
    document.getElementById('forum-reader-overlay').classList.remove('active');
    document.getElementById('forum-reader-menu').classList.remove('active');
    setTimeout(() => document.getElementById('forum-reader-overlay').style.display = 'none', 300);
}

// 新增：切换回帖子模式
function forumSwitchToPostMode() {
    const book = forumState.books.find(b => b.id === forumState.currentBookId);
    if (!book) return;
    
    // 关闭阅读器
    forumCloseReader();
    
    // 打开对应的帖子详情页
    setTimeout(() => {
        forumOpenPostDetail(book.originalPostId);
    }, 300);
}
// ==========================================
// 新增：书城章节点击弹窗与催更逻辑
// ==========================================
let pendingChapterIndex = 0;

// 打开选择阅读模式的弹窗
function forumOpenChapterActionModal(idx) {
    pendingChapterIndex = idx;
    wcOpenModal('forum-chapter-action-modal');
}

// 执行选择的阅读模式
function forumExecuteChapterAction(mode) {
    wcCloseModal('forum-chapter-action-modal');
    
    // 延迟 300ms 等待弹窗收起动画结束，防止页面卡顿
    setTimeout(() => {
        if (mode === 'reader') {
            // 进入全屏阅读器
            forumOpenReader(pendingChapterIndex);
        } else if (mode === 'post') {
            // 进入论坛帖子模式
            const book = forumState.books.find(b => b.id === forumState.currentBookId);
            if (book) {
                forumOpenPostDetail(book.originalPostId);
            }
        }
    }, 300);
}

// 从书城详情页直接触发催更
function forumTriggerUrgeFromBook(postId) {
    forumState.actionPostId = postId;
    document.getElementById('forum-urge-prompt').value = '';
    wcOpenModal('forum-urge-modal');
}
// ==========================================
// 新增：自定义分组逻辑与长按菜单
// ==========================================

// 新增：通讯录当前选中的分组状态
wcState.activeContactsGroup = 'All';

function wcGenerateContactsHeaderHTML() {
    // 动态生成分组 Tab
    let tabsHtml = `<div class="contacts-tab-item ${wcState.activeContactsGroup === 'All' ? 'active' : ''}" onclick="wcSwitchContactsGroup('All')">All</div>`;
    
    (wcState.chatGroups || []).forEach(g => {
        tabsHtml += `<div class="contacts-tab-item ${wcState.activeContactsGroup === g ? 'active' : ''}" onclick="wcSwitchContactsGroup('${g}')">${g}</div>`;
    });

    return `
        <div class="custom-contacts-header">
            <div class="contacts-header-row">
                <div class="contacts-header-left" onclick="closeWechat()">
                    <div class="contacts-home-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 3L4 9v12h5v-7h6v7h5V9z"/>
                        </svg>
                    </div>
                    <div class="contacts-header-title">Contacts</div>
                </div>
            </div>
            <!-- 修改：让分组和关系网图标在同一行，且图标无背景包裹 -->
            <div class="contacts-tabs-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display: flex; gap: 24px; overflow-x: auto; scrollbar-width: none; flex: 1; min-width: 0; -webkit-overflow-scrolling: touch;">
                    ${tabsHtml}
                </div>
                <div onclick="wcOpenRelationNetwork()" style="cursor: pointer; display: flex; align-items: center; justify-content: center; padding-left: 15px; flex-shrink: 0; color: #111;" title="角色关系网">
                    <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 新增：生成角色关系网 Prompt 的核心辅助函数
// ==========================================
function wcGenerateRelationshipPrompt(allowedCharIds = null) {
    if (!wcState.relationships || wcState.relationships.length === 0) return "";
    
    let relTexts = [];
    wcState.relationships.forEach(rel => {
        // 如果传入了允许的角色列表，过滤掉未勾选的角色关系
        if (allowedCharIds) {
            const sourceAllowed = rel.source === 'user' || allowedCharIds.includes(rel.source.toString());
            const targetAllowed = rel.target === 'user' || allowedCharIds.includes(rel.target.toString());
            if (!sourceAllowed || !targetAllowed) return;
        }

        let sourceName = rel.source === 'user' ? (wcState.user.name || 'User') : '未知';
        let targetName = rel.target === 'user' ? (wcState.user.name || 'User') : '未知';
        
        if (rel.source !== 'user') {
            const sChar = wcState.characters.find(c => c.id === rel.source);
            if (sChar) sourceName = sChar.name;
        }
        if (rel.target !== 'user') {
            const tChar = wcState.characters.find(c => c.id === rel.target);
            if (tChar) targetName = tChar.name;
        }
        
        if (sourceName !== '未知' && targetName !== '未知') {
            relTexts.push(`[${sourceName}] 和 [${targetName}] 的关系是：${rel.label}`);
        }
    });
    
    if (relTexts.length > 0) {
        return "【全局角色关系网设定 (请严格遵守这些人物关系，决定他们之间的互动态度，如情侣秀恩爱、仇人互怼等)】:\n" + relTexts.join('\n') + "\n\n";
    }
    return "";
}


function wcSwitchContactsGroup(groupName) {
    wcState.activeContactsGroup = groupName;
    const titleEl = document.getElementById('wc-nav-title');
    if (titleEl && wcState.currentTab === 'contacts') {
        titleEl.innerHTML = wcGenerateContactsHeaderHTML();
    }
    wcRenderContacts();
}

// 动态生成 Header HTML
function wcGenerateChatHeaderHTML() {
    let tabsHtml = `<div class="new-tab ${wcState.activeChatGroup === 'All' ? 'active' : ''}" onclick="wcSwitchChatGroup('All')">All</div>`;
    
    (wcState.chatGroups || []).forEach(g => {
        tabsHtml += `<div class="new-tab ${wcState.activeChatGroup === g ? 'active' : ''}" onclick="wcSwitchChatGroup('${g}')" ontouchstart="wcGroupTouchStart(event, '${g}')" ontouchmove="wcGroupTouchMove(event)" ontouchend="wcGroupTouchEnd()">${g}</div>`;
    });
    
    return `
        <div class="new-chat-header">
            <div class="new-top-bar">
                <div class="new-title" onclick="closeWechat()">
                    <div class="new-title-icon"></div>
                    Message
                </div>
                <div class="new-add-btn" onclick="wcOpenModal('wc-modal-create-choice')">+</div>
            </div>
            <div class="tabs-container">
                <div class="tabs-scroll">
                    ${tabsHtml}
                </div>
                <div class="tab-add-star" onclick="wcAddChatGroup()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </div>
            </div>
        </div>
    `;
}

// 切换分组
function wcSwitchChatGroup(groupName) {
    wcState.activeChatGroup = groupName;
    const titleEl = document.getElementById('wc-nav-title');
    if (titleEl) titleEl.innerHTML = wcGenerateChatHeaderHTML();
    wcRenderChats();
}

// 添加新分组
function wcAddChatGroup() {
    wcOpenGeneralInput("创建新分组", (name) => {
        if (name && name.trim() !== "") {
            const trimmedName = name.trim();
            if (!wcState.chatGroups) wcState.chatGroups = [];
            if (!wcState.chatGroups.includes(trimmedName) && trimmedName !== 'All') {
                wcState.chatGroups.push(trimmedName);
                wcSaveData();
                wcSwitchChatGroup(trimmedName);
            } else {
                alert("分组名称已存在或无效！");
            }
        }
    });
}

// 长按分组触发菜单
let wcGroupTouchStartX = 0;
let wcGroupTouchStartY = 0;

window.wcGroupTouchStart = function(e, groupName) {
    const touch = e.touches[0];
    wcGroupTouchStartX = touch.clientX;
    wcGroupTouchStartY = touch.clientY;
    
    wcState.groupLongPressTimer = setTimeout(() => {
        wcShowGroupContextMenu(touch.clientX, touch.clientY, groupName);
        wcState.groupLongPressTimer = null;
    }, 500);
};

window.wcGroupTouchMove = function(e) {
    if (wcState.groupLongPressTimer) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - wcGroupTouchStartX);
        const dy = Math.abs(touch.clientY - wcGroupTouchStartY);
        // 如果滑动超过 10px，取消长按，允许原生滑动
        if (dx > 10 || dy > 10) {
            clearTimeout(wcState.groupLongPressTimer);
            wcState.groupLongPressTimer = null;
        }
    }
};

window.wcGroupTouchEnd = function() {
    if (wcState.groupLongPressTimer) {
        clearTimeout(wcState.groupLongPressTimer);
        wcState.groupLongPressTimer = null;
    }
};

// 显示分组菜单
function wcShowGroupContextMenu(x, y, groupName) {
    wcState.selectedGroupName = groupName;
    let menu = document.getElementById('wc-group-context-menu');
    
    const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:10px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const deleteSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:10px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    // 如果菜单不存在，动态创建
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'wc-group-context-menu';
        menu.style.cssText = 'position: absolute; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(15px); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 3000; display: none; flex-direction: column; min-width: 140px; overflow: hidden;';
        document.body.appendChild(menu);
    }
    
    menu.innerHTML = `
        <div style="padding: 12px 16px; font-size: 15px; color: #000; border-bottom: 0.5px solid rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center;" onclick="wcEditChatGroup()">
            ${editSvg} 编辑分组
        </div>
        <div style="padding: 12px 16px; font-size: 15px; color: #FF3B30; cursor: pointer; display: flex; align-items: center;" onclick="wcDeleteChatGroup()">
            ${deleteSvg} 删除分组
        </div>
    `;

    const menuWidth = 130;
    const menuHeight = 90;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    if (x + menuWidth > screenW) x = screenW - menuWidth - 10;
    if (y + menuHeight > screenH) y = screenH - menuHeight - 10;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'flex';
}

// 隐藏分组菜单
document.addEventListener('click', (e) => {
    const menu = document.getElementById('wc-group-context-menu');
    if (menu && !e.target.closest('.new-tab')) {
        menu.style.display = 'none';
    }
});


// 编辑分组
function wcEditChatGroup() {
    const oldName = wcState.selectedGroupName;
    if (!oldName) return;
    
    document.getElementById('wc-group-context-menu').style.display = 'none';
    
    wcOpenGeneralInput("重命名分组", (newName) => {
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedName = newName.trim();
            if (wcState.chatGroups.includes(trimmedName) || trimmedName === 'All') {
                return alert("分组名已存在或无效");
            }
            const idx = wcState.chatGroups.indexOf(oldName);
            if (idx !== -1) wcState.chatGroups[idx] = trimmedName;
            
            // 更新角色所属分组
            wcState.characters.forEach(c => {
                if (c.groupName === oldName) c.groupName = trimmedName;
            });
            
            if (wcState.activeChatGroup === oldName) wcState.activeChatGroup = trimmedName;
            
            wcSaveData();
            const titleEl = document.getElementById('wc-nav-title');
            if (titleEl) titleEl.innerHTML = wcGenerateChatHeaderHTML();
            wcRenderChats();
        }
    });
}

// 删除分组
function wcDeleteChatGroup() {
    const groupName = wcState.selectedGroupName;
    if (!groupName) return;
    
    document.getElementById('wc-group-context-menu').style.display = 'none';
    
    if (confirm(`确定要删除分组 "${groupName}" 吗？\n该分组下的角色将回到 All 列表。`)) {
        wcState.chatGroups = wcState.chatGroups.filter(g => g !== groupName);
        
        // 将角色移回 All
        wcState.characters.forEach(c => {
            if (c.groupName === groupName) c.groupName = 'All';
        });
        
        if (wcState.activeChatGroup === groupName) wcState.activeChatGroup = 'All';
        
        wcSaveData();
        const titleEl = document.getElementById('wc-nav-title');
        if (titleEl) titleEl.innerHTML = wcGenerateChatHeaderHTML();
        wcRenderChats();
    }
}

// 打开分配分组弹窗
function wcOpenAssignGroupModal(charId) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;
    
    let modal = document.getElementById('wc-modal-assign-group');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-modal-assign-group';
        // 🔪 核心修复：将 z-index 提升到 100000，绝对保证在最顶层！
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 100000; display: none; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;';
        document.body.appendChild(modal);
    }
    
    let optionsHtml = `<div style="padding: 16px; font-size: 16px; color: #007AFF; cursor: pointer; border-bottom: 1px solid #ddd;" onclick="wcAssignGroup(${charId}, 'All')">All (默认)</div>`;
    (wcState.chatGroups || []).forEach(g => {
        optionsHtml += `<div style="padding: 16px; font-size: 16px; color: #007AFF; cursor: pointer; border-bottom: 1px solid #ddd;" onclick="wcAssignGroup(${charId}, '${g}')">${g}</div>`;
    });
    
    modal.innerHTML = `
        <div style="background: rgba(245, 245, 245, 0.95); backdrop-filter: blur(20px); width: 270px; border-radius: 14px; overflow: hidden; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);" onclick="event.stopPropagation();">
            <div style="padding: 20px 16px 15px 16px; font-weight: 600; font-size: 16px; color: #000; border-bottom: 1px solid #ddd;">移动到分组</div>
            <div style="display: flex; flex-direction: column; max-height: 250px; overflow-y: auto;">
                ${optionsHtml}
            </div>
            <div style="padding: 16px; font-size: 16px; font-weight: 600; color: #FF3B30; cursor: pointer;" onclick="closeAssignGroupModal()">取消</div>
        </div>
    `;
    
    // 点击半透明黑色背景也可以关闭弹窗
    modal.onclick = closeAssignGroupModal;
    
    modal.style.display = 'flex';
    // 延迟改变透明度，触发淡入动画
    setTimeout(() => modal.style.opacity = '1', 10);
}

// 独立的关闭弹窗函数
window.closeAssignGroupModal = function() {
    const modal = document.getElementById('wc-modal-assign-group');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 200);
    }
};

// 执行分配分组
window.wcAssignGroup = function(charId, groupName) {
    try {
        const char = wcState.characters.find(c => c.id === charId);
        if (char) {
            char.groupName = groupName;
            wcSaveData();
            wcRenderChats();
        }
    } catch (e) {
        console.error("分组保存失败:", e);
    } finally {
        // 🔪 核心修复：无论前面执行是否卡顿，最后一步绝对强制关闭弹窗！
        window.closeAssignGroupModal();
    }
};
// ==========================================
// 新增：角色会话长按菜单 (置顶 / 分组)
// ==========================================
let wcChatLongPressTimer = null;

function wcChatTouchStart(e, charId) {
    wcChatLongPressTimer = setTimeout(() => {
        const touch = e.touches[0];
        wcShowChatContextMenu(touch.clientX, touch.clientY, charId);
    }, 500);
}

function wcChatTouchEnd() {
    if (wcChatLongPressTimer) {
        clearTimeout(wcChatLongPressTimer);
        wcChatLongPressTimer = null;
    }
}

function wcShowChatContextMenu(eOrX, yOrCharId, charIdIfTouch) {
    let x, y, charId;
    if (typeof eOrX === 'object') {
        eOrX.preventDefault(); // 阻止电脑端默认右键菜单
        x = eOrX.pageX;
        y = eOrX.pageY;
        charId = yOrCharId;
    } else {
        x = eOrX;
        y = yOrCharId;
        charId = charIdIfTouch;
    }

    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    let menu = document.getElementById('wc-chat-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'wc-chat-context-menu';
        menu.style.cssText = 'position: absolute; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(15px); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 3000; display: none; flex-direction: column; min-width: 140px; overflow: hidden;';
        document.body.appendChild(menu);
    }

    const pinText = char.isPinned ? "取消置顶" : "置顶会话";
    const pinSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:10px;"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 11.2V6a3 3 0 0 0-6 0v5.2a2 2 0 0 1-1.11 1.35l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`;
    const groupSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:10px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    // 🔪 新增：删除角色的垃圾桶图标
    const deleteSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:10px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    menu.innerHTML = `
        <div style="padding: 12px 16px; font-size: 15px; color: #000; border-bottom: 0.5px solid rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center;" onclick="wcTogglePin(${charId}); document.getElementById('wc-chat-context-menu').style.display='none';">
            ${pinSvg} ${pinText}
        </div>
        <div style="padding: 12px 16px; font-size: 15px; color: #000; border-bottom: 0.5px solid rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center;" onclick="wcOpenAssignGroupModal(${charId}); document.getElementById('wc-chat-context-menu').style.display='none';">
            ${groupSvg} 移动分组
        </div>
        <div style="padding: 12px 16px; font-size: 15px; color: #FF3B30; cursor: pointer; display: flex; align-items: center;" onclick="wcDeleteCharacter(${charId}); document.getElementById('wc-chat-context-menu').style.display='none';">
            ${deleteSvg} 删除角色
        </div>
    `;

    const menuWidth = 140;
    const menuHeight = 140; // 增加了菜单项，高度稍微调大一点
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    if (x + menuWidth > screenW) x = screenW - menuWidth - 10;
    if (y + menuHeight > screenH) y = screenH - menuHeight - 10;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'flex';
}

// 全局点击隐藏所有菜单
document.addEventListener('click', (e) => {
    const groupMenu = document.getElementById('wc-group-context-menu');
    if (groupMenu && !e.target.closest('.new-tab')) {
        groupMenu.style.display = 'none';
    }
    
    const chatMenu = document.getElementById('wc-chat-context-menu');
    if (chatMenu && !e.target.closest('.wc-chat-swipe-content')) {
        chatMenu.style.display = 'none';
    }
});
// 覆盖 wcPostMoment 函数以支持分组
window.wcPostMoment = function() {
    const text = document.getElementById('wc-input-moment-text').value.trim();
    // 修复：使用正确的 ID
    const descInput = document.getElementById('wc-input-moment-desc');
    const imageDesc = descInput ? descInput.value.trim() : '';
    const groupSelect = document.getElementById('wc-input-moment-group');
    const visibleGroup = groupSelect ? groupSelect.value : 'All';

    if (!text && !wcState.tempImage && !imageDesc) {
        alert("请填写内容或上传图片");
        return;
    }

    const newMoment = {
        id: Date.now(),
        name: wcState.user.name,
        avatar: wcState.user.avatar,
        text: text,
        image: wcState.tempImage || null,
        imageDesc: imageDesc || null,
        time: Date.now(),
        likes: [],
        comments: [],
        visibleGroup: visibleGroup // 新增可见分组字段
    };

    wcState.moments.unshift(newMoment);
    wcSaveData();
    wcRenderMoments();
    
    // 清空状态
    document.getElementById('wc-input-moment-text').value = '';
    if (descInput) descInput.value = '';
    if (typeof wcClearMomentImage === 'function') wcClearMomentImage();
    
    wcCloseModal('wc-modal-post-moment');
};

// ==========================================
// 角色关系网 (Spider Web) 核心逻辑
// ==========================================
let rnNodes = [];
let rnNodeElements = {};
let rnLabelElements = [];
let rnCanvas, rnCtx;
let rnWidth = 0, rnHeight = 0;

function wcOpenRelationNetwork() {
    if (wcState.activeContactsGroup === 'All') {
        alert("All分组默认不可以绑定关系网，请先切换到具体的分组哦~");
        return;
    }
    const modal = document.getElementById('wc-modal-relation-network');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    // 默认切回关系网视图
    wcSwitchMapMode('network');
    
    // 延迟初始化，确保容器有宽高
    setTimeout(() => {
        wcInitRelationData();
        wcRenderRelationNetwork();
    }, 300);
}

// ==========================================
// 🌟 新增：双位面地图系统 (现实 vs 异世界)
// ==========================================
let realWorldMapInstance = null;
let realWorldMarkers = [];

// 切换地图模式
window.wcSwitchMapMode = function(mode) {
    // 更新按钮状态
    document.querySelectorAll('.rn-tool-btn').forEach(btn => {
        btn.style.color = '#8E8E93';
        btn.style.transform = 'scale(1)';
    });
    const activeBtn = document.getElementById(`rn-tab-${mode}`);
    if (activeBtn) {
        activeBtn.style.color = '#111';
        activeBtn.style.transform = 'scale(1.1)';
    }

    const canvas = document.getElementById('rn-canvas');
    const realMap = document.getElementById('real-map');
    const virtualMap = document.getElementById('virtual-map');

    if (mode === 'network') {
        canvas.style.display = 'block';
        realMap.style.display = 'none';
        virtualMap.style.display = 'none';
        Object.values(rnNodeElements).forEach(el => el.style.display = 'flex');
        rnLabelElements.forEach(item => item.el.style.display = 'block');
    } else if (mode === 'real') {
        canvas.style.display = 'none';
        realMap.style.display = 'block';
        virtualMap.style.display = 'none';
        Object.values(rnNodeElements).forEach(el => el.style.display = 'none');
        rnLabelElements.forEach(item => item.el.style.display = 'none');
        
        renderRealWorldMap();
    } else if (mode === 'virtual') {
        canvas.style.display = 'none';
        realMap.style.display = 'none';
        virtualMap.style.display = 'block';
        Object.values(rnNodeElements).forEach(el => el.style.display = 'none');
        rnLabelElements.forEach(item => item.el.style.display = 'none');
        
        checkAndRenderVirtualMap();
    }
};

// 渲染现实世界地图
async function renderRealWorldMap() {
    if (typeof L === 'undefined') return;

    if (!realWorldMapInstance) {
        realWorldMapInstance = L.map('real-map', { zoomControl: false, attributionControl: false }).setView([35.0, 105.0], 3);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(realWorldMapInstance);
    }
    
    setTimeout(() => realWorldMapInstance.invalidateSize(), 100);

    // 清理旧 Marker
    realWorldMarkers.forEach(m => realWorldMapInstance.removeLayer(m));
    realWorldMarkers = [];

    // 筛选现实角色 (当前分组)
    const realChars = wcState.characters.filter(c => !c.isGroup && c.groupName === wcState.activeContactsGroup && c.chatConfig && c.chatConfig.locationType === 'real' && c.chatConfig.locationLat);

    for (const char of realChars) {
        const customIcon = L.divIcon({
            className: 'custom-marker-wrap',
            html: `<img src="${char.avatar}" class="custom-avatar-marker">`,
            iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -20]
        });

        const marker = L.marker([char.chatConfig.locationLat, char.chatConfig.locationLon], { icon: customIcon }).addTo(realWorldMapInstance);
        realWorldMarkers.push(marker);

        // 异步获取天气并绑定 Popup
        const weather = await getRealWeather(char.chatConfig.locationLat, char.chatConfig.locationLon);
        let weatherStr = "天气未知";
        if (weather) weatherStr = `${getWeatherEmoji(weather.weathercode)} ${Math.round(weather.temperature)}°C`;

        const actionStr = (char.lifeStatus && char.lifeStatus.action !== "未知") ? char.lifeStatus.action : "正在忙碌...";

        const popupHtml = `
            <div class="map-popup-card">
                <div class="popup-header">
                    <img src="${char.avatar}" class="popup-avatar">
                    <div>
                        <div class="popup-name">${char.name}</div>
                        <div class="popup-loc"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${char.chatConfig.locationName}</div>
                    </div>
                </div>
                <div class="popup-weather-row">
                    <div class="popup-w-left">${weatherStr}</div>
                    <div class="popup-w-right">现实位面</div>
                </div>
                <div class="popup-action">“${actionStr}”</div>
                <button class="popup-btn" onclick="wcCloseRelationNetwork(); setTimeout(()=>wcOpenChat(${char.id}), 300);">发消息</button>
            </div>
        `;
        marker.bindPopup(popupHtml);
    }
}

// ==========================================
// 🌟 异世界地图生成与渲染 (Virtual Map)
// ==========================================
function checkAndRenderVirtualMap() {
    const vMap = document.getElementById('virtual-map');
    
    // 如果已经有数据，直接渲染
    if (wcState.virtualWorldData && wcState.virtualWorldData.locations) {
        renderVirtualMapDOM();
    } else {
        // 没有数据，提示生成
        vMap.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 10; width: 80%;">
                <div style="color: #FFF; font-size: 16px; font-weight: bold; margin-bottom: 10px; letter-spacing: 2px;">异世界坐标未建立</div>
                <div style="color: #888; font-size: 12px; margin-bottom: 20px;">需要调取世界书与人设，构建虚拟城市与街道</div>
                <button onclick="openVirtualMapGenModal()" style="background: #AF52DE; color: #FFF; border: none; padding: 10px 24px; border-radius: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(175,82,222,0.4);">构建异世界</button>
            </div>
        `;
    }
}

// 打开生成设置弹窗
window.openVirtualMapGenModal = function() {
    let modal = document.getElementById('wc-modal-vmap-gen');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-modal-vmap-gen';
        modal.className = 'wc-modal hidden';
        modal.style.zIndex = '36000';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="wc-modal-content" style="background: #FFF; padding: 24px; border-radius: 20px; width: 85%; max-width: 340px;">
            <h3 style="margin-top: 0; text-align: center; color: #111; margin-bottom: 20px;">构建异世界坐标</h3>
            <div class="wc-form-group">
                <label class="wc-form-label" style="font-weight: bold; color: #111;">关联世界书 (提供城市/街道背景)</label>
                <div class="ins-wb-select-btn" onclick="openGlobalWbModal('vmap-wb-list', 'vmap-wb-count')">
                    <span class="title">选择要关联的世界书</span>
                    <span class="count" id="vmap-wb-count">已选 0 项</span>
                </div>
                <div id="vmap-wb-list" style="display: none;"></div>
            </div>
            <div style="font-size: 12px; color: #888; margin-bottom: 20px; line-height: 1.5;">
                AI 将读取当前分组下所有设定为“虚拟位置”的角色，并结合世界书，为你生成一个包含具体小区、街道、房屋的虚拟地图。
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="wc-btn-secondary" style="flex: 1; margin: 0; border-radius: 12px; padding: 12px; font-weight: bold;" onclick="wcCloseModal('wc-modal-vmap-gen')">取消</button>
                <button class="wc-btn-primary" style="flex: 1; margin: 0; border-radius: 12px; padding: 12px; background: #AF52DE; font-weight: bold;" onclick="generateVirtualMapData()">开始构建</button>
            </div>
        </div>
    `;
    wcOpenModal('wc-modal-vmap-gen');
};

// 调用 API 生成虚拟地图数据
window.generateVirtualMapData = async function() {
    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    // 筛选出当前分组下，所有设定为虚拟位置的角色
    const virtualChars = wcState.characters.filter(c => !c.isGroup && c.groupName === wcState.activeContactsGroup && c.chatConfig && c.chatConfig.locationType === 'virtual');
    if (virtualChars.length === 0) {
        alert("当前分组没有设定为【虚拟位置】的角色哦，请先在聊天设置中修改 Ta 的城市设定。");
        wcCloseModal('wc-modal-vmap-gen');
        return;
    }

    wcCloseModal('wc-modal-vmap-gen');
    wcShowLoading("正在构建异世界城市与街道...");

    try {
        // 读取勾选的世界书
        let wbInfo = "";
        const wbCheckboxes = document.querySelectorAll('#vmap-wb-list input[type="checkbox"]:checked');
        const selectedWbIds = Array.from(wbCheckboxes).map(cb => cb.value);
        if (selectedWbIds.length > 0) {
            const linkedWbs = worldbookEntries.filter(e => selectedWbIds.includes(e.id.toString()));
            wbInfo = "【世界观背景参考】:\n" + linkedWbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
        }

        const charInfo = virtualChars.map(c => `- ${c.name} (设定位置: ${c.chatConfig.locationName || '未知'})：${c.prompt.substring(0, 100)}...`).join('\n');

        let prompt = `你是一个虚拟世界地图构建引擎。请根据以下世界观和角色设定，生成一个具体的虚拟地图。\n\n`;
        prompt += wbInfo;
        prompt += `【需要安置在地图上的角色】：\n${charInfo}\n\n`;
        prompt += `【任务要求】：\n`;
        prompt += `1. 根据世界观，生成一个符合背景的整体天气 (weather)。\n`;
        prompt += `2. 生成 4-6 个具体的地点 (locations)，必须包含具体的城市、街道、小区或房屋名称（例如：赛博朋克背景可以是“霓虹街404号公寓”；修仙背景可以是“云隐宗外门弟子居所”）。\n`;
        prompt += `3. 为每个地点分配一个 X 和 Y 坐标（范围 10 到 90，代表在屏幕上的百分比位置，尽量分散）。\n`;
        prompt += `4. 将上面的【角色】合理地分配到这些地点中（通过 charId 绑定）。\n`;
        prompt += `5. 返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "weather": {"temp": "24°C", "desc": "酸雨 / 灵气风暴"},
  "locations": [
    {
      "id": "loc_1",
      "name": "霓虹街404号公寓",
      "desc": "破旧但充满科技感的单人公寓",
      "x": 20,
      "y": 30,
      "chars": [
        {"charId": 角色ID数字, "action": "正在改装义体"}
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
                temperature: 0.8
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        wcState.virtualWorldData = JSON.parse(content);
        wcSaveData();
        
        renderVirtualMapDOM();
        wcShowSuccess("异世界构建完成！");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[地图构建失败] ${e.message}`);
        else wcShowError("构建失败");
    }
};

// 渲染虚拟地图 DOM
function renderVirtualMapDOM() {
    const vMap = document.getElementById('virtual-map');
    vMap.innerHTML = ''; 

    // 添加重构按钮
    const rebuildBtn = document.createElement('div');
    rebuildBtn.style.cssText = 'position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); color: #FFF; padding: 6px 12px; border-radius: 12px; font-size: 10px; cursor: pointer; z-index: 10; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(4px);';
    rebuildBtn.innerText = '重构世界';
    rebuildBtn.onclick = openVirtualMapGenModal;
    vMap.appendChild(rebuildBtn);

    const data = wcState.virtualWorldData;
    if (!data || !data.locations) return;

    data.locations.forEach(loc => {
        // 渲染地点节点 (发光小点)
        const locNode = document.createElement('div');
        locNode.style.cssText = `position: absolute; left: ${loc.x}%; top: ${loc.y}%; width: 8px; height: 8px; background: #AF52DE; border-radius: 50%; box-shadow: 0 0 10px #AF52DE; transform: translate(-50%, -50%); z-index: 3;`;
        
        // 地点名称标签
        const locLabel = document.createElement('div');
        locLabel.style.cssText = `position: absolute; left: ${loc.x}%; top: calc(${loc.y}% + 10px); transform: translateX(-50%); color: rgba(255,255,255,0.6); font-size: 9px; white-space: nowrap; z-index: 3; font-family: monospace;`;
        locLabel.innerText = loc.name;
        
        vMap.appendChild(locNode);
        vMap.appendChild(locLabel);

        // 渲染该地点上的角色
        if (loc.chars && loc.chars.length > 0) {
            loc.chars.forEach((cData, idx) => {
                const char = wcState.characters.find(c => c.id.toString() === cData.charId.toString());
                if (!char) return;

                // 稍微偏移一下，防止多个角色重叠
                const offsetX = (idx * 15) - 15;
                const offsetY = -30;

                const avatarWrap = document.createElement('div');
                avatarWrap.className = 'virtual-avatar-wrap';
                avatarWrap.style.left = `calc(${loc.x}% + ${offsetX}px)`;
                avatarWrap.style.top = `calc(${loc.y}% + ${offsetY}px)`;
                avatarWrap.style.animationDelay = `${Math.random() * 2}s`;

                avatarWrap.innerHTML = `
                    <img src="${char.avatar}">
                    <div class="virtual-avatar-name">${char.name}</div>
                `;

                // 点击弹出异世界卡片
                avatarWrap.onclick = () => {
                    showVirtualPopup(char, loc, cData.action, data.weather);
                };

                vMap.appendChild(avatarWrap);
            });
        }
    });
}

// 显示异世界信息卡片
window.showVirtualPopup = function(char, loc, action, weather) {
    let popup = document.getElementById('virtual-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'virtual-popup';
        popup.className = 'virtual-popup';
        document.getElementById('virtual-map').appendChild(popup);
    }

    const weatherStr = weather ? `${weather.desc} ${weather.temp}` : '异星气候';

    popup.innerHTML = `
        <div class="virtual-close" onclick="document.getElementById('virtual-popup').classList.remove('active')">×</div>
        <div class="popup-header">
            <img src="${char.avatar}" class="popup-avatar">
            <div>
                <div class="popup-name">${char.name}</div>
                <div class="popup-loc">
                    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>${loc.name}</span>
                </div>
            </div>
        </div>
        <div class="popup-weather-row">
            <div class="popup-w-left">✨ ${weatherStr}</div>
            <div class="popup-w-right">跨越次元</div>
        </div>
        <div class="popup-action">“${action || '正在发呆'}”</div>
        <div style="font-size: 10px; color: #888; margin-top: -4px; font-style: italic;">${loc.desc}</div>
        <button class="popup-btn" onclick="wcCloseRelationNetwork(); setTimeout(()=>wcOpenChat(${char.id}), 300);">跨次元通讯</button>
    `;

    popup.classList.add('active');
};

function wcCloseRelationNetwork() {
    const modal = document.getElementById('wc-modal-relation-network');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 400);
}

function wcInitRelationData() {
    const container = document.getElementById('rn-container');
    rnWidth = container.clientWidth;
    rnHeight = container.clientHeight;
    
    rnCanvas = document.getElementById('rn-canvas');
    rnCtx = rnCanvas.getContext('2d');
    
    // 处理高分屏模糊问题
    const dpr = window.devicePixelRatio || 1;
    rnCanvas.width = rnWidth * dpr;
    rnCanvas.height = rnHeight * dpr;
    rnCtx.scale(dpr, dpr);
    
    rnNodes = [];
    
    // 1. 提取当前分组的角色
    const filteredChars = wcState.characters.filter(c => {
        if (c.isGroup) return false; // 排除群聊
        if (wcState.activeContactsGroup === 'All') return true;
        return c.groupName === wcState.activeContactsGroup;
    });

    // 2. 加入 User 节点
    if (!wcState.user.relX) {
        wcState.user.relX = rnWidth / 2;
        wcState.user.relY = rnHeight / 2;
    }
    rnNodes.push({
        id: 'user',
        name: wcState.user.name,
        avatar: wcState.user.avatar,
        x: wcState.user.relX,
        y: wcState.user.relY,
        isUser: true,
        ref: wcState.user
    });

    // 3. 加入 Char 节点
    filteredChars.forEach((char, index) => {
        if (!char.relX || !char.relY) {
            // 如果没有坐标，环绕 User 随机排布
            const angle = (index / filteredChars.length) * Math.PI * 2;
            const radius = 120 + Math.random() * 50;
            char.relX = (rnWidth / 2) + Math.cos(angle) * radius;
            char.relY = (rnHeight / 2) + Math.sin(angle) * radius;
        }
        rnNodes.push({
            id: char.id,
            name: char.name,
            avatar: char.avatar,
            x: char.relX,
            y: char.relY,
            isUser: false,
            ref: char
        });
    });
}

function wcRenderRelationNetwork() {
    const container = document.getElementById('rn-container');
    // 清理旧的 DOM 节点
    Object.values(rnNodeElements).forEach(el => el.remove());
    rnLabelElements.forEach(item => item.el.remove());
    rnNodeElements = {};
    rnLabelElements = [];

    // 渲染节点 DOM
    rnNodes.forEach(node => {
        const el = document.createElement('div');
        el.className = `rn-node ${node.isUser ? 'is-user' : ''}`;
        el.innerHTML = `
            <img src="${node.avatar}">
            <div class="rn-node-name">${node.name}</div>
        `;
        container.appendChild(el);
        rnNodeElements[node.id] = el;

        // 绑定拖拽事件
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const startDrag = (e) => {
            isDragging = true;
            el.style.zIndex = 10;
            const touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
            initialX = node.x;
            initialY = node.y;
        };

        const moveDrag = (e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            
            node.x = initialX + dx;
            node.y = initialY + dy;
            
            // 边界限制
            if (node.x < 30) node.x = 30;
            if (node.x > rnWidth - 30) node.x = rnWidth - 30;
            if (node.y < 30) node.y = 30;
            if (node.y > rnHeight - 30) node.y = rnHeight - 30;

            wcUpdateRelationPositions();
        };

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            el.style.zIndex = node.isUser ? 3 : 2;
            // 保存坐标到数据源
            node.ref.relX = node.x;
            node.ref.relY = node.y;
            wcSaveData();
        };

        el.addEventListener('mousedown', startDrag);
        window.addEventListener('mousemove', moveDrag);
        window.addEventListener('mouseup', endDrag);

        el.addEventListener('touchstart', startDrag, {passive: false});
        window.addEventListener('touchmove', moveDrag, {passive: false});
        window.addEventListener('touchend', endDrag);
    });

    // 渲染关系标签 DOM
    if (!wcState.relationships) wcState.relationships = [];
    
    wcState.relationships.forEach((rel, index) => {
        // 检查两个节点是否都在当前视图中
        const sourceNode = rnNodes.find(n => n.id === rel.source);
        const targetNode = rnNodes.find(n => n.id === rel.target);
        
        if (sourceNode && targetNode) {
            const el = document.createElement('div');
            el.className = 'rn-label';
            el.innerText = rel.label;
            el.onclick = () => wcDeleteRelation(index); // 点击删除关系
            container.appendChild(el);
            rnLabelElements.push({ rel, el, sourceNode, targetNode });
        }
    });

    wcUpdateRelationPositions();
}

function wcUpdateRelationPositions() {
    // 更新节点位置
    rnNodes.forEach(node => {
        const el = rnNodeElements[node.id];
        if (el) {
            el.style.left = node.x + 'px';
            el.style.top = node.y + 'px';
        }
    });

    // 绘制连线
    rnCtx.clearRect(0, 0, rnWidth, rnHeight);
    rnLabelElements.forEach(item => {
        rnCtx.beginPath();
        rnCtx.moveTo(item.sourceNode.x, item.sourceNode.y);
        rnCtx.lineTo(item.targetNode.x, item.targetNode.y);
        rnCtx.strokeStyle = '#D1D1D6';
        rnCtx.lineWidth = 2;
        rnCtx.stroke();

        // 更新标签位置 (居中)
        const midX = (item.sourceNode.x + item.targetNode.x) / 2;
        const midY = (item.sourceNode.y + item.targetNode.y) / 2;
        item.el.style.left = midX + 'px';
        item.el.style.top = midY + 'px';
    });
}

// --- 添加与删除关系 ---
function wcOpenManageRelationModal() {
    const list = document.getElementById('rn-manage-list');
    list.innerHTML = '';
    
    if (!wcState.relationships || wcState.relationships.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">暂无绑定的关系</div>';
    } else {
        wcState.relationships.forEach((rel, index) => {
            let sourceName = rel.source === 'user' ? wcState.user.name : '未知';
            let targetName = rel.target === 'user' ? wcState.user.name : '未知';
            
            if (rel.source !== 'user') {
                const sChar = wcState.characters.find(c => c.id === rel.source);
                if (sChar) sourceName = sChar.name;
            }
            if (rel.target !== 'user') {
                const tChar = wcState.characters.find(c => c.id === rel.target);
                if (tChar) targetName = tChar.name;
            }
            
            const div = document.createElement('div');
            div.className = 'wc-list-item';
            div.style.background = 'white';
            div.style.borderBottom = '1px solid #F0F0F0';
            div.innerHTML = `
                <div class="wc-item-content">
                    <div class="wc-item-title" style="font-size: 14px;">${sourceName} ↔ ${targetName}</div>
                    <div class="wc-item-subtitle" style="color: #007AFF;">${rel.label}</div>
                </div>
                <button class="wc-btn-mini" style="background:#FF3B30; color:white; border:none; padding:6px 12px; border-radius:12px; font-weight:bold;" onclick="wcDeleteRelationFromManage(${index})">删除</button>
            `;
            list.appendChild(div);
        });
    }
    
    wcOpenModal('wc-modal-manage-relation');
}

function wcDeleteRelationFromManage(index) {
    if (confirm("确定要解除这段关系吗？")) {
        wcState.relationships.splice(index, 1);
        wcSaveData();
        wcRenderRelationNetwork();
        wcOpenManageRelationModal(); // 刷新列表
    }
}

function wcOpenAddRelationModal() {
    const selectA = document.getElementById('rn-char-a');
    const selectB = document.getElementById('rn-char-b');
    selectA.innerHTML = '';
    selectB.innerHTML = '';

    rnNodes.forEach(node => {
        const optA = document.createElement('option');
        optA.value = node.id; optA.innerText = node.name;
        selectA.appendChild(optA);
        
        const optB = document.createElement('option');
        optB.value = node.id; optB.innerText = node.name;
        selectB.appendChild(optB);
    });

    document.getElementById('rn-relation-label').value = '';
    wcOpenModal('wc-modal-add-relation');
}

function wcSaveRelation() {
    const source = document.getElementById('rn-char-a').value;
    const target = document.getElementById('rn-char-b').value;
    const label = document.getElementById('rn-relation-label').value.trim();

    if (source === target) return alert("不能和自己绑定关系哦~");
    if (!label) return alert("请输入关系描述");

    // 转换 ID 类型 (User 是 string, Char 是 number)
    const parsedSource = source === 'user' ? 'user' : parseInt(source);
    const parsedTarget = target === 'user' ? 'user' : parseInt(target);

    // 检查是否已存在
    const exists = wcState.relationships.find(r => 
        (r.source === parsedSource && r.target === parsedTarget) || 
        (r.source === parsedTarget && r.target === parsedSource)
    );

    if (exists) {
        exists.label = label; // 更新标签
    } else {
        wcState.relationships.push({ source: parsedSource, target: parsedTarget, label });
    }

    wcSaveData();
    wcCloseModal('wc-modal-add-relation');
    wcRenderRelationNetwork();
}

function wcDeleteRelation(index) {
    if (confirm("确定要解除这段关系吗？")) {
        wcState.relationships.splice(index, 1);
        wcSaveData();
        wcRenderRelationNetwork();
    }
}

// --- 一键整理排版 (环形布局) ---
function wcAutoLayoutRelation() {
    const centerX = rnWidth / 2;
    const centerY = rnHeight / 2;
    const radius = Math.min(rnWidth, rnHeight) * 0.35;

    const userNode = rnNodes.find(n => n.isUser);
    if (userNode) {
        userNode.x = centerX;
        userNode.y = centerY;
        userNode.ref.relX = centerX;
        userNode.ref.relY = centerY;
    }

    const otherNodes = rnNodes.filter(n => !n.isUser);
    otherNodes.forEach((node, index) => {
        const angle = (index / otherNodes.length) * Math.PI * 2;
        node.x = centerX + Math.cos(angle) * radius;
        node.y = centerY + Math.sin(angle) * radius;
        node.ref.relX = node.x;
        node.ref.relY = node.y;
    });

    wcSaveData();
    wcUpdateRelationPositions();
}
// ==========================================
// 恋人空间：专属商城 (Couple Shop) 逻辑
// ==========================================

// 初始化默认数据 (分类 + 菜品)
function lsInitShopData() {
    if (!lsState.shopCategories || lsState.shopCategories.length === 0) {
        lsState.shopCategories = [
            { id: 'cat_1', name: '互动' },
            { id: 'cat_2', name: '心情' }
        ];
        lsState.activeShopCategoryId = 'cat_1';
    }
    if (!lsState.shopMenu || lsState.shopMenu.length === 0) {
        lsState.shopMenu = [
            { id: 1, categoryId: 'cat_1', name: '聊天', sales: 99 },
            { id: 2, categoryId: 'cat_1', name: '和好卷', sales: 52 },
            { id: 3, categoryId: 'cat_1', name: '亲亲卷', sales: 128 },
            { id: 4, categoryId: 'cat_1', name: '抱抱卷', sales: 88 },
            { id: 5, categoryId: 'cat_1', name: '打电话', sales: 30 },
            { id: 6, categoryId: 'cat_2', name: '讨厌', sales: 0 },
            { id: 7, categoryId: 'cat_2', name: '兴奋', sales: 15 }
        ];
    }
    if (!lsState.activeShopCategoryId && lsState.shopCategories.length > 0) {
        lsState.activeShopCategoryId = lsState.shopCategories[0].id;
    }
    if (!lsState.shopCart) lsState.shopCart = [];
    if (!lsState.shopOrders) lsState.shopOrders = [];
    lsState.isShopEditMode = false;
}

// 打开商城全屏页
function lsOpenShopView() {
    if (!lsState.boundCharId) {
        alert("请先在首页绑定一位恋人哦~");
        return;
    }
    lsInitShopData();
    document.getElementById('ls-view-main').classList.remove('active');
    document.getElementById('ls-view-shop').classList.add('active');
    lsSwitchShopTab('kitchen'); 
    lsRenderShopSidebar();
    lsRenderShopMenu();
    lsUpdateCartBadge();
}

function lsCloseShopView() {
    document.getElementById('ls-view-shop').classList.remove('active');
    document.getElementById('ls-view-main').classList.add('active');
}

function lsSwitchShopTab(tabId) {
    document.querySelectorAll('.ls-shop-view-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.ls-shop-tab-item').forEach(el => el.classList.remove('active'));
    
    const view = document.getElementById(`ls-shop-view-${tabId}`);
    const tab = document.getElementById(`ls-shop-tab-${tabId}`);
    
    if (view) view.classList.add('active');
    if (tab) tab.classList.add('active');

    if (tabId === 'orders') {
        lsRenderShopOrders();
    }
}

// --- 分类与侧边栏逻辑 ---
function lsRenderShopSidebar() {
    const sidebar = document.getElementById('ls-shop-sidebar-list');
    if (!sidebar) return;
    sidebar.innerHTML = '';

    lsState.shopCategories.forEach(cat => {
        const div = document.createElement('div');
        div.className = `ls-shop-sidebar-item ${lsState.activeShopCategoryId === cat.id ? 'active' : ''}`;
        div.innerText = cat.name;
        div.onclick = () => {
            lsState.activeShopCategoryId = cat.id;
            lsRenderShopSidebar();
            lsRenderShopMenu();
        };
        sidebar.appendChild(div);
    });
}

function lsOpenCategoryManageModal() {
    const list = document.getElementById('ls-shop-category-list');
    list.innerHTML = '';
    
    lsState.shopCategories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'ls-shop-cat-item';
        div.innerHTML = `
            <div class="ls-shop-cat-name">${cat.name}</div>
            <div class="ls-shop-cat-actions">
                <div class="ls-shop-cat-btn" onclick="lsEditCategory('${cat.id}')">修改</div>
                <div class="ls-shop-cat-btn delete" onclick="lsDeleteCategory('${cat.id}')">删除</div>
            </div>
        `;
        list.appendChild(div);
    });
    
    wcOpenModal('ls-shop-category-modal');
}

function lsAddCategory() {
    wcOpenGeneralInput("添加新分类", (val) => {
        if (val && val.trim() !== "") {
            const newId = 'cat_' + Date.now();
            lsState.shopCategories.push({ id: newId, name: val.trim() });
            lsState.activeShopCategoryId = newId; // 自动选中新分类
            lsSaveData();
            lsRenderShopSidebar();
            lsRenderShopMenu();
            lsOpenCategoryManageModal(); // 刷新弹窗
        }
    });
}

function lsEditCategory(catId) {
    const cat = lsState.shopCategories.find(c => c.id === catId);
    if (!cat) return;
    wcOpenGeneralInput("修改分类名称", (val) => {
        if (val && val.trim() !== "") {
            cat.name = val.trim();
            lsSaveData();
            lsRenderShopSidebar();
            lsRenderShopMenu();
            lsOpenCategoryManageModal(); // 刷新弹窗
        }
    });
    // 预填当前名称
    setTimeout(() => {
        const inputField = document.getElementById('wc-general-input-field');
        if (inputField) inputField.value = cat.name;
    }, 50);
}

function lsDeleteCategory(catId) {
    if (lsState.shopCategories.length <= 1) {
        return alert("至少需要保留一个分类哦！");
    }
    if (confirm("确定要删除这个分类吗？该分类下的所有菜品也会被删除！")) {
        lsState.shopCategories = lsState.shopCategories.filter(c => c.id !== catId);
        lsState.shopMenu = lsState.shopMenu.filter(m => m.categoryId !== catId);
        
        if (lsState.activeShopCategoryId === catId) {
            lsState.activeShopCategoryId = lsState.shopCategories[0].id;
        }
        
        lsSaveData();
        lsRenderShopSidebar();
        lsRenderShopMenu();
        lsOpenCategoryManageModal(); // 刷新弹窗
    }
}

// --- 菜品渲染与修改模式逻辑 ---// 修改后
function lsToggleShopEditMode() {
    lsState.isShopEditMode = !lsState.isShopEditMode;
    const editBtn = document.getElementById('ls-shop-edit-btn');
    const actionText = document.getElementById('ls-shop-edit-menu-text');
    if (lsState.isShopEditMode) {
        editBtn.classList.add('active');
        if(actionText) actionText.innerText = "退出编辑菜品";
    } else {
        editBtn.classList.remove('active');
        if(actionText) actionText.innerText = "编辑菜品";
    }
    lsRenderShopMenu();
}

function lsRenderShopMenu() {
    const container = document.getElementById('ls-shop-menu-list');
    const title = document.getElementById('ls-shop-menu-title');
    if (!container) return;
    
    container.innerHTML = '';
    
    const currentCat = lsState.shopCategories.find(c => c.id === lsState.activeShopCategoryId);
    const catName = currentCat ? currentCat.name : '未知';
    
    const filteredMenu = lsState.shopMenu.filter(m => m.categoryId === lsState.activeShopCategoryId);
    title.innerText = `${catName}(${filteredMenu.length})`;

    if (filteredMenu.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">该分类下暂无菜品，请点击上方添加</div>';
        return;
    }

    filteredMenu.forEach(item => {
        const div = document.createElement('div');
        div.className = `ls-shop-product-item ${lsState.isShopEditMode ? 'edit-mode' : ''}`;
        div.innerHTML = `
            <div class="ls-shop-product-img">
                <svg viewBox="0 0 100 100"><path d="M50 20 C30 20 15 35 15 55 C15 75 30 90 50 90 C70 90 85 75 85 55 C85 35 70 20 50 20 Z M35 45 A5 5 0 1 1 35 55 A5 5 0 1 1 35 45 Z M65 45 A5 5 0 1 1 65 55 A5 5 0 1 1 65 45 Z M50 65 C45 65 40 60 40 60 L60 60 C60 60 55 65 50 65 Z" fill="#FFB6C1"/></svg>
            </div>
            <div class="ls-shop-product-info">
                <div class="ls-shop-product-title">${item.name}</div>
                <div class="stars">
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <span style="color:#333; font-size:12px; margin-left:2px;">5.0</span>
                </div>
                <div class="ls-shop-product-sales">月销 ${item.sales || 0}</div>
                <div style="color:#FF3B30; font-weight:bold; font-size:14px; margin-top:4px;">♥ ${item.price !== undefined ? item.price : 52}</div>
            </div>
            <div class="ls-shop-add-btn" onclick="lsAddToCart(${item.id})">
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div class="ls-shop-edit-icon" onclick="lsOpenEditItemModal(${item.id})">
                <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
            </div>
        `;
        container.appendChild(div);
    });
}

function lsOpenEditItemModal(itemId) {
    lsState.editingShopItemId = itemId;
    wcOpenModal('ls-shop-edit-item-modal');
}

function lsOpenEditMenuItemDetail() {
    const item = lsState.shopMenu.find(m => m.id === lsState.editingShopItemId);
    if (!item) return;
    wcCloseModal('ls-shop-edit-item-modal');
    setTimeout(() => {
        document.getElementById('ls-edit-detail-name').value = item.name;
        document.getElementById('ls-edit-detail-price').value = item.price || 52;
        document.getElementById('ls-shop-edit-detail-modal').classList.add('active');
    }, 300);
}

function lsSaveMenuItemEdit() {
    const item = lsState.shopMenu.find(m => m.id === lsState.editingShopItemId);
    if (!item) return;
    
    const newName = document.getElementById('ls-edit-detail-name').value.trim();
    const newPrice = document.getElementById('ls-edit-detail-price').value.trim();
    
    if (!newName || !newPrice) return alert("请填写名称和价格");
    
    item.name = newName;
    item.price = parseInt(newPrice) || 52;
    
    lsSaveData();
    lsRenderShopMenu();
    document.getElementById('ls-shop-edit-detail-modal').classList.remove('active');
    alert("修改成功！");
}

function lsDeleteMenuItem() {
    if (confirm("确定要删除这个菜品吗？")) {
        lsState.shopMenu = lsState.shopMenu.filter(m => m.id !== lsState.editingShopItemId);
        lsSaveData();
        lsRenderShopMenu();
        wcCloseModal('ls-shop-edit-item-modal');
    }
}
// --- 渲染商城历史订单记录 ---
function lsRenderShopOrders() {
    const container = document.getElementById('ls-shop-order-list');
    if (!container) return;
    container.innerHTML = '';

    if (!lsState.shopOrders || lsState.shopOrders.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">暂无购买记录哦~</div>';
        return;
    }

    lsState.shopOrders.forEach(order => {
        const dateStr = new Date(order.time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let itemsHtml = '';
        let totalCost = 0;

        order.items.forEach(item => {
            totalCost += item.price !== undefined ? parseInt(item.price) : 52;
            itemsHtml += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: #333;">
                    <span>${item.name}</span>
                    <span style="font-weight: bold;">♥${item.price !== undefined ? item.price : 52}</span>
                </div>
            `;
        });

        const div = document.createElement('div');
        div.style.cssText = 'background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); border: 1px solid #F9F9F9;';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #E5E5EA; padding-bottom: 10px; margin-bottom: 10px;">
                <span style="font-size: 11px; color: #888; font-family: monospace;">ORD-${order.id.toString().slice(-6)}</span>
                <span style="font-size: 11px; color: #888;">${dateStr}</span>
            </div>
            <div style="margin-bottom: 12px;">
                ${itemsHtml}
            </div>
            <div style="display: flex; justify-content: flex-end; font-weight: bold; color: #FF3B30; font-size: 15px;">
                总计: ♥${totalCost}
            </div>
        `;
        container.appendChild(div);
    });
}

// --- 购物车逻辑 ---
function lsAddToCart(itemId) {
    const item = lsState.shopMenu.find(m => m.id === itemId);
    if (!item) return;
    lsState.shopCart.push({ ...item, cartId: Date.now() + Math.random() });
    lsSaveData();
    lsUpdateCartBadge();
    
    const badge = document.getElementById('ls-shop-cart-badge');
    badge.style.transform = 'translate(20%, -20%) scale(1.5)';
    setTimeout(() => badge.style.transform = 'translate(20%, -20%) scale(1)', 200);
}

function lsRandomAddToCart() {
    const filteredMenu = lsState.shopMenu.filter(m => m.categoryId === lsState.activeShopCategoryId);
    if (filteredMenu.length === 0) return alert("当前分类下没有菜品哦~");
    const randomItem = filteredMenu[Math.floor(Math.random() * filteredMenu.length)];
    lsAddToCart(randomItem.id);
    alert(`已随机将【${randomItem.name}】加入购物车！`);
}
// --- 邀请下单逻辑 ---
function lsInviteCharOrder() {
    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return alert("请先绑定恋人哦~");

    const currentCat = lsState.shopCategories.find(c => c.id === lsState.activeShopCategoryId);
    const catName = currentCat ? currentCat.name : '互动';
    const filteredMenu = lsState.shopMenu.filter(m => m.categoryId === lsState.activeShopCategoryId);
    
    if (filteredMenu.length === 0) return alert("当前分类下没有商品哦~");

    const menuItemsStr = filteredMenu.map(m => `${m.name}(♥${m.price !== undefined ? m.price : 52})`).join('、');
    
    // 将商品数据转为 JSON 字符串，以便传递给 onclick 函数
    const itemsJson = JSON.stringify(filteredMenu.map(m => ({ name: m.name, price: m.price || 52 }))).replace(/"/g, '&quot;');

    // 构造黑金高奢风商城邀请卡片 HTML
    const cardHtml = `
        <div class="ins-shop-invite-card-dark" onclick="wcOpenShopInviteDetail('${catName}', '${itemsJson}')">
            <div class="ins-shop-invite-dark-tag">EXCLUSIVE INVITATION</div>
            <div class="ins-shop-invite-dark-title">For You.</div>
            <div class="ins-shop-invite-dark-desc">为您呈上专属【${catName}】清单<br><span style="font-size: 9px; opacity: 0.6; margin-top: 6px; display: block;">(点击查看详情)</span></div>
            <div class="ins-shop-invite-dark-footer">BALANCE: ♥${lsState.qaScore}</div>
        </div>
    `;

    // 发送卡片到聊天
    wcAddMessage(charId, 'me', 'receipt', cardHtml);

    // 给 AI 发送隐藏的系统提示
    const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚向你发送了一张商城邀请卡片，邀请你在【${catName}】分类里挑选礼物/特权。
当前你们的共同账户余额为：${lsState.qaScore} 心动值。
可选商品及价格：${menuItemsStr}。
请在接下来的回复中，使用 "shop_order" 指令挑选你想要的商品（注意看余额够不够！如果不够你可以撒娇让User去赚积分，或者挑便宜的）。]`;
    
    wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });

    lsState.shopCart = []; // 清空购物车
    lsUpdateCartBadge();
    
    // 关闭商城，回到聊天
    document.getElementById('ls-view-shop').classList.remove('active');
    document.getElementById('ls-view-main').classList.add('active');
    closeLoversSpace();
    openWechat();
    wcOpenChat(lsState.boundCharId);
    
    alert("已将商城邀请卡片发送给 Ta！");
    // wcTriggerAI(charId); // 取消自动调取API，等待用户手动点击小飞机
}
function lsUpdateCartBadge() {
    const badge = document.getElementById('ls-shop-cart-badge');
    if (!badge) return;
    const count = lsState.shopCart.length;
    badge.innerText = count;
    badge.style.display = count > 0 ? 'block' : 'none';
}

function lsOpenCartModal() {
    const container = document.getElementById('ls-shop-cart-list');
    container.innerHTML = '';
    
    if (lsState.shopCart.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0;">购物车是空的哦~</div>';
    } else {
        lsState.shopCart.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'ls-shop-cart-item';
            div.innerHTML = `
                <div class="ls-shop-cart-item-left">
                    <div class="ls-shop-cart-item-img">
                        <svg viewBox="0 0 100 100"><path d="M50 20 C30 20 15 35 15 55 C15 75 30 90 50 90 C70 90 85 75 85 55 C85 35 70 20 50 20 Z M35 45 A5 5 0 1 1 35 55 A5 5 0 1 1 35 45 Z M65 45 A5 5 0 1 1 65 55 A5 5 0 1 1 65 45 Z M50 65 C45 65 40 60 40 60 L60 60 C60 60 55 65 50 65 Z" fill="#FFB6C1"/></svg>
                    </div>
                    <div class="ls-shop-cart-item-title">${item.name}</div>
                    <div style="color:#FF3B30; font-size:12px; font-weight:bold; margin-top:4px;">♥ ${item.price !== undefined ? item.price : 52}</div>
                </div>
                <div class="ls-shop-cart-item-delete" onclick="lsRemoveFromCart(${idx})">×</div>
            `;
            container.appendChild(div);
        });
    }
    wcOpenModal('ls-shop-cart-modal');
}
// ==========================================
// 新增：商城邀请卡片点击查看详情弹窗逻辑
// ==========================================
window.wcOpenShopInviteDetail = function(catName, itemsJsonStr) {
    document.getElementById('shop-invite-detail-title').innerText = `【${catName}】特权清单`;
    const listContainer = document.getElementById('shop-invite-detail-list');
    listContainer.innerHTML = '';
    
    try {
        const items = JSON.parse(itemsJsonStr);
        items.forEach(item => {
            listContainer.innerHTML += `
                <div class="shop-invite-detail-item">
                    <span class="shop-invite-detail-name">${item.name}</span>
                    <span class="shop-invite-detail-price">♥${item.price}</span>
                </div>
            `;
        });
    } catch(e) {
        console.error("解析商品列表失败", e);
    }
    
    const modal = document.getElementById('wc-modal-shop-invite-detail');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.wcCloseShopInviteDetail = function() {
    const modal = document.getElementById('wc-modal-shop-invite-detail');
    if (!modal) return;
    
    // 👈 核心修复：使用 requestAnimationFrame 确保动画帧同步，丝滑关闭
    requestAnimationFrame(() => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }, 250); // 👈 与 CSS 的 0.25s 保持一致
    });
};

function lsRemoveFromCart(idx) {
    lsState.shopCart.splice(idx, 1);
    lsSaveData();
    lsUpdateCartBadge();
    lsOpenCartModal(); 
}

// --- 下单并触发 AI 互动 ---
function lsCheckoutCart() {
    if (lsState.shopCart.length === 0) return alert("购物车是空的哦~");
    
    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    // 计算总心动值
    let totalCost = 0;
    lsState.shopCart.forEach(item => {
        totalCost += item.price !== undefined ? parseInt(item.price) : 52;
    });

    // 检查积分余额
    if (lsState.qaScore < totalCost) {
        return alert(`心动值不足！需要 ♥${totalCost}，当前仅有 ♥${lsState.qaScore}。\n快去扭蛋机抽奖或完成默契挑战获取吧！`);
    }

    // 扣除积分
    lsState.qaScore -= totalCost;

    const orderItems = [...lsState.shopCart];
    const itemNames = orderItems.map(i => i.name).join('、');
    
    // 加入历史订单
    lsState.shopOrders.unshift({ id: Date.now(), time: Date.now(), items: orderItems });
    
    // 【核心】：加入特权背包
    if (!lsState.inventory) lsState.inventory = [];
    orderItems.forEach(item => {
        lsState.inventory.unshift({
            id: Date.now() + Math.random(),
            name: item.name,
            desc: item.desc || '专属互动特权',
            time: Date.now()
        });
    });
    
    lsState.shopCart = [];
    lsSaveData();
    lsUpdateCartBadge();
    wcCloseModal('ls-shop-cart-modal');
    
    // 刷新金库 UI
    if (typeof lsRenderVault === 'function') lsRenderVault();
    
    const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚在你们的专属情侣商城里花费了 ${totalCost} 心动值，购买了以下互动特权：【${itemNames}】。请在接下来的回复中，根据你的人设对 User 的购买行为做出反应（比如：心疼积分、期待互动、或者调侃 User）。]`;
    
    wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });
    wcAddMessage(charId, 'system', 'system', `[系统提示: 你花费 ♥${totalCost} 购买了 ${itemNames}，已存入特权背包]`, { style: 'transparent' });
    
    // 已删除 wcTriggerAI(charId); 不再自动调取 API
    
    alert(`购买成功！消耗 ♥${totalCost}。\n物品已存入【羁绊金库-特权背包】！`);
}
// --- 手动添加菜品逻辑 ---
function lsManualAddMenuItem() {
    if (!lsState.activeShopCategoryId) return alert("请先选择或创建一个分类");
    wcCloseModal('ls-shop-add-menu-modal');
    
    // 延迟打开我们刚刚在 HTML 里写好的专属弹窗
    setTimeout(() => {
        document.getElementById('ls-add-detail-name').value = '';
        document.getElementById('ls-add-detail-price').value = '';
        document.getElementById('ls-shop-add-detail-modal').classList.add('active');
    }, 300);
}

// 保存手动添加的菜品
function lsSaveNewMenuItem() {
    const name = document.getElementById('ls-add-detail-name').value.trim();
    const priceStr = document.getElementById('ls-add-detail-price').value.trim();

    if (!name || !priceStr) return alert("请填写名称和价格哦~");

    const parsedPrice = parseInt(priceStr);

    lsState.shopMenu.push({
        id: Date.now(),
        categoryId: lsState.activeShopCategoryId,
        name: name,
        price: isNaN(parsedPrice) ? 52 : parsedPrice, // 👈 完美支持 0 积分
        sales: 0
    });

    lsSaveData();
    lsRenderShopMenu();
    document.getElementById('ls-shop-add-detail-modal').classList.remove('active');
    alert("添加成功！");
}

// 保存修改后的菜品
function lsSaveMenuItemEdit() {
    const item = lsState.shopMenu.find(m => m.id === lsState.editingShopItemId);
    if (!item) return;
    
    const newName = document.getElementById('ls-edit-detail-name').value.trim();
    const priceStr = document.getElementById('ls-edit-detail-price').value.trim();
    
    if (!newName || !priceStr) return alert("请填写名称和价格");
    
    const parsedPrice = parseInt(priceStr);
    
    item.name = newName;
    item.price = isNaN(parsedPrice) ? 52 : parsedPrice; // 👈 完美支持 0 积分
    
    lsSaveData();
    lsRenderShopMenu();
    document.getElementById('ls-shop-edit-detail-modal').classList.remove('active');
    alert("修改成功！");
}

// --- AI 生成菜品逻辑 (带积分输入) ---
function lsAIGenerateMenuItems() {
    if (!lsState.activeShopCategoryId) return alert("请先选择或创建一个分类");
    wcCloseModal('ls-shop-add-menu-modal');

    // 先弹出一个输入框，让用户输入这批 AI 菜品的统一积分
    setTimeout(() => {
        wcOpenGeneralInput("请输入这批菜品的统一积分价格", async (priceVal) => {
            const targetPrice = parseInt(priceVal) || 52;
            await _executeAIGenerateMenuItems(targetPrice);
        });
    }, 300);
}

// 内部执行 AI 生成的函数
async function _executeAIGenerateMenuItems(targetPrice) {
    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("AI 正在根据你们的日常生成专属菜单...");

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-30).map(m => `${m.sender==='me'?'User':char.name}: ${m.content}`).join('\n');

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【附加设定和内容补充参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }
        
        const currentCat = lsState.shopCategories.find(c => c.id === lsState.activeShopCategoryId);
        const catName = currentCat ? currentCat.name : '互动';

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(User)设定】：${userPersona}\n`;
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `现在 User 想要在你们的“情侣专属互动商城”的【${catName}】分类里添加 5 个新的互动特权（菜品）。\n`;
        prompt += `请根据你的人设、User的设定、你们最近的聊天氛围，以及当前的分类名称【${catName}】，生成 5 个有趣、暧昧或搞笑的互动特权名称。\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 名称要简短（不超过8个字），比如：罚站十分钟、无条件原谅券、叫一声哥哥等。\n`;
        prompt += `2. 必须符合你们的关系状态和当前分类的主题。\n`;
        prompt += `3. 返回纯 JSON 数组，格式如下：\n`;
        prompt += `[
  {"name": "特权名称1"},
  {"name": "特权名称2"},
  {"name": "特权名称3"},
  {"name": "特权名称4"},
  {"name": "特权名称5"}
]\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 2000
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const newItems = JSON.parse(content);
        
        if (Array.isArray(newItems)) {
            newItems.forEach(item => {
                if (item.name) {
                    lsState.shopMenu.push({ 
                        id: Date.now() + Math.random(), 
                        categoryId: lsState.activeShopCategoryId, 
                        name: item.name, 
                        price: targetPrice, // 👈 注入用户刚刚填写的积分
                        sales: Math.floor(Math.random() * 100) 
                    });
                }
            });
            lsSaveData();
            lsRenderShopMenu();
            wcShowSuccess("专属菜单生成成功！");
        } else {
            throw new Error("格式错误");
        }

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[菜单生成失败] ${e.message}`);
        else wcShowError("生成失败，请重试");
    }
}

// 扭蛋机抽奖逻辑
function lsPlayGacha() {
    // 1. 检查微信钱包余额
    const cost = 5.20;
    if (wcState.wallet.balance < cost) {
        alert("微信零钱余额不足 ¥5.20，请先前往「我-钱包」充值哦~");
        return;
    }

    // 2. 扣除余额并记录账单
    wcState.wallet.balance -= cost;
    wcState.wallet.transactions.push({
        id: Date.now(), type: 'payment', amount: cost, note: '心动扭蛋机抽奖', time: Date.now()
    });
    wcSaveData();

    const knob = document.querySelector('.ls-shop-gacha-knob');
    if (!knob) return;
    
    knob.style.transform = 'rotate(180deg)';
    
    setTimeout(() => {
        knob.style.transform = 'rotate(0deg)';
        
        // 3. 随机获得 10 - 50 心动值 (积分)
        const wonScore = Math.floor(Math.random() * 41) + 10;
        lsState.qaScore += wonScore;
        lsSaveData();
        
        // 4. 更新弹窗 UI
        const modal = document.getElementById('ls-shop-gacha-modal');
        const titleEl = document.querySelector('.ls-shop-result-title');
        const descEl = document.querySelector('.ls-shop-result-desc');
        
        if (titleEl) titleEl.innerText = `恭喜抽中 ${wonScore} 心动值！`;
        if (descEl) descEl.innerHTML = `已存入羁绊金库。<br>当前总心动值：${lsState.qaScore}`;
        
        if (modal) modal.classList.add('active');
        
        // 5. 同步刷新金库 UI
        lsRenderVault();
    }, 500);
}

function lsCloseGacha() {
    const modal = document.getElementById('ls-shop-gacha-modal');
    if (modal) modal.classList.remove('active');
}
// ==========================================
// 羁绊金库 (Bond Vault) & 特权背包 核心逻辑 (修复重构版)
// ==========================================

// 切换金库内部的 Tab (合并了背包渲染逻辑)
function lsSwitchVaultTab(tabId, element) {
    document.querySelectorAll('.vault-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.vault-view-section').forEach(view => view.classList.remove('active'));
    
    element.classList.add('active');
    document.getElementById('vault-view-' + tabId).classList.add('active');
    
    if (tabId === 'inventory') {
        lsRenderInventory();
    }
}

// 渲染金库数据
function lsRenderVault() {
    const scoreDisplay = document.getElementById('vault-score-display');
    if (scoreDisplay) {
        scoreDisplay.innerText = lsState.qaScore || 0;
    }
    
    const dateDisplay = document.getElementById('vault-date-display');
    if (dateDisplay && lsState.startDate) {
        const d = new Date(lsState.startDate);
        dateDisplay.innerText = `SINCE ${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
    }

    const levelDisplay = document.getElementById('vault-level-display');
    if (levelDisplay) {
        const score = lsState.qaScore || 0;
        let level = "LV.1 互生情愫";
        if (score >= 100) level = "LV.2 心有灵犀";
        if (score >= 300) level = "LV.3 难舍难分";
        if (score >= 500) level = "LV.4 亲密无间";
        if (score >= 1000) level = "LV.5 灵魂伴侣";
        levelDisplay.innerText = level;
    }
}

// 拦截商城 Tab 切换，如果是切换到 "me" (金库)，则触发渲染
const originalLsSwitchShopTab = lsSwitchShopTab;
lsSwitchShopTab = function(tabId) {
    originalLsSwitchShopTab(tabId);
    if (tabId === 'me') {
        lsRenderVault();
        lsRenderInventory();
    }
};

// 渲染特权背包
function lsRenderInventory() {
    const container = document.getElementById('vault-inventory-list');
    if (!container) return;
    container.innerHTML = '';

    if (!lsState.inventory || lsState.inventory.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">背包空空如也，快去商城购买吧~</div>';
        return;
    }

    lsState.inventory.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'vault-coupon-item';
        div.innerHTML = `
            <div class="vault-coupon-left">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span style="font-size: 10px; font-weight: bold;">ITEM</span>
            </div>
            <div class="vault-coupon-right">
                <div class="vault-coupon-title">${item.name}</div>
                <div class="vault-coupon-desc">${item.desc}</div>
                <button class="vault-coupon-use-btn" onclick="lsUseInventoryItem(${idx})">对 Ta 使用</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// 使用背包物品
async function lsUseInventoryItem(idx) {
    const item = lsState.inventory[idx];
    if (!item) return;

    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return alert("请先绑定恋人哦~");

    if (confirm(`确定要对 ${char.name} 使用【${item.name}】吗？使用后物品将消失。`)) {
        // 从背包移除
        lsState.inventory.splice(idx, 1);
        lsSaveData();
        lsRenderInventory();

        // 构造极简黑金高奢风特权卡片 HTML (严格锁定 200x80px，完美居中防拉伸)
        const safeDesc = item.desc ? item.desc.replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';
        const descHtml = safeDesc ? `<div style="color: #888888; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 4px 0 0 0; line-height: 1;">"${safeDesc}"</div>` : '';

        const cardHtml = `
            <div style="width: 200px; height: 80px; background: #1a1a1a; border-radius: 12px; border: 1px solid #D4AF37; display: flex; position: relative; overflow: hidden; box-sizing: border-box; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                <!-- 右侧加深背景 -->
                <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 50px; background: rgba(0,0,0,0.4); z-index: 0;"></div>
                <!-- 虚线分割 -->
                <div style="position: absolute; right: 50px; top: 0; bottom: 0; border-left: 1px dashed #D4AF37; opacity: 0.5; z-index: 1;"></div>
                
                <!-- 左侧文字区域 -->
                <div style="flex: 1; padding: 0 12px; display: flex; flex-direction: column; justify-content: center; z-index: 2; overflow: hidden; height: 100%;">
                    <div style="color: #D4AF37; font-size: 9px; letter-spacing: 1px; margin: 0 0 4px 0; font-family: serif; line-height: 1;">PRIVILEGE USED</div>
                    <div style="font-size: 15px; font-weight: bold; color: #FFFFFF; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; line-height: 1.2;">
                        ${item.name}
                    </div>
                    ${descHtml}
                </div>
                
                <!-- 右侧图标区域 (金色五角星) -->
                <div style="width: 50px; height: 100%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 2;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #D4AF37; display: flex; align-items: center; justify-content: center;">
                        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #D4AF37;">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                    </div>
                </div>
            </div>
        `;

        // 使用 receipt 类型发送卡片，确保背景透明无边框
        wcAddMessage(charId, 'me', 'receipt', cardHtml);
        
        // 发送隐藏的系统提示给 AI
        const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚对你使用了一个专属互动特权道具：【${item.name}】（描述：${item.desc}）。请你立刻在回复中，根据你的人设，对 User 使用这个特权的行为做出真实的反应（必须服从特权内容，但可以傲娇、害羞、无奈或主动配合）。]`;
        wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });
        
        alert(`已使用【${item.name}】！快去微信看看吧~`);
        // 依然保持不自动调取 API
    }
}

// 情绪典当 (换取积分)
async function lsPawnEmotion() {
    const text = document.getElementById('vault-emotion-input').value.trim();
    if (!text) return alert("请先写下你的情绪哦~");

    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("老板正在评估你的情绪价值...");

    try {
        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n`;
        prompt += `【情境】：User 今天心情不好，在“情绪典当行”里写下了一段坏情绪卖给你：\n“${text}”\n`;
        prompt += `请你化身典当行老板，评估这段坏情绪，并给 User 开出一张【情绪收据】。\n`;
        prompt += `要求：\n1. 语气要符合你的人设（霸道、温柔或搞笑安慰）。\n2. 随机给出一个 10-50 之间的收购价（心动值）。\n`;
        prompt += `返回纯 JSON 对象：\n{"comment": "老板批注(安慰的话)", "price": 30}`;

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
        let content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        // 增加积分
        const price = parseInt(result.price) || 20;
        lsState.qaScore += price;
        lsSaveData();
        lsRenderVault();

        // 清空输入框
        document.getElementById('vault-emotion-input').value = '';

        // 弹窗提示
        alert(`【情绪收据】\n\n老板批注：${result.comment}\n\n收购价：+${price} 心动值`);
        wcShowSuccess("典当成功！");

    } catch (e) {
        console.error(e);
        wcShowError("典当失败");
    }
}

// 生成恋爱账单
async function lsGenerateLoveBill() {
    const charId = lsState.boundCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return alert("请先绑定恋人哦~");

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("正在扫描你们的聊天记录...");

    try {
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-40).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        let prompt = `你扮演角色：${char.name}。\n人设：${char.prompt}\n`;
        prompt += `【最近聊天记录】：\n${recentMsgs}\n\n`;
        prompt += `请根据最近的聊天记录，生成一份趣味性的【恋爱账单报告】。\n`;
        prompt += `要求：\n1. 总结 User 最近的情绪支出（如：惹我生气次数）和甜蜜收入（如：撒娇次数）。\n`;
        prompt += `2. 给出最终的综合评估和建议（如：本月盈余，建议今晚请我吃宵夜）。\n`;
        prompt += `返回纯 JSON 对象：\n{"report": "完整的账单报告文本"}`;

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
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);

        alert(`【专属恋爱账单】\n\n${result.report}`);
        wcShowSuccess("账单生成成功！");

    } catch (e) {
        console.error(e);
        wcShowError("账单生成失败");
    }
}

// 扭蛋机逻辑 (扣除微信余额，增加心动值)
function lsPlayGacha() {
    // 1. 检查微信钱包余额
    const cost = 5.20;
    if (wcState.wallet.balance < cost) {
        alert("微信零钱余额不足 ¥5.20，请先前往「我-钱包」充值哦~");
        return;
    }

    // 2. 扣除余额并记录账单
    wcState.wallet.balance -= cost;
    wcState.wallet.transactions.push({
        id: Date.now(), type: 'payment', amount: cost, note: '心动扭蛋机抽奖', time: Date.now()
    });
    wcSaveData();

    const knob = document.querySelector('.ls-shop-gacha-knob');
    if (!knob) return;
    
    knob.style.transform = 'rotate(180deg)';
    
    setTimeout(() => {
        knob.style.transform = 'rotate(0deg)';
        
        // 3. 随机获得 10 - 50 心动值 (积分)
        const wonScore = Math.floor(Math.random() * 41) + 10;
        lsState.qaScore += wonScore;
        lsSaveData();
        
        // 4. 更新弹窗 UI
        const modal = document.getElementById('ls-shop-gacha-modal');
        const titleEl = document.querySelector('.ls-shop-result-title');
        const descEl = document.querySelector('.ls-shop-result-desc');
        
        if (titleEl) titleEl.innerText = `恭喜抽中 ${wonScore} 心动值！`;
        if (descEl) descEl.innerHTML = `已存入羁绊金库。<br>当前总心动值：${lsState.qaScore}`;
        
        if (modal) modal.classList.add('active');
        
        // 5. 同步刷新金库 UI
        lsRenderVault();
    }, 500);
}
// ==========================================
// 新增：通话记录独立展示与自动总结逻辑
// ==========================================

// 切换核心记忆状态
window.wcToggleCoreMemory = function(event, memId) {
    event.stopPropagation();
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char || !char.memories) return;
    
    const mem = char.memories.find(m => m.id === memId);
    if (mem) {
        mem.isCore = !mem.isCore;
        wcSaveData();
        wcRenderMemories();
        if (mem.isCore) {
            alert("已设为核心记忆！AI 将永远记住这件事。");
        }
    }
};

// 打开通话记录弹窗
window.wcOpenCallTranscript = function(msgId) {
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;
    const msg = wcState.chats[char.id].find(m => m.id === msgId);
    if (!msg || !msg.transcript) return;

    let modal = document.getElementById('wc-modal-call-transcript');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-modal-call-transcript';
        modal.className = 'modal-overlay';
        // 注入专属 CSS
        modal.innerHTML = `
            <style>
                .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); display: none; align-items: flex-end; justify-content: center; z-index: 35000; opacity: 0; transition: opacity 0.3s; }
                .modal-overlay.active { display: flex; opacity: 1; }
                .modal-card { width: 100%; height: 85%; background: #FFF; border-radius: 24px 24px 0 0; display: flex; flex-direction: column; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                .modal-overlay.active .modal-card { transform: translateY(0); }
                .modal-header { padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F0F0F0; }
                .modal-title { font-size: 18px; font-weight: bold; color: #111; }
                .modal-close { width: 30px; height: 30px; background: #F5F5F5; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #888; font-size: 16px; }
                .transcript-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; background: #FAFAFA; }
                .t-row { display: flex; flex-direction: column; gap: 6px; }
                .t-name { font-size: 12px; font-weight: bold; color: #888; }
                .t-content { font-size: 15px; color: #111; line-height: 1.5; background: #FFF; padding: 12px 16px; border-radius: 12px; border: 1px solid #EAEAEA; width: fit-content; max-width: 85%; }
                .t-row.me { align-items: flex-end; }
                .t-row.me .t-content { background: #111; color: #FFF; border: none; }
            </style>
            <div class="modal-card">
                <div class="modal-header">
                    <div class="modal-title">通话记忆档案</div>
                    <div class="modal-close" onclick="document.getElementById('wc-modal-call-transcript').classList.remove('active'); setTimeout(()=>document.getElementById('wc-modal-call-transcript').style.display='none', 300);">✕</div>
                </div>
                <div class="transcript-body" id="transcript-content-area"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const area = document.getElementById('transcript-content-area');
    let html = `<div style="text-align: center; font-size: 12px; color: #999; margin-bottom: 10px;">${new Date(msg.time).toLocaleString()}</div>`;
    
    msg.transcript.forEach(t => {
        const isMe = t.sender === 'me';
        const name = isMe ? '我' : char.name;
        html += `
            <div class="t-row ${isMe ? 'me' : 'them'}">
                <div class="t-name">${name}</div>
                <div class="t-content">${t.text}</div>
            </div>
        `;
    });
    
    html += `<div style="text-align: center; font-size: 12px; color: #999; margin-top: 10px;">通话结束，时长 ${msg.duration}</div>`;
    area.innerHTML = html;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

// 后台自动总结通话记录
async function wcAutoSummarizeCall(charId, durationStr, transcript) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char || transcript.length === 0) return;

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return;

    try {
        let prompt = `请总结以下语音通话的主要内容，提取关键信息和情感变化，字数控制在200字以内。\n`;
        prompt += `【通话记录】\n`;
        transcript.forEach(t => {
            const sender = t.sender === 'me' ? '用户' : char.name;
            prompt += `${sender}: ${t.text}\n`;
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
        let summary = data.choices[0].message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

        if (!char.memories) char.memories = [];
        char.memories.unshift({
            id: Date.now(),
            type: 'summary',
            content: `[语音通话总结 (${durationStr})] ${summary}`,
            time: Date.now(),
            isCore: false // 默认不是核心记忆
        });
        
        wcSaveData();
        if (document.getElementById('wc-view-memory').classList.contains('active')) {
            wcRenderMemories(); 
        }
        console.log("通话自动总结完成");

    } catch (e) {
        console.error("通话自动总结失败", e);
    }
}
// ==========================================
// 👇 新增：云端同步系统 (纯文本覆盖式) 👇
// ==========================================

window.needCloudBackup = false; // 脏标记：记录数据是否有变动
let isCloudSyncEnabled = localStorage.getItem('ios_theme_cloud_sync') === 'true';

// 替换为你部署的 Cloudflare Worker 接口地址
const CLOUD_SYNC_API = 'https://xiaoyuan-backup.xingyan067.workers.dev';

// 1. 页面交互逻辑
function openCloudSyncSettings() {
    document.getElementById('toggle-cloud-sync').checked = isCloudSyncEnabled;
    document.getElementById('cloudSyncSettingsModal').classList.add('open');
    // 👇 新增：打开时自动渲染日志
    if (typeof renderApiLogs === 'function') renderApiLogs();
}

function closeCloudSyncSettings() {
    document.getElementById('cloudSyncSettingsModal').classList.remove('open');
}

function handleCloudSyncToggle(checkbox) {
    isCloudSyncEnabled = checkbox.checked;
    localStorage.setItem('ios_theme_cloud_sync', isCloudSyncEnabled);
    if (isCloudSyncEnabled) {
        alert("已开启云端同步！\n每次退出网页时，系统会自动将最新的纯文本数据同步到云端。");
        window.needCloudBackup = true; // 开启时强制标记为需要备份一次
    }
}

// 2. 递归剔除 Base64 图片和音频的函数 (强化正则脱水版)
function stripImagesFromData(obj) {
    if (typeof obj === 'string') {
        // 1. 如果整个字符串就是 base64 图片或音频，直接清空
        if (obj.startsWith('data:image/') || obj.startsWith('data:audio/')) return "";
        
        // 2. 如果字符串内部潜伏了 base64
        if (obj.includes('data:image/')) {
            obj = obj.replace(/data:image\/[^"'\s\)]+/g, "");
        }
        if (obj.includes('data:audio/')) {
            obj = obj.replace(/data:audio\/[^"'\s\)]+/g, "");
        }
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => stripImagesFromData(item));
    }
    if (typeof obj === 'object' && obj !== null) {
        const newObj = {};
        for (let key in obj) {
            newObj[key] = stripImagesFromData(obj[key]);
        }
        return newObj;
    }
    return obj;
}

// 3. 深度合并云端数据与本地数据 (保留本地图片)
function mergeCloudDataWithLocal(local, cloud) {
    if (cloud === null || cloud === undefined) return local;
    if (typeof cloud !== 'object') {
        // 如果云端是空字符串，且本地是 data:image，则保留本地图片
        if (cloud === "" && typeof local === 'string' && local.startsWith('data:image/')) {
            return local;
        }
        return cloud;
    }
    if (Array.isArray(cloud)) {
        const result = [];
        for (let i = 0; i < cloud.length; i++) {
            result[i] = mergeCloudDataWithLocal(local ? local[i] : undefined, cloud[i]);
        }
        return result;
    }
    const result = { ...local };
    for (let key in cloud) {
        result[key] = mergeCloudDataWithLocal(local ? local[key] : undefined, cloud[key]);
    }
    return result;
}

// 4. 收集所有数据并执行上传 (打开页面备份 + 每天凌晨备份 + 退出兜底备份)
async function executeCloudBackup() {
    if (!isCloudSyncEnabled || !window.needCloudBackup) return;
    
    const qq = localStorage.getItem('current_bound_qq');
    const deviceId = localStorage.getItem('ios_theme_device_id');
    const code = localStorage.getItem('current_activation_code');
    if (!qq || !deviceId || !code) return;

    // 10分钟冷却时间，防止频繁刷新/切后台导致滥用额度
    const lastBackupTime = parseInt(localStorage.getItem('ios_theme_last_cloud_backup_time') || '0');
    const now = Date.now();
    const cooldownMs = 10 * 60 * 1000; 
    
    if (now - lastBackupTime < cooldownMs) {
        console.log(`云备份冷却中... 距离下次可备份还剩 ${Math.ceil((cooldownMs - (now - lastBackupTime)) / 1000 / 60)} 分钟`);
        return; 
    }

    try {
        const data = {};
        
        // 收集 Theme Studio 数据 (包含 API 设置 ios_theme_api_config)
        const keys = await idb.getAllKeys();
        for (let key of keys) {
            if (key.startsWith('ios_theme_')) data[key] = await idb.get(key);
        }

        // 收集 WeChat 数据
        const wechatData = {};
        if (wcDb.instance) {
            wechatData.user = await wcDb.get('kv_store', 'user');
            wechatData.wallet = await wcDb.get('kv_store', 'wallet');
            wechatData.stickerCategories = await wcDb.get('kv_store', 'sticker_categories');
            wechatData.cssPresets = await wcDb.get('kv_store', 'css_presets');
            wechatData.chatBgPresets = await wcDb.get('kv_store', 'chat_bg_presets');
            wechatData.phonePresets = await wcDb.get('kv_store', 'phone_presets');
            wechatData.shopData = await wcDb.get('kv_store', 'shop_data');
            wechatData.characters = await wcDb.getAll('characters');
            wechatData.masks = await wcDb.getAll('masks');
            wechatData.moments = await wcDb.getAll('moments');
            
            const allChats = await wcDb.getAll('chats');
            const chatsObj = {};
            if (allChats) {
                allChats.forEach(item => { chatsObj[item.charId] = item.messages; });
            }
            wechatData.chats = chatsObj;
        }
        data['wechat_backup'] = wechatData;

        // 收集其他 APP 数据
        data['ls_data'] = await idb.get('ls_data');
        data['ins_music_data'] = await idb.get('ins_music_data');
        data['dream_space_data'] = await idb.get('dream_space_data');
        data['ins_forum_data'] = await idb.get('ins_forum_data');

        // 核心：使用强化正则剔除所有图片和音频，大幅减小体积
        const cleanData = stripImagesFromData(data);

        // 移除 keepalive 限制，允许发送超过 64KB 的纯文本数据
        fetch(`${CLOUD_SYNC_API}/backup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                qq: qq,
                deviceId: deviceId,
                code: code,
                timestamp: Date.now(),
                data: cleanData
            })
        }).then(res => {
            if (res.ok) {
                localStorage.setItem('ios_theme_last_cloud_backup_time', Date.now().toString());
                window.needCloudBackup = false; // 重置脏标记
                console.log("云端自动同步已完成 (纯文本)");
            }
        }).catch(e => console.warn("云备份请求发送失败", e));

    } catch (error) {
        console.error("云端同步准备失败:", error);
    }
}

// 5. 查找云端备份 (双重验证)
async function searchCloudBackup() {
    const qq = document.getElementById('cloud-search-qq').value.trim();
    const code = document.getElementById('cloud-search-code').value.trim();
    if (!qq || !code) return alert("请输入 QQ 号和激活码");

    const resultsContainer = document.getElementById('cloud-search-results');
    resultsContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; font-size: 13px; padding: 20px 0;">正在安全查找...</div>';

    try {
        const response = await fetch(`${CLOUD_SYNC_API}/list?qq=${qq}&code=${code}`);
        const result = await response.json();

        if (result.success && result.backups && result.backups.length > 0) {
            resultsContainer.innerHTML = '';
            result.backups.forEach(backup => {
                const dateStr = new Date(backup.timestamp).toLocaleString('zh-CN');
                const div = document.createElement('div');
                div.style.cssText = "background: #fff; border: 1px solid #e5e5ea; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px;";
                div.innerHTML = `
                    <div>
                        <div style="font-size: 15px; font-weight: bold; color: #111; margin-bottom: 4px;">设备: ${backup.deviceId}</div>
                        <div style="font-size: 12px; color: #888;">备份时间: ${dateStr}</div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="wc-btn-secondary" style="flex: 1; margin: 0; padding: 8px; border-radius: 8px; font-size: 13px;" onclick="downloadCloudBackup('${qq}', '${code}', '${backup.deviceId}')">下载 JSON</button>
                        <button class="wc-btn-primary" style="flex: 1; margin: 0; padding: 8px; border-radius: 8px; font-size: 13px; background: #34c759;" onclick="restoreCloudBackup('${qq}', '${code}', '${backup.deviceId}')">直接使用</button>
                    </div>
                `;
                resultsContainer.appendChild(div);
            });
        } else {
            resultsContainer.innerHTML = '<div style="text-align: center; color: #ff3b30; font-size: 13px; padding: 20px 0;">未找到记录，或 QQ/激活码 不匹配</div>';
        }
    } catch (e) {
        resultsContainer.innerHTML = '<div style="text-align: center; color: #ff3b30; font-size: 13px; padding: 20px 0;">网络请求失败，请检查 API</div>';
    }
}

// 6. 下载云端备份 (双重验证)
async function downloadCloudBackup(qq, code, deviceId) {
    try {
        wcShowLoading("正在验证并获取数据...");
        const response = await fetch(`${CLOUD_SYNC_API}/get?qq=${qq}&code=${code}&deviceId=${deviceId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const exportObj = { signature: 'ios_theme_studio_full_backup', timestamp: result.timestamp, data: result.data };
            const blob = new Blob([JSON.stringify(exportObj)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; 
            a.download = `cloud_backup_${qq}_${deviceId}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            wcShowSuccess("下载成功");
        } else {
            wcShowError(result.message || "验证失败或数据为空");
        }
    } catch (e) {
        wcShowError("网络异常");
    }
}

// 7. 直接使用 (恢复) 云端备份 (双重验证)
async function restoreCloudBackup(qq, code, deviceId) {
    if (!confirm("这将使用云端数据覆盖当前数据（本地已有的图片会尽量保留）。确定要恢复吗？")) return;

    try {
        wcShowLoading("正在验证并恢复数据...");
        const response = await fetch(`${CLOUD_SYNC_API}/get?qq=${qq}&code=${code}&deviceId=${deviceId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const cloudData = result.data;
            
            // 1. 恢复 Theme Studio 数据
            for (let key in cloudData) {
                if (key !== 'wechat_backup' && key !== 'ls_data' && key !== 'ins_music_data' && key !== 'dream_space_data') {
                    // 👇 核心修复：API 配置直接暴力覆盖，不经过合并函数，防止丢失 👇
                    if (key === 'ios_theme_api_config') {
                        await idb.set(key, cloudData[key]);
                    } else {
                        const localVal = await idb.get(key);
                        const mergedVal = mergeCloudDataWithLocal(localVal, cloudData[key]);
                        await idb.set(key, mergedVal);
                    }
                }
            }

            // 2. 恢复 WeChat 数据
            if (cloudData['wechat_backup']) {
                const wd = cloudData['wechat_backup'];
                
                const safeGet = async (storeName, key) => await wcDb.get(storeName, key).catch(() => null);
                const safeGetAll = async (storeName) => await wcDb.getAll(storeName).catch(() => []);

                if (wd.user) await wcDb.put('kv_store', mergeCloudDataWithLocal(await safeGet('kv_store', 'user'), wd.user), 'user');
                if (wd.wallet) await wcDb.put('kv_store', wd.wallet, 'wallet');
                if (wd.stickerCategories) await wcDb.put('kv_store', wd.stickerCategories, 'sticker_categories');
                if (wd.cssPresets) await wcDb.put('kv_store', wd.cssPresets, 'css_presets');
                if (wd.chatBgPresets) await wcDb.put('kv_store', mergeCloudDataWithLocal(await safeGet('kv_store', 'chat_bg_presets'), wd.chatBgPresets), 'chat_bg_presets');
                if (wd.phonePresets) await wcDb.put('kv_store', mergeCloudDataWithLocal(await safeGet('kv_store', 'phone_presets'), wd.phonePresets), 'phone_presets');
                if (wd.shopData) await wcDb.put('kv_store', wd.shopData, 'shop_data');
                
                // 恢复 Characters (需要合并头像)
                const localChars = await safeGetAll('characters');
                const importedCharacters = Array.isArray(wd.characters) ? wd.characters : [];
                await wcClearStore('characters');
                for (const c of importedCharacters) {
                    const localC = localChars.find(lc => lc.id === c.id);
                    await wcDb.put('characters', mergeCloudDataWithLocal(localC, c));
                }

                // 恢复 Masks
                const localMasks = await safeGetAll('masks');
                await wcClearStore('masks');
                if (wd.masks) {
                    for (const m of wd.masks) {
                        const localM = localMasks.find(lm => lm.id === m.id);
                        await wcDb.put('masks', mergeCloudDataWithLocal(localM, m));
                    }
                }

                // 恢复 Moments
                const localMoments = await safeGetAll('moments');
                await wcClearStore('moments');
                if (wd.moments) {
                    for (const m of wd.moments) {
                        const localM = localMoments.find(lm => lm.id === m.id);
                        await wcDb.put('moments', mergeCloudDataWithLocal(localM, m));
                    }
                }

                // 恢复 Chats
                await wcClearStore('chats');
                if (wd.chats) {
                    for (const charId in wd.chats) {
                        const parsedId = parseInt(charId);
                        if (!isNaN(parsedId)) {
                            await wcDb.put('chats', { charId: parsedId, messages: wd.chats[charId] }).catch(e => console.warn(e));
                        }
                    }
                }
                await wcSyncCharactersSnapshotFromList(importedCharacters, Date.now());
            }

            // 3. 恢复其他 APP 数据
            const apps = ['ls_data', 'ins_music_data', 'dream_space_data', 'ins_forum_data'];
            for (let appKey of apps) {
                if (cloudData[appKey]) {
                    const localVal = await idb.get(appKey);
                    const mergedVal = mergeCloudDataWithLocal(localVal, cloudData[appKey]);
                    await idb.set(appKey, mergedVal);
                }
            }

            wcShowSuccess("恢复成功！即将刷新页面");
            setTimeout(() => location.reload(), 1500);
        } else {
            wcShowError(result.message || "验证失败或数据为空");
        }
    } catch (e) {
        console.error(e);
        wcShowError("恢复失败，网络异常");
    }
}

// 8. 触发机制：退出/切后台兜底备份
document.addEventListener('visibilitychange', () => {
    if (document.hidden) executeCloudBackup();
});
window.addEventListener('pagehide', () => {
    executeCloudBackup();
});

// 9. 触发机制：打开页面时备份 (延迟 5 秒，确保本地数据已完全加载)
window.addEventListener('load', () => {
    setTimeout(() => {
        if (isCloudSyncEnabled) {
            window.needCloudBackup = true; // 强制标记为需要备份
            executeCloudBackup();
        }
    }, 5000);
});

// 10. 触发机制：每天凌晨 0:00 定时备份一次
function scheduleMidnightBackup() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    setTimeout(() => {
        if (isCloudSyncEnabled) {
            console.log("触发凌晨 0:00 定时云端备份");
            window.needCloudBackup = true; 
            executeCloudBackup();
        }
        scheduleMidnightBackup();
    }, msUntilMidnight);
}
scheduleMidnightBackup();
/* ==========================================================================
   APP 5: Wish & To-Do (星愿空间) 核心逻辑 (角色数据隔离版)
   ========================================================================== */

const wishState = {
    activeCharId: null, // 当前选中的角色 ID
    currentDetailId: null,
    currentDetailType: null
};

// --- 辅助函数：获取当前角色的专属数据 ---
function getWishData() {
    if (!wishState.activeCharId) return null;
    const char = wcState.characters.find(c => c.id === wishState.activeCharId);
    if (!char) return null;
    
    // 如果该角色还没有 wishData，初始化一个
    if (!char.wishData) {
        char.wishData = {
            wishes: [],
            todos: [],
            achievements: [],
            puzzleBg: 'https://i.postimg.cc/kgD9CsbW/IMG-8012.jpg',
            puzzleUnlocked: 0
        };
    }
    return char.wishData;
}

// --- 数据持久化 ---
async function wishLoadData() {
    const data = await idb.get('wish_app_global');
    if (data && data.activeCharId) {
        wishState.activeCharId = data.activeCharId;
    }
}

async function wishSaveData() {
    // 保存全局状态
    await idb.set('wish_app_global', { activeCharId: wishState.activeCharId });
    // 核心：因为具体数据挂载在 char 上，所以调用微信的保存逻辑即可持久化
    wcSaveData();
}

// --- 页面导航 ---
async function openWishApp() {
    await wishLoadData();
    
    // 如果没有选中的角色，或者选中的角色被删除了，默认选中第一个单人角色
    if (!wishState.activeCharId || !wcState.characters.find(c => c.id === wishState.activeCharId)) {
        const firstChar = wcState.characters.find(c => !c.isGroup);
        if (firstChar) {
            wishState.activeCharId = firstChar.id;
        } else {
            alert("请先在微信中添加一个单人角色哦~");
            return;
        }
    }

    document.getElementById('wishModal').classList.add('open');
    wishUpdateHeaderTitle();
    wishSwitchTab('wish', document.querySelector('.wish-nav-icon'));
}

function closeWishApp() {
    document.getElementById('wishModal').classList.remove('open');
}

function wishUpdateHeaderTitle() {
    const char = wcState.characters.find(c => c.id === wishState.activeCharId);
    const titleEl = document.getElementById('wish-header-title');
    if (titleEl && char) {
        titleEl.innerText = `${char.name}'s Space`;
    }
}

function wishSwitchTab(pageId, el) {
    document.querySelectorAll('.wish-page').forEach(p => p.classList.remove('active'));
    document.getElementById('wish-page-' + pageId).classList.add('active');
    
    document.querySelectorAll('.wish-nav-icon').forEach(icon => icon.classList.remove('active'));
    if (el) el.classList.add('active');

    if (pageId === 'wish') wishRenderList('wish');
    if (pageId === 'todo') wishRenderList('todo');
    if (pageId === 'achieve') wishRenderAchievements();
    if (pageId === 'puzzle') wishRenderPuzzle();
}

// --- 角色选择逻辑 ---
function wishOpenCharSelectModal() {
    const list = document.getElementById('wish-char-list');
    list.innerHTML = '';
    
    const chars = wcState.characters.filter(c => !c.isGroup);
    if (chars.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">暂无联系人</div>';
    } else {
        chars.forEach(char => {
            const isSelected = char.id === wishState.activeCharId;
            const div = document.createElement('div');
            div.className = 'wc-list-item';
            div.style.background = 'white';
            div.style.borderBottom = '1px solid #F0F0F0';
            div.innerHTML = `
                <img src="${char.avatar}" class="wc-avatar" style="width:36px;height:36px;">
                <div class="wc-item-content"><div class="wc-item-title" style="${isSelected ? 'color:#007AFF;' : ''}">${char.name}</div></div>
                ${isSelected ? '<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#007AFF;fill:none;stroke-width:2;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            `;
            div.onclick = () => wishSelectChar(char.id);
            list.appendChild(div);
        });
    }
    wcOpenModal('wish-char-select-modal');
}

function wishSelectChar(charId) {
    wishState.activeCharId = charId;
    wishSaveData();
    wishUpdateHeaderTitle();
    
    // 刷新当前激活的 Tab
    const activePage = document.querySelector('.wish-page.active');
    if (activePage) {
        const pageId = activePage.id.replace('wish-page-', '');
        if (pageId === 'wish') wishRenderList('wish');
        if (pageId === 'todo') wishRenderList('todo');
        if (pageId === 'achieve') wishRenderAchievements();
        if (pageId === 'puzzle') wishRenderPuzzle();
    }
    
    wcCloseModal('wish-char-select-modal');
}

// --- 渲染列表 ---
function wishRenderList(type) {
    const container = document.getElementById(type === 'wish' ? 'wish-list-container' : 'todo-list-container');
    container.innerHTML = '';
    
    const data = getWishData();
    if (!data) return;

    const list = type === 'wish' ? data.wishes : data.todos;
    
    if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#999; margin-top:40px; font-style:italic;">暂无记录，点击右下角添加吧~</div>`;
        return;
    }

    // 倒序排列，未完成的在前
    const sortedList = [...list].sort((a, b) => {
        if (a.status === b.status) return b.id - a.id;
        return a.status === 'pending' ? -1 : 1;
    });

    sortedList.forEach(item => {
        const isDone = item.status === 'done';
        const dateStr = new Date(item.id).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        const isFromMe = item.creator === 'user';
        
        let creatorHtml = isFromMe 
            ? `<span class="wish-creator-tag me" style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: #F5F5F5; color: #888;">FROM ME</span>` 
            : `<span class="wish-creator-tag ta" style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: #111; color: #FFF;">FROM TA</span>`;

        let badgeHtml = '';
        if (isDone) {
            badgeHtml = `<span class="wish-reply-badge" style="background: #F2F2F7; color: #888;">已完成 · 留念</span>`;
        } else {
            if (isFromMe) {
                badgeHtml = `<span class="wish-reply-badge" style="background: rgba(0,122,255,0.1); color: #007AFF;">等待 Ta 回应...</span>`;
            } else {
                badgeHtml = `<span class="wish-reply-badge" style="background: rgba(212, 175, 55, 0.1); color: #D4AF37;">等待你实现</span>`;
            }
        }

        const div = document.createElement('div');
        div.className = 'wish-memo-card';
        div.onclick = () => wishOpenDetail(item.id, type);

        if (type === 'wish') {
            div.innerHTML = `
                <div class="wish-memo-info">
                    <div class="wish-memo-text ${isDone ? 'done' : ''}" style="${isDone ? 'text-decoration:line-through; color:#999;' : ''}">${item.title}</div>
                    <div class="wish-memo-meta">${creatorHtml}<span>${dateStr}</span>${badgeHtml}</div>
                </div>
                <svg class="wish-chevron-right" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
            `;
        } else {
            div.innerHTML = `
                <div class="wish-memo-info">
                    <div class="wish-todo-header">
                        <div class="wish-checkbox ${isDone ? 'done' : ''}" onclick="event.stopPropagation(); wishToggleStatus(${item.id}, 'todo')"></div>
                        <div class="wish-todo-text ${isDone ? 'done' : ''}">${item.title}</div>
                    </div>
                    <div class="wish-memo-meta" style="margin-left: 34px;">${creatorHtml}<span>${dateStr}</span>${badgeHtml}</div>
                </div>
                <svg class="wish-chevron-right" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
            `;
        }
        container.appendChild(div);
    });
}

// --- 添加逻辑 (取消立刻 AI 回复，改为注入聊天记忆) ---
function wishOpenAddModal() {
    if (!wishState.activeCharId) return alert("请先选择一个角色哦~");
    wcOpenModal('wish-add-modal');
}

let currentComposeType = 'wish';

function wishOpenCompose(type) {
    wcCloseModal('wish-add-modal');
    currentComposeType = type;
    
    // 初始化输入框
    document.getElementById('wish-compose-title').value = '';
    document.getElementById('wish-compose-body').value = '';
    document.getElementById('wish-compose-header-title').innerText = type === 'wish' ? '许下愿望' : '添加待办';
    
    // 打开全屏编辑页
    const view = document.getElementById('wish-compose-view');
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
}

function wishCloseCompose() {
    const view = document.getElementById('wish-compose-view');
    view.classList.remove('active');
    setTimeout(() => view.style.display = 'none', 300);
}

function wishSubmitCompose() {
    const title = document.getElementById('wish-compose-title').value.trim();
    const content = document.getElementById('wish-compose-body').value.trim();
    
    if (!title) return alert("标题不能为空哦~");
    
    const data = getWishData();
    if (!data) return;

    const newItem = {
        id: Date.now(),
        title: title,
        content: content, 
        aiReply: null,
        status: 'pending',
        creator: 'user'
    };
    
    if (currentComposeType === 'wish') data.wishes.unshift(newItem);
    else data.todos.unshift(newItem);
    
    wishSaveData();
    wishRenderList(currentComposeType);
    
    // 注入聊天记忆
    const char = wcState.characters.find(c => c.id === wishState.activeCharId);
    if (char) {
        const typeName = currentComposeType === 'wish' ? '愿望' : '待办事项';
        const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚在你们的专属星愿空间里添加了一个${typeName}：“${title}”。详细内容是：“${content}”。请在接下来的聊天中，自然地提及这件事，并给出你的看法、承诺或申请加入。]`;
        wcAddMessage(char.id, 'system', 'system', aiPrompt, { hidden: true });
    }
    
    wishCloseCompose();
    alert(`已添加${currentComposeType === 'wish' ? '愿望' : '待办'}！快去微信找 Ta 聊聊吧~`);
}

// --- 详情页与状态切换 ---
function wishOpenDetail(id, type) {
    const data = getWishData();
    if (!data) return;

    const item = type === 'wish' ? data.wishes.find(w => w.id === id) : data.todos.find(t => t.id === id);
    if (!item) return;

    wishState.currentDetailId = id;
    wishState.currentDetailType = type;

    document.getElementById('wish-detail-title').innerText = item.title;
    document.getElementById('wish-detail-date').innerText = new Date(item.id).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    let bodyHtml = '';
    if (item.creator === 'char') {
        bodyHtml = `<div style="color: #888; font-size: 12px; margin-bottom: 10px; font-weight: bold; letter-spacing: 1px;">TA'S MESSAGE</div>`;
        bodyHtml += item.content || 'Ta 偷偷许下了一个心愿...';
    } else {
        bodyHtml = `<div style="color: #CCC; font-style: italic; text-align: center; margin-top: 50px;">等待在聊天中与 Ta 讨论...</div>`;
    }
    document.getElementById('wish-detail-body').innerHTML = bodyHtml;

    // 动态注入底部操作按钮
    const contentArea = document.querySelector('.wish-detail-content');
    let actionsEl = document.getElementById('wish-detail-actions');
    if (actionsEl) actionsEl.remove();

    actionsEl = document.createElement('div');
    actionsEl.id = 'wish-detail-actions';
    actionsEl.className = 'wish-detail-actions';
    
    if (item.status === 'pending') {
        const completeText = item.creator === 'char' ? '帮 Ta 实现' : '标记为已完成';
        actionsEl.innerHTML = `
            <button class="wish-action-btn delete" onclick="wishDeleteEntry()">删除记录</button>
            <button class="wish-action-btn complete" onclick="wishCompleteEntry()">${completeText}</button>
        `;
    } else {
        actionsEl.innerHTML = `
            <button class="wish-action-btn delete" onclick="wishDeleteEntry()">删除记录</button>
            <div style="color: #999; font-size: 13px; font-weight: bold; display: flex; align-items: center;">已存入成就墙</div>
        `;
    }
    contentArea.appendChild(actionsEl);

    const view = document.getElementById('wish-detail-view');
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
}

function wishCloseDetail() {
    const view = document.getElementById('wish-detail-view');
    view.classList.remove('active');
    setTimeout(() => view.style.display = 'none', 300);
    wishState.currentDetailId = null;
    wishState.currentDetailType = null;
}

function wishDeleteEntry() {
    if (!confirm("确定要删除这条记录吗？")) return;
    const id = wishState.currentDetailId;
    const type = wishState.currentDetailType;
    const data = getWishData();
    
    if (type === 'wish') data.wishes = data.wishes.filter(w => w.id !== id);
    else data.todos = data.todos.filter(t => t.id !== id);
    
    wishSaveData();
    wishRenderList(type);
    wishCloseDetail();
}

function wishCompleteEntry() {
    const id = wishState.currentDetailId;
    const type = wishState.currentDetailType;
    wishToggleStatus(id, type);
    wishCloseDetail();
}

function wishToggleStatus(id, type) {
    const data = getWishData();
    if (!data) return;

    const item = type === 'wish' ? data.wishes.find(w => w.id === id) : data.todos.find(t => t.id === id);
    if (!item) return;

    if (item.status === 'pending') {
        item.status = 'done';
        // 移入成就墙
        data.achievements.unshift({
            id: Date.now(),
            title: item.title,
            date: Date.now(),
            type: type
        });
        
        // 👇 新增：如果完成的是 Char 的愿望，通知 AI
        if (item.creator === 'char') {
            const char = wcState.characters.find(c => c.id === wishState.activeCharId);
            if (char) {
                const typeName = type === 'wish' ? '愿望' : '待办事项';
                const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚在星愿空间里，帮你实现了你许下的${typeName}：“${item.title}”！请在接下来的聊天中，表达你的惊喜、开心和感谢。]`;
                wcAddMessage(char.id, 'system', 'system', aiPrompt, { hidden: true });
            }
        }

        // 解锁拼图
        if (data.puzzleUnlocked < 16) {
            data.puzzleUnlocked++;
            alert(`太棒了！已完成该事项，并解锁了一块新的拼图碎片！(${data.puzzleUnlocked}/16)`);
        } else {
            alert("太棒了！已完成该事项！(拼图已全部解锁)");
        }
    } else {
        // 允许反悔取消完成
        item.status = 'pending';
        data.achievements = data.achievements.filter(a => a.title !== item.title);
        if (data.puzzleUnlocked > 0) data.puzzleUnlocked--;
    }

    wishSaveData();
    wishRenderList(type);
}

// --- 成就墙与拼图 ---
function wishRenderAchievements() {
    const container = document.getElementById('achieve-list-container');
    container.innerHTML = '';
    
    const data = getWishData();
    if (!data || data.achievements.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; margin-top: 50px; font-style: italic;">完成的愿望会化作回忆存放在这里...</div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'achieve-wall-grid';

    data.achievements.forEach(ach => {
        const dateStr = new Date(ach.date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
        const tag = ach.type === 'wish' ? 'WISH' : 'TO-DO';
        
        const card = document.createElement('div');
        card.className = 'achieve-card';
        card.innerHTML = `
            <div>
                <div class="achieve-card-tag">${tag}</div>
                <div class="achieve-card-title">${ach.title}</div>
            </div>
            <div class="achieve-card-date">${dateStr}</div>
        `;
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
}

function wishRenderPuzzle() {
    const data = getWishData();
    if (!data) return;

    document.getElementById('puzzle-count-display').innerText = data.puzzleUnlocked;
    const grid = document.getElementById('wish-puzzle-grid');
    grid.innerHTML = '';
    
    for (let i = 0; i < 16; i++) {
        const piece = document.createElement('div');
        if (i < data.puzzleUnlocked) {
            piece.className = `wish-puzzle-piece unlocked p-${i}`;
            piece.style.backgroundImage = `url('${data.puzzleBg}')`;
        } else {
            piece.className = 'wish-puzzle-piece';
            // 移除 emoji，保持全白块
        }
        grid.appendChild(piece);
    }
}

function wishHandlePuzzleUpload(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = getWishData();
            if (data) {
                data.puzzleBg = e.target.result;
                wishSaveData();
                wishRenderPuzzle();
            }
        };
        reader.readAsDataURL(file);
    }
}

/* ==========================================================================
   星愿空间：探索内心深处 (小游戏) 逻辑
   ========================================================================== */

let currentExploreData = null;

async function wishExploreDeepDesire() {
    const charId = wishState.activeCharId;
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = await getActiveApiConfig('npc');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("正在潜入 Ta 的内心深处...");

    try {
        const chatConfig = char.chatConfig || {};
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        
        // 读取世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【世界观参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 读取记忆
        let memoryText = "暂无特殊记忆。";
        if (char.memories && char.memories.length > 0) {
            const readCount = chatConfig.aiMemoryCount || 5;
            memoryText = char.memories.slice(0, readCount).map(m => `- ${m.content}`).join('\n');
        }

        let prompt = `你现在是一个恋爱文字冒险游戏(Galgame)的剧情引擎。\n`;
        prompt += `【攻略目标】：${char.name}\n`;
        prompt += `【目标人设】：${char.prompt}\n${wbInfo}\n`;
        prompt += `【玩家(User)设定】：${userPersona}\n`;
        prompt += `【两人的共同记忆】：\n${memoryText}\n\n`;
        
        prompt += `【任务】：请根据以上设定，生成一个探索 ${char.name} 内心深处隐藏心愿的互动剧情。\n`;
        prompt += `【要求】：\n`;
        prompt += `1. 设定一个符合人设的场景（scenario），描述 ${char.name} 似乎有心事，欲言又止的样子。\n`;
        prompt += `2. 设定一个 Ta 真正隐藏的心愿（hiddenWishTitle 和 hiddenWishContent）。\n`;
        prompt += `3. 提供 3 个供玩家选择的对话/动作选项（options）。\n`;
        prompt += `4. 这 3 个选项中，只有 1 个是“正确”的（能戳中 Ta 的软肋，让 Ta 吐露心声），另外 2 个是“错误”的（Ta 会掩饰过去）。\n`;
        prompt += `5. 必须返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "scenario": "夜风微凉，Ta 看着远处的灯火，眼神有些闪躲，似乎有什么话想对你说...",
  "hiddenWishTitle": "想和你一起看初雪",
  "hiddenWishContent": "其实...我一直想和你一起看今年的第一场雪。只是怕你太忙，没敢开口。",
  "options": [
    {"text": "你怎么了？是不是不开心？", "isCorrect": false, "response": "没、没什么，可能是风有点大吧。"},
    {"text": "(轻轻握住Ta的手) 无论你在想什么，我都在。", "isCorrect": true, "response": "(反握住你的手，脸颊微红) 其实...我一直想和你一起看今年的第一场雪。"},
    {"text": "发什么呆呢，走啦回家了。", "isCorrect": false, "response": "哦...好，走吧。"}
  ]
}\n`;

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
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        currentExploreData = JSON.parse(content);
        
        // 渲染弹窗
        document.getElementById('wish-explore-scenario').innerText = currentExploreData.scenario;
        const optionsContainer = document.getElementById('wish-explore-options');
        optionsContainer.innerHTML = '';
        
        currentExploreData.options.forEach((opt, index) => {
            const btn = document.createElement('div');
            btn.className = 'wish-explore-option-btn';
            btn.innerText = opt.text;
            btn.onclick = () => wishChooseExploreOption(index);
            optionsContainer.appendChild(btn);
        });

        wcCloseAllPanels();
        wcOpenModal('wish-explore-modal');
        wcShowSuccess("成功潜入内心");

    } catch (e) {
        console.error(e);
        wcShowError("探索失败，Ta 的内心防线太强了");
    }
}

function wishChooseExploreOption(index) {
    if (!currentExploreData) return;
    const option = currentExploreData.options[index];
    
    // 隐藏选项，显示结果
    const optionsContainer = document.getElementById('wish-explore-options');
    optionsContainer.innerHTML = `
        <div style="padding: 16px; background: #F9F9F9; border-radius: 12px; border: 1px solid #EAEAEA; font-size: 14px; color: #333; line-height: 1.5; font-family: 'Kaiti', serif;">
            ${option.response}
        </div>
        <button onclick="wcCloseModal('wish-explore-modal')" style="margin-top: 16px; width: 100%; padding: 14px; background: #111; color: #FFF; border: none; border-radius: 12px; font-size: 14px; font-weight: bold; cursor: pointer;">关闭</button>
    `;

    if (option.isCorrect) {
        // 成功解锁心愿，自动添加到愿望列表
        const data = getWishData();
        if (data) {
            data.wishes.unshift({
                id: Date.now(),
                title: currentExploreData.hiddenWishTitle,
                content: currentExploreData.hiddenWishContent,
                aiReply: null,
                status: 'pending',
                creator: 'char' // 标记为 Char 创建
            });
            wishSaveData();
            wishRenderList('wish');
            
            // 注入聊天记忆
            const char = wcState.characters.find(c => c.id === wishState.activeCharId);
            if (char) {
                const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚通过敏锐的观察，察觉到了你隐藏的心愿：“${currentExploreData.hiddenWishTitle}”。这个心愿已经自动添加到了星愿空间。请在接下来的聊天中，表现出被看穿心思的害羞或感动。]`;
                wcAddMessage(char.id, 'system', 'system', aiPrompt, { hidden: true });
            }
        }
    }
}
// ==========================================
// 🌟 新增：天气系统核心逻辑 (Weather System)
// ==========================================
let cachedUserWeather = null;

// 获取用户当前真实天气
async function getUserWeather() {
    if (cachedUserWeather) return cachedUserWeather;
    return new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
                    const data = await res.json();
                    cachedUserWeather = data.current_weather;
                    resolve(cachedUserWeather);
                } catch (e) { resolve(null); }
            }, () => resolve(null), { timeout: 5000 });
        } else { resolve(null); }
    });
}

// 获取指定经纬度的真实天气
async function getRealWeather(lat, lon) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        return data.current_weather;
    } catch (e) { return null; }
}

// 将天气代码转换为 Emoji
function getWeatherEmoji(code) {
    if (code === 0) return '☀️'; // 晴
    if (code === 1 || code === 2) return '⛅'; // 多云
    if (code === 3) return '☁️'; // 阴
    if (code >= 45 && code <= 67) return '🌧️'; // 雨
    if (code >= 71 && code <= 82) return '❄️'; // 雪
    if (code >= 95) return '⛈️'; // 雷暴
    return '🌤️';
}
// ==========================================
// 🌟 新增：AI 天气感知 Prompt 生成器
// ==========================================
const charWeatherCache = {}; // 缓存角色的真实天气，避免频繁请求 API

async function getWeatherPrompt(char) {
    if (!char || !char.chatConfig) return "";
    
    let userWeatherStr = "";
    let charWeatherStr = "";

    try {
        // 1. 获取 User 天气 (设置 2 秒超时，防止网络差导致聊天卡死)
        const userWeatherPromise = getUserWeather();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2000));
        const userWeather = await Promise.race([userWeatherPromise, timeoutPromise]);
        
        if (userWeather) {
            userWeatherStr = `${getWeatherEmoji(userWeather.weathercode)} ${Math.round(userWeather.temperature)}°C`;
        }

        // 2. 获取 Char 天气
        if (char.chatConfig.locationType === 'real' && char.chatConfig.locationLat) {
            const cacheKey = `${char.chatConfig.locationLat},${char.chatConfig.locationLon}`;
            let charWeather = charWeatherCache[cacheKey];
            
            // 1小时缓存，避免重复请求
            if (!charWeather || (Date.now() - charWeather.timestamp > 3600000)) { 
                const charWeatherPromise = getRealWeather(char.chatConfig.locationLat, char.chatConfig.locationLon);
                const cw = await Promise.race([charWeatherPromise, timeoutPromise]);
                if (cw) {
                    charWeatherCache[cacheKey] = { data: cw, timestamp: Date.now() };
                    charWeather = charWeatherCache[cacheKey];
                }
            }
            
            if (charWeather && charWeather.data) {
                charWeatherStr = `${getWeatherEmoji(charWeather.data.weathercode)} ${Math.round(charWeather.data.temperature)}°C`;
            }
        } else if (char.chatConfig.locationType === 'virtual') {
            // 如果是异世界，直接读取虚拟地图生成的天气
            if (wcState.virtualWorldData && wcState.virtualWorldData.weather) {
                charWeatherStr = `✨ ${wcState.virtualWorldData.weather.desc} ${wcState.virtualWorldData.weather.temp}`;
            }
        }

        // 3. 组装 Prompt
        if (userWeatherStr || charWeatherStr) {
            let prompt = `\n【环境与天气感知】：\n`;
            if (charWeatherStr) prompt += `- 你所在地的天气：${charWeatherStr}\n`;
            if (userWeatherStr) prompt += `- User 所在地的天气：${userWeatherStr}\n`;
            prompt += `(请在聊天中自然地体现出天气的差异，例如提醒对方添衣、抱怨自己这边的天气等，但绝对不要生硬地像天气预报一样播报！)\n`;
            return prompt;
        }
    } catch (e) {
        console.warn("获取天气 Prompt 失败", e);
    }
    return "";
}
// ==========================================
// 全自动静默保存监听器 (MutationObserver)
// ==========================================
function observeWidgetChanges(el, instanceId) {
    const contentDiv = el.querySelector('.content');
    if (!contentDiv) return;

    let timeout = null;
    // 创建一个观察者，时刻盯着小组件的变化
    const observer = new MutationObserver((mutations) => {
        // 防抖处理：防止上传大图片时频繁触发导致卡顿，延迟 500ms 保存
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const widget = customDesktopWidgets.find(w => w.instanceId === instanceId);
            if (widget) {
                // 1. 保存内部最新的 HTML (包括你换的图片 base64 和改的文字)
                widget.content = contentDiv.innerHTML;
                
                // 2. 保存外层容器被魔法脚本修改的样式 (大小、透明背景等)
                widget.customStyles = {
                    width: el.style.width,
                    height: el.style.height,
                    background: el.style.background,
                    border: el.style.border,
                    boxShadow: el.style.boxShadow,
                    backdropFilter: el.style.backdropFilter
                };
                
                // 3. 写入数据库
                saveCustomWidgetsData();
            }
        }, 500);
    });

    // 启动监听：监听所有属性(src/style)、子节点和文本的变化
    observer.observe(el, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
        attributeFilter: ['src', 'style'] 
    });
}
// ==========================================
// 4x3 内置小组件的移除与拖拽逻辑
// ==========================================
function removeMainWidget() {
    const mainWidget = document.getElementById('mainWidget');
    if (mainWidget) {
        mainWidget.style.display = 'none';
        saveNewWidgetData();
    }
}

function makeMainWidgetDraggable(el) {
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

        // 边缘检测翻页逻辑
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
            saveNewWidgetData(); // 拖拽结束自动保存位置
        }
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    }
}
// ==========================================================================
// 新增：一键生成查手机所有内容 (除通讯录和歌单)
// ==========================================================================
function wcConfirmGenerateAllPhoneData() {
    if (confirm("是否一键生成查手机所有内容？\n（将覆盖现有的抖音，文件管理，手机状态、浏览器、隐私、购物车、钱包和聊天记录，不包含通讯录和歌单）\n\n注意：生成内容较多，可能需要等待较长时间。")) {
        wcGenerateAllPhoneData();
    }
}

async function wcGenerateAllPhoneData() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return alert("请先进入一个角色的聊天界面或详情页");

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const limit = apiConfig.limit || 50;
    if (limit > 0 && sessionApiCallCount >= limit) {
        wcShowError("已达到API调用上限");
        return;
    }
    sessionApiCallCount++;

    wcShowLoading("正在一键生成手机所有数据(耗时较长请耐心等待)...");

    try {
        const chatConfig = char.chatConfig || {};
        
        // 1. 读取用户面具/设定
        const userName = chatConfig.userName || wcState.user.name;
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        
        // 2. 读取最近 30 条聊天记录
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-30).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        // 3. 读取当前聊天设置中勾选的世界书
        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【世界观与背景设定参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        // 提取通讯录 NPC 列表，供生成聊天记录使用
        const contacts = char.phoneData && char.phoneData.contacts ? char.phoneData.contacts.filter(c => !c.isUser) : [];
        let contactsInfo = "通讯录中暂无其他NPC，请自由发挥生成。";
        if (contacts.length > 0) {
            contactsInfo = "【通讯录NPC列表】:\n" + contacts.map(c => `- ${c.name} (${c.type === 'group' ? '群聊' : '好友'}): ${c.desc}`).join('\n');
        }

        const now = new Date();
        const timeString = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
        const timePrompt = `\n【绝对时间基准】：当前现实时间是 ${timeString} ${dayString}。你生成的所有数据的时间戳必须合理，不能超过当前时间，且内容要符合当前的时间段氛围。\n`;

        const lifeStatusPrompt = getLifeStatusPrompt(char);

        // 组装强大的 Prompt
        let prompt = `你扮演角色：${char.name}。\n`;
        prompt += timePrompt;
        prompt += `【你的人设】：${char.prompt}\n${wbInfo}\n`;
        prompt += `【用户(${userName})设定】：${userPersona}\n`;
        prompt += lifeStatusPrompt; 
        if (chatConfig.bilingualEnabled) {
            const sourceLang = chatConfig.bilingualSource || '英语';
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：除了 "chats" (聊天记录) 里的 "content" 可以继续使用双语格式（${sourceLang}和${targetLang}）外，你生成的其他所有手机内部数据（如备忘录、浏览记录、账单、私密记录等）必须全部使用 ${targetLang}！绝对不要在非聊天记录的地方使用双语格式！\n`;
        }
        prompt += `【核心场景设定】：我（${userName}）现在正在偷偷查看你（${char.name}）的手机。\n`;
        prompt += `【最近我们的聊天记录（20-30条）】：\n${recentMsgs}\n\n`;
        prompt += `${contactsInfo}\n\n`;
        
        prompt += `请基于你的人设、世界观背景、当前生活状态，以及我们**最近的聊天上下文**，一次性生成你手机里的各项数据（不包含通讯录和歌单）。\n`;
        prompt += `【核心要求（极具活人感与强因果逻辑）】：\n`;
        prompt += `0. 【最高警告】：所有生成的内容必须严格符合【世界观背景】和【你的人设】，并且必须是对【最近聊天记录】的延伸、复盘或吐槽！\n`;
        prompt += `1. 手机状态 (settings)：包含 battery(电量), screenTime(屏幕时间), appUsage(3-6个APP时长), locations(3-6个今日行程)。\n`;
        prompt += `2. 浏览器 (browser)：包含 history(3-6条浏览记录,带内心批注), posts(2-4个论坛帖子,带评论)。\n`;
        prompt += `3. 私密记录 (privacy)：包含 masturbation(自慰记录) 和 wetDream(春梦记录)。\n`;
        prompt += `4. 购物车 (cartApp)：包含 cart(3-6条购物车商品) 和 history(3-6条购买记录)。\n`;
        prompt += `5. 钱包 (wallet)：包含 balance(余额) 和 transactions(4-8条交易记录)。\n`;
        prompt += `6. 聊天记录 (chats)：生成 3-6 个聊天会话。必须包含一个与用户(${userName})的会话。如果是群聊(isGroup为true)，history里的每条消息必须带上 "name" 字段标明发言人！\n`;
        prompt += `7. 短视频 (videoApp)：包含 homeFeed(3个推荐视频), profile(个人主页数据,含posts/likedPosts/privatePosts), inbox(2条私信), discover(3个热搜), drafts(1个草稿)。\n`;
        prompt += `8. 文件管理 (filesApp)：包含 homeCards(3个最近文件), photos(3张照片描述), audios(2条录音), docs(2个文档)。\n`;
        prompt += `【极度精简警告】：由于生成数据量极大，请务必精简每个字段的字数，不要长篇大论，确保能一次性输出完整的 JSON！\n`;
        prompt += `推演结束后，直接返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "settings": {
    "battery": 85, "screenTime": "4小时20分",
    "appUsage": [{"name": "微信", "time": "2小时"}],
    "locations": [{"time": "10:00", "place": "公司", "desc": "开会好困"}]
  },
  "browser": {
    "history": [{"title": "网页标题", "url_placeholder": "xxx.com", "annotation": "内心批注", "time": "10:30"}],
    "posts": [{"title": "帖子标题", "content": "正文", "author": "匿名", "comments": [{"author": "网友", "content": "评论"}]}]
  },
  "privacy": {
    "masturbation": {"time": "昨晚", "status": "状态", "action": "动作", "feeling": "感受"},
    "wetDream": {"time": "前天", "status": "状态", "dream": "梦境", "feeling": "感受"}
  },
  "cartApp": {
    "cart": [{"name": "商品名", "desc": "加购OS", "price": "129.00"}],
    "history": [{"name": "商品名", "desc": "购买OS", "price": "45.00", "date": "10-24"}]
  },
  "wallet": {
    "balance": 1234.56,
    "transactions": [{"type": "expense", "amount": 25.50, "note": "买水", "time": "10-24 12:00"}]
  },
  "chats": [
    {
      "name": "工作群", "isUser": false, "isGroup": true, "lastMsg": "收到", "time": "10:30",
      "history": [
        {"sender": "them", "name": "老板", "content": "开会"},
        {"sender": "me", "name": "${char.name}", "content": "收到"}
      ]
    }
  ],
  "videoApp": {
    "homeFeed": [{"author": "@网友", "imageDesc": "[画面]猫", "desc": "可爱", "likes": "10k", "commentCount": "1k", "saves": "1k", "shares": "1k", "comments": [{"name": "A", "text": "萌"}]}],
    "profile": {
      "followers": "10K", "following": "10", "likes": "1M",
      "posts": [{"imageDesc": "[画面]风景", "desc": "今天天气真好", "views": "1K", "likes": "100", "commentCount": "10", "saves": "5", "shares": "2", "comments": []}],
      "likedPosts": [], "privatePosts": []
    },
    "inbox": [{"name": "路人", "msg": "你好", "time": "1h"}],
    "discover": [{"title": "热搜事件", "views": "1M"}],
    "drafts": []
  },
  "filesApp": {
    "homeCards": [{"type": "image", "title": "1.jpg", "desc": "照片描述", "meta": "地点", "size": "1MB"}],
    "photos": [{"desc": "照片描述"}],
    "audios": [{"title": "录音", "duration": "01:00", "date": "今天", "content": "转写内容"}],
    "docs": [{"title": "文档.pdf", "size": "1MB", "date": "今天", "type": "pdf", "content": "正文"}]
  }
}\n`;

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: parseFloat(apiConfig.temp) || 0.8,
                max_tokens: 12000
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `HTTP 错误: ${response.status}`);
        if (!data.choices || !data.choices[0] || !data.choices[0].message) throw new Error("API 返回数据异常");

        let content = data.choices[0].message.content;
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let resultData;
        try {
            resultData = JSON.parse(content);
        } catch (parseErr) {
            throw new Error("AI 返回的 JSON 格式错误，请重试。");
        }

        if (!char.phoneData) char.phoneData = {};
        
        // 合并数据，保留原有的 playlists (歌单)
        if (resultData.settings) {
            const oldPlaylists = (char.phoneData.settings && char.phoneData.settings.playlists) ? char.phoneData.settings.playlists : [];
            const oldPlaylist = (char.phoneData.settings && char.phoneData.settings.playlist) ? char.phoneData.settings.playlist : [];
            char.phoneData.settings = resultData.settings;
            char.phoneData.settings.playlists = oldPlaylists;
            char.phoneData.settings.playlist = oldPlaylist;
        }
        if (resultData.browser) char.phoneData.browser = resultData.browser;
        if (resultData.privacy) char.phoneData.privacy = resultData.privacy;
        if (resultData.cartApp) char.phoneData.cartApp = resultData.cartApp;
        if (resultData.wallet) char.phoneData.wallet = resultData.wallet;
        
        // 👇 新增：保存短视频和文件管理数据 👇
        if (resultData.videoApp) {
            // 为短视频注入随机头像
            if (resultData.videoApp.homeFeed) {
                resultData.videoApp.homeFeed.forEach(v => {
                    v.avatar = getRandomNpcAvatar();
                    if (v.comments) v.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                });
            }
            if (resultData.videoApp.inbox) {
                resultData.videoApp.inbox.forEach(msg => msg.avatar = getRandomNpcAvatar());
            }
            if (resultData.videoApp.profile) {
                if (resultData.videoApp.profile.posts) {
                    resultData.videoApp.profile.posts.forEach(p => {
                        if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                    });
                }
                if (resultData.videoApp.profile.likedPosts) {
                    resultData.videoApp.profile.likedPosts.forEach(p => {
                        p.avatar = getRandomNpcAvatar();
                        if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                    });
                }
                if (resultData.videoApp.profile.privatePosts) {
                    resultData.videoApp.profile.privatePosts.forEach(p => {
                        if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                    });
                }
            }
            if (resultData.videoApp.drafts) {
                resultData.videoApp.drafts.forEach(p => {
                    if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                });
            }
            char.phoneData.videoApp = resultData.videoApp;
        }
        
        if (resultData.filesApp) {
            char.phoneData.filesApp = resultData.filesApp;
        }
        // 👆 新增结束 👆

        // 处理聊天记录
        if (resultData.chats) {
            const formattedChats = resultData.chats.map(c => ({
                id: Date.now() + Math.random(),
                name: c.name,
                isUser: c.isUser || false,
                isGroup: c.isGroup || false,
                lastMsg: c.lastMsg || "",
                time: c.time || "",
                avatar: "", // 将在渲染时分配
                history: c.history || []
            }));
            char.phoneData.chats = formattedChats;
        }
        
        wcSaveData();

        // 刷新当前可见的页面
        if (document.getElementById('wc-phone-app-settings').style.display === 'flex') wcGeneratePhoneSettings(true);
        if (document.getElementById('wc-phone-app-browser').style.display === 'flex') wcRenderPhoneBrowserContent();
        if (document.getElementById('wc-phone-app-privacy').style.display === 'flex') wcRenderPhonePrivacyContent();
        if (document.getElementById('wc-phone-app-cart').style.display === 'flex') wcRenderPhoneCartContent();
        if (document.getElementById('wc-phone-app-wallet').style.display === 'flex') wcRenderPhoneWalletContent();
        if (document.getElementById('wc-phone-app-message').style.display === 'flex') wcRenderPhoneChats();
        
        // 👇 新增：刷新短视频和文件管理页面 👇
        if (document.getElementById('videoApp') && document.getElementById('videoApp').classList.contains('active')) {
            if (typeof wcRenderVideoApp === 'function') wcRenderVideoApp();
        }
        if (document.getElementById('wc-phone-app-files') && document.getElementById('wc-phone-app-files').style.display === 'flex') {
            if (typeof wcRenderPhoneFilesContent === 'function') wcRenderPhoneFilesContent();
        }
        // 👆 新增结束 👆

        wcShowSuccess("一键生成成功");

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(`[一键生成失败] ${e.message}`);
        } else {
            wcShowError("生成失败");
        }
    }
}
/* ==========================================================================
   新增：微信红包 (Red Packet) 核心逻辑
   ========================================================================== */

let wcCurrentRpType = 'normal'; 
let wcCurrentRpData = null; 
let wcActiveRpMsgId = null;

// 1. 打开红包面板
window.wcOpenRedPacketPanel = function() {
    wcCloseAllPanels();
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (!char) return;

    const rp = document.getElementById('rp-fullscreen');
    const typeSwitchContainer = document.getElementById('rp-type-switch-container');
    const groupCount = document.getElementById('rp-group-count');
    const groupTarget = document.getElementById('rp-group-target');
    const amountLabel = document.getElementById('rp-amount-label');

    // 重置表单
    document.getElementById('rp-amount').value = '';
    document.getElementById('rp-count').value = '';
    document.getElementById('rp-msg').value = '';
    wcCheckRpInput();

    if (char.isGroup) {
        typeSwitchContainer.style.display = 'flex';
        
        // 填充专属红包的下拉框
        const select = document.getElementById('rp-target-select');
        select.innerHTML = '';
        if (char.members) {
            char.members.forEach(mId => {
                if (mId === 'user') return;
                const mChar = wcState.characters.find(c => c.id === mId);
                if (mChar) {
                    select.innerHTML += `<option value="${mChar.name}">${mChar.name}</option>`;
                }
            });
        }
        document.getElementById('rp-group-member-count').innerText = `本群共 ${char.members ? char.members.length : 0} 人`;
        
        wcSwitchRpType('random'); // 群聊默认拼手气
    } else {
        typeSwitchContainer.style.display = 'none';
        groupCount.style.display = 'none';
        groupTarget.style.display = 'none';
        amountLabel.innerHTML = '金额';
        wcCurrentRpType = 'normal';
    }

    rp.style.display = 'flex';
    setTimeout(() => rp.classList.add('active'), 10);
};

// 2. 切换红包类型
window.wcSwitchRpType = function(type) {
    wcCurrentRpType = type;
    document.querySelectorAll('.rp-type-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.rp-type-item[onclick="wcSwitchRpType('${type}')"]`).classList.add('active');

    const groupCount = document.getElementById('rp-group-count');
    const groupTarget = document.getElementById('rp-group-target');
    const amountLabel = document.getElementById('rp-amount-label');

    if (type === 'random') {
        groupCount.style.display = 'block';
        groupTarget.style.display = 'none';
        amountLabel.innerHTML = '<span class="rp-label-icon">拼</span>总金额';
    } else if (type === 'normal') {
        groupCount.style.display = 'block';
        groupTarget.style.display = 'none';
        amountLabel.innerHTML = '单个金额';
    } else if (type === 'exclusive') {
        groupCount.style.display = 'none';
        groupTarget.style.display = 'block';
        amountLabel.innerHTML = '金额';
    }
    wcCheckRpInput();
};

// 3. 校验输入
window.wcCheckRpInput = function() {
    const amount = parseFloat(document.getElementById('rp-amount').value) || 0;
    const count = parseInt(document.getElementById('rp-count').value) || 0;
    const btn = document.getElementById('rp-submit-btn');
    const display = document.getElementById('rp-amount-display');
    const displayText = document.getElementById('rp-amount-text');

    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    const isGroup = char ? char.isGroup : false;

    let isValid = false;
    let totalAmount = 0;

    if (!isGroup || wcCurrentRpType === 'exclusive') {
        isValid = amount > 0;
        totalAmount = amount;
    } else if (wcCurrentRpType === 'random') {
        isValid = amount > 0 && count > 0 && amount >= count * 0.01;
        totalAmount = amount;
    } else if (wcCurrentRpType === 'normal') {
        isValid = amount > 0 && count > 0;
        totalAmount = amount * count;
    }

    if (isValid) {
        btn.classList.add('active');
        display.style.display = 'block';
        displayText.innerText = totalAmount.toFixed(2);
    } else {
        btn.classList.remove('active');
        display.style.display = 'none';
    }
};

// 4. 弹出密码框并发送
window.wcShowRpPassword = function() {
    const totalAmount = parseFloat(document.getElementById('rp-amount-text').innerText);
    
    wcOpenGeneralInput(`发红包 ¥${totalAmount.toFixed(2)} (输入支付密码)`, (pass) => {
        if (pass !== wcState.wallet.password) {
            alert("密码错误！");
            return;
        }
        if (wcState.wallet.balance < totalAmount) {
            alert("余额不足！请先前往「我-钱包」充值哦~");
            return;
        }

        // 扣除余额
        wcState.wallet.balance -= totalAmount;
        wcState.wallet.transactions.push({
            id: Date.now(), type: 'payment', amount: totalAmount, note: `发微信红包`, time: Date.now()
        });

        const charId = wcState.activeChatId;
        const char = wcState.characters.find(c => c.id === charId);
        const count = parseInt(document.getElementById('rp-count').value) || 1;
        const msg = document.getElementById('rp-msg').value || '恭喜发财，大吉大利';
        const target = document.getElementById('rp-target-select').value;

        const rpData = {
            id: Date.now().toString(),
            type: wcCurrentRpType,
            isGroup: char.isGroup,
            totalAmount: totalAmount,
            count: count,
            msg: msg,
            target: wcCurrentRpType === 'exclusive' ? target : null,
            sender: 'User',
            status: 'unopened', 
            receivers: [] 
        };

        // 发送消息
        wcAddMessage(charId, 'me', 'redpacket', '微信红包', { rpData: rpData });
        
        // 告诉 AI 发了红包
        let aiPrompt = `[系统内部信息(仅AI可见): User 刚刚在聊天中发了一个微信红包。总金额：¥${totalAmount.toFixed(2)}，留言：“${msg}”。`;
        if (char.isGroup) {
            if (wcCurrentRpType === 'random') aiPrompt += `这是一个拼手气红包，共 ${count} 个。`;
            else if (wcCurrentRpType === 'normal') aiPrompt += `这是一个普通红包，共 ${count} 个。`;
            else if (wcCurrentRpType === 'exclusive') aiPrompt += `这是一个专属红包，仅限【${target}】领取。`;
            aiPrompt += `群里的NPC可以根据自己的人设决定是否抢红包。如果决定抢，请在返回的 JSON 数组中加入 {"type":"redpacket_receive", "id": "${rpData.id}", "senderName": "抢红包的角色名"} 指令。注意：专属红包只有指定的人能抢成功！]`;
        } else {
            aiPrompt += `请根据你的人设决定是否领取。如果决定领取，请在返回的 JSON 数组中加入 {"type":"redpacket_receive", "id": "${rpData.id}"} 指令，并在回复中做出反应。]`;
        }
        
        wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });
        
        wcSaveData();
        wcCloseRpModals();
        
    }, true);
};

// 5. 点击聊天界面的红包卡片
window.wcClickRedPacket = function(msgId) {
    const charId = wcState.activeChatId;
    const msgs = wcState.chats[charId];
    const msg = msgs.find(m => m.id.toString() === msgId.toString());
    if (!msg || !msg.rpData) return;

    wcActiveRpMsgId = msgId;
    const rp = msg.rpData;
    
    // 判断是否是专属红包且不是发给自己的
    if (rp.type === 'exclusive' && rp.target !== 'User' && rp.sender !== 'User') {
        alert(`仅 ${rp.target} 可领取`);
        return;
    }

    // 判断自己是否已经领过
    const hasReceived = rp.receivers.some(r => r.name === 'User');
    
    // 判断是否是单聊且是自己发的
    const isSingleAndMine = !rp.isGroup && rp.sender === 'User';

    // 修复：如果是群聊，'opened' 代表红包还有剩余，只有 'empty' 才代表领完；单聊 'opened' 即代表领完
    if (rp.status === 'empty' || hasReceived || (!rp.isGroup && rp.status === 'opened') || isSingleAndMine) {
        // 已经领过或领完了，或者单聊自己发的，直接进详情
        wcShowRpDetail(rp);
    } else {
        // 弹出拆红包界面
        const char = wcState.characters.find(c => c.id === charId);
        let senderAvatar = wcState.user.avatar;
        let senderName = wcState.user.name;
        
        if (rp.sender !== 'User') {
            const senderChar = wcState.characters.find(c => c.name === rp.sender);
            senderAvatar = senderChar ? senderChar.avatar : getRandomNpcAvatar();
            senderName = rp.sender;
        }

        document.getElementById('rp-open-avatar').src = senderAvatar;
        document.getElementById('rp-open-sender-name').innerText = senderName;
        document.getElementById('rp-open-msg-text').innerText = rp.msg;
        
        let desc = '发了一个红包';
        if (rp.type === 'random') desc += '，金额随机';
        document.getElementById('rp-open-desc-text').innerText = desc;

        const overlay = document.getElementById('rp-open-overlay');
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);
        
        const btn = document.getElementById('rp-open-btn');
        btn.style.display = 'flex';
        btn.classList.remove('spin');
        document.getElementById('rp-open-detail-link').style.display = 'none';
    }
};

// 6. 播放拆红包动画并计算金额
window.wcPlayRpAnimation = function() {
    const btn = document.getElementById('rp-open-btn');
    btn.classList.add('spin');
    
    setTimeout(() => {
        const charId = wcState.activeChatId;
        const msgs = wcState.chats[charId];
        const msg = msgs.find(m => m.id.toString() === wcActiveRpMsgId.toString());
        const rp = msg.rpData;

        let myAmount = 0;

        if (!rp.isGroup) {
            // 单聊，直接全领
            myAmount = rp.totalAmount;
            rp.receivers.push({ name: 'User', avatar: wcState.user.avatar, amount: myAmount, time: new Date().toLocaleTimeString() });
            rp.status = 'opened';
        } else {
            // 群聊分配
            if (rp.type === 'normal' || rp.type === 'exclusive') {
                myAmount = rp.totalAmount / rp.count;
                rp.receivers.push({ name: 'User', avatar: wcState.user.avatar, amount: myAmount, time: new Date().toLocaleTimeString() });
            } else if (rp.type === 'random') {
                // 拼手气分配
                let remainAmount = rp.totalAmount;
                let remainCount = rp.count;
                
                // 减去已经被其他人领走的
                rp.receivers.forEach(r => {
                    remainAmount -= r.amount;
                    remainCount--;
                });

                if (remainCount === 1) {
                    myAmount = parseFloat(remainAmount.toFixed(2));
                } else {
                    let max = (remainAmount / remainCount) * 2;
                    myAmount = Math.random() * max;
                    if (myAmount < 0.01) myAmount = 0.01;
                    myAmount = parseFloat(myAmount.toFixed(2));
                }
                rp.receivers.push({ name: 'User', avatar: wcState.user.avatar, amount: myAmount, time: new Date().toLocaleTimeString() });
            }
            
            if (rp.receivers.length >= rp.count) {
                rp.status = 'empty';
            } else {
                rp.status = 'opened';
            }
        }

        // 钱存入钱包
        wcState.wallet.balance += myAmount;
        wcState.wallet.transactions.push({
            id: Date.now(), type: 'income', amount: myAmount, note: `抢到红包`, time: Date.now()
        });

        // 更新卡片状态
        const statusEl = document.getElementById(`rp-status-${rp.id}`);
        if (statusEl) statusEl.innerText = '已领取';
        
        // 插入系统提示
        let sysText = rp.sender === 'User' ? '你领取了自己发的红包' : `你领取了 ${rp.sender} 的红包`;
        wcAddMessage(charId, 'system', 'system', sysText, { style: 'transparent' });

        wcSaveData();
        wcCloseRpModals();
        wcShowRpDetail(rp);
        
    }, 1000);
};

// 7. 显示红包详情页
window.wcShowRpDetail = function(rpData) {
    let rp = rpData;
    if (!rp) {
        const msgs = wcState.chats[wcState.activeChatId];
        const msg = msgs.find(m => m.id.toString() === wcActiveRpMsgId.toString());
        rp = msg.rpData;
    }

    const detail = document.getElementById('rp-detail-fullscreen');
    
    let senderAvatar = wcState.user.avatar;
    if (rp.sender !== 'User') {
        const senderChar = wcState.characters.find(c => c.name === rp.sender);
        senderAvatar = senderChar ? senderChar.avatar : getRandomNpcAvatar();
    }

    document.getElementById('rp-detail-avatar').src = senderAvatar;
    document.getElementById('rp-detail-sender-name').innerText = `${rp.sender}的红包`;
    document.getElementById('rp-detail-msg-text').innerText = rp.msg;

    // 查找自己的领取记录
    const myRecord = rp.receivers.find(r => r.name === 'User');
    const myAmountBox = document.getElementById('rp-detail-my-amount-box');
    if (myRecord) {
        myAmountBox.style.display = 'block';
        document.getElementById('rp-detail-my-amount').innerText = myRecord.amount.toFixed(2);
    } else {
        myAmountBox.style.display = 'none';
    }

    // 渲染列表
    let grabbedAmount = 0;
    rp.receivers.forEach(r => grabbedAmount += r.amount);
    document.getElementById('rp-detail-list-header').innerText = `已领取 ${rp.receivers.length}/${rp.count} 个，共 ${grabbedAmount.toFixed(2)}/${rp.totalAmount.toFixed(2)} 元`;
    
    const list = document.getElementById('rp-detail-list');
    list.innerHTML = '';
    
    let bestAmount = 0;
    if (rp.type === 'random' && rp.receivers.length === rp.count) {
        bestAmount = Math.max(...rp.receivers.map(r => r.amount));
    }

    rp.receivers.forEach(r => {
        const isBest = (rp.type === 'random' && r.amount === bestAmount);
        const bestHtml = isBest ? `<div class="rp-detail-item-best"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>手气最佳</div>` : '';
        
        list.innerHTML += `
            <div class="rp-detail-item">
                <img src="${r.avatar}" class="rp-detail-item-avatar">
                <div class="rp-detail-item-info">
                    <div class="rp-detail-item-name">${r.name}</div>
                    <div class="rp-detail-item-time">${r.time}</div>
                </div>
                <div class="rp-detail-item-right">
                    <div class="rp-detail-item-amount">${r.amount.toFixed(2)} 元</div>
                    ${bestHtml}
                </div>
            </div>
        `;
    });

    detail.style.display = 'flex';
    setTimeout(() => detail.classList.add('active'), 10);
};

// 8. 关闭所有红包弹窗
window.wcCloseRpModals = function() {
    const rp = document.getElementById('rp-fullscreen');
    const open = document.getElementById('rp-open-overlay');
    const detail = document.getElementById('rp-detail-fullscreen');
    
    if (rp) { rp.classList.remove('active'); setTimeout(() => rp.style.display = 'none', 300); }
    if (open) { open.classList.remove('active'); setTimeout(() => open.style.display = 'none', 200); }
    if (detail) { detail.classList.remove('active'); setTimeout(() => detail.style.display = 'none', 300); }
};

// 9. 拦截 AI 的 JSON 指令，处理 AI 抢红包
const originalWcParseAIResponseForRp = wcParseAIResponse;
wcParseAIResponse = async function(charId, text, stickerGroupIds) {
    await originalWcParseAIResponseForRp(charId, text, stickerGroupIds);
    
    try {
        let cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let actions = [];
        const startObj = cleanText.indexOf('{');
        const endObj = cleanText.lastIndexOf('}');
        const startArr = cleanText.indexOf('[');
        const endArr = cleanText.lastIndexOf(']');

        if (startObj !== -1 && endObj !== -1 && (startArr === -1 || startObj < startArr)) {
            let objText = cleanText.substring(startObj, endObj + 1);
            objText = objText.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
            objText = objText.replace(/([^\\])"\s*}/g, '$1"}');
            const parsed = JSON.parse(objText);
            if (parsed.replies && Array.isArray(parsed.replies)) {
                actions = parsed.replies;
            } else if (parsed.type && parsed.content) {
                actions = [parsed];
            }
        } else if (startArr !== -1 && endArr !== -1) {
            let arrText = cleanText.substring(startArr, endArr + 1);
            arrText = arrText.replace(/,\s*]/g, ']').replace(/}\s*{/g, '},{');
            actions = JSON.parse(arrText);
        }

        if (actions && actions.length > 0) {
            actions.forEach(action => {
                if (action.type === 'redpacket_receive' && action.id) {
                    const msgs = wcState.chats[charId];
                    // 修复：用 m.rpData.id 去匹配 action.id，而不是用气泡的 m.id
                    const msg = msgs.find(m => m.rpData && m.rpData.id.toString() === action.id.toString());
                    if (msg && msg.rpData) {
                        const rp = msg.rpData;
                        const char = wcState.characters.find(c => c.id === charId);
                        const senderName = action.senderName || char.name;
                        
                        // 1. 专属红包拦截逻辑
                        if (rp.type === 'exclusive' && senderName !== rp.target) {
                            wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): ${senderName} 试图抢红包，但发现这是给【${rp.target}】的专属红包，抢夺失败。请 ${senderName} 对此做出反应（如尴尬、吐槽等）。]`, { hidden: true });
                            return; // 拦截，不往下执行
                        }

                        // 2. 检查是否还能抢，且自己没抢过
                        if (rp.status !== 'empty' && rp.status !== 'refunded' && !rp.receivers.some(r => r.name === senderName)) {
                            let amt = 0;
                            
                            // 获取抢红包人的头像
                            let grabberAvatar = char.avatar;
                            if (char.isGroup && senderName !== char.name) {
                                const memberChar = wcState.characters.find(c => c.name === senderName);
                                if (memberChar) grabberAvatar = memberChar.avatar;
                            }

                            if (!rp.isGroup) {
                                // 单聊全领
                                amt = rp.totalAmount;
                                rp.status = 'opened';
                            } else {
                                // 群聊分配
                                if (rp.type === 'normal' || rp.type === 'exclusive') {
                                    amt = rp.totalAmount / rp.count;
                                } else if (rp.type === 'random') {
                                    let remainAmount = rp.totalAmount;
                                    let remainCount = rp.count;
                                    rp.receivers.forEach(r => { remainAmount -= r.amount; remainCount--; });
                                    
                                    if (remainCount === 1) {
                                        amt = parseFloat(remainAmount.toFixed(2));
                                    } else {
                                        let max = (remainAmount / remainCount) * 2;
                                        amt = Math.random() * max;
                                        if (amt < 0.01) amt = 0.01;
                                        amt = parseFloat(amt.toFixed(2));
                                    }
                                }
                                if (rp.receivers.length + 1 >= rp.count) rp.status = 'empty';
                                else rp.status = 'opened';
                            }
                            
                            // 记录领取信息
                            rp.receivers.push({ name: senderName, avatar: grabberAvatar, amount: amt, time: new Date().toLocaleTimeString() });
                            
                            // 插入可见的系统提示
                            wcAddMessage(charId, 'system', 'system', `${senderName} 领取了你的红包`, { style: 'transparent' });
                            
                            // 3. 如果是群聊拼手气，且刚好被抢完，触发手气吐槽
                            if (rp.isGroup && rp.type === 'random' && rp.status === 'empty') {
                                let best = rp.receivers[0];
                                let worst = rp.receivers[0];
                                rp.receivers.forEach(r => {
                                    if (r.amount > best.amount) best = r;
                                    if (r.amount < worst.amount) worst = r;
                                });
                                
                                const luckPrompt = `[系统内部信息(仅AI可见): User 发的拼手气红包已被抢完！其中【${best.name}】手气最佳抢到了 ¥${best.amount.toFixed(2)}，【${worst.name}】手气最差只抢到了 ¥${worst.amount.toFixed(2)}。请群友们根据人设对此进行吐槽、炫耀或互动。]`;
                                wcAddMessage(charId, 'system', 'system', luckPrompt, { hidden: true });
                            }

                            wcSaveData();
                            wcRenderMessages(charId);
                        }
                    }
                }
            });
        }
    } catch (e) {
        // 解析失败忽略
    }
};
// ==========================================
// 新增：API 消耗明细与计费逻辑
// ==========================================

// 估算不同模型的费率 (美元 / 1k tokens)
function getModelRate(modelName) {
    const name = modelName.toLowerCase();
    if (name.includes('gpt-4o-mini')) return 0.00015;
    if (name.includes('gpt-4o')) return 0.005;
    if (name.includes('claude-3-5-sonnet')) return 0.003;
    if (name.includes('claude-3-haiku')) return 0.00025;
    if (name.includes('gemini-1.5-flash')) return 0.000075;
    if (name.includes('gemini-1.5-pro')) return 0.0035;
    if (name.includes('gemini-2.0-flash')) return 0.0001;
    if (name.includes('gemini-2.0-pro')) return 0.005;
    return 0.002; // 默认兜底费率
}

// 记录单次 API 消耗
function recordApiBilling(model, tokens) {
    const todayStr = new Date().toLocaleDateString();
    let billingData = JSON.parse(localStorage.getItem('ios_theme_api_billing') || '{}');
    
    // 如果不是今天的数据，清空重置
    if (billingData.date !== todayStr) {
        billingData = { date: todayStr, records: [], totalCost: 0, totalCount: 0 };
    }

    const rate = getModelRate(model);
    const cost = (tokens / 1000) * rate;

    billingData.records.unshift({
        time: Date.now(),
        model: model,
        tokens: tokens,
        cost: cost
    });

    // 最多保留 100 条记录防止撑爆本地存储
    if (billingData.records.length > 100) {
        billingData.records.pop();
    }

    billingData.totalCost += cost;
    billingData.totalCount += 1;

    localStorage.setItem('ios_theme_api_billing', JSON.stringify(billingData));
}

// 打开弹窗并渲染数据
window.openApiBillingModal = function() {
    const modal = document.getElementById('api-billing-modal');
    const listContainer = document.getElementById('api-billing-list-container');
    const totalCountEl = document.getElementById('billing-total-count');
    const totalCostEl = document.getElementById('billing-total-cost');

    const todayStr = new Date().toLocaleDateString();
    const billingData = JSON.parse(localStorage.getItem('ios_theme_api_billing') || '{}');

    if (billingData.date !== todayStr || !billingData.records || billingData.records.length === 0) {
        totalCountEl.innerHTML = `0 <span style="font-size:12px;color:#888;font-family:sans-serif;">次</span>`;
        totalCostEl.innerText = `$0.0000`;
        listContainer.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">今日暂无调用记录</div>';
    } else {
        totalCountEl.innerHTML = `${billingData.totalCount} <span style="font-size:12px;color:#888;font-family:sans-serif;">次</span>`;
        totalCostEl.innerText = `$${billingData.totalCost.toFixed(4)}`;
        
        listContainer.innerHTML = '';
        billingData.records.forEach(record => {
            const timeStr = new Date(record.time).toLocaleTimeString('zh-CN', { hour12: false });
            const tokenStr = record.tokens > 1000 ? (record.tokens / 1000).toFixed(1) + 'k' : record.tokens;
            
            const div = document.createElement('div');
            div.className = 'billing-item';
            div.innerHTML = `
                <div class="billing-item-left">
                    <span class="billing-item-model">${record.model}</span>
                    <span class="billing-item-time">${timeStr}</span>
                </div>
                <div class="billing-item-right">
                    <span class="billing-item-cost">-$${record.cost.toFixed(4)}</span>
                    <span class="billing-item-tokens">${tokenStr} tokens</span>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.closeApiBillingModal = function() {
    const modal = document.getElementById('api-billing-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};

// ==========================================
// 短视频 APP 交互逻辑
// ==========================================
window.openVideoApp = function() {
    document.getElementById('videoApp').classList.add('active');
    switchVideoTab('home');
    // 隐藏 Dock 栏和便利贴
    const dock = document.getElementById('wc-phone-dock');
    if (dock) dock.style.display = 'none';
    const stickyNote = document.getElementById('wc-phone-sticky-note');
    if (stickyNote) stickyNote.style.display = 'none';
    
    // 新增：打开时渲染已有数据
    if (typeof wcRenderVideoApp === 'function') {
        wcRenderVideoApp();
    }

    // 绑定底部加号按钮
    const addBtn = document.querySelector('.v-tab-add');
    if (addBtn) {
        addBtn.onclick = vOpenCameraPage;
    }
};

window.closeVideoApp = function() {
    document.getElementById('videoApp').classList.remove('active');
    // 恢复 Dock 栏和便利贴
    const dock = document.getElementById('wc-phone-dock');
    if (dock) dock.style.display = 'flex';
    const stickyNote = document.getElementById('wc-phone-sticky-note');
    if (stickyNote) stickyNote.style.display = 'flex';
};

window.switchVideoTab = function(tabName) {
    // 隐藏所有页面
    document.querySelectorAll('.v-page').forEach(el => el.classList.remove('active'));
    // 取消所有底栏高亮
    document.querySelectorAll('.v-tab').forEach(el => el.classList.remove('active'));
    
    // 激活目标页面和底栏
    document.getElementById(`v-page-${tabName}`).classList.add('active');
    const tabs = document.querySelectorAll('.v-tab');
    if(tabName === 'home') tabs[0].classList.add('active');
    if(tabName === 'discover') tabs[1].classList.add('active');
    if(tabName === 'inbox') tabs[2].classList.add('active');
    if(tabName === 'profile') tabs[3].classList.add('active');
};
// ==========================================
// 短视频 APP：AI 数据生成与渲染逻辑 (无网图、带评论、强关联)
// ==========================================

window.wcGenerateVideoAppData = async function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return alert("请先进入一个角色的手机");

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("正在破解 Ta 的短视频算法...");

    try {
        const chatConfig = char.chatConfig || {};
        const userName = chatConfig.userName || wcState.user.name;
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";
        
        // 提取最近 30 条聊天记录
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-30).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【世界观背景参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        let prompt = `你现在是一个短视频APP的后台数据引擎。我（User）正在偷偷查看【${char.name}】的手机。\n`;
        prompt += `【${char.name} 的人设】：${char.prompt}\n${wbInfo}\n`;
        prompt += `【我(User) 的设定】：${userPersona}\n`;
        prompt += `【最近我们的聊天记录】：\n${recentMsgs}\n\n`;
        
        prompt += `请根据 ${char.name} 的人设和我们最近的聊天记录，生成 Ta 短视频 APP 里的数据。\n`;
        prompt += `【核心要求（极具活人感与偷窥感）】：\n`;
        prompt += `1. 首页推荐 (homeFeed)：生成 3 到 5 个视频。内容必须和最近聊天的话题相关，或者是 Ta 潜意识里关注的事物。每个视频必须包含随机的点赞量(likes)、总评论量(commentCount)、收藏量(saves)和分享量(shares)。并且必须生成 5 条具体的网友评论内容 (comments)。\n`;
        prompt += `2. 个人主页 (profile)：生成 Ta 自己发布的 4 个视频(posts) ，并且同时生成 3 到 4  个 Ta 点赞过的视频(likedPosts)，以及。这些视频的文案和画面都必须和 User 有关表达对 User 的真实情绪，也可以是记录 User 相关的事情！每个视频必须包含随机的点赞量(likes)、总评论量(commentCount)、收藏量(saves)和分享量(shares)。并且必须生成 5 条具体的网友评论内容 (comments)。\n`;
        prompt += `2. 个人主页 (profile)：生成2 个 Ta 设置为仅自己可见的私密视频(privatePosts)。这些视频的文案和画面都必须和最近的聊天记录有关，也可以是记录 User 相关的事情！\n`;        
        prompt += `3. 消息页 (inbox)：生成 2 到 4 条私信。**【重点】：私信内容必须是路人或熟人对 Ta 在个人主页 (profile) 发布的视频的反应或搭讪！**\n`;
        prompt += `4. 发现页 (discover)：生成 4 个热搜标题。符合世界观或 Ta 的兴趣。\n`;
        prompt += `5. 草稿箱 (drafts)：生成 2 个 Ta 拍了但还没发布的草稿视频，内容可以是Ta 的使用抖音特效的自拍照或者是Ta 的日常生活照片。\n`;
        prompt += `6. 所有视频不要真实图片链接，请用 imageDesc (画面描述) 代替。\n`;
        prompt += `返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "homeFeed": [
    {
      "author": "@视频博主名", "imageDesc": "[视频画面] 一只正在打呼噜的橘猫", "desc": "视频文案描述", "likes": "12.5k", "commentCount": "2.3k", "saves": "1.1k", "shares": "500",
      "comments": [
        {"name": "网友A", "text": "太可爱了吧！"}
      ]
    }
  ],
  "profile": {
    "followers": "10.5K", "following": "128", "likes": "1.2M",
    "posts": [
      {
        "imageDesc": "[视频画面] 昏暗路灯下的两个影子", "desc": "暗戳戳关于User的文案", "views": "12K", "likes": "5.2K", "commentCount": "800", "saves": "1.1K", "shares": "500",
        "comments": [
          {"name": "网友A", "text": "好浪漫！"}
        ]
      }
    ],
    "likedPosts": [
      {
        "author": "@某网友", "imageDesc": "[视频画面] 搞笑猫咪", "desc": "哈哈哈哈", "views": "12K", "likes": "5.2K", "commentCount": "800", "saves": "1.1K", "shares": "500",
        "comments": [{"name": "网友A", "text": "笑死我了"}]
      }
    ],
    "privatePosts": [
      {
        "imageDesc": "[视频画面] 偷拍User的背影", "desc": "不敢发出去...", "views": "0", "likes": "0", "commentCount": "0", "saves": "0", "shares": "0",
        "comments": []
      }
    ]
  },
  "inbox": [
    {"name": "路人甲", "msg": "你最新发的那个视频里的人是谁呀？", "time": "2h"}
  ],
  "discover": [
    {"title": "热搜标题1", "views": "1.2M"}
  ],
  "drafts": [
    {
      "imageDesc": "[草稿画面] 准备送给User的礼物", "desc": "不知道Ta会不会喜欢", "views": "0", "likes": "0", "commentCount": "0", "saves": "0", "shares": "0",
      "comments": []
    }
  ]
}\n`;
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
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const videoData = JSON.parse(content);

        // 👇 核心修复：防止 AI 漏掉数组格式导致报错
        if (videoData.homeFeed && !Array.isArray(videoData.homeFeed)) {
            videoData.homeFeed = [videoData.homeFeed];
        }
        if (videoData.profile && videoData.profile.posts && !Array.isArray(videoData.profile.posts)) {
            videoData.profile.posts = [videoData.profile.posts];
        }

        // 👇 新增：为所有生成的人物注入内置的 NPC 头像
        if (videoData.homeFeed) {
            videoData.homeFeed.forEach(v => {
                v.avatar = getRandomNpcAvatar();
                if (v.comments) {
                    v.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                }
            });
        }
        if (videoData.inbox) {
            videoData.inbox.forEach(msg => {
                msg.avatar = getRandomNpcAvatar();
            });
        }
        if (videoData.profile) {
            if (videoData.profile.posts) {
                videoData.profile.posts.forEach(p => {
                    if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                });
            }
            if (videoData.profile.likedPosts) {
                videoData.profile.likedPosts.forEach(p => {
                    p.avatar = getRandomNpcAvatar();
                    if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                });
            }
            if (videoData.profile.privatePosts) {
                videoData.profile.privatePosts.forEach(p => {
                    if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
                });
            }
        }
        if (videoData.drafts) {
            videoData.drafts.forEach(p => {
                if (p.comments) p.comments.forEach(c => c.avatar = getRandomNpcAvatar());
            });
        }

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.videoApp = videoData;
        wcSaveData();

        wcRenderVideoApp();
        wcShowSuccess("算法破解成功");

    } catch (e) {
        console.error(e);
        wcShowError("生成失败");
    }
};

// 渲染整个短视频 APP
window.wcRenderVideoApp = function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    
    // 1. 获取所有需要渲染的容器
    const feedContainer = document.getElementById('v-home-feed');
    const discoverGrid = document.querySelector('#v-page-discover .v-grid');
    const inboxList = document.querySelector('#v-page-inbox .v-inbox-list');
    const profileGrid = document.querySelector('#v-page-profile .v-grid');
    
    // 2. 核心修复：每次渲染前，先无条件清空所有旧的 DOM 数据，防止上一个角色的数据残留
    if (feedContainer) feedContainer.innerHTML = '';
    if (discoverGrid) discoverGrid.innerHTML = '';
    if (inboxList) inboxList.innerHTML = '';
    if (profileGrid) profileGrid.innerHTML = '';

    if (!char || !char.phoneData || !char.phoneData.videoApp) {
        if (feedContainer) {
            feedContainer.innerHTML = '<div style="text-align:center; color:#888; font-size:14px; margin-top:50%;">点击右上角搜索图标<br>生成 Ta 的短视频数据</div>';
        }
        return;
    }

    const data = char.phoneData.videoApp;

    // 1. 渲染 Home (多视频滑动)
    if (data.homeFeed && data.homeFeed.length > 0 && feedContainer) {
        data.homeFeed.forEach((video, idx) => {
            feedContainer.innerHTML += `
                <div class="video-card">
                    <div class="video-image-desc">${video.imageDesc || '无画面描述'}</div>
                    <div class="video-actions">
                        <div class="action-item"><div class="action-icon"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div><span class="action-text">${video.likes || '10K'}</span></div>
                        <div class="action-item" onclick="vOpenComments('home', ${idx})"><div class="action-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></div><span class="action-text">${video.commentCount || (video.comments ? video.comments.length : 0)}</span></div>
                        <div class="action-item"><div class="action-icon"><svg viewBox="0 0 24 24" style="fill:none; stroke:#FFF; stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></div><span class="action-text">${video.saves || 'Save'}</span></div>
                        <div class="action-item" onclick="vTriggerShare('home', ${idx})"><div class="action-icon"><svg viewBox="0 0 24 24" style="fill:none; stroke:#FFF; stroke-width:2;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg></div><span class="action-text">${video.shares || 'Share'}</span></div>
                    </div>
                    <div class="video-info">
                        <div class="video-author">
                            <img src="${video.avatar || getRandomNpcAvatar()}" class="video-avatar">
                            <span class="video-name">${video.author}</span>
                        </div>
                        <div class="video-desc">${video.desc}</div>
                    </div>
                </div>
            `;
        });
    }

    // 2. 渲染 Discover
    if (data.discover && data.discover.length > 0 && discoverGrid) {
        data.discover.forEach(item => {
            discoverGrid.innerHTML += `
                <div class="v-grid-item" style="cursor:pointer;">
                    <div class="v-grid-item-desc" style="color:#FFF; font-weight:bold; font-style:normal; font-size:13px;">${item.title}</div>
                    <div class="views">▶ ${item.views}</div>
                </div>
            `;
        });
    }

    // 3. 渲染 Inbox
    if (data.inbox && data.inbox.length > 0 && inboxList) {
        data.inbox.forEach((item, idx) => {
            inboxList.innerHTML += `
                <div class="v-inbox-item" onclick="vOpenInboxDetail(${idx})">
                    <div class="v-inbox-avatar"><img src="${item.avatar || getRandomNpcAvatar()}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>
                    <div class="v-inbox-info">
                        <div class="v-inbox-name">${item.name}</div>
                        <div class="v-inbox-msg">${item.msg} · ${item.time}</div>
                    </div>
                </div>
            `;
        });
    }

    // 4. 渲染 Profile
    if (data.profile) {
        document.querySelector('.v-profile-username').innerHTML = `@${char.name} <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#FFF;fill:none;"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        document.querySelector('.v-profile-avatar').src = char.avatar;
        
        const stats = document.querySelectorAll('.v-stat-num');
        if (stats.length >= 3) {
            stats[0].innerText = data.profile.following;
            stats[1].innerText = data.profile.followers;
            stats[2].innerText = data.profile.likes;
        }

        const pTabs = document.querySelector('.v-profile-tabs');
        if (pTabs) {
            pTabs.innerHTML = `
                <svg class="v-profile-tab active" onclick="vSwitchProfileTab('posts')" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                <svg class="v-profile-tab" onclick="vSwitchProfileTab('private')" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <svg class="v-profile-tab" onclick="vSwitchProfileTab('likes')" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            `;
        }

        vRenderProfileGrid('posts');
    }
};

window.vSwitchProfileTab = function(tab) {
    document.querySelectorAll('.v-profile-tab').forEach(el => el.classList.remove('active'));
    const activeTab = document.querySelector(`.v-profile-tab[onclick="vSwitchProfileTab('${tab}')"]`);
    if (activeTab) activeTab.classList.add('active');
    vRenderProfileGrid(tab);
};

window.vRenderProfileGrid = function(tab) {
    const pGrid = document.querySelector('#v-page-profile .v-grid');
    if (!pGrid) return;
    
    // 核心修复：每次渲染前先清空，防止旧数据残留
    pGrid.innerHTML = '';

    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp || !char.phoneData.videoApp.profile) {
        pGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: #888; padding: 40px 0; font-size: 13px;">这里空空如也</div>`;
        return;
    }
    
    const profileData = char.phoneData.videoApp.profile;
    let list = [];
    if (tab === 'posts') list = profileData.posts || [];
    else if (tab === 'private') list = profileData.privatePosts || [];
    else if (tab === 'likes') list = profileData.likedPosts || [];

    if (list.length === 0) {
        pGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: #888; padding: 40px 0; font-size: 13px;">这里空空如也</div>`;
        return;
    }

    list.forEach((post, idx) => {
        let descText = post.imageDesc || '无画面描述';
        if (descText.length > 25) descText = descText.substring(0, 25) + '...';
        
        pGrid.innerHTML += `
            <div class="v-grid-item" style="cursor:pointer;" onclick="vOpenVideoDetail('${tab}', ${idx})">
                <div class="v-grid-item-desc">${descText}</div>
                <div class="views">▶ ${post.views || '10K'}</div>
            </div>
        `;
    });
};

window.vOpenCameraPage = function() {
    vRenderCameraPage();
    switchVideoTab('camera');
};

window.vRenderCameraPage = function() {
    let page = document.getElementById('v-page-camera');
    if (!page) {
        page = document.createElement('div');
        page.id = 'v-page-camera';
        page.className = 'v-page';
        document.querySelector('.v-pages').appendChild(page);
    }
    
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const draftsCount = (char && char.phoneData && char.phoneData.videoApp && char.phoneData.videoApp.drafts) ? char.phoneData.videoApp.drafts.length : 0;

    page.innerHTML = `
        <div style="flex: 1; background: #000; display: flex; flex-direction: column; position: relative; overflow: hidden;">
            
            <!-- 🌟 新增：模拟摄像头实时画面 (带有景深模糊的网图) 🌟 -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('https://images.unsplash.com/photo-1516528387618-afa90b13e000?q=80&w=800&auto=format&fit=crop') center/cover; filter: blur(3px) brightness(0.75); z-index: 0; transform: scale(1.05);"></div>
            
            <!-- 🌟 新增：相机九宫格辅助线 🌟 -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; display: flex; flex-direction: column;">
                <div style="flex: 1; border-bottom: 1px solid rgba(255,255,255,0.15);"></div>
                <div style="flex: 1; border-bottom: 1px solid rgba(255,255,255,0.15);"></div>
                <div style="flex: 1;"></div>
            </div>
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; display: flex;">
                <div style="flex: 1; border-right: 1px solid rgba(255,255,255,0.15);"></div>
                <div style="flex: 1; border-right: 1px solid rgba(255,255,255,0.15);"></div>
                <div style="flex: 1;"></div>
            </div>

            <!-- 顶部控制栏 (加上 position: relative 和 z-index 保证在画面上方) -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 50px 20px 20px; z-index: 10; position: relative;">
                <div style="color: #FFF; font-size: 24px; cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; text-shadow: 0 2px 4px rgba(0,0,0,0.5);" onclick="switchVideoTab('home')">✕</div>
                
                <div style="background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); padding: 6px 16px; border-radius: 20px; display: flex; align-items: center; gap: 6px; color: #FFF; font-size: 14px; cursor: pointer;">
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    选择音乐
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
                    <div style="color: #FFF; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <svg viewBox="0 0 24 24" style="width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 2.13-5.85L2 9"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 1 0-2.13 5.85L22 15"></path></svg>
                        <span style="font-size: 10px;">翻转</span>
                    </div>
                    <div style="color: #FFF; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <svg viewBox="0 0 24 24" style="width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 2;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        <span style="font-size: 10px;">快慢</span>
                    </div>
                    <div style="color: #FFF; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <svg viewBox="0 0 24 24" style="width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span style="font-size: 10px;">倒计时</span>
                    </div>
                </div>
            </div>

            <!-- 取景框对焦UI -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 200px; height: 200px; pointer-events: none;">
                <div style="position: absolute; top: 0; left: 0; width: 20px; height: 20px; border-top: 2px solid rgba(255,255,255,0.5); border-left: 2px solid rgba(255,255,255,0.5);"></div>
                <div style="position: absolute; top: 0; right: 0; width: 20px; height: 20px; border-top: 2px solid rgba(255,255,255,0.5); border-right: 2px solid rgba(255,255,255,0.5);"></div>
                <div style="position: absolute; bottom: 0; left: 0; width: 20px; height: 20px; border-bottom: 2px solid rgba(255,255,255,0.5); border-left: 2px solid rgba(255,255,255,0.5);"></div>
                <div style="position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; border-bottom: 2px solid rgba(255,255,255,0.5); border-right: 2px solid rgba(255,255,255,0.5);"></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; border: 1px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>
            </div>

            <!-- 底部操作区 -->
            <div style="margin-top: auto; padding-bottom: 40px; display: flex; flex-direction: column; align-items: center; z-index: 10;">
                
                <!-- 拍摄模式切换 -->
                <div style="display: flex; gap: 20px; color: rgba(255,255,255,0.6); font-size: 14px; font-weight: bold; margin-bottom: 20px;">
                    <span>照片</span>
                    <span style="color: #FFF; position: relative;">视频<div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: #FFF; border-radius: 50%;"></div></span>
                    <span>文字</span>
                </div>

                <!-- 拍摄按钮栏 -->
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 40px; margin-bottom: 30px;">
                    <!-- 特效 -->
                    <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; gap: 6px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
                            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: none; stroke: #FFF; stroke-width: 2;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                        </div>
                        <span style="color: #FFF; font-size: 12px;">特效</span>
                    </div>

                    <!-- 拍摄大圆圈 -->
                    <div style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="vPublishNewWork()">
                        <div style="width: 60px; height: 60px; border-radius: 50%; background: #FF3B30;"></div>
                    </div>

                    <!-- 相册 -->
                    <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; gap: 6px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
                            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: none; stroke: #FFF; stroke-width: 2;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                        <span style="color: #FFF; font-size: 12px;">相册</span>
                    </div>
                </div>

                <!-- 草稿箱入口 -->
                <div style="display: flex; align-items: center; gap: 6px; color: #FFF; font-size: 14px; cursor: pointer; background: rgba(255,255,255,0.15); padding: 8px 16px; border-radius: 20px;" onclick="vOpenDrafts()">
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    草稿箱 ${draftsCount > 0 ? `(${draftsCount})` : ''}
                </div>
            </div>
        </div>
    `;
};

window.vOpenDrafts = function() {
    vRenderDraftsPage();
    switchVideoTab('drafts');
};

window.vRenderDraftsPage = function() {
    let page = document.getElementById('v-page-drafts');
    if (!page) {
        page = document.createElement('div');
        page.id = 'v-page-drafts';
        page.className = 'v-page';
        document.querySelector('.v-pages').appendChild(page);
    }

    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    const drafts = (char && char.phoneData && char.phoneData.videoApp && char.phoneData.videoApp.drafts) ? char.phoneData.videoApp.drafts : [];

    let gridHtml = '';
    if (drafts.length === 0) {
        gridHtml = '<div style="text-align: center; color: #888; padding: 40px 0; font-size: 13px; width: 100%;">草稿箱为空</div>';
    } else {
        drafts.forEach((draft, idx) => {
            let descText = draft.imageDesc || '无画面描述';
            if (descText.length > 25) descText = descText.substring(0, 25) + '...';
            gridHtml += `
                <div class="v-grid-item" style="cursor:pointer;" onclick="vOpenVideoDetail('drafts', ${idx})">
                    <div class="v-grid-item-desc">${descText}</div>
                    <div class="views" style="background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px;">草稿</div>
                </div>
            `;
        });
    }

    page.innerHTML = `
        <div style="padding: 50px 20px 15px; display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); background: #0A0A0B;">
            <div onclick="vOpenCameraPage()" style="cursor: pointer; margin-right: 15px;">
                <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; stroke: #FFF; fill: none; stroke-width: 2;"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #FFF;">草稿箱</div>
        </div>
        <div class="v-grid" style="padding-top: 15px;">
            ${gridHtml}
        </div>
    `;
};

// 打开评论区
window.vOpenComments = function(source, index) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp) return;
    
    let comments = [];
    let totalCountStr = "0";
    
    let video = null;
    if (source === 'home') video = char.phoneData.videoApp.homeFeed[index];
    else if (source === 'posts') video = char.phoneData.videoApp.profile.posts[index];
    else if (source === 'private') video = char.phoneData.videoApp.profile.privatePosts[index];
    else if (source === 'likes') video = char.phoneData.videoApp.profile.likedPosts[index];
    else if (source === 'drafts') video = char.phoneData.videoApp.drafts[index];

    if (video) {
        comments = video.comments || [];
        totalCountStr = video.commentCount || comments.length;
    }

    document.getElementById('v-comments-count').innerText = `${totalCountStr} 条评论`;
    const list = document.getElementById('v-comments-list');
    list.innerHTML = '';
    
    if (comments.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#888; margin-top:20px; font-size:13px;">暂无评论</div>';
    } else {
        comments.forEach(c => {
            list.innerHTML += `
                <div class="v-comment-item">
                    <img src="${c.avatar || getRandomNpcAvatar()}" class="v-comment-avatar">
                    <div class="v-comment-info">
                        <div class="v-comment-name">${c.name}</div>
                        <div class="v-comment-text">${c.text}</div>
                    </div>
                </div>
            `;
        });
    }

    document.getElementById('v-comments-panel').classList.add('active');
};

window.vCloseComments = function() {
    document.getElementById('v-comments-panel').classList.remove('active');
};

// 打开个人主页的视频详情
window.vOpenVideoDetail = function(source, postIndex) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp) return;
    
    let post = null;
    let authorName = char.name;
    let authorAvatar = char.avatar;

    if (source === 'posts') {
        post = char.phoneData.videoApp.profile.posts[postIndex];
    } else if (source === 'private') {
        post = char.phoneData.videoApp.profile.privatePosts[postIndex];
    } else if (source === 'likes') {
        post = char.phoneData.videoApp.profile.likedPosts[postIndex];
        authorName = post.author || "神秘网友";
        authorAvatar = post.avatar || getRandomNpcAvatar();
    } else if (source === 'drafts') {
        post = char.phoneData.videoApp.drafts[postIndex];
    }

    if (!post) return;

    const feedContainer = document.getElementById('v-detail-feed');
    
    let publishBtnHtml = '';
    if (source === 'drafts') {
        publishBtnHtml = `
            <div style="position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%); z-index: 100;">
                <button onclick="vPublishDraft(${postIndex})" style="background: #FF3B30; color: #FFF; border: none; padding: 12px 40px; border-radius: 24px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(255,59,48,0.4);">发布草稿</button>
            </div>
        `;
    }

    feedContainer.innerHTML = `
        <div class="video-card">
            <div class="video-image-desc">${post.imageDesc || '无画面描述'}</div>
            <div class="video-actions">
                <div class="action-item"><div class="action-icon"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div><span class="action-text">${post.likes || '10K'}</span></div>
                <div class="action-item" onclick="vOpenComments('${source}', ${postIndex})"><div class="action-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></div><span class="action-text">${post.commentCount || (post.comments ? post.comments.length : 0)}</span></div>
                <div class="action-item"><div class="action-icon"><svg viewBox="0 0 24 24" style="fill:none; stroke:#FFF; stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></div><span class="action-text">${post.saves || 'Save'}</span></div>
                <div class="action-item" onclick="vTriggerShare('${source}', ${postIndex})"><div class="action-icon"><svg viewBox="0 0 24 24" style="fill:none; stroke:#FFF; stroke-width:2;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg></div><span class="action-text">${post.shares || 'Share'}</span></div>
            </div>
            <div class="video-info">
                <div class="video-author">
                    <img src="${authorAvatar}" class="video-avatar">
                    <span class="video-name">@${authorName}</span>
                </div>
                <div class="video-desc">${post.desc || ''}</div>
            </div>
            ${publishBtnHtml}
        </div>
    `;

    switchVideoTab('detail');
};

window.vPublishDraft = function(idx) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp) return;
    
    const draft = char.phoneData.videoApp.drafts[idx];
    if (!draft) return;
    
    if (confirm("确定要发布这条草稿吗？")) {
        char.phoneData.videoApp.drafts.splice(idx, 1);
        
        if (!char.phoneData.videoApp.profile.posts) char.phoneData.videoApp.profile.posts = [];
        
        const newPost = {
            ...draft,
            views: "0",
            likes: "0",
            commentCount: "0",
            saves: "0",
            shares: "0",
            comments: []
        };
        
        char.phoneData.videoApp.profile.posts.unshift(newPost);
        wcSaveData();
        
        const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚在你的短视频APP里，把你草稿箱里的一条视频发布出去了！视频画面描述：“${draft.imageDesc || ''}”，文案：“${draft.desc || ''}”。请在接下来的聊天中对此做出反应（比如惊讶、害羞、或者问User为什么要发）。]`;
        wcAddMessage(char.id, 'system', 'system', aiPrompt, { hidden: true });
        
        alert("发布成功！");
        switchVideoTab('profile');
    }
};

window.vPublishNewWork = function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp) return;

    // 清空输入框
    document.getElementById('v-publish-image-desc').value = '';
    document.getElementById('v-publish-desc').value = '';
    
    // 设置头像
    const userAvatar = (char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
    const dailyAvatarEl = document.getElementById('v-publish-daily-avatar');
    if (dailyAvatarEl) dailyAvatarEl.src = userAvatar;
    
    // 切换到发布页面
    switchVideoTab('publish');
};

window.vEditCoverDesc = function() {
    const input = document.getElementById('v-publish-image-desc');
    wcOpenGeneralInput("编辑封面描述", (text) => {
        if (text) {
            input.value = text;
        }
    });
};

window.vCancelPublish = function() {
    switchVideoTab('camera'); // 返回拍摄页
};

window.vSubmitNewWork = function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp) return;

    const imageDesc = document.getElementById('v-publish-image-desc').value.trim();
    const desc = document.getElementById('v-publish-desc').value.trim();

    if (!imageDesc && !desc) {
        return alert("请至少填写画面描述或文案哦~");
    }

    if (!char.phoneData.videoApp.profile.posts) char.phoneData.videoApp.profile.posts = [];
    
    const newPost = {
        imageDesc: imageDesc ? `[视频画面] ${imageDesc}` : '[视频画面] 无',
        desc: desc,
        views: "0",
        likes: "0",
        commentCount: "0",
        saves: "0",
        shares: "0",
        comments: []
    };
    
    char.phoneData.videoApp.profile.posts.unshift(newPost);
    wcSaveData();
    
    const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚拿你的手机，在你的短视频APP里发布了一条新作品！视频画面描述：“${imageDesc}”，文案是：“${desc}”。请在接下来的聊天中对此做出反应。]`;
    wcAddMessage(char.id, 'system', 'system', aiPrompt, { hidden: true });
    
    alert("发布成功！");
    switchVideoTab('profile');
};


// 覆盖原有的 switchVideoTab，增加 detail 页面的处理
window.switchVideoTab = function(tabName) {
    document.querySelectorAll('.v-page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.v-tab').forEach(el => el.classList.remove('active'));
    
    let targetPage = document.getElementById(`v-page-${tabName}`);
    if (targetPage) targetPage.classList.add('active');
    
    const tabbar = document.querySelector('.video-tabbar');
    
    if (tabName === 'home' || tabName === 'discover' || tabName === 'inbox' || tabName === 'profile') {
        if (tabbar) tabbar.style.display = 'flex';
        const tabs = document.querySelectorAll('.v-tab');
        if(tabName === 'home' && tabs[0]) tabs[0].classList.add('active');
        if(tabName === 'discover' && tabs[1]) tabs[1].classList.add('active');
        if(tabName === 'inbox' && tabs[2]) tabs[2].classList.add('active');
        if(tabName === 'profile' && tabs[3]) tabs[3].classList.add('active');
    } else {
        if (tabbar) tabbar.style.display = 'none';
    }
    
    vCloseComments();
};

// 新增 vOpenInboxDetail 函数
window.vOpenInboxDetail = function(idx) {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char || !char.phoneData || !char.phoneData.videoApp || !char.phoneData.videoApp.inbox) return;
    
    const msg = char.phoneData.videoApp.inbox[idx];
    if (!msg) return;

    document.getElementById('v-inbox-detail-name').innerText = msg.name;
    
    const chatContainer = document.getElementById('v-inbox-detail-chat');
    chatContainer.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: flex-start;">
            <img src="${msg.avatar}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
            <div style="background: #333; color: #FFF; padding: 10px 14px; border-radius: 16px; border-top-left-radius: 4px; font-size: 14px; max-width: 75%;">
                ${msg.msg}
            </div>
        </div>
    `;

    switchVideoTab('inbox-detail');
};
// ==========================================
// 文件管理 APP (Files) 交互逻辑
// ==========================================
window.fmSwitchTab = function(tabId, element) {
    // 1. 移除所有 nav-item 的 active 状态和文字
    document.querySelectorAll('.fm-nav-item').forEach(el => {
        el.classList.remove('active');
        const textSpan = el.querySelector('.fm-nav-text');
        if(textSpan) textSpan.remove();
    });

    // 2. 给当前点击的 nav-item 添加 active 状态和文字
    element.classList.add('active');
    const textMap = { 'home': 'Home', 'gallery': 'Photos', 'audio': 'Audios', 'docs': 'Files' };
    const textSpan = document.createElement('span');
    textSpan.className = 'fm-nav-text';
    textSpan.innerText = textMap[tabId];
    element.appendChild(textSpan);

    // 3. 切换页面显示
    document.querySelectorAll('.fm-page').forEach(page => page.classList.remove('active'));
    document.getElementById('fm-page-' + tabId).classList.add('active');
};

window.fmRotateCards = function() {
    const cards = document.querySelectorAll('.fm-file-card');
    cards.forEach(card => {
        if (card.classList.contains('fm-card-pos-1')) {
            card.classList.remove('fm-card-pos-1');
            card.classList.add('fm-card-pos-3');
        } else if (card.classList.contains('fm-card-pos-2')) {
            card.classList.remove('fm-card-pos-2');
            card.classList.add('fm-card-pos-1');
        } else if (card.classList.contains('fm-card-pos-3')) {
            card.classList.remove('fm-card-pos-3');
            card.classList.add('fm-card-pos-2');
        }
    });
};

window.fmToggleAudio = function(element) {
    const isPlaying = element.classList.contains('playing');
    
    // 先暂停所有
    document.querySelectorAll('.fm-audio-item').forEach(item => {
        item.classList.remove('playing');
        item.querySelector('.fm-play-btn').innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        // 重置波形
        item.querySelectorAll('.fm-wave-bar').forEach(bar => bar.style.height = '8px');
    });

    // 如果原来不是播放状态，则播放当前点击的
    if (!isPlaying) {
        element.classList.add('playing');
        element.querySelector('.fm-play-btn').innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        // 恢复波形动画高度
        const heights = ['12px', '24px', '8px', '18px', '14px'];
        element.querySelectorAll('.fm-wave-bar').forEach((bar, idx) => {
            bar.style.height = heights[idx];
        });
    }
};
// ==========================================
// 文件管理 APP - 弹窗控制逻辑
// ==========================================

window.fmOpenPhotoDetail = function(desc) {
    document.getElementById('fm-photo-detail-text').innerText = desc;
    const modal = document.getElementById('fm-photo-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.fmClosePhotoDetail = function() {
    const modal = document.getElementById('fm-photo-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};

window.fmOpenAudioDetail = function(title, date, duration, content) {
    document.getElementById('fm-audio-detail-title').innerText = title;
    document.getElementById('fm-audio-detail-meta').innerText = `${date} • ${duration}`;
    document.getElementById('fm-audio-detail-content').innerText = content;
    
    const modal = document.getElementById('fm-audio-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.fmCloseAudioDetail = function() {
    const modal = document.getElementById('fm-audio-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 400); // 抽屉动画稍微长一点
};
window.fmOpenDocDetail = function(title, date, content) {
    document.getElementById('fm-doc-detail-title').innerText = title;
    document.getElementById('fm-doc-detail-meta').innerText = `最后修改: ${date}`;
    // 使用 innerHTML 并将换行符替换为 <br>，以支持 AI 生成的排版
    document.getElementById('fm-doc-detail-content').innerHTML = content.replace(/\n/g, '<br>');
    
    const modal = document.getElementById('fm-doc-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.fmCloseDocDetail = function() {
    const modal = document.getElementById('fm-doc-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};

// ==========================================
// 文件管理 APP (Files) AI 生成与渲染逻辑
// ==========================================

// 1. 渲染页面内容
window.wcRenderPhoneFilesContent = function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return;

    const filesData = (char.phoneData && char.phoneData.filesApp) ? char.phoneData.filesApp : null;

    const stackContainer = document.getElementById('fm-cardStack');
    const galleryGrid = document.getElementById('fm-gallery-grid');
    const audioList = document.getElementById('fm-audio-list');
    const docList = document.getElementById('fm-doc-list');

    if (!filesData) {
        stackContainer.innerHTML = '<div style="text-align: center; color: #888; margin-top: 50px; font-size: 14px;">点击右上角铃铛<br>生成 Ta 的私密文件...</div>';
        galleryGrid.innerHTML = '';
        audioList.innerHTML = '';
        docList.innerHTML = '';
        document.getElementById('fm-photo-count').innerText = '0 Secret Photos';
        document.getElementById('fm-audio-count').innerText = '0 Recorded Audios';
        document.getElementById('fm-doc-count').innerText = '0 Saved Files';
        return;
    }

    // 渲染首页层叠卡片 (Home)
    if (filesData.homeCards && filesData.homeCards.length > 0) {
        stackContainer.innerHTML = '';
        // 确保最多只渲染 3 张，并分配不同的背景和层级
        const maxCards = Math.min(filesData.homeCards.length, 3);
        for (let i = 0; i < maxCards; i++) {
            const card = filesData.homeCards[i];
            const posClass = `fm-card-pos-${3 - i}`; // 3, 2, 1 (1在最上面)
            const bgClass = `fm-card-bg-${3 - i}`;   // 不同的渐变背景
            
            let iconSvg = '';
            if (card.type === 'image') iconSvg = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>';
            else if (card.type === 'audio') iconSvg = '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>';
            else iconSvg = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';

            stackContainer.innerHTML += `
                <div class="fm-file-card ${bgClass} ${posClass}" onclick="fmRotateCards()">
                    <div class="fm-card-top-icon"><svg viewBox="0 0 24 24">${iconSvg}</svg></div>
                    <div class="fm-card-visual-desc">"${card.desc}"</div>
                    <div class="fm-card-info-bar">
                        <div class="fm-info-left">
                            <div class="fm-info-title">${card.title}</div>
                            <div class="fm-info-subtitle"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${card.meta}</div>
                        </div>
                        <div class="fm-info-divider"></div>
                        <div class="fm-info-right"><div class="fm-info-size">${card.size || '1.2'}</div><div class="fm-info-type">/ MB</div></div>
                    </div>
                </div>
            `;
        }
    }

    // 渲染相册 (Photos)
    if (filesData.photos && filesData.photos.length > 0) {
        document.getElementById('fm-photo-count').innerText = `${filesData.photos.length} Secret Photos`;
        galleryGrid.innerHTML = '';
        const gradients = [
            'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
            'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
            'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            'linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)',
            'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
            'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        ];
        filesData.photos.forEach((photo, idx) => {
            const bg = gradients[idx % gradients.length];
            const color = (idx % 6 === 1) ? '#FFF' : 'rgba(0,0,0,0.7)'; 
            const stroke = (idx % 6 === 1) ? '#FFF' : '#8E8E93';
            // 👇 核心修改：转义引号并绑定点击事件
            const safeDesc = photo.desc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            galleryGrid.innerHTML += `
                <div class="fm-gallery-item" style="background: ${bg}; color: ${color};" onclick="fmOpenPhotoDetail('${safeDesc}')">
                    <svg class="fm-gallery-icon" style="stroke: ${stroke};" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <div class="fm-gallery-desc" style="color: ${color};">"${photo.desc}"</div>
                </div>
            `;
        });
    }

    // 渲染录音 (Audios)
    if (filesData.audios && filesData.audios.length > 0) {
        document.getElementById('fm-audio-count').innerText = `${filesData.audios.length} Recorded Audios`;
        audioList.innerHTML = '';
        filesData.audios.forEach(audio => {
            // 👇 核心修改：转义引号和换行符，防止破坏 onclick 语法
            const safeTitle = audio.title.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");
            const safeContent = (audio.content || '一段沉默的录音...').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n").replace(/\r/g, "");
            
            audioList.innerHTML += `
                <div class="fm-audio-item" onclick="fmOpenAudioDetail('${safeTitle}', '${audio.date}', '${audio.duration}', '${safeContent}')">
                    <div class="fm-play-btn" onclick="event.stopPropagation(); fmToggleAudio(this.parentElement)"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                    <div class="fm-audio-info">
                        <div class="fm-audio-title">${audio.title}</div>
                        <div class="fm-audio-meta">${audio.date} • ${audio.duration}</div>
                    </div>
                    <div class="fm-audio-wave">
                        <div class="fm-wave-bar" style="height: 8px;"></div><div class="fm-wave-bar" style="height: 8px;"></div><div class="fm-wave-bar" style="height: 8px;"></div><div class="fm-wave-bar" style="height: 8px;"></div><div class="fm-wave-bar" style="height: 8px;"></div>
                    </div>
                </div>
            `;
        });
    }

    // 渲染文档 (Docs)
    if (filesData.docs && filesData.docs.length > 0) {
        document.getElementById('fm-doc-count').innerText = `${filesData.docs.length} Saved Files`;
        docList.innerHTML = '';
        filesData.docs.forEach(doc => {
            let iconClass = 'fm-icon-doc';
            let typeText = 'DOC';
            if (doc.type === 'pdf') { iconClass = 'fm-icon-pdf'; typeText = 'PDF'; }
            else if (doc.type === 'xls') { iconClass = 'fm-icon-xls'; typeText = 'XLSX'; }

            // 👇 核心修改：转义引号和换行符，防止破坏 onclick 语法
            const safeTitle = doc.title.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");
            const safeContent = (doc.content || '文档内容为空...').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n").replace(/\r/g, "");

            docList.innerHTML += `
                <div class="fm-doc-item" onclick="fmOpenDocDetail('${safeTitle}', '${doc.date}', '${safeContent}')">
                    <div class="fm-doc-icon ${iconClass}">${typeText}</div>
                    <div class="fm-doc-info">
                        <div class="fm-doc-title">${doc.title}</div>
                        <div class="fm-doc-meta"><span>${doc.size}</span><span>${doc.date}</span></div>
                    </div>
                    <div class="fm-doc-more"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg></div>
                </div>
            `;
        });
    }
};

// 2. 调取 API 生成数据
window.wcGeneratePhoneFiles = async function() {
    const char = wcState.characters.find(c => c.id === wcState.editingCharId);
    if (!char) return alert("请先进入一个角色的手机");

    const apiConfig = await getActiveApiConfig('phone');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    wcShowLoading("正在破解 Ta 的私密文件库...");

    try {
        const chatConfig = char.chatConfig || {};
        const userName = chatConfig.userName || wcState.user.name;
        const userPersona = chatConfig.userPersona || wcState.user.persona || "无";

        
        // 提取最近 30 条聊天记录
        const msgs = wcState.chats[char.id] || [];
        const recentMsgs = msgs.slice(-30).map(m => {
            if (m.isError || m.type === 'system') return null;
            let content = m.content;
            if (m.type !== 'text') content = `[${m.type}]`;
            return `${m.sender==='me'?'User':char.name}: ${content}`;
        }).filter(Boolean).join('\n');

        let wbInfo = "";
        if (worldbookEntries.length > 0 && chatConfig.worldbookEntries && chatConfig.worldbookEntries.length > 0) {
            const linkedEntries = worldbookEntries.filter(e => chatConfig.worldbookEntries.includes(e.id.toString()));
            if (linkedEntries.length > 0) {
                wbInfo = "【世界观背景参考】:\n" + linkedEntries.map(e => `${e.title}: ${e.desc}`).join('\n');
            }
        }

        let prompt = `你现在是一个手机文件管理系统的后台数据引擎。我（${userName}）正在偷偷查看【${char.name}】的手机文件。\n`;
        prompt += `【${char.name} 的人设】：${char.prompt}\n${wbInfo}\n`;
        prompt += `【我(${userName}) 的设定】：${userPersona}\n`;
        if (chatConfig.bilingualEnabled) {
            const targetLang = chatConfig.bilingualTarget || '中文';
            prompt += `\n【语言强制要求】：虽然聊天记录中包含外语，但你生成的手机内部所有数据（如文档内容、录音转写等）必须全部使用 ${targetLang}！绝对不要使用双语格式！\n`;
        }
        prompt += `【最近我们的聊天记录】：\n${recentMsgs}\n\n`;
        
        prompt += `请根据 ${char.name} 的人设和我们最近的聊天记录，生成 Ta 手机里的私密文件数据。\n`;
        prompt += `【核心要求（极具活人感与偷窥感）】：\n`;
        prompt += `1. 相册 (photos)：生成 4-8 张照片的画面描述。必须体现偷窥感（如：偷存的${userName}照片、奇怪的截图、日常风景、聊天中提到的事物）。\n`;
        prompt += `2. 录音 (audios)：生成 3-6 条录音记录。包含标题(title)、时长(duration, 如"04:20")、日期(date)，以及【录音的具体文字转写内容(content)】。内容可以是深夜emo的碎碎念、工作会议录音、想发给${userName}但没敢发的语音草稿。\n`;
        prompt += `3. 文档 (docs)：生成 3-6 个私密文件。包含标题(title, 带后缀)、大小(size, 如"2.4 MB")、日期(date)、类型(type: pdf/doc/xls)，以及【文档的具体正文内容(content，50-150字)】。内容可以是旅游攻略、记账本、工作文档、日记草稿。\n`;
        prompt += `4. 首页推荐 (homeCards)：从上面生成的资源中，挑选最具有代表性、最私密的 3 个（最好是1图1音1文），生成详细的画面描述或内容摘要(desc)。\n`;
        prompt += `返回纯 JSON 对象，格式如下：\n`;
        prompt += `{
  "homeCards": [
    {"type": "image", "title": "IMG_8924.jpg", "desc": "一张在海边看日落的照片，光线很温柔，画面边缘似乎有${userName}的侧影。", "meta": "Lubin, Poland", "size": "4.2"},
    {"type": "audio", "title": "深夜碎碎念.m4a", "desc": "一段深夜录制的音频，背景里有微弱的雨声和 Ta 轻轻的叹息。", "meta": "昨天 02:15", "size": "04:20"},
    {"type": "doc", "title": "Travel_Plan.pdf", "desc": "一份写着未来旅行计划的文档，里面提到了${userName}最想去的海岛。", "meta": "10月20日 14:30", "size": "2.4"}
  ],
  "photos": [
    {"desc": "${userName} 昨天发来的自拍，偷偷存下来了"}
  ],
  "audios": [
    {"title": "关于 ${userName} 的想法", "duration": "02:15", "date": "10月20日", "content": "其实我今天看到Ta的时候，心跳得好快...但我不敢说。"}
  ],
  "docs": [
    {"title": "周末旅行攻略.pdf", "size": "2.4 MB", "date": "昨天 09:41", "type": "pdf", "content": "第一天：早上9点出发去海边，中午吃海鲜大排档。第二天：去爬山看日出..."}
  ]
}\n`;
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
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const filesData = JSON.parse(content);

        if (!char.phoneData) char.phoneData = {};
        char.phoneData.filesApp = filesData;
        wcSaveData();

        wcRenderPhoneFilesContent();
        wcShowSuccess("文件破解成功");

    } catch (e) {
        console.error(e);
        wcShowError("生成失败");
    }
};
// ==========================================
// 新增：查找聊天记录功能
// ==========================================
window.wcOpenChatSearch = function() {
    const view = document.getElementById('wc-view-chat-search');
    if (!view) return;
    document.getElementById('wc-chat-search-input').value = '';
    document.getElementById('wc-chat-search-results').innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:14px;">输入关键字搜索聊天记录</div>';
    view.style.display = 'flex';
};

window.wcCloseChatSearch = function() {
    const view = document.getElementById('wc-view-chat-search');
    if (view) view.style.display = 'none';
};

window.wcPerformChatSearch = function() {
    const keyword = document.getElementById('wc-chat-search-input').value.trim().toLowerCase();
    const container = document.getElementById('wc-chat-search-results');
    
    if (!keyword) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:14px;">请输入关键字</div>';
        return;
    }

    const charId = wcState.activeChatId;
    const msgs = wcState.chats[charId] || [];
    // 过滤出包含关键字的文本消息
    const results = msgs.filter(m => m.type === 'text' && m.content && m.content.toLowerCase().includes(keyword));

    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:14px;">未找到相关记录</div>';
        return;
    }

    const char = wcState.characters.find(c => c.id === charId);
    const myName = wcState.user.name;
    const themName = char ? char.name : 'Ta';

    // 倒序显示，最新的在前面
    [...results].reverse().forEach(msg => {
        const senderName = msg.sender === 'me' ? myName : (msg.name || themName);
        const timeStr = new Date(msg.time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // 高亮关键字
        const regex = new RegExp(`(${keyword})`, 'gi');
        const highlightedContent = msg.content.replace(regex, '<span style="color:#007AFF; font-weight:bold;">$1</span>');

        const div = document.createElement('div');
        div.style.cssText = 'padding: 15px 20px; border-bottom: 1px solid #E5E5EA; background: #FFF; cursor: pointer; transition: background 0.2s;';
        div.onclick = () => wcJumpToMessage(msg.id);
        div.onmousedown = () => div.style.background = '#F5F5F5';
        div.onmouseup = () => div.style.background = '#FFF';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 14px; font-weight: 600; color: #333;">${senderName}</span>
                <span style="font-size: 12px; color: #999;">${timeStr}</span>
            </div>
            <div style="font-size: 14px; color: #666; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${highlightedContent}
            </div>
        `;
        container.appendChild(div);
    });
};

window.wcJumpToMessage = function(msgId) {
    const charId = wcState.activeChatId;
    const msgs = wcState.chats[charId] || [];
    const msgIndex = msgs.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    // 计算该消息距离末尾的条数
    const fromEnd = msgs.length - msgIndex;
    // 如果当前显示的条数不够，增加显示条数，确保消息被渲染出来
    if (wcState.chatDisplayCount < fromEnd) {
        wcState.chatDisplayCount = fromEnd + 20; // 多加载20条作为缓冲
        wcRenderMessages(charId, true);
    }

    wcCloseChatSearch();
    wcCloseModal('wc-modal-chat-settings');

    // 延迟等待 DOM 渲染完成
    setTimeout(() => {
        const row = document.getElementById(`msg-row-${msgId}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 添加高亮闪烁效果
            const originalBg = row.style.backgroundColor;
            row.style.transition = 'background-color 0.5s ease';
            row.style.backgroundColor = 'rgba(0, 122, 255, 0.15)';
            setTimeout(() => {
                row.style.backgroundColor = originalBg;
            }, 2000);
        }
    }, 300);
};

// 绑定回车搜索
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('wc-chat-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') wcPerformChatSearch();
        });
    }
});
// ==========================================
// 悬浮视窗菜单显示/隐藏逻辑
// ==========================================
window.toggleRetroMenu = function(menuId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // 先关闭所有可能打开的悬浮窗
    document.querySelectorAll('.ins-window-card').forEach(el => {
        if (el.id !== menuId) {
            el.classList.remove('show');
        }
    });
    
    // 切换当前点击的悬浮窗
    const menu = document.getElementById(menuId);
    if (menu) {
        menu.classList.toggle('show');
        
        // 同步五角星的高亮状态
        const starBtn = event.currentTarget;
        if (menu.classList.contains('show')) {
            starBtn.classList.add('active');
        } else {
            starBtn.classList.remove('active');
            // 关闭时自动退出编辑模式
            const type = menuId.includes('icon') ? 'icon' : 'font';
            presetEditState[type] = false;
            const listEl = document.getElementById(type + 'PresetList');
            if (listEl) listEl.classList.remove('edit-mode');
        }
    }
};

// 全局点击事件：点击空白处隐藏悬浮窗
document.addEventListener('click', (e) => {
    document.querySelectorAll('.ins-window-card').forEach(menu => {
        if (menu.classList.contains('show')) {
            // 如果点击的不是菜单内部，也不是五角星按钮，就关闭菜单
            if (!e.target.closest('.ins-window-card') && !e.target.closest('.ts-star-btn')) {
                menu.classList.remove('show');
                
                // 移除五角星高亮
                document.querySelectorAll('.ts-star-btn').forEach(btn => btn.classList.remove('active'));
                
                // 关闭时自动退出编辑模式
                presetEditState.icon = false;
                presetEditState.font = false;
                document.querySelectorAll('.ins-window-body').forEach(body => body.classList.remove('edit-mode'));
            }
        }
    });
});

// ============================================================
/* ==========================================================================
   APP 4: INS FORUM LOGIC (Advanced iOS Style - Twitter/INS Clone)
   ========================================================================== */
const forumState = {
    // 👇 新增：多窗口管理数据
    windows: [
        { id: 'default', name: 'Expansion Notice', prompt: '' }
    ],
    activeWindowId: 'default',
    actionWindowId: null, 
    
    // 👇 新增：热搜与书城数据
    hotSearches: [],
    books: [], // 书城里的书
    currentBookId: null, // 当前查看的书
    actionPostId: null, // 当前操作的同人文帖子ID
    readerPages: [], // 阅读器分页数据
    currentReaderPage: 0,
    // 👆 新增结束

    profile: {
        name: 'User',
        handle: '@user_id',
        avatar: '',
        bg: '', // 👈 新增背景图字段
        bio: '记录生活的美好',
        boundMaskId: null
    },

    config: {
        worldbookIds: [],
        charIds: [],
        maskIds: [],
        fanficStyle: '',
        fanficCharA: '',
        fanficCharB: '',
        fanficTrope: '',
        commentMin: 3,
        commentMax: 8
    },
    posts: [], 
    privateChats: [], // 👈 修改这里：改为 privateChats，存储会话列表
    tempImage: null,
    tempAvatar: null,
    currentDetailPostId: null,
    pendingSharePostId: null,
    profileTab: 'posts',
    activePMChatId: null // 👈 新增：记录当前正在聊天的私信ID
};

async function forumLoadData() {
    const data = await idb.get('ins_forum_data');
    if (data) {
        if (data.windows) forumState.windows = data.windows;
        if (data.activeWindowId) forumState.activeWindowId = data.activeWindowId;
        if (data.profile) forumState.profile = { ...forumState.profile, ...data.profile };
        if (data.config) forumState.config = { ...forumState.config, ...data.config };
        if (data.posts) forumState.posts = data.posts;
        if (data.privateChats) forumState.privateChats = data.privateChats; 
        if (data.hotSearches) forumState.hotSearches = data.hotSearches; // 👈 新增
        if (data.books) forumState.books = data.books; // 👈 新增
    }
    // 兜底：如果没有窗口，初始化一个默认的
    if (!forumState.windows || forumState.windows.length === 0) {
        forumState.windows = [{ id: 'default', name: 'Expansion Notice', prompt: '' }];
        forumState.activeWindowId = 'default';
    }
    if (!forumState.profile.avatar) {
        forumState.profile.avatar = wcState.user.avatar;
        forumState.profile.name = wcState.user.name;
    }
}

async function forumSaveData() {
    await idb.set('ins_forum_data', {
        windows: forumState.windows,
        activeWindowId: forumState.activeWindowId,
        profile: forumState.profile,
        config: forumState.config,
        posts: forumState.posts,
        privateChats: forumState.privateChats,
        hotSearches: forumState.hotSearches, // 👈 新增
        books: forumState.books // 👈 新增
    });
}

// 生成虚拟的初始点赞数据，让帖子看起来有活人感
function forumGenerateFakeLikes() {
    const count = Math.floor(Math.random() * 80) + 15; // 随机 15 到 95 个赞
    const likes = [];
    for(let i = 0; i < count; i++) {
        likes.push(`fake_user_${Math.random().toString(36).substr(2, 5)}`);
    }
    return likes;
}

