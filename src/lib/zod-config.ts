import { z } from "zod";

/*
 * Zod can compile its validators into generated code (new Function) for speed, and it first probes
 * whether that is allowed. Under our Content Security Policy, which forbids eval, the probe is caught
 * and harmless, but the browser still reports it as a blocked eval. Turning the compiler off removes
 * the report without loosening the policy; validating a form is far too small a job for it to matter.
 * Import this before using any schema that reaches the browser.
 */
z.config({ jitless: true });
