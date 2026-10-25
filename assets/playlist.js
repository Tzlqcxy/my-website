/* ============================================================
   站点音乐清单（assets/player.js 读取）
   用法：
   1) 在站点根目录建 music/ 文件夹，放入 mp3/ogg/m4a 等音频文件
   2) 按下面的格式登记（src 相对站点根目录）：
      window.GEEK_PLAYLIST = [
        { title: '曲名', artist: '作者', src: 'music/song1.mp3' },
        { title: '另一首', artist: '作者', src: 'music/song2.ogg' },
      ];
   清单为空也不影响使用：播放器始终内置一首 WebAudio 合成的
   演示曲（八音盒风格，免版权），追加在清单末尾。
   ============================================================ */
window.GEEK_PLAYLIST = [
    { title: 'Cat', artist: '音乐库', src: 'music/cat.ogg' },
    { title: 'Track 5', artist: '音乐库', src: 'music/5.ogg' },
    { title: 'Track 13', artist: '音乐库', src: 'music/13.ogg' },
];
