'use server';

/**
 * @fileOverview This file defines a Genkit flow for editing an image based on a new prompt.
 *
 * - editImage - A function that edits an existing image using a new prompt.
 * - EditImageInput - The input type for the editImage function.
 * - EditImageOutput - The return type for the editImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EditImageInputSchema = z.object({
  existingImageDataUri: z
    .string()
    .describe(
      "The existing image to edit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  newPrompt: z.string().describe('The prompt to use for editing the image.'),
});
export type EditImageInput = z.infer<typeof EditImageInputSchema>;

const EditImageOutputSchema = z.object({
  editedImageDataUri: z
    .string()
    .describe(
      'The edited image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: data:<mimetype>;base64,<encoded_data>.'
    ),
});
export type EditImageOutput = z.infer<typeof EditImageOutputSchema>;

export async function editImage(input: EditImageInput): Promise<EditImageOutput> {
  return editImageFlow(input);
}

const editImageFlow = ai.defineFlow(
  {
    name: 'editImageFlow',
    inputSchema: EditImageInputSchema,
    outputSchema: EditImageOutputSchema,
  },
  async input => {
    // Construct a more precise prompt to guide the AI towards in-painting/specific edits.
    const editInstruction = `You are an expert at in-painting and image modification. Your task is to apply a specific edit to the provided image based on the user's request. Preserve the original image's composition, style, and subject as much as possible, only changing what is explicitly requested. 
IMPORTANT: If there is any text in the image, you must preserve its font, style, and legibility unless the prompt explicitly asks to change it. The user's instruction for the edit is: "${input.newPrompt}"`;

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {media: {url: input.existingImageDataUri}},
        {text: editInstruction}, // Use the more detailed instruction prompt
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
        ],
      },
    });

    if (!media?.url) {
      throw new Error('Image editing failed: no media was returned from the model.');
    }

    return {editedImageDataUri: media.url};
  }
);
