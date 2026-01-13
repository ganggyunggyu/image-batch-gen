# image-batch-gen

## 모델과 환경 변수
- API 키: `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY` 중 하나 필요.
- 이미지 출력(Developer API): `gemini-3-pro-image-preview` (기본), `gemini-2.0-pro-exp-02-05`, `gemini-2.0-flash`
- Imagen 3 generate/edit 메서드는 Vertex 전용이라 여기서는 사용하지 않는다. (Vertex를 쓰려면 별도 자격으로 SDK 초기화 필요)
- 선택 변수:
  - `IMAGE_MODEL`: 위 모델 중 하나로 교체
  - `IMAGE_ASPECT_RATIO`: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`
  - `IMAGE_DELAY_MS`: 호출 사이 딜레이(ms). `batch`도 공유
  - `IMAGE_BATCH_CONCURRENCY`: `batch` 동시 처리 개수
  - `IMAGE_RETRY_ATTEMPTS`: 503/UNAVAILABLE 시 재시도 횟수(기본 2회)
  - `IMAGE_RETRY_DELAY_MS`: 재시도 간격(ms, 기본 2000, 시도마다 가중)

## 프롬프트 규칙
- `PROMPT_VERSION` 환경변수로 프롬프트 버전 선택 (기본: v1)
- `_prompt_v1.txt`, `_prompt_v2.txt` 등 버전별 파일 사용
- 파일명에서 `{item}` 토큰을 실제 품목명으로 치환
- 입력 이미지는 요청에 같이 붙으며, 프롬프트에서 "첨부한 이미지를 이런 스타일로 바꿔줘"처럼 지시하면 된다

### 프롬프트 버전
| 버전 | 파일 | 설명 |
|------|------|------|
| v1 | `_prompt_v1.txt` | 프리미엄 에디토리얼 스타일 변환 (색상/패턴 변경, 영어 텍스트) |
| v2 | `_prompt_v2.txt` | 한국어 → 영어 라벨링 + 서양식 패키징 디자인 변환 |

## 사용
- `npm run single`: 입력 폴더 이미지를 순차 처리(기본 5초 딜레이).
- `npm run batch`: 동시 큐로 다수 이미지 처리, `output/`에 결과 및 리포트 저장.
