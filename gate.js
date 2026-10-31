// Shared Google sign-in gate for the private apps.
//
// Each app's real code lives in the private Supabase Storage bucket "apps"
// (at <app>/index.html). Supabase only lets a signed-in Google account
// download it if that email is listed in public.app_access for the app, so
// the code is never in this public repo or sent to strangers.
(function () {
  const SUPABASE_URL = "https://jssybjxthkhrzxbzpslx.supabase.co";
  const SUPABASE_KEY = "sb_publishable_MdS2iKjJz50Ge7UkQVq4LA_b7htOMnV";
  const APP = document.documentElement.dataset.app;

  const startHash = location.hash, startSearch = location.search;   // before the client tidies the address
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  function show(state, email) {
    document.querySelectorAll("[data-state]").forEach((el) => {
      el.hidden = el.dataset.state !== state;
    });
    if (email) $("email").textContent = email;
  }

  // Google or Discord (Kirsty, 2026-10-31). Either way access is by email:
  // the account's email must be in app_access for this app.
  async function signIn(provider) {
    const btn = $(provider === "discord" ? "signin-discord" : "signin");
    btn.disabled = true;
    const { error } = await db.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: location.origin + location.pathname,
        ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : { scopes: "identify email" }),
      },
    });
    if (error) { btn.disabled = false; show("error"); }
  }

  async function signOut() {
    await db.auth.signOut();
    show("signed-out");
  }


  // A refused sign-in comes back with the reason in the address (#error=…)
  // and used to just show "Sign in" again, a loop (Kirsty, 2026-10-31).
  // Show the reason, in plain words where we know it.
  function authErrorText() {
    const p = new URLSearchParams((startHash || "").replace(/^#/, "") + "&" + (startSearch || "").replace(/^\?/, ""));
    const raw = p.get("error_description") || p.get("error");
    if (!raw) return null;
    history.replaceState(null, "", location.pathname);
    const d = raw.replace(/\+/g, " ");
    if (/email/i.test(d)) return "Discord didn't share a verified email address, so you couldn't be signed in. In Discord, open User Settings › My Account, add and verify your email, then try again — or sign in with Google.";
    return "Sign-in didn't work: " + d;
  }
  function showAuthError(container) {
    const text = authErrorText();
    if (!text || !container) return;
    const el = document.createElement("p");
    el.className = "auth-error";
    el.style.cssText = "color:#dc2626;font-size:14px;margin:0 0 12px";
    el.textContent = text;
    container.prepend(el);
  }

  async function start() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { showAuthError(document.querySelector('[data-state="signed-out"]')); return show("signed-out"); }

    show("loading");
    // Admins can add someone by Discord username; on their first Discord
    // sign-in this swaps it for their real email (Kirsty, 2026-10-31).
    try { await db.rpc("claim_discord_access"); } catch (e) { /* not fatal */ }
    const { data, error } = await db.storage.from("apps").download(`${APP}/index.html`);
    if (error || !data) return show("denied", session.user.email);

    const html = await data.text();
    // Drop any sign-in tokens from the address bar before handing over.
    history.replaceState(null, "", location.pathname + location.search);
    document.open();
    document.write(html);
    document.close();
  }

  $("signin").addEventListener("click", () => signIn("google"));
  if ($("signin-discord")) $("signin-discord").addEventListener("click", () => signIn("discord"));
  $("signout").addEventListener("click", signOut);
  start().catch(() => show("error"));
})();
