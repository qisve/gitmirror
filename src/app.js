import { isNative, checkTermux, requestStoragePermission, exec, poll, readOutput } from './termux.js'

const S = {
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  alert:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  code:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  dl:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  send:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  git:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>`,
  folder:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  star:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  fork:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/></svg>`,
  eye:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  search:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  back:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  ext:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  branch:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  bell:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  pr:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>`,
  comment:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
}

let pg='home', T=[], repos=[], notifications=[], notiCount=0
let txOk=false, stOk=false, ghOk=false, authOk=false, notiTimer=null
function cleanJson(t) {
  var s = t.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim();
  if (!s) return "[]";
  var a = s.indexOf("["), o = s.indexOf("{");
  var st = -1;
  if (a >= 0 && o >= 0) st = Math.min(a, o);
  else if (a >= 0) st = a;
  else if (o >= 0) st = o;
  if (st < 0) return "[]";
  var e = -1;
  for (var i = s.length - 1; i >= st; i--) {
    if (s[i] === "]" || s[i] === "}") { e = i + 1; break; }
  }
  return e > st ? s.slice(st, e) : s.slice(st);
}

export async function init() {
  document.getElementById('app').innerHTML = shell()
  bindNav(); nav('home'); renderTerm()
  if (isNative) {
    txOk = await checkTermux()
    if (txOk) { stOk = await requestStoragePermission(); await testConn() }
  }
  renderEnv()
}

function shell() {
  return `<div class="bg-g bg-g1"></div><div class="bg-g bg-g2"></div>
  <header><div class="hdr">
    <div class="logo" onclick="window._goHome()"><div class="logo-i">G</div><div class="logo-t">GitMirror</div></div>
    <nav id="nav">
      <button class="nb on" data-p="home">首页</button>
      <button class="nb" data-p="repos">仓库</button>
      <button class="nb" data-p="search">搜索</button>
      <button class="nb" data-p="noti" id="nav-noti">通知</button>
      <button class="nb" data-p="set">设置</button>
    </nav>
  </div></header>
  <main>
    <div class="pg on" id="pg-home"></div>
    <div class="pg" id="pg-repos"></div>
    <div class="pg" id="pg-search"></div>
    <div class="pg" id="pg-noti"></div>
    <div class="pg" id="pg-detail"></div>
    <div class="pg" id="pg-set"></div>
  </main>
  <footer>GitMirror 中文终端客户端</footer>
  <div class="modal-bg" id="mbg"><div class="modal" id="mbd"></div></div>
  <div class="toast" id="toast"></div>`
}

function bindNav() {
  document.querySelectorAll('.nb').forEach(b => { b.onclick = () => nav(b.dataset.p) })
  document.getElementById('mbg').onclick = e => { if (e.target.id === 'mbg') closeModal() }
}

function nav(p) {
  pg = p
  document.querySelectorAll('.pg').forEach(el => el.classList.remove('on'))
  document.querySelectorAll('.nb').forEach(el => el.classList.remove('on'))
  const el = document.getElementById('pg-' + p)
  if (el) el.classList.add('on')
  const btn = document.querySelector('.nb[data-p="' + p + '"]')
  if (btn) btn.classList.add('on')
  if (p === 'home') renderHome()
  if (p === 'repos') loadRepos()
  if (p === 'search') renderSearch()
  if (p === 'noti') renderNoti()
  if (p === 'set') renderSettings()
}

function renderHome() {
  document.getElementById('pg-home').innerHTML = `
    <div class="stats">
      <div class="st"><div class="st-l">仓库</div><div class="st-v b" id="sr">--</div></div>
      <div class="st"><div class="st-l">星标</div><div class="st-v g" id="ss">--</div></div>
      <div class="st"><div class="st-l">通知</div><div class="st-v r" id="sn">--</div></div>
      <div class="st"><div class="st-l">问题</div><div class="st-v w" id="si">--</div></div>
    </div>
    <div class="sect"><span class="dot"></span>快捷操作</div>
    <div class="act-grid">
      <div class="act" onclick="window._openModal('repo')"><div class="ai b">${S.plus}</div><div class="an">新建仓库</div><div class="ad">创建代码仓库</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('issue')"><div class="ai r">${S.alert}</div><div class="an">提交问题</div><div class="ad">报告 Bug</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('clone')"><div class="ai g">${S.dl}</div><div class="an">克隆仓库</div><div class="ad">克隆到本地</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('gist')"><div class="ai p">${S.code}</div><div class="an">代码片段</div><div class="ad">创建 Gist</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('pr')"><div class="ai b">${S.git}</div><div class="an">发起 PR</div><div class="ad">创建拉取请求</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('push')"><div class="ai g">${S.send}</div><div class="an">推送代码</div><div class="ad">提交并推送</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
    </div>
    <div class="sect"><span class="dot"></span>终端输出</div>
    <div class="term"><div class="term-bar"><div class="dots"><span></span><span></span><span></span></div><span class="term-t">Terminal</span><button class="term-clr" onclick="window._clearTerm()">清空</button></div><div class="term-body" id="tb"></div></div>
    <div class="sect"><span class="dot"></span>最近仓库</div>
    <div id="hr" class="repo-wrap"><div class="empty-hint">暂无数据</div></div>`
  renderTerm(); loadHomeRepos(); fetchNotifications()
}

async function loadHomeRepos() {
  if (!ghOk) return
  const r = await exec('gh repo list --limit 5 --json name,description,stargazerCount,forkCount,primaryLanguage,updatedAt,isPrivate,owner', 'hr')
  if (!r.sent) return
  const out = await poll(r.outputPath, 20000)
  if (!out) return
  try {
    const list = JSON.parse(cleanJson(out))
    repos = list
    renderRepoList('hr', list)
    const el = id => document.getElementById(id)
    el('sr').textContent = list.length
    el('ss').textContent = list.reduce((s, r) => s + (r.stargazerCount || 0), 0)
  } catch {}
}

function loadRepos() {
  document.getElementById('pg-repos').innerHTML = `<div class="sect"><span class="dot"></span>我的仓库</div><div class="repo-wrap" id="rl-full"><div class="empty-hint">加载中…</div></div>`
  doLoadRepos()
}

async function doLoadRepos() {
  const r = await exec('gh repo list --limit 30 --json name,description,stargazerCount,forkCount,primaryLanguage,updatedAt,isPrivate,owner,url', 'rl')
  if (!r.sent) { renderRepoList('rl-full', []); return }
  const out = await poll(r.outputPath, 25000)
  if (!out) { renderRepoList('rl-full', []); return }
  try { repos = JSON.parse(cleanJson(out)); renderRepoList('rl-full', repos) } catch { renderRepoList('rl-full', []) }
}

function renderSearch() {
  document.getElementById('pg-search').innerHTML = `
    <div class="sect">${S.search} 搜索仓库</div>
    <div class="search-bar">
      <input id="sq" placeholder="搜索 GitHub 仓库…" onkeydown="if(event.key==='Enter')window._doSearch()">
      <select id="slang"><option value="">全部</option><option value="javascript">JS</option><option value="typescript">TS</option><option value="python">Py</option><option value="rust">Rust</option><option value="go">Go</option><option value="java">Java</option></select>
      <button class="btn btn-s" onclick="window._doSearch()">搜索</button>
    </div>
    <div id="search-res" class="repo-wrap"><div class="empty-hint">输入关键词搜索</div></div>`
}

async function doSearch() {
  const q = document.getElementById('sq').value.trim()
  const lang = document.getElementById('slang').value
  if (!q) { toast('请输入关键词', 'er'); return }
  const c = document.getElementById('search-res')
  c.innerHTML = '<div class="empty-hint">搜索中…</div>'
  const cmd = 'gh search repos "' + q + '"' + (lang ? ' --language ' + lang : '') + ' --limit 20 --json name,fullName,description,url,stargazersCount,forksCount,owner,language'
  const r = await exec(cmd, 'sr-' + Date.now())
  if (!r.sent) { c.innerHTML = '<div class="empty-hint">发送失败</div>'; return }
  const out = await poll(r.outputPath, 25000)
  if (!out) { c.innerHTML = '<div class="empty-hint">超时</div>'; return }
  try {
    const items = JSON.parse(cleanJson(out))
    if (!items.length) { c.innerHTML = '<div class="empty-hint">未找到</div>'; return }
    renderRepoList('search-res', items)
  } catch { c.innerHTML = '<div class="empty-hint">解析失败</div>' }
}

async function fetchNotifications() {
  if (!ghOk) return
  const r = await exec('gh api notifications --jq ".[] | {reason,type,repo:.repository.full_name,title:.subject.title,url:.subject.url,unread,updated_at:.updated_at}" --paginate 2>/dev/null | head -c 8000', 'nf-' + Date.now())
  if (!r.sent) return
  const out = await poll(r.outputPath, 15000)
  if (!out) return
  try {
    const lines = out.trim().split('\n').filter(l => l.trim())
    notifications = lines.map(l => JSON.parse(cleanJson(l))).slice(0, 30)
    notiCount = notifications.filter(n => n.unread).length
    const el = document.getElementById('sn')
    if (el) el.textContent = notiCount
    updateNotiBadge()
  } catch {}
}

function updateNotiBadge() {
  const btn = document.getElementById('nav-noti')
  if (!btn) return
  const old = btn.querySelector('.noti-badge')
  if (old) old.remove()
  if (notiCount > 0) {
    const b = document.createElement('span')
    b.className = 'noti-badge'
    b.textContent = notiCount > 9 ? '9+' : notiCount
    btn.appendChild(b)
  }
}

function renderNoti() {
  document.getElementById('pg-noti').innerHTML = `
    <div class="sect">${S.bell} 通知中心
      <button class="btn btn-g" style="margin-left:auto;font-size:11px;padding:5px 12px" onclick="window._markAllRead()">全部已读</button>
      <button class="btn btn-g" style="font-size:11px;padding:5px 12px" onclick="window._refreshNoti()">刷新</button>
    </div>
    <div id="noti-list" class="noti-list"><div class="empty-hint">加载中…</div></div>`
  renderNotiList()
}

function renderNotiList() {
  const el = document.getElementById('noti-list')
  if (!el) return
  if (!notifications.length) { el.innerHTML = '<div class="empty-hint">暂无通知</div>'; return }
  const reasons = { assign:'分配给你', author:'你是作者', comment:'新评论', mention:'提到了你', review_requested:'请求审查', state_change:'状态变更', subscribed:'已订阅', team_mention:'团队提及', manual:'手动订阅' }
  const icons = { Issue: S.alert, PullRequest: S.pr, Discussion: S.comment, Release: S.dl }
  el.innerHTML = notifications.map((n, i) => {
    const cls = n.unread ? 'unread' : 'read'
    const icon = icons[n.type] || S.bell
    return '<div class="noti-item ' + cls + '" onclick="window._openNoti(' + i + ')">' +
      '<div class="noti-icon">' + icon + '</div>' +
      '<div class="noti-body"><div class="noti-title">' + esc(n.title || '无标题') + '</div>' +
      '<div class="noti-meta"><span class="noti-repo">' + esc(n.repo || '') + '</span><span class="noti-reason">' + (reasons[n.reason] || n.reason) + '</span><span class="noti-time">' + timeAgo(n.updated_at) + '</span></div></div>' +
      (n.unread ? '<div class="noti-dot"></div>' : '') + '</div>'
  }).join('')
}

function openNoti(idx) {
  const n = notifications[idx]
  if (!n) return
  if (n.unread) {
    n.unread = false
    notiCount = Math.max(0, notiCount - 1)
    const el = document.getElementById('sn')
    if (el) el.textContent = notiCount
    updateNotiBadge()
    const tid = (n.url || '').match(/\/(\d+)$/)
    if (tid) exec('gh api -X PATCH notifications/threads/' + tid[1] + ' 2>/dev/null', 'rd-' + Date.now())
  }
  if (n.url) {
    const w = n.url.replace('api.github.com/repos', 'github.com').replace('/pulls/', '/pull/').replace('/issues/', '/issues/')
    window.open(w, '_blank')
  }
}

async function markAllRead() {
  await exec('gh api -X PUT notifications 2>/dev/null', 'ma-' + Date.now())
  notifications.forEach(n => n.unread = false)
  notiCount = 0
  const el = document.getElementById('sn')
  if (el) el.textContent = '0'
  updateNotiBadge(); renderNotiList(); toast('全部已读', 'ok')
}

function refreshNoti() {
  toast('刷新中…', 'ok')
  fetchNotifications().then(() => { renderNotiList(); toast('已刷新', 'ok') })
}

function startNotiPoll() {
  if (notiTimer) clearInterval(notiTimer)
  notiTimer = setInterval(() => { if (ghOk) fetchNotifications() }, 120000)
}

async function showDetail(owner, name) {
  const fullName = owner + '/' + name
  nav('detail')
  document.getElementById('pg-detail').innerHTML = '<div class="detail-header"><button class="btn btn-g back-btn" onclick="window._goBack()">' + S.back + ' 返回</button></div><div class="detail-loading">加载中…</div>'
  const cmd = 'gh repo view ' + fullName + ' --json name,description,stargazerCount,forkCount,primaryLanguage,updatedAt,createdAt,url,homepageUrl,licenseInfo,defaultBranchRef,isPrivate,watchers,issues,pullRequests,diskUsage,topics'
  const r = await exec(cmd, 'dt-' + Date.now())
  if (!r.sent) { document.getElementById('pg-detail').innerHTML = '<div class="detail-header"><button class="btn btn-g back-btn" onclick="window._goBack()">' + S.back + ' 返回</button></div><div class="empty-hint">发送失败</div>'; return }
  const out = await poll(r.outputPath, 20000)
  if (!out) { document.getElementById('pg-detail').innerHTML = '<div class="detail-header"><button class="btn btn-g back-btn" onclick="window._goBack()">' + S.back + ' 返回</button></div><div class="empty-hint">超时</div>'; return }
  try { renderDetail(JSON.parse(cleanJson(out)), fullName) } catch { document.getElementById('pg-detail').innerHTML = '<div class="detail-header"><button class="btn btn-g back-btn" onclick="window._goBack()">' + S.back + ' 返回</button></div><div class="empty-hint">解析失败</div>' }
}

function renderDetail(d, fullName) {
  const lc = LANG_CLR[d.primaryLanguage?.name || ''] || '#6b7394'
  const topics = d.topics || []
  const el = document.getElementById('pg-detail')
  el.innerHTML =
    '<div class="detail-header"><button class="btn btn-g back-btn" onclick="window._goBack()">' + S.back + ' 返回</button></div>' +
    '<div class="detail-top"><div class="detail-title">' + S.folder + ' ' + esc(fullName) + '</div>' +
    (d.isPrivate ? '<span class="badge private">私有</span>' : '<span class="badge public">公开</span>') + '</div>' +
    '<div class="detail-desc">' + esc(d.description || '暂无描述') + '</div>' +
    (topics.length ? '<div class="detail-topics">' + topics.map(t => '<span class="topic">' + esc(t) + '</span>').join('') + '</div>' : '') +
    '<div class="detail-stats">' +
      '<div class="ds"><span class="ds-icon" style="color:var(--accent)">' + S.star + '</span><span class="ds-val">' + (d.stargazerCount||0) + '</span><span class="ds-l">星标</span></div>' +
      '<div class="ds"><span class="ds-icon" style="color:var(--gn)">' + S.fork + '</span><span class="ds-val">' + (d.forkCount||0) + '</span><span class="ds-l">复刻</span></div>' +
      '<div class="ds"><span class="ds-icon" style="color:var(--pu)">' + S.eye + '</span><span class="ds-val">' + (d.watchers?.totalCount||0) + '</span><span class="ds-l">关注</span></div>' +
      '<div class="ds"><span class="ds-icon" style="color:var(--rd)">' + S.alert + '</span><span class="ds-val">' + (d.issues?.totalCount||0) + '</span><span class="ds-l">问题</span></div>' +
    '</div>' +
    '<div class="detail-info">' +
      (d.primaryLanguage ? '<div class="di"><span class="ld" style="background:' + lc + '"></span> ' + esc(d.primaryLanguage.name) + '</div>' : '') +
      (d.licenseInfo ? '<div class="di">📄 ' + esc(d.licenseInfo.name) + '</div>' : '') +
      (d.defaultBranchRef ? '<div class="di">' + S.branch + ' ' + esc(d.defaultBranchRef.name) + '</div>' : '') +
      '<div class="di">' + S.clock + ' 创建于 ' + fmtDate(d.createdAt) + '</div>' +
      '<div class="di">' + S.clock + ' 更新于 ' + fmtDate(d.updatedAt) + '</div>' +
      (d.diskUsage ? '<div class="di">📦 ' + (d.diskUsage/1024).toFixed(1) + ' MB</div>' : '') +
      (d.homepageUrl ? '<div class="di"><a href="' + esc(d.homepageUrl) + '" target="_blank">🌐 ' + esc(d.homepageUrl) + '</a></div>' : '') +
    '</div>' +
    '<div class="detail-actions">' +
      '<button class="btn btn-s" onclick="window._doClone(\'' + esc(fullName) + '\')">' + S.dl + ' 克隆到本地</button>' +
      '<button class="btn btn-p" onclick="window.open(\'https://github.com/' + esc(fullName) + '\',\'_blank\')">' + S.ext + ' GitHub</button>' +
      (d.homepageUrl ? '<button class="btn btn-g" onclick="window.open(\'' + esc(d.homepageUrl) + '\',\'_blank\')">' + S.ext + ' 网站</button>' : '') +
    '</div>' +
    '<div class="sect" style="margin-top:20px"><span class="dot"></span>终端</div>' +
    '<div class="term"><div class="term-bar"><div class="dots"><span></span><span></span><span></span></div><span class="term-t">Terminal</span></div><div class="term-body" id="tb2"></div></div>'
  renderTermDetail()
}

function renderTermDetail() {
  const el = document.getElementById('tb2')
  if (!el) return
  el.innerHTML = T.map(t => {
    const c = { cmd:'cm', ok:'ok', err:'er', info:'nf', out:'ot' }[t.type] || 'ot'
    const pr = t.type === 'cmd' ? '<span class="pr">❯</span> ' : ''
    return '<div class="tl">' + pr + '<span class="' + c + '">' + esc(t.text) + '</span></div>'
  }).join('')
  el.scrollTop = el.scrollHeight
}

async function doClone(fullName) {
  const cmd = 'mkdir -p ~/projects && cd ~/projects && git clone https://github.com/' + fullName + '.git'
  log('cmd', '$ ' + cmd)
  const r = await exec(cmd, 'cl-' + Date.now())
  if (!r.sent) { log('err', '发送失败'); toast('失败', 'er'); return }
  log('ok', '✓ 克隆已发送'); toast('克隆已开始', 'ok')
  const out = await poll(r.outputPath, 60000)
  if (out) { log(out.includes('fatal') ? 'err' : 'ok', out.trim()); renderTermDetail() }
}

function goHome() { nav('home') }
function goBack() { nav(repos.length ? 'repos' : 'home') }

const LANG_CLR = { JavaScript:'#f1e05a',TypeScript:'#3178c6',Python:'#3572A5',Rust:'#dea584',Go:'#00ADD8',Java:'#b07219','C++':'#f34b7d',HTML:'#e34c26',CSS:'#563d7c',Shell:'#89e051',Vue:'#41b883' }

function renderRepoList(id, list) {
  const el = document.getElementById(id)
  if (!el) return
  if (!list.length) { el.innerHTML = '<div class="empty-hint">暂无数据</div>'; return }
  el.innerHTML = list.map((r, i) => {
    const langObj = r.primaryLanguage || (typeof r.language === 'string' ? {name: r.language} : (r.languages && r.languages[0])) || {}
    const lang = typeof langObj === 'string' ? langObj : (langObj.name || '')
    const lc = LANG_CLR[lang] || '#6b7394'
    var owner = '', name = r.name || ''
    if (r.fullName) { var fp = r.fullName.split('/'); owner = fp[0] || owner; name = fp[1] || name }
    if (r.owner) { owner = r.owner.login }
    else if (r.url) { var m = r.url.match(/github\.com\/([^/]+)/); if (m) owner = m[1] }
    else if (r.nameWithOwner) { var p = r.nameWithOwner.split('/'); owner = p[0]; name = p[1] }
    return '<div class="ri" style="animation-delay:' + i*0.04 + 's" onclick="window._showDetail(\'' + esc(owner) + '\',\'' + esc(name) + '\')">' +
      '<div class="ri-info"><div class="ri-name">' + S.folder + ' ' + esc(owner) + '/' + esc(name) + '</div>' +
      '<div class="ri-desc">' + esc(r.description||'暂无描述') + '</div>' +
      '<div class="ri-meta">' + (lang ? '<span><span class="ld" style="background:' + lc + '"></span>' + esc(lang) + '</span>' : '') +
      '<span>⭐ ' + ((r.stargazersCount||r.stargazersCount||0)) + '</span><span>🔀 ' + ((r.forksCount||r.forksCount||0)) + '</span>' +
      (r.isPrivate ? '<span>🔒</span>' : '') + '</div></div><div class="ri-go">→</div></div>'
  }).join('')
}

function renderSettings() {
  document.getElementById('pg-set').innerHTML =
    '<div class="sect"><span class="dot"></span>环境检测</div>' +
    '<div class="set-card" id="env-card"></div>' +
    '<div class="set-card" style="text-align:center"><h3>连接测试</h3><p>测试 App → Termux</p><button class="btn btn-p" onclick="window._testConn()" style="margin-top:8px">测试连接</button></div>' +
    '<div class="set-card"><h3>安装指南</h3><p><b>1.</b> 安装 Termux（F-Droid）<br><b>2.</b> <code>pkg update && pkg install gh git</code><br><b>3.</b> <code>gh auth login</code><br><b>4.</b> <code>termux-setup-storage</code><br><b>5.</b> <code>echo allow-external-apps=true >> ~/.termux/termux.properties</code></p></div>' +
    '<div class="set-card"><h3>手动检测</h3><button class="btn btn-p" onclick="window._detectEnv()">重新检测</button></div>'
  renderEnv()
}

async function testConn() {
  log('info', '=== 连接测试 ===')
  const r = await exec('echo TEST_CONN_OK', 't-' + Date.now())
  if (!r.sent) { log('err', '发送失败: ' + r.error); return }
  for (let i = 0; i < 15; i++) {
    await new Promise(ok => setTimeout(ok, 1000))
    const rr = await readOutput(r.outputPath)
    if (rr.ready) {
      if (rr.content.includes('TEST_CONN_OK')) { log('ok', '✅ 连接正常!'); await detectGh() }
      else { log('err', '内容异常') }
      renderEnv(); return
    }
  }
  log('err', '❌ 超时')
}

async function detectGh() {
  const r1 = await exec('command -v gh && echo GH_OK', 'c-' + Date.now())
  if (r1.sent) { const o1 = await poll(r1.outputPath, 10000); ghOk = o1 && o1.includes('GH_OK') }
  if (ghOk) {
    const r2 = await exec('gh auth status 2>&1; echo DONE', 'a-' + Date.now())
    if (r2.sent) { const o2 = await poll(r2.outputPath, 10000); authOk = o2 && o2.includes('Logged in') }
  }
  log('info', 'gh:' + (ghOk?'✓':'✗') + ' 登录:' + (authOk?'✓':'✗'))
  if (ghOk && authOk) startNotiPoll()
  renderEnv()
}

function renderEnv() {
  const el = document.getElementById('env-card')
  if (!el) return
  const row = (ic, cls, tx, sub) => '<div class="env-row"><div class="env-icon ' + cls + '">' + ic + '</div><div><div class="env-text">' + tx + '</div><div class="env-sub">' + sub + '</div></div></div>'
  el.innerHTML =
    row(txOk?'✓':'✗', txOk?'ok':'err', 'Termux', txOk?'已安装':'未安装') +
    row(stOk?'✓':'✗', stOk?'ok':'err', '存储权限', stOk?'已获取':'未获取') +
    row(ghOk?'✓':'✗', ghOk?'ok':'err', 'GitHub CLI', ghOk?'已安装':'未安装') +
    row(authOk?'✓':'✗', authOk?'ok':'err', 'GitHub 账户', authOk?'已登录':'未登录')
}

async function detectEnv() {
  toast('检测中…', 'ok')
  txOk = isNative ? await checkTermux() : false
  if (txOk) { stOk = await requestStoragePermission(); await testConn() }
  else { renderEnv(); toast('请先安装 Termux', 'er') }
}

const MODALS = {
  repo:{t:'新建仓库',b:'创建',f:[{id:'name',l:'仓库名称 *',p:'my-project',ty:'input'},{id:'desc',l:'描述',p:'描述…',ty:'textarea'},{id:'vis',l:'可见性',ty:'select',o:[['public','公开'],['private','私有']]}],c:d=>'gh repo create '+d.name+' --'+d.vis+(d.desc?' --description "'+d.desc+'"':''),w:false},
  issue:{t:'提交问题',b:'提交',f:[{id:'repo',l:'仓库 *',p:'user/repo',ty:'input'},{id:'title',l:'标题 *',p:'问题…',ty:'input'},{id:'body',l:'描述',p:'详细…',ty:'textarea'}],c:d=>'gh issue create --repo '+d.repo+' --title "'+d.title+'"'+(d.body?' --body "'+d.body+'"':''),w:false},
  gist:{t:'代码片段',b:'创建',f:[{id:'file',l:'文件名 *',p:'a.js',ty:'input'},{id:'code',l:'代码 *',p:'hi',ty:'textarea'},{id:'vis',l:'可见性',ty:'select',o:[['public','公开'],['secret','私有']]}],c:d=>'gh gist create - --'+d.vis+' --filename '+d.file+" << 'EOF'\n"+d.code+'\nEOF',w:false},
  clone:{t:'克隆仓库',b:'克隆',f:[{id:'url',l:'地址 *',p:'https://...',ty:'input'},{id:'dir',l:'目录',p:'可选',ty:'input'}],c:d=>'mkdir -p ~/projects && cd ~/projects && git clone '+d.url+(d.dir?' '+d.dir:''),w:false},
  pr:{t:'发起 PR',b:'创建',f:[{id:'repo',l:'仓库 *',p:'user/repo',ty:'input'},{id:'title',l:'标题 *',p:'PR…',ty:'input'},{id:'body',l:'描述',p:'…',ty:'textarea'},{id:'base',l:'分支',p:'main',ty:'input'}],c:d=>'gh pr create --repo '+d.repo+' --title "'+d.title+'"'+(d.body?' --body "'+d.body+'"':'')+(d.base?' --base '+d.base:''),w:false},
  push:{t:'推送代码',b:'推送',f:[{id:'dir',l:'仓库路径 *',p:'~/projects/xx',ty:'input'},{id:'msg',l:'提交信息 *',p:'feat: …',ty:'input'},{id:'branch',l:'分支',p:'可选',ty:'input'}],c:d=>'cd '+d.dir+' && git add -A && git commit -m "'+d.msg+'"'+(d.branch?' && git push origin '+d.branch:' && git push'),w:false},
}

function openModal(type) {
  const m = MODALS[type]; if (!m) return
  const bd = document.getElementById('mbd')
  bd.innerHTML = '<h2>' + m.t + '</h2><p>终端直接执行</p>' +
    m.f.map(f => {
      if (f.ty === 'input') return '<div class="fd"><label>' + f.l + '</label><input id="mf-' + f.id + '" placeholder="' + (f.p||'') + '"></div>'
      if (f.ty === 'textarea') return '<div class="fd"><label>' + f.l + '</label><textarea id="mf-' + f.id + '" placeholder="' + (f.p||'') + '"></textarea></div>'
      if (f.ty === 'select') return '<div class="fd"><label>' + f.l + '</label><select id="mf-' + f.id + '">' + f.o.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select></div>'
      return ''
    }).join('') +
    '<div class="cmd-preview" id="cmd-preview">填写后预览</div>' +
    '<div class="m-acts"><button class="btn btn-g" onclick="window._closeModal()">取消</button><button class="btn btn-s" onclick="window._doAction(\'' + type + '\')">' + m.b + '</button></div>'
  m.f.forEach(f => {
    const inp = document.getElementById('mf-' + f.id)
    if (inp) inp.oninput = () => {
      try {
        const data = Object.fromEntries(m.f.map(ff => [ff.id, (document.getElementById('mf-' + ff.id) || {value:''}).value.trim()]))
        document.getElementById('cmd-preview').textContent = '$ ' + m.c(data)
      } catch {}
    }
  })
  document.getElementById('mbg').classList.add('on')
}

function closeModal() { document.getElementById('mbg').classList.remove('on') }

async function doAction(type) {
  const m = MODALS[type]; const data = {}
  m.f.forEach(f => { const el = document.getElementById('mf-' + f.id); data[f.id] = el ? el.value.trim() : '' })
  for (const f of m.f) { if (f.l.includes('*') && !data[f.id]) { toast('请填写' + f.l.replace(' *',''), 'er'); return } }
  const cmd = m.c(data); closeModal(); log('cmd', '$ ' + cmd)
  const r = await exec(cmd, type + '-' + Date.now())
  if (!r.sent) { log('err', '发送失败'); toast('失败', 'er'); return }
  log('ok', '✓ 已发送'); toast('已发送', 'ok')
}

function log(type, text) { T.push({ type, text }); if (T.length > 200) T.splice(0, 50); renderTerm() }
function renderTerm() {
  const el = document.getElementById('tb'); if (!el) return
  el.innerHTML = T.map(t => {
    const c = { cmd:'cm', ok:'ok', err:'er', info:'nf', out:'ot' }[t.type] || 'ot'
    const pr = t.type === 'cmd' ? '<span class="pr">❯</span> ' : ''
    return '<div class="tl">' + pr + '<span class="' + c + '">' + esc(t.text) + '</span></div>'
  }).join('')
  el.scrollTop = el.scrollHeight
}
function clearTerm() { T.length = 0; renderTerm() }

function toast(msg, type) {
  type = type || 'ok'
  const el = document.getElementById('toast')
  el.className = 'toast ' + type + ' show'
  el.innerHTML = '<span>' + (type === 'ok' ? '✓' : '✗') + '</span> ' + esc(msg)
  clearTimeout(window._tt)
  window._tt = setTimeout(() => el.classList.remove('show'), 3000)
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' }) : '-' }
function timeAgo(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + '分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '小时前'
  return Math.floor(h / 24) + '天前'
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML }

window._openModal = openModal
window._closeModal = closeModal
window._doAction = doAction
window._clearTerm = clearTerm
window._detectEnv = detectEnv
window._testConn = testConn
window._showDetail = showDetail
window._doSearch = doSearch
window._doClone = doClone
window._goHome = goHome
window._goBack = goBack
window._markAllRead = markAllRead
window._refreshNoti = refreshNoti
window._openNoti = openNoti
