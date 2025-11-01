const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'wishes.json');

// 中间件配置
app.use(express.json());
app.use(express.static(__dirname));

// 存储所有约定的数组
let wishes = [];

// 初始化数据文件
async function initializeData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        wishes = JSON.parse(data);
        console.log(`已加载 ${wishes.length} 个约定`);
    } catch (error) {
        console.log('未找到数据文件，创建新文件');
        wishes = [];
        await saveData();
    }
}

// 保存数据到文件
async function saveData() {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(wishes, null, 2));
        console.log(`已保存 ${wishes.length} 个约定到文件`);
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// WebSocket连接管理
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('新客户端连接，当前连接数:', clients.size);
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('客户端断开连接，当前连接数:', clients.size);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
        clients.delete(ws);
    });
});

// 广播新约定给所有连接的客户端
function broadcastNewWish(wish) {
    const message = JSON.stringify({
        type: 'new_wish',
        wish: wish
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error('发送消息失败:', error);
                clients.delete(client);
            }
        }
    });
}

// API路由

// 获取所有约定
app.get('/api/wishes', (req, res) => {
    res.json(wishes);
});

// 请求限制 - 防止短时间内重复提交
const submissionCache = new Map();

// 提交新约定
app.post('/api/submit-wish', async (req, res) => {
    try {
        const { name, wish } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        
        // 验证输入
        if (!name || !wish) {
            return res.status(400).json({ error: 'Name and wish cannot be empty' });
        }
        
        if (name.length > 50) {
            return res.status(400).json({ error: 'Name cannot exceed 50 characters' });
        }
        
        if (wish.length > 500) {
            return res.status(400).json({ error: 'Wish cannot exceed 500 characters' });
        }
        
        // 防止短时间内重复提交（5秒内同一IP只能提交一次）
        const cacheKey = `${clientIP}_${name.trim()}`;
        const lastSubmission = submissionCache.get(cacheKey);
        const now = Date.now();
        
        if (lastSubmission && (now - lastSubmission) < 5000) {
            return res.status(429).json({ error: 'Please wait before submitting again' });
        }
        
        submissionCache.set(cacheKey, now);
        
        // 清理过期的缓存（保留最近10分钟的记录）
        for (const [key, timestamp] of submissionCache.entries()) {
            if (now - timestamp > 600000) { // 10分钟
                submissionCache.delete(key);
            }
        }
        
        // 创建新约定对象
        const newWish = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            wish: wish.trim(),
            timestamp: new Date().toISOString(),
            ip: clientIP
        };
        
        // 添加到约定列表
        wishes.push(newWish);
        
        // 异步保存到文件（不阻塞响应）
        saveData().catch(error => {
            console.error('异步保存数据失败:', error);
        });
        
        // 异步广播给所有连接的客户端（不阻塞响应）
        setImmediate(() => {
            broadcastNewWish(newWish);
        });
        
        console.log(`收到新约定: ${newWish.name} - ${newWish.wish.substring(0, 50)}...`);
        
        res.json({ 
            success: true, 
            message: 'Wish submitted successfully',
            id: newWish.id
        });
        
    } catch (error) {
        console.error('提交约定失败:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 生成二维码
app.get('/api/qrcode', async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const qrCodeData = await QRCode.toDataURL(baseUrl);
        
        res.json({
            success: true,
            qrcode: qrCodeData,
            url: baseUrl
        });
    } catch (error) {
        console.error('生成二维码失败:', error);
        res.status(500).json({ error: '生成二维码失败' });
    }
});

// 获取统计信息
app.get('/api/stats', (req, res) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayWishes = wishes.filter(wish => 
        new Date(wish.timestamp) >= today
    );
    
    // 分析热门关键词
    const wordFrequency = {};
    const stopWords = new Set(['的', '在', '和', '是', '我', '了', '有', '就', '都', '会', '说', '他', '她', '它', '这', '那', '一个', '能够', '可以', '希望', '愿望', '祝福']);
    
    wishes.forEach(wish => {
        const words = wish.wish.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        words.forEach(word => {
            if (!stopWords.has(word) && word.length >= 2) {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
        });
    });
    
    const topWords = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
    
    res.json({
        total: wishes.length,
        today: todayWishes.length,
        topWords: topWords,
        recentWishes: wishes.slice(-5).reverse()
    });
});

// 管理员页面 - 获取所有约定（带分页）
app.get('/api/admin/wishes', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedWishes = wishes
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(startIndex, endIndex);
    
    res.json({
        wishes: paginatedWishes,
        total: wishes.length,
        page: page,
        totalPages: Math.ceil(wishes.length / limit)
    });
});

// 删除约定（管理员功能）
app.delete('/api/admin/wishes/:id', async (req, res) => {
    try {
        const wishId = req.params.id;
        const initialLength = wishes.length;
        
        wishes = wishes.filter(wish => wish.id !== wishId);
        
        if (wishes.length < initialLength) {
            await saveData();
            res.json({ success: true, message: '约定已删除' });
        } else {
            res.status(404).json({ error: '未找到指定的约定' });
        }
    } catch (error) {
        console.error('删除约定失败:', error);
        res.status(500).json({ error: '删除失败' });
    }
});

// 导入愿望数据（管理员功能）
app.post('/api/admin/import-wishes', async (req, res) => {
    try {
        const { wishes: importedWishes } = req.body;
        
        if (!Array.isArray(importedWishes)) {
            return res.status(400).json({ error: '数据格式错误' });
        }
        
        // 验证导入的数据格式
        for (const wish of importedWishes) {
            if (!wish.name || !wish.wish || !wish.timestamp) {
                return res.status(400).json({ error: '数据格式不完整' });
            }
        }
        
        // 为导入的数据生成新的ID（如果没有ID的话）
        const processedWishes = importedWishes.map(wish => ({
            ...wish,
            id: wish.id || Date.now() + Math.random().toString(36).substr(2, 9)
        }));
        
        // 合并数据
        wishes = [...wishes, ...processedWishes];
        
        await saveData();
        
        res.json({ 
            success: true, 
            message: `成功导入 ${processedWishes.length} 个愿望`,
            total: wishes.length
        });
        
        console.log(`导入了 ${processedWishes.length} 个愿望，当前总数: ${wishes.length}`);
        
    } catch (error) {
        console.error('导入愿望失败:', error);
        res.status(500).json({ error: '导入失败' });
    }
});

// 清空所有愿望数据（管理员功能）
app.delete('/api/admin/clear-wishes', async (req, res) => {
    try {
        const originalCount = wishes.length;
        wishes = [];
        
        await saveData();
        
        res.json({ 
            success: true, 
            message: `已清空 ${originalCount} 个愿望`,
            total: 0
        });
        
        console.log(`管理员清空了所有数据，原有 ${originalCount} 个愿望`);
        
    } catch (error) {
        console.error('清空愿望失败:', error);
        res.status(500).json({ error: '清空失败' });
    }
});

// 批量下载愿望卡片（管理员功能）
app.post('/api/admin/download-cards', async (req, res) => {
    try {
        if (wishes.length === 0) {
            return res.status(400).json({ error: 'No wish card' });
        }
        
        const archiver = require('archiver');
        const { createCanvas } = require('canvas');
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=womenpower_wish_cards_${new Date().toISOString().split('T')[0]}.zip`);
        
        // 创建zip压缩包
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });
        
        archive.pipe(res);
        
        // 为每个愿望生成卡片
        for (let i = 0; i < wishes.length; i++) {
            const wish = wishes[i];
            const canvas = createCanvas(600, 400);
            const ctx = canvas.getContext('2d');
            
            // 设置卡片背景
            const gradient = ctx.createLinearGradient(0, 0, 600, 400);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 600, 400);
            
            // 添加星空效果
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let j = 0; j < 50; j++) {
                const x = Math.random() * 600;
                const y = Math.random() * 400;
                const radius = Math.random() * 2;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 添加标题
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('女力成长俱乐部年会', 300, 60);
            
            ctx.font = 'bold 24px Arial';
            ctx.fillText('愿望卡片', 300, 90);
            
            // 添加姓名
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`Name: ${wish.name}`, 300, 140);
            
            // 添加愿望内容（自动换行）
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            const maxWidth = 500;
            const lineHeight = 25;
            const words = wish.wish.split('');
            let line = '';
            let y = 180;
            
            ctx.fillText('Wish:', 50, 160);
            
            for (let k = 0; k < words.length; k++) {
                const testLine = line + words[k];
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && k > 0) {
                    ctx.fillText(line, 50, y);
                    line = words[k];
                    y += lineHeight;
                    if (y > 320) break; // 防止文字超出卡片
                } else {
                    line = testLine;
                }
            }
            if (y <= 320) {
                ctx.fillText(line, 50, y);
            }
            
            // 添加时间
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Time: ${new Date(wish.timestamp).toLocaleString()}`, 300, 350);
            
            // 添加OH卡 Slogan
            ctx.font = '12px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText('Light up your life and career; make you outstanding everywhere.', 300, 370);
            
            // 添加底部装饰
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillText('✨ Living Upward · 向上生活 ✨', 300, 390);
            
            // 添加到zip包
            const buffer = canvas.toBuffer('image/png');
            const fileName = `wish_card_${i + 1}_${wish.name.replace(/[^\w\s]/gi, '').substring(0, 20)}.png`;
            archive.append(buffer, { name: fileName });
        }
        
        // 完成zip包
        archive.finalize();
        
        console.log(`生成了 ${wishes.length} 个愿望卡片的zip包`);
        
    } catch (error) {
        console.error('生成卡片失败:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: '生成卡片失败' });
        }
    }
});

// 路由处理
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, 'display.html'));
});

app.get('/display2', (req, res) => {
    res.sendFile(path.join(__dirname, 'display2.html'));
});

app.get('/qrcode', (req, res) => {
    res.sendFile(path.join(__dirname, 'qrcode.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/test-responsive', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-responsive.html'));
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '页面未找到' });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
async function startServer() {
    try {
        await initializeData();
        
        server.listen(PORT, () => {
            console.log(`🚀 女力成长俱乐部年会系统启动成功!`);
            console.log(`📱 手机端访问: http://localhost:${PORT}`);
            console.log(`🖥️  大屏展示: http://localhost:${PORT}/display`);
            console.log(`⚙️  管理后台: http://localhost:${PORT}/admin`);
            console.log(`📊 当前已有 ${wishes.length} 个约定`);
        });
        
        // 优雅关闭
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        
    } catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
}

function gracefulShutdown() {
    console.log('\n正在关闭服务器...');
    
    // 关闭所有WebSocket连接
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close();
        }
    });
    
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
}

startServer();

module.exports = app;
