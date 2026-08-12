/**
 * 打包脚本：构建后把 dist/ 打成 release/bugreplay-vX.Y.Z.zip
 *
 * 用法：
 *   pnpm package                        # 先 build 再打包
 *   node scripts/package.mjs --no-build  # 跳过 build（CI 中已构建）
 */
import { execSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const skipBuild = process.argv.includes('--no-build');
if (!skipBuild) {
    console.log('📦 构建中...');
    execSync('pnpm build', { cwd: root, stdio: 'inherit' });
}

const version = pkg.version;
const releaseDir = path.join(root, 'release');
mkdirSync(releaseDir, { recursive: true });

const zipPath = path.join(releaseDir, `bugreplay-v${version}.zip`);
try {
    rmSync(zipPath, { force: true });
}
catch {
    // ignore
}

const output = createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', (err) => {
    throw err;
});
output.on('close', () => {
    console.log(`✅ 打包完成: ${zipPath}`);
    console.log(`   大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.pipe(output);
archive.directory(path.join(root, 'dist'), false);
await archive.finalize();
