import type { IssueDraft, AIDraft } from '@/types';
import { GEMINI_API_URL } from '@/core/constants';

const SYSTEM_PROMPT = `You are a GitHub issue drafting assistant. Your job is to create well-structured, professional GitHub issues based on the provided context AND the annotated screenshot.

## STEP 1: SCOPE ANALYSIS

Before writing the issue, analyze the SCOPE based on the user's description:

1. **SPECIFIC** - The issue is about this exact page/element shown in the screenshot
   → Title and body should reference the specific page/component
   
2. **PATTERN** - The issue describes a pattern that likely exists across multiple pages
   → Use the screenshot as ONE EXAMPLE of a broader issue
   → Title should be broader (e.g., "Dark mode styling incomplete across application")
   → Body should frame the screenshot as "For example, on the [X] page..."
   
3. **GLOBAL** - The issue affects the entire application's behavior/system
   → Title and body should reflect application-wide scope

Key signals for PATTERN/GLOBAL scope:
- User mentions "many pages", "multiple", "across the app", "everywhere", "other pages"
- User says "this is just one example" or "similar issues exist"
- User describes a systemic problem (theming, responsiveness, accessibility, dark mode)

**CRITICAL: When scope is PATTERN or GLOBAL, DO NOT make the title page-specific. The user's written description defines the scope; the screenshot is supporting evidence, not the entire focus.**

---

## STEP 2: ANALYZE THE SCREENSHOT

Carefully analyze the provided screenshot image. Look for:
- Text annotations and comments written on the image
- Arrows pointing to specific elements
- Rectangles highlighting areas of concern
- Any visual elements that indicate what the user is pointing out

Use the visual information to understand:
- What specific UI element or area the issue refers to
- What the user is trying to communicate with their annotations
- Any visual bugs, layout issues, or UI problems visible in the screenshot

---

## STEP 3: GENERATE THE ISSUE

You MUST respond with valid JSON in exactly this format:
{
  "title": "Concise, descriptive issue title (under 80 chars)",
  "body": "Full markdown body of the issue"
}

For BUG reports, structure the body with these sections:

## Summary
Brief description of the issue. For PATTERN/GLOBAL scope, describe the broader problem and mention the screenshot shows one example.

## Steps to Reproduce
1. Step one
2. Step two
(numbered list - infer from context if not provided)

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens. For PATTERN scope, mention this occurs across multiple pages.

## Environment
- URL: ...
- Browser: ...
- Viewport: ...
- Timestamp: ...

## Console Logs
(if provided, format as code block)

## Additional Context
Any extra information. Reference specific visual elements from the screenshot.

---

For FEATURE requests, use these sections:

## Summary
Brief description of the feature request.

## Motivation
Why this feature is needed.

## Proposal
Detailed description of the proposed solution.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Additional Context
Any extra information.

---

Keep the title under 80 characters and descriptive. Be concise but thorough. Use proper Markdown formatting. If information is missing, make reasonable inferences based on the screenshot but don't invent details.`;

/**
 * Generate an issue draft using Gemini API
 * Includes ALL attached images as multimodal input
 */
export async function generateIssue(draft: IssueDraft, apiKey: string): Promise<AIDraft> {
    const userContent = buildUserPrompt(draft);

    // Build parts array with text and ALL images
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // Add ALL attached images (screenshot + any additional images)
    for (const attachment of draft.attachments) {
        if (!attachment.dataUrl) continue;

        const base64Match = attachment.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (base64Match) {
            const mimeType = base64Match[1];
            const base64Data = base64Match[2];
            parts.push({
                inlineData: {
                    mimeType,
                    data: base64Data,
                },
            });
        }
    }

    // Add text prompt after images
    parts.push({ text: userContent });

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
            },
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error?.message || `Gemini API error: ${response.status} ${response.statusText}`
        );
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No response from Gemini API');
    }

    try {
        const parsed = JSON.parse(text);
        if (!parsed.title || !parsed.body) {
            throw new Error('Invalid response format from Gemini');
        }
        return {
            title: parsed.title,
            body: parsed.body,
            generatedAt: Date.now(),
        };
    } catch (e) {
        throw new Error(`Failed to parse Gemini response: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}

/**
 * Build the user prompt from the draft
 */
function buildUserPrompt(draft: IssueDraft): string {
    const lines: string[] = [
        `Issue Type: ${draft.type.toUpperCase()}`,
        '',
        `Description: ${draft.userDescription || '(not provided - please infer from screenshot annotations)'}`,
    ];

    if (draft.type === 'bug') {
        if (draft.stepsToReproduce.filter((s) => s.trim()).length > 0) {
            lines.push('');
            lines.push('Steps to Reproduce:');
            draft.stepsToReproduce
                .filter((s) => s.trim())
                .forEach((step, i) => {
                    lines.push(`${i + 1}. ${step}`);
                });
        }

        if (draft.expectedBehavior) {
            lines.push('');
            lines.push(`Expected Behavior: ${draft.expectedBehavior}`);
        }

        if (draft.actualBehavior) {
            lines.push('');
            lines.push(`Actual Behavior: ${draft.actualBehavior}`);
        }
    }

    if (draft.labels.length > 0) {
        lines.push('');
        lines.push(`Labels to apply: ${draft.labels.join(', ')}`);
    }

    if (draft.includeEnvironment && draft.context.environment) {
        const env = draft.context.environment;
        lines.push('');
        lines.push('Environment:');
        lines.push(`- URL: ${env.url}`);
        lines.push(`- Page Title: ${env.pageTitle}`);
        lines.push(`- User Agent: ${env.userAgent}`);
        lines.push(`- Viewport: ${env.viewportWidth}x${env.viewportHeight}`);
        lines.push(`- Timestamp: ${new Date(env.timestamp).toISOString()}`);
    }

    if (draft.includeConsoleLogs && draft.context.consoleLogs.length > 0) {
        lines.push('');
        lines.push('Console Logs:');
        lines.push('```');
        draft.context.consoleLogs.slice(-20).forEach((log) => {
            lines.push(`[${log.level.toUpperCase()}] ${log.message}`);
            if (log.stack) {
                lines.push(`  Stack: ${log.stack.split('\n')[0]}`);
            }
        });
        lines.push('```');
    }

    if (draft.includeNetworkErrors && draft.context.networkErrors.length > 0) {
        lines.push('');
        lines.push('Network Errors:');
        lines.push('```');
        draft.context.networkErrors.forEach((err) => {
            const status = err.status ? `${err.status} ${err.statusText || ''}` : 'FAILED';
            lines.push(`${err.method} ${err.url} - ${status}`);
            if (err.errorMessage) {
                lines.push(`  Error: ${err.errorMessage}`);
            }
        });
        lines.push('```');
    }

    lines.push('');
    lines.push('IMPORTANT: Analyze the attached screenshot carefully. Look at any arrows, rectangles, and text annotations to understand what the user is pointing out.');

    return lines.join('\n');
}
