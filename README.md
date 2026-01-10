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

## 프롬프트 규칙
- `_prompt.txt` 내용을 우선 사용, 없으면 CLI 인자 사용.
- 파일명에서 `{item}` 토큰을 실제 품목명으로 치환.
- 입력 이미지는 요청에 같이 붙으며, 프롬프트에서 “첨부한 이미지를 이런 스타일로 바꿔줘”처럼 지시하면 된다.

## 사용
- `npm run single`: 입력 폴더 이미지를 순차 처리(기본 5초 딜레이).
- `npm run batch`: 동시 큐로 다수 이미지 처리, `output/`에 결과 및 리포트 저장.
