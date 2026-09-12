const territories = [
  {
    id: 'aperture', name: 'Aperture', tag: 'A / Possibility through structure',
    ink: '#2138a5', ground: '#eef0ff', accent: '#dfed79', reverse: '#f2f3ff', face: 'Arial, Helvetica, sans-serif', weight: 600,
    mark: '<path fill="currentColor" d="M10 8h76v80H58V32H44v18H34v38H10z"/>',
    idea: 'An opening, not a destination. A bold structural frame makes the space inside it the most important part of the mark: room to become more.',
    line: 'Make room for what comes next.',
    type: 'A calm, open grotesk wordmark paired with a separate aperture symbol. Broad counters and a deliberately compact VE hold personal warmth and platform authority. The V/E metaphor is spatial rather than a literal monogram. Prototype: Arial; custom optical spacing comes later.',
    system: 'Nested thresholds become image crops, content frames and spatial transitions. Deep ultramarine provides authority; a clear citron focal point represents the person within the structure. Organisation branding lives inside a stable frame.',
    risk: 'A doorway alone could read as architecture or real estate. The stepped opening and proportions need distinctive refinement. Avoid turning every card into an arch or making the scene feel monumental and impersonal.',
    scene: 'Three offset frames reveal a persistent place at their centre. Scale changes around the person; the entry controls remain still.',
    title: 'Make room for what’s next.', description: 'Build your capability through learning and practice. Give your people a place to do the same.', orgTitle: 'Make room for your people.', orgDescription: 'Create a shared place for lessons, practice and progress. Everyone keeps a place of their own.'
  },
  {
    id: 'continuum', name: 'Continuum', tag: 'B / Progress as a continuous act',
    ink: '#ae2c23', ground: '#f7ede6', accent: '#edbde3', reverse: '#fff4e9', face: 'Arial, Helvetica, sans-serif', weight: 800,
    mark: '<path fill="currentColor" d="M5 12h23l18 48 17-48h28L80 35H71L53 87H34z"/><path fill="currentColor" d="M61 46h19l-7 18H55z"/>',
    idea: 'Learning becomes action, then a new beginning. One folded strip joins a V-shaped descent to a rising, open-ended path.',
    line: 'Keep becoming.',
    type: 'A compact, confident grotesk with a continuous V-led symbol. The offset middle bar hints at E without forcing a complete rebus. The wordmark is heavier and more urgent than Aperture. Prototype: Arial Bold; a narrow grotesk is the refinement direction.',
    system: 'Folded bands link lesson, practice and progress. Strong diagonals frame photographs and short messages. Vermilion with a pale rose counterpoint brings energy; motion follows a visible path and settles decisively.',
    risk: 'The rising diagonal can resemble a sports or investment brand. The fold needs optical simplification at 16px. Repeating diagonal movement across authentication would feel restless, so forms use quiet rectangular structure.',
    scene: 'A folded path changes scale across three planes. One rose segment keeps its identity as the individual path joins a larger route.',
    title: 'Learn. Try. Become.', description: 'Turn what you learn into what you can do. Build momentum for yourself and your people.', orgTitle: 'Move forward, together.', orgDescription: 'Give your people a shared path from learning to practice, with room for each person to progress.'
  },
  {
    id: 'assembly', name: 'Assembly', tag: 'C / Individual parts, collective capability',
    ink: '#16483d', ground: '#e9efe7', accent: '#f3ad64', reverse: '#eef5e9', face: 'Trebuchet MS, Arial, sans-serif', weight: 600,
    mark: '<path fill="currentColor" d="M8 8h32v24H8zM48 8h40v32H64V32H48zM8 40h24v24h16v24H8zM40 40h16v16h32v32H56V64H40z"/>',
    idea: 'Capability grows through things that fit together. Unequal, interlocking parts leave room for both an individual contribution and a collective whole.',
    line: 'A place for every possibility.',
    type: 'A humanist wordmark with open shapes and a modular symbol that does not force V or E. Unequal modules avoid the symmetry of a generic four-petal mark. Prototype: Trebuchet MS; refine for a warmer, less software-default rhythm.',
    system: 'Modules set the layout grammar for lessons, programme groupings and shared workspaces. Deep mineral green and apricot feel grounded and welcoming. Parts can combine without erasing each organisation’s own identity.',
    risk: 'Modularity can become generic construction or collaboration software. The specific unequal rhythm must remain consistent. Avoid tile overload in the product and do not copy the current theme merely because one colour is green.',
    scene: 'Three assemblies separate in depth. A warm unit remains visible as a personal learning structure becomes a shared programme.',
    title: 'Build what you can become.', description: 'A place to learn, put ideas into practice and grow. For one person or a whole organisation.', orgTitle: 'Build capability together.', orgDescription: 'Bring your lessons, people and practice into one shared structure. Make space for individual growth.'
  },
  {
    id: 'cadence', name: 'Cadence', tag: 'D / A human voice with a precise signature',
    ink: '#292324', ground: '#f3e9ed', accent: '#df9aae', reverse: '#f9edf2', face: 'Georgia, Times New Roman, serif', weight: 400,
    mark: '<path fill="currentColor" d="M4 13h19l13 51 17-51h39l-5 15H66l-6 15h22l-5 14H55l-6 17h26l-5 15H34z"/>',
    idea: 'The name carries the personality. A forward-moving typographic signature makes the platform feel authored, human and confident.',
    line: 'Become more yourself.',
    type: 'An expressive italic serif wordmark with a custom compact VE ligature. The mark and wordmark share a forward lean but are not interchangeable type. Plain sans-serif UI text preserves clarity. Prototype: Georgia; final lettering must be drawn and spaced deliberately.',
    system: 'Overscale letter crops, editorial margins and alternating type rhythm establish the visual language. Charcoal and dusty rose create an unmistakably human tone. In the product, expressive display type stays out of forms and dense data.',
    risk: 'Could suggest a publication, beauty or cultural brand rather than capability infrastructure. The compact ligature may read as a single letter at small sizes. Institutional co-branding needs restraint and final optical-size versions.',
    scene: 'A letterform becomes a spatial surface. Independent typographic planes reveal a rose accent, then return to a quiet signature beside the form.',
    title: 'More is possible.', description: 'Make space for curiosity, practice and progress. Build capability in a way that feels like you.', orgTitle: 'More, with your people.', orgDescription: 'Give your organisation a place to learn and grow, with a voice and purpose of its own.'
  }
];

const byId = (id) => document.getElementById(id);
let current = territories[0];
let audience = 'self';
const symbol = (territory, size) => `<svg viewBox="0 0 96 96" width="${size || 96}" height="${size || 96}" aria-hidden="true" focusable="false">${territory.mark}</svg>`;
const lockup = (territory) => `${symbol(territory)}<span>Project VE</span>`;

byId('territories').innerHTML = territories.map((t, index) => `<button type="button" class="territory" data-territory="${t.id}" aria-pressed="${index === 0}"><span class="territory-art" style="background:${t.ground};color:${t.ink}">${symbol(t)}</span><span class="territory-label"><span>${String.fromCharCode(65 + index)}</span><b>${t.name}</b></span></button>`).join('');

function updateAudience() {
  byId('welcome-title').textContent = audience === 'org' ? current.orgTitle : current.title;
  byId('welcome-description').textContent = audience === 'org' ? current.orgDescription : current.description;
  byId('scene').classList.toggle('org-scene', audience === 'org');
  document.querySelectorAll('[data-audience]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.audience === audience)));
}

function showWelcome() {
  byId('welcome-content').hidden = false;
  byId('auth-preview').hidden = true;
}

function selectTerritory(id) {
  current = territories.find((territory) => territory.id === id) || territories[0];
  const root = byId('selected');
  root.className = `selected ${current.id}`;
  for (const key of ['ground', 'ink', 'accent', 'reverse', 'face', 'weight']) root.style.setProperty(`--${key}`, current[key]);
  byId('territory-tag').textContent = current.tag;
  byId('territory-title').textContent = current.name;
  byId('idea').textContent = current.idea;
  byId('brand-line').textContent = current.line;
  for (const key of ['type', 'system', 'risk']) byId(key).textContent = current[key];
  byId('scene-principle').textContent = current.scene;
  byId('light-lockup').innerHTML = lockup(current);
  byId('dark-lockup').innerHTML = lockup(current);
  byId('preview-brand').innerHTML = lockup(current);
  byId('app-icon').innerHTML = symbol(current);
  byId('auth-mark').innerHTML = symbol(current);
  byId('favicons').innerHTML = [16, 24, 32].map((size) => `<div>${symbol(current, size)}<small>${size}px</small></div>`).join('');
  byId('monochrome').innerHTML = `<div>${symbol(current)}</div><div>${symbol(current)}</div>`;
  byId('palette').innerHTML = ['ink', 'ground', 'accent'].map((key) => `<div><i style="background:${current[key]}"></i><small>${current[key].toUpperCase()}</small></div>`).join('');
  document.querySelectorAll('[data-territory]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.territory === id)));
  showWelcome();
  updateAudience();
}

function showEntry(kind) {
  byId('auth-mark').innerHTML = symbol(current);
  byId('welcome-content').hidden = true;
  byId('auth-preview').hidden = false;
  const org = kind === 'org';
  const invite = kind === 'invite';
  byId('auth-title').textContent = kind === 'login' ? 'Welcome back.' : org ? 'Start with your account.' : 'Make your first move.';
  byId('auth-description').textContent = kind === 'login' ? 'Sign in to continue to your destination.' : org ? 'Create your account, then set up your organisation.' : 'Create an account to begin learning.';
  byId('context-label').textContent = org ? 'PROJECT VE / CREATE AN ORGANISATION' : 'PROJECT VE / YOUR ACCOUNT';
  byId('auth-context').textContent = org ? 'A place for your people.' : 'A place for what’s next.';
  byId('auth-submit').textContent = kind === 'login' ? 'Sign in' : 'Create account';
  if (invite) {
    byId('auth-mark').innerHTML = '<div class="organisation-monogram" aria-hidden="true">NC</div>';
    byId('auth-title').textContent = 'Continue to your invitation.';
    byId('auth-description').textContent = 'Sign in to review the invitation and the access it offers.';
    byId('context-label').textContent = 'NORTHSTAR COLLECTIVE / EXAMPLE ORGANISATION';
    byId('auth-context').textContent = 'Northstar Collective';
    byId('auth-submit').textContent = 'Sign in';
  }
  byId('back').focus({ preventScroll: true });
}

document.querySelectorAll('[data-territory]').forEach((button) => button.addEventListener('click', () => selectTerritory(button.dataset.territory)));
document.querySelectorAll('[data-audience]').forEach((button) => button.addEventListener('click', () => { audience = button.dataset.audience; updateAudience(); }));
document.querySelectorAll('[data-entry]').forEach((button) => button.addEventListener('click', () => showEntry(button.dataset.entry)));
byId('signin').addEventListener('click', () => showEntry('login'));
byId('invite-preview').addEventListener('click', () => { showEntry('invite'); byId('product-preview').scrollIntoView({block:'start'}); });
byId('back').addEventListener('click', () => { showWelcome(); byId('signin').focus({ preventScroll: true }); });
byId('depth').addEventListener('input', (event) => {
  const value = Number(event.target.value);
  byId('selected').style.setProperty('--depth', String(value / 100));
  byId('depth-value').textContent = `${value}%`;
});
selectTerritory('aperture');
