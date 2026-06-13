// sw.js - 离线邮递员 (暴力兜底版)

self.addEventListener('push', function(event) {
    // 准备一个绝对不会失败的兜底通知
    const fallbackNotification = self.registration.showNotification("小元机", {
        body: "你有一条新消息 (点击查看)",
        icon: "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg",
        badge: "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg",
        vibrate: [200, 100, 200],
        tag: 'offline-msg-fallback-' + Date.now(),
        data: { url: '/' }
    });

    const fetchPromise = caches.open('app-config-cache')
        .then(cache => cache.match('/current-device-id'))
        .then(response => {
            if (response) return response.text();
            return null;
        })
        .then(deviceId => {
            let fetchUrl = 'https://honey-offline-brain.xingyan067.workers.dev/get-latest-push';
            if (deviceId) {
                fetchUrl += `?deviceId=${deviceId}`;
            }
            
            return fetch(fetchUrl)
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => {
                const options = {
                    body: data.body || "你有一条新消息",
                    icon: data.icon || "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg",
                    badge: data.icon || "https://i.postimg.cc/yYrDHvG5/mmexport1766982633245.jpg",
                    vibrate: [200, 100, 200],
                    tag: 'offline-msg-' + Date.now(),
                    data: { url: '/' }
                };
                return self.registration.showNotification(data.title || "小元机", options);
            });
        })
        .catch(err => {
            console.error("拉取最新推送内容失败，启用兜底通知", err);
            return fallbackNotification;
        });

    event.waitUntil(fetchPromise);
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close(); 
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
