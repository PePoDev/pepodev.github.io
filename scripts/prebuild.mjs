#!/usr/bin/env node
// Runs before `next build` (pnpm build): drops the images resized by earlier
// builds and dev servers (src/lib/images.ts), so out/_img/ holds only the
// ones this build's pages use.
import { rmSync } from "node:fs";

rmSync(new URL("../public/_img", import.meta.url), { recursive: true, force: true });
