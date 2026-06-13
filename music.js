async function musicInitState() {
    await musicLoadData();
    if (musicState.listenTogether && musicState.listenTogether.active && musicState.listenTogether.charId) {
        musicStartListenTogether(musicState.listenTogether.charId, true);
    }
}
// 修复：确保音频元数据加载完成后，立即更新总时长显示
audioPlayer.addEventListener('loadedmetadata', () => {
    const timeTotalEl = document.getElementById('music-time-total');
    const capTimeTotalEl = document.getElementById('capsule-time-total');
    const sfpTimeTotalEl = document.getElementById('wc-sfp-time-total');
    
    const totalStr = musicFormatTime(audioPlayer.duration);
    if (timeTotalEl) timeTotalEl.innerText = totalStr;
    if (capTimeTotalEl) capTimeTotalEl.innerText = totalStr;
    if (sfpTimeTotalEl) sfpTimeTotalEl.innerText = totalStr;
});

// 进度条与歌词同步
audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration || isDraggingMusicProgress) return; // 拖拽时暂停更新进度条
    
    // 1. 性能优化：先获取 DOM 元素，如果不存在则直接返回，避免后台播放时高频报错
    const progressFillArc = document.getElementById('music-progress-fill-arc');
    const progressDot = document.getElementById('music-progress-dot');
    const timeCurrentEl = document.getElementById('music-time-current');
    const timeTotalEl = document.getElementById('music-time-total');
    const singleLyricEl = document.getElementById('music-fp-single-lyric');
    const multiLyricsInner = document.getElementById('music-multi-lyrics-inner');

    // 如果进度条元素不存在，说明播放器界面未打开或未渲染，无需更新 UI
    if (!progressFillArc) return;

    const current = audioPlayer.currentTime;
    const total = audioPlayer.duration;
    const percent = (current / total); // 0 到 1 之间
    
    // 修复：更新弧形进度条，使用 getPointAtLength 精准获取圆点坐标
    const pathLength = progressFillArc.getTotalLength() || 320;
    const dashOffset = pathLength - (percent * pathLength);
    progressFillArc.style.strokeDasharray = pathLength;
    progressFillArc.style.strokeDashoffset = dashOffset;
    
    if (progressDot && progressFillArc.getPointAtLength) {
        const point = progressFillArc.getPointAtLength(percent * pathLength);
        progressDot.setAttribute('cx', point.x);
        progressDot.setAttribute('cy', point.y);
    }

    if (timeCurrentEl) timeCurrentEl.innerText = musicFormatTime(current);
    if (timeTotalEl) timeTotalEl.innerText = musicFormatTime(total);

    // 👇【保留】：同步更新音乐胶囊的进度条和时间
    const capProgressFill = document.getElementById('capsule-progress-fill');
    const capTimeCurrentEl = document.getElementById('capsule-time-current');
    const capTimeTotalEl = document.getElementById('capsule-time-total');
    
    if (capProgressFill) capProgressFill.style.width = `${percent * 100}%`;
    if (capTimeCurrentEl) capTimeCurrentEl.innerText = musicFormatTime(current);
    if (capTimeTotalEl) capTimeTotalEl.innerText = musicFormatTime(total);
    // 👆保留结束

    // 👇【保留】：同步更新查手机专属全屏播放器的进度条和时间
    const sfpTimeCurrentCenterEl = document.getElementById('wc-sfp-time-current-center');
    const sfpTimeCurrentEl = document.getElementById('wc-sfp-time-current');
    const sfpTimeTotalEl = document.getElementById('wc-sfp-time-total');
    const waveform = document.getElementById('wc-sfp-waveform');
    
    if (sfpTimeCurrentCenterEl) sfpTimeCurrentCenterEl.innerText = musicFormatTime(current);
    if (sfpTimeCurrentEl) sfpTimeCurrentEl.innerText = musicFormatTime(current);
    if (sfpTimeTotalEl) sfpTimeTotalEl.innerText = musicFormatTime(total);
    
    // 更新声波条的激活状态
    if (waveform && waveform.children.length > 0) {
        const bars = waveform.children;
        const activeCount = Math.floor(percent * bars.length);
        for (let i = 0; i < bars.length; i++) {
            if (i < activeCount) {
                bars[i].classList.add('active');
            } else {
                bars[i].classList.remove('active');
            }
        }
    }
    // 👆保留结束

    // 同步更新桌面小组件进度条
    const widgetProgressFill = document.getElementById('widget-progress-fill');
    if (widgetProgressFill) widgetProgressFill.style.width = `${percent * 100}%`;

    // 2. 同步歌词 (单行 + 多行)
    if (musicState.lyrics.length > 0) {
        let activeIndex = -1;
        for (let i = 0; i < musicState.lyrics.length; i++) {
            if (current >= musicState.lyrics[i].time) {
                activeIndex = i;
            } else {
                break;
            }
        }
        
        if (activeIndex !== -1) {
            const currentLyricText = musicState.lyrics[activeIndex].text || '...';
            
            // 更新单行歌词
            if (singleLyricEl && singleLyricEl.innerText !== currentLyricText) {
                singleLyricEl.innerText = currentLyricText;
            }
            
            // 更新多行歌词滚动
            if (multiLyricsInner) {
                const lastActiveIndex = multiLyricsInner.getAttribute('data-active-index');
                if (lastActiveIndex !== activeIndex.toString()) {
                    const lines = multiLyricsInner.querySelectorAll('.music-multi-lyric-line');
                    lines.forEach(l => l.classList.remove('active'));
                    
                    if (lines[activeIndex]) {
                        lines[activeIndex].classList.add('active');
                        // 修复：精准滚动居中
                        const activeLine = lines[activeIndex];
                        const containerHeight = multiLyricsInner.parentElement.clientHeight;
                        // 计算偏移量：当前行距离顶部的距离 - 容器高度的一半 + 当前行高度的一半
                        const offset = activeLine.offsetTop - (containerHeight / 2) + (activeLine.clientHeight / 2);
                        multiLyricsInner.style.transform = `translateY(-${offset}px)`;
                    }
                    multiLyricsInner.setAttribute('data-active-index', activeIndex);
                }
            }

            // 【保留】：同步歌词到音乐胶囊
            const capsuleLyricEl = document.getElementById('capsule-exp-lyric');
            if (capsuleLyricEl && capsuleLyricEl.innerText !== currentLyricText) {
                capsuleLyricEl.innerText = currentLyricText;
            }               
            
            // 【保留】：同步歌词到桌面小组件 (带智能滚动判断)
            const widgetLyricEl = document.getElementById('widget-song-lyric');
            if (widgetLyricEl && widgetLyricEl.innerText !== currentLyricText) {
                widgetLyricEl.innerText = currentLyricText;
                
                // 动态判断是否需要滚动
                const wrapper = widgetLyricEl.parentElement;
                void widgetLyricEl.offsetWidth; 
                
                if (widgetLyricEl.scrollWidth > wrapper.clientWidth) {
                    const dist = wrapper.clientWidth - widgetLyricEl.scrollWidth;
                    widgetLyricEl.style.setProperty('--scroll-dist', `${dist}px`);
                    widgetLyricEl.classList.add('scrolling');
                } else {
                    widgetLyricEl.classList.remove('scrolling');
                    widgetLyricEl.style.transform = 'translateX(0)';
                }
            }
        }
    }
});
// 【补充代码】：监听音乐播放结束，自动播放下一首
audioPlayer.addEventListener('ended', () => {
    // 稍微延迟一下，避免频繁切换卡顿
    setTimeout(() => {
        musicPlayNext();
    }, 500);
});      
function musicFormatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

let isDraggingMusicProgress = false;

function musicSeek(e) {
    const bar = document.getElementById('music-progress-bar'); 
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    
    // 兼容鼠标和触摸事件
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    
    // 简单的水平映射，因为圆弧比较平缓
    let percent = (clientX - rect.left - 20) / (rect.width - 40);
    
    if (percent < 0) percent = 0;
    if (percent > 1) percent = 1;
    
    if (audioPlayer && isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
        audioPlayer.currentTime = percent * audioPlayer.duration;
        
        // 拖拽时实时更新 UI，但不触发 timeupdate
        const progressFillArc = document.getElementById('music-progress-fill-arc');
        const progressDot = document.getElementById('music-progress-dot');
        const timeCurrentEl = document.getElementById('music-time-current');
        
        if (progressFillArc) {
            const pathLength = progressFillArc.getTotalLength() || 320;
            progressFillArc.style.strokeDashoffset = pathLength - (percent * pathLength);
            
            if (progressDot && progressFillArc.getPointAtLength) {
                const point = progressFillArc.getPointAtLength(percent * pathLength);
                progressDot.setAttribute('cx', point.x);
                progressDot.setAttribute('cy', point.y);
            }
        }
        if (timeCurrentEl) timeCurrentEl.innerText = musicFormatTime(audioPlayer.currentTime);
    }
}
// ==========================================
// 新增：音乐小聊天窗口拖拽逻辑
// ==========================================
let musicChatDrag = { active: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

document.addEventListener('DOMContentLoaded', () => {
    const handle = document.getElementById('music-chat-drag-handle');
    const box = document.getElementById('music-chat-window');
    if (!handle || !box) return;

    // 触摸端拖拽
    handle.addEventListener('touchstart', (e) => {
        musicChatDrag.active = true;
        musicChatDrag.startX = e.touches[0].clientX;
        musicChatDrag.startY = e.touches[0].clientY;
        musicChatDrag.initialLeft = box.offsetLeft;
        musicChatDrag.initialTop = box.offsetTop;
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!musicChatDrag.active) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - musicChatDrag.startX;
        const dy = e.touches[0].clientY - musicChatDrag.startY;
        box.style.left = (musicChatDrag.initialLeft + dx) + 'px';
        box.style.top = (musicChatDrag.initialTop + dy) + 'px';
        box.style.right = 'auto'; // 解除 right 限制，允许自由移动
    }, { passive: false });

    document.addEventListener('touchend', () => { musicChatDrag.active = false; });
    
    // 电脑端鼠标拖拽
    handle.addEventListener('mousedown', (e) => {
        musicChatDrag.active = true;
        musicChatDrag.startX = e.clientX;
        musicChatDrag.startY = e.clientY;
        musicChatDrag.initialLeft = box.offsetLeft;
        musicChatDrag.initialTop = box.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (!musicChatDrag.active) return;
        e.preventDefault();
        const dx = e.clientX - musicChatDrag.startX;
        const dy = e.clientY - musicChatDrag.startY;
        box.style.left = (musicChatDrag.initialLeft + dx) + 'px';
        box.style.top = (musicChatDrag.initialTop + dy) + 'px';
        box.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => { musicChatDrag.active = false; });
});

// 初始化音乐进度条拖拽
function initMusicProgressDrag() {
    const bar = document.getElementById('music-progress-bar');
    if (!bar) return;
    
    const startDrag = (e) => {
        isDraggingMusicProgress = true;
        musicSeek(e);
    };
    
    const moveDrag = (e) => {
        if (isDraggingMusicProgress) {
            if (e.cancelable) e.preventDefault();
            musicSeek(e);
        }
    };
    
    const endDrag = () => {
        isDraggingMusicProgress = false;
    };
    
    bar.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
    
    bar.addEventListener('touchstart', startDrag, {passive: false});
    document.addEventListener('touchmove', moveDrag, {passive: false});
    document.addEventListener('touchend', endDrag);
}

// --- 初始化与数据加载 ---
async function musicLoadData() {
    const data = await idb.get('ins_music_data');
    if (data) {
        if (data.profile) musicState.profile = data.profile;
        if (data.playlists) musicState.playlists = data.playlists;
    }
}

async function musicSaveData() {
    await idb.set('ins_music_data', {
        profile: musicState.profile,
        playlists: musicState.playlists
    });
}

// --- 页面导航 ---
async function openMusicApp() {
    await musicLoadData();
    document.getElementById('musicModal').classList.add('open');
    musicSwitchTab('home');
    musicRenderHomeChars();
    musicRenderProfile();
}

function closeMusicApp() {
    document.getElementById('musicModal').classList.remove('open');
}

function musicSwitchTab(tab) {
    document.querySelectorAll('.ins-music-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.ins-music-tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`music-view-${tab}`).classList.add('active');
    document.getElementById(`music-tab-${tab}`).classList.add('active');
    
    const exitBtn = document.querySelector('.ins-music-exit-btn');
    // 👇 加上这个 if 判断，防止因为删除了按钮而报错
    if (exitBtn) {
        if (tab === 'profile') {
            exitBtn.style.background = 'rgba(255,255,255,0.2)';
            exitBtn.style.color = '#FFF';
            exitBtn.style.border = 'none';
        } else {
            exitBtn.style.background = 'rgba(255,255,255,0.9)';
            exitBtn.style.color = '#111';
            exitBtn.style.border = '1px solid #F0F0F0';
        }
    }
}
// --- 主页角色渲染 ---
function musicRenderHomeChars() {
    const grid = document.getElementById('music-char-grid');
    grid.innerHTML = '';
    
    const availableChars = wcState.characters.filter(c => !c.isGroup);
    if (availableChars.length === 0) {
        grid.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #888; padding: 20px;">No characters available.</div>';
        return;
    }

    availableChars.forEach(char => {
        const card = document.createElement('div');
        card.className = 'ins-music-char-card';
        card.innerHTML = `
            <img src="${char.avatar}" class="ins-music-char-img">
            <div class="ins-music-char-info">
                <div class="ins-music-char-name">${char.name}</div>
                <div class="ins-music-char-action">Invite to listen</div>
            </div>
        `;
        card.onclick = () => musicInviteChar(char);
        grid.appendChild(card);
    });
}

// --- 邀请弹窗与一起听歌逻辑 ---
let musicPendingInviteChar = null;

function musicInviteChar(char) {
    if (!musicState.currentSong) {
        alert("Please play a song first before inviting someone!");
        return;
    }
    
    musicPendingInviteChar = char;
    document.getElementById('music-invite-avatar').src = char.avatar;
    document.getElementById('music-invite-name').innerText = char.name;
    document.getElementById('music-invite-song-title').innerText = musicState.currentSong.title;
    
    wcOpenModal('music-modal-invite');
}

function musicConfirmInvite() {
    if (!musicPendingInviteChar || !musicState.currentSong) return;
    
    const char = musicPendingInviteChar;
    
    // 发送专属的音乐邀请卡片消息
    wcAddMessage(char.id, 'me', 'music_invite', '邀请听歌', {
        songId: musicState.currentSong.id,
        songTitle: musicState.currentSong.title,
        songArtist: musicState.currentSong.artist,
        songCover: musicState.currentSong.cover
    });
    
    wcCloseModal('music-modal-invite');
    showMainSystemNotification("Music", `已向 ${char.name} 发送听歌邀请，等待回复...`, char.avatar);
    
    // 【修改】：移除这里的自动开启听歌，改为等待 AI 回复
    musicPendingInviteChar = null;
}

// 聊天记录中点击卡片接受邀请
window.musicAcceptInvite = function(charId, songId, title, artist, cover) {
    openMusicApp();
    musicPlaySong(songId, title, artist, cover);
    musicStartListenTogether(charId);
    musicOpenFullPlayer();
};

// 计算两个经纬度之间的距离 (公里)
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // 地球半径
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2);
}

function musicStartListenTogether(charId, isResume = false) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;
    
    musicState.listenTogether.active = true;
    musicState.listenTogether.charId = charId;
    
    if (!isResume) {
        musicState.listenTogether.startTime = Date.now();
        musicState.listenTogether.sessionSongCount = 1; // 初始算1首
        musicSaveData();
    }
    
    const userAvatar = (char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
    document.getElementById('music-fp-avatar-user').src = userAvatar;
    document.getElementById('music-fp-avatar-char').src = char.avatar;
    document.getElementById('music-fp-together').style.display = 'flex';
    
    // 尝试获取真实距离或虚拟距离
    let distanceStr = "未知距离";
    
    if (char.chatConfig && char.chatConfig.locationType === 'virtual') {
        // 如果是虚拟世界，直接读取自定义距离
        if (char.chatConfig.virtualDistance) {
            distanceStr = char.chatConfig.virtualDistance;
            // 如果用户输入的是纯数字，自动加上"公里"，否则直接显示文本（如"光年之外"）
            if (!isNaN(distanceStr)) {
                distanceStr += " 公里";
            }
        } else {
            distanceStr = "跨越次元";
        }
    } else if (char.chatConfig && char.chatConfig.locationLat && char.chatConfig.locationLon) {
        // 如果是现实世界，计算经纬度距离
        if (typeof sendLocLat !== 'undefined' && sendLocLat !== 0) {
            const dist = calculateDistance(sendLocLat, sendLocLon, char.chatConfig.locationLat, char.chatConfig.locationLon);
            if (dist) distanceStr = `${dist} 公里`;
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, char.chatConfig.locationLat, char.chatConfig.locationLon);
                if (dist) distanceStr = `${dist} 公里`; // 异步获取成功后更新变量，setInterval 会自动读到新值
            }, () => {}, { timeout: 5000 });
        }
    }

    if (musicState.listenTogether.timerInterval) clearInterval(musicState.listenTogether.timerInterval);
    
    musicState.listenTogether.timerInterval = setInterval(() => {
        const currentSessionSeconds = Math.floor((Date.now() - musicState.listenTogether.startTime) / 1000);
        const totalSeconds = (musicState.listenTogether.totalListenSeconds || 0) + currentSessionSeconds;
        
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMins = Math.floor((totalSeconds % 3600) / 60);
        
        const metaEl = document.getElementById('music-fp-meta');
        if (metaEl) {
            metaEl.innerText = `相距 ${distanceStr}，一起听了 ${totalHours} 小时 ${totalMins} 分钟`;
        }

        const m = Math.floor(currentSessionSeconds / 60).toString().padStart(2, '0');
        const s = (currentSessionSeconds % 60).toString().padStart(2, '0');
        const capsuleTimerEl = document.getElementById('capsule-timer'); 
        if (capsuleTimerEl) capsuleTimerEl.innerText = `${m}:${s}`;
    }, 1000);
}


// 【新增】：手动结束一起听歌
window.musicStopListenTogether = function() {
    if (confirm("要结束和 Ta 的一起听歌吗？")) {
        const charId = musicState.listenTogether.charId;
        
        // 1. 计算本次时长并累加到总时长
        const sessionDurationMs = Date.now() - musicState.listenTogether.startTime;
        const sessionSeconds = Math.floor(sessionDurationMs / 1000);
        musicState.listenTogether.totalListenSeconds = (musicState.listenTogether.totalListenSeconds || 0) + sessionSeconds;
        
        // 2. 构造总结数据
        const summaryData = {
            startTime: musicState.listenTogether.startTime,
            endTime: Date.now(),
            durationMs: sessionDurationMs,
            songCount: musicState.listenTogether.sessionSongCount || 1
        };

        // 3. 找到聊天记录中最近的一条 music_invite，将其状态改为 ended 并附上数据
        if (charId && wcState.chats[charId]) {
            const msgs = wcState.chats[charId];
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].type === 'music_invite' && msgs[i].status !== 'ended') {
                    msgs[i].status = 'ended';
                    msgs[i].summaryData = summaryData;
                    break;
                }
            }
            wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): 用户结束了和你的“一起听歌”。]`, { hidden: true });       
        }

        // 4. 清理状态
        musicState.listenTogether.active = false;
        musicState.listenTogether.charId = null;
        musicState.listenTogether.sessionSongCount = 0;
        clearInterval(musicState.listenTogether.timerInterval);
        document.getElementById('music-fp-together').style.display = 'none';
        
        const capsuleTimerEl = document.getElementById('capsule-timer');
        if (capsuleTimerEl) capsuleTimerEl.innerText = "00:00";      
        
        musicSaveData();
        wcSaveData();
        if (charId === wcState.activeChatId) wcRenderMessages(charId); // 刷新聊天界面卡片
        
        alert("已结束一起听歌。聊天界面的卡片已生成听歌报告。");
    }
};


// --- 搜索功能 ---
function musicOpenSearch() {
    document.getElementById('music-search-overlay').classList.add('active');
    
    // 延迟 300 毫秒，等待搜索面板的 CSS 滑动动画完全结束后，再弹出键盘
    setTimeout(() => {
        document.getElementById('music-search-input').focus();
    }, 300);
}

function musicCloseSearch() {
    document.getElementById('music-search-overlay').classList.remove('active');
}

function musicHandleSearchEnter(e) {
    if (e.key === 'Enter') musicPerformSearch();
}

async function musicPerformSearch() {
    const kw = document.getElementById('music-search-input').value.trim();
    if (!kw) return;

    const resultsContainer = document.getElementById('music-search-results');
    resultsContainer.innerHTML = '<div class="wc-ios-spinner" style="margin: 50px auto;"></div>';

    try {
        // 动态判断使用主接口还是副接口进行搜索
        const baseUrl = getMusicApiBaseUrl();
        const res = await fetch(`${baseUrl}/cloudsearch?keywords=${encodeURIComponent(kw)}`);
        const data = await res.json();
        
        if (data.code === 200 && data.result && data.result.songs) {
            musicState.currentPlaylist = data.result.songs.map(song => ({
                id: song.id,
                title: song.name,
                artist: song.ar.map(a => a.name).join(', '),
                cover: song.al.picUrl + '?param=100y100'
            }));
            musicRenderSearchResults(musicState.currentPlaylist);
        } else {
            resultsContainer.innerHTML = '<div class="ins-music-empty-state">No results found.</div>';
        }
    } catch (e) {
        console.error("Search Error:", e);
        resultsContainer.innerHTML = '<div class="ins-music-empty-state">Search failed.</div>';
    }
}


function musicRenderSearchResults(songs) {
    const container = document.getElementById('music-search-results');
    container.innerHTML = '';
    
    songs.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'ins-music-song-item';
        item.innerHTML = `
            <img src="${song.cover}" class="ins-music-song-cover" onclick="musicPlayFromSearch(${index})">
            <div class="ins-music-song-info" onclick="musicPlayFromSearch(${index})">
                <div class="ins-music-song-title">${song.title}</div>
                <div class="ins-music-song-artist">${song.artist}</div>
            </div>
            <div class="ins-music-btn-icon" style="background: transparent; border: 1px solid #E5E5EA; color: #111;" onclick="musicOpenAddToPlaylistFromSearch(${index})">
                <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
        `;
        container.appendChild(item);
    });
    
    const spacer = document.createElement('div');
    spacer.className = 'ins-music-bottom-spacer';
    container.appendChild(spacer);
}

// 新增辅助函数：从搜索列表播放
window.musicPlayFromSearch = function(index) {
    musicState.currentIndex = index;
    const song = musicState.currentPlaylist[index];
    musicPlaySong(song.id, song.title, song.artist, song.cover);
};

// 新增辅助函数：从搜索列表添加到歌单
window.musicOpenAddToPlaylistFromSearch = function(index) {
    const song = musicState.currentPlaylist[index];
    musicOpenAddToPlaylist(song);
};

async function musicPlaySong(id, title, artist, cover) {
    try {
        // 【核心修复】：在请求网络前，立即更新 UI 为新歌信息，消除“卡顿没切歌”的错觉
        musicState.currentSong = { id, title, artist, cover, url: '' };
        musicUpdatePlayerUI();
        
        let songUrl = '';
        const playBaseUrl = getMusicPlayApiBaseUrl();
        
        // 统一使用主接口获取播放链接
        const res = await fetch(`${playBaseUrl}/?server=netease&type=song&id=${id}`);
        const data = await res.json();
        if (data && data.length > 0) {
            if (data[0].url) songUrl = data[0].url;
            if (data[0].title) title = data[0].title;
            if (data[0].author) artist = data[0].author;
            if (data[0].pic) cover = data[0].pic;
        }
        
        if (songUrl) {
            songUrl = songUrl.replace('http://', 'https://');
            
            musicState.currentSong = { id, title, artist, cover, url: songUrl };
            audioPlayer.src = songUrl;
            
            audioPlayer.play().then(() => {
                musicState.isPlaying = true;
                
                if (musicState.listenTogether.active) {
                    musicState.listenTogether.sessionSongCount = (musicState.listenTogether.sessionSongCount || 0) + 1;
                }

                document.getElementById('music-mini-player').style.display = 'flex';
                musicUpdatePlayerUI();
                musicCloseSearch();
                
                musicFetchLyrics(id);
            }).catch(e => {
                console.error("播放失败:", e);
                alert(`抱歉宝宝，《${title}》可能是 VIP 专属或无版权，当前格式无法播放哦~`);
                musicState.isPlaying = false;
                musicUpdatePlayerUI();
            });
            
        } else {
            alert(`抱歉宝宝，《${title}》无版权或需要 VIP，无法获取播放链接。`);
            musicState.isPlaying = false;
            musicUpdatePlayerUI();
        }
    } catch (e) {
        console.error(e);
        alert("获取歌曲信息失败，网络异常。");
        musicState.isPlaying = false;
        musicUpdatePlayerUI();
    }
}

async function musicFetchLyrics(id) {
    const singleLyricEl = document.getElementById('music-fp-single-lyric');
    const multiLyricsInner = document.getElementById('music-multi-lyrics-inner');
    
    if (singleLyricEl) singleLyricEl.innerText = 'Loading lyrics...';
    if (multiLyricsInner) multiLyricsInner.innerHTML = '<div class="music-multi-lyric-line">Loading...</div>';
    
    musicState.lyrics = [];
    
    try {
        let rawLyric = '';
        const playBaseUrl = getMusicPlayApiBaseUrl();
        const res = await fetch(`${playBaseUrl}/?server=netease&type=lrc&id=${id}`);
        const textData = await res.text();
        try {
            const jsonData = JSON.parse(textData);
            if (jsonData.lrc && jsonData.lrc.lyric) rawLyric = jsonData.lrc.lyric;
            else if (jsonData.lyric) rawLyric = jsonData.lyric;
            else rawLyric = textData;
        } catch (e) { rawLyric = textData; }
        
        if (rawLyric) {
            const lines = rawLyric.split('\n');
            const parsedLyrics = [];
            lines.forEach(line => {
                const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
                if (match) {
                    const m = parseInt(match[1]);
                    const s = parseInt(match[2]);
                    const ms = parseInt(match[3]);
                    const time = m * 60 + s + ms / 1000;
                    const text = match[4].trim();
                    if (text) parsedLyrics.push({ time, text });
                }
            });
            
            musicState.lyrics = parsedLyrics;
            
            if (parsedLyrics.length > 0) {
                if (multiLyricsInner) {
                    multiLyricsInner.innerHTML = '';
                    parsedLyrics.forEach(l => {
                        const div = document.createElement('div');
                        div.className = 'music-multi-lyric-line';
                        div.innerText = l.text;
                        multiLyricsInner.appendChild(div);
                    });
                }
            } else {
                if (singleLyricEl) singleLyricEl.innerText = 'Pure Music';
                if (multiLyricsInner) multiLyricsInner.innerHTML = '<div class="music-multi-lyric-line">Pure Music</div>';
            }
        } else {
            if (singleLyricEl) singleLyricEl.innerText = 'No lyrics available';
            if (multiLyricsInner) multiLyricsInner.innerHTML = '<div class="music-multi-lyric-line">No lyrics available</div>';
        }
    } catch (e) {
        console.error("Lyric Error:", e);
        if (singleLyricEl) singleLyricEl.innerText = 'Failed to load lyrics';
    }
}
       
function musicPlayNext() {
    if (musicState.currentPlaylist.length === 0) return;
    if (musicState.playMode === 'random') {
        musicState.currentIndex = Math.floor(Math.random() * musicState.currentPlaylist.length);
    } else {
        musicState.currentIndex = (musicState.currentIndex + 1) % musicState.currentPlaylist.length;
    }
    const nextSong = musicState.currentPlaylist[musicState.currentIndex];
    musicPlaySong(nextSong.id, nextSong.title, nextSong.artist, nextSong.cover);
}
       
function musicPlayPrev() {
    if (musicState.currentPlaylist.length === 0) return;
    if (musicState.playMode === 'random') {
        musicState.currentIndex = Math.floor(Math.random() * musicState.currentPlaylist.length);
    } else {
        musicState.currentIndex = (musicState.currentIndex - 1 + musicState.currentPlaylist.length) % musicState.currentPlaylist.length;
    }
    const prevSong = musicState.currentPlaylist[musicState.currentIndex];
    musicPlaySong(prevSong.id, prevSong.title, prevSong.artist, prevSong.cover);
}
// --- 新增：控制音乐播放与暂停的核心逻辑 ---
function musicTogglePlay() {
    if (!musicState.currentSong) return;
    
    if (musicState.isPlaying) {
        audioPlayer.pause();
        musicState.isPlaying = false;
    } else {
        audioPlayer.play();
        musicState.isPlaying = true;
    }
    
    // 更新播放器和胶囊的 UI 状态
    musicUpdatePlayerUI();
}
function musicTogglePlayMode() {
    const modes = ['loop', 'single', 'random'];
    const currentIndex = modes.indexOf(musicState.playMode);
    musicState.playMode = modes[(currentIndex + 1) % modes.length];
    
    const modeBtn = document.getElementById('music-btn-mode');
    const sfpModeBtn = document.getElementById('wc-sfp-btn-mode'); // 同步更新专属播放器
    
    let iconHtml = '';
    if (musicState.playMode === 'loop') {
        iconHtml = '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>';
    } else if (musicState.playMode === 'single') {
        iconHtml = '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/></svg>';
    } else if (musicState.playMode === 'random') {
        iconHtml = '<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>';
    }
    
    if (modeBtn) modeBtn.innerHTML = iconHtml;
    if (sfpModeBtn) sfpModeBtn.innerHTML = iconHtml;

    // 👇 宝宝，把下面这一行加在这个函数的最后面！
    // 它的作用是：每次切换模式后，立刻通知胶囊更新UI
    if (typeof musicUpdateCapsuleUI === 'function') musicUpdateCapsuleUI();
}

function musicOpenCurrentPlaylist() {
    const container = document.getElementById('music-current-playlist-container');
    container.innerHTML = '';
    
    if (musicState.currentPlaylist.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No songs in playlist.</div>';
    } else {
        musicState.currentPlaylist.forEach((song, index) => {
            const isPlaying = index === musicState.currentIndex;
            const item = document.createElement('div');
            item.className = 'ins-music-song-item';
            item.style.borderBottom = '1px solid #F9F9F9';
            item.innerHTML = `
                <div class="ins-music-song-info">
                    <div class="ins-music-song-title" style="color: ${isPlaying ? '#111' : '#666'}; font-weight: ${isPlaying ? '700' : '500'};">${song.title}</div>
                    <div class="ins-music-song-artist">${song.artist}</div>
                </div>
                ${isPlaying ? '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:#111;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>' : ''}
            `;
            item.onclick = () => {
                musicState.currentIndex = index;
                musicPlaySong(song.id, song.title, song.artist, song.cover);
                wcCloseModal('music-modal-current-playlist');
            };
            container.appendChild(item);
        });
    }
        wcOpenModal('music-modal-current-playlist');
}

// 1. 安全地绑定迷你播放器的点击事件（放在全局或 window.onload 中）
document.addEventListener('DOMContentLoaded', () => {
    const miniPlayerEl = document.getElementById('music-mini-player');
    if (miniPlayerEl) {
        miniPlayerEl.addEventListener('click', (e) => {
            // 如果点击的是播放/暂停按钮，则不打开全屏
            if (e.target.closest('.ins-music-player-controls')) return;
            musicOpenFullPlayer();
        });
    }
});

// 2. 修复后的打开全屏播放器函数
function musicOpenFullPlayer() {
    if (!musicState.currentSong) return;
    const fullPlayer = document.getElementById('music-full-player');
    if (fullPlayer) {
        fullPlayer.classList.add('active');
    }
}

// --- 新增：查手机专属全屏播放器逻辑 ---
function wcOpenSimFullPlayer() {
    if (!musicState.currentSong) return;
    const player = document.getElementById('wc-phone-sim-full-player');
    if (player) {
        player.classList.add('active');
        wcInitWaveform(); // 初始化声波条
    }
}

function wcCloseSimFullPlayer() {
    const player = document.getElementById('wc-phone-sim-full-player');
    if (player) {
        player.classList.remove('active');
    }
}

// 初始化声波条
function wcInitWaveform() {
    const waveform = document.getElementById('wc-sfp-waveform');
    if (!waveform) return;
    
    // 如果已经生成过，就不重复生成
    if (waveform.children.length > 0) return;

    // 预设一些高度，模拟声波起伏
    const heights = [10, 15, 8, 20, 12, 25, 18, 22, 14, 28, 16, 10, 20, 15, 8, 22, 12, 18, 10, 25, 14, 20, 16, 12, 8];
    
    let html = '';
    for (let i = 0; i < heights.length; i++) {
        html += `<div class="wc-sfp-wave-bar" style="height: ${heights[i]}px;"></div>`;
    }
    waveform.innerHTML = html;
}

// 点击声波条跳转进度
function wcSimSeekWaveform(e) {
    const waveform = e.currentTarget; 
    const rect = waveform.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    
    if (audioPlayer && isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
        audioPlayer.currentTime = percent * audioPlayer.duration;
    }
}

function musicCloseFullPlayer() {
    const fullPlayer = document.getElementById('music-full-player');
    if (fullPlayer) {
        fullPlayer.classList.remove('active');
    }
}
// 🌟 新增：切换歌词模式
function toggleLyricMode() {
    const player = document.getElementById('music-full-player');
    if (!player) return;
    
    player.classList.toggle('lyric-mode');
    
    // 延迟重新计算滚动位置，等待 CSS 动画展开
    setTimeout(() => {
        // 强制触发一次 timeupdate 来重新计算歌词位置
        if (audioPlayer && !audioPlayer.paused) {
            const event = new Event('timeupdate');
            audioPlayer.dispatchEvent(event);
        }
    }, 50);
}

function musicUpdatePlayerUI() {
    if (!musicState.currentSong) return;
    
    document.getElementById('music-player-cover').src = musicState.currentSong.cover;
    
    // 更新全屏大封面
    const largeCover = document.getElementById('music-fp-cover-large');
    if (largeCover) {
        if (musicState.profile && musicState.profile.fpBg) {
            largeCover.src = musicState.profile.fpBg;
        } else {
            largeCover.src = musicState.currentSong.cover;
        }
    }

    // 👇 新增：更新透明唱片封面 👇
    const fpRecordCover = document.getElementById('music-fp-record-cover');
    if (fpRecordCover) {
        if (musicState.profile && musicState.profile.fpRecord) {
            fpRecordCover.src = musicState.profile.fpRecord;
        } else {
            fpRecordCover.src = musicState.currentSong.cover;
        }
    }

    const miniTitle = document.getElementById('music-player-title');
    const miniArtist = document.getElementById('music-player-artist');
    const fpTitle = document.getElementById('music-fp-title');
    const fpArtist = document.getElementById('music-fp-artist');
    const fpArtistTop = document.getElementById('music-fp-artist-top'); // 顶部歌手名

    if (miniTitle) miniTitle.innerText = musicState.currentSong.title;
    if (miniArtist) miniArtist.innerText = musicState.currentSong.artist;
    if (fpTitle) fpTitle.innerText = musicState.currentSong.title;
    if (fpArtist) fpArtist.innerText = musicState.currentSong.artist; 
    if (fpArtistTop) fpArtistTop.innerText = musicState.currentSong.artist; 
    
    const widgetTitle = document.getElementById('widget-song-name');
    if (widgetTitle) widgetTitle.innerText = musicState.currentSong.title;

    // 👇 【保留】：同步更新 Settings 页面的迷你播放器信息 👇
    const simMiniTitle = document.getElementById('sim-global-mini-title');
    const simMiniArtist = document.getElementById('sim-global-mini-artist');
    const simMiniCover = document.getElementById('sim-global-mini-cover');
    if (simMiniTitle) simMiniTitle.innerText = musicState.currentSong.title;
    if (simMiniArtist) simMiniArtist.innerText = musicState.currentSong.artist;
    if (simMiniCover) simMiniCover.src = musicState.currentSong.cover;

    // 👇 【保留】：同步更新查手机专属全屏播放器信息 👇
    const sfpTitle = document.getElementById('wc-sfp-title');
    const sfpArtist = document.getElementById('wc-sfp-artist');
    const sfpCover = document.getElementById('wc-sfp-cover');
    if (sfpTitle) sfpTitle.innerText = musicState.currentSong.title;
    if (sfpArtist) sfpArtist.innerText = musicState.currentSong.artist;
    if (sfpCover) sfpCover.src = musicState.currentSong.cover;

    const coverEl = document.getElementById('music-player-cover');
    const playBtn = document.getElementById('music-btn-play');
    const fpPlayBtn = document.getElementById('music-fp-btn-play');
    
    // 👇 【保留】：获取 Settings 页面的迷你播放器控制元素 👇
    const simMiniRecord = document.getElementById('sim-global-mini-record');
    const simMiniPlayBtn = document.getElementById('sim-global-mini-play-btn');

    // 👇 【保留】：获取查手机专属全屏播放器控制元素 👇
    const sfpRecordEl = document.getElementById('wc-sfp-record');
    const sfpPlayBtn = document.getElementById('wc-sfp-btn-play');
    
    const pauseIcon = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    const playIcon = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';            
    
    const fpRecordDisc = document.getElementById('music-fp-record-disc');
    const fpRecordWrapper = document.getElementById('music-fp-record-wrapper');

    if (musicState.isPlaying) {
        if (coverEl) coverEl.classList.add('playing');
        if (playBtn) playBtn.innerHTML = pauseIcon;
        if (fpPlayBtn) fpPlayBtn.innerHTML = pauseIcon;
        
        // 👇 新增：播放时唱片旋转，唱针放下 👇
        if (fpRecordDisc) fpRecordDisc.classList.add('playing');
        if (fpRecordWrapper) fpRecordWrapper.classList.add('playing');
        
        // 同步旋转和暂停图标
        if (simMiniRecord) simMiniRecord.classList.add('playing');
        if (simMiniPlayBtn) simMiniPlayBtn.innerHTML = pauseIcon;

        if (sfpRecordEl) sfpRecordEl.classList.add('playing');
        if (sfpPlayBtn) sfpPlayBtn.innerHTML = pauseIcon;
    } else {
        if (coverEl) coverEl.classList.remove('playing');
        if (playBtn) playBtn.innerHTML = playIcon;
        if (fpPlayBtn) fpPlayBtn.innerHTML = playIcon;
        
        // 👇 新增：暂停时唱片停止，唱针移开 👇
        if (fpRecordDisc) fpRecordDisc.classList.remove('playing');
        if (fpRecordWrapper) fpRecordWrapper.classList.remove('playing');
        
        // 同步停止旋转和播放图标
        if (simMiniRecord) simMiniRecord.classList.remove('playing');
        if (simMiniPlayBtn) simMiniPlayBtn.innerHTML = playIcon;

        if (sfpRecordEl) sfpRecordEl.classList.remove('playing');
        if (sfpPlayBtn) sfpPlayBtn.innerHTML = playIcon;
    }
    const widgetPlayBtn = document.getElementById('widget-btn-play');
    if (widgetPlayBtn) {
        widgetPlayBtn.innerHTML = musicState.isPlaying ? pauseIcon : playIcon;
    }

    // 同步更新音乐胶囊的 UI
    if (typeof musicUpdateCapsuleUI === 'function') musicUpdateCapsuleUI();
}
// ==========================================
// 新增：全屏播放器交互逻辑 (歌词、悬浮输入框、气泡、换背景、下拉菜单)
// ==========================================

// 👇 修复：控制右上角下拉菜单 👇
window.toggleMusicDropdownMenu = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById('music-dropdown-menu');
    if (menu) {
        // 动态判断是否显示“结束一起听歌”按钮
        const endListenBtn = document.getElementById('music-menu-end-listen');
        if (endListenBtn) {
            if (musicState.listenTogether && musicState.listenTogether.active) {
                endListenBtn.style.display = 'flex';
            } else {
                endListenBtn.style.display = 'none';
            }
        }

        // 强制提升层级并切换状态
        menu.style.zIndex = '9999';
        menu.classList.toggle('active');
    }
};

// 新增：恢复默认背景（跟随歌曲封面）
window.musicRestoreDefaultBg = function() {
    const largeCover = document.getElementById('music-fp-cover-large');
    if (largeCover && musicState.currentSong) {
        largeCover.src = musicState.currentSong.cover;
    }
    if (musicState.profile) {
        musicState.profile.fpBg = null;
        musicSaveData();
    }
};

window.musicHandleFpRecordUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    
    try {
        const base64 = await wcCompressImage(file);
        const recordCover = document.getElementById('music-fp-record-cover');
        if (recordCover) {
            recordCover.src = base64;
        }
        if (!musicState.profile) musicState.profile = {};
        musicState.profile.fpRecord = base64;
        musicSaveData();
    } catch (e) {
        console.error("唱片封面处理失败", e);
        alert("图片处理失败，请重试");
    }
    input.value = ''; 
};

window.musicRestoreDefaultRecord = function() {
    const recordCover = document.getElementById('music-fp-record-cover');
    if (recordCover && musicState.currentSong) {
        recordCover.src = musicState.currentSong.cover;
    }
    if (musicState.profile) {
        musicState.profile.fpRecord = null;
        musicSaveData();
    }
};

// 点击屏幕其他地方关闭下拉菜单
document.addEventListener('click', (e) => {
    const menu = document.getElementById('music-dropdown-menu');
    if (menu && menu.classList.contains('active')) {
        // 如果点击的不是菜单本身，也不是触发按钮，就关闭
        if (!e.target.closest('.ins-music-dropdown-menu') && !e.target.closest('.ins-music-fp-btn')) {
            menu.classList.remove('active');
        }
    }
});

window.musicHandleFpBgUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    
    try {
        const base64 = await wcCompressImage(file);
        const largeCover = document.getElementById('music-fp-cover-large');
        if (largeCover) {
            largeCover.src = base64;
        }
        if (!musicState.profile) musicState.profile = {};
        musicState.profile.fpBg = base64;
        musicSaveData();
    } catch (e) {
        console.error("背景图片处理失败", e);
        alert("图片处理失败，请重试");
    }
    input.value = ''; 
};

// 切换多行歌词显示
window.toggleMultiLyrics = function() {
    const container = document.getElementById('music-multi-lyrics-container');
    if (container) {
        container.classList.toggle('active');
    }
};

// 打开旧的聊天窗口 (绑定在心跳线上)
window.musicToggleOldChatWindow = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!musicState.listenTogether.active || !musicState.listenTogether.charId) {
        alert("请先在发现页邀请一位角色一起听歌哦~");
        return;
    }
    const chatWin = document.getElementById('music-chat-window');
    if (chatWin.style.display === 'none' || chatWin.style.display === '') {
        chatWin.style.display = 'flex';
        musicRenderChatMessages();
    } else {
        chatWin.style.display = 'none';
    }
};

// 切换悬浮输入框 (绑定在爱心上)
window.toggleFloatingInput = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!musicState.listenTogether.active || !musicState.listenTogether.charId) {
        alert("请先在发现页邀请一位角色一起听歌哦~");
        return;
    }
    const inputWin = document.getElementById('floating-chat-input');
    if (inputWin.style.display === 'none' || inputWin.style.display === '') {
        inputWin.style.display = 'flex';
        document.getElementById('floating-input-text').focus();
    } else {
        inputWin.style.display = 'none';
    }
};

// ==========================================
// 音乐分享逻辑 (底部面板 + 风格1卡片)
// ==========================================
window.musicOpenShareSheet = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!musicState.currentSong) {
        alert("请先播放一首歌曲哦~");
        return;
    }
    wcOpenModal('music-share-action-sheet');
};

window.musicSelectShareTarget = function(target) {
    wcCloseModal('music-share-action-sheet');
    
    setTimeout(() => {
        document.getElementById('music-share-target-hidden').value = target;
        document.getElementById('music-share-text').value = '';
        
        const chatGroup = document.getElementById('music-share-chat-target-group');
        const forumGroup = document.getElementById('music-share-forum-target-group');
        
        chatGroup.style.display = 'none';
        forumGroup.style.display = 'none';

        if (target === 'chat') {
            chatGroup.style.display = 'block';
            const charList = document.getElementById('music-share-char-list');
            charList.innerHTML = '';
            let selectedId = null;
            document.getElementById('music-share-char-selected-id').value = '';
            
            wcState.characters.forEach(c => {
                if (c.isGroup) return; // 排除群聊
                const isSelected = (wcState.activeChatId === c.id || (musicState.listenTogether.active && musicState.listenTogether.charId === c.id));
                if (isSelected && !selectedId) selectedId = c.id;
                
                const div = document.createElement('div');
                div.className = 'wc-list-item';
                div.style.padding = '8px 12px';
                div.style.borderBottom = 'none';
                div.style.cursor = 'pointer';
                div.style.background = isSelected ? '#E5E5EA' : '#FFF';
                div.style.borderRadius = '8px';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.innerHTML = `
                    <img src="${c.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 12px; border: 1px solid #F0F0F0;">
                    <span style="font-size: 14px; color: #111; font-weight: 500; flex: 1;">${c.name}</span>
                    ${isSelected ? '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; stroke: #007AFF; fill: none; stroke-width: 2;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                `;
                div.onclick = () => {
                    document.getElementById('music-share-char-selected-id').value = c.id;
                    Array.from(charList.children).forEach(child => {
                        child.style.background = '#FFF';
                        const svg = child.querySelector('svg');
                        if (svg) svg.remove();
                    });
                    div.style.background = '#E5E5EA';
                    div.innerHTML += '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; stroke: #007AFF; fill: none; stroke-width: 2;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                };
                charList.appendChild(div);
            });
            if (selectedId) {
                document.getElementById('music-share-char-selected-id').value = selectedId;
            }
        } else if (target === 'forum') {
            forumGroup.style.display = 'block';
            const forumSelect = document.getElementById('music-share-forum-select');
            forumSelect.innerHTML = '';
            if (typeof forumState !== 'undefined' && forumState.windows) {
                forumState.windows.forEach(w => {
                    const opt = document.createElement('option');
                    opt.value = w.id;
                    opt.innerText = w.name;
                    if (forumState.activeWindowId === w.id) opt.selected = true;
                    forumSelect.appendChild(opt);
                });
            }
            
            // 动态加载面具(身份)列表
            const maskSelect = document.getElementById('music-share-forum-mask-select');
            if (maskSelect) {
                maskSelect.innerHTML = '<option value="default">默认身份 (User)</option>';
                wcState.masks.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.innerText = `扮演: ${m.name}`;
                    maskSelect.appendChild(opt);
                });
            }
        }

        wcOpenModal('music-share-detail-modal');
    }, 300); // 等待底部面板收起
};

window.musicExecuteShareSong = function() {
    const target = document.getElementById('music-share-target-hidden').value;
    const text = document.getElementById('music-share-text').value.trim();
    const song = musicState.currentSong;
    if (!song) return;

    // 构造风格1的分享卡片 HTML
    const cardHtml = `
        <div class="chat-shared-song-card">
            <div class="css-song-info-row">
                <img src="${song.cover}" class="css-song-cover">
                <div class="css-song-text">
                    <div class="css-song-title">${song.title}</div>
                    <div class="css-song-artist">${song.artist}</div>
                </div>
            </div>
            <div class="css-song-footer">
                <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                网易云音乐
            </div>
        </div>
    `;

    if (target === 'chat') {
        const charId = parseInt(document.getElementById('music-share-char-selected-id').value);
        if (!charId) return alert("请选择角色");
        
        if (text) wcAddMessage(charId, 'me', 'text', text);
        wcAddMessage(charId, 'me', 'receipt', cardHtml);
        
        const aiPrompt = `[系统内部信息(仅AI可见): User 刚刚向你分享了一首歌曲《${song.title}》- ${song.artist}。${text ? 'User的留言是：“'+text+'”。' : ''}请在接下来的回复中，根据这首歌做出自然的反应。]`;
        wcAddMessage(charId, 'system', 'system', aiPrompt, { hidden: true });
        
        alert("已分享给角色！");
    } else if (target === 'moment') {
        const newMoment = {
            id: Date.now(),
            name: wcState.user.name,
            avatar: wcState.user.avatar,
            text: text ? `${text}<br><br>${cardHtml}` : cardHtml,
            image: null,
            imageDesc: null,
            time: Date.now(),
            likes: [],
            comments: [],
            visibleGroup: 'All'
        };
        wcState.moments.unshift(newMoment);
        wcSaveData();
        if (document.getElementById('wc-view-moments').classList.contains('active')) {
            wcRenderMoments();
        }
        alert("已分享至朋友圈！");
    } else if (target === 'forum') {
        const winId = document.getElementById('music-share-forum-select').value;
        if (!winId) return alert("请选择论坛窗口");
        
        // 获取选中的发布身份
        const maskId = document.getElementById('music-share-forum-mask-select').value;
        let authorName = forumState.profile.name;
        let authorHandle = forumState.profile.handle;
        let authorAvatar = forumState.profile.avatar;
        
        if (maskId !== 'default') {
            const mask = wcState.masks.find(m => m.id.toString() === maskId);
            if (mask) {
                authorName = mask.name;
                authorHandle = '@' + mask.name;
                authorAvatar = mask.avatar;
            }
        }
        
        const newPost = {
            id: Date.now(),
            windowId: winId,
            type: 'home', 
            isStory: false, 
            title: `分享歌曲: 《${song.title}》`, 
            author: {
                name: authorName,
                handle: authorHandle,
                avatar: authorAvatar
            },
            content: text ? `${text}<br><br>${cardHtml}` : cardHtml,
            image: null,
            imageDesc: null,
            time: Date.now(),
            likes: [], 
            saves: [],
            comments: []
        };
        
        forumState.posts.unshift(newPost);
        forumSaveData();
        if (document.getElementById('forum-view-home').classList.contains('active')) {
            forumRenderPosts('home');
        }
        alert("已分享至论坛！");
    }

    wcCloseModal('music-share-detail-modal');
};

// 悬浮输入框拖拽逻辑
let floatDrag = { active: false, startY: 0, initialTop: 0 };
document.addEventListener('DOMContentLoaded', () => {
    const handle = document.getElementById('floating-drag-handle');
    const box = document.getElementById('floating-chat-input');
    if (!handle || !box) return;

    handle.addEventListener('touchstart', (e) => {
        floatDrag.active = true;
        floatDrag.startY = e.touches[0].clientY;
        floatDrag.initialTop = box.offsetTop;
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!floatDrag.active) return;
        e.preventDefault();
        const dy = e.touches[0].clientY - floatDrag.startY;
        box.style.top = (floatDrag.initialTop + dy) + 'px';
        box.style.bottom = 'auto';
    }, { passive: false });

    document.addEventListener('touchend', () => { floatDrag.active = false; });
});

// 显示头像气泡
function showAvatarBubble(type, text, isTyping = false) {
    const bubbleId = type === 'user' ? 'user-bubble' : 'char-bubble';
    const bubble = document.getElementById(bubbleId);
    if (!bubble) return;

    if (type === 'char') {
        const typingEl = document.getElementById('char-typing');
        const textEl = document.getElementById('char-bubble-text');
        if (isTyping) {
            typingEl.style.display = 'block';
            textEl.style.display = 'none';
        } else {
            typingEl.style.display = 'none';
            textEl.style.display = 'block';
            textEl.innerText = text;
        }
    } else {
        bubble.innerText = text;
    }

    bubble.classList.add('show');
    
    // 如果不是正在输入状态，3秒后自动隐藏
    if (!isTyping) {
        setTimeout(() => {
            bubble.classList.remove('show');
        }, 3000);
    }
}

// 悬浮框发送消息
window.sendFloatingMsg = function() {
    const input = document.getElementById('floating-input-text');
    const text = input.value.trim();
    if (!text) return;
    
    const charId = musicState.listenTogether.charId;
    if (!charId) return;
    
    wcAddMessage(charId, 'me', 'text', text);
    input.value = '';
    
    // 显示 User 气泡
    showAvatarBubble('user', text);
};

// 悬浮框触发 AI
window.triggerFloatingAI = function() {
    const charId = musicState.listenTogether.charId;
    if (!charId) return;
    
    if (aiGeneratingLocks[charId]) return;
    
    // 显示 Char 正在输入气泡
    showAvatarBubble('char', '', true);
    
    // 拦截原有的 wcParseAIResponse，在 AI 回复后更新气泡
    const originalParse = wcParseAIResponse;
    wcParseAIResponse = async function(id, text, stickerGroupIds) {
        await originalParse(id, text, stickerGroupIds);
        
        // 尝试从最新的聊天记录中提取 AI 的回复文本
        const msgs = wcState.chats[id];
        if (msgs && msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.sender === 'them' && lastMsg.type === 'text') {
                showAvatarBubble('char', lastMsg.content, false);
            } else {
                // 如果是表情包等，隐藏气泡
                document.getElementById('char-bubble').classList.remove('show');
            }
        }
        // 恢复原函数
        wcParseAIResponse = originalParse;
    };

    wcTriggerAI(charId);
};

// --- 个人主页与歌单管理 ---
function musicRenderProfile() {
    document.getElementById('music-profile-bg').style.backgroundImage = `url('${musicState.profile.bg}')`;
    document.getElementById('music-profile-avatar').src = musicState.profile.avatar;
    document.getElementById('music-profile-name').innerText = musicState.profile.name;
    
    const list = document.getElementById('music-playlist-list');
    list.innerHTML = '';
    
    if (musicState.playlists.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #888; font-style: italic; padding: 20px;">No playlists yet.</div>';
        return;
    }
    
    musicState.playlists.forEach((pl, idx) => {
        const card = document.createElement('div');
        card.className = 'ins-music-playlist-card';
        // 核心：复用朋友圈的向左弹出菜单样式
        card.innerHTML = `
            <img src="${pl.cover}" class="ins-music-playlist-cover">
            <div class="ins-music-playlist-info">
                <div class="ins-music-playlist-name">${pl.name}</div>
                <div class="ins-music-playlist-count">${pl.tracks ? pl.tracks.length : 0} tracks</div>
            </div>
            <div style="position: relative; display: flex; align-items: center;">
                <!-- 向左弹出的深色高级菜单 -->
                <div class="wc-moment-popover" id="music-playlist-popover-${idx}" style="right: 36px; top: -4px;">
                    <div class="wc-moment-popover-item" onclick="event.stopPropagation(); musicOpenEditPlaylistInfo(${idx})" title="编辑">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                    <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.2); margin: 0 10px;"></div>
                    <div class="wc-moment-popover-item" onclick="event.stopPropagation(); musicDeletePlaylistAction(${idx})" title="删除">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </div>
                </div>
                <!-- 三个点按钮 -->
                <div class="ins-music-btn-icon" style="background: transparent; border: none; color: #888; width: 28px; height: 28px;" onclick="musicTogglePlaylistMenu(event, ${idx})">
                    <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                </div>
            </div>
        `;
        card.onclick = () => musicOpenPlaylistDetail(idx);
        list.appendChild(card);
    });
}

function musicOpenProfileEdit() {
    document.getElementById('music-edit-name').value = musicState.profile.name;
    document.getElementById('music-edit-avatar-url').value = '';
    document.getElementById('music-edit-bg-url').value = '';
    wcState.tempImage = ''; 
    wcOpenModal('music-modal-edit-profile');
}

function musicHandleFileUpload(input, type) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (type === 'avatar') {
                document.getElementById('music-edit-avatar-url').value = 'Local Image Selected';
                musicState.tempAvatar = e.target.result;
            } else if (type === 'bg') {
                document.getElementById('music-edit-bg-url').value = 'Local Image Selected';
                musicState.tempBg = e.target.result;
            } else if (type === 'pl-cover') {
                document.getElementById('music-create-pl-cover').value = 'Local Image Selected';
                musicState.tempPlCover = e.target.result;
            } else if (type === 'edit-pl-cover') {
                document.getElementById('music-edit-pl-cover').value = '已选择本地图片';
                musicState.tempEditPlCover = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    }
}

function musicSaveProfile() {
    const name = document.getElementById('music-edit-name').value.trim();
    const avatarUrl = document.getElementById('music-edit-avatar-url').value.trim();
    const bgUrl = document.getElementById('music-edit-bg-url').value.trim();
    
    if (name) musicState.profile.name = name;
    if (avatarUrl && avatarUrl !== 'Local Image Selected') musicState.profile.avatar = avatarUrl;
    else if (musicState.tempAvatar) musicState.profile.avatar = musicState.tempAvatar;
    
    if (bgUrl && bgUrl !== 'Local Image Selected') musicState.profile.bg = bgUrl;
    else if (musicState.tempBg) musicState.profile.bg = musicState.tempBg;
    
    musicState.tempAvatar = null;
    musicState.tempBg = null;
    
    musicSaveData();
    musicRenderProfile();
    wcCloseModal('music-modal-edit-profile');
}

function musicOpenCreatePlaylist() { wcOpenModal('music-modal-playlist-options'); }

function musicCreatePlaylist() {
    const name = document.getElementById('music-create-pl-name').value.trim();
    const coverUrl = document.getElementById('music-create-pl-cover').value.trim();
    if (!name) return alert("Please enter a playlist name.");
    
    let finalCover = 'https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg'; 
    if (coverUrl && coverUrl !== 'Local Image Selected') finalCover = coverUrl;
    else if (musicState.tempPlCover) finalCover = musicState.tempPlCover;
    
    musicState.playlists.push({ id: Date.now(), name: name, cover: finalCover, tracks: [] });
    
    musicState.tempPlCover = null;
    musicSaveData();
    musicRenderProfile();
    wcCloseModal('music-modal-create-playlist');
}
// ==========================================
// 新增：歌单编辑与删除 (向左弹出菜单版)
// ==========================================
let currentActionPlaylistIdx = -1;

// 控制弹出菜单的显示与隐藏
window.musicTogglePlaylistMenu = function(e, idx) {
    e.stopPropagation();
    // 先关闭其他所有打开的菜单 (复用朋友圈的类名)
    document.querySelectorAll('.wc-moment-popover').forEach(el => {
        if (el.id !== `music-playlist-popover-${idx}`) el.classList.remove('active');
    });
    // 切换当前菜单
    const popover = document.getElementById(`music-playlist-popover-${idx}`);
    if (popover) popover.classList.toggle('active');
};

// 删除歌单
window.musicDeletePlaylistAction = function(idx) {
    document.getElementById(`music-playlist-popover-${idx}`).classList.remove('active');
    if (confirm("确定要删除这个歌单吗？")) {
        musicState.playlists.splice(idx, 1);
        musicSaveData();
        musicRenderProfile();
    }
};

// 打开编辑弹窗
window.musicOpenEditPlaylistInfo = function(idx) {
    document.getElementById(`music-playlist-popover-${idx}`).classList.remove('active');
    currentActionPlaylistIdx = idx; // 记录当前编辑的索引
    const pl = musicState.playlists[idx];
    if (!pl) return;
    
    // 预填当前数据
    document.getElementById('music-edit-pl-name').value = pl.name;
    document.getElementById('music-edit-pl-cover').value = ''; // 默认不显示长长的base64
    musicState.tempEditPlCover = null; // 清空临时变量
    
    wcOpenModal('music-modal-edit-playlist-info');
};

// 保存修改
window.musicSavePlaylistInfo = function() {
    const pl = musicState.playlists[currentActionPlaylistIdx];
    if (!pl) return;

    const newName = document.getElementById('music-edit-pl-name').value.trim();
    const newCoverUrl = document.getElementById('music-edit-pl-cover').value.trim();

    if (!newName) return alert("歌单名称不能为空哦~");

    // 更新名称
    pl.name = newName;
    
    // 更新封面
    if (newCoverUrl && newCoverUrl !== '已选择本地图片') {
        pl.cover = newCoverUrl;
    } else if (musicState.tempEditPlCover) {
        pl.cover = musicState.tempEditPlCover;
    }

    musicSaveData();
    musicRenderProfile();
    wcCloseModal('music-modal-edit-playlist-info');
};

// ==========================================
// 新增：网易云 UID 登录与主页渲染逻辑
// ==========================================

// 1. 打开登录弹窗
window.musicOpenWyyLogin = function() {
    wcCloseModal('music-modal-playlist-options');
    setTimeout(() => {
        document.getElementById('wyy-uid-input').value = '';
        wcOpenModal('music-modal-wyy-login');
    }, 300);
};

// 2. 执行登录并拉取数据
window.musicDoWyyLogin = async function() {
    const uid = document.getElementById('wyy-uid-input').value.trim();
    if (!uid) return alert("请输入网易云 UID！");
    
    const btn = document.querySelector('#music-modal-wyy-login .wc-btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "正在连接网易云...";
    btn.disabled = true;
    
    try {
        const baseUrl = getMusicApiBaseUrl();
        const timestamp = Date.now(); // 强制打破缓存
        
        // A. 获取用户详情 (真实背景、头像、昵称)
        let profileData = null;
        try {
            const detailRes = await fetch(`${baseUrl}/user/detail?uid=${uid}&timestamp=${timestamp}`);
            const detailJson = await detailRes.json();
            if (detailJson.code === 200 && detailJson.profile) {
                profileData = detailJson.profile;
            }
        } catch(e) { console.warn("获取用户详情失败", e); }
        
        // B. 获取歌单列表
        const plRes = await fetch(`${baseUrl}/user/playlist?uid=${uid}&timestamp=${timestamp}`);
        const plJson = await plRes.json();
        
        if (plJson.code === 200 && plJson.playlist) {
            // 提取装扮数据
            const creator = plJson.playlist[0]?.creator || {};
            const name = profileData?.nickname || creator.nickname || "网易云用户";
            const avatar = profileData?.avatarUrl || creator.avatarUrl || "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg";
            const bg = profileData?.backgroundUrl || plJson.playlist[0]?.coverImgUrl || "https://i.postimg.cc/kgD9CsbW/IMG-8012.jpg";
            
            // 渲染到居中卡片 UI
            document.getElementById('wyy-profile-name').innerText = name;
            document.getElementById('wyy-profile-avatar').src = avatar;
            
            // 暂存装扮和歌单数据，供一键登录使用
            window.tempWyyProfile = { name, avatar, bg, playlists: plJson.playlist };
            
            // 渲染歌单列表
            const container = document.getElementById('wyy-playlist-container');
            container.innerHTML = '';
            
            if (plJson.playlist.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">Ta 还没有公开的歌单哦~</div>';
            } else {
                plJson.playlist.forEach(pl => {
                    const div = document.createElement('div');
                    div.style.cssText = "display: flex; align-items: center; background: #FFF; padding: 10px; border-radius: 12px; border: 1px solid #F0F0F0; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);";
                    div.innerHTML = `
                        <img src="${pl.coverImgUrl}?param=100y100" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; margin-right: 12px; flex-shrink: 0; border: 1px solid #F5F5F5;">
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-size: 14px; font-weight: bold; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${pl.name}</div>
                            <div style="font-size: 11px; color: #888;">共 ${pl.trackCount} 首</div>
                        </div>
                        <button style="background: #F5F5F5; color: #111; border: 1px solid #EAEAEA; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; cursor: pointer; flex-shrink: 0; margin-left: 10px;" onclick="musicImportSinglePlaylistById('${pl.id}', this)">导入</button>
                    `;
                    container.appendChild(div);
                });
            }
            
            // 关闭登录框，打开主页框
            wcCloseModal('music-modal-wyy-login');
            setTimeout(() => wcOpenModal('music-modal-wyy-profile'), 300);
            
        } else {
            alert("获取歌单失败：" + (plJson.message || "未知错误"));
        }
    } catch (e) {
        console.error(e);
        alert("网络请求失败，请检查 API 节点是否可用。");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// 3. 一键登录并同步装扮与歌单
window.musicSyncWyyProfileAndPlaylists = async function() {
    if (!window.tempWyyProfile) return;
    
    const btn = document.querySelector('#music-modal-wyy-profile .wc-btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "正在同步...";
    btn.disabled = true;

    try {
        // 1. 同步装扮
        musicState.profile.name = window.tempWyyProfile.name;
        musicState.profile.avatar = window.tempWyyProfile.avatar;
        musicState.profile.bg = window.tempWyyProfile.bg;
        
        // 2. 批量导入歌单
        const playlists = window.tempWyyProfile.playlists;
        const baseUrl = getMusicApiBaseUrl();
        
        let successCount = 0;
        
        // 限制最多一键导入 10 个歌单，防止 API 封禁卡死
        const maxImport = Math.min(playlists.length, 10);
        
        for (let i = 0; i < maxImport; i++) {
            const pl = playlists[i];
            btn.innerText = `导入歌单 (${i+1}/${maxImport})...`;
            
            try {
                const resDetail = await fetch(`${baseUrl}/playlist/detail?id=${pl.id}`);
                const dataDetail = await resDetail.json();
                
                if (dataDetail.code === 200 && dataDetail.playlist) {
                    const resTracks = await fetch(`${baseUrl}/playlist/track/all?id=${pl.id}&limit=1000`);
                    const dataTracks = await resTracks.json();
                    
                    let tracks = [];
                    if (dataTracks.code === 200 && dataTracks.songs) {
                        tracks = dataTracks.songs.map(song => ({
                            id: song.id,
                            title: song.name,
                            artist: song.ar.map(a => a.name).join(', '),
                            cover: song.al.picUrl + '?param=100y100'
                        }));
                    }
                    
                    // 查重，防止重复导入
                    const exists = musicState.playlists.find(p => p.id === dataDetail.playlist.id);
                    if (!exists) {
                        musicState.playlists.push({
                            id: dataDetail.playlist.id,
                            name: dataDetail.playlist.name,
                            cover: dataDetail.playlist.coverImgUrl,
                            tracks: tracks
                        });
                        successCount++;
                    }
                }
            } catch (err) {
                console.warn(`歌单 ${pl.name} 导入失败`, err);
            }
        }
        
        musicSaveData();
        musicRenderProfile();
        
        wcCloseModal('music-modal-wyy-profile');
        
        if (playlists.length > 10) {
            alert(`登录成功！已同步头像、名称、背景，并成功导入前 ${successCount} 个歌单（为防止卡顿，最多一键导入10个，其余可手动导入）。`);
        } else {
            alert(`登录成功！已同步头像、名称、背景，并成功导入 ${successCount} 个歌单！`);
        }
        
    } catch (e) {
        console.error(e);
        alert("同步过程中发生错误");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// 3. 核心导入逻辑 (修复了 not defined 的报错)
window.musicImportSinglePlaylistById = async function(plId, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "导入中...";
    btnElement.disabled = true;
    btnElement.style.opacity = "0.5";

    try {
        const baseUrl = getMusicApiBaseUrl(); // 动态获取当前选择的音乐源
        
        // 1. 获取歌单详情
        const resDetail = await fetch(`${baseUrl}/playlist/detail?id=${plId}`);
        const dataDetail = await resDetail.json();
        
        if (dataDetail.code === 200 && dataDetail.playlist) {
            // 2. 获取歌单所有歌曲
            const resTracks = await fetch(`${baseUrl}/playlist/track/all?id=${plId}&limit=1000`);
            const dataTracks = await resTracks.json();
            
            let tracks = [];
            if (dataTracks.code === 200 && dataTracks.songs) {
                tracks = dataTracks.songs.map(song => ({
                    id: song.id,
                    title: song.name,
                    artist: song.ar.map(a => a.name).join(', '),
                    cover: song.al.picUrl + '?param=100y100'
                }));
            }
            
            musicState.playlists.push({
                id: dataDetail.playlist.id,
                name: dataDetail.playlist.name,
                cover: dataDetail.playlist.coverImgUrl,
                tracks: tracks
            });
            
            musicSaveData();
            musicRenderProfile();
            
            btnElement.innerText = "已导入";
            btnElement.style.background = "#34C759"; // 变成绿色
            btnElement.style.opacity = "1";
        } else {
            alert("获取歌单详情失败！");
            btnElement.innerText = originalText;
            btnElement.disabled = false;
            btnElement.style.opacity = "1";
        }
    } catch (e) {
        console.error(e);
        alert("导入失败，网络异常。");
        btnElement.innerText = originalText;
        btnElement.disabled = false;
        btnElement.style.opacity = "1";
    }
};

function musicDeletePlaylist(e, idx) {
    e.stopPropagation();
    if (confirm("Delete this playlist?")) {
        musicState.playlists.splice(idx, 1);
        musicSaveData();
        musicRenderProfile();
    }
}
// ==========================================
// 新增：解析链接并导入歌单逻辑
// ==========================================
window.musicImportPlaylist = async function() {
    const inputVal = document.getElementById('music-import-pl-link').value.trim();
    if (!inputVal) return alert("请输入网易云歌单链接或 ID！");

    let plId = "";
    // 尝试从链接中提取 ID (例如: https://music.163.com/playlist?id=123456789)
    const idMatch = inputVal.match(/id=(\d+)/);
    if (idMatch) {
        plId = idMatch[1];
    } else if (/^\d+$/.test(inputVal)) {
        // 纯数字 ID
        plId = inputVal;
    } else {
        return alert("无法识别歌单 ID，请检查链接格式。");
    }

    const btn = document.querySelector('#music-modal-import-playlist .wc-btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "正在解析并导入...";
    btn.disabled = true;

    try {
        const baseUrl = getMusicApiBaseUrl();
        
        // 1. 获取歌单详情
        const resDetail = await fetch(`${baseUrl}/playlist/detail?id=${plId}`);
        const dataDetail = await resDetail.json();
        
        if (dataDetail.code === 200 && dataDetail.playlist) {
            // 2. 获取歌单所有歌曲
            const resTracks = await fetch(`${baseUrl}/playlist/track/all?id=${plId}&limit=1000`);
            const dataTracks = await resTracks.json();
            
            let tracks = [];
            if (dataTracks.code === 200 && dataTracks.songs) {
                tracks = dataTracks.songs.map(song => ({
                    id: song.id,
                    title: song.name,
                    artist: song.ar.map(a => a.name).join(', '),
                    cover: song.al.picUrl + '?param=100y100'
                }));
            }
            
            // 查重，防止重复导入
            const exists = musicState.playlists.find(p => p.id === dataDetail.playlist.id);
            if (!exists) {
                musicState.playlists.push({
                    id: dataDetail.playlist.id,
                    name: dataDetail.playlist.name,
                    cover: dataDetail.playlist.coverImgUrl,
                    tracks: tracks
                });
                musicSaveData();
                musicRenderProfile();
                alert("导入成功！");
                wcCloseModal('music-modal-import-playlist');
                document.getElementById('music-import-pl-link').value = ''; // 清空输入框
            } else {
                alert("该歌单已存在，请勿重复导入！");
            }
        } else {
            alert("获取歌单详情失败，请确保歌单已在网易云设置为公开！");
        }
    } catch (e) {
        console.error(e);
        alert("导入失败，网络异常或接口不可用。");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// --- 歌单内歌曲管理 ---
function musicOpenPlaylistDetail(idx) {
    const pl = musicState.playlists[idx];
    if (!pl) return;
    
    document.getElementById('music-detail-pl-name').innerText = pl.name;
    const container = document.getElementById('music-detail-pl-tracks');
    container.innerHTML = '';
    
    if (!pl.tracks || pl.tracks.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No songs in this playlist.</div>';
    } else {
        pl.tracks.forEach((song, songIdx) => {
            const item = document.createElement('div');
            item.className = 'ins-music-song-item';
            item.innerHTML = `
                <img src="${song.cover}" class="ins-music-song-cover">
                <div class="ins-music-song-info">
                    <div class="ins-music-song-title">${song.title}</div>
                    <div class="ins-music-song-artist">${song.artist}</div>
                </div>
                <div class="ins-music-btn-icon" style="background: transparent; border: none; color: #FF3B30;" onclick="musicRemoveFromPlaylist(event, ${idx}, ${songIdx})">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </div>
            `;
            item.onclick = () => {
                // 将当前歌单设为播放列表
                musicState.currentPlaylist = [...pl.tracks];
                musicState.currentIndex = songIdx;
                musicPlaySong(song.id, song.title, song.artist, song.cover);
            };
            container.appendChild(item);
        });
    }
    
    wcOpenModal('music-modal-playlist-detail');
}

function musicRemoveFromPlaylist(e, plIdx, songIdx) {
    e.stopPropagation();
    if (confirm("Remove this song from playlist?")) {
        musicState.playlists[plIdx].tracks.splice(songIdx, 1);
        musicSaveData();
        musicRenderProfile();
        musicOpenPlaylistDetail(plIdx); // 刷新列表
    }
}

function musicOpenAddToPlaylist(songObj = null) {
    // 如果传入了 songObj，说明是从搜索列表点的；否则默认用当前播放的歌
    const targetSong = songObj || musicState.currentSong;
    
    if (!targetSong) return alert("No song selected.");
    
    musicState.pendingAddSong = targetSong; // 暂存这首歌
    
    const container = document.getElementById('music-add-to-pl-list');
    container.innerHTML = '';
    
    if (musicState.playlists.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No playlists available. Create one first.</div>';
    } else {
        musicState.playlists.forEach((pl, idx) => {
            const item = document.createElement('div');
            item.className = 'ins-music-playlist-card';
            item.style.marginBottom = '10px';
            item.innerHTML = `
                <img src="${pl.cover}" class="ins-music-playlist-cover" style="width: 40px; height: 40px;">
                <div class="ins-music-playlist-info">
                    <div class="ins-music-playlist-name" style="font-size: 14px;">${pl.name}</div>
                </div>
            `;
            item.onclick = () => musicAddSongToPlaylist(idx);
            container.appendChild(item);
        });
    }
    
    wcOpenModal('music-modal-add-to-playlist');
}

function musicAddSongToPlaylist(plIdx) {
    const pl = musicState.playlists[plIdx];
    const song = musicState.pendingAddSong; // 使用暂存的歌曲
    
    if (!song) return;
    if (!pl.tracks) pl.tracks = [];
    
    // 检查是否已存在
    if (pl.tracks.find(s => s.id === song.id)) {
        alert("Song is already in this playlist.");
    } else {
        pl.tracks.push({
            id: song.id,
            title: song.title,
            artist: song.artist,
            cover: song.cover
        });
        musicSaveData();
        musicRenderProfile();
        alert("Added to playlist!");
    }
    
    wcCloseModal('music-modal-add-to-playlist');
    musicState.pendingAddSong = null; // 清空暂存
}
// ==========================================
// 音乐播放器迷你聊天功能
// ==========================================
// 【修复】：接收事件参数 e，并阻止默认跳转行为
function musicToggleChatWindow(e) {
    // 拦截默认点击事件，防止页面闪烁跳动
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (!musicState.listenTogether.active || !musicState.listenTogether.charId) {
        alert("请先在发现页邀请一位角色一起听歌哦~");
        return;
    }
    const chatWin = document.getElementById('music-chat-window');
    if (chatWin.style.display === 'none' || chatWin.style.display === '') {
        chatWin.style.display = 'flex';
        musicRenderChatMessages();
    } else {
        chatWin.style.display = 'none';
    }
}

function musicRenderChatMessages() {
    const charId = musicState.listenTogether.charId;
    if (!charId) return;
    
    const container = document.getElementById('music-chat-history');
    container.innerHTML = '';
    
    const msgs = wcState.chats[charId] || [];
    const recentMsgs = msgs.slice(-20); 
    
    recentMsgs.forEach(msg => {
        if (msg.hidden || msg.type === 'system') return; 
        
        const div = document.createElement('div');
        div.className = `music-chat-msg ${msg.sender === 'me' ? 'me' : 'them'}`;
        
        // 支持渲染表情包和图片
        if (msg.type === 'sticker' || msg.type === 'image') {
            div.innerHTML = `<img src="${msg.content}" style="max-width: 120px; border-radius: 8px; display: block;">`;
            div.style.background = 'transparent';
            div.style.padding = '0';
        } else if (msg.type === 'voice') {
            div.innerText = '[语音]';
        } else if (msg.type === 'transfer') {
            div.innerText = '[转账]';
        } else if (msg.type === 'music_invite') {
            div.innerText = '[听歌邀请]';
        } else {
            div.innerText = msg.content;
        }
        
        container.appendChild(div);
    });
    
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function musicHandleChatEnter(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); // 【关键修复】：阻止默认回车事件，防止页面刷新卡跳
        musicSendChatMessage();
    }
}

function musicSendChatMessage() {
    const input = document.getElementById('music-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    const charId = musicState.listenTogether.charId;
    if (!charId) return;
    
    wcAddMessage(charId, 'me', 'text', text);
    input.value = '';
    musicRenderChatMessages();
    
    // 删除了 musicTriggerAI(); 这样发完消息就不会自动触发AI了，必须手动点AI回复按钮
}

function musicTriggerAI() {
    const charId = musicState.listenTogether.charId;
    if (!charId) return;
    
    // 【修复】：如果已经在生成中，就不再添加 loading 提示
    if (aiGeneratingLocks[charId]) return;
    
    // 添加一个临时的“正在输入”状态
    const container = document.getElementById('music-chat-history');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'music-chat-msg them';
    loadingDiv.id = 'music-chat-loading'; // 【修复】：加上 ID 以便后续移除
    loadingDiv.innerText = '正在输入...';
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;

    wcTriggerAI(charId);
}
// ==========================================
// 新增：AI 音乐控制支撑函数
// ==========================================

// AI 搜索歌曲逻辑 (返回结果给AI筛选)
async function musicCharSearch(charId, keyword) {
    if (!keyword) return;
    try {
        let songsList = [];
        
        const baseUrl = getMusicApiBaseUrl();
        const res = await fetch(`${baseUrl}/cloudsearch?keywords=${encodeURIComponent(keyword)}`);
        const data = await res.json();
        if (data.code === 200 && data.result && data.result.songs && data.result.songs.length > 0) {
            songsList = data.result.songs.slice(0, 5).map(song => ({
                id: song.id,
                name: song.name,
                artist: song.ar.map(a => a.name).join(', ')
            }));
        }
        
        if (songsList.length > 0) {
            let resultText = `[系统内部信息(仅AI可见): 搜索 "${keyword}" 的结果如下：\n`;
            songsList.forEach((song, index) => {
                resultText += `${index + 1}. ID: ${song.id}, 歌名: ${song.name}, 歌手: ${song.artist}\n`;
            });
            resultText += `请仔细核对歌名和歌手，筛选出正确的版本，然后使用 {"type":"music_play_selected", "songId": 对应的ID, "songName": "歌名"} 指令来播放，或者使用 {"type":"music_add_selected", "songId": 对应的ID, "songName": "歌名"} 指令来添加到播放列表。]`;
            
            wcAddMessage(charId, 'system', 'system', resultText, { hidden: true });
            
            setTimeout(() => {
                wcTriggerAI(charId);
            }, 1500);
        } else {
            wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): 未找到关于 "${keyword}" 的歌曲，请换个关键词重新搜索。]`, { hidden: true });
            setTimeout(() => {
                wcTriggerAI(charId);
            }, 1500);
        }
    } catch (e) {
        console.error("AI 搜索失败", e);
        wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): 搜索失败，网络异常。]`, { hidden: true });
    }
}

// AI 添加选定歌曲到列表逻辑
async function musicCharAddSelected(charId, songId, songName) {
    if (!songId) return;
    try {
        let newSong = null;
        
        const baseUrl = getMusicApiBaseUrl();
        const res = await fetch(`${baseUrl}/song/detail?ids=${songId}`);
        const data = await res.json();
        
        if (data.code === 200 && data.songs && data.songs.length > 0) {
            const song = data.songs[0];
            newSong = {
                id: song.id,
                title: song.name,
                artist: song.ar.map(a => a.name).join(', '),
                cover: song.al.picUrl + '?param=100y100'
            };
        }
        
        if (newSong) {
            musicState.currentPlaylist.push(newSong);
            wcAddMessage(charId, 'system', 'system', `[系统提示: ${wcState.characters.find(c=>c.id===charId).name} 将《${newSong.title}》- ${newSong.artist} 加入了播放列表]`, { style: 'transparent' });
        } else {
            wcAddMessage(charId, 'system', 'system', `[系统提示: 歌曲获取失败]`, { style: 'transparent' });
        }
    } catch (e) {
        console.error("AI 添加选中歌曲失败", e);
    }
}

// AI 播放选定歌曲逻辑
async function musicCharPlaySelected(charId, songId, songName) {
    if (!songId) return;
    try {
        let newSong = null;
        
        const baseUrl = getMusicApiBaseUrl();
        const res = await fetch(`${baseUrl}/song/detail?ids=${songId}`);
        const data = await res.json();
        
        if (data.code === 200 && data.songs && data.songs.length > 0) {
            const song = data.songs[0];
            newSong = {
                id: song.id,
                title: song.name,
                artist: song.ar.map(a => a.name).join(', '),
                cover: song.al.picUrl + '?param=100y100'
            };
        }
        
        if (newSong) {
            musicState.currentPlaylist.push(newSong);
            musicState.currentIndex = musicState.currentPlaylist.length - 1;
            musicPlaySong(newSong.id, newSong.title, newSong.artist, newSong.cover);
            
            wcAddMessage(charId, 'system', 'system', `[系统提示: ${wcState.characters.find(c=>c.id===charId).name} 为你点播了《${newSong.title}》- ${newSong.artist}]`, { style: 'transparent' });
        } else {
            wcAddMessage(charId, 'system', 'system', `[系统提示: 歌曲获取失败]`, { style: 'transparent' });
        }
    } catch (e) {
        console.error("AI 播放选中歌曲失败", e);
    }
}

// AI 强制退出一起听歌 (不弹确认框)
function musicForceStopListenTogether(charId) {
    const sessionDurationMs = Date.now() - musicState.listenTogether.startTime;
    const sessionSeconds = Math.floor(sessionDurationMs / 1000);
    musicState.listenTogether.totalListenSeconds = (musicState.listenTogether.totalListenSeconds || 0) + sessionSeconds;
    
    const summaryData = {
        startTime: musicState.listenTogether.startTime,
        endTime: Date.now(),
        durationMs: sessionDurationMs,
        songCount: musicState.listenTogether.sessionSongCount || 1
    };

    if (charId && wcState.chats[charId]) {
        const msgs = wcState.chats[charId];
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].type === 'music_invite' && msgs[i].status !== 'ended') {
                msgs[i].status = 'ended';
                msgs[i].summaryData = summaryData;
                break;
            }
        }
    }

    musicState.listenTogether.active = false;
    musicState.listenTogether.charId = null;
    musicState.listenTogether.sessionSongCount = 0;
    clearInterval(musicState.listenTogether.timerInterval);
    
    const togetherEl = document.getElementById('music-fp-together');
    if (togetherEl) togetherEl.style.display = 'none';
    
    musicSaveData();
    wcSaveData();
    if (charId === wcState.activeChatId) wcRenderMessages(charId);

    wcAddMessage(charId, 'system', 'system', `[系统提示: 对方已退出一起听歌]`, { style: 'transparent' });
}

// ==========================================
// 新增：处理 AI 主动邀请用户的弹窗逻辑
// ==========================================
let pendingCharInviteData = null;

function musicShowCharInviteModal(charId, songName) {
    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    pendingCharInviteData = { charId: charId, songName: songName };

    document.getElementById('char-invite-avatar').src = char.avatar;
    document.getElementById('char-invite-name').innerText = char.name;

    const songBox = document.getElementById('char-invite-song-box');
    if (songName) {
        document.getElementById('char-invite-song-name').innerText = songName;
        songBox.style.display = 'flex';
    } else {
        songBox.style.display = 'none';
    }

    const modal = document.getElementById('music-char-invite-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function musicRejectCharInvite() {
    const modal = document.getElementById('music-char-invite-modal');
    modal.classList.add('hidden');
    setTimeout(() => modal.style.display = 'none', 300); // 等待动画结束

    if (pendingCharInviteData) {
        const charId = pendingCharInviteData.charId;
        
        // 👇 新增：找到聊天记录中最近的一条邀请卡片，改为 rejected 并附上空的总结数据
        if (wcState.chats[charId]) {
            const msgs = wcState.chats[charId];
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].type === 'music_invite' && msgs[i].status === 'pending') {
                    msgs[i].status = 'rejected';
                    msgs[i].summaryData = {
                        startTime: Date.now(),
                        endTime: Date.now(),
                        durationMs: 0,
                        songCount: 0,
                        isRejected: true // 标记为已拒绝
                    };
                    break;
                }
            }
            wcSaveData();
            if (charId === wcState.activeChatId) wcRenderMessages(charId); // 刷新聊天界面卡片
        }
        // 👆 新增结束

        // 【修复】：不发送可见的文本消息，改为发送隐藏的系统提示给 AI
        wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): 用户婉拒了你的听歌邀请。]`, { hidden: true });
        // 🔪 删除了 wcTriggerAI(charId); 不再自动调取 API 回复
        pendingCharInviteData = null;
    }
}

// 新增：后台静默搜索并播放的辅助函数
async function musicSilentSearchAndPlay(keyword) {
    if (!keyword) return false;
    try {
        const baseUrl = getMusicApiBaseUrl();
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
            if (!musicState.currentPlaylist) musicState.currentPlaylist = [];
            musicState.currentPlaylist.push(newSong);
            musicState.currentIndex = musicState.currentPlaylist.length - 1;
            musicPlaySong(newSong.id, newSong.title, newSong.artist, newSong.cover);
            return true;
        }
    } catch (e) {
        console.error("静默搜索失败", e);
    }
    return false;
}

async function musicAcceptCharInvite() {
    const modal = document.getElementById('music-char-invite-modal');
    modal.classList.add('hidden');
    setTimeout(() => modal.style.display = 'none', 300);

    if (pendingCharInviteData) {
        const charId = pendingCharInviteData.charId;
        const songName = pendingCharInviteData.songName;
        
        wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): 用户接受了你的听歌邀请，你们现在正在一起听歌。]`, { hidden: true });
        
        openMusicApp();
        musicStartListenTogether(charId);
        musicOpenFullPlayer();

        let playSuccess = false;

        // 1. 第一重：尝试搜索 AI 指定的歌曲
        if (songName && songName !== '随机推荐') {
            playSuccess = await musicSilentSearchAndPlay(songName);
        }

        // 2. 第二重兜底：如果没搜到，从 Char 手机的“最近常听”歌单里随机挑一首
        if (!playSuccess) {
            const char = wcState.characters.find(c => c.id === charId);
            if (char && char.phoneData && char.phoneData.settings && char.phoneData.settings.playlist && char.phoneData.settings.playlist.length > 0) {
                const charPlaylist = char.phoneData.settings.playlist;
                const randomSong = charPlaylist[Math.floor(Math.random() * charPlaylist.length)];
                
                playSuccess = await musicSilentSearchAndPlay(`${randomSong.title} ${randomSong.artist}`);
                if (playSuccess) {
                    wcAddMessage(charId, 'system', 'system', `[系统提示: 由于之前指定的歌曲未找到，系统自动从你的常听歌单中随机播放了《${randomSong.title}》]`, { style: 'transparent' });
                }
            }
        }

        // 3. 第三重兜底：如果 Char 没歌单，从 User 的全局歌单里随机挑一首
        if (!playSuccess && musicState.playlists && musicState.playlists.length > 0) {
            const validPlaylists = musicState.playlists.filter(pl => pl.tracks && pl.tracks.length > 0);
            if (validPlaylists.length > 0) {
                const randomPl = validPlaylists[Math.floor(Math.random() * validPlaylists.length)];
                const randomSong = randomPl.tracks[Math.floor(Math.random() * randomPl.tracks.length)];
                
                musicState.currentPlaylist = [...randomPl.tracks];
                const songIdx = randomPl.tracks.findIndex(s => s.id === randomSong.id);
                musicState.currentIndex = songIdx !== -1 ? songIdx : 0;
                
                musicPlaySong(randomSong.id, randomSong.title, randomSong.artist, randomSong.cover);
                playSuccess = true;
                wcAddMessage(charId, 'system', 'system', `[系统提示: 系统自动从 User 的歌单中随机播放了《${randomSong.title}》]`, { style: 'transparent' });
            }
        }

        // 4. 终极提示：如果连 User 都没有歌单，只能提示手动点播了
        if (!playSuccess) {
            alert("抱歉宝宝，Ta 推荐的歌曲未找到，且你们都没有预设歌单。请手动搜索播放一首歌曲吧~");
        }
        
        pendingCharInviteData = null;
    }
}
// ==========================================
// 音乐胶囊 (Music Capsule) 逻辑 (完美修复版)
// ==========================================

let isCapsuleEnabled = false;
let isCapsuleExpanded = false;
let capsuleToggleLock = false; // 节流锁，防止短时间内重复触发导致闪烁

// 拖拽相关变量
let capDrag = { active: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0, moved: false, isTouch: false };

// 4. 拖拽与点击逻辑初始化
document.addEventListener('DOMContentLoaded', () => {
    const capsule = document.getElementById('floating-music-capsule');
    if (!capsule) return;

    capsule.addEventListener('mousedown', startCapsuleDrag);
    capsule.addEventListener('touchstart', startCapsuleDrag, { passive: false });
    
    // 点击外部空白处自动收起胶囊
    document.addEventListener('click', (e) => {
        if (isCapsuleExpanded && capsule && !capsule.contains(e.target)) {
            toggleMusicCapsuleExpand(); // <--- 修改这里
      
        }
    });
});

let lastCapsuleTouchEndTime = 0;

function startCapsuleDrag(e) {
    // 如果点击的是下拉播放器内部，不触发拖拽
    if (e.target.closest('#capsule-dropdown-player')) return;
    if (e.target.closest('.capsule-btn')) return;

    // 防止 touchend 触发的模拟 mousedown 导致重复执行
    if (e.type === 'mousedown' && Date.now() - lastCapsuleTouchEndTime < 500) {
        return;
    }   

    const isTouch = e.type === 'touchstart';
    const touch = isTouch ? e.touches[0] : e;
    
    capDrag.active = true;
    capDrag.moved = false;
    capDrag.startX = touch.clientX;
    capDrag.startY = touch.clientY;
    capDrag.isTouch = isTouch;
    
    const capsule = document.getElementById('floating-music-capsule');
    const rect = capsule.getBoundingClientRect();
    
    // 记录初始位置 (去除 transform 的影响，改用绝对 left/top)
    capDrag.initialLeft = rect.left;
    capDrag.initialTop = rect.top;
    
    capsule.style.transform = 'none';
    capsule.style.left = rect.left + 'px';
    capsule.style.top = rect.top + 'px';
    capsule.style.transition = 'none'; // 拖拽时取消动画，保证跟手

    // 根据事件类型，分别绑定对应的移动和结束事件
    if (isTouch) {
        document.addEventListener('touchmove', onCapsuleDrag, { passive: false });
        document.addEventListener('touchend', endCapsuleDrag);
    } else {
        document.addEventListener('mousemove', onCapsuleDrag);
        document.addEventListener('mouseup', endCapsuleDrag);
    }
}

function onCapsuleDrag(e) {
    if (!capDrag.active) return;
    
    const touch = capDrag.isTouch ? e.touches[0] : e;
    const dx = touch.clientX - capDrag.startX;
    const dy = touch.clientY - capDrag.startY;
    
    // 如果移动距离超过 5px，判定为拖拽而不是点击
// 修改为：
if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
    capDrag.moved = true;
    if (e.cancelable) { e.preventDefault(); }
}

    
    if (capDrag.moved) {
        const capsule = document.getElementById('floating-music-capsule');
        
        // 边界限制
        let newLeft = capDrag.initialLeft + dx;
        let newTop = capDrag.initialTop + dy;
        const maxLeft = window.innerWidth - capsule.offsetWidth;
        const maxTop = window.innerHeight - capsule.offsetHeight;
        
        if (newLeft < 0) newLeft = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop < 0) newTop = 0;
        if (newTop > maxTop) newTop = maxTop;

        capsule.style.left = newLeft + 'px';
        capsule.style.top = newTop + 'px';
    }
}
function endCapsuleDrag(e) {
    if (!capDrag.active) return;
    capDrag.active = false;
    
    // 如果是触摸事件，记录结束时间，用于拦截后续的模拟鼠标事件
    if (capDrag.isTouch) {
        lastCapsuleTouchEndTime = Date.now();
    }
    
    const capsule = document.getElementById('floating-music-capsule');
    // 恢复动画属性
    capsule.style.transition = 'width 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s cubic-bezier(0.25, 1, 0.5, 1), border-radius 0.4s cubic-bezier(0.25, 1, 0.5, 1), background 0.4s ease';
    
    // 移除对应的事件监听
    if (capDrag.isTouch) {
        document.removeEventListener('touchmove', onCapsuleDrag);
        document.removeEventListener('touchend', endCapsuleDrag);
    } else {
        document.removeEventListener('mousemove', onCapsuleDrag);
        document.removeEventListener('mouseup', endCapsuleDrag);
    }

    // 如果没有移动（即纯点击），则触发展开/收起
    if (!capDrag.moved) {
        // 【核心修复】：阻止事件冒泡，防止触发 document 的 click 事件导致立即收起
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
        toggleMusicCapsuleExpand(); // <--- 修改这里
    }
}


// 5. 胶囊内部的控制按钮逻辑
function capsuleTogglePlay(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    musicTogglePlay(); // 复用已有的播放/暂停逻辑
}

function capsulePlayNext(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    musicPlayNext(); // 复用已有的下一首逻辑
}

function capsulePlayPrev(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    musicPlayPrev(); // 复用已有的上一首逻辑
}

// 胶囊展开/收起逻辑
function toggleMusicCapsuleExpand() {
    if (capsuleToggleLock) return;
    capsuleToggleLock = true;
    setTimeout(() => { capsuleToggleLock = false; }, 300);

    const dropdown = document.getElementById('capsule-dropdown-player');
    if (!dropdown) return;
    
    if (dropdown.classList.contains('active')) {
        // 收起
        dropdown.classList.remove('active');
        isCapsuleExpanded = false;
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 300);
    } else {
        // 展开
        dropdown.classList.remove('hidden');
        isCapsuleExpanded = true;
        void dropdown.offsetWidth; // 强制重绘
        dropdown.classList.add('active');
    }
}

// 胶囊开关逻辑
function toggleMusicCapsule() {
    const toggle = document.getElementById('music-capsule-toggle');
    const capsule = document.getElementById('floating-music-capsule');
    
    if (!capsule || !toggle) return;

    if (toggle.classList.contains('active')) {
        // 关闭胶囊
        toggle.classList.remove('active');
        capsule.classList.add('hidden');
        isCapsuleEnabled = false;
        // 如果关闭时是展开状态，将其复原收起
        if (isCapsuleExpanded) {
            toggleMusicCapsuleExpand();
        }
    } else {
        // 开启胶囊
        if (musicState.currentSong) {
            toggle.classList.add('active');
            capsule.classList.remove('hidden');
            isCapsuleEnabled = true;
            musicUpdateCapsuleUI();
        } else {
            alert("请先播放一首歌曲");
        }
    }
}

// 更新胶囊 UI
function musicUpdateCapsuleUI() {
    const capsule = document.getElementById('floating-music-capsule');
    if (!capsule) return;
    
    if (!musicState.currentSong) {
        capsule.classList.add('hidden');
        return;
    }
    
    // 如果胶囊开关打开，则显示
    const toggle = document.getElementById('music-capsule-toggle');
    if (toggle && toggle.classList.contains('active')) {
        capsule.classList.remove('hidden');
    }
    
    // 更新收起状态
    document.getElementById('capsule-island-cover').src = musicState.currentSong.cover;
    if (musicState.isPlaying) {
        capsule.classList.remove('paused');
    } else {
        capsule.classList.add('paused');
    }
    
    // 更新一起听歌时长和头像
    const timerEl = document.getElementById('capsule-timer');
    if (musicState.listenTogether.active && musicState.listenTogether.charId) {
        timerEl.style.display = 'block';
        // 头像
        document.getElementById('capsule-exp-cover').style.display = 'none';
        document.getElementById('capsule-exp-avatars').style.display = 'flex';
        
        const char = wcState.characters.find(c => c.id === musicState.listenTogether.charId);
        const userAvatar = (char && char.chatConfig && char.chatConfig.userAvatar) ? char.chatConfig.userAvatar : wcState.user.avatar;
        document.getElementById('capsule-exp-avatar-user').src = userAvatar;
        document.getElementById('capsule-exp-avatar-char').src = char ? char.avatar : '';
    } else {
        timerEl.style.display = 'none';
        // 封面
        document.getElementById('capsule-exp-cover').style.display = 'block';
        document.getElementById('capsule-exp-avatars').style.display = 'none';
        document.getElementById('capsule-exp-cover').src = musicState.currentSong.cover;
    }    
// 修改为：
const capTitle = document.getElementById('capsule-exp-title');
const capArtist = document.getElementById('capsule-exp-artist');
if (capTitle) capTitle.innerText = musicState.currentSong.title;
if (capArtist) capArtist.innerText = musicState.currentSong.artist;
    
    const playBtn = document.getElementById('capsule-btn-play');
    const pauseIcon = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    const playIcon = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    playBtn.innerHTML = musicState.isPlaying ? pauseIcon : playIcon;
    
    // 播放模式
    const modeBtn = document.getElementById('capsule-btn-mode');
    if (musicState.playMode === 'loop') {
        modeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>';
    } else if (musicState.playMode === 'single') {
        modeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/></svg>';
    } else if (musicState.playMode === 'random') {
        modeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>';
    }
}
// 1. 定义全局变量记录当前使用的接口 (使用 localStorage 保存，刷新不重置)
let currentMusicApi = localStorage.getItem('ins_music_api_preference') || 'primary'; // 'primary', 'secondary' 或 'tertiary'
let currentMusicPlayApi = localStorage.getItem('ins_music_play_api_preference') || 'miemie';

// 获取当前音乐接口的 BaseUrl
function getMusicApiBaseUrl() {
    if (currentMusicApi === 'secondary') return 'https://ncmapi.btwoa.com';
    if (currentMusicApi === 'tertiary') return 'https://ncm.zhenxin.me'; 
    if (currentMusicApi === 'api4') return 'https://api-music.kingcola-icg.cn'; // 👉 替换为真实的第四个接口
    if (currentMusicApi === 'api5') return 'https://neteaseapi.gksm.store'; // 👉 替换为真实的第五个接口
    return 'https://zm.wwoyun.cn'; // primary
}

function getMusicPlayApiBaseUrl() {
    if (currentMusicPlayApi === 'zhizhi') return 'https://api.msls1441.com';
    return 'https://api.qijieya.cn/meting'; // miemie
}

function musicToggleApiTab(tab) {
    document.getElementById('music-seg-search-api').classList.toggle('active', tab === 'search');
    document.getElementById('music-seg-play-api').classList.toggle('active', tab === 'play');
    document.getElementById('music-area-search-api').style.display = tab === 'search' ? 'block' : 'none';
    document.getElementById('music-area-play-api').style.display = tab === 'play' ? 'block' : 'none';
}

function musicSetPlayApi(apiType) {
    currentMusicPlayApi = apiType;
    localStorage.setItem('ins_music_play_api_preference', apiType);
    wcCloseModal('music-modal-api-toggle');
    
    let apiName = apiType === 'zhizhi' ? '吱吱源' : '咩咩源';
    if(typeof showIosNotification === 'function') {
        showIosNotification('播放源已切换', `当前正在使用: ${apiName}`);
    } else {
        alert(`已切换播放源至: ${apiName}`);
    }
}

// 2. 打开切换弹窗
function musicOpenApiToggleModal() {
    // 更新搜索接口选中状态
    document.getElementById('music-api-primary-text').style.color = currentMusicApi === 'primary' ? '#007AFF' : '#111';
    document.getElementById('music-api-secondary-text').style.color = currentMusicApi === 'secondary' ? '#007AFF' : '#111';
    
    const tertiaryText = document.getElementById('music-api-tertiary-text');
    if (tertiaryText) tertiaryText.style.color = currentMusicApi === 'tertiary' ? '#007AFF' : '#111';
    
    const api4Text = document.getElementById('music-api-api4-text');
    if (api4Text) api4Text.style.color = currentMusicApi === 'api4' ? '#007AFF' : '#111';
    
    const api5Text = document.getElementById('music-api-api5-text');
    if (api5Text) api5Text.style.color = currentMusicApi === 'api5' ? '#007AFF' : '#111';
    
    // 更新播放源选中状态
    const miemieText = document.getElementById('music-play-api-miemie-text');
    if (miemieText) miemieText.style.color = currentMusicPlayApi === 'miemie' ? '#007AFF' : '#111';
    const zhizhiText = document.getElementById('music-play-api-zhizhi-text');
    if (zhizhiText) zhizhiText.style.color = currentMusicPlayApi === 'zhizhi' ? '#007AFF' : '#111';
    
    // 默认显示搜索接口 tab
    musicToggleApiTab('search');
    
    wcOpenModal('music-modal-api-toggle');
}

// 3. 设置接口并关闭弹窗
function musicSetApi(apiType) {
    currentMusicApi = apiType;
    localStorage.setItem('ins_music_api_preference', apiType); // 保存到本地
    wcCloseModal('music-modal-api-toggle');
    
    // 提示用户
    let apiName = '小狗源';
    if (apiType === 'secondary') apiName = '小猫源';
    if (apiType === 'tertiary') apiName = '小元源';
    if (apiType === 'api4') apiName = '小兔源';
    if (apiType === 'api5') apiName = '小鱼源';
    
    if(typeof showIosNotification === 'function') {
        showIosNotification('音乐接口已切换', `当前正在使用: ${apiName}`);
    } else {
        alert(`已切换至: ${apiName}`);
    }
}

