/*
 * Portfolio scene: one isometric, blueprint-style line drawing of every portfolio
 * company's products, built as SVG at runtime. Company pills live in index.html;
 * this file positions them against anchors in the drawing.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var C30 = Math.cos(Math.PI / 6);
  var ISO = Math.sqrt(1.5);
  var R3 = 1 / Math.sqrt(3);
  var VIEW = [R3, R3, R3];
  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

  /* ---------- math ---------- */

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function f1(v) { return Math.round(v * 10) / 10; }

  function circle3(c, a, b, r, n, t0, t1) {
    n = n || 32;
    if (t0 == null) t0 = 0;
    if (t1 == null) t1 = TAU;
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n, ca = Math.cos(t) * r, sb = Math.sin(t) * r;
      out.push([c[0] + a[0] * ca + b[0] * sb, c[1] + a[1] * ca + b[1] * sb, c[2] + a[2] * ca + b[2] * sb]);
    }
    return out;
  }

  function hull(points) {
    var pts = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (pts.length < 3) return pts;
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], upper = [], i;
    for (i = 0; i < pts.length; i++) {
      while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
      lower.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
      upper.push(pts[i]);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  /* ---------- path strings ---------- */

  function dPoly(pts, closed) {
    if (!pts || pts.length < 2) return '';
    var s = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (var i = 1; i < pts.length; i++) s += 'L' + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
    return closed ? s + 'Z' : s;
  }

  // Apply an affine matrix [a b c d e f] to an absolute M/L/C/Q/Z path.
  function tpath(d, m) {
    var toks = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    var out = '', x = null;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (/[A-Za-z]/.test(t)) { out += t.toUpperCase(); x = null; continue; }
      var v = parseFloat(t);
      if (x === null) { x = v; continue; }
      out += f1(m[0] * x + m[2] * v + m[4]) + ' ' + f1(m[1] * x + m[3] * v + m[5]) + ' ';
      x = null;
    }
    return out;
  }

  function tpts(pts, m) {
    return pts.map(function (p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; });
  }

  function ellipse2(cx, cy, rx, ry, rot, n, t0, t1) {
    n = n || 28;
    if (t0 == null) t0 = 0;
    if (t1 == null) t1 = TAU;
    var out = [], cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    for (var i = 0; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
      out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return out;
  }

  function rrect2(x, y, w, h, r, n) {
    n = n || 5;
    var out = [], corners = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
    corners.forEach(function (c) {
      for (var i = 0; i <= n; i++) {
        var a = (c[2] + 90 * i / n) * DEG;
        out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
      }
    });
    return out;
  }

  // Parallel hatch lines clipped to a polygon (2D, even-odd).
  function hatch2(poly, angle, gap, offset) {
    var ca = Math.cos(angle), sa = Math.sin(angle), segs = [];
    var rot = poly.map(function (p) { return [p[0] * ca + p[1] * sa, -p[0] * sa + p[1] * ca]; });
    var minY = Infinity, maxY = -Infinity;
    rot.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    for (var y = minY + (offset || gap / 2); y < maxY; y += gap) {
      var xs = [];
      for (var i = 0; i < rot.length; i++) {
        var a = rot[i], b = rot[(i + 1) % rot.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        segs.push([[xs[k] * ca - y * sa, xs[k] * sa + y * ca], [xs[k + 1] * ca - y * sa, xs[k + 1] * sa + y * ca]]);
      }
    }
    return segs;
  }

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* ---------- pen: isometric drawing context ---------- */

  function Pen(root) {
    this.g = root;
    this.stack = [];
    this.ox = 0;
    this.oy = 0;
    this.s = 1;
  }
  var PP = Pen.prototype;

  PP.at = function (x, y, s) { this.ox = x; this.oy = y; this.s = s || 1; return this; };
  // Projection frozen at the current origin, for use in animation callbacks.
  PP.snap = function () {
    var ox = this.ox, oy = this.oy, s = this.s;
    return function (p) { return [ox + (p[0] - p[1]) * C30 * s, oy + ((p[0] + p[1]) * 0.5 - (p[2] || 0)) * s]; };
  };
  PP.P = function (p) {
    return [this.ox + (p[0] - p[1]) * C30 * this.s, this.oy + ((p[0] + p[1]) * 0.5 - (p[2] || 0)) * this.s];
  };
  PP.pts = function (list) { var o = []; for (var i = 0; i < list.length; i++) o.push(this.P(list[i])); return o; };
  PP.open = function (attrs) {
    var g = el('g', attrs);
    this.g.appendChild(g);
    this.stack.push(this.g);
    this.g = g;
    return g;
  };
  PP.close = function () { this.g = this.stack.pop(); };
  PP.path = function (d, cls, attrs) {
    var a = attrs || {};
    a.d = d;
    if (cls) a['class'] = cls;
    var e = el('path', a);
    this.g.appendChild(e);
    return e;
  };
  PP.poly = function (list, cls, attrs) { return this.path(dPoly(this.pts(list), true), cls || 'k', attrs); };
  PP.line = function (list, cls, attrs) { return this.path(dPoly(this.pts(list), false), cls || 'l2', attrs); };
  PP.lines = function (lists, cls, closed, attrs) {
    var d = '';
    for (var i = 0; i < lists.length; i++) d += dPoly(this.pts(lists[i]), closed);
    return this.path(d, cls || 'l2', attrs);
  };
  PP.lines2 = function (lists, cls, closed, attrs) {
    var d = '';
    for (var i = 0; i < lists.length; i++) d += dPoly(lists[i], closed);
    return this.path(d, cls || 'l2', attrs);
  };
  PP.box = function (x, y, z, w, d, h, cls) {
    var x1 = x + w, y1 = y + d, z1 = z + h;
    return this.path(
      dPoly(this.pts([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]]), true) +
      dPoly(this.pts([[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]]), true) +
      dPoly(this.pts([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]]), true),
      cls || 'k'
    );
  };
  // Parallelogram o, o+u, o+u+v, o+v
  PP.quad = function (o, u, v, cls) { return this.poly([o, add(o, u), add(add(o, u), v), add(o, v)], cls); };
  PP.circle = function (c, a, b, r, cls, n) { return this.path(dPoly(this.pts(circle3(c, a, b, r, n || 32)), true), cls || 'k'); };
  PP.sphere = function (c, r, cls) {
    var p = this.P(c);
    return this.path(dPoly(ellipse2(p[0], p[1], r * ISO * this.s, r * ISO * this.s, 0, 28), true), cls || 'k');
  };

  // Tapered capsule between two spheres (projects to a stadium).
  PP.capsule = function (p0, p1, r0, r1, cls) {
    if (r1 == null) r1 = r0;
    var a = this.P(p0), b = this.P(p1), R0 = r0 * ISO * this.s, R1 = r1 * ISO * this.s;
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L <= Math.abs(R0 - R1) + 1e-6) {
      var big = R0 > R1 ? a : b;
      return this.path(dPoly(ellipse2(big[0], big[1], Math.max(R0, R1), Math.max(R0, R1), 0, 24), true), cls || 'k');
    }
    var ang = Math.atan2(dy, dx), al = Math.acos((R0 - R1) / L), pts = [], i, t;
    for (i = 0; i <= 10; i++) { t = ang + al + (TAU - 2 * al) * i / 10; pts.push([a[0] + Math.cos(t) * R0, a[1] + Math.sin(t) * R0]); }
    for (i = 0; i <= 10; i++) { t = ang - al + 2 * al * i / 10; pts.push([b[0] + Math.cos(t) * R1, b[1] + Math.sin(t) * R1]); }
    return this.path(dPoly(pts, true), cls || 'k');
  };

  // 2D path (local units) placed with an affine matrix relative to the pen origin.
  PP.fig = function (d, m, cls, attrs) {
    var mm = [m[0] * this.s, m[1] * this.s, m[2] * this.s, m[3] * this.s, this.ox + m[4] * this.s, this.oy + m[5] * this.s];
    return this.path(tpath(d, mm), cls, attrs);
  };
  PP.fig2 = function (lists, m, cls, closed, attrs) {
    var mm = [m[0] * this.s, m[1] * this.s, m[2] * this.s, m[3] * this.s, this.ox + m[4] * this.s, this.oy + m[5] * this.s];
    var d = '';
    for (var i = 0; i < lists.length; i++) d += dPoly(tpts(lists[i], mm), closed);
    return this.path(d, cls, attrs);
  };
  // Matrix that maps 2D local (u right, v down) onto a plane through o spanned by world vectors ux, vy.
  PP.planeM = function (o, ux, vdown) {
    var p0 = this.P(o), pu = this.P(add(o, ux)), pv = this.P(add(o, vdown));
    return [(pu[0] - p0[0]) / this.s, (pu[1] - p0[1]) / this.s, (pv[0] - p0[0]) / this.s, (pv[1] - p0[1]) / this.s, (p0[0] - this.ox) / this.s, (p0[1] - this.oy) / this.s];
  };
  PP.text = function (str, m, cls, size, anchor) {
    var mm = [m[0] * this.s, m[1] * this.s, m[2] * this.s, m[3] * this.s, this.ox + m[4] * this.s, this.oy + m[5] * this.s];
    var t = el('text', {
      'class': cls || 'tx',
      transform: 'matrix(' + mm.map(function (v) { return Math.round(v * 1000) / 1000; }).join(' ') + ')',
      'font-size': size || 6,
      'text-anchor': anchor || 'start'
    });
    t.textContent = str;
    this.g.appendChild(t);
    return t;
  };

  // Surface of revolution with exact silhouettes; returns helpers for surface detail.
  PP.revolve = function (base, axis, prof, opt) {
    opt = opt || {};
    var self = this, ax = unit(axis), av = dot(ax, VIEW);
    var e1 = sub(VIEW, mul(ax, av));
    if (dot(e1, e1) < 1e-8) e1 = cross(ax, Math.abs(ax[2]) < 0.9 ? Z : X);
    e1 = unit(e1);
    var e2 = cross(ax, e1), Rv = dot(e1, VIEW);
    var n = prof.length, T = [], Rr = [], S = [], i;
    for (i = 0; i < n; i++) { T.push(prof[i][0]); Rr.push(prof[i][1]); }
    for (i = 0; i < n; i++) {
      var i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), dt = T[i1] - T[i0];
      S.push(Math.abs(dt) < 1e-9 ? (Rr[i1] > Rr[i0] ? 1e5 : -1e5) : (Rr[i1] - Rr[i0]) / dt);
    }
    function idx(t) {
      if (t <= T[0]) return 0;
      for (var k = 0; k < n - 1; k++) if (t <= T[k + 1]) return k;
      return n - 2;
    }
    function rAt(t) {
      var k = idx(t), dt = T[k + 1] - T[k];
      return dt < 1e-9 ? Rr[k + 1] : lerp(Rr[k], Rr[k + 1], Math.max(0, Math.min(1, (t - T[k]) / dt)));
    }
    function sAt(t) {
      var k = idx(t), dt = T[k + 1] - T[k];
      return dt < 1e-9 ? S[k] : (Rr[k + 1] - Rr[k]) / dt;
    }
    function pt(t, th, dr) {
      var r = rAt(t) + (dr || 0), c = Math.cos(th) * r, s = Math.sin(th) * r;
      return [base[0] + ax[0] * t + e1[0] * c + e2[0] * s, base[1] + ax[1] * t + e1[1] * c + e2[1] * s, base[2] + ax[2] * t + e1[2] * c + e2[2] * s];
    }
    function vis(t, th) { return Rv * Math.cos(th) - sAt(t) * av > -1e-6; }
    function center(t) { return add(base, mul(ax, t)); }

    // Fill
    var fillPts = [];
    for (i = 0; i < n; i++) {
      if (Rr[i] <= 0) { fillPts.push(self.P(center(T[i]))); continue; }
      var ring = circle3(center(T[i]), e1, e2, Rr[i], 36);
      for (var k = 0; k < ring.length; k++) fillPts.push(self.P(ring[k]));
    }
    if (!opt.noFill) self.path(dPoly(hull(fillPts), true), opt.fill || 'f');

    // Silhouette curves
    var left = [], right = [], sil = [];
    function flush() {
      if (left.length > 1) sil.push(left);
      if (right.length > 1) sil.push(right);
      left = [];
      right = [];
    }
    if (Rv > 1e-4) {
      for (i = 0; i < n; i++) {
        var cv = S[i] * av / Rv;
        if (Math.abs(cv) <= 1 && Rr[i] > 0) {
          var th = Math.acos(cv);
          left.push(self.P(pt(T[i], th)));
          right.push(self.P(pt(T[i], -th)));
        } else flush();
      }
      flush();
    }

    var api = {
      pt: pt,
      vis: vis,
      center: center,
      e1: e1,
      e2: e2,
      ax: ax,
      av: av,
      r: rAt,
      ringRuns: function (t, r, th0, th1, steps) {
        if (th0 == null) { th0 = -Math.PI; th1 = Math.PI; }
        steps = steps || 64;
        var runs = [], cur = null;
        for (var j = 0; j <= steps; j++) {
          var a = th0 + (th1 - th0) * j / steps;
          if (vis(t, a)) {
            if (!cur) { cur = []; runs.push(cur); }
            var p = r == null ? pt(t, a) : add(center(t), add(mul(e1, Math.cos(a) * r), mul(e2, Math.sin(a) * r)));
            cur.push(self.P(p));
          } else cur = null;
        }
        return runs.filter(function (q) { return q.length > 1; });
      },
      merRuns: function (th, t0, t1, steps) {
        steps = steps || 16;
        var runs = [], cur = null;
        for (var j = 0; j <= steps; j++) {
          var t = t0 + (t1 - t0) * j / steps;
          if (vis(t, th)) {
            if (!cur) { cur = []; runs.push(cur); }
            cur.push(self.P(pt(t, th)));
          } else cur = null;
        }
        return runs.filter(function (q) { return q.length > 1; });
      },
      ring: function (t, cls, th0, th1) { return self.lines2(api.ringRuns(t, null, th0, th1), cls || 'l2'); },
      rings: function (ts, cls, th0, th1) {
        var all = [];
        ts.forEach(function (t) { all = all.concat(api.ringRuns(t, null, th0, th1)); });
        return self.lines2(all, cls || 'l3');
      },
      mers: function (ths, t0, t1, cls) {
        var all = [];
        ths.forEach(function (th) { all = all.concat(api.merRuns(th, t0, t1)); });
        return self.lines2(all, cls || 'l3');
      },
      dotAt: function (t, th, rad) {
        if (!vis(t, th)) return null;
        var c = pt(t, th, 0.01), w = add(mul(e1, -Math.sin(th)), mul(e2, Math.cos(th)));
        var m = unit(add(ax, mul(add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th))), sAt(t))));
        return self.pts(circle3(c, w, m, rad, 14));
      },
      dots: function (list, cls) {
        var all = [];
        list.forEach(function (q) { var d = api.dotAt(q[0], q[1], q[2]); if (d) all.push(d); });
        return self.lines2(all, cls || 'l2', true);
      }
    };

    var caps = [];
    [[0, -1], [n - 1, 1]].forEach(function (c) {
      var r = Rr[c[0]];
      if (r <= 0) return;
      if (c[1] * av > 0) caps.push(self.pts(circle3(center(T[c[0]]), e1, e2, r, 48)));
      else caps = caps.concat(api.ringRuns(T[c[0]], r));
    });

    if (!opt.noLines) self.lines2(sil.concat(caps), opt.cls || 'l1');
    return api;
  };

  /* ---------- 2D figures (local units, feet at 0,0, height 100) ---------- */

  var FIG = {};

  // 1X NEO in three-quarter view facing left, handing over a mug. Units: height 100, feet at 0.
  // Proportions follow the real robot: an egg-shaped head a little under an eighth of its height,
  // carried forward on a tall ribbed turtleneck; a straight knit column of a torso; legs just over
  // half its height, with loose hems breaking over soft, thick-soled clogs; no visible joints.
  FIG.neo = (function () {
    var ribs = [], k;
    for (k = 0; k < 8; k++) {
      var y = -74.2 + k * 1.65, w = k === 0 ? 0.55 : 1;
      ribs.push('M' + (-8.2 * w) + ' ' + (y + 0.4) + ' C-3 ' + (y - 0.5) + ' 4 ' + (y - 0.7) + ' ' + (9.2 * w) + ' ' + (y - 0.2));
    }
    return {
      farLeg: 'M-8.4 -54.4 C-8.8 -46 -8.4 -36 -7.8 -29.5 C-7.4 -25.5 -8.2 -20 -8.6 -14 C-8.9 -9.6 -9.3 -6.4 -9.7 -4.2 L-1.2 -4 C-1.3 -9 -1.1 -15 -1 -21 C-0.9 -25.5 -1.2 -28 -0.9 -32 C-0.6 -39 -0.4 -46 -0.2 -52.8 Z',
      farShoe: 'M-10.4 -4.8 C-13.8 -4.8 -15.8 -3.2 -15.9 -1.5 C-16 -0.2 -15 0.4 -13.2 0.4 L-1.8 0.4 C-0.6 0.4 -0.2 -0.8 -0.4 -2.2 C-0.6 -3.9 -1.6 -4.9 -3.2 -4.9 Z',
      nearLeg: 'M-0.6 -52.8 C-0.4 -45 -0.3 -38 0 -31.8 C0.3 -27.6 -0.1 -24.5 0 -20.5 C0.1 -14.5 0 -9 -0.2 -3.8 L9 -3.8 C8.8 -7 8.4 -11.5 8.2 -16 C8 -20.5 8.6 -25.5 8.3 -29.8 C8 -35 8.6 -42.5 9 -48.5 C9.2 -51 9.3 -53.2 9.4 -54.6 Z',
      nearShoe: 'M-2.4 -4.6 C-6 -4.6 -8.2 -3 -8.2 -1.2 C-8.2 0.2 -7 0.7 -5 0.7 L8.6 0.7 C10 0.7 10.6 -0.6 10.4 -2.1 C10.1 -3.9 9 -4.8 7.2 -4.8 Z',
      soles: 'M-15.8 -1.9 C-11 -1.5 -5 -1.5 -0.4 -1.9 M-8.1 -1.6 C-2 -1.2 4 -1.2 10.4 -1.6',
      hems: 'M-9.6 -5.8 C-6.8 -4.9 -3.8 -5.1 -1.2 -5.6 M-0.2 -5.3 C3 -4.5 6.2 -4.6 9 -5.3',
      knees: 'M-7.9 -30.6 C-6 -31.7 -3.3 -31.7 -1 -30.8 M-7.8 -28.3 C-5.9 -27.3 -3.3 -27.3 -1 -28.3 M-7.8 -29.4 L-1 -29.5 M0.1 -30.8 C2.6 -31.9 5.8 -31.9 8.3 -30.8 M0.1 -28.3 C2.6 -27.2 5.8 -27.2 8.3 -28.3 M0.1 -29.5 L8.3 -29.5',
      farUpper: 'M-7 -81.6 C-10 -81.4 -11.9 -79.4 -12.3 -76.4 C-12.7 -73.2 -12.7 -69.6 -12.5 -66.4 C-12.3 -64.2 -11.1 -62.8 -9.4 -63 C-8 -63.2 -7.6 -64.6 -7.8 -66.6 C-8 -70 -7.8 -73.6 -7.6 -76.6 Z',
      farForearm: 'M-12.6 -66.9 C-15 -67.9 -17.4 -68.9 -19.8 -69.7 L-21 -65.8 C-18.6 -65 -16 -63.8 -13.4 -62.7 C-11.2 -62 -10.4 -66 -12.6 -66.9 Z',
      farCuff: 'M-19.8 -69.8 L-23.2 -71 L-24.4 -67 L-21 -65.8 Z',
      farHand: 'M-23 -71.1 C-24.6 -72 -26.4 -71.8 -27.4 -70.6 C-27.9 -69.8 -28 -68 -27.4 -67.1 C-26.6 -66.2 -25.3 -66.1 -24.4 -67 Z',
      mug: 'M-33 -72.8 L-32.6 -66.1 C-32.4 -65 -28.6 -65 -28.4 -66.1 L-28 -72.8 C-29.4 -73.6 -31.6 -73.6 -33 -72.8 Z',
      mugHandle: 'M-32.8 -71.4 C-35 -71.4 -35 -67.6 -32.6 -67.6',
      mugRim: ellipse2(-30.5, -72.8, 2.5, 0.7, 0, 16),
      steam: 'M-31.2 -74.6 C-32 -75.8 -30.4 -76.8 -31.2 -78 M-29.6 -74.8 C-30.4 -76 -28.8 -76.8 -29.6 -77.8',
      torso: 'M-8.6 -54.2 C-8.4 -58.5 -8 -62.5 -8.1 -66.5 C-8.2 -70.2 -8.6 -73.2 -8.9 -76.2 C-9.2 -78.6 -8.1 -80.4 -5.8 -81.3 C-3.2 -82.3 0.8 -82.7 3.8 -82.2 C7.2 -81.7 9.7 -80.3 10.2 -77.7 C10.6 -74.9 9.8 -71.6 9.6 -67.2 C9.4 -62.6 9.6 -58.6 9.6 -54.6',
      torsoClose: ' C7.2 -53.2 4 -52.4 0.6 -52.1 C-2.8 -51.8 -6.2 -52.4 -8.6 -54.2 Z',
      ribs: ribs.join(' '),
      zones: 'M-8.9 -73.4 C-4.8 -76.9 3 -78.1 9.9 -76.5 M-8.3 -59.6 C-5.4 -62.6 5.2 -62.8 9.5 -59.8 M-8.5 -56.2 C-5.4 -55.2 -2.6 -53.8 -0.4 -52.3 M9.5 -56.6 C6.6 -55.4 3.4 -53.8 1 -52.2',
      nearArm: 'M7.4 -81.5 C10.6 -81.6 12.8 -79.8 13.1 -76.6 C13.4 -72.6 13.1 -68 12.9 -63.8 C12.8 -59.6 13.1 -55 13.2 -50.8 L9.2 -50.6 C9.1 -55 8.9 -59.2 9 -63.4 C9.1 -67.6 8.8 -72 8.6 -75.6 C8.4 -78.2 7.6 -80.2 7.2 -81.8 Z',
      shoulder: [ellipse2(10.2, -77.6, 2.5, 3.1, -0.1, 20)],
      shoulderRibs: 'M8.3 -79.2 L12.2 -79.2 M7.9 -77.6 L12.6 -77.6 M8.3 -76 L12.2 -76',
      nearCuff: 'M9.1 -50.8 C10.6 -51.2 12 -51.2 13.3 -51 L13.5 -47.4 C12 -47.1 10.5 -47.1 9 -47.3 Z',
      cuffRibs: 'M10.1 -51.1 L10.1 -47.2 M11.1 -51.2 L11.1 -47.1 M12.2 -51.1 L12.2 -47.1 M-20.9 -70.1 L-22.1 -66.2 M-22 -70.5 L-23.2 -66.6',
      nearHand: 'M9.4 -47.4 C8.8 -45 8.7 -42.6 9.1 -40.2 C9.4 -38.8 10.2 -38 11 -38.3 C11.5 -38.6 11.4 -39.5 11.3 -40.3 C11.9 -39.3 12.8 -38.8 13.3 -39.3 C13.7 -39.8 13.5 -40.9 13.2 -41.8 C13.9 -41.6 14.5 -42 14.4 -42.8 C14.3 -44.4 13.9 -46 13.7 -47.4 Z',
      fingers: 'M11.3 -40.3 C11.2 -41.6 11.3 -42.8 11.6 -43.8 M13.2 -41.8 C12.9 -42.9 12.9 -43.9 13.1 -44.8',
      neck: 'M-2.4 -88.4 C-2.5 -86.6 -2.3 -84.8 -2 -83.2 C0.4 -82.2 2.6 -82.4 3.4 -83.4 C3 -85.2 2.8 -87.2 2.6 -89.2 C0.8 -88.6 -0.8 -88.4 -2.4 -88.4 Z',
      neckRibs: 'M-1.3 -88.3 L-1.1 -83 M0 -88.4 L0.2 -82.6 M1.3 -88.6 L1.5 -82.6 M2.2 -88.9 L2.5 -82.9 M-2 -83.4 L0.6 -82.2 L3.3 -83.6',
      head: 'M-0.6 -100 C2.3 -100 4.3 -97.9 4.3 -95.1 C4.3 -92.7 3.7 -90.9 3 -89.9 C1.1 -89.1 -1.3 -88.4 -3.3 -88.1 C-4.6 -88 -5.4 -89.6 -5.5 -91.8 C-5.6 -95.2 -4.3 -100 -0.6 -100 Z',
      seam: 'M0.6 -99.9 C-0.5 -97.6 -1.4 -95 -1.3 -92.4 C-1.25 -90.6 -1.5 -89.3 -1.8 -88.5',
      ring: ellipse2(1.4, -94.2, 2.1, 3.4, -0.12, 32),
      disc: [ellipse2(1.4, -94.2, 1.5, 2.7, -0.12, 26)],
      bezels: [ellipse2(-2.6, -94.7, 0.75, 0.8, 0, 12), ellipse2(-4.8, -94.8, 0.45, 0.72, 0, 12)],
      eyes: [ellipse2(-2.6, -94.7, 0.42, 0.44, 0, 10), ellipse2(-4.8, -94.8, 0.24, 0.4, 0, 10)]
    };
  })();

  // Matrix for a figure at absolute screen point (x, y) with figure scale s.
  function absM(pen, s, x, y, flip) {
    var k = s / pen.s;
    return [flip ? -k : k, 0, 0, k, (x - pen.ox) / pen.s, (y - pen.oy) / pen.s];
  }

  function drawNeo(pen, x, y, s, flip) {
    var F = FIG.neo, m = absM(pen, s, x, y, flip);
    pen.open({ 'class': 'neo' });
    pen.fig(F.farLeg, m, 'k');
    pen.fig(F.farShoe, m, 'k');
    pen.fig(F.nearLeg, m, 'k');
    pen.fig(F.nearShoe, m, 'k');
    pen.fig(F.soles + ' ' + F.hems, m, 'l3');
    pen.fig(F.knees, m, 'l4');
    pen.fig(F.farUpper, m, 'k');
    pen.fig(F.farForearm, m, 'k');
    pen.fig(F.farCuff, m, 'k');
    pen.fig(F.mug, m, 'k');
    pen.fig(F.mugHandle, m, 'l2');
    pen.fig2([F.mugRim], m, 'l2', true);
    live(pen.fig(F.steam, m, 'l3'), { css: 'pf-steam', pad: 1 });
    pen.fig(F.farHand, m, 'k');
    pen.fig(F.torso + F.torsoClose, m, 'f');
    pen.fig(F.torso, m, 'l1');
    pen.fig(F.ribs, m, 'l4');
    pen.fig(F.zones, m, 'l3');
    pen.fig(F.nearArm, m, 'k');
    pen.fig2(F.shoulder, m, 'l3', true);
    pen.fig(F.shoulderRibs, m, 'l4');
    pen.fig(F.nearCuff, m, 'k');
    pen.fig(F.nearHand, m, 'k');
    pen.fig(F.cuffRibs + ' ' + F.fingers, m, 'l3');
    pen.fig(F.neck, m, 'k');
    pen.fig(F.neckRibs, m, 'l3');
    pen.fig(F.head, m, 'k');
    pen.fig(F.seam, m, 'l3');
    pen.fig2(F.disc, m, 'l3', true);
    live(pen.fig2([F.ring], m, 'l1 glow', true), { css: 'pf-pulse', pad: 4 });
    pen.fig2(F.bezels, m, 'l3', true);
    pen.fig2(F.eyes, m, 'wf', true);
    pen.close();
  }

  // A generic walking person, drawn simply so the products stay the focus.
  FIG.walk = {
    back: 'M-2 -52 L-7.6 -28 L-11.8 -4.4 L-7.4 -3.8 L-2.6 -28 L3 -48 Z',
    body: 'M-3.8 -80 C-6.4 -79.2 -7.4 -76.4 -7.2 -72.4 L-6.4 -52 L6.4 -52 L7.2 -72.4 C7.2 -76.2 6.2 -79.2 3.8 -80 Z',
    front: 'M1 -52 L6.6 -29 L13.6 -6.6 L9.4 -4.8 L2.8 -27.4 L-3.6 -48 Z',
    arm: 'M3.6 -78.4 L9.4 -62 L12.4 -52.6 L9.2 -51.4 L6 -60.6 L1 -74 Z',
    head: ellipse2(0.6, -88.5, 5.2, 6.4, 0, 24),
    feet: 'M-12 -4.6 L-14.4 -0.6 L-7.4 -0.2 L-7.2 -3.8 Z M9.6 -5 L10.4 -0.6 L17 -1.4 L13.8 -6.6 Z'
  };

  function drawPerson(pen, kind, x, y, s, flip, cls) {
    var F = FIG[kind], m = absM(pen, s, x, y, flip);
    pen.open({ 'class': cls || 'person' });
    if (F.back) pen.fig(F.back, m, 'k2');
    pen.fig(F.body, m, 'k2');
    if (F.front) pen.fig(F.front, m, 'k2');
    if (F.arm) pen.fig(F.arm, m, 'k2');
    pen.fig(F.feet, m, 'k2');
    pen.fig2([F.head], m, 'k2', true);
    pen.close();
  }

  function drawTree(pen, p, h, r, seed) {
    var base = pen.P(p), top = pen.P([p[0], p[1], p[2] + h]), rr = r * pen.s;
    pen.path(dPoly([base, [top[0], top[1] + rr * 0.6]], false), 'l3');
    var pts = [], n = 22;
    for (var i = 0; i <= n; i++) {
      var a = i / n * TAU, w = 1 + 0.08 * Math.sin(a * 5 + seed) + 0.05 * Math.sin(a * 3 + seed * 2);
      pts.push([top[0] + Math.cos(a) * rr * w, top[1] - rr * 0.35 + Math.sin(a) * rr * 1.15 * w]);
    }
    pen.path(dPoly(pts, true), 'k2');
    var arcs = [];
    for (var k = 0; k < 3; k++) {
      var cx = top[0] + (hash(seed + k) - 0.5) * rr, cy = top[1] - rr * 0.3 + (hash(seed + k + 9) - 0.5) * rr;
      arcs.push(ellipse2(cx, cy, rr * 0.34, rr * 0.3, 0, 8, Math.PI * 0.1, Math.PI * 0.9));
    }
    pen.lines2(arcs, 'l3');
  }

  /* ---------- products ---------- */

  // Extruded convex polygon (profile in the y-z plane) from x0 to x1; draws the faces that face the viewer.
  PP.prismX = function (prof, x0, x1, cls) {
    var d = '', n = prof.length, self = this;
    for (var i = 0; i < n; i++) {
      var a = prof[i], b = prof[(i + 1) % n];
      var ny = b[1] - a[1], nz = -(b[0] - a[0]);
      if (ny + nz > 0 === (signedArea(prof) > 0)) {
        d += dPoly(self.pts([[x0, a[0], a[1]], [x1, a[0], a[1]], [x1, b[0], b[1]], [x0, b[0], b[1]]]), true);
      }
    }
    d += dPoly(self.pts(prof.map(function (p) { return [x1, p[0], p[1]]; })), true);
    return this.path(d, cls || 'k');
  };
  function signedArea(p) {
    var s = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return s;
  }
  function octo(w, h, c, y0, z0) {
    return [[y0 - w / 2 + c, z0], [y0 + w / 2 - c, z0], [y0 + w / 2, z0 + c], [y0 + w / 2, z0 + h - c], [y0 + w / 2 - c, z0 + h], [y0 - w / 2 + c, z0 + h], [y0 - w / 2, z0 + h - c], [y0 - w / 2, z0 + c]];
  }

  function drawSun(pen, cx, cy, r, anims) {
    pen.open({ 'class': 'sun' });
    pen.path(dPoly(ellipse2(cx, cy, r, r, 0, 48), true), 'k glow');
    pen.path(dPoly(ellipse2(cx, cy, r * 0.62, r * 0.62, 0, 36), true), 'l3');
    pen.path(dPoly(ellipse2(cx, cy, r * 1.32, r * 1.32, 0, 64), true), 'l3 dsh');
    var ticks = [];
    for (var i = 0; i < 48; i++) {
      var a = i / 48 * TAU, r0 = r * 1.55, r1 = r * (i % 4 === 0 ? 1.85 : 1.7);
      ticks.push([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]]);
    }
    live(pen.lines2(ticks, 'l3'), { css: 'pf-spin', pad: 1 });
    pen.lines2([[[cx - r * 2.3, cy], [cx - r * 1.95, cy]], [[cx + r * 1.95, cy], [cx + r * 2.3, cy]], [[cx, cy - r * 2.3], [cx, cy - r * 1.95]], [[cx, cy + r * 1.95], [cx, cy + r * 2.3]]], 'l2');
    pen.close();
  }

  // The Exploration Company's Nyx: rounded capsule on a same-diameter service module, docking port forward.
  function drawNyx(pen, c, axis, k) {
    var prof = [[0, 29.4], [1.8, 29.4], [2.2, 31], [47.5, 31], [48.4, 31.9], [51.2, 31.9], [52, 31]], i, j;
    for (i = 1; i <= 16; i++) { var u = i / 16; prof.push([52 + 58 * u, 31 - 17 * Math.pow(u, 2.1)]); }
    prof.push([110.8, 12.8]);
    prof = prof.map(function (p) { return [p[0] * k, p[1] * k]; });
    pen.open({ 'class': 'nyx' });
    var S = pen.revolve(c, axis, prof);
    S.rings([2.2 * k, 47.5 * k, 48.4 * k, 51.2 * k], 'l2');
    var secs = [-100, -10, 80, 170].map(function (a) { return a * DEG; });
    S.mers(secs, 2.4 * k, 47.3 * k, 'l2');
    var grid = [];
    for (i = -94; i < -10; i += 6) grid.push(i * DEG);
    S.mers(grid, 2.4 * k, 47.3 * k, 'l3');
    var gr = [];
    for (i = 6; i < 47; i += 3.4) gr = gr.concat(S.ringRuns(i * k, null, -100 * DEG, -10 * DEG, 24));
    pen.lines2(gr, 'l3');
    var slats = [];
    for (i = 6; i < 80; i += 14.5) slats.push(i * DEG);
    S.mers(slats, 2.4 * k, 47.3 * k, 'l3');
    var rows = [0.14, 0.3, 0.46, 0.62, 0.78, 0.91];
    S.rings(rows.map(function (u) { return (52 + 58 * u) * k; }), 'l3');
    var bricks = [];
    for (i = 0; i < rows.length - 1; i++) {
      for (j = 0; j < 12; j++) {
        var th = (j * 30 + (i % 2 ? 15 : 0)) * DEG;
        bricks = bricks.concat(S.merRuns(th, (52 + 58 * rows[i]) * k, (52 + 58 * rows[i + 1]) * k, 6));
      }
    }
    pen.lines2(bricks, 'l3');
    var rcs = [];
    [-38, 52].forEach(function (a) {
      var th = a * DEG, t0 = 57 * k;
      rcs.push([t0 + 3.2 * k, th, 1.25 * k], [t0, th - 0.085, 1.25 * k], [t0, th + 0.085, 1.25 * k]);
    });
    rcs.push([104 * k, -70 * DEG, 1.1 * k], [104 * k, -64 * DEG, 1.1 * k]);
    S.dots(rcs, 'k2');
    if (S.av > 0) {
      var cn = S.center(110.8 * k), e1 = S.e1, e2 = S.e2;
      var dir = function (a, r) { return add(cn, add(mul(e1, Math.cos(a) * r), mul(e2, Math.sin(a) * r))); };
      var lobe = [];
      for (j = 0; j <= 72; j++) { var a = j / 72 * TAU; lobe.push(dir(a, 11.8 * k * (1 + 0.06 * Math.cos(4 * a + 0.4)))); }
      pen.line(lobe, 'l2');
      var bolts = [];
      for (j = 0; j < 12; j++) bolts.push(pen.pts(circle3(dir(j / 12 * TAU + 0.2, 10.2 * k), e1, e2, 0.55 * k, 8)));
      pen.lines2(bolts, 'l2', true);
      pen.circle(cn, e1, e2, 6.9 * k, 'k');
      pen.circle(cn, e1, e2, 5.1 * k, 'l3', 28);
      var pet = [];
      for (j = 0; j < 3; j++) {
        var b = j / 3 * TAU + 0.6;
        pet.push(pen.pts([dir(b - 0.45, 6.5 * k), dir(b + 0.45, 6.5 * k), dir(b, 2.4 * k)]));
      }
      pen.lines2(pet, 'k2', true);
      pen.circle(cn, e1, e2, 1.5 * k, 'l2', 12);
    }
    pen.close();
    return S;
  }

  // Starcloud-4 concept: a vast solar plane with an in-plane radiator band, and a spine of docked compute containers.
  function drawContainer(pen, x, y, z, L, W, logo) {
    var c = 5, h = W;
    pen.poly([[x, y + c, z + c], [x + c + 2, y, z], [x + c + 2, y, z + h], [x, y + c, z + h - c]], 'k2');
    pen.poly([[x, y + c, z + h - c], [x + c + 2, y, z + h], [x + c + 2, y + W, z + h], [x, y + W - c, z + h - c]], 'k2');
    pen.poly([[x, y + W - c, z + c], [x + c + 2, y + W, z], [x + c + 2, y + W, z + h], [x, y + W - c, z + h - c]], 'k2');
    pen.box(x + c + 2, y, z, L - c - 2, W, h, 'k');
    var x1 = x + L, y1 = y + W, z1 = z + h, i = 2.2, rv = [];
    rv.push([[x + c + 2 + i, y1, z + i], [x1 - i, y1, z + i]], [[x + c + 2 + i, y1, z1 - i], [x1 - i, y1, z1 - i]]);
    rv.push([[x + c + 2 + i, y + i, z1], [x1 - i, y + i, z1]], [[x + c + 2 + i, y1 - i, z1], [x1 - i, y1 - i, z1]]);
    rv.push([[x1, y + i, z + i], [x1, y1 - i, z + i]], [[x1, y + i, z1 - i], [x1, y1 - i, z1 - i]], [[x1, y + i, z + i], [x1, y + i, z1 - i]], [[x1, y1 - i, z + i], [x1, y1 - i, z1 - i]]);
    pen.lines(rv, 'l3 rivet');
    var hc = [x1, y + W / 2, z + h / 2];
    pen.circle(hc, Y, Z, W * 0.34, 'k2', 28);
    pen.circle(hc, Y, Z, W * 0.26, 'l3', 24);
    var sp = [], bolts = [];
    for (var k = 0; k < 8; k++) {
      var a = k / 8 * TAU;
      sp.push([add(hc, add(mul(Y, Math.cos(a) * W * 0.06), mul(Z, Math.sin(a) * W * 0.06))), add(hc, add(mul(Y, Math.cos(a) * W * 0.25), mul(Z, Math.sin(a) * W * 0.25)))]);
      bolts.push(pen.pts(circle3(add(hc, add(mul(Y, Math.cos(a + 0.39) * W * 0.4), mul(Z, Math.sin(a + 0.39) * W * 0.4))), Y, Z, 0.7, 6)));
    }
    pen.lines(sp, 'l3');
    pen.lines2(bolts, 'l3', true);
    var tri = [[[x + c + 3, y1, z + 1], [x + c + 7, y1, z + 1], [x + c + 3, y1, z + 5]], [[x1 - 1, y1, z1 - 1], [x1 - 5, y1, z1 - 1], [x1 - 1, y1, z1 - 5]]];
    pen.lines(tri, 'wf', true);
    if (logo) {
      var m = pen.planeM([x + c + 9, y1, z + h * 0.72], [1, 0, 0], [0, 0, -1]);
      pen.fig2([rrect2(0, 0, 7, 7, 1.2, 2)], m, 'k2', true);
      pen.fig('M1.4 5.2 C2.6 2.6 4.6 1.6 6 1.6', m, 'l2');
      pen.text('Starcloud', [m[0], m[1], m[2], m[3], m[4] + m[0] * 9.5 + m[2] * 5.6, m[5] + m[1] * 9.5 + m[3] * 5.6], 'tx', 6.4);
    }
  }

  function drawStarcloud(pen, anims) {
    pen.open({ 'class': 'starcloud' });
    var U = [0, -1, 0], V = [0, 0, 1];
    var o = [-14, 10, -40], LU = 760, LV = 300;
    pen.quad(o, mul(U, LU), mul(V, LV), 'k2');
    var g = [], i;
    for (i = 1; i < 30; i++) g.push([add(o, mul(U, LU * i / 30)), add(add(o, mul(U, LU * i / 30)), mul(V, LV))]);
    for (i = 1; i < 12; i++) g.push([add(o, mul(V, LV * i / 12)), add(add(o, mul(V, LV * i / 12)), mul(U, LU))]);
    pen.lines(g, 'l4 grid-hi');
    var mesh = [];
    for (i = 0; i < 90; i++) {
      var uu = 20 + i * 8;
      if (uu > 300 && uu < 400) continue;
      mesh.push([add(o, mul(U, uu)), add(add(o, mul(U, uu + 12)), mul(V, LV))]);
    }
    pen.lines(mesh, 'l4');
    var rb0 = 300, rb1 = 400;
    pen.quad(add(o, mul(U, rb0)), mul(U, rb1 - rb0), mul(V, LV), 'k2');
    var sl = [];
    for (i = 4; i < LV; i += 5) sl.push([add(add(o, mul(U, rb0)), mul(V, i)), add(add(o, mul(U, rb1)), mul(V, i))]);
    pen.lines(sl, 'l3');
    pen.lines([[add(o, mul(V, LV / 2)), add(add(o, mul(U, LU)), mul(V, LV / 2))], [add(o, mul(V, LV / 2 + 3)), add(add(o, mul(U, LU)), mul(V, LV / 2 + 3))]], 'l2');
    // spine truss
    var sx = -6, sy = -3, z0 = -70, z1 = 280;
    pen.box(sx, sy, z0, 7, 7, z1 - z0, 'k2');
    var zz = [];
    for (var z = z0; z < z1 - 10; z += 12) zz.push([[sx + 7, sy, z], [sx + 7, sy + 7, z + 6], [sx + 7, sy, z + 12]]);
    pen.lines(zz, 'l3');
    var zz2 = [];
    for (z = z0; z < z1 - 10; z += 12) zz2.push([[sx, sy + 7, z], [sx + 7, sy + 7, z + 6], [sx, sy + 7, z + 12]]);
    pen.lines(zz2, 'l3');
    // compute containers docked along the spine, stacked like books
    var W = 26, L = 62, lv;
    for (lv = 0; lv < 5; lv++) drawContainer(pen, 1, -W / 2, 8 + lv * (W + 8), L, W, lv === 1 || lv === 3);
    // docking port for visiting vehicles
    pen.circle([sx + 3.5, sy, 236], X, Z, 5.4, 'k2', 20);
    pen.circle([sx + 3.5, sy, 236], X, Z, 3, 'l3', 16);
    pen.close();
    // the next container arriving to dock
    var arW = pen.open(), ar = pen.open({ 'class': 'arrive' });
    drawContainer(pen, 1, -W / 2, 8 + 5 * (W + 8), L, W, true);
    pen.close();
    pen.close();
    var p0 = pen.P([150, 0, 8 + 5 * (W + 8)]), p1 = pen.P([1, 0, 8 + 5 * (W + 8)]);
    pen.path(dPoly([pen.P([L + 150, 0, 8 + 5 * (W + 8) + W / 2]), pen.P([L + 4, 0, 8 + 5 * (W + 8) + W / 2])], false), 'l3 dsh');
    function slide(t) {
      var u = (t * 0.07) % 1, k = u < 0.7 ? Math.pow(1 - u / 0.7, 3) : 0;
      var o = String(Math.round((u > 0.94 ? 1 - (u - 0.94) / 0.06 : (u < 0.08 ? u / 0.08 : 1)) * 50) / 50);
      nudge(ar, (p0[0] - p1[0]) * k, (p0[1] - p1[1]) * k);
      if (ar._pfO !== o) { ar._pfO = o; ar.style.opacity = o; }
    }
    slide(0.62 / 0.07);
    live(arW, { draw: slide, pad: 3 });
    anims.push(slide);
  }

  function drawTurbine(pen, anims) {
    pen.open({ 'class': 'turbine' });
    // concrete foundation, drawn in section below grade
    var cutG = [[-34, 0, 0], [34, 0, 0]];
    var sec = [[-28, 0, 0], [28, 0, 0], [28, 0, -12], [9, 0, -22], [-9, 0, -22], [-28, 0, -12]];
    pen.poly(sec, 'k2');
    pen.lines2(hatch2(pen.pts(sec), 0.78, 2.8), 'l3');
    pen.lines([cutG, [[-34, 0, 0], [-34, 0, -26]], [[34, 0, 0], [34, 0, -26]], [[-34, 0, -26], [34, 0, -26]]], 'l4 dsh');
    pen.circle([0, 0, 0], X, Y, 9, 'k2', 24);
    var H = 236;
    pen.revolve([0, 0, 0], Z, [[0, 6.4], [H, 3.4]]);
    pen.box(-28, -6, H - 3, 36, 12, 12, 'k');
    pen.lines([[[-24, 6, H + 5], [2, 6, H + 5]], [[8, -4, H + 1], [8, 4, H + 1]]], 'l3');
    pen.revolve([8, 0, H + 3], X, [[0, 5.4], [2, 5.4], [6, 4], [10, 0]]);
    var hub = pen.P([13, 0, H + 3]);
    var rg = pen.open({ 'class': 'rotor' });
    var rotor = pen.path('', 'k');
    var M = [C30 * pen.s, -0.5 * pen.s, 0, pen.s, hub[0], hub[1]];
    function blade(a) {
      var pts = [[0, -2.2], [10, -3.6], [26, -4.6], [62, -2.6], [108, -0.8], [110, 0.2], [62, 1.8], [26, 2.4], [10, 2.2], [0, 2.2]];
      var ca = Math.cos(a), sa = Math.sin(a);
      return tpts(pts.map(function (p) { return [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca]; }), M);
    }
    function draw(t) {
      var a0 = t * 0.9, d = '';
      for (var i = 0; i < 3; i++) d += dPoly(blade(a0 + i * TAU / 3), true);
      rotor.setAttribute('d', d);
    }
    draw(0.4);
    anims.push(draw);
    pen.path(dPoly(ellipse2(hub[0], hub[1], 2.2, 2.2, 0, 12), true), 'k');
    pen.close();
    live(rg, { draw: draw, pad: 2 });
    pen.close();
  }

  function drawCemvision(pen, anims) {
    pen.open({ 'class': 'cemvision' });
    var LX = 150, LY = 76, BZ = 22, i;
    function topAt(x) { return 56 + 4.5 * Math.sin(x * 0.05 + 0.4); }
    // slag heap (the raw material) and conveyor
    var hc = [-60, 46, 0], hr = 32, hh = 50, hp = [];
    var hcs = pen.P(hc);
    for (i = 0; i <= 40; i++) {
      var ht = i / 40, ha = Math.PI * ht;
      var bump = 1 + 0.05 * Math.sin(ht * 23) + 0.04 * Math.sin(ht * 9 + 1);
      hp.push([hcs[0] - Math.cos(ha) * hr * ISO * pen.s * bump, hcs[1] - Math.sin(ha) * hh * pen.s * bump * (0.85 + 0.15 * Math.sin(ha))]);
    }
    var hb = ellipse2(hcs[0], hcs[1], hr * ISO * pen.s, hr * 0.707 * pen.s, 0, 20, 0, Math.PI);
    pen.lines2([hp.concat(hb.slice().reverse())], 'k2', true);
    var contours = [];
    [0.35, 0.62, 0.84].forEach(function (u) {
      contours.push(ellipse2(hcs[0], hcs[1] - hh * pen.s * u, hr * ISO * pen.s * Math.sqrt(1 - u) * 0.98, hr * 0.707 * pen.s * Math.sqrt(1 - u) * 0.9, 0, 16, 0.15, Math.PI - 0.15));
    });
    pen.lines2(contours, 'l4');
    var st = [];
    for (i = 0; i < 46; i++) {
      var sa = hash(i) * Math.PI, sr = Math.sqrt(hash(i + 50)) * 0.92;
      var sx = hcs[0] - Math.cos(sa) * hr * ISO * pen.s * sr, sy = hcs[1] - Math.sin(sa) * hh * pen.s * (1 - sr) * 0.95 + hash(i + 7) * 3;
      st.push([[sx, sy], [sx + 1.2, sy + 0.3]]);
    }
    pen.lines2(st, 'l3');
    var c0 = [-58, 44, 46], c1 = [70, 40, 72];
    var legs = [];
    [0.3, 0.55, 0.8].forEach(function (u) {
      var q = mix(c0, c1, u);
      legs.push([[q[0] - 4, q[1] - 5, 0], [q[0], q[1] - 3, q[2] - 6]], [[q[0] + 4, q[1] + 5, 0], [q[0], q[1] + 3, q[2] - 6]]);
    });
    pen.lines(legs, 'l3');
    var tp0 = add(c0, [0, 3, 0]), tp1 = add(c1, [0, 3, 0]), bt0 = add(c0, [0, 3, -6]), bt1 = add(c1, [0, 3, -6]);
    pen.poly([tp0, tp1, bt1, bt0], 'k2');
    var zig = [];
    for (i = 0; i <= 16; i++) zig.push(mix(i % 2 ? tp0 : bt0, i % 2 ? tp1 : bt1, i / 16));
    pen.line(zig, 'l3');
    pen.poly([add(c0, [0, -3, 0]), add(c1, [0, -3, 0]), add(c1, [0, 3, 0]), add(c0, [0, 3, 0])], 'k2');
    pen.line([c1, add(c1, [0, 0, -28])], 'l2');
    var belt = pen.path('', 'l1 belt'), PB = pen.snap();
    function beltAt(t) {
      var d = '';
      for (var j = 0; j < 9; j++) {
        var u = ((t * 0.08 + j / 9) % 1), q = PB(mix(add(c0, [0, 0, 0.8]), add(c1, [0, 0, 0.8]), u));
        d += 'M' + f1(q[0] - 1.2) + ' ' + f1(q[1]) + 'L' + f1(q[0] + 1.2) + ' ' + f1(q[1] - 0.4);
      }
      belt.setAttribute('d', d);
    }
    live(belt, { draw: beltAt, pad: 2 });
    anims.push(beltAt);
    // hall: back wall and floor seen through the section cut
    var XC = 62, RZ = 49;
    function sideTop(y) { return topAt(LX) + 4 * Math.sin(y * 0.06); }
    var back = [[0, 0, 0], [LX, 0, 0]];
    for (i = 30; i >= 0; i--) back.push([LX * i / 30, 0, topAt(LX * i / 30) - 1]);
    pen.poly(back, 'k2');
    var bfl = [];
    for (i = XC + 6; i < LX; i += 6) bfl.push([[i, 0, BZ], [i, 0, topAt(i) - 1]]);
    pen.lines(bfl, 'l4');
    pen.poly([[XC - 4, 0, 0], [LX, 0, 0], [LX, LY, 0], [XC - 4, LY, 0]], 'k2');
    var fl = [];
    for (i = XC + 8; i < LX; i += 12) fl.push([[i, 0, 0], [i, LY, 0]]);
    pen.lines(fl, 'l4');
    // electric rotary kiln on piers, inclined toward the discharge end
    var ka = unit([1, 0, -0.06]), kb = [XC + 6, 40, 27];
    [12, 48].forEach(function (t) {
      var q = add(kb, mul(ka, t));
      pen.box(q[0] - 3, q[1] - 8, 0, 6, 16, q[2] - 10, 'k2');
    });
    var shell = pen.revolve(kb, ka, [[0, 8.2], [70, 8.2]]);
    shell.rings([6, 20, 28, 40, 56, 64], 'l3');
    shell.mers([-35 * DEG, 35 * DEG], 0, 70, 'l3');
    [12, 48].forEach(function (t) { pen.revolve(add(kb, mul(ka, t)), ka, [[0, 10], [3.4, 10]]); });
    var gear = pen.revolve(add(kb, mul(ka, 30)), ka, [[0, 11.6], [2.4, 11.6]]);
    var teeth = [];
    for (i = 0; i < 44; i++) teeth = teeth.concat(gear.merRuns(i / 44 * TAU, 0.2, 2.2, 2));
    pen.lines2(teeth, 'l3');
    pen.box(kb[0] + 66, 28, 0, 12, 24, 30, 'k');
    pen.lines([[[kb[0] + 78, 40, 4], [kb[0] + 78, 40, 26]], [[kb[0] + 78, 30, 20], [kb[0] + 78, 50, 20]]], 'l3');
    var cab = [[kb[0] - 2, 30, 36], [kb[0] - 2, 30, 62]];
    pen.lines([cab], 'l3');
    // roof, right wall and front wall, all cut back to reveal the kiln
    var roof = [[0, 0, RZ], [XC + 2.5 * Math.sin(0), 0, RZ]];
    for (i = 1; i <= 10; i++) roof.push([XC + 2.4 * Math.sin(i * 1.7), LY * i / 10, RZ]);
    roof.push([0, LY, RZ]);
    pen.poly(roof, 'k');
    var rl = [];
    for (i = 8; i < XC; i += 8) rl.push([[i, 2, RZ], [i, LY - 2, RZ]]);
    pen.lines(rl, 'l4');
    var side = [[LX, 0, 0], [LX, LY, 0]];
    for (i = 12; i >= 0; i--) side.push([LX, LY * i / 12, sideTop(LY * i / 12)]);
    pen.poly(side, 'k');
    var fl2 = [];
    for (i = 1; i < 13; i++) fl2.push([[LX, LY * i / 13, BZ], [LX, LY * i / 13, sideTop(LY * i / 13)]]);
    fl2.push([[LX, 0, BZ], [LX, LY, BZ]]);
    pen.lines(fl2, 'l3');
    var front = [[0, LY, 0], [LX, LY, 0], [LX, LY, 8]];
    for (i = 18; i >= 0; i--) { var sx2 = XC + (LX - XC) * i / 18; front.push([sx2, LY, 8 + 1.6 * Math.sin(i * 1.9)]); }
    for (i = 1; i <= 10; i++) { var zc = 8 + (topAt(XC) - 8) * i / 10; front.push([XC + 2.4 * Math.sin(i * 1.3 + 2), LY, zc]); }
    for (i = 12; i >= 0; i--) front.push([XC * i / 12, LY, topAt(XC * i / 12)]);
    pen.poly(front, 'k');
    var flutes = [];
    for (var x = 3; x < XC - 3; x += 6) flutes.push([[x, LY, BZ], [x, LY, topAt(x)]]);
    flutes.push([[0, LY, BZ], [XC, LY, BZ]]);
    pen.lines(flutes, 'l3');
    var perf = [];
    for (var zz2 = BZ + 4; zz2 < 50; zz2 += 4) perf.push([[2, LY, zz2], [XC - 4, LY, zz2]]);
    pen.lines(perf, 'l4 perf');
    var doors = [];
    [[6, 20], [28, 40]].forEach(function (d) { doors.push([[d[0], LY, 0], [d[0], LY, 16], [d[1], LY, 16], [d[1], LY, 0]]); });
    pen.lines(doors, 'l2');
    var m = pen.planeM([6, LY, 44], [1, 0, 0], [0, 0, -1]);
    pen.text('Cemvision', m, 'tx tx-hi', 8.6);
    pen.fig('M41.6 -5.6 L44.2 -3 L41.6 -0.4 M40 -6.8 C37.8 -5.6 37.8 -0.4 40 0.8', [m[0], m[1], m[2], m[3], m[4], m[5]], 'l2');
    // big bags of Re-ment
    for (var bi = 0; bi < 6; bi++) {
      var bx = 158 + (bi % 3) * 13, by = 46 + Math.floor(bi / 3) * 14;
      pen.box(bx, by, 0, 11, 11, 10, 'k2');
      pen.lines([[[bx + 1.5, by + 1.5, 10], [bx + 2.5, by + 1.5, 13], [bx + 3.5, by + 1.5, 10]], [[bx + 7.5, by + 9.5, 10], [bx + 8.5, by + 9.5, 13], [bx + 9.5, by + 9.5, 10]]], 'l3');
    }
    pen.close();
  }

  function drawCamion(pen, anims) {
    pen.open({ 'class': 'camion' });
    var i, k;
    // Camion's hex map of where energy assets pay off
    var hexes = [], hot = [];
    for (var hx = -3; hx < 16; hx++) {
      for (var hy = -2; hy < 10; hy++) {
        var cx = hx * 19.5 + (hy % 2 ? 9.75 : 0), cy = hy * 16.9;
        if (cx > -8 && cx < 180 && cy > -6 && cy < 104) continue;
        var ring = [];
        for (k = 0; k <= 6; k++) { var a = k / 6 * TAU + Math.PI / 6; ring.push([cx + Math.cos(a) * 10.4, cy + Math.sin(a) * 10.4, 0]); }
        var hv = hash(hx * 31 + hy * 7);
        (hv > 0.78 ? hot : hexes).push(ring);
      }
    }
    pen.lines(hexes, 'l4', true);
    pen.lines(hot, 'l3 hot', true);
    pen.box(0, 0, 0, 170, 96, 34, 'k');
    var fx = [];
    for (i = 1; i < 10; i++) fx.push([[170, i * 9.6, 0], [170, i * 9.6, 34]]);
    pen.lines(fx, 'l4');
    // rooftop solar rows
    var rows = [], cells = [];
    for (k = 0; k < 8; k++) {
      var y0 = 6 + k * 11;
      var q = [[6, y0, 38.6], [164, y0, 38.6], [164, y0 + 8, 35], [6, y0 + 8, 35]];
      rows.push(q);
      for (var cxx = 12; cxx < 164; cxx += 6.6) cells.push([[cxx, y0, 38.6], [cxx, y0 + 8, 35]]);
      cells.push([[6, y0 + 4, 36.8], [164, y0 + 4, 36.8]]);
    }
    rows.forEach(function (q) { pen.poly(q, 'k2'); });
    pen.lines(cells, 'l3');
    // loading docks, trucks
    var dk = [];
    for (i = 0; i < 7; i++) dk.push([[12 + i * 22, 96, 0], [12 + i * 22, 96, 15], [26 + i * 22, 96, 15], [26 + i * 22, 96, 0]]);
    pen.lines(dk, 'l2');
    function truck(x, withCab) {
      pen.box(x, 98, 3, 13, 46, 15, 'k');
      pen.lines([[[x + 13, 104, 3], [x + 13, 104, 18]], [[x + 13, 140, 3], [x + 13, 140, 18]]], 'l3');
      [104, 112, 136].forEach(function (y) { pen.circle([x + 13.2, y, 3], Y, Z, 2.6, 'k2', 14); });
      if (withCab) {
        pen.box(x + 0.5, 145, 2, 12, 5, 6, 'k2');
        pen.poly([[x + 13, 150, 2], [x + 13, 162, 2], [x + 13, 162, 9], [x + 13, 158, 17], [x + 13, 150, 17]], 'k');
        pen.poly([[x, 150, 17], [x + 13, 150, 17], [x + 13, 158, 17], [x, 158, 17]], 'k');
        pen.poly([[x, 158, 17], [x + 13, 158, 17], [x + 13, 162, 9], [x, 162, 9]], 'k');
        pen.poly([[x, 162, 9], [x + 13, 162, 9], [x + 13, 162, 2], [x, 162, 2]], 'k');
        pen.line([[x + 2, 159, 15.4], [x + 11, 159, 15.4]], 'l3');
        pen.circle([x + 13.2, 157, 2], Y, Z, 2.6, 'k2', 14);
      }
    }
    truck(34, true);
    truck(100, false);
    // chargers
    [[64, 118], [74, 118], [84, 118]].forEach(function (c) {
      pen.box(c[0], c[1], 0, 4, 3, 15, 'k2');
      pen.line([[c[0] + 4, c[1] + 1, 11], [c[0] + 4, c[1] + 2, 9.4]], 'l3');
    });
    // battery storage and substation
    pen.box(186, 12, 0, 30, 13, 13, 'k');
    var vents = [];
    for (i = 1; i < 10; i++) vents.push([[186 + i * 3, 25, 2], [186 + i * 3, 25, 11]]);
    pen.lines(vents, 'l3');
    pen.lines([[[216, 15, 1], [216, 15, 12]], [[216, 19, 1], [216, 19, 12]]], 'l3');
    var fence = [[184, 36, 0], [220, 36, 0], [220, 66, 0], [184, 66, 0]];
    pen.box(192, 44, 0, 10, 8, 9, 'k2');
    pen.box(204, 50, 0, 10, 8, 9, 'k2');
    var posts = [], wires = [];
    fence.forEach(function (p) { posts.push([p, [p[0], p[1], 9]]); });
    [3, 6, 9].forEach(function (z) { wires.push(fence.concat([fence[0]]).map(function (p) { return [p[0], p[1], z]; })); });
    pen.lines(posts, 'l3');
    pen.lines(wires, 'l4');
    pen.close();
    return {
      pins: [pen.P([90, 44, 40]), pen.P([201, 18, 14]), pen.P([74, 119, 16])]
    };
  }

  // Nyx under its three main parachutes, as in the 2026 drop test (screen space).
  function drawParachutes(pen, x, y, s) {
    pen.open({ 'class': 'chutes' });
    var domes = [[-17, 4, 0.82, -0.32], [0, -4, 1, 0], [17, 4, 0.82, 0.32]], cap = [x, y + 40 * s];
    domes.forEach(function (d) {
      var cx = x + d[0] * s, cy = y + d[1] * s, rx = 9.5 * s * d[2], ry = 7 * s * d[2];
      var top = ellipse2(cx, cy, rx, ry, d[3], 16, Math.PI, TAU);
      var lip = ellipse2(cx, cy, rx, ry * 0.3, d[3], 12, 0, Math.PI);
      pen.lines2([[top[0], cap], [top[top.length - 1], cap]], 'l3');
      pen.path(dPoly(top.concat(lip.slice().reverse()), true), 'k2');
      var gores = [];
      for (var g = 1; g < 5; g++) {
        var a = Math.PI + g / 5 * Math.PI;
        var px = cx + Math.cos(a) * rx * Math.cos(d[3]) - Math.sin(a) * ry * Math.sin(d[3]);
        var py = cy + Math.cos(a) * rx * Math.sin(d[3]) + Math.sin(a) * ry * Math.cos(d[3]);
        gores.push([[px, py], [cx + (px - cx) * 0.25, cy + ry * 0.2]]);
      }
      pen.lines2(gores, 'l4');
      pen.path(dPoly(ellipse2(cx + Math.sin(d[3]) * ry * 0.72, cy - Math.cos(d[3]) * ry * 0.72, rx * 0.3, ry * 0.14, d[3], 10), true), 'l3');
    });
    var c = cap;
    pen.path('M' + f1(c[0] - 3.2 * s) + ' ' + f1(c[1] + 6.6 * s) + ' C' + f1(c[0] - 3.2 * s) + ' ' + f1(c[1] + 1.4 * s) + ' ' + f1(c[0] - 1.6 * s) + ' ' + f1(c[1]) + ' ' + f1(c[0]) + ' ' + f1(c[1]) + ' C' + f1(c[0] + 1.6 * s) + ' ' + f1(c[1]) + ' ' + f1(c[0] + 3.2 * s) + ' ' + f1(c[1] + 1.4 * s) + ' ' + f1(c[0] + 3.2 * s) + ' ' + f1(c[1] + 6.6 * s) + ' Z', 'k');
    pen.close();
  }

  function drawStars(pen, box, n, seed) {
    var d = '';
    for (var i = 0; i < n; i++) {
      var x = box[0] + hash(seed + i * 3.1) * (box[2] - box[0]), y = box[1] + hash(seed + i * 7.7) * (box[3] - box[1]);
      var r = hash(seed + i) > 0.8 ? 2.2 : 1.1;
      d += 'M' + f1(x - r) + ' ' + f1(y) + 'L' + f1(x + r) + ' ' + f1(y) + 'M' + f1(x) + ' ' + f1(y - r) + 'L' + f1(x) + ' ' + f1(y + r);
    }
    pen.path(d, 'l3 stars');
  }

  function drawPin(pen, p, icon, h) {
    var x = p[0], y = p[1] - (h || 26);
    pen.path(dPoly([[x, p[1]], [x, y + 7]], false), 'l3 dsh');
    var d = 'M' + x + ' ' + (y + 9) + ' C' + (x - 2) + ' ' + (y + 6) + ' ' + (x - 6.5) + ' ' + (y + 3) + ' ' + (x - 6.5) + ' ' + (y - 2) +
      ' C' + (x - 6.5) + ' ' + (y - 6) + ' ' + (x - 3.5) + ' ' + (y - 8.5) + ' ' + x + ' ' + (y - 8.5) +
      ' C' + (x + 3.5) + ' ' + (y - 8.5) + ' ' + (x + 6.5) + ' ' + (y - 6) + ' ' + (x + 6.5) + ' ' + (y - 2) +
      ' C' + (x + 6.5) + ' ' + (y + 3) + ' ' + (x + 2) + ' ' + (y + 6) + ' ' + x + ' ' + (y + 9) + ' Z';
    pen.path(d, 'k pin');
    var cy = y - 2.2, ic = '';
    if (icon === 'sun') {
      pen.path(dPoly(ellipse2(x, cy, 1.9, 1.9, 0, 12), true), 'l2');
      for (var i = 0; i < 8; i++) { var a = i / 8 * TAU; ic += 'M' + f1(x + Math.cos(a) * 2.9) + ' ' + f1(cy + Math.sin(a) * 2.9) + 'L' + f1(x + Math.cos(a) * 3.9) + ' ' + f1(cy + Math.sin(a) * 3.9); }
    } else if (icon === 'battery') {
      ic = 'M' + (x - 3.4) + ' ' + (cy - 1.8) + 'h6.2v3.6h-6.2z M' + (x + 2.8) + ' ' + (cy - 0.8) + 'h0.8v1.6h-0.8 M' + (x - 2.4) + ' ' + (cy - 0.8) + 'v1.6 M' + (x - 1.2) + ' ' + (cy - 0.8) + 'v1.6 M' + x + ' ' + (cy - 0.8) + 'v1.6';
    } else {
      ic = 'M' + (x + 0.6) + ' ' + (cy - 3.6) + 'L' + (x - 1.8) + ' ' + (cy + 0.4) + 'H' + (x + 0.4) + 'L' + (x - 0.6) + ' ' + (cy + 3.6) + 'L' + (x + 2) + ' ' + (cy - 0.6) + 'H' + (x - 0.2) + 'Z';
    }
    pen.path(ic, 'l2');
  }

  // Quadruped from Generative Engineering's design study: reverse-knee legs with blade shins, arm folded on top.
  function drawQuadruped(pen, o, P, mode) {
    var solid = mode === 'solid', k1 = solid ? 'k' : (mode === 'wire' ? 'l2' : 'l3 dsh'), k2 = solid ? 'k2' : k1;
    var L = P.L, W = P.W, H = P.H, zb = P.zb, i;
    function leg(xh, side) {
      var y = o[1] + side * (W / 2 + 2.6);
      var hip = [o[0] + xh, y, o[2] + zb + 4];
      var knee = [o[0] + xh - P.up * 0.5, y, o[2] + zb + 4 - P.up * 0.86];
      var foot = [o[0] + xh + P.low * 0.28, y, o[2] + 0.6];
      var ctrl = [(knee[0] + foot[0]) / 2 - 3.2, y, (knee[2] + foot[2]) / 2 - 1];
      var cl = [], wl = [];
      for (i = 0; i <= 10; i++) {
        var t = i / 10, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        cl.push([a * knee[0] + b * ctrl[0] + c * foot[0], y, a * knee[2] + b * ctrl[2] + c * foot[2]]);
        wl.push(lerp(2.6, 0.8, t));
      }
      var left = [], right = [];
      for (i = 0; i <= 10; i++) {
        var p0 = cl[Math.max(0, i - 1)], p1 = cl[Math.min(10, i + 1)];
        var dx = p1[0] - p0[0], dz = p1[2] - p0[2], l = Math.hypot(dx, dz) || 1;
        var nx = -dz / l, nz = dx / l;
        left.push([cl[i][0] + nx * wl[i], y, cl[i][2] + nz * wl[i]]);
        right.push([cl[i][0] - nx * wl[i], y, cl[i][2] - nz * wl[i]]);
      }
      var toe = [foot[0] + 3.4, y, 1.2];
      pen.poly(left.concat([toe]).concat(right.reverse()), k2);
      pen.capsule(hip, knee, 4.2, 3.2, k1);
      if (solid) pen.sphere(knee, 2.4, 'k2');
      pen.circle(hip, X, Z, 5, k1, 18);
    }
    [[L * 0.2, -1], [L * 0.86, -1]].forEach(function (a) { leg(a[0], a[1]); });
    var rear = octo(W, H, 4, o[1], o[2] + zb), front = octo(W + 1.6, H + 1.4, 5.4, o[1], o[2] + zb - 0.4);
    pen.prismX(rear.map(function (p) { return [p[0], p[1]]; }), o[0], o[0] + L * 0.42, k1);
    pen.prismX(front.map(function (p) { return [p[0], p[1]]; }), o[0] + L * 0.42, o[0] + L, k1);
    if (solid) {
      var hz = [];
      for (i = 0; i < 7; i++) hz.push([[o[0] + 2 + i * 3.6, o[1] + W / 2, o[2] + zb + 4], [o[0] + 2 + i * 3.6, o[1] + W / 2, o[2] + zb + H - 4]]);
      pen.lines(hz, 'l4');
      pen.lines([[[o[0] + L * 0.62, o[1] + W / 2 + 0.8, o[2] + zb + 4], [o[0] + L * 0.7, o[1] + W / 2 + 0.8, o[2] + zb + 4], [o[0] + L * 0.7, o[1] + W / 2 + 0.8, o[2] + zb + 7], [o[0] + L * 0.62, o[1] + W / 2 + 0.8, o[2] + zb + 7]], [[o[0] + L * 0.73, o[1] + W / 2 + 0.8, o[2] + zb + 4], [o[0] + L * 0.83, o[1] + W / 2 + 0.8, o[2] + zb + 4], [o[0] + L * 0.83, o[1] + W / 2 + 0.8, o[2] + zb + 7.4], [o[0] + L * 0.73, o[1] + W / 2 + 0.8, o[2] + zb + 6.4]]], 'l2', true);
    }
    var top = o[2] + zb + H + 0.6, ab = [o[0] + L * 0.66, o[1], top];
    pen.revolve(ab, Z, [[0, 4.4], [3.4, 4.4]], solid ? {} : { noFill: true, cls: k1 });
    var el1 = [o[0] + L * 0.34, o[1], top + 13], wr = [o[0] + L * 0.74, o[1], top + 18];
    pen.capsule([ab[0], ab[1], top + 5], el1, 3.4, 3, k1);
    pen.capsule(el1, wr, 3, 2.6, k1);
    pen.revolve([wr[0] + 1, wr[1], wr[2]], X, [[0, 2.6], [5, 2.6]], solid ? {} : { noFill: true, cls: k1 });
    pen.lines([[[wr[0] + 6, wr[1] - 1.8, wr[2] + 1.8], [wr[0] + 10, wr[1] - 1.8, wr[2] + 1.8], [wr[0] + 10, wr[1] - 1.8, wr[2] + 0.4]], [[wr[0] + 6, wr[1] + 1.8, wr[2] - 1.8], [wr[0] + 10, wr[1] + 1.8, wr[2] - 1.8], [wr[0] + 10, wr[1] + 1.8, wr[2] - 0.4]]], solid ? 'l1' : k1);
    [[L * 0.2, 1], [L * 0.86, 1]].forEach(function (a) { leg(a[0], a[1]); });
  }

  // Front view of a quadruped variant, as in the platform's design grid (local units, card 38 x 44).
  function variantThumb(v) {
    var cx = 19, bw = 13 + v * 2.4, lg = 14 + v * 3.4, top = 12, bh = 8;
    var shell = 'M' + (cx - bw / 2) + ' ' + (top + bh) + ' L' + (cx - bw / 2 + 1.6) + ' ' + top + ' L' + (cx + bw / 2 - 1.6) + ' ' + top + ' L' + (cx + bw / 2) + ' ' + (top + bh) + ' Z';
    var face = 'M' + (cx - 2.6) + ' ' + (top + 2.4) + ' L' + (cx + 2.6) + ' ' + (top + 2.4) + ' L' + (cx + 2) + ' ' + (top + 6.4) + ' L' + (cx - 2) + ' ' + (top + 6.4) + ' Z';
    var y0 = top + bh - 1, lx = bw / 2 - 1.2;
    var legs = 'M' + (cx - lx) + ' ' + y0 + ' L' + (cx - lx - 1) + ' ' + (y0 + lg * 0.55) + ' L' + (cx - lx - 0.4) + ' ' + (y0 + lg) +
      ' M' + (cx + lx) + ' ' + y0 + ' L' + (cx + lx + 1) + ' ' + (y0 + lg * 0.55) + ' L' + (cx + lx + 0.4) + ' ' + (y0 + lg) +
      ' M' + (cx - lx + 2.6) + ' ' + y0 + ' L' + (cx - lx + 2) + ' ' + (y0 + lg * 0.9) +
      ' M' + (cx + lx - 2.6) + ' ' + y0 + ' L' + (cx + lx - 2) + ' ' + (y0 + lg * 0.9);
    var arm = 'M' + (cx - 1.4) + ' ' + top + ' L' + (cx - 1.4) + ' ' + (top - 3.2) + ' L' + (cx + 1.4) + ' ' + (top - 3.2) + ' L' + (cx + 1.4) + ' ' + top;
    return { shell: shell, face: face, legs: legs, arm: arm };
  }

  function drawGenEng(pen) {
    pen.open({ 'class': 'geneng' });
    var i, j;
    // projection pad
    pen.path(dPoly(pen.pts(circle3([118, 42, 0], X, Y, 50, 64)), true), 'l3');
    pen.path(dPoly(pen.pts(circle3([118, 42, 0], X, Y, 44, 64)), true), 'l4');
    var ticks = [];
    for (i = 0; i < 36; i++) { var a = i / 36 * TAU; ticks.push([[118 + Math.cos(a) * 44, 42 + Math.sin(a) * 44, 0], [118 + Math.cos(a) * 50, 42 + Math.sin(a) * 50, 0]]); }
    pen.lines(ticks, 'l4');
    // a grid of generated candidates, each simulated and scored
    for (j = 0; j < 3; j++) {
      var co = [60 + j * 46, -18, 118], m = pen.planeM(co, [1, 0, 0], [0, 0, -1]);
      pen.fig2([rrect2(0, 0, 38, 46, 3, 3)], m, j === 1 ? 'k' : 'k2', true);
      pen.text('Design ' + (27 - j), [m[0], m[1], m[2], m[3], m[4] + m[0] * 19 + m[2] * 7.6, m[5] + m[1] * 19 + m[3] * 7.6], 'tx', 5.2, 'middle');
      var th = variantThumb(j);
      pen.fig(th.shell, m, j === 1 ? 'k' : 'k2');
      pen.fig(th.face, m, 'l3');
      pen.fig(th.legs + th.arm, m, j === 1 ? 'l1' : 'l2');
      var b0 = add(co, [4, 0, -46]), b1 = add(co, [34, 0, -46]);
      pen.lines([[b0, [110 + j * 6, 30, 0]], [b1, [122 + j * 6, 40, 0]]], 'l4 dsh');
    }
    // 3D scatter of candidates against constraints
    var so = [196, -44, 40], SZ = 40;
    var e = [[0, 0, 0], [SZ, 0, 0], [SZ, SZ, 0], [0, SZ, 0]], cube = [];
    for (i = 0; i < 4; i++) {
      var a0 = add(so, e[i]), a1 = add(so, e[(i + 1) % 4]);
      cube.push([a0, a1], [add(a0, [0, 0, SZ]), add(a1, [0, 0, SZ])], [a0, add(a0, [0, 0, SZ])]);
    }
    pen.lines(cube, 'l3');
    var bb = [], bo = add(so, [6, 14, 4]), bs = [26, 20, 16];
    var be = [[0, 0, 0], [bs[0], 0, 0], [bs[0], bs[1], 0], [0, bs[1], 0]];
    for (i = 0; i < 4; i++) {
      var b0 = add(bo, be[i]), b1 = add(bo, be[(i + 1) % 4]);
      bb.push([b0, b1], [add(b0, [0, 0, bs[2]]), add(b1, [0, 0, bs[2]])], [b0, add(b0, [0, 0, bs[2]])]);
    }
    pen.lines(bb, 'l2 dsh');
    var pts = [], hot = [];
    for (i = 0; i < 46; i++) {
      var q = add(so, [hash(i) * SZ, hash(i + 20) * SZ, Math.pow(hash(i + 40), 1.6) * SZ]);
      var inside = q[0] > bo[0] && q[0] < bo[0] + bs[0] && q[1] > bo[1] && q[1] < bo[1] + bs[1] && q[2] > bo[2] && q[2] < bo[2] + bs[2];
      var s = pen.P(q);
      (inside ? hot : pts).push(ellipse2(s[0], s[1], inside ? 1.1 : 0.8, inside ? 1.1 : 0.8, 0, 6));
    }
    pen.lines2(pts, 'l3', true);
    pen.lines2(hot, 'wf scatter-hot', true);
    var star = pen.P(add(bo, [14, 8, 10]));
    pen.path('M' + star[0] + ' ' + (star[1] - 3.4) + 'L' + (star[0] + 0.9) + ' ' + (star[1] - 0.9) + 'L' + (star[0] + 3.4) + ' ' + star[1] + 'L' + (star[0] + 0.9) + ' ' + (star[1] + 0.9) + 'L' + star[0] + ' ' + (star[1] + 3.4) + 'L' + (star[0] - 0.9) + ' ' + (star[1] + 0.9) + 'L' + (star[0] - 3.4) + ' ' + star[1] + 'L' + (star[0] - 0.9) + ' ' + (star[1] - 0.9) + 'Z', 'wf');
    // the chosen design, built
    drawQuadruped(pen, [88, 42, 0], { L: 62, W: 22, H: 14, zb: 30, up: 32, low: 34 }, 'solid');
    pen.close();
  }

  // A seated person facing right, wearing headphones, holding a phone. Height units match NEO.
  FIG.sit = {
    shins: 'M13.8 -30.4 L12.6 -3.8 L17.4 -3.8 L19.6 -28.6 Z',
    feet: 'M12 -4.2 L11.6 -0.4 L21.8 -0.4 C21.8 -2.6 20.2 -4 17.8 -4.2 Z',
    thighs: 'M-8 -35.4 L16.4 -34.4 C19.8 -34.2 20.8 -30.6 19.8 -27.8 L-7.4 -26.6 Z',
    torso: 'M-4.8 -59.6 C-8.4 -58.8 -9.6 -55 -9.2 -50 L-8.4 -33 L5.4 -33.4 L6.8 -49.6 C7.2 -54.8 5.8 -58.8 3.2 -59.6 Z',
    upper: 'M0.6 -57.4 L6.4 -43.2 L3 -41.4 L-2.6 -54.8 Z',
    fore: 'M3.2 -44.6 L12.6 -51.8 L14.4 -48.8 L5.6 -41.4 Z',
    phone: 'M12.6 -56.8 L16.4 -55.8 L15 -48.4 L11.2 -49.4 Z',
    head: ellipse2(-0.8, -67.6, 5.2, 6.3, 0, 24),
    hair: 'M-6 -68.6 C-6.6 -73.4 -2.6 -75.4 1 -74.4 C3.6 -73.6 4.6 -71.4 4.2 -69.6 C2 -71.8 -2.6 -71.6 -6 -68.6 Z',
    band: 'M-5.8 -66.8 C-6.4 -74.6 4.6 -75.6 4.8 -67.6',
    cup: rrect2(-4.4, -70.4, 4.6, 6.8, 1.4, 3)
  };

  function drawSeated(pen, x, y, s) {
    var F = FIG.sit, m = absM(pen, s, x, y);
    pen.open({ 'class': 'person' });
    pen.fig(F.shins, m, 'k2');
    pen.fig(F.feet, m, 'k2');
    pen.fig(F.thighs, m, 'k2');
    pen.fig(F.torso, m, 'k2');
    pen.fig(F.upper, m, 'k2');
    pen.fig(F.phone, m, 'k');
    pen.fig(F.fore, m, 'k2');
    pen.fig2([F.head], m, 'k2', true);
    pen.fig(F.hair, m, 'k2');
    pen.fig(F.band, m, 'l1');
    pen.fig2([F.cup], m, 'k', true);
    pen.close();
  }

  // Nothing Phone (3), back, in millimetres (75.6 x 160.6), from the official orthographic render.
  function phoneBack(pen, m, anims) {
    var lists = [];
    pen.fig2([rrect2(0, 0, 75.6, 160.6, 9.5, 6)], m, 'k', true);
    pen.fig2([rrect2(1.4, 1.4, 72.8, 157.8, 8.2, 6)], m, 'l3', true);
    var L2 = [
      [[3.8, 27.8], [71.8, 27.8]], [[26.3, 27.8], [26.3, 141]], [[49.2, 50], [49.2, 141]], [[3.8, 50], [49.2, 50]],
      [[3.8, 58], [26.3, 58]], [[3.8, 72.5], [26.3, 72.5]], [[26.3, 118], [49.2, 118]], [[26.3, 121], [49.2, 121]],
      [[3.8, 141], [71.8, 141]], [[49.2, 98], [71.8, 98]]
    ];
    pen.fig2(L2, m, 'l3');
    // periscope plate and lens
    var plate = [];
    var c1 = [10.7, 17.7], c2 = [18.3, 9.3];
    var ang = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
    for (var i = 0; i <= 12; i++) { var a = ang + Math.PI / 2 + i / 12 * Math.PI; plate.push([c1[0] + Math.cos(a) * 9, c1[1] + Math.sin(a) * 9]); }
    for (i = 0; i <= 12; i++) { var b = ang - Math.PI / 2 + i / 12 * Math.PI; plate.push([c2[0] + Math.cos(b) * 5, c2[1] + Math.sin(b) * 5]); }
    pen.fig2([plate], m, 'l3', true);
    pen.fig2([ellipse2(18.3, 9.3, 3, 3, 0, 14)], m, 'l3', true);
    pen.fig2([ellipse2(10.7, 17.7, 7, 7, 0, 28)], m, 'k', true);
    pen.fig2([rrect2(7.8, 14.8, 5.8, 5.8, 1.4, 3)], m, 'l2', true);
    // flash disc
    pen.fig2([ellipse2(38.1, 14.8, 11, 11, 0, 36)], m, 'k2', true);
    pen.fig2([[[27.3, 16.8], [48.9, 16.8]]], m, 'l3');
    pen.fig2([ellipse2(38.1, 13, 1.3, 1.3, 0, 10)], m, 'l2', true);
    // Glyph Matrix: 25 x 25 LEDs clipped to a circle
    pen.fig2([ellipse2(60.8, 15.2, 11, 11, 0, 40)], m, 'k', true);
    var off = [], cells = [];
    for (var r = 0; r < 25; r++) {
      for (var c = 0; c < 25; c++) {
        var dx = (c - 12) * 0.8, dy = (r - 12) * 0.8;
        if (dx * dx + dy * dy > 9.9 * 9.9) continue;
        cells.push([c, r]);
        off.push([[60.8 + dx, 15.2 + dy], [60.8 + dx + 0.01, 15.2 + dy]]);
      }
    }
    pen.fig2(off, m, 'led-off');
    var lit = pen.path('', 'led-on');
    var mm = [m[0] * pen.s, m[1] * pen.s, m[2] * pen.s, m[3] * pen.s, pen.ox + m[4] * pen.s, pen.oy + m[5] * pen.s];
    function glyph(t) {
      var d = '';
      for (var c = 2; c < 23; c++) {
        var amp = (Math.sin(c * 0.9 + t * 3.1) * 0.5 + Math.sin(c * 0.37 - t * 1.7) * 0.5) * 6 * Math.sin((c - 2) / 20 * Math.PI);
        var h = Math.max(0, Math.round(Math.abs(amp)));
        for (var r = 12 - h; r <= 12 + h; r++) {
          var dx = (c - 12) * 0.8, dy = (r - 12) * 0.8;
          if (dx * dx + dy * dy > 9.9 * 9.9) continue;
          var p = tpts([[60.8 + dx, 15.2 + dy]], mm)[0];
          d += 'M' + f1(p[0]) + ' ' + f1(p[1]) + 'h0.01';
        }
      }
      lit.setAttribute('d', d);
    }
    glyph(0.6);
    live(lit, { draw: glyph, pad: 2 });
    anims.push(function (t) { if (Math.floor(t * 8) !== glyph.f) { glyph.f = Math.floor(t * 8); glyph(glyph.f / 8); } });
    // cameras
    [[15, 38.5], [37.8, 38.5]].forEach(function (p) {
      pen.fig2([ellipse2(p[0], p[1], 7.4, 7.4, 0, 30)], m, 'k', true);
      pen.fig2([ellipse2(p[0], p[1], 4.6, 4.6, 0, 24), ellipse2(p[0], p[1], 2, 2, 0, 14)], m, 'l2', true);
    });
    pen.fig2([[[26.5, 46], [30.5, 46], [30.5, 50], [26.5, 50]]], m, 'wf', true);
    pen.fig2([rrect2(66.2, 28.2, 4.6, 4.6, 0.6, 2)], m, 'l3', true);
    // concentric half-disc
    var arcs = [];
    for (var rr = 3; rr <= 22; rr += 1.9) arcs.push(ellipse2(49.2, 49.8, rr, rr, 0, 20, -Math.PI / 2, Math.PI / 2));
    arcs.push([[49.2, 49.8], [61.2, 49.8]]);
    pen.fig2(arcs, m, 'l3');
    pen.fig2([ellipse2(64.7, 74.6, 6, 6, 0, 24), ellipse2(64.6, 88.8, 6.3, 6.3, 0, 24), ellipse2(70.2, 64.7, 1, 1, 0, 8)], m, 'l2', true);
    pen.fig2([rrect2(57, 82, 15, 14, 1.2, 2)], m, 'l3', true);
    pen.fig2([rrect2(3.7, 98.5, 3, 26.5, 1.4, 3), rrect2(68.6, 98.5, 3, 26.5, 1.4, 3)], m, 'l3', true);
    pen.fig2([[[29, 157], [29, 146], [46, 146], [46, 157]]], m, 'l3');
    pen.fig2([ellipse2(37.5, 146, 8.5, 4.4, 0, 16, Math.PI, TAU)], m, 'l3');
    var screws = [[7.2, 7.5], [26.7, 5.7], [69.5, 5.7], [6.3, 153.1], [42.6, 149.8], [31.3, 153.5]];
    pen.fig2(screws.map(function (p) { return ellipse2(p[0], p[1], 1.25, 1.25, 0, 10); }), m, 'l3', true);
    lists = [];
    for (i = 0; i < 7; i++) lists.push([[7.8, 128 + i * 1.8], [8.6, 128 + i * 1.8]]);
    pen.fig2(lists, m, 'l3');
  }

  // Detail view of the Nothing Phone (3) back, with a leader to the phone in hand.
  function drawPhoneCallout(pen, cc, cr, ps, target, anims) {
    pen.at(0, 0, 1);
    var id = 'pf-clip-phone-' + Math.round(cc[0]) + '-' + Math.round(cc[1]);
    var clip = el('clipPath', { id: id });
    clip.appendChild(el('circle', { cx: cc[0], cy: cc[1], r: cr - 1.2 }));
    pen.g.appendChild(clip);
    pen.path(dPoly(ellipse2(cc[0], cc[1], cr, cr, 0, 72), true), 'k');
    pen.open({ 'clip-path': 'url(#' + id + ')' });
    phoneBack(pen, [ps, 0, 0, ps, cc[0] - 38 * ps, cc[1] - 36 * ps], anims);
    pen.close();
    pen.path(dPoly(ellipse2(cc[0], cc[1], cr + 4, cr + 4, 0, 72), true), 'l3 dsh');
    var ang = Math.atan2(target[1] - cc[1], target[0] - cc[0]);
    pen.path(dPoly([[cc[0] + Math.cos(ang) * (cr + 4), cc[1] + Math.sin(ang) * (cr + 4)], [target[0] - Math.cos(ang) * 6, target[1] - Math.sin(ang) * 6]], false), 'callout');
    pen.path(dPoly(ellipse2(target[0], target[1], 6, 6, 0, 16), true), 'callout');
    return [cc[0], cc[1] - cr - 4];
  }

  function drawHumeCard(pen, x, y, anims) {
    pen.open({ 'class': 'hume-card' });
    var w = 96, h = 58;
    pen.path(dPoly(rrect2(x, y, w, h, 6, 4), true) , 'k2');
    pen.path(dPoly([[x + 18, y + h], [x + 24, y + h + 8], [x + 28, y + h]], false), 'l2');
    pen.path(dPoly([[x + 18.6, y + h], [x + 27.4, y + h]], false), 'f-line');
    var bars = pen.path('', 'l2');
    function wave(t) {
      var d = '';
      for (var i = 0; i < 26; i++) {
        var a = Math.abs(Math.sin(i * 0.8 + t * 5) * Math.sin(i * 0.23 + t * 1.3)) * 6 + 0.6;
        var bx = x + 8 + i * 3.1;
        d += 'M' + f1(bx) + ' ' + f1(y + 13 - a) + 'L' + f1(bx) + ' ' + f1(y + 13 + a);
      }
      bars.setAttribute('d', d);
    }
    wave(0.3);
    live(bars, { draw: wave, pad: 2 });
    anims.push(function (t) { if (Math.floor(t * 14) !== wave.f) { wave.f = Math.floor(t * 14); wave(wave.f / 14); } });
    var rows = [['Calmness', 0.27], ['Interest', 0.19], ['Amusement', 0.13]];
    rows.forEach(function (r, i) {
      var ry = y + 28 + i * 9.6;
      pen.text(r[0], [1, 0, 0, 1, (x + 8 - pen.ox) / pen.s, (ry - pen.oy) / pen.s], 'tx', 5.6);
      pen.text(r[1].toFixed(2), [1, 0, 0, 1, (x + w - 8 - pen.ox) / pen.s, (ry - pen.oy) / pen.s], 'tx', 5.6, 'end');
      pen.path(dPoly([[x + 8, ry + 2.6], [x + w - 8, ry + 2.6]], false), 'l4');
      pen.path(dPoly([[x + 8, ry + 2.6], [x + 8 + (w - 16) * r[1] * 2.2, ry + 2.6]], false), 'l1');
    });
    pen.close();
  }

  function drawHome(pen, anims) {
    pen.open({ 'class': 'home' });
    var i;
    pen.box(0, 0, -8, 200, 150, 8, 'k');
    pen.lines2(hatch2(pen.pts([[0, 150, 0], [200, 150, 0], [200, 150, -8], [0, 150, -8]]), -0.9, 3.2), 'l4');
    pen.lines2(hatch2(pen.pts([[200, 0, 0], [200, 150, 0], [200, 150, -8], [200, 0, -8]]), -0.9, 3.2), 'l4');
    pen.box(0, 0, 0, 200, 5, 112, 'k');
    pen.box(0, 5, 0, 5, 145, 112, 'k');
    var win = [[[92, 5, 30], [176, 5, 30], [176, 5, 96], [92, 5, 96]]];
    pen.lines(win, 'l2', true);
    pen.lines([[[134, 5, 30], [134, 5, 96]], [[92, 5, 62], [176, 5, 62]], [[94, 5, 32], [132, 5, 32], [132, 5, 94]], [[136, 5, 94], [174, 5, 94], [174, 5, 32]]], 'l3');
    pen.lines([[[5, 18, 0], [5, 18, 88], [5, 50, 88], [5, 50, 0]]], 'l2');
    pen.lines([[[5, 46, 44], [5, 44, 44]]], 'l2');
    // rug, credenza, lamp, plant
    pen.lines([[[44, 34, 0.2], [160, 34, 0.2], [160, 124, 0.2], [44, 124, 0.2]]], 'l3', true);
    pen.lines([[[50, 40, 0.2], [154, 40, 0.2], [154, 118, 0.2], [50, 118, 0.2]]], 'l4', true);
    pen.box(24, 6, 0, 58, 16, 24, 'k2');
    pen.lines([[[53, 22, 2], [53, 22, 22]], [[24, 22, 12], [82, 22, 12]]], 'l3');
    pen.revolve([188, 18, 0], Z, [[0, 7], [16, 9]], { cls: 'l2' });
    var leaves = [];
    for (i = 0; i < 9; i++) {
      var a = i / 9 * TAU, p = pen.P([188 + Math.cos(a) * 10, 18 + Math.sin(a) * 10, 30 + hash(i) * 14]);
      leaves.push(ellipse2(p[0], p[1], 4.4 * pen.s, 2.2 * pen.s, a * 0.6, 12));
    }
    pen.lines2(leaves, 'k2', true);
    pen.line([[14, 136, 0], [14, 136, 72]], 'l2');
    pen.revolve([14, 136, 66], Z, [[0, 9], [14, 5]], { cls: 'l2' });
    // sofa
    pen.box(8, 26, 0, 42, 104, 11, 'k');
    pen.box(8, 26, 11, 42, 104, 7, 'k');
    pen.lines([[[10, 60, 18], [50, 60, 18]], [[10, 95, 18], [50, 95, 18]]], 'l3');
    pen.box(8, 26, 18, 12, 104, 22, 'k');
    pen.box(8, 20, 0, 42, 8, 28, 'k');
    pen.box(8, 128, 0, 42, 8, 28, 'k');
    // coffee table
    pen.box(66, 60, 13, 34, 38, 3, 'k');
    pen.lines([[[70, 94, 0], [70, 94, 13]], [[96, 94, 0], [96, 94, 13]], [[96, 64, 0], [96, 64, 13]]], 'l2');
    pen.box(76, 70, 16, 12, 9, 2, 'k2');
    pen.close();
  }

  // Odyssey: the capture backpack (a mast of cameras and lidar) walking the street.
  FIG.rig = {
    pack: 'M-11.4 -80 C-13.4 -79.6 -14.4 -77.6 -14.4 -74.4 L-14 -58 C-13.8 -55.6 -12.4 -54.8 -10.6 -54.8 L-7 -55 L-6.8 -80.4 Z',
    mast: 'M-12 -80 C-12.6 -96 -11.6 -108 -5.4 -114.6 C-0.8 -119.6 6.4 -120 10.4 -117',
    head: ellipse2(14.2, -113, 7.2, 7.2, 0, 28),
    ribs: 'M8.8 -118.6 C13 -116.4 14.4 -111.4 12.6 -106.6 M13.8 -120.2 C18 -117.8 19.4 -112 17.2 -107.2 M8.4 -110.4 C12 -109.2 16.8 -109.8 20.6 -112.4',
    lenses: [ellipse2(17.8, -113.8, 1.9, 1.9, 0, 12), ellipse2(11.2, -110.4, 1.6, 1.6, 0, 12), ellipse2(15.4, -118, 1.2, 1.2, 0, 10), ellipse2(18.2, -108.2, 1.1, 1.1, 0, 10)],
    lidar: 'M7.4 -120.4 L11.4 -123 L13.8 -119.6 L9.8 -117 Z M15.6 -106.2 L20.2 -105.4 L19.4 -101.6 L14.8 -102.4 Z',
    fins: 'M8.4 -120.6 L11.8 -118.4 M9.4 -121.4 L12.8 -119.2 M16 -104.8 L19.6 -104.2 M15.8 -103.4 L19.4 -102.8',
    gps: 'M14.2 -120.2 L14.2 -124.6 M11 -125.4 L17.4 -125.4 L16.6 -124 L11.8 -124 Z',
    strap: 'M-6.8 -78.6 C-3 -74 1.6 -70 3.6 -66 M-7.2 -58 L5.8 -57.4',
    buckle: 'M-1.6 -59 L1.8 -58.8 L1.8 -56.4 L-1.6 -56.6 Z',
    rod: 'M-9 -76 L-20 -58'
  };

  function drawWalker(pen, x, y, s) {
    var F = FIG.rig, m = absM(pen, s, x, y);
    pen.open({ 'class': 'walker' });
    pen.fig(F.rod, m, 'l2');
    drawPerson(pen, 'walk', x, y, s, false);
    pen.fig(F.pack, m, 'k');
    pen.fig(F.strap, m, 'l2');
    pen.fig(F.buckle, m, 'wf');
    pen.fig(F.mast, m, 'tube-o');
    pen.fig(F.mast, m, 'tube-i');
    pen.fig(F.lidar, m, 'k2');
    pen.fig(F.fins, m, 'l3');
    pen.fig2([F.head], m, 'k', true);
    pen.fig(F.ribs, m, 'l2');
    pen.fig2(F.lenses, m, 'l2', true);
    pen.fig(F.gps, m, 'k2');
    pen.close();
  }

  function drawOdyssey(pen, anims) {
    pen.open({ 'class': 'odyssey' });
    var i;
    // the display: a world model streaming the street as interactive video
    var W = 124, H = 72, q = 1.42;
    pen.box(26, -5, 0, 5, 5, 20, 'k2');
    pen.box(W * q - 31, -5, 0, 5, 5, 20, 'k2');
    pen.box(-4, -7, 18, W * q + 8, 7, H * q + 6, 'k');
    var m = pen.planeM([0, 0, 21 + H * q], [q, 0, 0], [0, 0, -q]);
    pen.fig2([rrect2(4, 4, W - 8, H - 22, 2.4, 3)], m, 'l2', true);
    // one generated frame: the street ahead, in perspective
    var vx = 62, vy = 24;
    function toV(x0, y0, t) { return [lerp(x0, vx, t), lerp(y0, vy, t)]; }
    var scene = [
      [[30, 54], toV(30, 54, 0.93)], [[94, 54], toV(94, 54, 0.93)], [[8, 54], toV(8, 54, 0.9)], [[116, 54], toV(116, 54, 0.9)],
      [[5, vy], [W - 5, vy]]
    ];
    [0, 0.34, 0.56, 0.7, 0.8].forEach(function (t, k) {
      var t1 = [0.34, 0.56, 0.7, 0.8, 0.88][k];
      var a = toV(6, 50, t), b = toV(6, 50, t1), c = toV(6, 6 + k * 2, t1), d = toV(6, 6 + k * 2, t);
      scene.push([a, d, c, b]);
      var a2 = toV(118, 50, t), b2 = toV(118, 50, t1), c2 = toV(118, 8 + k * 2.4, t1), d2 = toV(118, 8 + k * 2.4, t);
      scene.push([a2, d2, c2, b2]);
    });
    pen.fig2(scene, m, 'l3');
    var wins = [];
    [0.08, 0.2, 0.42, 0.62].forEach(function (t) {
      [14, 24, 34].forEach(function (yy) {
        var p = toV(6, yy, t), q = toV(6, yy + 5, t + 0.06);
        wins.push([p, [p[0], q[1]], q, [q[0], p[1] + (q[1] - p[1]) * 0.1]]);
        var p2 = toV(118, yy, t), q2 = toV(118, yy + 5, t + 0.06);
        wins.push([p2, [p2[0], q2[1]], q2, [q2[0], p2[1] + (q2[1] - p2[1]) * 0.1]]);
      });
    });
    pen.fig2(wins, m, 'l4', true);
    var trees = [];
    [0.18, 0.46, 0.66].forEach(function (t) {
      var l = toV(24, 52, t), r = toV(100, 52, t), s = 1 - t;
      trees.push(ellipse2(l[0], l[1] - 11 * s, 4.2 * s, 7 * s, 0, 14), ellipse2(r[0], r[1] - 11 * s, 4.2 * s, 7 * s, 0, 14));
    });
    pen.fig2(trees, m, 'l3', true);
    var dash = [];
    for (i = 0; i < 6; i++) { var t0 = i / 6 * 0.85, t1 = t0 + 0.07; dash.push([toV(62, 54, t0), toV(62, 54, t1)]); }
    pen.fig2(dash, m, 'l2');
    var fg = toV(84, 54, 0.46);
    pen.fig2([ellipse2(fg[0], fg[1] - 9.4, 1.4, 1.6, 0, 10)], m, 'l2', true);
    pen.fig2([[[fg[0], fg[1] - 7.8], [fg[0], fg[1] - 3.4], [fg[0] - 1.4, fg[1]]], [[fg[0], fg[1] - 3.4], [fg[0] + 1.4, fg[1]]]], m, 'l2');
    live(pen.fig2([ellipse2(10, 9, 1.2, 1.2, 0, 8)], m, 'wf', true), { css: 'pf-blink', pad: 1 });
    pen.fig2([[[13.4, 9], [22, 9]]], m, 'l3');
    // prompt bar and the frame strip, newest frame still generating
    pen.fig2([rrect2(4, 57, W - 8, 11, 5, 3)], m, 'l3', true);
    pen.fig2([[[10, 62.5], [40, 62.5]], [[43, 62.5], [60, 62.5]]], m, 'l3 dsh');
    live(pen.fig2([[[63, 59.6], [63, 65.4]]], m, 'l1'), { css: 'pf-blink', pad: 1 });
    var strip = [];
    for (i = 0; i < 5; i++) strip.push(rrect2(4 + i * 24, H + 4, 20, 12, 1.2, 2));
    pen.fig2(strip, m, 'l3', true);
    var fr = [];
    for (i = 0; i < 4; i++) { var bx = 4 + i * 24; fr.push([[bx + 2, H + 14], [bx + 10, H + 7.6], [bx + 18, H + 14]], [[bx + 3, H + 7.6], [bx + 17, H + 7.6]]); }
    pen.fig2(fr, m, 'l4');
    var gen = pen.path('', 'l2');
    var mm = [m[0] * pen.s, m[1] * pen.s, m[2] * pen.s, m[3] * pen.s, pen.ox + m[4] * pen.s, pen.oy + m[5] * pen.s];
    function genAt(t) {
      var u = (t * 0.4) % 1, bx = 100, d = '';
      var segs = [[[bx + 2, H + 14], [bx + 10, H + 7.6]], [[bx + 10, H + 7.6], [bx + 18, H + 14]], [[bx + 3, H + 7.6], [bx + 17, H + 7.6]]];
      segs.forEach(function (sg, j) {
        var a = Math.max(0, Math.min(1, u * 3 - j));
        if (a <= 0) return;
        var p = tpts([sg[0], [lerp(sg[0][0], sg[1][0], a), lerp(sg[0][1], sg[1][1], a)]], mm);
        d += dPoly(p, false);
      });
      gen.setAttribute('d', d);
    }
    live(gen, { draw: genAt, pad: 2 });
    anims.push(genAt);
    pen.close();
  }

  // Ineffable Intelligence: a research lab with compute inside, and the agent-environment loop it studies.
  function drawIneffable(pen, anims) {
    pen.open({ 'class': 'ineffable' });
    var LX = 120, LY = 84, HZ = 66, i;
    pen.poly([[0, 0, 0], [LX, 0, 0], [LX, 0, HZ], [0, 0, HZ]], 'k2');
    pen.poly([[0, 0, 0], [LX, 0, 0], [LX, LY, 0], [0, LY, 0]], 'k2');
    for (i = 0; i < 8; i++) {
      var rx = 12 + i * 12.4;
      pen.box(rx, 24, 0, 10, 14, 44, 'k');
      var tr = [];
      for (var z = 5; z < 42; z += 2.6) tr.push([[rx + 1.4, 38, z], [rx + 8.6, 38, z]]);
      pen.lines(tr, 'l4');
      pen.lines([[[rx + 1.2, 38, 12], [rx + 8.8, 38, 12], [rx + 8.8, 38, 34], [rx + 1.2, 38, 34]]], 'l3', true);
      pen.lines([[[rx + 10, 25, 42], [rx + 10, 37, 42]]], 'l4');
    }
    pen.lines([[[10, 20, 46], [112, 20, 46]], [[10, 42, 46], [112, 42, 46]]], 'l3');
    var outer = [[0, LY, 0], [LX, LY, 0], [LX, LY, HZ], [0, LY, HZ]];
    var hole = [];
    for (i = 0; i <= 18; i++) hole.push([8 + i * 5.8, LY, 6 + 1.6 * Math.sin(i * 1.9)]);
    for (i = 18; i >= 0; i--) hole.push([8 + i * 5.8, LY, 54 + 1.8 * Math.sin(i * 2.3)]);
    pen.path(dPoly(pen.pts(outer), true) + dPoly(pen.pts(hole), true), 'k', { 'fill-rule': 'evenodd' });
    pen.poly([[LX, 0, 0], [LX, LY, 0], [LX, LY, HZ], [LX, 0, HZ]], 'k');
    var mul2 = [];
    for (i = 1; i < 10; i++) mul2.push([[LX, i * LY / 10, 2], [LX, i * LY / 10, HZ - 2]]);
    for (i = 1; i < 4; i++) mul2.push([[LX, 2, i * HZ / 4], [LX, LY - 2, i * HZ / 4]]);
    pen.lines(mul2, 'l3');
    pen.poly([[0, 0, HZ], [LX, 0, HZ], [LX, LY, HZ], [0, LY, HZ]], 'k');
    pen.box(14, 12, HZ, 22, 16, 8, 'k2');
    pen.box(44, 12, HZ, 22, 16, 8, 'k2');
    var fins = [];
    for (i = 1; i < 8; i++) fins.push([[14 + i * 2.75, 28, HZ + 1], [14 + i * 2.75, 28, HZ + 7]], [[44 + i * 2.75, 28, HZ + 1], [44 + i * 2.75, 28, HZ + 7]]);
    pen.lines(fins, 'l4');
    // rooftop optical terminal
    pen.box(92, 50, HZ, 12, 12, 5, 'k2');
    pen.revolve([98, 56, HZ + 5], Z, [[0, 5.2], [2.4, 5], [4.6, 3.4], [5.8, 0]], {});
    pen.close();
    return { terminal: pen.P([98, 56, HZ + 11]) };
  }

  function drawLoop(pen, c, R, anims) {
    pen.open({ 'class': 'rl-loop' });
    var ring = circle3(c, X, Y, R, 80);
    pen.lines([ring], 'l3 dsh');
    var arcA = circle3(c, X, Y, R, 30, Math.PI * 1.08, Math.PI * 1.92);
    var arcB = circle3(c, X, Y, R, 30, Math.PI * 0.08, Math.PI * 0.92);
    pen.lines([arcA, arcB], 'l2');
    function head(p, q) {
      var a = pen.P(p), b = pen.P(q), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return [[b[0] - Math.cos(ang - 0.45) * 5, b[1] - Math.sin(ang - 0.45) * 5], b, [b[0] - Math.cos(ang + 0.45) * 5, b[1] - Math.sin(ang + 0.45) * 5]];
    }
    pen.lines2([head(arcA[28], arcA[30]), head(arcB[28], arcB[30])], 'l1');
    var ag = pen.P(add(c, [-R, 0, 0])), en = pen.P(add(c, [R, 0, 0]));
    pen.path(dPoly(ellipse2(ag[0], ag[1], 7.6, 7.6, 0, 24), true), 'k');
    pen.path(dPoly(ellipse2(ag[0] - 2.4, ag[1] - 1.6, 1.1, 1.1, 0, 8), true) + dPoly(ellipse2(ag[0] + 1.6, ag[1] - 1.6, 1.1, 1.1, 0, 8), true), 'wf');
    pen.path(dPoly(ellipse2(en[0], en[1], 8.6, 8.6, 0, 28), true), 'k');
    pen.lines2([ellipse2(en[0], en[1], 8.6, 3.2, 0, 20), ellipse2(en[0], en[1], 3.4, 8.6, 0, 20)], 'l3', true);
    var tA = pen.P(circle3(c, X, Y, R + 10, 1, Math.PI * 1.5, Math.PI * 1.5)[0]);
    var tB = pen.P(circle3(c, X, Y, R + 12, 1, Math.PI * 0.5, Math.PI * 0.5)[0]);
    pen.text('action', [1, 0, 0, 1, (tA[0] - pen.ox) / pen.s, (tA[1] - 3 - pen.oy) / pen.s], 'tx', 6, 'middle');
    pen.text('observation, reward', [1, 0, 0, 1, (tB[0] - pen.ox) / pen.s, (tB[1] + 9 - pen.oy) / pen.s], 'tx', 6, 'middle');
    var PL = pen.snap(), host = dotHost(pen), dots = [];
    for (var i = 0; i < 6; i++) dots.push(new Dot(host, 1.3, false));
    anims.push(function (t) {
      for (var i = 0; i < 6; i++) {
        var a = Math.PI + ((t * 0.18 + i / 6) % 1) * TAU, p = PL(add(c, [Math.cos(a) * R, Math.sin(a) * R, 0]));
        dots[i].at(p[0], p[1], 1);
      }
    });
    pen.close();
  }

  function drawGroundStation(pen) {
    pen.open({ 'class': 'station' });
    pen.box(-14, -10, 0, 20, 16, 12, 'k2');
    pen.lines([[[-12, 6, 2], [-12, 6, 10], [-6, 6, 10], [-6, 6, 2]]], 'l3');
    pen.revolve([18, 10, 0], Z, [[0, 5.4], [3, 5.4], [3.2, 3.2], [20, 2.8]]);
    var ax = unit([-0.42, 0.18, 0.89]), f = 13, R = 22, prof = [];
    for (var i = 0; i <= 10; i++) { var r = R * i / 10; prof.push([r * r / (4 * f), Math.max(r, 0.01)]); }
    var base = add([18, 10, 24], mul(ax, -2));
    var S = pen.revolve(base, ax, prof);
    var inner = [];
    [0.45, 0.72].forEach(function (u) { inner.push(pen.pts(circle3(S.center(Math.pow(R * u, 2) / (4 * f)), S.e1, S.e2, R * u, 40))); });
    pen.lines2(inner, 'l3', true);
    var focus = S.center(f + 1), rim = prof[prof.length - 1][0], st = [];
    [0.4, 2.5, 4.6].forEach(function (a) { st.push([add(S.center(rim), add(mul(S.e1, Math.cos(a) * R), mul(S.e2, Math.sin(a) * R))), focus]); });
    pen.lines(st, 'l2');
    pen.sphere(focus, 1.6, 'k');
    pen.close();
    return { focus: pen.P(focus) };
  }

  /* ---------- scene ---------- */

  var CSS = [
    '.f{fill:#000;stroke:none}',
    '.k{fill:#000;stroke:#e8e8e8;stroke-width:1;stroke-linejoin:round;stroke-linecap:round}',
    '.k2{fill:#000;stroke:rgba(232,232,232,.7);stroke-width:.8;stroke-linejoin:round;stroke-linecap:round}',
    '.l1{fill:none;stroke:#e8e8e8;stroke-width:1;stroke-linejoin:round;stroke-linecap:round}',
    '.l2{fill:none;stroke:rgba(232,232,232,.62);stroke-width:.75;stroke-linejoin:round;stroke-linecap:round}',
    '.l3{fill:none;stroke:rgba(232,232,232,.36);stroke-width:.6;stroke-linejoin:round;stroke-linecap:round}',
    '.l4{fill:none;stroke:rgba(232,232,232,.14);stroke-width:.55}',
    '.dsh{stroke-dasharray:2.4 2.4}',
    '.wf{fill:#e8e8e8;stroke:none}',
    '.f-line{stroke:#000;stroke-width:1.6}',
    '.rivet{stroke-dasharray:.01 2.6;stroke-width:.9;stroke-linecap:round}',
    '.perf{stroke-dasharray:.01 2.2;stroke-width:.8;stroke-linecap:round}',
    '.led-off{stroke:rgba(232,232,232,.2);stroke-width:.5;stroke-linecap:round;fill:none}',
    '.led-on{stroke:#fff;stroke-width:.62;stroke-linecap:round;fill:none;filter:drop-shadow(0 0 .8px rgba(255,255,255,.9))}',
    '.glow{filter:drop-shadow(0 0 1.6px rgba(255,255,255,.85))}',
    '.tx{fill:rgba(232,232,232,.62);font-family:"Berkeley Mono","SF Mono","Fira Code",monospace;letter-spacing:.02em}',
    '.tx-hi{fill:rgba(232,232,232,.9)}',
    '.flow{fill:none;stroke:rgba(232,232,232,.4);stroke-width:.75;stroke-dasharray:1.4 3.2;stroke-linecap:round}',
    '.leader{fill:none;stroke:rgba(232,232,232,.45);stroke-width:.7}',
    '.anchor{fill:#e8e8e8}',
    '.tube-o{fill:none;stroke:#e8e8e8;stroke-width:2.6;stroke-linecap:round}',
    '.tube-i{fill:none;stroke:#000;stroke-width:1.1;stroke-linecap:round}',
    '.callout{fill:none;stroke:rgba(232,232,232,.5);stroke-width:.75;stroke-dasharray:3 2.4}',
    '.pf-item{opacity:0;transform:translateY(5px);transition:opacity 1s ease,transform 1.2s cubic-bezier(.16,1,.3,1)}',
    '.is-built .pf-item{opacity:1;transform:none;transition-delay:var(--d,0s)}',
    '.pf-dim .pf-item:not(.is-on){opacity:.28;transition-delay:0s}',
    '.pf-dim .pf-flows,.pf-dim .pf-flowdots{opacity:.3}',
    '.pf-flows,.pf-flowdots{transition:opacity .4s ease}',
    '.pf-scene{will-change:transform}',
    '.pf-live,.pf-flowdots,.pf-dotbox{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}',
    '.pf-sprite{position:absolute;overflow:visible;will-change:transform}',
    '.pf-dot{position:absolute;left:0;top:0;overflow:visible;will-change:transform}',
    '.flow-dot{fill:#fff;filter:drop-shadow(0 0 1.4px rgba(255,255,255,.9))}',
    '.pf-spin{animation:pf-spin 80s linear infinite}',
    '.pf-blink{animation:pf-blink 1.1s steps(1) infinite}',
    '.pf-steam{animation:pf-steam 3s ease-in-out infinite}',
    '.pf-pulse{animation:pf-pulse 3.2s ease-in-out infinite}',
    '.is-paused *{animation-play-state:paused!important}',
    '@keyframes pf-spin{to{transform:rotate(360deg)}}',
    '@keyframes pf-blink{0%,55%{opacity:1}56%,100%{opacity:0}}',
    '@keyframes pf-steam{0%,100%{opacity:.15}50%{opacity:.8}}',
    '@keyframes pf-pulse{0%,100%{opacity:1}50%{opacity:.55}}',
    '@media (prefers-reduced-motion:reduce){.pf-item{transition:none}.pf-spin,.pf-blink,.pf-steam,.pf-pulse{animation:none}}'
  ].join('');

  function curve(pts, n) {
    // Catmull-Rom through screen points
    if (pts.length < 3) return pts;
    var out = [], i, t;
    n = n || 12;
    for (i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var k = 0; k < n; k++) {
        t = k / n;
        var t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ---------- live layers ---------- */

  // Parts that change after the scene is built are lifted out of the main drawing into small layers
  // of their own, so an animation frame never repaints the static line work underneath.
  var LIVE = { list: [], dots: null, L: null, k: 1 };

  // opt.draw(t) redraws the part for time t, and is sampled to find how far the part reaches.
  // opt.css names a compositor animation for the lifted layer. opt.pad grows it for strokes and glows.
  function live(node, opt) {
    var h = { node: node, opt: opt || {}, sprite: null, box: null };
    LIVE.list.push(h);
    return h;
  }

  // Moves a group, in steps of 0.05 units so a slow drift repaints only when it visibly could.
  function nudge(g, dx, dy) {
    var v = 'translate(' + (Math.round(dx * 20) / 20) + ' ' + (Math.round(dy * 20) / 20) + ')';
    if (g._pfT !== v) { g._pfT = v; g.setAttribute('transform', v); }
  }

  // Dots placed in scene units and moved by the compositor. Dots that belong to a product share its
  // fade-in and hover highlight; flow dots share the flows' dimming.
  function dotHost(pen) {
    for (var g = pen && pen.g; g && g.getAttribute; g = g.parentNode) {
      if (/\bpf-item\b/.test(g.getAttribute('class') || '')) {
        if (!g._pfDots) {
          var d = document.createElement('div');
          d.className = 'pf-dotbox ' + g.getAttribute('class');
          if (g.getAttribute('data-id')) d.setAttribute('data-id', g.getAttribute('data-id'));
          d.style.cssText = g.style.cssText;
          LIVE.dots.parentNode.insertBefore(d, LIVE.dots);
          g._pfDots = d;
        }
        return g._pfDots;
      }
    }
    return LIVE.dots;
  }
  // Each dot is its own tiny SVG in scene units, drawn exactly as before, so only its own few pixels
  // repaint when it changes size. Offsets are in pixels from the stage's measured scale: a percentage
  // of the dot's own width would multiply the browser's rounding of that width into visible drift.
  function Dot(host, r, glow) {
    var L = LIVE.L, S = glow ? 7 : r + 1;
    var s = el('svg', { viewBox: [-S, -S, 2 * S, 2 * S].join(' '), 'class': 'pf-dot', 'aria-hidden': 'true', focusable: 'false' });
    s.style.width = (2 * S / L.w * 100).toFixed(4) + '%';
    s.style.height = (2 * S / L.h * 100).toFixed(4) + '%';
    this.p = el('path', { 'class': glow ? 'flow-dot' : 'wf' });
    s.appendChild(this.p);
    host.appendChild(s);
    this.e = s;
    this.S = S;
    this.r = r;
    this.q = -1;
  }
  // Size moves in steps of 0.05 units, far below what shows, so a dot repaints a few times a second.
  Dot.prototype.at = function (x, y, s) {
    var k = LIVE.k, S = this.S, q = Math.round(this.r * s * 20);
    this.e.style.transform = 'translate(' + ((x - S) * k).toFixed(2) + 'px,' + ((y - S) * k).toFixed(2) + 'px)';
    if (q !== this.q) { this.q = q; this.p.setAttribute('d', dPoly(ellipse2(0, 0, q / 20, q / 20, 0, 8), true)); }
  };

  // Everything drawn after a lifted part was painted over it. Those shapes, drawn in black with the
  // same strokes, become a mask on the part's layer, so it never paints over them.
  function occluders(h, svg, box) {
    var out = [], all = svg.querySelectorAll('path');
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (!(h.node.compareDocumentPosition(c) & 4)) continue;
      if (LIVE.list.some(function (o) { return o.node.contains(c); })) continue;
      var r = c.getBBox();
      if (r.x > box[0] + box[2] || r.y > box[1] + box[3] || r.x + r.width < box[0] || r.y + r.height < box[1]) continue;
      var cs = getComputedStyle(c), fill = cs.fill !== 'none', stroke = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
      if (!fill && !stroke) continue;
      var st = 'fill:' + (fill ? '#000' : 'none') + ';stroke:' + (stroke ? '#000' : 'none');
      if (stroke) {
        st += ';stroke-width:' + cs.strokeWidth + ';stroke-linecap:' + cs.strokeLinecap + ';stroke-linejoin:' + cs.strokeLinejoin;
        if (cs.strokeDasharray && cs.strokeDasharray !== 'none') st += ';stroke-dasharray:' + cs.strokeDasharray;
      }
      out.push(el('path', { d: c.getAttribute('d'), 'fill-rule': c.getAttribute('fill-rule'), style: st }));
    }
    return out;
  }

  function liftLive(layer, svg, L) {
    var mid = 0;
    LIVE.list.forEach(function (h) {
      var n = h.node, o = h.opt, b = null, i;
      function grow() {
        var r = n.getBBox();
        if (r.width <= 0 && r.height <= 0) return;
        b = b ? [Math.min(b[0], r.x), Math.min(b[1], r.y), Math.max(b[2], r.x + r.width), Math.max(b[3], r.y + r.height)] : [r.x, r.y, r.x + r.width, r.y + r.height];
      }
      n.removeAttribute('transform');
      if (o.draw) for (i = 0; i <= 40; i++) { o.draw(i * 0.37); grow(); }
      else grow();
      if (!b) return;
      var p = o.pad || 3;
      var box = h.box = [f1(b[0] - p), f1(b[1] - p), f1(b[2] - b[0] + 2 * p), f1(b[3] - b[1] + 2 * p)];
      var s = el('svg', { viewBox: box.join(' '), 'class': 'pf-sprite' + (o.css ? ' ' + o.css : ''), 'aria-hidden': 'true', focusable: 'false' });
      s.style.left = (box[0] / L.w * 100).toFixed(4) + '%';
      s.style.top = (box[1] / L.h * 100).toFixed(4) + '%';
      s.style.width = (box[2] / L.w * 100).toFixed(4) + '%';
      s.style.height = (box[3] / L.h * 100).toFixed(4) + '%';
      var host = s, chain = [];
      for (var g = n.parentNode; g && g !== svg; g = g.parentNode) chain.unshift(g);
      chain.forEach(function (a) { var c = a.cloneNode(false); c.removeAttribute('id'); host.appendChild(c); host = c; });
      var occ = o.css === 'pf-spin' ? [] : occluders(h, svg, box);
      if (occ.length) {
        var id = 'pf-occ-' + (++mid), mk = el('mask', { id: id, maskUnits: 'userSpaceOnUse', x: box[0], y: box[1], width: box[2], height: box[3] });
        mk.appendChild(el('rect', { x: box[0], y: box[1], width: box[2], height: box[3], fill: '#fff' }));
        occ.forEach(function (m) { mk.appendChild(m); });
        s.insertBefore(mk, s.firstChild);
        host = host.appendChild(el('g', { mask: 'url(#' + id + ')' }));
      }
      host.appendChild(n);
      layer.insertBefore(s, firstDotBox(layer));
      h.sprite = s;
    });
  }
  function firstDotBox(layer) {
    for (var c = layer.firstChild; c; c = c.nextSibling) if (c.nodeName === 'DIV') return c;
    return null;
  }

  function Flow(pen, pts, opt) {
    opt = opt || {};
    var path = opt.smooth === false ? pts : curve(pts, 14);
    var len = [0];
    for (var i = 1; i < path.length; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    this.path = path;
    this.len = len;
    this.total = len[len.length - 1];
    pen.path(dPoly(path, false), 'flow');
    this.n = opt.n || Math.max(2, Math.round(this.total / 90));
    this.speed = opt.speed || 38;
    this.dots = [];
    for (i = 0; i < this.n; i++) this.dots.push(new Dot(LIVE.dots, opt.r || 1.6, true));
  }
  Flow.prototype.at = function (d) {
    var len = this.len, i = 1;
    while (i < len.length - 1 && len[i] < d) i++;
    var a = this.path[i - 1], b = this.path[i], seg = len[i] - len[i - 1] || 1, t = (d - len[i - 1]) / seg;
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  };
  Flow.prototype.tick = function (t) {
    for (var i = 0; i < this.n; i++) {
      var u = ((t * this.speed / this.total) + i / this.n) % 1;
      var p = this.at(u * this.total);
      this.dots[i].at(p[0], p[1], 0.55 + 0.45 * Math.sin(u * Math.PI));
    }
  };

  function groundGrid(pen, ox, oy, size, step, cls) {
    pen.at(ox, oy, 1);
    var lines = [];
    for (var i = 0; i <= size; i += step) {
      lines.push([[i, 0, 0], [i, size, 0]], [[0, i, 0], [size, i, 0]]);
    }
    pen.lines(lines, cls || 'l4');
  }

  function item(pen, id, delay) {
    var g = pen.open({ 'class': 'pf-item', 'data-id': id || null });
    g.style.setProperty('--d', (delay || 0) + 's');
    return g;
  }

  var LAYOUTS = {};

  LAYOUTS.wide = {
    w: 1600,
    h: 1000,
    build: function (pen, anims, flows) {
      var A = {};
      // ground
      var gg = item(pen, null, 0);
      gg.setAttribute('mask', 'url(#pf-fade)');
      groundGrid(pen, 800, -330, 2400, 40, 'l4');
      pen.close();

      // sky
      item(pen, null, 0.1);
      drawStars(pen, [20, 10, 1600, 330], 46, 3);
      drawSun(pen, 112, 104, 22, anims);
      A.sun = [112, 104];
      pen.close();

      item(pen, 'starcloud', 0.2);
      pen.at(1066, 300, 0.74);
      drawStarcloud(pen, anims);
      A.starcloud = pen.P([1, -13, 80]);
      A.spine = pen.P([0, 0, -64]);
      A.plane = pen.P([-14, -420, 250]);
      A.dock = pen.P([0, -30, 120]);
      pen.close();

      item(pen, 'exploration', 0.3);
      var nyxW = pen.open(), nyxG = pen.open({ 'class': 'nyx-drift' });
      pen.at(600, 150, 1);
      drawNyx(pen, [0, 0, 0], unit([1, -0.28, 0.1]), 0.86);
      A.nyx = pen.P([46, -13, 34]);
      A.nyxNose = pen.P([98, -28, 10]);
      A.nyxTail = pen.P([0, 0, 0]);
      pen.close();
      pen.close();
      var nyxAt = function (t) { var u = Math.sin(t * 0.6) * 2.2; nudge(nyxG, u * 0.97, u * 0.23); };
      live(nyxW, { draw: nyxAt, pad: 3 });
      anims.push(nyxAt);
      drawParachutes(pen, 1512, 452, 1.05);
      A.chutes = [1512, 452];
      pen.close();

      // back row
      item(pen, 'cemvision', 0.4);
      pen.at(200, 404, 0.96);
      drawCemvision(pen, anims);
      A.cemvision = pen.P([70, 38, 70]);
      A.bags = pen.P([170, 60, 12]);
      A.kiln = pen.P([150, 40, 0]);
      pen.close();

      item(pen, null, 0.45);
      pen.at(470, 468, 0.74);
      drawTurbine(pen, anims);
      A.turbine = pen.P([0, 0, 0]);
      pen.close();

      item(pen, null, 0.5);
      pen.at(1290, 520, 1.05);
      var gs = drawGroundStation(pen);
      A.dish = gs.focus;
      pen.close();

      // middle row
      item(pen, 'ineffable', 0.6);
      pen.at(1010, 468, 1.02);
      var inf = drawIneffable(pen, anims);
      A.terminal = inf.terminal;
      A.labCorner = pen.P([120, 0, 0]);
      drawLoop(pen, [60, 42, 126], 48, anims);
      A.ineffable = pen.P([60, 42, 150]);
      pen.close();

      item(pen, 'camion', 0.55);
      pen.at(452, 726, 0.86);
      var cm = drawCamion(pen, anims);
      A.camion = pen.P([120, 96, 0]);
      A.slab = pen.P([0, 96, 0]);
      A.slabFront = pen.P([170, 96, 0]);
      pen.close();
      item(pen, 'camion', 0.8);
      drawPin(pen, cm.pins[0], 'sun', 34);
      drawPin(pen, cm.pins[1], 'battery', 28);
      drawPin(pen, cm.pins[2], 'plug', 28);
      pen.close();

      // front row
      item(pen, 'geneng', 0.7);
      pen.at(96, 690, 1.12);
      drawGenEng(pen);
      A.geneng = pen.P([153, 77, 0]);
      pen.close();

      var hx = 800, hy = 735, hs = 1.2;
      item(pen, '1x', 0.75);
      pen.at(hx, hy, hs);
      drawHome(pen, anims);
      A.person = pen.P([30, 78, 18]);
      drawSeated(pen, A.person[0] + 1, A.person[1] + 30, 1.0);
      var neoAt = pen.P([104, 36, 0]);
      drawNeo(pen, neoAt[0], neoAt[1], 1.1, false);
      A.neo = [neoAt[0] - 2, neoAt[1] - 110];
      A.phone = [A.person[0] + 15, A.person[1] - 22];
      A.homeSlab = pen.P([0, 150, -4]);
      pen.close();

      item(pen, 'hume', 0.85);
      pen.at(0, 0, 1);
      drawHumeCard(pen, 744, 621, anims);
      A.hume = [792, 621];
      pen.close();

      item(pen, 'nothing', 0.9);
      A.nothing = drawPhoneCallout(pen, [600, 570], 62, 1.4, A.phone, anims);
      pen.close();

      item(pen, 'odyssey', 0.95);
      pen.at(1170, 700, 1.02);
      drawOdyssey(pen, anims);
      A.screen = pen.P([90, 0, 70]);
      A.odyssey = pen.P([176, 0, 18]);
      var wk = pen.P([168, 168, 0]);
      pen.lines([[[40, 160, 0], [158, 160, 0]], [[40, 176, 0], [158, 176, 0]]], 'l3');
      pen.lines([[[178, 160, 0], [300, 160, 0]], [[178, 176, 0], [300, 176, 0]]], 'l3 dsh');
      drawWalker(pen, wk[0], wk[1], 0.98);
      A.rig = [wk[0] + 14.2 * 0.98, wk[1] - 113 * 0.98];
      pen.close();

      item(pen, null, 0.8);
      pen.at(1060, 800, 1);
      drawTree(pen, [0, 0, 0], 46, 15, 2);
      pen.at(1100, 840, 1);
      drawTree(pen, [0, 0, 0], 36, 12, 5);
      pen.at(724, 978, 1);
      drawTree(pen, [0, 0, 0], 40, 13, 9);
      pen.close();

      // flows: sunlight into orbit, compute down to Earth, capture into models, cement into foundations
      pen.open({ 'class': 'pf-flows' });
      flows.push(new Flow(pen, [[A.sun[0] + 28, A.sun[1] - 6], [560, 24], A.plane], { n: 5, speed: 44 }));
      flows.push(new Flow(pen, [[-20, 250], [280, 180], [A.nyxTail[0] - 6, A.nyxTail[1] + 4]], { n: 2, speed: 40 }));
      flows.push(new Flow(pen, [A.nyxNose, A.dock], { n: 2, speed: 22, smooth: false }));
      flows.push(new Flow(pen, [A.dock, [1300, 230], [1470, 330], [A.chutes[0], A.chutes[1] - 12]], { n: 2, speed: 34 }));
      flows.push(new Flow(pen, [[A.chutes[0], A.chutes[1] + 50], [1530, 560], [1560, 660]], { n: 1, speed: 24 }));
      flows.push(new Flow(pen, [A.spine, [1220, 410], A.dish], { n: 3, speed: 46 }));
      flows.push(new Flow(pen, [A.dish, [1190, 470], A.terminal], { n: 2, speed: 36 }));
      flows.push(new Flow(pen, [A.dish, [1320, 600], A.screen], { n: 2, speed: 36 }));
      flows.push(new Flow(pen, [A.rig, [1330, 740], A.screen], { n: 2, speed: 30 }));
      flows.push(new Flow(pen, [A.labCorner, [1150, 650], [1060, 705], A.neo], { n: 3, speed: 32 }));
      flows.push(new Flow(pen, [A.turbine, [380, 500], A.kiln], { n: 2, speed: 30 }));
      flows.push(new Flow(pen, [A.bags, [410, 620], A.slab], { n: 2, speed: 26 }));
      flows.push(new Flow(pen, [A.slabFront, [580, 850], A.homeSlab], { n: 2, speed: 26 }));
      pen.close();
      return A;
    },
    // Each pill attaches at `to` (bottom centre by default; `pos` picks another edge).
    pills: {
      starcloud: { at: 'starcloud', to: [1040, 262], pos: 'left' },
      exploration: { at: 'nyx', to: [620, 102] },
      cemvision: { at: 'cemvision', to: [217, 335] },
      camion: { at: 'camion', to: [520, 878], pos: 'below' },
      ineffable: { at: 'ineffable', to: [948, 372], pos: 'left' },
      geneng: { at: 'geneng', to: [200, 846], pos: 'below' },
      '1x': { at: 'neo', to: [902, 624], pos: 'right' },
      hume: { at: 'hume', to: [806, 584], wrap: true },
      nothing: { at: 'nothing', to: [625, 494] },
      odyssey: { at: 'odyssey', to: [1450, 800], pos: 'below' }
    }
  };

  // Portrait composition for phones: orbit at the top, then the labs, the home, and the industrial base.
  LAYOUTS.tall = {
    w: 720,
    h: 2860,
    fade: [360, 1480, 820, 2.3],
    build: function (pen, anims, flows) {
      var A = {};
      var gg = item(pen, null, 0);
      gg.setAttribute('mask', 'url(#pf-fade)');
      groundGrid(pen, 360, -700, 3800, 40, 'l4');
      pen.close();

      item(pen, null, 0.1);
      drawStars(pen, [10, 20, 720, 600], 34, 11);
      drawSun(pen, 70, 96, 20, anims);
      A.sun = [70, 96];
      pen.close();

      item(pen, 'starcloud', 0.2);
      pen.at(470, 520, 0.66);
      drawStarcloud(pen, anims);
      A.starcloud = pen.P([61, 0, 20]);
      A.spine = pen.P([0, 0, -64]);
      A.plane = pen.P([-14, -260, 250]);
      A.dock = pen.P([0, -30, 120]);
      pen.close();

      item(pen, 'exploration', 0.3);
      var nyxW = pen.open(), nyxG = pen.open({ 'class': 'nyx-drift' });
      pen.at(80, 420, 0.9);
      drawNyx(pen, [0, 0, 0], unit([1, -0.28, 0.1]), 0.8);
      A.nyx = pen.P([42, -12, 32]);
      A.nyxNose = pen.P([92, -26, 10]);
      A.nyxTail = pen.P([0, 0, 0]);
      pen.close();
      pen.close();
      var nyxAt = function (t) { var u = Math.sin(t * 0.6) * 2; nudge(nyxG, u * 0.97, u * 0.23); };
      live(nyxW, { draw: nyxAt, pad: 3 });
      anims.push(nyxAt);
      pen.close();

      // the labs
      item(pen, null, 0.5);
      pen.at(640, 900, 1.05);
      var gs = drawGroundStation(pen);
      A.dish = gs.focus;
      pen.close();

      item(pen, 'ineffable', 0.6);
      pen.at(372, 880, 1.06);
      var inf = drawIneffable(pen, anims);
      A.terminal = inf.terminal;
      drawLoop(pen, [60, 42, 126], 48, anims);
      A.ineffable = pen.P([12, 42, 126]);
      pen.close();

      item(pen, 'odyssey', 0.65);
      pen.at(36, 1180, 0.96);
      drawOdyssey(pen, anims);
      A.screen = pen.P([90, 0, 70]);
      A.odyssey = pen.P([40, 0, 120]);
      var wk = pen.P([200, 40, 0]);
      pen.lines([[[90, 32, 0], [190, 32, 0]], [[90, 48, 0], [190, 48, 0]]], 'l3');
      pen.lines([[[210, 32, 0], [300, 32, 0]], [[210, 48, 0], [300, 48, 0]]], 'l3 dsh');
      drawWalker(pen, wk[0], wk[1], 0.94);
      A.rig = [wk[0] + 14.2 * 0.94, wk[1] - 113 * 0.94];
      pen.close();

      item(pen, null, 0.8);
      pen.at(672, 1900, 1.1);
      drawTree(pen, [0, 0, 0], 44, 14, 2);
      pen.at(620, 1080, 0.9);
      drawTree(pen, [0, 0, 0], 40, 13, 6);
      pen.at(84, 1950, 1.0);
      drawTree(pen, [0, 0, 0], 40, 13, 9);
      pen.close();

      // the home
      item(pen, '1x', 0.75);
      pen.at(400, 1692, 1.36);
      drawHome(pen, anims);
      A.person = pen.P([30, 78, 18]);
      drawSeated(pen, A.person[0] + 1, A.person[1] + 34, 1.13);
      var neoAt = pen.P([104, 36, 0]);
      drawNeo(pen, neoAt[0], neoAt[1], 1.24, false);
      A.neo = [neoAt[0] + 6, neoAt[1] - 118];
      A.phone = [A.person[0] + 17, A.person[1] - 25];
      A.homeSlab = pen.P([0, 150, -4]);
      pen.close();

      item(pen, 'hume', 0.85);
      pen.at(0, 0, 1);
      drawHumeCard(pen, 318, 1602, anims);
      A.hume = [366, 1602];
      pen.close();

      item(pen, 'nothing', 0.9);
      A.nothing = drawPhoneCallout(pen, [98, 1522], 60, 1.36, A.phone, anims);
      pen.close();

      // the base: materials, energy, engineering
      item(pen, null, 0.45);
      pen.at(612, 2300, 0.7);
      drawTurbine(pen, anims);
      A.turbine = pen.P([0, 0, 0]);
      pen.close();

      item(pen, 'cemvision', 0.4);
      pen.at(200, 2210, 0.9);
      drawCemvision(pen, anims);
      A.cemvision = pen.P([30, 38, 60]);
      A.bags = pen.P([170, 60, 12]);
      A.kiln = pen.P([150, 40, 0]);
      pen.close();

      item(pen, 'camion', 0.55);
      pen.at(430, 2630, 0.8);
      var cm = drawCamion(pen, anims);
      A.camion = pen.P([120, 96, 0]);
      A.slab = pen.P([0, 96, 0]);
      pen.close();
      item(pen, 'camion', 0.8);
      drawPin(pen, cm.pins[0], 'sun', 34);
      drawPin(pen, cm.pins[1], 'battery', 28);
      drawPin(pen, cm.pins[2], 'plug', 28);
      pen.close();

      item(pen, 'geneng', 0.7);
      pen.at(22, 2610, 0.96);
      drawGenEng(pen);
      A.geneng = pen.P([100, -20, 164]);
      pen.close();

      pen.open({ 'class': 'pf-flows' });
      flows.push(new Flow(pen, [[A.sun[0] + 26, A.sun[1] - 4], [300, 70], A.plane], { n: 4, speed: 40 }));
      flows.push(new Flow(pen, [[-20, 560], [30, 470], [A.nyxTail[0] - 5, A.nyxTail[1] + 4]], { n: 1, speed: 30 }));
      flows.push(new Flow(pen, [A.nyxNose, A.dock], { n: 2, speed: 22, smooth: false }));
      flows.push(new Flow(pen, [A.spine, [580, 700], A.dish], { n: 3, speed: 44 }));
      flows.push(new Flow(pen, [A.dish, [560, 850], A.terminal], { n: 2, speed: 34 }));
      flows.push(new Flow(pen, [A.dish, [520, 1140], A.screen], { n: 2, speed: 34 }));
      flows.push(new Flow(pen, [A.rig, [260, 1150], A.screen], { n: 2, speed: 30 }));
      flows.push(new Flow(pen, [A.terminal, [704, 1290], [700, 1480], A.neo], { n: 3, speed: 34 }));
      flows.push(new Flow(pen, [A.turbine, [430, 2230], A.kiln], { n: 2, speed: 30 }));
      flows.push(new Flow(pen, [A.bags, [404, 2460], A.slab], { n: 2, speed: 26 }));
      flows.push(new Flow(pen, [A.bags, [360, 2050], A.homeSlab], { n: 2, speed: 26 }));
      pen.close();
      return A;
    },
    pills: {
      exploration: { at: 'nyx', dx: 60, dy: -84 },
      starcloud: { at: 'starcloud', to: [440, 520], pos: 'left' },
      ineffable: { at: 'ineffable', dx: -144, dy: -78 },
      odyssey: { at: 'odyssey', dx: 101, dy: -44 },
      nothing: { at: 'nothing', to: [160, 1428] },
      '1x': { at: 'neo', to: [530, 1428] },
      hume: { at: 'hume', to: [330, 1524], wrap: true },
      cemvision: { at: 'cemvision', dx: -14, dy: -80 },
      camion: { at: 'camion', to: [470, 2778], pos: 'below' },
      geneng: { at: 'geneng', dx: 60, dy: -36 }
    }
  };

  var state = { stage: null, svg: null, layout: null, anims: [], flows: [], raf: 0, t0: 0, playing: false, anchors: null };

  function pickLayout() {
    var w = window.innerWidth, h = window.innerHeight;
    return (w <= 600 || w / h < 0.9) ? 'tall' : 'wide';
  }

  function build(stage, name) {
    var L = LAYOUTS[name];
    if (state.svg) state.svg.remove();
    if (state.layer) state.layer.remove();
    state.anims = [];
    state.flows = [];
    var svg = el('svg', { viewBox: '0 0 ' + L.w + ' ' + L.h, 'class': 'pf-scene', 'aria-hidden': 'true', focusable: 'false' });
    var style = el('style');
    style.textContent = CSS;
    svg.appendChild(style);
    var defs = el('defs');
    var fc = L.fade || [L.w / 2, L.h * 0.74, L.w * 0.56, 0.6];
    var grad = el('radialGradient', {
      id: 'pf-grad', gradientUnits: 'userSpaceOnUse', cx: fc[0], cy: fc[1], r: fc[2],
      gradientTransform: 'translate(' + fc[0] + ' ' + fc[1] + ') scale(1 ' + fc[3] + ') translate(' + (-fc[0]) + ' ' + (-fc[1]) + ')'
    });
    grad.appendChild(el('stop', { offset: 0.3, 'stop-color': '#fff' }));
    grad.appendChild(el('stop', { offset: 1, 'stop-color': '#000' }));
    defs.appendChild(grad);
    var mask = el('mask', { id: 'pf-fade', maskUnits: 'userSpaceOnUse', x: -L.w, y: -L.h, width: L.w * 3, height: L.h * 3 });
    mask.appendChild(el('rect', { x: -L.w, y: -L.h, width: L.w * 3, height: L.h * 3, fill: 'url(#pf-grad)' }));
    defs.appendChild(mask);
    svg.appendChild(defs);
    stage.insertBefore(svg, stage.firstChild);
    var layer = document.createElement('div');
    layer.className = 'pf-live';
    LIVE.list = [];
    LIVE.L = L;
    LIVE.dots = document.createElement('div');
    LIVE.dots.className = 'pf-flowdots';
    layer.appendChild(LIVE.dots);
    stage.insertBefore(layer, svg.nextSibling);
    var pen = new Pen(svg);
    state.anchors = L.build(pen, state.anims, state.flows);
    pen.at(0, 0, 1);
    var lg = pen.open({ 'class': 'pf-leaders pf-item' });
    lg.style.setProperty('--d', '0.9s');
    Object.keys(L.pills).forEach(function (id) {
      var cfg = L.pills[id], a = state.anchors[cfg.at];
      if (!a) return;
      var b = pillPoint(cfg, a);
      pen.path(dPoly([a, b], false), 'leader');
      pen.path(dPoly(ellipse2(a[0], a[1], 1.8, 1.8, 0, 10), true), 'anchor');
    });
    pen.close();
    liftLive(layer, svg, L);
    state.svg = svg;
    state.layer = layer;
    state.layout = name;
    stage.style.setProperty('--ar', (L.w / L.h).toFixed(4));
    stage.classList.toggle('is-tall', name === 'tall');
    if (stage.parentNode) stage.parentNode.classList.toggle('is-tall', name === 'tall');
    placePills(stage, L);
    measure();
  }

  function measure() {
    if (!state.stage || !LIVE.L) return;
    var w = state.stage.getBoundingClientRect().width;
    if (w > 0) LIVE.k = w / LIVE.L.w;
    tick(performance.now(), true);
  }

  function pillPoint(cfg, a) {
    return cfg.to || [a[0] + (cfg.dx || 0), a[1] + (cfg.dy || 0)];
  }

  function placePills(stage, L) {
    var pills = stage.querySelectorAll('.portfolio-pill');
    for (var i = 0; i < pills.length; i++) {
      var p = pills[i], cfg = L.pills[p.getAttribute('data-id')];
      p.style.display = cfg ? '' : 'none';
      if (!cfg) continue;
      var b = pillPoint(cfg, state.anchors[cfg.at] || [0, 0]);
      p.style.left = (b[0] / L.w * 100).toFixed(3) + '%';
      p.style.top = (b[1] / L.h * 100).toFixed(3) + '%';
      p.classList.remove('below', 'left', 'right', 'wrap');
      if (cfg.pos) p.classList.add(cfg.pos);
      if (cfg.wrap) p.classList.add('wrap');
      p.style.setProperty('--d', (0.9 + i * 0.06).toFixed(2) + 's');
    }
  }

  function tick(now, once) {
    var t = (now - state.t0) / 1000;
    for (var i = 0; i < state.anims.length; i++) state.anims[i](t);
    for (i = 0; i < state.flows.length; i++) state.flows[i].tick(t);
    if (!once && state.playing) state.raf = requestAnimationFrame(tick);
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var api = window.PortfolioScene = window.PortfolioScene || {};

  api.mount = function (stage) {
    state.stage = stage;
    var name = pickLayout();
    if (!state.svg || state.layout !== name) {
      if (!state.t0) state.t0 = performance.now();
      build(stage, name);
      bindHover(stage);
      if (window.ResizeObserver && !stage._pfSized) {
        stage._pfSized = true;
        new ResizeObserver(measure).observe(stage);
      }
    } else measure();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        stage.classList.add('is-built', 'is-ready');
      });
    });
  };

  api.play = function () {
    if (!state.svg) return;
    state.stage.classList.remove('is-paused');
    if (reduceMotion || state.playing) return;
    state.playing = true;
    state.raf = requestAnimationFrame(tick);
  };

  api.pause = function () {
    state.playing = false;
    cancelAnimationFrame(state.raf);
    if (state.stage) state.stage.classList.add('is-paused');
  };

  // Screen rectangles of a product's parts, so a preview can be kept off the one being highlighted.
  api.rects = function (id) {
    var out = [];
    if (!state.stage) return out;
    var items = state.stage.querySelectorAll('.pf-item[data-id="' + id + '"]');
    for (var i = 0; i < items.length; i++) {
      for (var c = items[i].firstElementChild; c; c = c.nextElementSibling) {
        var r = c.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push(r);
      }
    }
    return out;
  };

  api.relayout = function () {
    if (!state.stage || !state.svg) return;
    var name = pickLayout();
    if (name !== state.layout) build(state.stage, name);
  };

  function bindHover(stage) {
    if (stage._pfBound) return;
    stage._pfBound = true;
    var pills = stage.querySelectorAll('.portfolio-pill');
    for (var i = 0; i < pills.length; i++) {
      (function (p) {
        var id = p.getAttribute('data-id');
        function on() {
          if (!state.svg) return;
          stage.classList.add('pf-dim');
          var items = stage.querySelectorAll('.pf-item[data-id="' + id + '"]');
          for (var j = 0; j < items.length; j++) items[j].classList.add('is-on');
        }
        function off() {
          if (!state.svg) return;
          stage.classList.remove('pf-dim');
          var items = stage.querySelectorAll('.pf-item.is-on');
          for (var j = 0; j < items.length; j++) items[j].classList.remove('is-on');
        }
        p.addEventListener('mouseenter', on);
        p.addEventListener('mouseleave', off);
        p.addEventListener('focus', on);
        p.addEventListener('blur', off);
      })(pills[i]);
    }
  }

  if (document.body && document.body.classList.contains('portfolio-open')) {
    var st = document.getElementById('portfolio-stage');
    if (st) { api.mount(st); api.play(); }
  }

})();
