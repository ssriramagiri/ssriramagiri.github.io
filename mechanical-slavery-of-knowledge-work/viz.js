(function() {
  var N = 10, cx = 250, cy = 230, R = 155;
  var primNames = ['Content','Context','Participants','State','Routing',
                   'Time','Diff','Schema','Trigger','Provenance'];

  var data = {
    slack: {
      work: {
        v:[3,1,0,1,3],
        q:['everything arrives at equal volume \u2014 no triage, no priority','promises made in chat vanish in the scroll','\u2014','context is generated constantly, retained never','the default way teams talk \u2014 channels, threads, DMs']
      },
      tech: {
        v:[3,0,2,0,3,1,0,0,0,1],
        n:['rich freeform text, files, links \u2014 but nothing is structured or typed','no persistent memory \u2014 each conversation starts from zero','everyone in a channel sees the same thing, whether they need to act or not','messages have no lifecycle \u2014 nothing is resolved, pending, or closed','channels and @mentions route attention, but it\u2019s all-or-nothing','chronological only \u2014 no deadlines, no scheduling, no reactive mode','no change tracking \u2014 catching up means reading everything since you left','a decision, a question, and a joke are structurally identical','typing \u201capproved\u201d triggers nothing \u2014 every follow-up action is manual','messages have authors and timestamps, but forwarded context loses its source']
      },
      s: 'Real-time attention and coordination, but no memory. Decisions, promises, and context flow through and disappear. Nothing has state, nothing triggers downstream action.'
    },
    calendar: {
      work: {
        v:[1,3,0,0,3],
        q:['reminders before meetings, silence after','time blocks are the strongest promises in the stack','\u2014','\u2014','invites and RSVPs \u2014 the original coordination protocol']
      },
      tech: {
        v:[0,1,2,1,2,4,1,1,1,0],
        n:['a title and an optional description \u2014 rarely more','the third meeting about Q3 doesn\u2019t know the first two happened','accepted, declined, tentative \u2014 then participation tracking stops','upcoming or past \u2014 the entire lifecycle is two states','invited or not \u2014 no partial visibility, no role distinction','the only tool that models time as a finite resource','room changed: tracked. agenda rewritten: invisible','a standup and a board review are structurally identical events','meeting ends and nothing fires \u2014 no action items, no follow-ups created','meetings cause downstream work but connect to none of it']
      },
      s: 'The only tool built around a scarce resource \u2014 time. Strong on scheduling and commitments, but captures nothing that happens inside or after meetings.'
    },
    email: {
      work: {
        v:[0,2,0,1,3],
        q:['\u2014','the accidental task queue nobody designed','\u2014','built up through reply chains, lost through forwarding','federated and universal \u2014 the reason it survives everything']
      },
      tech: {
        v:[2,2,2,1,3,1,0,0,0,2],
        n:['async format encourages longer, more substantive writing','reply chains accumulate context, but forwarding shatters the thread','to/cc/bcc \u2014 who acts, who\u2019s informed, who\u2019s hidden','read, unread, archived, starred \u2014 personal states, not shared workflow','\u201cplease reply by Friday\u201d is text, not a system-level deadline','the most universal routing system in knowledge work \u2014 works across every org','no way to see what changed between the first draft and this revision','a legal contract and a lunch invite are structurally identical messages','\u201cemail from legal\u201d doesn\u2019t auto-flag, auto-assign, or auto-escalate','forwarding chains are messy but at least partially traceable']
      },
      s: 'The universal coordination layer. Accidentally became a task queue because obligations arrive here with no system to track them. Works across every organization, which is why nothing replaces it.'
    },
    docs: {
      work: {
        v:[0,0,4,2,1],
        q:['\u2014','\u2014','where the actual thinking becomes tangible','captures context, but sealed off from what generated it','share a link and hope someone opens it']
      },
      tech: {
        v:[4,0,1,0,0,0,2,1,0,0],
        n:['the richest content primitive in the stack \u2014 long-form text, tables, embeds','no awareness of the Slack thread or email that spawned it','editors and viewers \u2014 but everyone with access looks identical to the system','\u201cDRAFT\u201d in the title is a naming convention, not a system state','to get someone to read a doc, you leave the doc and paste a link elsewhere','\u201clast edited 3 days ago\u201d \u2014 the entire temporal model','a typo fix and a strategic rewrite show up identically in version history','a heading called \u201cDecision\u201d is just text \u2014 the system sees no structure in it','the budget doc changed and the finance lead has no idea','copy-paste a paragraph and its origin disappears completely']
      },
      s: 'Where the highest-value thinking happens \u2014 and the most isolated object in the stack. Rich content, zero connection to the conversations, decisions, or tasks around it.'
    },
    slides: {
      work: {
        v:[0,0,3,0,2],
        q:['\u2014','\u2014','a lossy compression of the real analysis','\u2014','presenting forces synchronous attention \u2014 the point of the format']
      },
      tech: {
        v:[2,0,1,0,0,0,0,1,0,0],
        n:['visual layouts \u2014 a rendering of thought, rarely editable as source of truth','the analysis, the alternatives, the data sources \u2014 all stripped away','the CEO and the intern see the same static object','no concept of draft vs. approved vs. presented \u2014 filenames do the work','emailed as attachment, pasted in Slack, projected in a room \u2014 three tools','every deck is built for a specific moment the file itself doesn\u2019t record','\u201cwhat changed between v3 and v4?\u201d \u2014 asked constantly, answered never','a framework slide and a data slide are structurally identical objects','a chart goes stale and nothing in the system notices','a copied chart becomes a dead image \u2014 zero lineage to its source data']
      },
      s: 'Built for a single moment of high-stakes communication. Every deck is a snapshot that immediately starts decaying. No versioning, no data lineage, no lifecycle.'
    },
    sheets: {
      work: {
        v:[0,0,3,2,0],
        q:['\u2014','\u2014','the only content type that computes','data as context, sealed inside the grid','\u2014']
      },
      tech: {
        v:[3,0,1,2,0,1,1,3,2,2],
        n:['cells compute \u2014 the only content in the stack that\u2019s alive and reactive','a model driving a $10M decision has no link to the decision itself','everyone sees the same grid \u2014 most can\u2019t find the cell that matters','change an input and outputs recompute, but \u201cis this approved?\u201d lives elsewhere','a cell turns red and nobody outside the file knows','time series live in cells, but \u201crefresh this monthly\u201d isn\u2019t a system concept','\u201cA3 changed from 47 to 52\u201d \u2014 was that a rounding fix or a strategic shift?','columns, formulas, validation rules \u2014 the strongest implicit schema in the stack','reactivity is powerful inside the file, stops completely at the boundary','trace a formula chain inside the sheet \u2014 but where did the input data come from?']
      },
      s: 'The most powerful analytical tool and the most sealed off. Computes beautifully inside the grid, communicates nothing outside it. Reactivity stops at the file boundary.'
    },
    linear: {
      work: {
        v:[3,4,0,2,3],
        q:['triage and priority \u2014 the attention machine','the best state machine for tracking promises','\u2014','tracks how issues relate to each other, not to the work itself','assignment and notification route work automatically']
      },
      tech: {
        v:[1,2,4,4,3,3,1,3,2,2],
        n:['issue titles and descriptions \u2014 metadata about work, not the work itself','issues link to each other, but not to the doc or sheet that specs them','assignee acts, creator cares, subscriber is informed \u2014 cleanest role model','backlog \u2192 todo \u2192 in progress \u2192 done \u2014 the strongest state machine in the stack','assignment is routing, priority affects ordering \u2014 well-modeled','due dates, cycles, sprints \u2014 time as cadence, not just clock','state transitions are tracked, but what changed in the implementation isn\u2019t','typed fields, filters, views \u2014 \u201cshow me blocked P0s due this week\u201d just works','automations work inside Linear but stop at the tool boundary','clean internal history \u2014 but links out to docs and repos are just URLs']
      },
      s: 'The most architecturally sound tool in the stack. Best state machine, best schema, cleanest roles. Its limit is scope \u2014 it tracks metadata about work, not the work itself.'
    },
    unified: {
      work: {
        v:[4,4,4,4,4],
        q:['triage and priority computed from the full graph \u2014 not humans scanning five inboxes','promises are structured objects with owners, deadlines, and state \u2014 not text vanishing in a scroll','all content shares one substrate \u2014 outline to table to board without changing tools','the context graph is the system itself \u2014 every object knows what spawned it and what depends on it','messaging, scheduling, and routing are native \u2014 not integrations layered on top']
      },
      tech: {
        v:[4,4,4,4,4,4,4,4,4,4],
        n:['text, tables, spatial layouts, media \u2014 native structures in one model, not six apps pretending to be different products','every object carries its derivation chain \u2014 the thread, the email, the meeting that spawned it are all linked','humans and AI agents share a unified role model \u2014 creator, assignee, reviewer, subscriber \u2014 across everything','system-managed lifecycles \u2014 draft, active, decided, archived \u2014 not filenames or manual conventions','attention routes by role, relevance, and semantic state change \u2014 not channel blast or @-mention lottery','deadlines, cadences, scheduling, and reactive triggers in one temporal model \u2014 time as a first-class dimension','semantic change detection \u2014 the system knows a typo fix from a strategic rewrite across all content','typed fields and structured metadata everywhere \u2014 \u201cshow me all blocked P0 decisions this quarter\u201d just works','state changes fire downstream actions \u2014 a decision closes, tasks update, stakeholders are notified, docs revise','full lineage \u2014 every object traces to its source conversation, data, or decision. Nothing loses its origin']
      },
      s: 'One system where AI operates across attention, commitments, artifacts, context, and coordination \u2014 because they\u2019re all structured data in the same graph. The context layer stops living in your head and starts living in the software.'
    }
  };

  /* ── SVG spider chart ── */
  function pos(i, val) {
    var a = 2 * Math.PI * i / N - Math.PI / 2;
    var r = R * val / 4;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 500 470');
  svg.setAttribute('fill', 'none');
  document.getElementById('vizChartWrap').appendChild(svg);

  [1,2,3,4].forEach(function(lv) {
    var pts = [];
    for (var i = 0; i < N; i++) { var p = pos(i, lv); pts.push(p[0].toFixed(1)+','+p[1].toFixed(1)); }
    var el = document.createElementNS(ns, 'polygon');
    el.setAttribute('points', pts.join(' '));
    el.setAttribute('stroke', lv === 4 ? '#d0cec8' : '#e2e0db');
    el.setAttribute('stroke-width', lv === 4 ? '0.8' : '0.5');
    el.setAttribute('fill', 'none');
    svg.appendChild(el);
  });

  for (var i = 0; i < N; i++) {
    var p = pos(i, 4);
    var ln = document.createElementNS(ns, 'line');
    ln.setAttribute('x1', cx); ln.setAttribute('y1', cy);
    ln.setAttribute('x2', p[0].toFixed(1)); ln.setAttribute('y2', p[1].toFixed(1));
    ln.setAttribute('stroke', '#e2e0db'); ln.setAttribute('stroke-width', '0.5');
    svg.appendChild(ln);
  }

  var poly = document.createElementNS(ns, 'polygon');
  poly.setAttribute('fill', 'rgba(26,26,26,0.1)');
  poly.setAttribute('stroke', '#1a1a1a');
  poly.setAttribute('stroke-width', '1.5');
  poly.setAttribute('stroke-linejoin', 'round');
  var ip = []; for (var i = 0; i < N; i++) ip.push(cx+','+cy);
  poly.setAttribute('points', ip.join(' '));
  svg.appendChild(poly);

  var cdot = document.createElementNS(ns, 'circle');
  cdot.setAttribute('cx', cx); cdot.setAttribute('cy', cy);
  cdot.setAttribute('r', '2'); cdot.setAttribute('fill', '#ccc');
  svg.appendChild(cdot);

  var dots = [];
  for (var i = 0; i < N; i++) {
    var d = document.createElementNS(ns, 'circle');
    d.setAttribute('cx', cx); d.setAttribute('cy', cy);
    d.setAttribute('r', '3'); d.setAttribute('fill', '#1a1a1a');
    d.setAttribute('opacity', '0');
    svg.appendChild(d); dots.push(d);
  }

  var labelEls = [];
  var labelR = R + 22;
  for (var i = 0; i < N; i++) {
    var a = 2 * Math.PI * i / N - Math.PI / 2;
    var lx = cx + labelR * Math.cos(a);
    var ly = cy + labelR * Math.sin(a);
    var deg = 360 * i / N;
    var t = document.createElementNS(ns, 'text');
    t.setAttribute('x', lx.toFixed(1)); t.setAttribute('y', ly.toFixed(1));
    t.setAttribute('font-family', "'TX-02', monospace");
    t.setAttribute('font-size', '10'); t.setAttribute('font-weight', '500');
    t.setAttribute('fill', '#999'); t.setAttribute('letter-spacing', '0.04em');
    t.textContent = primNames[i].toUpperCase();
    if (deg < 10 || deg > 350) { t.setAttribute('text-anchor','middle'); t.setAttribute('dy','-0.7em'); }
    else if (deg > 170 && deg < 190) { t.setAttribute('text-anchor','middle'); t.setAttribute('dy','1.5em'); }
    else if (deg <= 180) { t.setAttribute('text-anchor','start'); t.setAttribute('dy','0.35em'); }
    else { t.setAttribute('text-anchor','end'); t.setAttribute('dy','0.35em'); }
    svg.appendChild(t); labelEls.push(t);
  }

  /* ── note grid ── */
  var notesEl = document.getElementById('vizNotes');
  var noteItems = [];
  for (var i = 0; i < N; i++) {
    var ni = document.createElement('div');
    ni.className = 'viz-note-item';
    ni.innerHTML = '<span class="viz-note-label">' + primNames[i] + ':</span> ';
    var span = document.createElement('span');
    ni.appendChild(span);
    notesEl.appendChild(ni);
    noteItems.push({ el: ni, label: ni.querySelector('.viz-note-label'), text: span });
  }

  /* ── animation ── */
  var cur = []; for (var i = 0; i < N; i++) cur.push(0);
  var animId = null;

  function animateTo(target, dur) {
    var from = cur.slice();
    var t0 = performance.now();
    if (animId) cancelAnimationFrame(animId);
    function step(now) {
      var t = Math.min((now - t0) / dur, 1);
      t = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
      for (var i = 0; i < N; i++) cur[i] = from[i] + (target[i] - from[i]) * t;
      render();
      if (t < 1) animId = requestAnimationFrame(step);
    }
    animId = requestAnimationFrame(step);
  }

  function render() {
    var pts = [];
    for (var i = 0; i < N; i++) {
      var p = pos(i, cur[i]);
      pts.push(p[0].toFixed(1)+','+p[1].toFixed(1));
      dots[i].setAttribute('cx', p[0].toFixed(1));
      dots[i].setAttribute('cy', p[1].toFixed(1));
      dots[i].setAttribute('opacity', cur[i] > 0.15 ? '1' : '0');
    }
    poly.setAttribute('points', pts.join(' '));
  }

  /* ── DOM refs ── */
  var cards = document.querySelectorAll('#workCards .work-card');
  var btns = document.querySelectorAll('#vizTools .viz-btn');
  var summary = document.getElementById('vizSummary');
  var active = null;

  /* ── unified button handler ── */
  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tool = this.dataset.tool;
      if (active === tool) {
        active = null;
        btns.forEach(function(b) { b.classList.remove('active'); });
        deactivateAll();
        return;
      }
      active = tool;
      btns.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      activateAll(tool);
    });
  });

  function activateAll(tool) {
    var d = data[tool];
    var uni = tool === 'unified';

    /* work cards */
    cards.forEach(function(card, i) {
      var s = d.work.v[i];
      var nm = card.querySelector('.work-card-name');
      var dc = card.querySelector('.work-card-desc');
      var ql = card.querySelector('.work-card-qual');
      if (s >= 3) {
        card.style.background = uni ? '#111' : s === 4 ? '#1a1a1a' : '#333';
        card.style.borderColor = card.style.background;
        card.style.borderStyle = 'solid'; card.style.opacity = '1';
        nm.style.color = '#f5f4f0'; dc.style.color = '#aaa'; ql.style.color = '#bbb';
      } else if (s === 2) {
        card.style.background = 'transparent'; card.style.borderColor = '#999';
        card.style.borderStyle = 'solid'; card.style.opacity = '1';
        nm.style.color = '#555'; dc.style.color = '#888'; ql.style.color = '#777';
      } else if (s === 1) {
        card.style.background = 'transparent'; card.style.borderColor = '#bbb';
        card.style.borderStyle = 'dashed'; card.style.opacity = '0.85';
        nm.style.color = '#999'; dc.style.color = '#bbb'; ql.style.color = '#aaa';
      } else {
        card.style.background = 'transparent'; card.style.borderColor = '#eee';
        card.style.borderStyle = 'solid'; card.style.opacity = '0.35';
        nm.style.color = '#ccc'; dc.style.color = '#ddd'; ql.style.color = '#ddd';
      }
      ql.textContent = d.work.q[i];
      ql.classList.add('visible');
    });

    /* spider chart */
    animateTo(d.tech.v, 600);
    poly.setAttribute('fill', uni ? 'rgba(26,26,26,0.15)' : 'rgba(26,26,26,0.1)');
    poly.setAttribute('stroke-width', uni ? '2' : '1.5');
    for (var i = 0; i < N; i++) {
      var v = d.tech.v[i];
      labelEls[i].setAttribute('fill', v >= 3 ? '#222' : v > 0 ? '#888' : '#ccc');
      labelEls[i].setAttribute('font-weight', v >= 4 ? '700' : '500');
    }

    /* notes */
    for (var i = 0; i < N; i++) {
      var v = d.tech.v[i];
      noteItems[i].text.textContent = d.tech.n[i];
      noteItems[i].label.style.color = v >= 3 ? '#333' : v > 0 ? '#666' : '#ccc';
      noteItems[i].el.style.color = v >= 3 ? '#555' : v > 0 ? '#999' : '#ccc';
    }
    notesEl.classList.add('visible');

    /* summary */
    summary.textContent = d.s;
    summary.classList.add('visible');
  }

  function deactivateAll() {
    /* work cards */
    cards.forEach(function(card) {
      var nm = card.querySelector('.work-card-name');
      var dc = card.querySelector('.work-card-desc');
      var ql = card.querySelector('.work-card-qual');
      card.style.background = 'transparent'; card.style.borderColor = '#ddd';
      card.style.borderStyle = 'solid'; card.style.opacity = '1';
      nm.style.color = '#333'; dc.style.color = '#aaa';
      ql.textContent = ''; ql.classList.remove('visible');
    });

    /* spider */
    var z = []; for (var i = 0; i < N; i++) z.push(0);
    animateTo(z, 400);
    for (var i = 0; i < N; i++) {
      labelEls[i].setAttribute('fill', '#999');
      labelEls[i].setAttribute('font-weight', '500');
    }

    /* notes */
    notesEl.classList.remove('visible');

    /* summary */
    summary.textContent = ''; summary.classList.remove('visible');
  }
})();
