// The resume's Download PDF button. The page is static (runtime "none"), so
// this is a parse-time <InlineScript>, rendered after the button: it shows
// the button (the PDF is generated in the browser, so it is only offered
// when scripts run) and, on click, builds the PDF from the page's data
// (resume-pdf.ts) and downloads it. It never downloads on its own, closes
// the window or navigates away. Under `next dev`, where the page hydrates,
// the button's suppressHydrationWarning keeps the `hidden` it removes.
import { InlineScript, scriptValue } from "@components/InlineScript";
import { createResumePdf, type ResumePdfData } from "./resume-pdf";

export function ResumeDownloadScript({ data }: { data: ResumePdfData }) {
  const code = `(() => {
  const resumePdfData = ${scriptValue(data)};
  const createResumePdf = ${createResumePdf.toString()};
  const downloadButton = document.querySelector("[data-resume-download]");
  const downloadStatus = document.querySelector("[data-resume-download-status]");
  if (!downloadButton || !downloadStatus) return;
  downloadButton.hidden = false;

  downloadButton.addEventListener("click", () => {
    try {
      const pdf = createResumePdf(resumePdfData);
      const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "pepo-resume.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking right after click() can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      downloadStatus.textContent = "Download started.";
    } catch (error) {
      downloadStatus.textContent = "Could not generate the PDF. Please try again.";
      console.error("PDF generation error:", error);
    }
  });
})();`;
  return <InlineScript code={code} />;
}
