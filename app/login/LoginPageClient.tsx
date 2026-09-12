"use client";
import { useState } from "react";
import Link from "next/link";
import { BrandSignature } from "@/components/brand/BrandSignature";
import { entryCopy as C } from "@/features/entry/copy";
import { useAccountForm } from "@/features/entry/use-account-form";
import { useAccountMotion } from "@/features/entry/use-account-motion";
import { AccountFields } from "@/components/entry/AccountFields";
import "@/components/entry/auth.css";
export function LoginPageClient({isDemoMode,nextPath,initialMode='login',xp=0}:{isDemoMode:boolean;nextPath:string;initialMode?:'login'|'signup';xp?:number}) {
  const f=useAccountForm({isDemoMode,nextPath,initialMode,hasWelcomeProgress:xp>0});
  const [forgot,setForgot]=useState(false);
  const state=Boolean(f.confirmationEmail||f.emailConfirmed||f.isPasswordRecovery||forgot);
  const mode=state?'state':f.authMode; const motion=useAccountMotion(mode);
  const org=nextPath.startsWith('/org/')||nextPath.startsWith('/o/');
  const title=f.confirmationEmail?C['AUTH.confirmTitle']:f.emailConfirmed?C['AUTH.verifiedTitle']:f.isPasswordRecovery?C['AUTH.resetTitle']:forgot?(f.successMessage?C['AUTH.resetSentTitle']:C['AUTH.forgotTitle']):f.authMode==='signup'?C[org?'AUTH.signupOrgTitle':xp?'AUTH.signupXpTitle':'AUTH.signupTitle']:C['AUTH.loginTitle'];
  const body=f.confirmationEmail?C['AUTH.confirmBody'].replace('{email}',f.confirmationEmail):f.emailConfirmed?C['AUTH.verifiedBody']:f.isPasswordRecovery?C['AUTH.resetBody']:forgot?(f.successMessage?C['AUTH.resetSentBody'].replace('{email}',f.email):C['AUTH.forgotBody']):f.authMode==='signup'?C[org?'AUTH.signupOrgBody':xp?'AUTH.signupXpBody':'AUTH.signupBody']:C[org?'AUTH.loginOrgBody':xp?'AUTH.loginXpBody':'AUTH.loginBody'];
  function login(){setForgot(false);f.switchMode('login');}
  return <div className="entry-auth"><header className="auth-header"><Link href="/" className="brand"><BrandSignature/></Link><Link className="auth-back" href="/">← {C['AUTH.returnWelcome']}</Link></header><main className="auth-layout"><section className="auth-main" aria-label="Your account"><div ref={motion.wrap} className={`auth-form-wrap ${motion.ready?'is-ready':''}`} data-mode={mode} inert={!motion.ready||motion.moving||undefined} aria-busy={!motion.ready||motion.moving}>
    <div className="auth-form-panel">{xp>0&&<div className="auth-xp-carry"><span>{C['AUTH.xpLabel']}</span><strong>{xp} XP</strong></div>}<div id="auth-view" ref={motion.view}><div className="auth-view-content"><h1 id="auth-title" tabIndex={-1}>{title}</h1><p className="auth-description">{body}</p>
      {f.confirmationEmail?<><p className="state-help">{C['AUTH.confirmHelp']}</p>{f.successMessage&&<p role="status" className="auth-message">{f.successMessage}</p>}{f.message&&<p role="alert" className="auth-message is-error">{f.message}</p>}<div className="state-actions"><button className="button button-plum" disabled={f.isLoading} onClick={()=>void f.resend()}>{C['AUTH.confirmResend']}</button><button className="button button-quiet" onClick={()=>f.switchMode('signup')}>{C['AUTH.changeEmail']}</button><button className="button button-quiet" onClick={login}>{C['AUTH.backLogin']}</button></div></>:f.emailConfirmed?<div className="state-actions"><button className="button button-plum" onClick={login}>{C['AUTH.verifiedAction']}</button></div>:forgot&&f.successMessage?<><p className="state-help">{C['AUTH.resetSentHelp']}</p><div className="state-actions"><button className="button button-plum" disabled={f.isLoading} onClick={()=>void f.forgot()}>{C['AUTH.resendReset']}</button></div></>:<AccountFields f={f} forgot={forgot} onForgot={()=>{f.switchMode('login');setForgot(true);}} xp={xp}/>}
      {(forgot||f.isPasswordRecovery)&&<button className="auth-back" onClick={login}>{C['AUTH.backLogin']}</button>}
    </div></div></div>
    {!state&&<aside className="auth-switch-panel" aria-label={C['ACCESS.auth.6']}>{(['signup','login'] as const).map((target,i)=><div className={`auth-invitation invitation-${i?'right':'left'}`} key={target} inert={target===f.authMode||undefined} aria-hidden={target===f.authMode}><div className="auth-switch-copy"><h2>{C[target==='signup'?'AUTH.switchSignupTitle':'AUTH.switchLoginTitle']}</h2><p>{C[target==='signup'?'AUTH.switchSignupBody':'AUTH.switchLoginBody']}</p><button type="button" disabled={f.isLoading} onClick={()=>motion.transition(()=>f.switchMode(target))}>{C[target==='signup'?'AUTH.signupLink':'AUTH.loginLink']}</button></div></div>)}</aside>}
  </div><nav className="auth-legal" aria-label="Help and policies"><Link href="/terms">{C['AUTH.terms']}</Link><Link href="/privacy">{C['AUTH.privacy']}</Link><Link href="/support">{C['AUTH.support']}</Link></nav><noscript><p>JavaScript is required to securely sign in or create an account. <Link href="/">Back to welcome</Link></p></noscript></section></main></div>;
}
