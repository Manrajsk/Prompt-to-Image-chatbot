'use server';

/**
 * @fileOverview This file defines a Genkit flow for refining a user prompt
 * into three tiers of sophistication: Basic, Intermediate, and Advanced.
 *
 * - refinePromptV2 - A function that takes a prompt and generates structured refinements.
 * - RefinePromptV2Input - The input type for the refinePromptV2 function.
 * - RefinePromptV2Output - The return type for the refinePromptV2 function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefinedPromptSchema = z.object({
    title: z.string().describe('A short, descriptive title for the creative scenario (e.g., "Dragon Emerging from Ocean Surface").'),
    description: z.string().describe('The full, detailed prompt description for the image generation model.'),
});

const RefinePromptV2InputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'The user-provided prompt to be refined into multiple creative scenarios.'
    ),
});
export type RefinePromptV2Input = z.infer<typeof RefinePromptV2InputSchema>;

const RefinePromptV2OutputSchema = z.object({
  basic: z.array(RefinedPromptSchema).describe('An array of 3 creative scenarios with basic, photorealistic refinements.'),
  intermediate: z.array(RefinedPromptSchema).describe('An array of 3 creative scenarios with intermediate refinements, including professional specifications like lighting, composition, and mood.'),
  advanced: z.array(RefinedPromptSchema).describe('An array of 3 creative scenarios with advanced, expert-level refinements, detailing camera angles, lens types, artistic styles, and complex emotional themes.'),
});
export type RefinePromptV2Output = z.infer<typeof RefinePromptV2OutputSchema>;


export async function refinePromptV2(
  input: RefinePromptV2Input
): Promise<RefinePromptV2Output> {
  return refinePromptV2Flow(input);
}

const refinementPrompt = ai.definePrompt({
  name: 'refinePromptV2System',
  input: {schema: RefinePromptV2InputSchema},
  output: {schema: RefinePromptV2OutputSchema},
  prompt: `You are a world-class Prompt Refinement AI specializing in generating prompts for **hyper-realistic** images. Your mission is to take a user's core idea and explode it into a spectrum of creative, actionable prompts for a generative image AI. The absolute priority is photorealism.

The user's input is: "{{{prompt}}}"

Based on this input, generate THREE distinct creative scenarios. For EACH of these three scenarios, create THREE levels of prompt refinement with an emphasis on realism:

1.  **Basic Refinement (3 Prompts):**
    *   **Goal:** Create a stunning, clean, photorealistic image.
    *   **Content:** A single, clear sentence describing the scene. Include professional photography terms like 'photorealistic', '8K', 'sharp focus', and 'cinematic lighting'.
    *   **Example Title:** "Photorealistic Dragon in Underwater Caves"
    *   **Example Description:** "A photorealistic, 8K, cinematic photograph of a majestic dragon swimming through vast underwater cave systems filled with bioluminescent coral. The image should have sharp focus, dramatic lighting, and an epic, awe-inspiring mood."

2.  **Intermediate Refinement (3 Prompts):**
    *   **Goal:** A breathtaking 8K cinematic photograph with professional artistic direction.
    *   **Content:** Start with the basic description, then add a bulleted list of professional specifications.
    *   **Specifications to include:** COMPOSITION (e.g., Rule of thirds, leading lines), LIGHTING (e.g., Golden hour, soft studio lighting, volumetric rays), ATMOSPHERE (e.g., Foggy, moody, serene), VISUAL ELEMENTS (e.g., Ultra-detailed textures), and MOOD.
    *   **Example Description:** "A breathtaking 8K cinematic photograph of a majestic dragon swimming through vast underwater cave systems filled with bioluminescent coral:
        *   COMPOSITION: Rule of thirds, with the dragon's eye as a focal point.
        *   LIGHTING: Ethereal bioluminescent lighting from the coral, with volumetric light rays filtering down from the water's surface.
        *   ATMOSPHERE: Clear deep-blue water with visible particulate matter and small air bubbles.
        *   VISUAL ELEMENTS: Ultra-detailed, reptilian skin texture on the dragon; realistic coral formations.
        *   MOOD: Epic, mysterious, and serene."

3.  **Advanced Refinement (3 Prompts):**
    *   **Goal:** An award-winning, hyper-realistic photograph that looks like it was taken by a professional.
    *   **Content:** Start with the intermediate description and add an "ADVANCED PHOTOGRAPHY DETAILS" section.
    *   **Advanced Details to include:** CAMERA (e.g., Sony A7R IV, Hasselblad X2D), LENS (e.g., Zeiss Planar T* 50mm f/1.4, G-Master 85mm f/1.2), SHOOTING_STYLE (e.g., Shot in the style of Annie Leibovitz, inspired by National Geographic photography), and AESTHETICS (e.g., Hyper-detailed, award-winning photography, physically-based rendering).
    *   **Example Description:** "...[Intermediate content]...
        *   ADVANCED PHOTOGRAPHY DETAILS:
            *   CAMERA: Shot on a Sony A7R IV.
            *   LENS: 35mm G-Master f/1.4 lens.
            *   SHOOTING_STYLE: Inspired by the underwater photography of National Geographic, capturing a sense of documentary realism.
            *   AESTHETICS: Hyper-realistic, award-winning wildlife photography, incredible detail, physically-based rendering."

Generate the full JSON object with 'basic', 'intermediate', and 'advanced' arrays, each containing three refined prompts based on three distinct scenarios derived from the user's input.
`,
});

const refinePromptV2Flow = ai.defineFlow(
  {
    name: 'refinePromptV2Flow',
    inputSchema: RefinePromptV2InputSchema,
    outputSchema: RefinePromptV2OutputSchema,
  },
  async input => {
    const {output} = await refinementPrompt(input);
    return output!;
  }
);
