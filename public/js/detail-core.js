// 详情页核心交互脚本 - 轻量版
(function() {
  'use strict';

  // 获取SSR注入的数据
  var videoData = {};
  var playGroups = [];
  var sourceInfo = {};
  var sourceKey = '';
  var videoId = '';
  var siteName = 'LVideos';

  try {
    var el1 = document.getElementById('detail-data');
    if (el1) videoData = JSON.parse(el1.textContent);
    var el2 = document.getElementById('play-groups-data');
    if (el2) playGroups = JSON.parse(el2.textContent);
    var el3 = document.getElementById('source-data');
    if (el3) sourceInfo = JSON.parse(el3.textContent);
    var el4 = document.getElementById('source-key-data');
    if (el4) sourceKey = el4.textContent;
    var el5 = document.getElementById('video-id-data');
    if (el5) videoId = el5.textContent;
    var el6 = document.getElementById('site-name');
    if (el6) siteName = el6.textContent;
  } catch (e) {}

  if (!videoData || !videoData.vod_id) return;

  var currentGroupIdx = 0;
  var currentEpisodeIdx = 0;
  var hls = null;

  // 保存观看历史
  function saveHistory() {
    try {
      var history = JSON.parse(localStorage.getItem('lvideos_history') || '[]');
      var entry = {
        vod_id: videoData.vod_id,
        title: videoData.vod_name,
        vod_pic: videoData.vod_pic,
        episode_name: playGroups[currentGroupIdx]?.sources[currentEpisodeIdx]?.name || '',
        source_key: sourceKey,
        timestamp: Date.now(),
      };
      // 去重并移到最前
      history = history.filter(function(h) { return h.vod_id !== videoData.vod_id; });
      history.unshift(entry);
      if (history.length > 50) history = history.slice(0, 50);
      localStorage.setItem('lvideos_history', JSON.stringify(history));
    } catch (e) {}
  }

  // 加载播放器
  function loadPlayer(url, name) {
    var player = document.getElementById('main-player');
    var poster = document.getElementById('player-poster');
    var loading = document.getElementById('player-loading');

    if (poster) poster.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');
    player.classList.remove('hidden');

    // 销毁旧HLS实例
    if (hls) {
      hls.destroy();
      hls = null;
    }

    // 判断视频类型
    var isHls = url.includes('.m3u8');

    if (isHls && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1024 * 1024,
      });
      hls.loadSource(url);
      hls.attachMedia(player);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
        if (loading) loading.classList.add('hidden');
        player.play().catch(function() {});
      });
      hls.on(window.Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          console.error('HLS error:', data);
        }
      });
    } else {
      player.src = url;
      player.addEventListener('loadeddata', function() {
        if (loading) loading.classList.add('hidden');
      });
      player.play().catch(function() {});
    }

    saveHistory();
  }

  // 加载第一集
  window._loadFirstEpisode = function() {
    if (playGroups.length > 0 && playGroups[0].sources.length > 0) {
      var ep = playGroups[0].sources[0];
      loadPlayer(ep.url, ep.name);
      currentEpisodeIdx = 0;
      updateEpisodeButtons();
    }
  };

  // 更新选集按钮状态
  function updateEpisodeButtons() {
    var buttons = document.querySelectorAll('.episode-btn');
    buttons.forEach(function(btn, idx) {
      if (idx === currentEpisodeIdx) {
        btn.className = 'episode-btn px-3 py-2 text-xs rounded truncate transition-colors min-h-[44px] min-w-[44px] bg-pink-500 text-white';
      } else {
        btn.className = 'episode-btn px-3 py-2 text-xs rounded truncate transition-colors min-h-[44px] min-w-[44px] bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-500';
      }
    });
  }

  // 绑定选集按钮事件
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.episode-btn');
    if (btn) {
      var url = btn.getAttribute('data-url');
      var idx = parseInt(btn.getAttribute('data-idx'));
      if (url) {
        currentEpisodeIdx = idx;
        loadPlayer(url, btn.textContent);
        updateEpisodeButtons();
      }
    }

    // 播放源切换
    var tab = e.target.closest('.source-tab');
    if (tab && tab.hasAttribute('data-group-idx')) {
      var gIdx = parseInt(tab.getAttribute('data-group-idx'));
      if (gIdx !== currentGroupIdx) {
        currentGroupIdx = gIdx;
        currentEpisodeIdx = 0;
        // 重新渲染选集
        renderEpisodes();
        // 更新tab样式
        document.querySelectorAll('.source-tab').forEach(function(t, i) {
          if (i === gIdx) {
            t.className = 'source-tab px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors min-h-[44px] bg-pink-500 text-white';
          } else {
            t.className = 'source-tab px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors min-h-[44px] bg-gray-100 text-gray-600';
          }
        });
      }
    }
  });

  // 渲染选集列表
  function renderEpisodes() {
    var grid = document.getElementById('episode-grid');
    if (!grid || !playGroups[currentGroupIdx]) return;
    var sources = playGroups[currentGroupIdx].sources;
    var html = '';
    sources.forEach(function(ep, idx) {
      var active = idx === currentEpisodeIdx ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-500';
      html += '<button class="episode-btn px-3 py-2 text-xs rounded truncate transition-colors min-h-[44px] min-w-[44px] ' + active + '" data-url="' + ep.url + '" data-idx="' + idx + '">' + ep.name + '</button>';
    });
    grid.innerHTML = html;
  }

  // 自动播放下一集
  var player = document.getElementById('main-player');
  if (player) {
    player.addEventListener('ended', function() {
      var group = playGroups[currentGroupIdx];
      if (group && currentEpisodeIdx < group.sources.length - 1) {
        currentEpisodeIdx++;
        var next = group.sources[currentEpisodeIdx];
        loadPlayer(next.url, next.name);
        updateEpisodeButtons();
      }
    });
  }

  // 键盘快捷键
  document.addEventListener('keydown', function(e) {
    if (!player) return;
    switch(e.key) {
      case ' ':
        e.preventDefault();
        if (player.paused) player.play(); else player.pause();
        break;
      case 'ArrowRight':
        player.currentTime = Math.min(player.duration, player.currentTime + 10);
        break;
      case 'ArrowLeft':
        player.currentTime = Math.max(0, player.currentTime - 10);
        break;
    }
  });
})();
