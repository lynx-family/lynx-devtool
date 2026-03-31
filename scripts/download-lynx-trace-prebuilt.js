#!/usr/bin/env node

/**
 * 下载预编译的 lynx-trace 文件
 * 用于 Windows 环境跳过本地编译
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 配置
const GITHUB_REPO = 'lynx-family/lynx-trace';
const ASSET_PATTERN = /perfetto-ui-.*\.tar\.gz$/;  // 匹配 perfetto-ui-*.tar.gz
const DEST_DIR = path.join(__dirname, '..', 'packages', 'lynx-devtool-cli', 'resources');
const DEST_FILE = path.join(DEST_DIR, 'lynx-trace.tar.gz');

console.log('📦 正在下载预编译的 lynx-trace...\n');

/**
 * 获取最新 release 信息
 */
function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    let agent = undefined;
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    if (proxy) {
      agent = new HttpsProxyAgent(proxy);
      console.log(`🌐 检测到代理: ${proxy}`);
    }
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'lynx-devtool-downloader',
        'Accept': 'application/vnd.github.v3+json'
      },
      agent:agent
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`解析 JSON 失败: ${error.message}`));
          }
        } else {
          reject(new Error(`GitHub API 请求失败: ${res.statusCode} ${data}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 下载文件
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`⬇️ download url: ${url}`);
    console.log(`📁 dest: ${dest}\n`);

    const file = fs.createWriteStream(dest);
    let downloadedSize = 0;
    let totalSize = 0;
    

    // 支持自动检测网络代理
    const { HttpsProxyAgent } = require('https-proxy-agent');
    let agent = undefined;
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    if (proxy) {
      agent = new HttpsProxyAgent(proxy);
      console.log(`🌐 Detect proxy from env: ${proxy}`);
    }

    https.get(url, {
      headers: {
        'User-Agent': 'lynx-devtool-downloader'
      },
      agent:agent
    }, (response) => {
      // 处理重定向
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`download failed: HTTP ${response.statusCode}`));
      }

      totalSize = parseInt(response.headers['content-length'], 10);
      console.log(`📦 file-size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        const downloaded = (downloadedSize / 1024 / 1024).toFixed(2);
        const total = (totalSize / 1024 / 1024).toFixed(2);
        
        process.stdout.write(
          `\r⏳ 下载进度: ${percent}% (${downloaded}MB / ${total}MB)`
        );
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n');
        resolve();
      });

      file.on('error', (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    // 确保目标目录存在
    if (!fs.existsSync(DEST_DIR)) {
      fs.mkdirSync(DEST_DIR, { recursive: true });
      console.log(`✅ create dest dir: ${DEST_DIR}\n`);
    }

    // 检查是否已存在
    if (fs.existsSync(DEST_FILE)) {
      const stats = fs.statSync(DEST_FILE);
      const size = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`⚠️  found existing file: ${DEST_FILE}`);
      console.log(`    file-size: ${size} MB`);
      console.log(`    modified-time: ${stats.mtime.toLocaleString()}\n`);
      
      // 询问是否覆盖（在非交互环境中默认跳过）
      if (process.stdout.isTTY) {
        console.log('💡 hint: file already exists, please delete it before downloading again\n');
        console.log('✅ skip download, use existing file');
        return;
      }
    }

    console.log(`🔍 query latest release of ${GITHUB_REPO}...\n`);
    
    // 获取最新 release
    const release = await getLatestRelease();
    console.log(`✅ found release: ${release.tag_name || release.name}`);
    console.log(`    published-time: ${new Date(release.published_at).toLocaleString()}\n`);

    // 查找匹配的 asset
    const asset = release.assets.find(a => ASSET_PATTERN.test(a.name));
    
    if (!asset) {
      console.error('❌ error: no matching prebuilt file found');
      console.log('\n available files:');
      release.assets.forEach(a => console.log(`   - ${a.name}`));
      process.exit(1);
    }

    console.log(`✅ found prebuilt file: ${asset.name}`);
    console.log(`    file-size: ${(asset.size / 1024 / 1024).toFixed(2)} MB\n`);

    // 下载文件
    await downloadFile(asset.browser_download_url, DEST_FILE);

    // 验证文件
    const stats = fs.statSync(DEST_FILE);
    console.log(`✅ download completed!`);
    console.log(`    file-path: ${DEST_FILE}`);
    console.log(`    file-size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

    console.log('🎉 prebuilt lynx-trace is ready!');
    console.log('💡 now you can run pnpm run build:all to build the project\n');

  } catch (error) {
    console.error('\n❌ download failed:', error.message);
    console.error('\n🔧 alternative solutions:');
    console.error('   1. check network connection');
    console.error('   2. visit https://github.com/lynx-family/lynx-trace/releases');
    console.error('   3. manually download perfetto-ui-release-*.tar.gz');
    console.error('   4. rename the file to lynx-trace.tar.gz');
    console.error(`   5. place it in ${DEST_DIR}\n`);
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { main };
