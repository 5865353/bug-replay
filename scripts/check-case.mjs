/**
 * 大小写一致性检查（修复 CI 大小写问题的辅助工具）
 *
 * Windows 文件系统大小写不敏感，可能导致 git 记录的文件名与代码 import 的大小写不一致；
 * 而 Linux（GitHub Actions）大小写敏感，会在构建时报 "Cannot find module"。
 * 本脚本对比代码中的相对 import 与 git 索引记录的真实大小写，找出所有不一致项。
 *
 * 用法：node scripts/check-case.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

// git 索引中记录的文件（保留真实大小写）
const gitFiles = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const gitByLower = new Map(gitFiles.map(f => [f.toLowerCase(), f]));

const FILE_EXTS = new Set(['.ts', '.vue', '.js', '.mjs']);
const SPEC_EXTS = ['.ts', '.vue', '.js', '.mjs'];

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory())
            out.push(...walk(full));
        else
            out.push(full);
    }
    return out;
}

const problems = [];
const reImport = /(?:from\s+|import\s*)['"]([^'"]+)['"]/g;

for (const dir of ['src', 'scripts']) {
    if (!statSync(dir, { throwIfNoEntry: false }))
        continue;
    for (const file of walk(dir)) {
        if (!FILE_EXTS.has(path.extname(file)))
            continue;
        const content = readFileSync(file, 'utf8');
        let m;
        while ((m = reImport.exec(content))) {
            const spec = m[1];
            if (!spec.startsWith('.'))
                continue;
            let resolved = path.resolve(path.dirname(file), spec);
            if (!FILE_EXTS.has(path.extname(resolved))) {
                for (const ext of SPEC_EXTS) {
                    if (statSync(resolved + ext, { throwIfNoEntry: false })) {
                        resolved += ext;
                        break;
                    }
                }
            }
            if (!statSync(resolved, { throwIfNoEntry: false }))
                continue;
            const rel = path.relative(root, resolved).split(path.sep).join('/');
            const recorded = gitByLower.get(rel.toLowerCase());
            if (recorded && recorded !== rel) {
                problems.push(`  ${path.relative(root, file)}\n    import '${spec}' → 实际文件 ${recorded}`);
            }
        }
    }
}

if (problems.length) {
    console.log('⚠️ 发现大小写不一致（会导致 Linux 构建失败）:');
    console.log(problems.join('\n'));
    process.exit(1);
}
else {
    console.log('✅ 未发现大小写不一致，可以放心推送到 CI');
}
