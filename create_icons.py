from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # 创建渐变背景
    img = Image.new('RGB', (size, size), '#667eea')
    draw = ImageDraw.Draw(img)
    
    # 绘制圆形背景
    draw.ellipse([size//8, size//8, size*7//8, size*7//8], fill='#764ba2')
    
    # 绘制企鹅形状（简化版）
    center = size // 2
    
    # 企鹅身体
    body_size = size // 3
    draw.ellipse([center - body_size//2, center - body_size//3, 
                  center + body_size//2, center + body_size], fill='white')
    
    # 保存
    img.save(f'icon{size}.png')
    print(f'Created icon{size}.png')

# 创建三种尺寸的图标
for size in [16, 48, 128]:
    create_icon(size)
