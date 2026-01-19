# Image Batch Generator 사용 가이드

## 기본 실행

```bash
npm run google:single -- [템플릿명] [생성개수]
```

### 예시
```bash
# pouch 템플릿으로 5개 생성
npm run google:single -- pouch 5

# tbag 템플릿으로 3개 생성
npm run google:single -- tbag 3

# mask 템플릿으로 1개 생성 (기본값)
npm run google:single -- mask
```

---

## 템플릿 목록

| 템플릿 | 별칭 | 설명 |
|--------|------|------|
| `mask` | facial, sheet | 시트 마스크팩 (플랫 파우치) |
| `pouch` | p, standup, doypack | 스탠드업 도이팩 |
| `spout` | s, liquid, nozzle | 스파우트 파우치 (액상용) |
| `mbag` | m, side, gusset, brick | 사이드 거셋 파우치 |
| `box` | b, flat, block, square | 플랫 바텀 박스 파우치 |
| `tbag` | t, tseal, narrow, slim | T-seal 파우치 (좁고 긴 형태) |
| `tbagthick` | tt, thick, bulky, cotton | T-seal 파우치 (두꺼운 형태) |

---

## 카테고리 전환

### 방법 1: 환경변수로 실행
```bash
# 식품 카테고리
CATEGORY_TYPE=food npm run google:single -- pouch 5

# 뷰티 카테고리
CATEGORY_TYPE=beauty npm run google:single -- mask 5
```

### 방법 2: .env 파일 수정
```env
# .env 파일
CATEGORY_TYPE=food    # 또는 beauty
```

### 카테고리별 차이점

| 항목 | food | beauty |
|------|------|--------|
| 제품 종류 | coffee beans, protein powder, granola... | skincare, serum, moisturizing... |
| 제품명 | NATURE CRUNCH, POWER FUEL, PURE HARVEST... | AQUA GLOW, PURE BLOOM, SKIN ELIXIR... |

---

## 환경변수 설정 (.env)

```env
# 필수
GEMINI_API_KEY=your_api_key_here

# 선택
IMAGE_MODEL=gemini-2.0-flash-preview-image-generation  # 모델
IMAGE_ASPECT_RATIO=4:5                                   # 비율 (1:1, 16:9, 4:5 등)
IMAGE_DELAY_MS=2000                                      # 생성 간 딜레이 (ms)
IMAGE_COUNT=1                                            # 기본 생성 개수
CATEGORY_TYPE=food                                       # food 또는 beauty
REMOVE_WATERMARK=true                                    # 워터마크 자동 제거
```

---

## 프롬프트 변수

템플릿에서 사용되는 변수들 (자동으로 랜덤 선택됨):

| 변수 | 설명 | 예시 |
|------|------|------|
| `[PRODUCT_NAME]` | 제품명 | POWER FUEL, AQUA GLOW |
| `[PRODUCT_CATEGORY]` | 제품 종류 | premium coffee beans, vitamin C serum |
| `[DESIGN_THEME_AND_GRAPHICS]` | 디자인 테마 | minimalist line art, bold geometric patterns |
| `[DESIGN_THEME_COLOR]` | 색상 팔레트 | earthy brown and cream, vibrant orange |
| `[COLOR_MOOD]` | 색상 무드 | pastel pink gradient, mint green fresh |
| `[TEXTURE_OR_FINISH]` | 마감 처리 | matte lamination, glossy high-shine |
| `[TEXTURE_OR_WINDOW]` | 텍스처/창 | transparent window panel, kraft paper |
| `[ZIPPER_TYPE]` | 지퍼 종류 | resealable zipper, press-to-close |

---

## 출력 구조

```
output/
├── pouch_1737123456789/
│   ├── pouch_1737123456789_1.png
│   ├── pouch_1737123456789_2.png
│   └── pouch_1737123456789_3.png
├── mask_1737123456790/
│   └── mask_1737123456790_1.png
└── ...
```

---

## 커스텀 프롬프트 사용

`_prompt.txt` 파일을 프로젝트 루트에 생성하면 템플릿 대신 해당 프롬프트 사용:

```bash
# _prompt.txt 내용이 프롬프트로 사용됨
npm run google:single -- 5
```

---

## 실행 예시 출력

```
=== 이미지 생성 ===
모델: gemini-2.0-flash-preview-image-generation
예시 모델: gemini-2.0-flash-preview-image-generation, imagen-3.0-generate-002
카테고리: food
워터마크 제거: ON
생성 수: 5
템플릿: pouch
프롬프트: Stand-up Doypack pouch, visible bottom gusset, standing upright...
딜레이: 2000ms
========================

[1/5] 생성 중...
  → prompt:
Stand-up Doypack pouch, visible bottom gusset, standing upright, resealable zipper line at top, premium coffee beans packaging design, earthy brown and cream color palette...

  → 워터마크 제거 중...
  ✓ output/food/pouch/1.png
[2/5] 생성 중...
...

=== 결과 ===
성공: 5/5
실패: 0/5
```

---

## 자주 쓰는 명령어

```bash
# 식품 파우치 10개
CATEGORY_TYPE=food npm run google:single -- pouch 10

# 뷰티 마스크팩 5개
CATEGORY_TYPE=beauty npm run google:single -- mask 5

# T-seal 파우치 (좁은 형태) 3개
npm run google:single -- t 3

# T-seal 파우치 (두꺼운 형태) 3개
npm run google:single -- tt 3

# 스파우트 파우치 (액상용) 5개
npm run google:single -- spout 5

# 박스 파우치 5개
npm run google:single -- box 5
```
