export async function downloadGithubProjectZip(): Promise<void> {
  const response = await fetch('/api/export-project.zip', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorMessage = '프로젝트 압축 파일을 내려받지 못했습니다.';
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        errorMessage = payload.error;
      }
    } catch {
      // ignore non-JSON error response
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = 'studyon-github-project.zip';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }, 1500);
}
