// node --test scripts/sync-garden.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { buildIndex, convertNote, slugify } from "./sync-garden.mjs";

const pub = (body, extra = "") => `---\ndg-publish: true\n${extra}---\n${body}`;
const vault = buildIndex(
  [
    {
      rel: "Knowledge/Cloud/AWS/AWS.md",
      text: pub(
        [
          "## Pages",
          "%% Begin Waypoint %%",
          "- [[IAM]]",
          "- [[Secret Plan]]",
          "%% End Waypoint %%",
          "See [[Secret Plan|the plan]], [[Financial]] and [[IAM#Root User|root]].",
          "%% private aside %%<!-- hidden -->",
          "![[aws diagram.png]] ![x](Attachments/aws%20diagram.png) ![[Secret Plan]]",
          "> [!tip]+ Remember",
          "> Use [[IAM]] roles.",
          "```sh",
          "echo [[IAM]] %%keep%%",
          "```",
          "Inline `[[IAM]]` stays.",
        ].join("\r\n"),
        "candidate-id: 1234\n",
      ),
    },
    { rel: "Knowledge/Cloud/AWS/IAM.md", text: pub("AWS IAM") },
    { rel: "Knowledge/Cloud/Google Cloud/IAM.md", text: pub("GCP IAM") },
    { rel: "Knowledge/Cloud/AWS/Secret Plan.md", text: "---\ndg-publish: false\n---\nshh" },
    { rel: "Knowledge/Business/Financial.md", text: pub("public money notes") },
    { rel: "Knowledge/Business/Business.md", text: pub("- [[Financial]]") },
    { rel: "Financial/Financial.md", text: "private money notes" },
    { rel: "Blog/Post.md", text: pub("blog") },
    { rel: "Late.md", text: "\n---\ndg-publish: true\n---\nnot frontmatter" },
    { rel: "README.md", text: pub("Welcome", "dg-home: true\ntitle: PePo Garden\n") },
  ],
  ["Attachments/aws diagram.png"],
);
const note = (rel) => vault.all.find((n) => n.rel === rel);

test("slugify matches the old garden permalinks", () => {
  for (const [input, slug] of [
    ["IoT", "io-t"],
    ["OAuth", "o-auth"],
    ["OpenTelemetry", "open-telemetry"],
    ["DevOps", "dev-ops"],
    ["Bash & Shell", "bash-and-shell"],
    ["Analytic, Steaming, Queue", "analytic-steaming-queue"],
    ["Intellectual property (IP)", "intellectual-property-ip"],
    ["LGTM Stack", "lgtm-stack"],
    ["C4 model", "c4-model"],
    ["Google Cloud", "google-cloud"],
  ]) {
    assert.equal(slugify(input), slug);
  }
});

test("only dg-publish notes outside Blog/ with frontmatter at byte 0 publish", () => {
  const published = vault.all.filter((n) => n.published).map((n) => n.id);
  assert.deepEqual(published.sort(), [
    "index",
    "knowledge/business/business",
    "knowledge/business/financial",
    "knowledge/cloud/aws/aws",
    "knowledge/cloud/aws/iam",
    "knowledge/cloud/google-cloud/iam",
  ]);
  assert.equal(note("README.md").title, "PePo Garden");
});

test("converted note keeps nothing private", () => {
  const { body, links, assets, dropped } = convertNote(note("Knowledge/Cloud/AWS/AWS.md"), vault);
  assert.doesNotMatch(body, /Secret Plan|private aside|hidden|candidate|1234/);
  assert.match(body, /## Pages  \n- \[IAM\]\(\/garden\/knowledge\/cloud\/aws\/iam\/\)\n/);
  // Obsidian resolves this [[Financial]] to the shorter, private Financial/Financial.md.
  assert.match(body, /See the plan, Financial and/);
  assert.match(body, /\[root\]\(\/garden\/knowledge\/cloud\/aws\/iam\/#root-user\)/);
  assert.match(body, /^!\[\]\(\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/garden\/aws-diagram\.png\) !\[x\]\(\.\.\/.*aws-diagram\.png\) $/m);
  assert.match(body, /<details class="callout" data-callout="tip" open>  \n<summary class="callout-title">\n\nRemember\n\n<\/summary>\n\nUse \[IAM\].*\n\n<\/details>\n\n```sh/);
  assert.match(body, /```sh\necho \[\[IAM\]\] %%keep%%\n```\n/);
  assert.match(body, /Inline `\[\[IAM\]\]` stays\./);
  assert.doesNotMatch(body, /\r/);
  assert.deepEqual(links, ["knowledge/cloud/aws/iam"]);
  assert.deepEqual(new Set(assets.map((a) => a.to)), new Set(["aws-diagram.png"]));
  assert.equal(dropped, 2);
});

test("same-folder note wins an ambiguous link", () => {
  const { body } = convertNote(note("Knowledge/Business/Business.md"), vault);
  assert.equal(body, "- [Financial](/garden/knowledge/business/financial/)");
});

test("odd syntax cannot smuggle private names, paths, or files", () => {
  const fence = "```";
  const body = [
    "## Pages",
    "%% Begin Waypoint %%",
    "- [[Public]]",
    "- **Clients**",
    "\t- [[Contract]]",
    "%% End Waypoint %%",
    "%% Begin Landmark %%",
    "- [[Contract]]",
    "%% End Landmark %%",
    "![[photo.png]] ![[Attachments/photo.png]]",
    '[a](<Clients/Contract.md>) [b](Clients/Contract.md "t") [c][1] [d [e] f](Clients/Contract.md)',
    "[o](obsidian://open?vault=V&file=Clients%2FContract)",
    "Use \\` to quote %% escaped secret %% and \\` again",
    "line one\\",
    "line two",
    "> [!note|right] **Bold** title",
    `> ${fence}sh`,
    "> printf 100%%",
    `> ${fence}`,
    "> > [!warning] Inner",
    "> > nested",
    "After the callout.",
    "",
    "[1]: Clients/Contract.md",
    "<!-- unclosed secret",
    "still secret",
  ].join("\n");
  const v = buildIndex(
    [
      { rel: "Knowledge/Index.md", text: pub(body) },
      { rel: "Knowledge/Public.md", text: pub("hi") },
      { rel: "Knowledge/Clients/Contract.md", text: "secret" },
    ],
    ["Attachments/photo.png", "Attachments/Private/photo.png"],
  );
  const out = convertNote(v.all[0], v);
  assert.doesNotMatch(out.body, /Clients|Contract|obsidian:|escaped secret|unclosed|still secret/);
  assert.match(out.body, /^## Pages  \n- \[Public\]\(\/garden\/knowledge\/public\/\)\n/);
  // A bare name shared by two files is dropped; the full path is exact.
  assert.deepEqual(out.assets.map((a) => a.from), ["Attachments/photo.png"]);
  assert.match(out.body, /line one\\\nline two/);
  assert.match(out.body, /<div class="callout-title">\n\n\*\*Bold\*\* title\n\n<\/div>/);
  assert.match(out.body, /```sh\nprintf 100%%\n```/);
  assert.match(out.body, /<aside class="callout" data-callout="warning">/);
  assert.match(out.body, /After the callout\./);
});

test("code is whatever CommonMark says, and anything left over is refused", () => {
  const convert = (body) => {
    const v = buildIndex([
      { rel: "Notes/Index.md", text: pub(body) },
      { rel: "Notes/Secret.md", text: "secret" },
    ]);
    return convertNote(v.all[0], v).body;
  };
  // A fence on a list item, and a closer with an info string (not a closer).
  assert.doesNotMatch(convert("- ```sh\n  echo hi\n  ```\n\n%% hidden %% [[Secret]]"), /hidden|\[\[/);
  assert.doesNotMatch(convert("```md\n```python\n```\nText %% hidden %%"), /hidden/);
  assert.match(convert("- ```sh\n  echo %%x%% [[y]]\n  ```"), /echo %%x%% \[\[y\]\]\n {2}```$/);
  // Shapes the rewrites do not handle are refused instead of published.
  assert.throws(() => convert('<a href="Secret.md">x</a>'), /Refusing to publish/);
  assert.throws(() => convert("[c][1]\n\n> [1]: Secret.md"), /Refusing to publish/);
});
