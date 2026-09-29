export function errorMessage(failure: unknown, fallback: string) {
  return failure instanceof Error ? failure.message : fallback
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
