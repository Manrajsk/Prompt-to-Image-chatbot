# **App Name**: ImageForge AI

## Core Features:

- Prompt Entry: Display a text field labeled 'Enter image prompt' and a 'Generate' button at the top of the page.
- Image Generation: Upon clicking 'Generate,' send the prompt to an AI image-generation endpoint, display a loading spinner, and show the resulting image in a placeholder area.
- Edit Prompt: Display a text field labeled 'Edit with new prompt' and an 'Apply Edit' button below the generated image.
- Image Editing: On 'Apply Edit,' use an AI tool that calls an inpainting API using the current image and the new prompt to edit the displayed image. Replace it with the result.
- Download Image: Add a 'Download' button under the image to save it locally.
- Reset Fields: Add a 'Reset' button to clear both image and edit input fields.
- Image History: Store thumbnails of the past 3 generations in local state and display them.

## Style Guidelines:

- Primary color: Saturated blue (#4285F4) to represent technology and clarity.
- Background color: Light gray (#F5F5F5), providing a neutral backdrop that keeps the focus on the images.
- Accent color: Analogous violet (#7B61FF) to highlight interactive elements.
- Body and headline font: 'Inter', sans-serif, for a modern, neutral look.
- Use simple, outlined icons for buttons like 'Download' and 'Reset'.
- Full-width, responsive design, centered on the page with minimal styling. Max width of 800px for main content.
- Subtle fade-in animations for image loading and transitions.