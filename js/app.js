const CONFIG = {
  guildName: 'White Eagles',
  realm: 'EU Normal',
  faction: 'Alliance',
  rosterFile: 'data/roster.json'
};

let roster = {
  characters: [],
  raidNames: [],
  generatedAt: null,
  guildName: null
};
let sort = { key: 'name', dir: 'asc' };
let search = '';
let page = 1;
const PAGE_SIZE = 10;

function byId(id) { return document.getElementById(id); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function classIcon(cls) { return `assets/classes/${String(cls || 'unknown').toLowerCase()}.png`; }
function shortName(fullName) { return String(fullName || '').split('-')[0]; }

function fmtDate(value) {
  if (!value) return '';
  const d = typeof value === 'number' ? new Date(value * 1000) : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

function isReady(value) {
  if (value === true || value === 1 || value === '1') return true;
  const s = String(value ?? '').toLowerCase();
  return s === 'yes' || s === 'ready' || s === 'true' || s === 'complete';
}

// Accepts several shapes a WoW addon export might use and normalizes to
// { characters: [{ name, class, level, rank, rankIndex, zone, note, online, raids }], generatedAt, guildName }
function normalizeRoster(raw) {
  if (!raw) return { characters: [], raidNames: [], generatedAt: null, guildName: null };

  const list = Array.isArray(raw) ? raw
    : Array.isArray(raw.members) ? raw.members
    : Array.isArray(raw.characters) ? raw.characters
    : Array.isArray(raw.rosterExport?.characters) ? raw.rosterExport.characters
    : [];

  const generatedAt = raw.exportedAt || raw.generatedAt || raw.rosterExport?.generatedAt || null;
  const guildName = raw.guildName || raw.guild?.name || null;

  const characters = list.map(entry => {
    const name = entry.name || entry.character || entry.fullName || '';
    const rawRaids = entry.raids || {};
    const raids = {};
    if (Array.isArray(rawRaids)) {
      rawRaids.forEach(r => {
        if (r && r.name) raids[r.name] = { ready: isReady(r.unlocked ?? r.ready), missing: r.missing || [] };
      });
    } else {
      Object.keys(rawRaids).forEach(raidName => {
        const r = rawRaids[raidName];
        raids[raidName] = { ready: isReady(r?.ready ?? r), missing: r?.missing || [] };
      });
    }
    return {
      name,
      class: entry.class || entry.classFileName || '',
      classFileName: entry.classFileName || entry.class || '',
      level: entry.level ?? '',
      rank: entry.guildRank || entry.rank || '',
      rankIndex: Number.isFinite(entry.guildRankIndex) ? entry.guildRankIndex : (Number.isFinite(entry.rankIndex) ? entry.rankIndex : 999),
      zone: entry.zone || '',
      note: entry.note || '',
      online: typeof entry.online === 'boolean' ? entry.online : null,
      raids
    };
  });

  const raidNameSet = new Set();
  characters.forEach(c => Object.keys(c.raids).forEach(n => raidNameSet.add(n)));

  return { characters, raidNames: [...raidNameSet], generatedAt, guildName };
}

async function loadRoster() {
  const status = byId('roster-status');
  try {
    const response = await fetch(`${CONFIG.rosterFile}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`Could not load roster (${response.status})`);
    const raw = await response.json();
    roster = normalizeRoster(raw);
    if (!roster.characters.length) {
      status.textContent = 'The roster file loaded but contains no characters yet.';
      status.hidden = false;
      return;
    }
    status.hidden = true;
    renderGuildMeta();
    renderClassSummary();
    renderTable();
  } catch (error) {
    status.textContent = `Could not load the roster: ${error.message}`;
    status.hidden = false;
  }
}

function renderGuildMeta() {
  if (roster.guildName) document.querySelector('.brand-block h1').textContent = roster.guildName;
  byId('guild-meta').textContent = `${CONFIG.realm} • ${CONFIG.faction}`;
  byId('roster-count').textContent = `${roster.characters.length} members`;
  const updated = fmtDate(roster.generatedAt);
  byId('roster-updated').textContent = updated ? `Updated ${updated}` : '';
}

function renderClassSummary() {
  const counts = new Map();
  roster.characters.forEach(c => {
    const key = c.classFileName || c.class || 'Unknown';
    const entry = counts.get(key) || { label: c.class || key, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  });
  const rows = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  byId('class-summary').innerHTML = rows.map(([key, { label, count }]) => `
    <div class="class-chip">
      <img src="${classIcon(key)}" alt="" onerror="this.style.display='none'">
      <span>${escapeHtml(label)}</span>
      <strong>${count}</strong>
    </div>`).join('');
}

function filteredSortedCharacters() {
  const q = search.trim().toLowerCase();
  let rows = roster.characters;
  if (q) {
    rows = rows.filter(c =>
      c.name.toLowerCase().includes(q) ||
      String(c.class).toLowerCase().includes(q) ||
      String(c.rank).toLowerCase().includes(q)
    );
  }
  rows = [...rows];
  const dir = sort.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    let av, bv;
    if (sort.key === 'name') { av = a.name; bv = b.name; }
    else if (sort.key === 'level') { av = a.level; bv = b.level; }
    else if (sort.key === 'rank') { av = a.rankIndex; bv = b.rankIndex; }
    else if (sort.key === 'class') { av = a.class; bv = b.class; }
    else if (sort.key === 'zone') { av = a.zone; bv = b.zone; }
    else if (sort.key === 'online') { av = a.online ? 1 : 0; bv = b.online ? 1 : 0; }
    else if (sort.key.startsWith('raid:')) {
      const raidName = sort.key.slice(5);
      av = a.raids[raidName]?.ready ? 1 : 0;
      bv = b.raids[raidName]?.ready ? 1 : 0;
    } else { av = ''; bv = ''; }
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
  return rows;
}

function sortIndicator(key) {
  if (sort.key !== key) return '↕';
  return sort.dir === 'asc' ? '▲' : '▼';
}

function renderTable() {
  const table = byId('roster-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  const hasZone = roster.characters.some(c => c.zone);
  const hasNote = roster.characters.some(c => c.note);
  const hasOnline = roster.characters.some(c => c.online !== null);
  const columnCount = 4 + (hasZone ? 1 : 0) + (hasNote ? 1 : 0) + (hasOnline ? 1 : 0) + roster.raidNames.length;

  thead.innerHTML = `<tr>
    <th><button class="sort-header" data-sort="name">Character <span>${sortIndicator('name')}</span></button></th>
    <th><button class="sort-header" data-sort="class">Class <span>${sortIndicator('class')}</span></button></th>
    <th><button class="sort-header" data-sort="level">Level <span>${sortIndicator('level')}</span></button></th>
    <th><button class="sort-header" data-sort="rank">Rank <span>${sortIndicator('rank')}</span></button></th>
    ${hasOnline ? `<th><button class="sort-header" data-sort="online">Online <span>${sortIndicator('online')}</span></button></th>` : ''}
    ${hasZone ? `<th><button class="sort-header" data-sort="zone">Zone <span>${sortIndicator('zone')}</span></button></th>` : ''}
    ${hasNote ? `<th>Note</th>` : ''}
    ${roster.raidNames.map(name => `<th title="${escapeHtml(name)}"><button class="sort-header" data-sort="raid:${escapeHtml(name)}">${escapeHtml(name)} <span>${sortIndicator('raid:' + name)}</span></button></th>`).join('')}
  </tr>`;

  const filtered = filteredSortedCharacters();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  tbody.innerHTML = pageRows.map(c => `<tr>
    <td><div class="character-cell"><img src="${classIcon(c.classFileName)}" alt="" title="${escapeHtml(c.class)}" onerror="this.style.display='none'"><strong>${escapeHtml(shortName(c.name))}</strong></div></td>
    <td>${escapeHtml(c.class)}</td>
    <td>${escapeHtml(c.level)}</td>
    <td>${escapeHtml(c.rank)}</td>
    ${hasOnline ? `<td class="center"><span class="status-chip ${c.online ? 'ready' : 'missing'}">${c.online ? 'Online' : 'Offline'}</span></td>` : ''}
    ${hasZone ? `<td>${escapeHtml(c.zone)}</td>` : ''}
    ${hasNote ? `<td>${escapeHtml(c.note)}</td>` : ''}
    ${roster.raidNames.map(name => {
      const r = c.raids[name];
      const ready = !!r?.ready;
      const title = r?.missing?.length ? escapeHtml(r.missing.join(', ')) : '';
      return `<td class="center"><span class="status-chip ${ready ? 'ready' : 'missing'}" title="${title}">${ready ? 'Yes' : 'No'}</span></td>`;
    }).join('')}
  </tr>`).join('') || `<tr><td colspan="${columnCount}" class="muted">No characters match your search.</td></tr>`;

  table.hidden = false;
  renderPagination(filtered.length, totalPages);
}

function renderPagination(totalRows, totalPages) {
  const container = byId('roster-pagination');
  if (!container) return;
  if (totalRows <= PAGE_SIZE) { container.innerHTML = ''; return; }

  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, totalRows);

  const pageButtons = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
      pageButtons.push(`<button class="page-button ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`);
    } else if (pageButtons[pageButtons.length - 1] !== '<span class="page-ellipsis">…</span>') {
      pageButtons.push('<span class="page-ellipsis">…</span>');
    }
  }

  container.innerHTML = `
    <span class="pagination-range">${first}–${last} of ${totalRows}</span>
    <div class="pagination-buttons">
      <button class="page-button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Prev</button>
      ${pageButtons.join('')}
      <button class="page-button" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Next</button>
    </div>`;
}

document.addEventListener('click', event => {
  const sortButton = event.target.closest('.sort-header');
  if (sortButton) {
    const key = sortButton.dataset.sort;
    sort = { key, dir: sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc' };
    page = 1;
    renderTable();
    return;
  }
  const pageButton = event.target.closest('.page-button');
  if (pageButton && !pageButton.disabled) {
    page = Number(pageButton.dataset.page);
    renderTable();
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'roster-search') {
    search = event.target.value;
    page = 1;
    renderTable();
  }
});

loadRoster();
