"""smbox24 상품 페이지에서 상세페이지 초안 데이터를 뽑아냅니다.

사용법:  python3 tools/fetch_product.py <상품번호 또는 상품 URL>
결과:    work/<번호>/page.html      원본 페이지
         work/<번호>/draft.json     자동 추출 결과 (이름, 옵션·가격, 사이즈, 이미지, 영상, 설명 문구)
         work/<번호>/imgs/NN.jpg    이미지 원본
         work/<번호>/sheet.jpg      이미지 한눈에 보기 (사진 고를 때 사용)
"""
import html
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
arg = sys.argv[1]
no = re.search(r'product_no=(\d+)', arg) or re.search(r'/(\d+)/?$', arg) or re.fullmatch(r'(\d+)', arg)
no = no.group(1)
url = arg if arg.startswith('http') else f'https://smbox24.com/product/detail.html?product_no={no}'
W = os.path.join(ROOT, 'work', no)
os.makedirs(os.path.join(W, 'imgs'), exist_ok=True)
page = os.path.join(W, 'page.html')
subprocess.run(['curl', '-sSfL', '-A', 'Mozilla/5.0', '-o', page, url], check=True)
s = open(page, encoding='utf-8', errors='ignore').read()


def var(name):
    m = re.search(r"var " + name + r" = '(.*?)';", s)
    return m.group(1) if m else ''


name = var('product_name')
summary = re.search(r'상품요약정보.*?<td[^>]*>(.*?)</td>', s, re.S)
simple = re.search(r'상품간략설명.*?<td[^>]*>(.*?)</td>', s, re.S)
clean = lambda x: html.unescape(re.sub(r'<[^>]+>', ' ', x)).strip() if x else ''
summary, simple = clean(summary and summary.group(1)), clean(simple and simple.group(1))
og = re.search(r'property="og:description" content="([^"]*)"', s)
if not simple and og:
    simple = html.unescape(og.group(1))

options = []
raw = var('option_stock_data')
if raw:
    data = json.loads(raw.encode().decode('unicode_escape').replace('\\/', '/'))
    for v in data.values():
        options.append({'value': v.get('option_value'), 'price': v.get('option_price')})
base_price = re.search(r'id="span_product_price_text">([\d,]+)원', s)

# 상세설명 구간: 첫 상세 이미지부터 결제 안내 전까지
start = s.find('edibot-product-detail')
start = start if start > 0 else s.find('prdDetail')
end = s.find('고액결제의 경우', start)
seg = s[start:end if end > 0 else start + 200000]
seg = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', seg, flags=re.S)

def absu(u):
    return 'https:' + u if u.startswith('//') else u

thumbs = []
for u in re.findall(r'(?:src|ec-data-src)="([^"]*/web/product/(?:big|extra/big)/[^"]+)"', s):
    u = absu(u)
    if u not in thumbs:
        thumbs.append(u)
detail = []
for u in re.findall(r'<img[^>]+src="([^"]+)"', seg):
    u = absu(u)
    if 'cafe24img.com' in u and u not in detail and u not in thumbs:
        detail.append(u)
videos = []
for v in re.findall(r'youtube\.com/embed/([\w-]{11})', seg):
    if v not in videos:
        videos.append(v)
text = re.sub(r'<iframe[^>]*youtube\.com/embed/([\w-]{11})[^>]*>', r'\n[영상 \1]\n', seg)
text = re.sub(r'<img[^>]+src="([^"]+)"[^>]*>', lambda m: '\n[이미지 %s]\n' % m.group(1).rsplit('/', 1)[-1], text)
text = html.unescape(re.sub(r'<[^>]+>', '\n', text))
text = '\n'.join(l.strip() for l in text.splitlines() if l.strip())

images = thumbs + detail
labels = []
for i, u in enumerate(images, 1):
    f = os.path.join(W, 'imgs', f'{i:02d}.jpg')
    if not os.path.exists(f):
        subprocess.run(['curl', '-sSfL', '-o', f, u], check=False)
    labels.append(f'{i:02d}.jpg')

tiles = []
for lab in labels:
    try:
        im = Image.open(os.path.join(W, 'imgs', lab)).convert('RGB')
    except Exception:
        continue
    im.thumbnail((220, 220))
    c = Image.new('RGB', (230, 250), 'white')
    c.paste(im, (5, 5))
    ImageDraw.Draw(c).text((5, 232), lab, fill='black')
    tiles.append(c)
if tiles:
    cols = 6
    sheet = Image.new('RGB', (cols * 230, ((len(tiles) + cols - 1) // cols) * 250), 'white')
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * 230, (i // cols) * 250))
    sheet.save(os.path.join(W, 'sheet.jpg'), quality=85)

draft = {
    'id': no, 'sourceUrl': url, 'name': name, 'summary': summary, 'simpleDesc': simple,
    'basePrice': base_price.group(1) if base_price else '', 'options': options,
    'videos': [f'https://www.youtube.com/embed/{v}' for v in videos],
    'images': {lab: u for lab, u in zip(labels, images)},
    'descriptionText': text,
}
json.dump(draft, open(os.path.join(W, 'draft.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(json.dumps({k: draft[k] for k in ('name', 'summary', 'simpleDesc', 'basePrice', 'options', 'videos')}, ensure_ascii=False, indent=2))
print(f'이미지 {len(images)}장 → {W}/sheet.jpg')
print('--- 상세설명 ---')
print(text[:4000])
