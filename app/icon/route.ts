import { createBrowserIcon } from "../../components/brand/BrowserIcon";

const supportedSizes = new Set([32, 192, 512]);

export function GET(request: Request) {
  const requestedSize = Number(new URL(request.url).searchParams.get("size"));
  return createBrowserIcon(supportedSizes.has(requestedSize) ? requestedSize : 512);
}
