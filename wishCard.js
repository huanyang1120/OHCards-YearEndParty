/**
 * OH卡 Year End Party Wish Card Generator
 * 生成精美的愿望卡片功能模块
 */

// 导出函数给外部使用
window.WishCard = {
    downloadWishCard,
    drawBackgroundImage,
    drawStarField,
    drawStar,
    drawOHCardBackground,
    wrapText
};

/**
 * 下载愿望卡片
 * @param {Object} wishData - 愿望数据对象，包含 name, wish, time
 * @param {Object} options - 可选配置参数
 * @param {string} options.backgroundImage - 背景图片路径（可选）
 */
function downloadWishCard(wishData, options = {}) {
    if (!wishData) {
        console.error('No wish data available');
        if (typeof showError === 'function') {
            showError('No wish data available');
        }
        return;
    }

    const canvas = document.getElementById('cardCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // 设置手机满屏 9:16 尺寸 (例: 540x960)
    canvas.width = 540;
    canvas.height = 960;
    
    // 根据配置选择背景方式
    function drawContent() {
        // 添加更丰富的星空效果
        drawStarField(ctx, 540, 960);
        
        // 添加淡淡的OH卡背景图案
        // drawOHCardBackground(ctx, 270, 480);
        
        // 在顶部添加标题
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OH卡 Year End Party', 270, 80);
        ctx.fillText('Future Wish Card', 270, 120);
        
        // 明信片样式开头 "To [姓名]" - 向下移动10px
        ctx.fillStyle = '#ffffff';
        ctx.font = '28px Brush Script MT, cursive';
        ctx.textAlign = 'left';
        ctx.fillText(`To ${wishData.name},`, 40, 290);
        
        // 愿望内容 - 使用手写体，放在中间区域 - 动态调整
        ctx.fillStyle = '#f0f0f0';
        ctx.textAlign = 'left';
        
        // 自动换行处理愿望内容
        let fontSize = 24;
        let lineHeight = 35;
        ctx.font = `${fontSize}px Brush Script MT, cursive`;
        let wishLines = wrapText(ctx, wishData.wish, 460, fontSize);
        
        // 如果文本行数过多，自动缩小字体和行间距
        const maxLines = 15; // 最多显示行数
        if (wishLines.length > maxLines) {
            fontSize = 20;
            lineHeight = 30;
            ctx.font = `${fontSize}px Brush Script MT, cursive`;
            wishLines = wrapText(ctx, wishData.wish, 460, fontSize);
            
            // 如果还是太长，再次缩小
            if (wishLines.length > 18) {
                fontSize = 18;
                lineHeight = 28;
                ctx.font = `${fontSize}px Brush Script MT, cursive`;
                wishLines = wrapText(ctx, wishData.wish, 460, fontSize);
            }
        }
        
        const startY = 350;
        const maxDisplayLines = Math.min(wishLines.length, 20); // 最多显示20行
        
        for (let i = 0; i < maxDisplayLines; i++) {
            ctx.fillText(wishLines[i], 40, startY + (i * lineHeight));
        }
        
        // 如果文本被截断，添加省略号提示
        if (wishLines.length > maxDisplayLines) {
            ctx.fillText('...', 40, startY + (maxDisplayLines * lineHeight));
        }
        
        // 右下角添加日期和时间（包含时分秒）- 位置动态调整
        const timeY = Math.max(850, startY + (maxDisplayLines * lineHeight) + 80);
        ctx.fillStyle = '#d0d0d0';
        ctx.font = '18px Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(wishData.time, 500, Math.min(timeY, 930)); // 确保不超出画布
        
        // 底部装饰 - OH卡 标语
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '16px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('Light up your life and career', 270, 890);
        ctx.fillText('✨ Living Upward · 向上生活 ✨', 270, 920);
    }
    
    function downloadCard() {
        // 下载图片
        const link = document.createElement('a');
        link.download = `OH卡_Year_End_Party_Wish_Card_${wishData.name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }
    
    // 绘制内容并直接下载（不再需要Logo）
    function drawContentWithLogo() {
        drawContent();
        downloadCard(); // 直接下载，不绘制Logo
    }
    
    // 如果提供了背景图片，使用指定的背景图片；否则从4个默认背景中随机选择
    let backgroundImage;
    if (options.backgroundImage) {
        backgroundImage = options.backgroundImage;
    } else {
        // 从4个背景图片中随机选择
        const backgroundVariants = [
            './wishcardBackground01.jpg',
            './wishcardBackground02.jpg', 
            './wishcardBackground03.jpg',
            './wishcardBackground04.jpg'
        ];
        const randomIndex = Math.floor(Math.random() * backgroundVariants.length);
        backgroundImage = backgroundVariants[randomIndex];
    }
    drawBackgroundImage(ctx, backgroundImage, 540, 960, drawContentWithLogo);
}

/**
 * 用图片设置背景
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} imgSrc 图片路径
 * @param {number} width 画布宽度
 * @param {number} height 画布高度
 * @param {Function} [callback] 图片绘制完成后的回调
 */
function drawBackgroundImage(ctx, imgSrc, width, height, callback) {
    const img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, width, height);
        if (typeof callback === 'function') callback();
    };
    img.src = imgSrc;
}

/**
 * 绘制星空效果
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 */
function drawStarField(ctx, width, height) {
    // 大星星
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 中等星星
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 1.5 + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 小星星
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 添加一些闪烁的星星效果
    ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        drawStar(ctx, x, y, 3, 6, 1.5);
    }
}

/**
 * 绘制星形
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} x - 中心X坐标
 * @param {number} y - 中心Y坐标
 * @param {number} spikes - 星形的角数
 * @param {number} outerRadius - 外半径
 * @param {number} innerRadius - 内半径
 */
function drawStar(ctx, x, y, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;
    
    ctx.beginPath();
    ctx.moveTo(x, y - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius);
        rot += step;
    }
    
    ctx.lineTo(x, y - outerRadius);
    ctx.closePath();
    ctx.fill();
}

/**
 * 绘制淡淡的OH卡背景图案
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} x - 中心X坐标
 * @param {number} y - 中心Y坐标
 */
function drawOHCardBackground(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.1; // 设置透明度，使其很淡
    
    // 绘制简化的OH卡轮廓
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    
    // OH卡主体
    ctx.beginPath();
    ctx.moveTo(-30, 150);
    ctx.lineTo(-25, -100);
    ctx.lineTo(25, -100);
    ctx.lineTo(30, 150);
    ctx.stroke();
    
    // OH卡顶部
    ctx.beginPath();
    ctx.moveTo(-35, -100);
    ctx.lineTo(0, -130);
    ctx.lineTo(35, -100);
    ctx.stroke();
    
    // 光线效果
    ctx.beginPath();
    ctx.moveTo(0, -110);
    ctx.lineTo(-80, -80);
    ctx.moveTo(0, -110);
    ctx.lineTo(80, -80);
    ctx.moveTo(0, -110);
    ctx.lineTo(-60, -140);
    ctx.moveTo(0, -110);
    ctx.lineTo(60, -140);
    ctx.stroke();
    
    ctx.restore();
}



/**
 * 文本自动换行函数 - 支持中英文混合文本
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {string} text - 要换行的文本
 * @param {number} maxWidth - 最大宽度
 * @param {number} fontSize - 字体大小
 * @returns {Array<string>} 换行后的文本数组
 */
function wrapText(ctx, text, maxWidth, fontSize) {
    const lines = [];
    
    // 先按换行符分割文本
    const paragraphs = text.split(/\r?\n/);
    
    paragraphs.forEach(paragraph => {
        if (paragraph.trim() === '') {
            // 空行也要保留
            lines.push('');
            return;
        }
        
        let currentLine = '';
        
        // 逐字符处理，更好地支持中文
        for (let i = 0; i < paragraph.length; i++) {
            const char = paragraph[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                // 如果当前字符是空格或标点，尝试在此处换行
                if (char === ' ' || char === '，' || char === '。' || char === '！' || char === '？' || char === '；') {
                    lines.push(currentLine.trim());
                    currentLine = '';
                } else {
                    // 否则，将当前行添加到结果中，新行从当前字符开始
                    lines.push(currentLine.trim());
                    currentLine = char;
                }
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine.trim()) {
            lines.push(currentLine.trim());
        }
    });
    
    return lines;
}
