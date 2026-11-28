# Portfolio — plan & checklist

Session chính giữ file này: thêm việc, giao cho nhóm, đánh dấu xong khi đã kiểm kết quả.
Session con không sửa file này; xong việc thì báo về session chính.

## Luật chung

- Tất cả làm chung thư mục repo này. Mỗi session con **chỉ sửa file thuộc nhóm mình** (bảng dưới).
- Cần sửa file của nhóm khác (nhất là Nền chung) thì **không tự sửa**: báo về session chính, session chính chuyển cho nhóm đó.
- Không commit, không đổi branch, không `push`. Đồng bộ 2 máy do session chính / chú làm (`work_sync.py`).
- Dev server dùng chung cổng 5173 (config `portfolio`). Trước khi start thì `curl -s localhost:5173`; cổng sống thì chỉ `navigate`, không start thêm.
- File mới phát sinh thì thuộc nhóm của trang dùng nó; không rõ thì hỏi session chính.

## Chia nhóm & quyền file

| Nhóm | File được sửa |
|---|---|
| 1. Trang chủ | `index.html`, `css/base/mobile.css`, `css/pages/{work,thumb,spotlight,marquee,experience,about,playground}.css`, `js/pages/{intro,work,thumb,spotlight,marquee,experience,about,playground,fit-stage,img-enter,scroll-fx,section-indicator,cursor-guide}.js` |
| 2. Case DEC | `work/dec.html`, `css/pages/case-dec.css`, `js/pages/case-dec.js`, `js/pages/case-dec-i18n.js` |
| 3. Case OneU | `work/oneu.html`, `css/pages/case-oneu.css`, `js/pages/case-oneu-i18n.js`, `js/pages/case-compare.js` |
| 4. Nền chung | `css/base/*` trừ `mobile.css` (tokens, type, theme, case, case-dark, case-nav, case-marquee, pref-combo), `js/base/*`, `js/pages/{lang,theme}.js`, `assets/shared/*` |

`_review/`, `scripts/`, `_plan/` thuộc session chính.

## Đang dở (chưa commit, trước khi chia session)

11 file đang sửa: `css/base/{case-dark,case-marquee,case,mobile,theme}.css`, `css/pages/{case-dec,case-oneu}.css`, `index.html`, `js/pages/case-dec-i18n.js`, `work/{dec,oneu}.html`.
Session con cứ làm tiếp trên đó, không revert.

## Đợt Responsive (đang plan, chưa giao)

### Hiện trạng (rà ngày 29/11)
- **Có 2 kiểu layout khác nhau:**
  - Trang chủ là "stage" 1920px thu nhỏ cho vừa màn (`fit-stage.js`, `--stage-scale`). Ở ≤767 thì `mobile.css` cho từng section tự scale theo độ rộng nội dung.
  - Case DEC/OneU co giãn theo `--case-u` và chỉ có 2 nấc: desktop ≥1024, còn ≤1023 là mobile (thiết kế cho 390).
- **Breakpoint lệch nhau:** trang chủ dùng 767, case dùng 1023. Tablet 768–1023 thì bị kéo về hai phía: trang chủ hiện bản desktop thu nhỏ (chữ bé), còn case hiện bản 390 kéo giãn ra.
- `css/base/mobile.css` thật ra chỉ trang chủ nạp (header file cũng ghi "for the home page"), nên chuyển quyền sửa nó sang nhóm 1.

### Đã chốt (29/11)
1. **Tablet 768–1023:** case có nấc tablet riêng (cột, padding, cỡ chữ rộng hơn phone). Trang chủ: chú đổi lại, **tablet giữ bản desktop**. `mobile.css` và `fit-stage.js` vẫn ở nấc ≤767.
2. **Cỡ màn kiểm:** 375 · 390 · 430 · 768 · 1024 · 1280 · 1440 · 1920.
3. `css/base/mobile.css` chuyển sang **nhóm 1 Trang chủ**.

### Đợt 1: phần chung (nhóm 4 Nền chung làm trước, mấy nhóm kia chờ)
- [ ] **R1. Quy ước breakpoint:** phone ≤767 · tablet 768–1023 · desktop ≥1024. Ghi vào đầu `tokens.css` và vào file này. Biến CSS không dùng được trong `@media`, nên chỉ chốt số rồi nhóm nào cũng theo.
- [ ] **R2. Khung case (`case.css`):** tách khối `max-width: 1023px` hiện có thành 2 nấc tablet và phone. Phone giữ nguyên các rule 390 đang có. Tablet thì chỉnh `--case-w`, padding, gap, `case-row`/`case-cols3`/`case-meta` (theo câu 1).
- [ ] **R3. Cỡ chữ theo nấc:** sàn `--u`, `--b1-size`, `--b2-size` cho tablet (`type.css`/`case.css`). Kiểm heading không bị tràn ở 375.
- [ ] **R4. Thành phần dùng chung:** `case-nav.css` (padding-top cho case-s--first, nav trên phone), `case-marquee.css` (bleed dưới 1024), `pref-combo.css` (nút theme/ngôn ngữ trên phone), `case-dark.css` nếu có rule theo nấc.
- [ ] **R5. Kiểm khung:** mở dec + oneu ở các cỡ màn câu 2, liệt kê chỗ vỡ thuộc file trang (ghi vào checklist nhóm 2/3 dưới đây), không tự sửa.

### Đợt 2: từng trang (song song sau khi Đợt 1 xong, chú vào từng session làm chi tiết)
- **Nhóm 1 Trang chủ:** nhận thêm `mobile.css`. Chốt cách hiện tablet (câu 1) trong `fit-stage.js` và `mobile.css`. Rà từng section: hero, about, experience, marquee, work, playground, spotlight.
- **Nhóm 2 Case DEC:** gộp 2 khối `@media` của `case-dec.css` theo quy ước nấc mới, sửa chỗ vỡ mà R5 liệt kê.
- **Nhóm 3 Case OneU:** `case-oneu.css` có 7 khối `@media` (1023/1024) cần chuyển theo nấc mới, kiểm thêm `case-compare.js` trên màn cảm ứng.

## Checklist

Kiểm tổng 29/11: 3 trang × 8 cỡ màn đều không tràn ngang (scrollWidth = innerWidth, không có phần tử nào lòi ra ngoài khung cuộn).

### 1. Trang chủ
- [x] Đợt 2: hero phone khớp Figma (4 ảnh, cụm avatar + Share, nút theme/ngôn ngữ ở giữa đáy). Playground phone hết tràn ngang. Tablet giữ desktop. (29/11)
- [x] Nút ? cùng nền với cụm −/+ ở dark/light (29/11)
- [ ] **Design – chờ chú:** letter-spacing headline hero ở phone. "AI Product Design" -2% (hẹp hơn Figma khoảng 2%), "</Engineer>" -7px (rộng hơn Figma). Nới về 0 hay giữ?
- [ ] Dọn file `assets/home/thumb/help-bubble.svg` (không còn dùng)

### 2. Case DEC
- [x] Đợt 2: 5 chỗ lề cứng → `var(--case-pad)`, `.dec-s07__fig` hết tràn (29/11)
- [ ] **Design – chờ chú (tablet 768–1023):** ảnh s07 phóng 230% quá tay; dãy 3 điện thoại thừa khoảng 64px nên phải cuộn; khối số liệu 1 cột, tablet đủ chỗ cho 3 cột; bảng ở 1023 chỉ thiếu chút xíu là vừa khỏi cuộn
- [ ] **Có từ trước, hỏi chú:** desktop `.dec-panel` lề trái ít hơn lề phải khoảng 15–24px, cố ý không?
- [ ] Tách khối ≤767 riêng sau khi chốt design tablet

### 3. Case OneU
- [x] Đợt 2: caption s11 hết đẩy trang rộng 1311px; 5 khối `@media` gom thành 3 nấc; s05 tablet hết tràn; s14 theo `--case-pad`; vùng mờ s10/s11 chuyển sang %; `case-compare.js` chạm để nhảy (29/11)
- [ ] **Design – chờ chú:** s11 phone caption 2 dòng, điện thoại trông bé và nhạt; s14 phone ảnh 734px bị cắt hai bên; s05 tablet logo bé; s08/s15 tablet xếp 1 hàng do session tự chọn

### 4. Nền chung
- [x] Đợt 1 responsive R1–R5: breakpoint ghi ở `tokens.css`, `case.css` tách tablet/phone + token `--case-pad`, `case-nav` hết đè nút theme ở phone, marquee tràn full màn (29/11)
- [x] Dọn selector thừa `.help img` trong `theme.css` (29/11)
- [ ] Phone 375: tên trang trên case-nav bị cắt còn "D…"
- [ ] Sau khi các trang dọn xong: bỏ LEGACY aliases `--case-font-*`, `--case-title-size`… trong `case.css` (chờ nhóm 2/3 chuyển sang class t-*)

## Xong
