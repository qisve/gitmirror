import { isNative, checkTermux, requestStoragePermission, exec, poll, readOutput } from './termux.js'

const S = {
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  alert:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  code:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  dl:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  send:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  git:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>`,
  folder:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
}

let pg = 'home'
const T = []
let repos = []
let txOk = false, stOk = false, ghOk = false, authOk = false

export async function init() {
  document.getElementById('app').innerHTML = shell()
  bindNav()
  nav('home')
  renderTerm()
  log('info', 'App 已启动, isNative=' + isNative)
  if (isNative) {
    txOk = await checkTermux()
    log('info', 'Termux: ' + (txOk ? '✓' : '✗'))
    if (txOk) {
      stOk = await requestStoragePermission()
      log('info', '存储权限: ' + (stOk ? '✓' : '✗'))
    }
  } else {
    log('info', '[浏览器模式] 需要 Android 设备')
  }
  renderEnv()
}

function shell() {
  return `<div class="bg-g bg-g1"></div><div class="bg-g bg-g2"></div>
  <header><div class="hdr">
    <div class="logo"><div class="logo-i">G</div><div class="logo-t">GitMirror</div></div>
    <nav id="nav">
      <button class="nb on" data-p="home">首页</button>
      <button class="nb" data-p="repos">仓库</button>
      <button class="nb" data-p="set">设置</button>
    </nav>
  </div></header>
  <main>
    <div class="pg on" id="pg-home"></div>
    <div class="pg" id="pg-repos"></div>
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
  const el = document.getElementById(`pg-${p}`)
  if (el) el.classList.add('on')
  const btn = document.querySelector(`.nb[data-p="${p}"]`)
  if (btn) btn.classList.add('on')
  if (p === 'home') renderHome()
  if (p === 'repos') loadRepos()
  if (p === 'set') renderSettings()
}

function renderHome() {
  document.getElementById('pg-home').innerHTML = `
    <div class="stats">
      <div class="st"><div class="st-l">仓库</div><div class="st-v b" id="sr">--</div></div>
      <div class="st"><div class="st-l">星标</div><div class="st-v g" id="ss">--</div></div>
      <div class="st"><div class="st-l">关注者</div><div class="st-v w" id="sf">--</div></div>
      <div class="st"><div class="st-l">问题</div><div class="st-v r" id="si">--</div></div>
    </div>
    <div class="sect"><span class="dot"></span>快捷操作</div>
    <div class="act-grid">
      <div class="act" onclick="window._openModal('repo')"><div class="ai b">${S.plus}</div><div class="an">新建仓库</div><div class="ad">创建代码仓库</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('issue')"><div class="ai r">${S.alert}</div><div class="an">提交问题</div><div class="ad">报告 Bug 或建议</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('clone')"><div class="ai g">${S.dl}</div><div class="an">克隆仓库</div><div class="ad">克隆到本地</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('gist')"><div class="ai p">${S.code}</div><div class="an">代码片段</div><div class="ad">创建 Gist</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('pr')"><div class="ai b">${S.git}</div><div class="an">发起 PR</div><div class="ad">创建拉取请求</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
      <div class="act" onclick="window._openModal('push')"><div class="ai g">${S.send}</div><div class="an">推送代码</div><div class="ad">提交并推送</div><div class="af"><span class="ok-dot"></span>终端执行</div></div>
    </div>
    <div class="sect"><span class="dot"></span>终端输出</div>
    <div class="term"><div class="term-bar"><div class="dots"><span></span><span></span><span></span></div><span class="term-t">Terminal</span><button class="term-clr" onclick="window._clearTerm()">清空</button></div><div class="term-body" id="tb"></div></div>
    <div class="sect"><span class="dot"></span>最近仓库</div>
    <div id="hr" class="repo-wrap"><div class="empty-hint">暂无数据</div></div>`
  renderTerm()
}

function loadRepos() {
  document.getElementById('pg-repos').innerHTML = `<div class="sect"><span class="dot"></span>我的仓库</div><div class="repo-wrap" id="rl-full"><div class="empty-hint">加载中…</div></div>`
  doLoadRepos()
}

async function doLoadRepos() {
  const cmd = 'gh repo list --limit 30 --json name,description,stargazerCount,forkCount,primaryLanguage,updatedAt,isPrivate'
  log('cmd', cmd)
  const r = await exec(cmd, 'repos')
  if (!r.sent) { log('err', '发送失败: ' + (r.error || '')); renderRepoList('rl-full', []); return }
  log('ok', '✓ 已发送, 等待回读…')
  const out = await poll(r.outputPath, 30000)
  if (out === null) { log('err', '回读超时'); renderRepoList('rl-full', []); return }
  try {
    repos = JSON.parse(out.trim())
    log('ok', '获取到 ' + repos.length + ' 个仓库')
    renderRepoList('rl-full', repos)
    renderRepoList('hr', repos.slice(0, 5))
    updateStats()
  } catch { log('err', 'JSON解析失败: ' + out.slice(0, 100)); renderRepoList('rl-full', []) }
}

const LANG_CLR = { JavaScript:'#f1e05a',TypeScript:'#3178c6',Python:'#3572A5',Rust:'#dea584',Go:'#00ADD8',Java:'#b07219','C++':'#f34b7d',HTML:'#e34c26',CSS:'#563d7c',Shell:'#89e051',Vue:'#41b883' }

function renderRepoList(id, list) {
  const el = document.getElementById(id)
  if (!el) return
  if (!list.length) { el.innerHTML = '<div class="empty-hint">暂无数据</div>'; return }
  el.innerHTML = list.map((r, i) => {
    const lc = LANG_CLR[r.primaryLanguage?.name || ''] || '#6b7394'
    const lang = r.primaryLanguage?.name || ''
    return `<div class="ri" style="animation-delay:${i*0.04}s" onclick="window.open('https://github.com/'+${JSON.stringify(r.name)},'_blank')"><div class="ri-info"><div class="ri-name">${S.folder} ${esc(r.name)}</div><div class="ri-desc">${esc(r.description||'暂无描述')}</div><div class="ri-meta">${lang?`<span><span class="ld" style="background:${lc}"></span>${esc(lang)}</span>`:''}<span>⭐ ${r.stargazerCount||0}</span><span>🔀 ${r.forkCount||0}</span>${r.isPrivate?'<span>🔒</span>':''}</div></div><div class="ri-go">→</div></div>`
  }).join('')
}

function updateStats() {
  const el = id => document.getElementById(id)
  el('sr').textContent = repos.length
  el('ss').textContent = repos.reduce((s, r) => s + (r.stargazerCount || 0), 0)
}

function renderSettings() {
  document.getElementById('pg-set').innerHTML = `
    <div class="sect"><span class="dot"></span>环境检测</div>
    <div class="set-card" id="env-card"></div>
    <div class="set-card" style="text-align:center">
      <h3>连接测试</h3>
      <p>点击下方按钮，测试 App → Termux 通信是否正常</p>
      <button class="btn btn-p" onclick="window._testConn()" style="margin-top:8px">测试连接</button>
    </div>
    <div class="set-card"><h3>安装指南</h3><p>
      <b>第一步：</b>安装 Termux（F-Droid）<br>
      <b>第二步：</b><code>pkg update && pkg install gh git</code><br>
      <b>第三步：</b><code>gh auth login</code><br>
      <b>第四步：</b><code>termux-setup-storage</code>
    </p></div>
    <div class="set-card"><h3>手动检测</h3><p>完成上述步骤后点击重新检测</p><button class="btn btn-p" onclick="window._detectEnv()">重新检测</button></div>`
  renderEnv()
}

async function testConn() {
  log('info', '=== 连接测试开始 ===')
  log('info', 'isNative=' + isNative + ', txOk=' + txOk + ', stOk=' + stOk)

  // Step 1: send simple echo
  log('info', '[步骤1] 发送 echo TEST_CONN')
  const r = await exec('echo TEST_CONN_OK', 'test-' + Date.now())
  log('info', 'exec 返回: sent=' + r.sent + ', path=' + (r.outputPath||'null') + ', err=' + (r.error||'无'))

  if (!r.sent) {
    log('err', '❌ 命令未发送成功，Intent 到 Termux 失败')
    log('info', '请确认: 1) 已安装新 APK 2) Termux 在后台运行')
    return
  }

  // Step 2: wait and poll
  log('info', '[步骤2] 等待回读文件: ' + r.outputPath)
  for (let i = 0; i < 15; i++) {
    await new Promise(ok => setTimeout(ok, 1000))
    const rr = await readOutput(r.outputPath)
    log('info', '  轮询#' + (i+1) + ': ready=' + rr.ready + ', content=[' + (rr.content||'').trim().slice(0,60) + '], err=' + (rr.error||'无'))

    if (rr.ready) {
      if (rr.content.includes('TEST_CONN_OK')) {
        log('ok', '✅ 通信完全正常！')
        await detectGh()
      } else {
        log('err', '❌ 文件有内容但不对: ' + rr.content.slice(0, 100))
      }
      renderEnv()
      log('info', '=== 测试完成 ===')
      return
    }
  }

  log('err', '❌ 超时 — 文件从未出现')
  log('info', '可能原因:')
  log('info', '  1. Termux 未响应 Intent (需要重新打开 Termux)')
  log('info', '  2. 输出文件路径无法写入')
  log('info', '  3. 请在 Termux 手动运行: ls -la /sdcard/GitMirror/out/')
  log('info', '=== 测试完成 ===')
}

async function detectGh() {
  log('info', '[检测] gh CLI…')
  const r1 = await exec('command -v gh && echo GH_OK', 'chk-gh-' + Date.now())
  if (r1.sent) {
    const o1 = await poll(r1.outputPath, 15000)
    log('info', '[检测] gh 结果: [' + ((o1||'').trim().slice(0,80)) + ']')
    ghOk = o1 && o1.includes('GH_OK')
  }
  if (ghOk) {
    log('info', '[检测] gh auth…')
    const r2 = await exec('gh auth status 2>&1; echo DONE', 'chk-auth-' + Date.now())
    if (r2.sent) {
      const o2 = await poll(r2.outputPath, 15000)
      log('info', '[检测] auth 结果: [' + ((o2||'').trim().slice(0,80)) + ']')
      authOk = o2 && o2.includes('Logged in')
    }
  }
  renderEnv()
}

function renderEnv() {
  const el = document.getElementById('env-card')
  if (!el) return
  const row = (ic, cls, tx, sub) => `<div class="env-row"><div class="env-icon ${cls}">${ic}</div><div><div class="env-text">${tx}</div><div class="env-sub">${sub}</div></div></div>`
  el.innerHTML =
    row(txOk?'✓':'✗', txOk?'ok':'err', 'Termux', txOk?'已安装':'未安装') +
    row(stOk?'✓':'✗', stOk?'ok':'err', '存储权限', stOk?'已获取':'未获取') +
    row(ghOk?'✓':'✗', ghOk?'ok':'err', 'GitHub CLI', ghOk?'已安装':'未安装') +
    row(authOk?'✓':'✗', authOk?'ok':'err', 'GitHub 账户', authOk?'已登录':'未登录')
}

const MODALS = {
  repo:{title:'新建仓库',btn:'创建',fields:[{id:'name',label:'仓库名称 *',ph:'my-project',type:'input'},{id:'desc',label:'描述',ph:'描述…',type:'textarea'},{id:'vis',label:'可见性',type:'select',opts:[['public','公开'],['private','私有']]}],cmd:d=>`gh repo create ${d.name} --${d.vis}${d.desc?` --description "${d.desc}"`:''}`,wait:false},
  issue:{title:'提交问题',btn:'提交',fields:[{id:'repo',label:'仓库 *',ph:'user/repo',type:'input'},{id:'title',label:'标题 *',ph:'问题…',type:'input'},{id:'body',label:'描述',ph:'详细…',type:'textarea'}],cmd:d=>`gh issue create --repo ${d.repo} --title "${d.title}"${d.body?` --body "${d.body}"`:''}`,wait:false},
  gist:{title:'代码片段',btn:'创建',fields:[{id:'file',label:'文件名 *',ph:'a.js',type:'input'},{id:'code',label:'代码 *',ph:'hi',type:'textarea'},{id:'vis',label:'可见性',type:'select',opts:[['public','公开'],['secret','私有']]}],cmd:d=>`gh gist create - --${d.vis} --filename ${d.file} << 'EOF'\n${d.code}\nEOF`,wait:false},
  clone:{title:'克隆仓库',btn:'克隆',fields:[{id:'url',label:'地址 *',ph:'https://...',type:'input'},{id:'dir',label:'目录',ph:'可选',type:'input'}],cmd:d=>`mkdir -p ~/projects && cd ~/projects && git clone ${d.url}${d.dir?' '+d.dir:''}`,wait:false},
  pr:{title:'发起 PR',btn:'创建',fields:[{id:'repo',label:'仓库 *',ph:'user/repo',type:'input'},{id:'title',label:'标题 *',ph:'PR…',type:'input'},{id:'body',label:'描述',ph:'…',type:'textarea'},{id:'base',label:'分支',ph:'main',type:'input'}],cmd:d=>`gh pr create --repo ${d.repo} --title "${d.title}"${d.body?` --body "${d.body}"`:''}${d.base?` --base ${d.base}`:''}`,wait:false},
  push:{title:'推送代码',btn:'推送',fields:[{id:'dir',label:'仓库路径 *',ph:'~/projects/xx',type:'input'},{id:'msg',label:'提交信息 *',ph:'feat: …',type:'input'},{id:'branch',label:'分支',ph:'可选',type:'input'}],cmd:d=>`cd ${d.dir} && git add -A && git commit -m "${d.msg}"${d.branch?` && git push origin ${d.branch}`:' && git push'}`,wait:false},
  search:{title:'搜索仓库',btn:'搜索',fields:[{id:'q',label:'关键词 *',ph:'react…',type:'input'},{id:'lang',label:'语言',type:'select',opts:[['','全部'],['javascript','JS'],['python','Py'],['rust','Rust'],['go','Go']]}],cmd:d=>`gh search repos "${d.q}"${d.lang?` --language ${d.lang}`:''} --limit 10 --json name,description,stargazerCount`,wait:true},
}

function openModal(type) {
  const m = MODALS[type]; if (!m) return
  const bd = document.getElementById('mbd')
  bd.innerHTML = `<h2>${m.title}</h2><p>终端直接执行</p>` +
    m.fields.map(f => {
      if(f.type==='input') return `<div class="fd"><label>${f.label}</label><input id="mf-${f.id}" placeholder="${f.ph||''}"></div>`
      if(f.type==='textarea') return `<div class="fd"><label>${f.label}</label><textarea id="mf-${f.id}" placeholder="${f.ph||''}"></textarea></div>`
      if(f.type==='select') return `<div class="fd"><label>${f.label}</label><select id="mf-${f.id}">${f.opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div>`
      return ''
    }).join('') +
    `<div class="cmd-preview" id="cmd-preview">填写表单后预览</div><div class="m-acts"><button class="btn btn-g" onclick="window._closeModal()">取消</button><button class="btn btn-s" onclick="window._doAction('${type}')">${m.btn}</button></div>`
  m.fields.forEach(f=>{const inp=document.getElementById(`mf-${f.id}`);if(inp)inp.oninput=()=>{try{document.getElementById('cmd-preview').textContent='$ '+m.cmd(Object.fromEntries(m.fields.map(ff=>[ff.id,(document.getElementById(`mf-${ff.id}`)||{value:''}).value.trim()])))}catch{}}})
  document.getElementById('mbg').classList.add('on')
}

function closeModal() { document.getElementById('mbg').classList.remove('on') }

async function doAction(type) {
  const m = MODALS[type]
  const data = {}
  m.fields.forEach(f => { const el = document.getElementById(`mf-${f.id}`); data[f.id] = el ? el.value.trim() : '' })
  for (const f of m.fields) { if (f.label.includes('*') && !data[f.id]) { toast('请填写'+f.label.replace(' *',''),'er'); return } }
  const cmd = m.cmd(data); closeModal()
  log('cmd', '$ ' + cmd)
  const r = await exec(cmd, type+'-'+Date.now())
  if (!r.sent) { log('err','发送失败: '+r.error); toast('失败','er'); return }
  log('ok','✓ 已发送'); toast('已发送','ok')
  if (m.wait) {
    log('info','等待结果…')
    const out = await poll(r.outputPath, 25000)
    if (out) { log('out',out.trim()); try{const items=JSON.parse(out.trim());log('ok','找到 '+items.length+' 个')}catch{} }
    else log('err','超时')
  }
}

async function detectEnv() {
  toast('检测中…','ok')
  txOk = isNative ? await checkTermux() : false
  if (txOk) { stOk = await requestStoragePermission(); await testConn() }
  else { renderEnv(); toast('请先安装 Termux','er') }
}

function log(type, text) { T.push({ type, text }); renderTerm() }
function renderTerm() {
  const el = document.getElementById('tb'); if (!el) return
  el.innerHTML = T.map(t=>{const c={cmd:'cm',ok:'ok',err:'er',info:'nf',out:'ot'}[t.type]||'ot';const pr=t.type==='cmd'?'<span class="pr">❯</span> ':'';return `<div class="tl">${pr}<span class="${c}">${esc(t.text)}</span></div>`}).join('')
  el.scrollTop = el.scrollHeight
}
function clearTerm() { T.length=0; renderTerm() }

function toast(msg,type='ok') {
  const el=document.getElementById('toast');el.className='toast '+type+' show';el.innerHTML=`<span>${type==='ok'?'✓':'✗'}</span> ${esc(msg)}`;clearTimeout(window._tt);window._tt=setTimeout(()=>el.classList.remove('show'),3000)
}

function esc(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML }

window._openModal = openModal
window._closeModal = closeModal
window._doAction = doAction
window._clearTerm = clearTerm
window._detectEnv = detectEnv
window._testConn = testConn
