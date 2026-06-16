// 앱 아이콘 PNG 일괄 생성 스크립트.
// 마스터 소스: scripts/icon-source.svg → sharp로 각 타깃 사이즈 래스터화.
// 실행: pnpm -C web exec node scripts/gen-icons.mjs
//
// 생성물:
//   public/icons/icon-192.png, icon-512.png  → manifest(설치/Android)
//   src/app/apple-icon.png (180, 풀블리드)    → iOS 홈 화면 아이콘(apple-touch-icon)
//   src/app/icon.png (256)                    → 브라우저 탭 파비콘(<link rel="icon">)
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const svg = readFileSync(resolve(here, "icon-source.svg"));

const targets = [
  { size: 512, out: "public/icons/icon-512.png" },
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 180, out: "src/app/apple-icon.png" },
  { size: 256, out: "src/app/icon.png" },
];

for (const t of targets) {
  const outPath = resolve(webRoot, t.out);
  mkdirSync(dirname(outPath), { recursive: true });
  // density를 높여 큰 래스터로 렌더 후 다운스케일 → 작은 사이즈에서도 선명
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓ ${t.out} (${t.size}x${t.size})`);
}
console.log("done.");
