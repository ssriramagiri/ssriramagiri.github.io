(function() {
  var canvas = document.createElement('canvas');
  var size = 64;
  canvas.width = size;
  canvas.height = size;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduceMotion = false;
  if (window.matchMedia) {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  document.head.appendChild(link);

  var glyphs = [
    ['111', '100', '111', '001', '111'],
    ['010', '101', '111', '101', '101'],
    ['111', '010', '010', '010', '111']
  ];
  var dots = [];
  var cell = 5;
  var gap = 5;
  var glyphWidth = 3 * cell;
  var totalWidth = glyphWidth * 3 + gap * 2;
  var startX = (size - totalWidth) / 2 + cell / 2;
  var startY = 18;

  function hash(n) {
    var x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  for (var g = 0; g < glyphs.length; g++) {
    var rows = glyphs[g];
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        if (rows[y][x] !== '1') continue;
        var index = dots.length + 1;
        var px = startX + g * (glyphWidth + gap) + x * cell;
        var py = startY + y * cell;
        dots.push({
          x: px,
          y: py,
          r: 2.1,
          seed: hash(index),
          delay: (y * 0.055 + g * 0.035 + x * 0.018 + hash(index) * 0.08) % 0.42,
          lane: (hash(index + 10) - 0.5) * 5
        });
      }
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function drawDot(x, y, r, alpha) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStill() {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (var i = 0; i < dots.length; i++) {
      drawDot(dots[i].x, dots[i].y, dots[i].r, 1);
    }
    ctx.globalAlpha = 1;
    link.href = canvas.toDataURL('image/png');
  }

  function drawFrame() {
    var now = Date.now();
    var cycle = 2200;
    var t = (now % cycle) / cycle;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000';

    for (var j = 0; j < 5; j++) {
      var streamT = (t * 1.55 + j / 5) % 1;
      var streamY = lerp(25, 39, streamT);
      var streamX = 32 + Math.sin(streamT * Math.PI * 2 + j) * 1.4;
      var streamAlpha = 0.18 + Math.sin(streamT * Math.PI) * 0.34;
      drawDot(streamX, streamY, 0.9 + streamT * 0.35, streamAlpha);
    }

    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i];
      var p = (t + dot.delay) % 1;
      var x = dot.x;
      var y = dot.y;
      var r = dot.r;
      var alpha = 1;

      if (p < 0.52) {
        var drift = Math.sin((now / 240) + dot.seed * 20) * 0.18;
        x += drift;
        y += Math.cos((now / 300) + dot.seed * 16) * 0.14;
      } else if (p < 0.7) {
        var intoNeck = ease((p - 0.52) / 0.18);
        x = lerp(dot.x, 32 + dot.lane * 0.35, intoNeck);
        y = lerp(dot.y, 29.5 + dot.seed * 4.5, intoNeck);
        r = lerp(dot.r, 1.15, intoNeck);
        alpha = lerp(1, 0.86, intoNeck);
      } else if (p < 0.84) {
        var fall = (p - 0.7) / 0.14;
        x = 32 + dot.lane * Math.sin(fall * Math.PI) * 0.7;
        y = lerp(29, 39, fall * fall);
        r = 1 + Math.sin(fall * Math.PI) * 0.35;
        alpha = 0.9;
      } else {
        var settle = ease((p - 0.84) / 0.16);
        var overshoot = Math.sin(settle * Math.PI) * (1 - settle) * 2.5;
        x = lerp(32 + dot.lane * 0.55, dot.x, settle);
        y = lerp(39, dot.y, settle) + overshoot;
        r = lerp(1.2, dot.r, settle);
        alpha = clamp(0.75 + settle * 0.35, 0, 1);
      }

      drawDot(x, y, r, alpha);
    }

    ctx.globalAlpha = 1;
    link.href = canvas.toDataURL('image/png');
  }

  if (reduceMotion) {
    drawStill();
    return;
  }

  drawFrame();
  window.setInterval(drawFrame, 125);
})();
