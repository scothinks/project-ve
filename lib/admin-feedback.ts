export function appendAdminNotice(redirectTo: string, notice: string) {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}notice=${encodeURIComponent(notice)}`;
}
