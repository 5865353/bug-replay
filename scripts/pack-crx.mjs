/**
 * 打包 crx 脚本：把 dist/ 打包成 release/bugreplay-vX.Y.Z.crx
 *
 * 说明：
 * - 使用 crx 包（crx3 格式，Chrome 85+ 支持）
 * - 私钥保存在 release/bugreplay.pem，第一次自动生成，之后复用
 *   （私钥决定扩展 ID，务必保存；丢失/更换会导致 ID 变化）
 *
 * 用法：
 *   pnpm pack:crx                    # 先 build 再打包 crx
 *   node scripts/pack-crx.mjs --no-build  # 跳过 build（与 pnpm package 配合时用）
 */
import { execSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Crx = require('crx');

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

const crxPath = path.join(releaseDir, `bugreplay-v${version}.crx`);
const keyPath = path.join(releaseDir, 'bugreplay.pem');

// ---- 私钥：CI 环境变量 > 本地 pem 复用 > 首次生成（保证扩展 ID 稳定）----
if (!existsSync(keyPath) && process.env.CRX_PRIVATE_KEY) {
    writeFileSync(keyPath, process.env.CRX_PRIVATE_KEY);
    console.log('🔑 已从环境变量 CRX_PRIVATE_KEY 写入私钥');
}
if (!existsSync(keyPath)) {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    console.log(`🔑 已生成新私钥: ${keyPath}`);
    console.log('   请妥善保存该文件！丢失或更换会导致扩展 ID 变化。');
}
const privateKey = readFileSync(keyPath, 'utf8');

rmSync(crxPath, { force: true });

// ---- 打包 ----
const crx = new Crx({ privateKey, rootDirectory: path.join(root, 'dist') });
const buffer = await crx.pack();
writeFileSync(crxPath, buffer);

console.log(`✅ crx 打包完成: ${crxPath}`);
console.log(`   大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
