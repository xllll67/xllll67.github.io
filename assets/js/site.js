function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

fetch('./data.json')
  .then(r => {
    if (!r.ok) throw new Error('data.json ' + r.status);
    return r.json();
  })
  .then(d => {
    document.getElementById('name').textContent = d.site.name;
    document.getElementById('title').textContent = d.site.title;
    document.getElementById('intro').textContent = d.site.intro;
    document.getElementById('loc').textContent = d.site.location || '';
    document.title = `${d.site.name} · ${d.site.tagline}`;

    const links = Array.isArray(d.site.links) && d.site.links.length
      ? d.site.links
      : (d.site.github ? [{ name: 'GitHub', url: d.site.github }] : []);

    document.getElementById('meta').innerHTML =
      (d.site.email ? `<a href="mailto:${esc(d.site.email)}">${esc(d.site.email)}</a>` : '') +
      links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join('');

    document.getElementById('projects').innerHTML = d.projects.map(p => `
      <article class="proj">
        <h3>${esc(p.name)}</h3>
        <span class="year">${esc(p.year)}</span>
        <p class="role">${esc(p.role)}</p>
        <p class="body">${esc(p.desc)}</p>
        <div class="tags">${(p.stack || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
        ${p.link ? `<a class="more" href="${esc(p.link)}" target="_blank" rel="noopener">查看项目 →</a>` : ''}
      </article>`).join('');

    document.getElementById('skills').innerHTML = d.skills.map(g => `
      <div class="skill-group">
        <h3>${esc(g.group)}</h3>
        <ul>${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>`).join('');

    document.getElementById('experience').innerHTML = d.experience.map(e => `
      <li>
        <p class="period">${esc(e.period)}</p>
        <h3>${esc(e.company)}</h3>
        <p class="role">${esc(e.role)}</p>
        <p class="body">${esc(e.desc)}</p>
      </li>`).join('');

    document.getElementById('posts').innerHTML = d.posts.map(p => {
      const inner = `
        <p class="date">${esc(p.date)}</p>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>`;
      return p.url
        ? `<a class="post" href="${esc(p.url)}" target="_blank" rel="noopener">${inner}</a>`
        : `<div class="post">${inner}</div>`;
    }).join('');

    document.getElementById('footer').innerHTML =
      `${esc(d.site.name)} · <a href="./index.html">房间版</a>`;
  })
  .catch(err => {
    document.querySelector('main').innerHTML =
      `<p style="padding:60px 0;color:#6e655a">内容加载失败：${esc(err.message)}。请通过本地服务器打开，并确认 data.json 存在。</p>`;
  });
