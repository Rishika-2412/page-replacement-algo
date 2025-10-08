const el = id => document.getElementById(id);

function parseRefs(s) { return s.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean).map(x => parseInt(x)); }

function simulateFIFO(refs, framesCount) {
  const frames = []; let fifo = 0; const steps = []; let faults = 0;
  refs.forEach(r => {
    const hit = frames.includes(r);
    if (!hit) {
      if (frames.length < framesCount) frames.push(r);
      else { frames[fifo] = r; fifo = (fifo + 1) % framesCount; }
      faults++;
    }
    steps.push({ frames: [...frames], hit });
  });
  return { steps, faults };
}

function simulateLRU(refs, framesCount) {
  const frames = []; const recent = []; const steps = []; let faults = 0;
  refs.forEach(r => {
    const hit = frames.includes(r);
    if (hit) { recent.splice(recent.indexOf(r), 1); recent.push(r); }
    else {
      if (frames.length < framesCount) { frames.push(r); recent.push(r); }
      else { const lru = recent.shift(); const idx = frames.indexOf(lru); frames[idx] = r; recent.push(r); }
      faults++;
    }
    steps.push({ frames: [...frames], hit });
  });
  return { steps, faults };
}

function simulateOptimal(refs, framesCount) {
  const frames = []; const steps = []; let faults = 0;
  for (let i = 0; i < refs.length; i++) {
    const r = refs[i]; const hit = frames.includes(r);
    if (hit) { steps.push({ frames: [...frames], hit }); continue; }
    if (frames.length < framesCount) { frames.push(r); faults++; steps.push({ frames: [...frames], hit: false }); continue; }
    let far = -1; let farPage = null;
    frames.forEach(p => { const next = refs.indexOf(p, i + 1); const dist = next === -1 ? Infinity : next; if (dist > far) { far = dist; farPage = p; } });
    const idx = frames.indexOf(farPage); frames[idx] = r; faults++; steps.push({ frames: [...frames], hit: false });
  }
  return { steps, faults };
}

const ALGO = { FIFO: simulateFIFO, LRU: simulateLRU, Optimal: simulateOptimal };

let state = { refs: [], frames: 3, algo: 'LRU', steps: [], stepIndex: 0 };

function refreshProcessTbl(refs) {
  const tbody = el('processTbl'); tbody.innerHTML = '';
  refs.forEach((r, i) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${i + 1}</td><td>${r}</td>`; tbody.appendChild(tr); });
}

function renderTimeline(refs, idx = 0) {
  const area = el('timelineArea'); area.innerHTML = '';
  refs.forEach((r, i) => { const c = document.createElement('div'); c.className = 'chip'; c.textContent = r; if (i === idx) c.style.boxShadow = '0 6px 20px rgba(108,92,231,0.22)'; area.appendChild(c); });
}

function renderSteps() {
  const area = el('stepsArea'); area.innerHTML = '';
  const framesCount = state.frames;
  if (state.steps.length === 0) return;
  const fs = state.steps[state.stepIndex].frames;
  for (let i = 0; i < framesCount; i++) {
    const col = document.createElement('div'); col.className = 'frame-col';
    const title = document.createElement('div'); title.className = 'small muted'; title.textContent = `Frame ${i + 1}`; col.appendChild(title);
    const box = document.createElement('div'); box.style.marginTop = '8px'; box.style.padding = '10px'; box.style.border = '1px solid #eef2f7'; box.style.borderRadius = '8px'; box.style.minHeight = '36px';
    box.textContent = (fs[i] === undefined ? '-' : fs[i]); col.appendChild(box);
    area.appendChild(col);
  }
  el('status').textContent = state.steps[state.stepIndex].hit ? 'HIT' : 'PAGE FAULT';
}

function renderResultsTable() {
  const tbody = el('resultsBody'); tbody.innerHTML = '';
  state.steps.forEach((s, i) => {
    const tr = document.createElement('tr');
    const ref = parseRefs(el('refs').value)[i];
    tr.innerHTML = `<td>${i + 1}</td><td>${ref}</td><td>${s.frames.map(x => x === undefined ? '-' : x).join(' | ')}</td><td>${s.hit ? 'No' : 'Yes'}</td>`;
    tbody.appendChild(tr);
  });
  el('totalSteps').textContent = state.steps.length;
}

function computeMetrics() {
  const faults = state.steps.filter(s => !s.hit).length;
  const ratio = (faults / state.steps.length * 100) || 0;
  const metrics = el('metrics'); metrics.innerHTML = '';
  const m1 = document.createElement('div'); m1.className = 'metric'; m1.innerHTML = `<div class="small">Page Faults</div><div style="font-size:20px;margin-top:6px">${faults}</div><div class="small">(${ratio.toFixed(1)}%)</div>`;
  metrics.appendChild(m1);
  const m2 = document.createElement('div'); m2.className = 'metric'; m2.innerHTML = `<div class="small">Frames</div><div style="font-size:20px;margin-top:6px">${state.frames}</div><div class="small">Algorithm: ${state.algo}</div>`;
  metrics.appendChild(m2);
  const m3 = document.createElement('div'); m3.className = 'metric'; m3.innerHTML = `<div class="small">References</div><div style="font-size:20px;margin-top:6px">${state.refs.length}</div><div class="small">Steps</div>`;
  metrics.appendChild(m3);
}

function renderSummaryCards() {
  const wrap = el('summaryCards'); wrap.innerHTML = '';
  const faults = state.steps.filter(s => !s.hit).length;
  const card = document.createElement('div'); card.className = 'card'; card.style.flex = '1';
  card.innerHTML = `<div class="small">Summary</div><div style="margin-top:8px"><strong>Algorithm:</strong> ${state.algo}</div><div style="margin-top:6px"><strong>Frames:</strong> ${state.frames}</div><div style="margin-top:6px;color:black"><strong>Page Faults:</strong> ${faults}</div>`;
  wrap.appendChild(card);
}

function runSimulation() {
  try { state.refs = parseRefs(el('refs').value); } catch (e) { alert('Invalid refs'); return; }
  state.frames = parseInt(el('frames').value, 10) || 3;
  state.algo = el('algo').value;
  refreshProcessTbl(state.refs);
  renderTimeline(state.refs, 0);
  const sim = ALGO[state.algo](state.refs, state.frames);
  state.steps = sim.steps; state.stepIndex = 0;
  renderSteps(); renderResultsTable(); computeMetrics(); renderSummaryCards();
}

el('run').addEventListener('click', () => { runSimulation(); });
el('step').addEventListener('click', () => {
  if (state.steps.length === 0) runSimulation();
  else { if (state.stepIndex < state.steps.length - 1) state.stepIndex++; renderTimeline(state.refs, state.stepIndex); renderSteps(); }
  renderResultsTable();
});
el('reset').addEventListener('click', () => {
  state = { refs: [], frames: 3, algo: 'LRU', steps: [], stepIndex: 0 };
  el('refs').value = ''; el('frames').value = ''; el('algo').value = 'LRU';
  el('status').textContent = 'Ready';
  el('timelineArea').innerHTML = ''; el('stepsArea').innerHTML = ''; el('resultsBody').innerHTML = '';
  el('processTbl').innerHTML = ''; el('metrics').innerHTML = ''; el('summaryCards').innerHTML = ''; el('totalSteps').textContent = '0';
});

window.addEventListener('load', () => {
  el('refs').value = ''; el('frames').value = ''; el('algo').value = 'LRU';
  el('status').textContent = 'Ready';
});