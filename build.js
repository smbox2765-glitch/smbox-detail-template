// 상세페이지 생성기
// 사용법: node build.js products/<제품>.json
// 결과: out/<id>/cafe24.html (카페24용), out/<id>/preview.html (미리보기),
//       out/<id>/market/NN.jpg (쿠팡·스마트스토어·G마켓용 분할 이미지), out/<id>/full.jpg
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const common = JSON.parse(fs.readFileSync(path.join(ROOT, 'common.json'), 'utf8'));
const productFile = process.argv[2] || 'products/sample.json';
const p = JSON.parse(fs.readFileSync(path.resolve(productFile), 'utf8'));
const OUT = path.join(ROOT, 'out', p.id);
fs.mkdirSync(path.join(OUT, 'market'), { recursive: true });

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const br = (s = '') => esc(s).replace(/\n/g, '<br>');
// 전화번호가 줄 끝에서 잘리지 않도록 묶음
const nw = (h = '') => String(h).replace(/(\d{2,4}-\d{3,4}-\d{4})/g, '<span class="smd-nw">$1</span>');
// 카페24용 HTML에서는 common.json의 cafe24Images(카페24에 올린 주소)를 우선 사용, 미리보기·마켓 이미지는 assets/ 원본 사용
const asset = (f, base) => {
  if (/^https?:/.test(f)) return f;
  if (!base.startsWith('file:') && common.cafe24Images && common.cafe24Images[f]) return common.cafe24Images[f];
  return base + f;
};

let RES = (u) => u; // 미리보기에서는 로컬 캐시 경로로 바꿔줌
let PREVIEW = false;
function img(src, label, cls = '') {
  if (src) return `<img class="smd-img ${cls}" src="${esc(RES(src))}" alt="${esc(label)}">`;
  return `<div class="smd-ph ${cls}"><span>${esc(label)}</span></div>`;
}

function video(url, title, auto = false) {
  if (!url) return '';
  if (PREVIEW) return `<div class="smd-vph"><span>▶</span>${esc(title)} (카페24에서 재생 · 마켓 이미지에서는 제외)</div>`;
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  const body = yt
    ? `<div class="smd-vwrap"><iframe src="https://www.youtube.com/embed/${yt[1]}?rel=0${auto ? `&autoplay=1&mute=1&loop=1&playlist=${yt[1]}&playsinline=1` : ''}" title="${esc(title)}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
    : `<video class="smd-video" src="${esc(url)}" controls playsinline muted loop></video>`;
  return body;
}

function render(base, fontCss, pc = false) {
  const s = [];
  const sec = (key, inner, cls = '') => s.push(`<section class="smd-sec ${cls}" data-sec="${key}">${inner}</section>`);

  // #1 상단 동영상 (있는 상품만)
  if (p.introVideo) sec('v1', `<div class="smd-pad">${video(p.introVideo, '제품 영상', true)}</div>`, 'smd-video-sec');

  // 1. 공통 상단 이미지
  const sh = common.shipping;
  const truck = `<svg class="smd-truck" viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M4 6h34v26H4z"/><path d="M38 16h12l10 10v6H38z"/><circle cx="16" cy="36" r="5" fill="var(--dark)"/><circle cx="48" cy="36" r="5" fill="var(--dark)"/></svg>`;
  const shop = `<svg viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><path d="M8 18l3-9h26l3 9"/><path d="M8 18c0 3 2.5 5 5.3 5s5.4-2 5.4-5c0 3 2.5 5 5.3 5s5.3-2 5.3-5c0 3 2.6 5 5.4 5S40 21 40 18"/><path d="M11 23v15h26V23"/><path d="M20 38v-8h8v8"/></svg>`;
  sec('top', `
    <div class="smd-ship">
      <div class="smd-ship-circle"></div>
      <p class="smd-ship-badge">${esc(sh.badge)}</p>
      <p class="smd-ship-title">${truck}<span>당일</span><em>발송!</em></p>
    </div>
    <div class="smd-store">
      <div class="smd-store-icon">${shop}</div>
      <div>
        <p class="smd-line-pill">${esc(sh.store.label)}</p>
        <p class="smd-store-h">${sh.store.line1}<br>${sh.store.line2}</p>
        <ul class="smd-info smd-info-lg"><li><span>주소</span><em>${esc(sh.store.address)}</em></li><li><span>전화</span><em>${nw(esc(sh.store.tel))}</em></li></ul>
      </div>
    </div>
    <div class="smd-factory">
      <p class="smd-line-pill">${esc(sh.factory.label)}</p>
      <p class="smd-factory-h">${sh.factory.title}</p>
      <img class="smd-img smd-factory-img" src="${esc(RES(asset(sh.factory.image, base)))}" alt="파주공장">
      <p class="smd-cctv"><i></i>${esc(sh.factory.bar)}</p>
    </div>`, 'smd-flush-top');

  // 2. 제품명 + 대표 이미지
  sec('hero', `
    <div class="smd-pad">
      <p class="smd-eyebrow">PRODUCT</p>
      <h1 class="smd-title">${br(p.name)}</h1>
      ${p.tagline ? `<p class="smd-tagline">${br(p.tagline)}</p>` : ''}
      <div class="smd-hero">${img(p.heroImage, '대표 이미지', 'smd-hero-img')}</div>
    </div>`);

  // 3. 사이즈 · 주문단위 · 가격
  const rows = p.options.map(o => `
        <tr>
          ${p.options.length > 1 ? `<td class="smd-opt"><span>${esc(o.label)}</span></td>` : ''}
          <td>${esc(o.size)}</td><td>${esc(o.unit)}</td><td>${esc(o.unitPrice)}</td><td class="smd-price">${esc(o.price)}</td>
        </tr>`).join('');
  sec('spec', `
    <div class="smd-pad">
      <p class="smd-eyebrow">SIZE &amp; PRICE</p>
      <h2 class="smd-h2">사이즈 · 가격 안내</h2>
      <div class="smd-card smd-table-card">
        <table class="smd-table${p.options.length > 1 ? ' smd-table-opt' : ''}">
          <thead><tr>
            ${p.options.length > 1 ? '<th>옵션</th>' : ''}
            <th>사이즈<small><span class="smd-nw">가로×세로×높이</span> (${esc(p.sizeUnit || 'mm')})</small></th><th>주문단위</th><th>개당가격</th><th>가격</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="smd-note">* 사이즈는 측정 방법에 따라 1~3mm 오차가 있을 수 있어요.</p>
    </div>`);

  // 4. 이런 장소에서 이렇게 사용돼요
  const u = p.usage || {};
  const ui = u.images || [];
  sec('usage', `
    <div class="smd-pad">
      <p class="smd-pill">USE</p>
      <h2 class="smd-h2 smd-center"><em>${esc(u.place)}</em>에서<br><em>${esc(u.how)}</em> 사용돼요.</h2>
      ${u.desc ? `<p class="smd-desc smd-center">${br(u.desc)}</p>` : ''}
      <div class="smd-gallery">
        ${img(ui[0], '사용 예시 사진 1', 'smd-g-main')}
        <div class="smd-g-row">${img(ui[1], '사용 예시 사진 2')}${img(ui[2], '사용 예시 사진 3')}</div>
      </div>
    </div>`);

  // 5. 제품 특징
  const feats = p.features.map((f, i) => `
      <div class="smd-card smd-feat">
        <div class="smd-feat-img">${img(f.image, `특징 사진 ${i + 1}`)}</div>
        <div class="smd-feat-txt">
          <p class="smd-num">${String(i + 1).padStart(2, '0')}</p>
          <h3>${br(f.title)}</h3>
          <p>${br(f.desc)}</p>
        </div>
      </div>`).join('');
  sec('features', `
    <div class="smd-pad">
      <p class="smd-eyebrow smd-center">DETAIL</p>
      <h2 class="smd-h2 smd-center">제품 특징</h2>
      ${feats}
    </div>`);

  // 5-1. 상세 사진 더보기
  const gal = p.gallery || [];
  if (gal.length) {
    const vis = p.galleryVisible ?? gal.length;
    const group = (g) => `
      <div class="smd-ggroup">
        ${g.title ? `<p class="smd-gtitle"><span>${esc(g.title)}</span>${g.desc ? esc(g.desc) : ''}</p>` : ''}
        <div class="smd-gallery">
          ${img(g.images[0], '상세 사진', 'smd-g-main')}
          ${(() => { const r = g.images.slice(1), out = []; for (let i = 0; i < r.length; i += 2) out.push(r.length - i === 1 ? img(r[i], '상세 사진', 'smd-g-main') : `<div class="smd-g-row">${img(r[i], '상세 사진')}${img(r[i + 1], '상세 사진')}</div>`); return out.join(''); })()}
        </div>
        ${g.parts ? `
        <div class="smd-card smd-parts">
          ${img(g.parts.image, '구성품 사진', 'smd-parts-img')}
          <p class="smd-parts-txt"><span>구성품</span>${br(g.parts.text)}</p>
        </div>` : ''}
      </div>`;
    const shown = gal.slice(0, vis).map(group).join('');
    const rest = gal.slice(vis);
    const more = rest.length ? `
      <details class="smd-more"${PREVIEW ? ' open' : ''}>
        <summary>상세 사진 더보기<b>+${rest.reduce((n, g) => n + g.images.length, 0)}</b></summary>
        ${rest.map(group).join('')}
      </details>` : '';
    sec('gallery', `
      <div class="smd-pad">
        <p class="smd-eyebrow smd-center">DETAIL CUT</p>
        <h2 class="smd-h2 smd-center">상세 사진</h2>
        ${p.galleryNote ? `<p class="smd-gnote">${br(p.galleryNote)}</p>` : ''}
        ${shown}${more}
      </div>`);
  }

  // 6. 자주 묻는 질문
  const faq = common.faq.map((f, i) => `
      <div class="smd-card smd-faq">
        <div class="smd-q"><span class="smd-qa">Q</span><h3>${esc(f.q)}</h3></div>
        <div class="smd-a"><span class="smd-qa smd-qa-a">A</span><div>
          ${f.a.map(l => `<p>${nw(l)}</p>`).join('')}
          ${f.info ? `<ul class="smd-info">${f.info.map(([k, v]) => `<li><span>${esc(k)}</span><em>${nw(esc(v))}</em></li>`).join('')}</ul>` : ''}
          ${f.note ? `<p class="smd-sub">${nw(esc(f.note))}</p>` : ''}
        </div></div>
      </div>`).join('');
  sec('faq', `
    <div class="smd-pad">
      <p class="smd-eyebrow smd-center">Q&amp;A</p>
      <h2 class="smd-h2 smd-center">자주 묻는 질문</h2>
      ${faq}
      <p class="smd-closing">${esc(common.faqClosing)}</p>
    </div>`);

  // 7. 공통 하단 이미지
  sec('bottom', `<img class="smd-full" src="${asset(common.bottomImage, base)}" alt="신명패키지 매장 안내">`, 'smd-flush');

  // #2 접는 방법 동영상 (있는 상품만)
  if (p.foldVideo) sec('v2', `<div class="smd-pad"><p class="smd-eyebrow smd-center">HOW TO FOLD</p><h2 class="smd-h2 smd-center">접는 방법</h2>${video(p.foldVideo, '접는 방법')}</div>`, 'smd-video-sec');

  const pcw = common.cafe24PcWidth || 0;
  const wrap = pc && pcw ? `<div class="smd smd-pc" style="--pcz:${(pcw / 860).toFixed(4)}">` : '<div class="smd">';
  return `<style>${fontCss}${CSS}${pc && pcw ? PC_CSS : ''}</style>\n${wrap}\n${s.join('\n')}\n</div>`;
}

const CSS = `
.smd{--bg:#F8F4EC;--card:#FFFDF8;--line:#EAE2D3;--ink:#3A332C;--sub:#7D7266;--accent:#B5533C;--soft:#F1E9DB;
  width:100%;max-width:860px;margin:0 auto;background:var(--bg);color:var(--ink);
  font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.6;letter-spacing:-0.02em;word-break:keep-all}
.smd *{box-sizing:border-box;margin:0;padding:0}
.smd{text-align:left}
.smd-sec{display:block}
.smd-pad{padding:88px 56px}
.smd-flush{line-height:0}
.smd-full{display:block;width:100%;height:auto}
.smd-center{text-align:center}
.smd-eyebrow{font-size:15px;font-weight:700;letter-spacing:0.18em;color:var(--accent);margin-bottom:12px}
.smd-pill{display:table;margin:0 auto 18px;padding:6px 20px;border-radius:999px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;letter-spacing:0.12em}
.smd-title{font-size:46px;font-weight:800;line-height:1.3;margin-bottom:14px}
.smd-tagline{font-size:21px;color:var(--sub);margin-bottom:44px}
.smd-h2{font-size:36px;font-weight:800;line-height:1.4;margin-bottom:36px}
.smd-h2 em{font-style:normal;color:var(--accent)}
.smd-desc{font-size:19px;color:var(--sub);margin:-16px 0 40px}
.smd-card{background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:0 6px 18px rgba(90,70,40,0.06)}
.smd-img{display:block;width:100%;height:auto;border-radius:16px;object-fit:cover}
.smd-ph{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:4/3;border-radius:16px;
  background:repeating-linear-gradient(45deg,#EFE7D8,#EFE7D8 14px,#F4EDE1 14px,#F4EDE1 28px);border:2px dashed #D8CBB4;color:#A3957F;font-size:18px;font-weight:600}
.smd-hero .smd-ph,.smd-hero .smd-img{aspect-ratio:1/1;border-radius:24px}
.smd-table-card{overflow:hidden}
.smd-table{width:100%;border-collapse:collapse;text-align:center;font-size:19px}
.smd-table th{background:var(--soft);font-weight:700;font-size:17px;padding:20px 8px;color:var(--ink)}
.smd-table th small{display:block;font-size:13px;font-weight:500;color:var(--sub);margin-top:2px}
.smd-table td{padding:22px 8px;border-top:1px solid var(--line)}
.smd-opt span{display:inline-block;min-width:44px;padding:4px 10px;border-radius:8px;background:var(--ink);color:#fff;font-weight:700;font-size:16px}
.smd-price{font-weight:800;color:var(--accent)}
.smd-note{font-size:15px;color:var(--sub);margin-top:16px}
.smd-gallery{display:flex;flex-direction:column;gap:14px}
.smd-g-row{display:flex;gap:14px}
.smd-g-row>*{flex:1;min-width:0}
.smd-g-main.smd-ph,.smd-g-main.smd-img{aspect-ratio:3/2}
.smd-g-row .smd-ph,.smd-g-row .smd-img{aspect-ratio:1/1}
.smd-feat{display:flex;align-items:center;gap:40px;padding:36px;margin-bottom:24px}
.smd-feat-img{flex:0 0 46%}
.smd-feat-img .smd-ph,.smd-feat-img .smd-img{aspect-ratio:1/1}
.smd-num{font-size:40px;font-weight:700;color:#5E5348;line-height:1;margin-bottom:18px}
.smd-feat h3{font-size:24px;font-weight:700;margin-bottom:14px}
.smd-feat p{font-size:18px;color:var(--sub)}
.smd-faq{padding:32px 36px;margin-bottom:18px}
.smd-q,.smd-a{display:flex;gap:16px;align-items:flex-start}
.smd-q{padding-bottom:20px;margin-bottom:20px;border-bottom:1px dashed var(--line)}
.smd-q h3{font-size:22px;font-weight:700;padding-top:3px}
.smd-qa{flex:0 0 36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center}
.smd-qa-a{background:var(--soft);color:var(--accent)}
.smd-a p{font-size:18px;color:#5A5047;padding-top:4px}
.smd-a b{color:var(--ink);font-weight:700}
.smd-info{list-style:none;margin-top:14px;display:flex;flex-direction:column;gap:8px}
.smd-info li{font-size:17px;display:flex;align-items:center;gap:10px}
.smd-info li>span{flex:0 0 auto;padding:3px 10px;border-radius:6px;background:var(--ink);color:#fff;font-size:14px;font-weight:700}
.smd-sub{font-size:16px !important;color:var(--sub) !important;margin-top:10px}
.smd-closing{text-align:center;font-size:20px;font-weight:600;margin-top:36px;color:var(--ink)}
.smd-vwrap{position:relative;width:100%;padding-top:56.25%;border-radius:16px;overflow:hidden}
.smd-vwrap iframe{position:absolute;inset:0;width:100%;height:100%}
.smd-video{display:block;width:100%;border-radius:16px}
.smd{--dark:#3E342C}
.smd-flush-top{line-height:1.5}
.smd-ship{position:relative;overflow:hidden;background:var(--dark);padding:56px 40px 60px;text-align:center}
.smd-ship-circle{position:absolute;right:-90px;top:-110px;width:300px;height:300px;border-radius:50%;background:rgba(255,248,236,0.06)}
.smd-ship-badge{position:relative;display:inline-block;padding:14px 44px;border-radius:999px;background:var(--accent);color:#FFF8EE;font-size:32px;font-weight:800}
.smd-ship-title{position:relative;display:flex;align-items:center;justify-content:center;gap:22px;margin-top:22px;font-size:104px;font-weight:900;line-height:1.1;letter-spacing:-0.04em;color:#FFF8EE}
.smd-ship-title em{font-style:normal;color:#E8A27E;margin-left:-22px}
.smd-truck{width:116px;height:80px;color:#E8A27E;flex:0 0 auto}
.smd-store{display:flex;gap:28px;align-items:center;background:var(--soft);padding:48px 56px}
.smd-store-icon{flex:0 0 92px;height:92px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center}
.smd-store-icon svg{width:50px;height:50px}
.smd-line-pill{display:inline-block;padding:4px 16px;border:2px solid var(--accent);border-radius:999px;color:var(--accent);font-size:16px;font-weight:700;background:var(--card)}
.smd-store-h{font-size:31px;font-weight:800;line-height:1.4;margin:12px 0 14px}
.smd-store-h em,.smd-factory-h em{font-style:normal;color:var(--accent)}
.smd-info-lg li{font-size:20px}
.smd-info-lg li>span{font-size:16px;background:var(--dark)}
.smd-factory{padding:52px 40px 56px;text-align:center}
.smd-factory-h{font-size:33px;font-weight:800;margin:14px 0 26px}
.smd-factory-img{border-radius:18px;box-shadow:0 8px 20px rgba(90,70,40,0.12)}
.smd-cctv{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:20px;padding:20px;border-radius:14px;background:var(--dark);color:#FFF8EE;font-size:23px;font-weight:700}
.smd-cctv i{width:22px;height:22px;border-radius:50%;background:#D9584A;box-shadow:0 0 0 4px rgba(217,88,74,0.3)}
.smd-ggroup{margin-bottom:44px}
.smd-gnote{display:table;margin:-12px auto 36px;padding:12px 24px;border-radius:12px;background:var(--soft);color:var(--accent);font-size:18px;font-weight:700;text-align:center}
.smd-parts{margin-top:14px;padding:16px;display:flex;flex-direction:column;gap:16px}
.smd-parts-img.smd-ph,.smd-parts-img.smd-img{aspect-ratio:3/2;border-radius:12px}
.smd-parts-txt{display:flex;align-items:center;gap:12px;font-size:18px;font-weight:600;color:var(--ink);padding:0 4px 4px}
.smd-parts-txt span{flex:none;padding:5px 14px;border-radius:999px;background:var(--accent);color:#fff;font-size:15px;font-weight:700}
.smd-gtitle{display:flex;align-items:center;gap:12px;font-size:18px;color:var(--sub);margin-bottom:16px}
.smd-gtitle span{padding:5px 16px;border-radius:8px;background:var(--dark);color:#fff;font-weight:700;font-size:17px}
.smd-more summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;margin:0 auto 40px;width:320px;padding:18px;border-radius:999px;border:2px solid var(--accent);color:var(--accent);background:var(--card);font-size:19px;font-weight:700}
.smd-more summary::-webkit-details-marker{display:none}
.smd-more summary b{padding:2px 10px;border-radius:999px;background:var(--accent);color:#fff;font-size:15px}
.smd-more[open] summary{display:none}
.smd-vph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;aspect-ratio:16/9;border-radius:16px;background:#2E2924;color:#E9E1D3;font-size:18px;font-weight:600}
.smd-vph span{font-size:44px;line-height:1}
/* 가독성: 단어 사이가 잘 보이게 자간을 풀고, 줄바꿈을 고르게 */
.smd p,.smd li,.smd td{letter-spacing:-0.005em;word-spacing:0.02em}
.smd{text-wrap:pretty}
.smd-title,.smd-h2,.smd-store-h,.smd-factory-h,.smd-feat h3,.smd-q h3,.smd-tagline,.smd-desc{text-wrap:balance}
.smd-nw{white-space:nowrap}
.smd p.smd-eyebrow{letter-spacing:0.18em}.smd p.smd-pill{letter-spacing:0.12em}.smd p.smd-line-pill,.smd p.smd-ship-badge{letter-spacing:-0.01em}
.smd-info li{align-items:flex-start}
.smd-info li em{font-style:normal;padding-top:2px}
.smd-a p{line-height:1.75}
.smd-a p+p{margin-top:6px}
.smd-vph{padding:0 24px;text-align:center}
@media (max-width:600px){
  .smd-pad{padding:56px 20px}
  .smd-title{font-size:30px}.smd-tagline{font-size:17px}.smd-h2{font-size:26px}
  .smd-table{font-size:15px}.smd-table th{font-size:14px;padding:14px 4px}.smd-table td{padding:16px 4px}
  .smd-table-opt{font-size:13px;letter-spacing:-0.02em}.smd-table-opt th{font-size:12px;padding:12px 2px}.smd-table-opt th small{font-size:11px}.smd-table-opt td{padding:14px 2px}
  .smd-table-opt .smd-opt span{min-width:0;padding:3px 6px;font-size:12px;word-break:keep-all}.smd-table-opt .smd-price{white-space:nowrap}
  .smd-feat{flex-direction:column;gap:20px;padding:24px}.smd-feat-img{flex:none;width:100%}
  .smd-ship-badge{font-size:18px;padding:10px 22px}.smd-ship-title{font-size:56px;gap:12px}.smd-ship-title em{margin-left:-12px}.smd-truck{width:62px;height:44px}
  .smd-store{padding:32px 20px;gap:16px}.smd-store-icon{flex-basis:56px;height:56px}.smd-store-icon svg{width:30px;height:30px}.smd-store-h{font-size:20px}.smd-info-lg li{font-size:15px}
  .smd-factory{padding:36px 20px}.smd-factory-h{font-size:20px}.smd-cctv{font-size:16px}
  .smd-faq{padding:24px 20px}.smd-q h3{font-size:18px}.smd-a p{font-size:16px;line-height:1.8}
  .smd-q,.smd-a{gap:12px}.smd-qa{flex-basis:30px;height:30px;font-size:15px}
  .smd-q{padding-bottom:16px;margin-bottom:16px}
  .smd-info li{font-size:15px}.smd-info li>span{font-size:13px}
  .smd-sub{font-size:14px !important;line-height:1.7}
  .smd-desc{font-size:16px;line-height:1.8}
  .smd-feat h3{font-size:20px}.smd-feat p{font-size:16px;line-height:1.75}
  .smd-gtitle{font-size:15px}
  .smd-gnote{font-size:15px;padding:10px 18px;margin-bottom:28px}
  .smd-parts{padding:12px}.smd-parts-txt{font-size:16px;gap:10px}.smd-parts-txt span{font-size:13px;padding:4px 12px}
  .smd-vph{font-size:15px}
}`;

// 카페24 PC 화면: 860 디자인을 cafe24PcWidth(기본 600)로 축소해서 보여줌. 축소돼도 읽기 좋게 작은 글자는 키움.
// 휴대폰(700px 미만 화면)에서는 축소하지 않고 모바일 레이아웃을 사용.
const PC_CSS = `
@media (min-width:700px){
  .smd-pc{width:860px;max-width:none;zoom:var(--pcz)}
  .smd-pc .smd-a p,.smd-pc .smd-feat p{font-size:22px}
  .smd-pc .smd-desc{font-size:23px}.smd-pc .smd-tagline{font-size:25px}
  .smd-pc .smd-table{font-size:23px}.smd-pc .smd-table th{font-size:21px}.smd-pc .smd-table th small{font-size:16px}
  .smd-pc .smd-info li{font-size:21px}.smd-pc .smd-info li>span{font-size:17px}.smd-pc .smd-info-lg li{font-size:23px}
  .smd-pc .smd-note{font-size:19px}.smd-pc .smd-sub{font-size:19px !important}.smd-pc .smd-gtitle{font-size:21px}.smd-pc .smd-gnote{font-size:22px}.smd-pc .smd-parts-txt{font-size:22px}.smd-pc .smd-parts-txt span{font-size:18px}
  .smd-pc .smd-eyebrow{font-size:18px}.smd-pc .smd-line-pill{font-size:19px}
  .smd-pc .smd-q h3{font-size:26px}.smd-pc .smd-feat h3{font-size:27px}.smd-pc .smd-closing{font-size:23px}
  .smd-pc .smd-more summary{font-size:22px}.smd-pc .smd-vph{font-size:22px}
}`;

// 카페24용: 웹폰트는 CDN, 공통 이미지는 cafe24Images 주소
const cdnFont = `@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');`;
fs.writeFileSync(path.join(OUT, 'cafe24.html'), render(common.assetBaseUrl, cdnFont, true));
if (process.env.HTML_ONLY) { console.log('cafe24.html 생성: ' + OUT); process.exit(0); }

// 미리보기/이미지 변환용: 로컬 폰트·이미지
const fdir = path.join(ROOT, 'node_modules/pretendard/dist/web/static/woff2');
const localFont = [['Regular', 400], ['Medium', 500], ['SemiBold', 600], ['Bold', 700], ['ExtraBold', 800]]
  .map(([n, w]) => `@font-face{font-family:'Pretendard';font-weight:${w};src:url('file://${fdir}/Pretendard-${n}.woff2') format('woff2')}`).join('');
const { execFileSync } = require('child_process');
const CACHE = path.join(ROOT, '.cache');
fs.mkdirSync(CACHE, { recursive: true });
RES = (u) => {
  if (!/^https?:/.test(u)) return u;
  const f = path.join(CACHE, u.replace(/^https?:\/\//, '').replace(/[^\w.-]/g, '_'));
  if (!fs.existsSync(f)) execFileSync('curl', ['-sSfL', '-o', f, u]);
  return 'file://' + f;
};
PREVIEW = true;
const previewHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)} 상세페이지</title>
<style>html,body{margin:0;background:#E9E4DA}</style></head><body>${render('file://' + path.join(ROOT, 'assets') + '/', localFont)}</body></html>`;
fs.writeFileSync(path.join(OUT, 'preview.html'), previewHtml);

// 카페24 실제 화면 미리보기: 실제 카페24 이미지 주소(축소된 공통 이미지 포함)를 받아와 스킨 폭(1360px) 안에 넣어 봄
const cafe24Preview = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>카페24 미리보기</title>
<style>html,body{margin:0;background:#fff}.skin{max-width:1360px;margin:0 auto;padding:40px 0;text-align:center}</style></head><body><div class="skin">${render(common.assetBaseUrl, localFont, true)}</div></body></html>`;
fs.writeFileSync(path.join(OUT, 'cafe24-preview.html'), cafe24Preview);

// 오픈마켓용 분할 이미지 (섹션 단위, 동영상 섹션 제외)
(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 860, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(OUT, 'preview.html'));
  await page.evaluate(() => document.fonts.ready);
  for (const f of fs.readdirSync(path.join(OUT, 'market'))) fs.unlinkSync(path.join(OUT, 'market', f));
  const secs = await page.$$('section.smd-sec:not(.smd-video-sec)');
  let n = 1;
  for (const el of secs) {
    await el.screenshot({ path: path.join(OUT, 'market', `${String(n++).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  await (await page.$('.smd')).screenshot({ path: path.join(OUT, 'full.jpg'), type: 'jpeg', quality: 85 });

  // 카페24 PC(레티나 2배)·모바일 화면 캡처 + 사진 선명도 점검
  const pcPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await pcPage.goto('file://' + path.join(OUT, 'cafe24-preview.html'));
  await pcPage.evaluate(() => document.fonts.ready);
  await pcPage.evaluate(() => document.querySelector('.smd-more')?.setAttribute('open', ''));
  await (await pcPage.$('.smd')).screenshot({ path: path.join(OUT, 'cafe24-pc.jpg'), type: 'jpeg', quality: 80 });
  const report = await pcPage.evaluate(() => [...document.querySelectorAll('.smd img')].map(i => {
    return { src: i.currentSrc.split('/').pop().slice(-40), alt: i.alt, shown: Math.round(i.getBoundingClientRect().width), natural: i.naturalWidth };
  }));
  const mPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
  await mPage.goto('file://' + path.join(OUT, 'cafe24-preview.html'));
  await mPage.evaluate(() => document.fonts.ready);
  await (await mPage.$('.smd')).screenshot({ path: path.join(OUT, 'cafe24-mobile.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  const lines = [];
  let warn = 0;
  for (const r of report) {
    const ratio = r.natural / r.shown;
    const mark = ratio >= 2 ? '선명' : ratio >= 1 ? '보통 (레티나 화면에서 약간 흐림)' : '흐림 (일반 모니터에서도 흐림)';
    if (ratio < 1) warn++;
    lines.push(`${mark.padEnd(4)} | 보이는 폭 ${r.shown}px, 원본 ${r.natural}px | ${r.alt} | ${r.src}`);
  }
  fs.writeFileSync(path.join(OUT, 'sharpness.txt'), lines.join('\n') + '\n');
  console.log(`사진 선명도: ${report.length}장 중 흐림 ${warn}장 (자세한 내용 sharpness.txt)`);
  await browser.close();
  console.log(`완료: ${OUT}  (분할 이미지 ${n - 1}장)`);
})();
