export const requireApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY 환경변수가 필요해");
    process.exit(1);
  }

  return apiKey;
};
