"""카페24 상세설명 업로드 도구 (Admin API)

필요한 환경 변수: CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET  (클라우드 환경 설정 → 환경 변수)
토큰은 work/.cafe24_token.json에 저장됩니다 (커밋하지 않음).

사용법:
  python3 tools/cafe24_upload.py auth-url                 # 승인 링크 출력
  python3 tools/cafe24_upload.py token "<돌아온 주소 또는 code>"   # 토큰 발급
  python3 tools/cafe24_upload.py backup 233 53 ...         # 기존 상세설명을 backups/<번호>.json에 저장
  python3 tools/cafe24_upload.py upload 233 53 ...         # 백업 후 out/<번호>/cafe24.html로 상세설명 교체
  python3 tools/cafe24_upload.py restore 233               # backups/<번호>.json으로 되돌리기
"""
import base64
import calendar
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

MALL = 'smbox2765'
API = f'https://{MALL}.cafe24api.com/api/v2'
REDIRECT = 'https://smbox24.com/'
SCOPE = 'mall.read_product,mall.write_product,mall.read_category'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_FILE = os.path.join(ROOT, 'work', '.cafe24_token.json')
BACKUP_DIR = os.path.join(ROOT, 'backups')


def client():
    cid, sec = os.environ.get('CAFE24_CLIENT_ID'), os.environ.get('CAFE24_CLIENT_SECRET')
    if not cid or not sec:
        sys.exit('CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET 환경 변수가 없습니다.')
    return cid, sec


def req(method, url, data=None, headers=None):
    body = None
    if isinstance(data, dict):
        body = json.dumps(data).encode()
    elif isinstance(data, str):
        body = data.encode()
    r = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {url} → {e.code} {e.read().decode()[:500]}')


def save_token(t):
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, 'w') as f:
        json.dump(t, f)
    os.chmod(TOKEN_FILE, 0o600)


def token_request(form):
    cid, sec = client()
    basic = base64.b64encode(f'{cid}:{sec}'.encode()).decode()
    t = req('POST', f'{API}/oauth/token', urllib.parse.urlencode(form),
            {'Authorization': f'Basic {basic}', 'Content-Type': 'application/x-www-form-urlencoded'})
    save_token(t)
    return t


def access_token():
    if not os.path.exists(TOKEN_FILE):
        sys.exit('토큰이 없습니다. auth-url → token 순서로 먼저 연결하세요.')
    t = json.load(open(TOKEN_FILE))
    # 카페24 시각은 한국 시간(KST, UTC+9)이므로 UTC로 바꿔서 비교
    exp = calendar.timegm(time.strptime(t['expires_at'][:19], '%Y-%m-%dT%H:%M:%S')) - 9 * 3600
    if exp - time.time() < 300:  # 만료 5분 전이면 갱신
        t = token_request({'grant_type': 'refresh_token', 'refresh_token': t['refresh_token']})
    return t['access_token']


def api(method, path, data=None):
    h = {'Authorization': f'Bearer {access_token()}', 'Content-Type': 'application/json'}
    return req(method, f'{API}/admin/{path}', data, h)


FIELDS = 'product_no,product_name,description,mobile_description,separated_mobile_description,updated_date'


def backup(no):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    p = os.path.join(BACKUP_DIR, f'{no}.json')
    if os.path.exists(p):  # 처음 백업만 보관 (템플릿 적용 전 원본)
        return json.load(open(p))
    prod = api('GET', f'products/{no}?fields={FIELDS}')['product']
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(prod, f, ensure_ascii=False, indent=2)
    return prod


def upload(no):
    html_path = os.path.join(ROOT, 'out', str(no), 'cafe24.html')
    if not os.path.exists(html_path):
        sys.exit(f'{html_path} 가 없습니다. 먼저 node build.js products/{no}.json')
    old = backup(no)
    html = open(html_path, encoding='utf-8').read()
    res = api('PUT', f'products/{no}', {'shop_no': 1, 'request': {
        'description': html,
        'separated_mobile_description': 'F',  # 모바일도 같은 상세설명 사용 (반응형)
    }})
    print(f'{no} {old.get("product_name", "")[:30]} → 업로드 완료 ({len(html):,}자)', res['product'].get('updated_date', ''))


def restore(no):
    p = os.path.join(BACKUP_DIR, f'{no}.json')
    old = json.load(open(p, encoding='utf-8'))
    req_body = {'description': old.get('description') or ''}
    if old.get('separated_mobile_description'):
        req_body['separated_mobile_description'] = old['separated_mobile_description']
    if old.get('separated_mobile_description') == 'T':
        req_body['mobile_description'] = old.get('mobile_description') or ''
    api('PUT', f'products/{no}', {'shop_no': 1, 'request': req_body})
    print(f'{no} 원래 상세설명으로 되돌림')


def main():
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'auth-url':
        cid, _ = client()
        q = urllib.parse.urlencode({'response_type': 'code', 'client_id': cid, 'state': 'smbox1',
                                    'redirect_uri': REDIRECT, 'scope': SCOPE})
        print(f'{API}/oauth/authorize?{q}')
    elif cmd == 'token':
        m = re.search(r'code=([^&\s]+)', args[0])
        code = m.group(1) if m else args[0]
        t = token_request({'grant_type': 'authorization_code', 'code': code, 'redirect_uri': REDIRECT})
        print('연결 완료. 만료:', t['expires_at'], '/ 갱신 토큰 만료:', t['refresh_token_expires_at'])
    elif cmd == 'backup':
        for no in args:
            print(no, backup(no).get('product_name'))
    elif cmd == 'upload':
        for no in args:
            upload(no)
    elif cmd == 'restore':
        for no in args:
            restore(no)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
