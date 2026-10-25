export async function copyText(text: string, html?: string): Promise<void> {
  try {
    if (html && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      })]);
      return;
    }
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Some browsers reject the clipboard API on the first focus/permission change.
    // Fall back to a selected text field during the same copy action.
    const previousFocus = document.activeElement as HTMLElement | null;
    const selection = window.getSelection();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
    const field = document.createElement("textarea");
    field.value = text;
    field.readOnly = true;
    field.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
    document.body.appendChild(field);
    const copyFormatted = (event: ClipboardEvent) => {
      if (!html || !event.clipboardData) return;
      event.clipboardData.setData("text/plain", text);
      event.clipboardData.setData("text/html", html);
      event.preventDefault();
    };
    document.addEventListener("copy", copyFormatted);
    try {
      field.focus({ preventScroll: true });
      field.select();
      if (!document.execCommand("copy")) throw new Error("Copy unavailable");
    } finally {
      document.removeEventListener("copy", copyFormatted);
      field.remove();
      previousFocus?.focus({ preventScroll: true });
      selection?.removeAllRanges();
      ranges.forEach((range) => selection?.addRange(range));
    }
  }
}
