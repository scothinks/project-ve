import Link from "next/link";
import { entryCopy as C } from "@/features/entry/copy";
import type { AccountFormController } from "@/features/entry/use-account-form";
export function AccountFields({ f, forgot, onForgot, xp }: { f: AccountFormController; forgot: boolean; onForgot: () => void; xp: number }) {
  const signup=f.authMode==='signup'&&!f.isPasswordRecovery&&!forgot;
  const org=f.safeNextPath.startsWith('/org/')||f.safeNextPath.startsWith('/o/');
  return <form className="auth-form" id="account-form" aria-busy={f.isLoading} onSubmit={e=>{if(forgot){e.preventDefault();void f.forgot();}else void f.submit(e);}}>
    {f.referralCode&&signup&&<p className="state-help">Invite active. Create an account to continue{f.referralKind==='contextual'?' in this organisation programme.':'.'}</p>}
    {signup&&<div className="auth-field"><label htmlFor="full-name">{C['AUTH.nameLabel']}</label><input id="full-name" name="name" autoComplete="name" required maxLength={120} disabled={f.isLoading} value={f.fullName} onChange={e=>f.setFullName(e.target.value)} placeholder={C['AUTH.namePlaceholder']}/></div>}
    {!f.isPasswordRecovery&&<div className="auth-field"><label htmlFor="email">{C['AUTH.emailLabel']}</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={f.isLoading} value={f.email} onChange={e=>f.setEmail(e.target.value)} placeholder={C['AUTH.emailPlaceholder']}/></div>}
    {!forgot&&<div className="auth-field"><label htmlFor="password">{C[f.isPasswordRecovery?'AUTH.newPasswordLabel':'AUTH.passwordLabel']}</label><div className="auth-password"><input id="password" name="password" type={f.showPassword?'text':'password'} autoComplete={signup||f.isPasswordRecovery?'new-password':'current-password'} required minLength={signup||f.isPasswordRecovery?8:undefined} maxLength={128} disabled={f.isLoading} value={f.password} onChange={e=>f.setPassword(e.target.value)} placeholder={C[f.isPasswordRecovery?'AUTH.newPasswordPlaceholder':'AUTH.passwordPlaceholder']}/><button type="button" aria-label={C[f.showPassword?'AUTH.hidePassword':'AUTH.showPassword']} onClick={()=>f.setShowPassword(!f.showPassword)}>{C[f.showPassword?'AUTH.hide':'AUTH.show']}</button></div>{(signup||f.isPasswordRecovery)&&<p className="auth-hint">{C['AUTH.passwordHelp']}</p>}</div>}
    {!signup&&!forgot&&!f.isPasswordRecovery&&<div className="auth-options"><label><input type="checkbox" checked={f.remember} onChange={e=>f.setRemember(e.target.checked)} disabled={f.isLoading}/>{C['AUTH.remember']}</label><button type="button" disabled={f.isLoading} onClick={onForgot}>{C['AUTH.forgotLink']}</button></div>}
    {signup&&<label className="auth-consent"><input type="checkbox" required checked={f.acceptedTerms} disabled={f.isLoading} onChange={e=>f.setAcceptedTerms(e.target.checked)}/><span>{C['AUTH.termsLead']} <Link href="/terms">{C['AUTH.terms']}</Link> {C['AUTH.termsJoin']} <Link href="/privacy">{C['AUTH.privacyPolicy']}</Link>.</span></label>}
    {signup&&f.turnstileSiteKey&&<div id="project-ve-turnstile"/>}
    {f.message&&<div className="auth-message is-error" role="alert">{f.message}{f.canResendConfirmation&&<button type="button" disabled={f.isLoading} onClick={()=>void f.resend()}>{C['AUTH.confirmResend']}</button>}</div>}
    {f.successMessage&&!forgot&&<p className="auth-message" role="status">{f.successMessage}</p>}
    {f.isDemoMode&&<p className="state-help">Demo mode is active. No live account or redeemable XP is created.</p>}
    <button className="button button-plum" type="submit" disabled={f.isLoading}>{f.isLoading?'Please wait…':C[forgot?'AUTH.forgotAction':f.isPasswordRecovery?'AUTH.resetAction':signup?org?'AUTH.signupOrgAction':xp?'AUTH.signupXpAction':'AUTH.signupAction':'AUTH.loginAction']}</button>
    {f.isGoogleAuthEnabled&&!forgot&&!f.isPasswordRecovery&&<><div className="auth-or">{C['AUTH.or']}</div><button className="auth-google" type="button" disabled={f.isLoading} onClick={()=>void f.google()}><span aria-hidden="true">G</span>{C[signup?'AUTH.googleSignup':'AUTH.googleLogin']}</button></>}
  </form>;
}
