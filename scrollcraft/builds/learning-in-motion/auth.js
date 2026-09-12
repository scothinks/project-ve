(() => {
  const C = AuthCopy;
  const params = new URLSearchParams(location.search);
  const intent = ['rewards', 'organisation'].includes(params.get('intent')) ? params.get('intent') : 'learner';
  const org = intent === 'organisation';
  let mode = params.get('mode') === 'login' ? 'login' : 'signup';
  let email = '';
  let name = '';
  let priorForm = mode;
  let expiredFrom = 'confirm';
  const $ = id => document.getElementById(id);
  const xp = () => PreviewSession.read().xp;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (id, value) => { $(id).textContent = value; };
  const button = (label, action, quiet = false) => `<button class="button ${quiet ? 'button-quiet' : 'button-plum'}" type="button" data-action="${action}">${esc(label)}</button>`;
  function title(value, body, icon = '') { return `${icon ? `<div class="state-icon" aria-hidden="true">${icon}</div>` : ''}<h2 id="auth-title" tabindex="-1">${esc(value)}</h2><p class="auth-description">${esc(body)}</p>`; }
  const field = (id, label, type, placeholder, hint = '') => `<div class="auth-field"><label for="${id}">${esc(label)}</label><div class="${type === 'password' ? 'auth-password' : ''}"><input id="${id}" name="${id}" type="${type}" placeholder="${esc(placeholder)}" maxlength="${id === 'email' ? 254 : 120}" autocomplete="off" aria-describedby="error-${id}${hint ? ` hint-${id}` : ''}" ${id === 'email' ? `value="${esc(email)}"` : id === 'name' ? `value="${esc(name)}"` : ''}>${type === 'password' ? `<button type="button" data-action="show-password" aria-label="${esc(C.showPassword)}">${esc(C.show)}</button>` : ''}</div>${hint ? `<p class="auth-hint" id="hint-${id}">${esc(hint)}</p>` : ''}<p class="field-error" id="error-${id}"></p></div>`;
  function form(signup) {
    const heading = signup ? org ? C.signupOrgTitle : xp() ? C.signupXpTitle : C.signupTitle : C.loginTitle;
    const body = signup ? org ? C.signupOrgBody : xp() ? C.signupXpBody : C.signupBody : org ? C.loginOrgBody : xp() ? C.loginXpBody : C.loginBody;
    return title(heading, body) + `<form id="account-form" class="auth-form" novalidate>
      ${signup ? field('name', C.nameLabel, 'text', C.namePlaceholder) : ''}
      ${field('email', C.emailLabel, 'email', C.emailPlaceholder)}
      ${field('password', C.passwordLabel, 'password', C.passwordPlaceholder, signup ? C.passwordHelp : '')}
      ${signup ? `<label class="auth-consent"><input id="terms" type="checkbox" aria-describedby="error-terms"><span>${esc(C.termsLead)} <a href="http://localhost:3000/terms" target="_blank" rel="noopener">${esc(C.terms)}</a> ${esc(C.termsJoin)} <a href="http://localhost:3000/privacy" target="_blank" rel="noopener">${esc(C.privacyPolicy)}</a>.</span></label><p id="error-terms" class="field-error"></p>` : `<div class="auth-options"><label><input id="remember" type="checkbox">${esc(C.remember)}</label><button type="button" data-action="forgot">${esc(C.forgotLink)}</button></div>`}
      <div id="auth-message" class="auth-message" role="status" tabindex="-1"></div>
      <button type="submit" class="button button-plum">${esc(signup ? org ? C.signupOrgAction : xp() ? C.signupXpAction : C.signupAction : C.loginAction)}</button>
      <div class="auth-or">${esc(C.or)}</div><button type="button" class="auth-google" data-action="google"><span aria-hidden="true">G</span>${esc(signup ? C.googleSignup : C.googleLogin)}</button>
    </form>`;
  }
  function balance(label) { return `<div class="saved-balance"><span>${esc(label)}</span><strong>${xp()} XP</strong></div>`; }
  function message(value, error = false) {
    const el = $('auth-message');
    if (!el) return;
    el.classList.toggle('is-error', error); el.setAttribute('role', error ? 'alert' : 'status'); el.textContent = value; AuthMotion.fit(); el.focus();
  }
  function render(next, focus = true) {
    const transition = AuthMotion.capture(mode, next);
    mode = next;
    const isForm = mode === 'login' || mode === 'signup';
    $('auth-xp-carry').hidden = !xp() || !isForm; text('auth-xp-value', `${xp()} XP`);
    const panel = $('auth-switch-panel');
    panel.hidden = !isForm;
    document.querySelector('.auth-form-wrap').dataset.mode = isForm ? mode : 'state';
    for (const invitation of panel.querySelectorAll('.auth-invitation')) {
      const action = invitation.querySelector('button');
      const active = isForm && action.dataset.switch !== mode;
      invitation.inert = !active;
      invitation.setAttribute('aria-hidden', String(!active));
      action.removeAttribute('id'); action.removeAttribute('data-action');
      if (active) { action.id = 'switch-action'; action.dataset.action = action.dataset.switch; }
    }
    let markup = '';
    if (mode === 'signup' || mode === 'login') markup = form(mode === 'signup');
    if (mode === 'forgot' || mode === 'reset') markup = title(mode === 'forgot' ? C.forgotTitle : C.resetTitle, mode === 'forgot' ? C.forgotBody : C.resetBody) + `<form id="recovery-form" class="auth-form" novalidate>${mode === 'forgot' ? field('email',C.emailLabel,'email',C.emailPlaceholder) : field('password',C.newPasswordLabel,'password',C.newPasswordPlaceholder,C.passwordHelp)}<div id="auth-message" class="auth-message" role="status" tabindex="-1"></div><button class="button button-plum" type="submit">${esc(mode === 'forgot' ? C.forgotAction : C.resetAction)}</button><p class="auth-switch"><button type="button" data-action="login">${esc(C.backLogin)}</button></p></form>`;
    if (mode === 'confirm' || mode === 'reset-sent') markup = title(mode === 'confirm' ? C.confirmTitle : C.resetSentTitle, (mode === 'confirm' ? C.confirmBody : C.resetSentBody).replace('{email}', email || C.emailPlaceholder), '↗') + `<p class="state-help">${esc(mode === 'confirm' ? C.confirmHelp : C.resetSentHelp)}</p><div id="auth-message" class="auth-message" role="status" tabindex="-1"></div><div class="state-actions">${button(mode === 'confirm' ? C.confirmResend : C.resendReset,'resend',true)}${button(mode === 'confirm' ? C.changeEmail : C.backLogin,mode === 'confirm' ? 'signup' : 'login',true)}</div><button class="preview-advance" data-action="${mode === 'confirm' ? 'verified' : 'reset'}">${esc(mode === 'confirm' ? C.previewVerify : C.previewReset)}</button>`;
    if (mode === 'verified' || mode === 'reset-done') markup = title(mode === 'verified' ? C.verifiedTitle : C.resetDoneTitle, mode === 'verified' ? C.verifiedBody : C.resetDoneBody,'✓') + `<div class="state-actions">${button(mode === 'verified' ? C.verifiedAction : C.backLogin,'login')}</div>`;
    if (mode === 'expired') markup = title(C.expiredTitle,C.expiredBody,'↻') + `<div class="state-actions">${button(C.expiredAction,expiredFrom)}${button(C.backLogin,'login',true)}</div>`;
    if (mode === 'google') markup = title(C.googleTitle,C.googleBody,'G') + `<div class="state-actions">${button(C.googleReturn,priorForm,true)}</div><button class="preview-advance" data-action="complete-google">${esc(C.previewGoogle)}</button>`;
    if (mode === 'success') markup = title(org ? C.orgSuccessTitle : xp() ? C.successXpTitle : C.successTitle,org ? C.orgSuccessBody : xp() ? C.successXpBody : C.successBody,'✓') + (xp() ? balance(C.savedXpLabel) : '') + `<div class="state-actions">${button(org ? C.orgSuccessAction : C.successRewards,org ? 'organisation' : 'rewards')}${!org ? button(C.successLearn,'learn',true) : ''}</div>`;
    if (mode === 'rewards') markup = title(C.rewardsTitle,C.rewardsBody,'✳') + balance(C.rewardsBalance) + `<div class="reward-empty"><h3>${esc(C.rewardsEmptyTitle)}</h3><p>${esc(C.rewardsEmptyBody)}</p></div><div class="state-actions">${button(C.successLearn,'learn')}</div><p class="review-note">${esc(C.rewardsPreview)}</p>`;
    if (mode === 'learn' || mode === 'organisation') markup = title(mode === 'learn' ? C.learnTitle : C.orgSuccessTitle,mode === 'learn' ? C.learnBody : C.orgSuccessBody,'↗') + `<div class="state-actions"><a class="button button-plum" href="${mode === 'learn' ? 'index.html#try' : 'http://localhost:3000/org/create'}">${esc(mode === 'learn' ? C.learnAction : C.orgSuccessAction)}</a></div>${mode === 'organisation' ? `<p class="review-note">${esc(C.orgPreview)}</p>` : ''}`;
    $('auth-view').innerHTML = `<div class="auth-view-content">${markup}</div>`;
    document.title = C.pageTitle;
    history.replaceState(null,'',`${location.pathname}${location.search}#${mode}`);
    $('preview-controls').innerHTML = [
      [C.previewError,'connection-error'],[C.previewLoginError,'login-error'],[C.previewExisting,'existing-error'],[C.previewSecurity,'security-error'],[C.previewExpired,'expired']
    ].map(([label, action]) => `<button type="button" data-action="${action}">${esc(label)}</button>`).join('');
    AuthMotion.measure(isForm ? [form(false),form(true)] : null);
    AuthMotion.reveal(transition, focus);
    $('account-form')?.addEventListener('submit', submit);
    $('recovery-form')?.addEventListener('submit', submit);
  }
  function validate(id, valid, error) {
    const el = $(id); if (!el) return true;
    el.setAttribute('aria-invalid',String(!valid)); text(`error-${id}`, valid ? '' : error); return valid;
  }
  function submit(event) {
    event.preventDefault();
    let ok = true;
    if ($('name')) { name = $('name').value.trim(); ok = validate('name',!!name,C.nameError) && ok; }
    if ($('email')) { email = $('email').value.trim(); ok = validate('email',/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),C.emailError) && ok; }
    if ($('password')) { const value = $('password').value; const needsLength = mode === 'signup' || mode === 'reset'; ok = validate('password',needsLength ? value.length >= 8 : value.length > 0,needsLength ? C.passwordLengthError : C.passwordError) && ok; }
    if ($('terms')) ok = validate('terms',$('terms').checked,C.termsError) && ok;
    if (!ok) { AuthMotion.fit(); document.querySelector('[aria-invalid="true"]')?.focus(); return; }
    if ($('password')) $('password').value = '';
    if (mode === 'signup') render('confirm');
    else if (mode === 'forgot') render('reset-sent');
    else if (mode === 'reset') render('reset-done');
    else { PreviewSession.claim(); render('success'); }
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-action]'); if (!trigger) return;
    const action = trigger.dataset.action;
    if (action === 'show-password') { const el=$('password');const show=el.type==='password';el.type=show?'text':'password';trigger.textContent=show?C.hide:C.show;trigger.setAttribute('aria-label',show?C.hidePassword:C.showPassword);return; }
    if (action === 'resend') { message(mode === 'confirm' ? C.confirmResent : C.resetResent); return; }
    if (action === 'google') {
      if (mode === 'signup' && !$('terms').checked) { validate('terms',false,C.termsError);$('terms').focus();return; }
      priorForm=mode;render('google');return;
    }
    if (action === 'complete-google') { PreviewSession.claim();render('success');return; }
    const errors={'connection-error':C.connectionError,'login-error':C.invalidLogin,'existing-error':C.existingAccount,'security-error':C.securityError};
    if (errors[action]) { if (!$('auth-message')) render('login');message(errors[action],true);return; }
    if (action === 'expired') expiredFrom=mode==='reset-sent'||mode==='reset'?'reset-sent':'confirm';
    if ($('email')) email=$('email').value.trim();
    if ($('name')) name=$('name').value.trim();
    render(action);
  });
  for (const [id,key] of [['return-welcome','returnWelcome'],['auth-xp-label','xpLabel'],['auth-preview-notice','previewNotice'],['legal-terms','terms'],['legal-privacy','privacy'],['legal-support','support'],['preview-controls-label','previewLabel']]) text(id,C[key]);
  text('switch-signup-title', C.switchSignupTitle); text('switch-signup-body', C.switchSignupBody);
  text('switch-login-title', C.switchLoginTitle); text('switch-login-body', C.switchLoginBody);
  document.querySelector('[data-switch=signup]').textContent = C.signupLink;
  document.querySelector('[data-switch=login]').textContent = C.loginLink;
  render(mode,false);
  document.fonts.ready.then(()=>{if(['login','signup'].includes(mode))AuthMotion.measure([form(false),form(true)]);});
  window.addEventListener('resize',()=>{if(['login','signup'].includes(mode))AuthMotion.measure([form(false),form(true)]);});
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector('.auth-form-wrap').classList.add('is-ready')));
})();
