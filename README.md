# 신명종합박스 상세페이지 템플릿

smbox24(카페24) 상품 정보를 하나의 템플릿에 넣어 다음을 만듭니다.

- 카페24 상세설명용 HTML
- 쿠팡·스마트스토어·G마켓용 분할 이미지

## 사용법
```bash
npm install
python3 tools/fetch_product.py 192      # 상품 정보·사진 추출
node build.js products/192.json         # 상세페이지 생성 → out/192/
```

Claude Code에서는 이 저장소를 연결하고 **"깃허브 템플릿 사용해줘 + 상품 URL"**이라고 말하면 됩니다. 자세한 절차는 `CLAUDE.md`에 있습니다.
