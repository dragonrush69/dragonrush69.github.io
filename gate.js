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

  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  function show(state, email) {
    document.querySelectorAll("[data-state]").forEach((el) => {
      el.hidden = el.dataset.state !== state;
    });
    if (email) $("email").textContent = email;
  }

  async function signIn() {
    $("signin").disabled = true;
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: location.origin + location.pathname,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) { $("signin").disabled = false; show("error"); }
  }

  async function signOut() {
    await db.auth.signOut();
    show("signed-out");
  }

  async function start() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return show("signed-out");

    show("loading");
    const { data, error } = await db.storage.from("apps").download(`${APP}/index.html`);
    if (error || !data) return show("denied", session.user.email);

    const html = await data.text();
    // Drop any sign-in tokens from the address bar before handing over.
    history.replaceState(null, "", location.pathname + location.search);
    document.open();
    document.write(html);
    document.close();
  }

  $("signin").addEventListener("click", signIn);
  $("signout").addEventListener("click", signOut);
  start().catch(() => show("error"));
})();
