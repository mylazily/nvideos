const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 构建脚本 - 先获取数据，再构建
async function build() {
  console.log('=== NVideos Build ===');
  
  // 1. 获取首页数据
  console.log('Fetching homepage data...');
  try {
    // 这里可以通过环境变量获取数据，或者使用静态数据
    // 实际部署时，数据会在运行时通过API获取
    console.log('Using static data for build...');
  } catch (e) {
    console.error('Failed to fetch data:', e);
  }
  
  // 2. 运行 Astro 构建
  console.log('Running Astro build...');
  execSync('astro build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  
  console.log('Build complete!');
}

build().catch(console.error);
