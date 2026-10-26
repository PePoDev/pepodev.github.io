// Website mode's "Copy" button next to the e-mail address, and the status
// line that announces the result. The server renders the button, so it is
// there from first paint and the e-mail row never grows; the parse-time
// script right after it hides it where the Clipboard API is missing (an
// insecure context, an old browser) and handles its presses from the moment
// it is painted: the button reads "Copied" for two seconds and the status
// line says what happened. Under `next dev`, which hydrates the whole page,
// the button keeps a changed label (suppressHydrationWarning) and the
// status line is a static island React never compares (hydration rules 1
// and 2).
import { InlineScript } from "@components/InlineScript";

const code = `(() => {
  const button = document.querySelector("#website [data-copy-email]");
  const status = document.querySelector("#website [data-copy-status]");
  if (!button || !status) return;
  if (!navigator.clipboard) {
    button.hidden = true;
    return;
  }
  const label = button.firstChild;
  let timer = 0;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail);
    } catch {
      status.textContent = "Copy failed";
      return;
    }
    label.data = "Copied";
    status.textContent = "Email address copied";
    clearTimeout(timer);
    timer = setTimeout(() => {
      label.data = "Copy";
      status.textContent = "";
    }, 2000);
  });
})();`;

export function CopyEmailButton({ email }: { email: string }) {
  return (
    <>
      <button className="ws-copy" type="button" data-copy-email={email} suppressHydrationWarning>
        Copy
        <span className="ws-sr"> email address</span>
      </button>{" "}
      <span
        className="ws-sr"
        role="status"
        data-copy-status=""
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
      <InlineScript code={code} />
    </>
  );
}
