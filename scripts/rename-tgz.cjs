// 把 npm pack 默认输出的 vue-plugin-hiprint-<version>.tgz 重命名为固定名 vue-plugin-hiprint.tgz。
// 版本号通过 package.json 控制，不再泄漏到产物文件名（方便其他项目通过固定路径 npm i ./vue-plugin-hiprint.tgz）。
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const versionedName = `${pkg.name}-${pkg.version}.tgz`;
const fixedName = `${pkg.name}.tgz`;
const versionedPath = path.join(__dirname, '..', versionedName);
const fixedPath = path.join(__dirname, '..', fixedName);

if (!fs.existsSync(versionedPath)) {
  console.error(`[rename-tgz] not found: ${versionedName}. Run "npm pack" first.`);
  process.exit(1);
}
if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath);
fs.renameSync(versionedPath, fixedPath);
console.log(`[rename-tgz] ${versionedName} → ${fixedName} (v${pkg.version} 内部记录)`);
