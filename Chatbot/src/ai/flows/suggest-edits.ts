'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing an uploaded image
 * and suggesting potential creative edits and enhancements.
 *
 * - suggestEdits - A function that takes an image and generates structured edit suggestions.
 * - SuggestEditsInput - The input type for the suggestEdits function.
 * - SuggestEditsOutput - The return type for the suggestEdits function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestedEditSchema = z.object({
  title: z
    .string()
    .describe('A short, descriptive title for the suggested edit (e.g., "Cinematic Lighting Overhaul").'),
  description: z
    .string()
    .describe(
      'The full, detailed prompt that would be used to perform the edit.'
    ),
});

const SuggestEditsInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The user-uploaded image to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type SuggestEditsInput = z.infer<typeof SuggestEditsInputSchema>;

const SuggestEditsOutputSchema = z.object({
  creative: z
    .array(SuggestedEditSchema)
    .describe(
      'An array of 3 creative enhancement suggestions, like adding or modifying elements while preserving the original image\'s core subject.'
    ),
  style: z
    .array(SuggestedEditSchema)
    .describe(
      'An array of 3 stylistic change suggestions, like altering the artistic style (e.g., to watercolor, anime) or color palette.'
    ),
  improvements: z
    .array(SuggestedEditSchema)
    .describe(
      'An array of 3 suggestions for technical improvements, like enhancing lighting, increasing detail, or adjusting composition.'
    ),
});
export type SuggestEditsOutput = z.infer<typeof SuggestEditsOutputSchema>;

export async function suggestEdits(
  input: SuggestEditsInput
): Promise<SuggestEditsOutput> {
  return suggestEditsFlow(input);
}

const suggestionPrompt = ai.definePrompt({
  name: 'suggestEditsPrompt',
  input: {schema: SuggestEditsInputSchema},
  output: {schema: SuggestEditsOutputSchema},
  prompt: `You are an expert Photo Editor AI with a keen eye for holistic analysis. Your primary task is to perform a comprehensive, end-to-end examination of the entire provided image. This includes analyzing the main subject(s), background, lighting, composition, mood, and **any text present within the image**.

After your complete analysis, generate a list of specific, actionable, and creative editing prompts. These prompts will be used by another AI to perform the actual edits. The goal is to suggest targeted modifications, not complete transformations, based on your full understanding of the image.

For the image provided, generate three distinct categories of suggestions:

1.  **Creative Enhancements (3 Prompts):**
    *   **Goal:** Suggest imaginative but specific changes that enhance the overall scene. Think about adding or modifying elements, altering the background, or subtly changing the narrative of the image while keeping the main subject intact.
    *   **Example Title:** "Add a Small Campfire"
    *   **Example Description:** "Add a small, realistic campfire in the foreground, with flickering flames and a warm glow that illuminates the immediate surroundings and casts soft shadows on the subject."

2.  **Style Changes (3 Prompts):**
    *   **Goal:** Suggest transformations of the image's artistic style, while maintaining the original composition and recognizing its elements.
    *   **Example Title:** "Convert to a Watercolor Painting"
    *   **Example Description:** "Render the entire image in the style of a watercolor painting. Use soft, blended colors and visible brush strokes, ensuring the original composition and subjects remain recognizable and distinct."

3.  **Technical Improvements (3 Prompts):**
    *   **Goal:** Suggest professional-level photographic enhancements to the overall image. Focus on holistic improvements to lighting, color balance, focus, and composition.
    *   **Example Title:** "Apply Golden Hour Lighting"
    *   **Example Description:** "Re-render the entire image with warm, dramatic 'golden hour' lighting. The light should come from a low angle, casting long, soft shadows across the whole scene and bathing everything in a rich, golden hue to enhance its emotional depth and visual appeal."

Analyze the following image from end-to-end and generate the full JSON object with 'creative', 'style', and 'improvements' arrays, each containing three detailed and actionable editing prompts based on your comprehensive analysis.

Image to analyze: {{media url=imageDataUri}}
`,
});

const suggestEditsFlow = ai.defineFlow(
  {
    name: 'suggestEditsFlow',
    inputSchema: SuggestEditsInputSchema,
    outputSchema: SuggestEditsOutputSchema,
  },
  async input => {
    const {output} = await suggestionPrompt(input);
    return output!;
  }
);
