"""
终末地抽卡记录 OCR 识别服务

使用 PaddleOCR + OpenCV 实现游戏截图的文字识别

依赖安装:
    pip install paddlepaddle paddleocr opencv-python flask flask-cors pillow numpy

运行方式:
    python ocr_service.py

API端点:
    POST /ocr/recognize - 识别单张图片
    POST /ocr/batch - 批量识别多张图片
"""

import os
import io
import base64
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from paddleocr import PaddleOCR
import cv2
import numpy as np
from PIL import Image

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建 Flask 应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 初始化 PaddleOCR
# use_angle_cls=True 启用文字方向分类
# lang='ch' 使用中文模型（也支持英文）
ocr_engine = PaddleOCR(
    use_angle_cls=True,
    lang='ch',
    show_log=False,
    use_gpu=False  # 如果有GPU，改为True可以加速
)

# 角色名称字典（用于模糊匹配和纠错）
# TODO: 游戏上线后补充完整的角色名称列表
CHARACTER_NAMES = {
    # 6星限定角色
    '莱万汀': ['莱万汀', '莱万廷', '莱文汀'],
    '伊冯': ['伊冯', '伊文', '依冯'],
    '洁尔佩塔': ['洁尔佩塔', '洁尔贝塔', '洁儿佩塔'],

    # TODO: 添加更多角色
}

# 稀有度颜色映射（用于辅助识别）
RARITY_COLORS = {
    6: {
        'rgb': (255, 200, 0),      # 金色
        'hsv_range': ([20, 100, 100], [30, 255, 255])
    },
    5: {
        'rgb': (255, 140, 0),      # 橙色
        'hsv_range': ([10, 100, 100], [20, 255, 255])
    },
    4: {
        'rgb': (160, 32, 240),     # 紫色
        'hsv_range': ([130, 50, 100], [160, 255, 255])
    },
    3: {
        'rgb': (30, 144, 255),     # 蓝色
        'hsv_range': ([100, 50, 100], [130, 255, 255])
    }
}


def preprocess_image(image):
    """
    图像预处理

    Args:
        image: OpenCV 图像 (numpy array)

    Returns:
        处理后的图像
    """
    # 1. 转换为灰度图
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 2. 去噪
    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)

    # 3. 二值化（Otsu自动阈值）
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 4. 形态学操作（闭运算）- 连接文字
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    morphed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # 5. 对比度增强
    enhanced = cv2.equalizeHist(morphed)

    return enhanced


def detect_rarity_by_color(image, bbox):
    """
    通过颜色检测稀有度

    Args:
        image: OpenCV 图像
        bbox: 文字边界框 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]

    Returns:
        int: 稀有度 (3-6) 或 None
    """
    # 提取边界框区域
    x_coords = [point[0] for point in bbox]
    y_coords = [point[1] for point in bbox]
    x_min, x_max = int(min(x_coords)), int(max(x_coords))
    y_min, y_max = int(min(y_coords)), int(max(y_coords))

    # 扩展区域以包含背景色
    padding = 20
    x_min = max(0, x_min - padding)
    y_min = max(0, y_min - padding)
    x_max = min(image.shape[1], x_max + padding)
    y_max = min(image.shape[0], y_max + padding)

    roi = image[y_min:y_max, x_min:x_max]

    # 转换到HSV色彩空间
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # 检测每个稀有度的颜色
    best_match = None
    best_percentage = 0

    for rarity, color_info in RARITY_COLORS.items():
        lower, upper = color_info['hsv_range']
        mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
        percentage = np.sum(mask > 0) / mask.size

        if percentage > best_percentage and percentage > 0.1:  # 至少10%匹配
            best_percentage = percentage
            best_match = rarity

    return best_match


def fuzzy_match_character(text):
    """
    模糊匹配角色名称

    Args:
        text: OCR识别的文本

    Returns:
        str: 匹配的标准角色名称，或原文本
    """
    text = text.strip()

    # 精确匹配
    for standard_name, variants in CHARACTER_NAMES.items():
        if text in variants:
            return standard_name

    # 模糊匹配（编辑距离）
    from difflib import get_close_matches
    all_names = [name for variants in CHARACTER_NAMES.values() for name in variants]
    matches = get_close_matches(text, all_names, n=1, cutoff=0.8)

    if matches:
        # 找到对应的标准名称
        for standard_name, variants in CHARACTER_NAMES.items():
            if matches[0] in variants:
                return standard_name

    return text  # 无匹配，返回原文本


def parse_gacha_record(ocr_results, image):
    """
    解析 OCR 结果为抽卡记录

    Args:
        ocr_results: PaddleOCR 识别结果
        image: 原始图像（用于颜色检测）

    Returns:
        list: 抽卡记录列表
    """
    records = []

    for line in ocr_results:
        bbox, (text, confidence) = line

        # 过滤低置信度结果
        if confidence < 0.7:
            logger.warning(f"跳过低置信度文本: {text} ({confidence:.2f})")
            continue

        # 尝试识别角色名称
        character_name = fuzzy_match_character(text)

        # 通过颜色检测稀有度
        rarity = detect_rarity_by_color(image, bbox)

        # 构建记录（简化版，实际需要更复杂的解析逻辑）
        if character_name and rarity:
            records.append({
                'name': character_name,
                'rarity': rarity,
                'confidence': float(confidence),
                'bbox': bbox,
                'original_text': text
            })

    return records


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({'status': 'ok', 'service': 'OCR Service'})


@app.route('/ocr/recognize', methods=['POST'])
def recognize_image():
    """
    识别单张图片

    请求体:
        {
            "image": "base64编码的图片",
            "preprocess": true  // 是否预处理
        }

    响应:
        {
            "success": true,
            "records": [...],
            "raw_ocr_results": [...],
            "processing_time": 1.23
        }
    """
    import time
    start_time = time.time()

    try:
        # 获取请求数据
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': '缺少图片数据'}), 400

        # 解码图片
        image_data = base64.b64decode(data['image'])
        image_array = np.frombuffer(image_data, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            return jsonify({'success': False, 'error': '图片解码失败'}), 400

        # 预处理（可选）
        if data.get('preprocess', True):
            processed_image = preprocess_image(image)
            # 转回BGR用于OCR
            ocr_input = cv2.cvtColor(processed_image, cv2.COLOR_GRAY2BGR)
        else:
            ocr_input = image

        # 执行 OCR
        logger.info("开始 OCR 识别...")
        ocr_results = ocr_engine.ocr(ocr_input, cls=True)

        if not ocr_results or not ocr_results[0]:
            return jsonify({
                'success': False,
                'error': '未识别到文字',
                'processing_time': time.time() - start_time
            })

        # 解析为抽卡记录
        records = parse_gacha_record(ocr_results[0], image)

        logger.info(f"识别完成: {len(records)} 条记录")

        return jsonify({
            'success': True,
            'records': records,
            'raw_ocr_results': [
                {
                    'text': line[1][0],
                    'confidence': float(line[1][1]),
                    'bbox': line[0]
                }
                for line in ocr_results[0]
            ],
            'processing_time': time.time() - start_time
        })

    except Exception as e:
        logger.error(f"OCR识别失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'processing_time': time.time() - start_time
        }), 500


@app.route('/ocr/batch', methods=['POST'])
def recognize_batch():
    """
    批量识别多张图片

    请求体:
        {
            "images": ["base64_1", "base64_2", ...],
            "preprocess": true
        }

    响应:
        {
            "success": true,
            "results": [
                {"success": true, "records": [...]},
                {"success": false, "error": "..."},
                ...
            ],
            "total_records": 10,
            "processing_time": 5.67
        }
    """
    import time
    start_time = time.time()

    try:
        data = request.get_json()
        if not data or 'images' not in data:
            return jsonify({'success': False, 'error': '缺少图片数据'}), 400

        images = data['images']
        preprocess = data.get('preprocess', True)

        results = []
        total_records = 0

        for idx, image_base64 in enumerate(images):
            try:
                # 解码图片
                image_data = base64.b64decode(image_base64)
                image_array = np.frombuffer(image_data, dtype=np.uint8)
                image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

                if image is None:
                    results.append({'success': False, 'error': f'图片 {idx + 1} 解码失败'})
                    continue

                # 预处理
                if preprocess:
                    processed_image = preprocess_image(image)
                    ocr_input = cv2.cvtColor(processed_image, cv2.COLOR_GRAY2BGR)
                else:
                    ocr_input = image

                # OCR 识别
                ocr_results = ocr_engine.ocr(ocr_input, cls=True)

                if not ocr_results or not ocr_results[0]:
                    results.append({'success': False, 'error': f'图片 {idx + 1} 未识别到文字'})
                    continue

                # 解析记录
                records = parse_gacha_record(ocr_results[0], image)
                total_records += len(records)

                results.append({
                    'success': True,
                    'records': records,
                    'image_index': idx
                })

            except Exception as e:
                logger.error(f"处理图片 {idx + 1} 失败: {str(e)}")
                results.append({'success': False, 'error': str(e), 'image_index': idx})

        return jsonify({
            'success': True,
            'results': results,
            'total_records': total_records,
            'total_images': len(images),
            'processing_time': time.time() - start_time
        })

    except Exception as e:
        logger.error(f"批量OCR失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'processing_time': time.time() - start_time
        }), 500


if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("终末地 OCR 识别服务启动中...")
    logger.info("PaddleOCR 模型加载完成")
    logger.info("服务地址: http://localhost:5000")
    logger.info("=" * 50)

    # 启动服务
    # 生产环境建议使用 gunicorn 或 uwsgi
    app.run(host='0.0.0.0', port=5000, debug=False)
