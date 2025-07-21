
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Download,
  RotateCcw,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  Undo,
  History as HistoryIcon,
  ChevronRight,
  Copy,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { generateImage } from '@/ai/flows/generate-image';
import { editImage } from '@/ai/flows/edit-image';
import { refinePromptV2, RefinePromptV2Output } from '@/ai/flows/refine-prompt-v2';
import { suggestEdits, SuggestEditsOutput } from '@/ai/flows/suggest-edits';
import { useToast } from "@/hooks/use-toast";

const VisionaryLogo = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-primary"
  >
    <path d="M12 2L9.17157 4.82843L6.34315 2L4.82843 4.82843L2 6.34315L4.82843 9.17157L2 12L4.82843 14.8284L2 17.6569L4.82843 19.1716L6.34315 22L9.17157 19.1716L12 22L14.8284 19.1716L17.6569 22L19.1716 19.1716L22 17.6569L19.1716 14.8284L22 12L19.1716 9.17157L22 6.34315L19.1716 4.82843L17.6569 2L14.8284 4.82843L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
  </svg>
);


const LOCAL_STORAGE_HISTORY_KEY = 'visionaryAppImageHistory';
const MAX_HISTORY_LENGTH = 5;
const MAX_UNDO_STEPS = 5;

// Helper to create a smaller thumbnail to avoid localStorage quota issues
const createThumbnailDataUri = (dataUri: string, maxSize = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      // Use JPEG for better compression for photos, with reduced quality for smaller size
      resolve(canvas.toDataURL('image/jpeg', 0.7)); 
    };
    img.onerror = (err) => reject(err);
    img.src = dataUri;
  });
};


export default function ImageForge() {
  const [prompt, setPrompt] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [isUploadedImage, setIsUploadedImage] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [activeLoader, setActiveLoader] = useState<'generate' | 'edit' | 'suggest' | null>(null);
  const [refinedPrompts, setRefinedPrompts] = useState<RefinePromptV2Output | null>(null);
  const [suggestedEdits, setSuggestedEdits] = useState<SuggestEditsOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);


  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          setImageHistory(parsedHistory);
        }
      }
    } catch (e) {
      console.error("Failed to load image history from localStorage", e);
      toast({
        variant: "destructive",
        title: "History Load Failed",
        description: "Could not load your image history.",
      });
    }
  }, [toast]);


  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(imageHistory));
    } catch (e) {
      console.error("Failed to save image history to localStorage", e);
      let description = "An error occurred while saving image history.";
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        description = `Could not save to image history as browser storage is full. The history is limited to ${MAX_HISTORY_LENGTH} images, but current images may be too large. Older images are automatically removed.`;
      }
      toast({
        variant: "destructive",
        title: "History Save Failed",
        description: description,
      });
    }
  }, [imageHistory, toast]);


  const updateImageHistory = useCallback(async (newImageUrl: string) => {
    try {
      const thumbnailUrl = await createThumbnailDataUri(newImageUrl);
      setImageHistory(prevHistory => {
        const filteredHistory = prevHistory.filter(url => url !== thumbnailUrl);
        const newHistory = [thumbnailUrl, ...filteredHistory];
        return newHistory.slice(0, MAX_HISTORY_LENGTH);
      });
    } catch (e) {
      console.error("Failed to create thumbnail for history", e);
      toast({
        variant: "destructive",
        title: "History Update Failed",
        description: "Could not create a thumbnail to save in history.",
      });
    }
  }, [toast]);

  const handleApiError = (e: unknown, context: 'generate' | 'edit' | 'suggest' | 'refine') => {
      console.error(e);
      let errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      let errorTitle = "Operation Failed";
      
      // Check for specific 429 rate limit error
      if (typeof errorMessage === 'string' && errorMessage.includes('429')) {
        errorTitle = "Rate Limit Exceeded";
        errorMessage = "You have exceeded your current quota for the AI model. Please check your Google Cloud project to ensure billing is enabled and your plan supports the desired usage. This is not an application error.";
      } else {
         switch(context) {
           case 'generate':
             errorTitle = "Generation Failed";
             errorMessage = `Could not generate image. ${errorMessage}`;
             break;
           case 'edit':
             errorTitle = "Editing Failed";
             errorMessage = `Could not edit image. ${errorMessage}`;
             break;
           case 'suggest':
             errorTitle = "Suggestion Failed";
             errorMessage = `Could not suggest edits. ${errorMessage}`;
             break;
          case 'refine':
             // For refine, we don't show a toast, just log it.
             console.error("Failed to refine prompt:", e);
             return; // exit early
         }
      }
      
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: errorTitle,
        description: errorMessage,
      });
  };
  
  const handleGenerateImage = useCallback(async (generationPrompt: string) => {
    if (!generationPrompt.trim()) {
      setError('Cannot generate image from an empty prompt.');
      return;
    }
    setIsLoading(true);
    setActiveLoader('generate');
    setError(null);
    setIsUploadedImage(false);
    setImageUrl(null); // Clear previous image
    setUndoStack([]);
    setSuggestedEdits(null);
    setRefinedPrompts(null);


    try {
      const result = await generateImage({ prompt: generationPrompt });
      setImageUrl(result.imageUrl);
      await updateImageHistory(result.imageUrl);
      setEditPrompt('');
      
      // Now, refine the prompt in the background
      try {
        setIsRefining(true);
        const refinedResults = await refinePromptV2({ prompt: generationPrompt });
        setRefinedPrompts(refinedResults);
      } catch (refineError) {
        handleApiError(refineError, 'refine');
      }

    } catch (e) {
      handleApiError(e, 'generate');
    } finally {
      setIsLoading(false);
      setIsRefining(false);
      setActiveLoader(null);
    }
  }, [toast, updateImageHistory]);
  
  const handleEditImage = async (editActionPrompt?: string) => {
    const finalEditPrompt = editActionPrompt || editPrompt;
    if (!finalEditPrompt.trim()) {
      setError('Please enter a prompt to edit the image.');
      return;
    }
    if (!imageUrl) {
      setError('No image to edit. Please generate or upload an image first.');
      return;
    }
    setIsLoading(true);
    setActiveLoader('edit');
    setError(null);
    setSuggestedEdits(null);
    
    // Add current image to undo stack before editing
    setUndoStack(prev => [imageUrl, ...prev].slice(0, MAX_UNDO_STEPS));

    try {
      const result = await editImage({ existingImageDataUri: imageUrl, newPrompt: finalEditPrompt });
      setImageUrl(result.editedImageDataUri);
      await updateImageHistory(result.editedImageDataUri);
      setIsUploadedImage(false);
      setEditPrompt(''); // Clear the manual input field after applying an edit
      await handleSuggestEdits(result.editedImageDataUri); // Re-analyze after AI edit
    } catch (e) {
      handleApiError(e, 'edit');
       // If edit fails, revert by popping from undo stack
      setUndoStack(prev => {
        const [lastImage, ...rest] = prev;
        if (lastImage) setImageUrl(lastImage);
        return rest;
      });
    } finally {
      setIsLoading(false);
      setActiveLoader(null);
    }
  };

  const handleSuggestEdits = useCallback(async (dataUri: string) => {
    setIsLoading(true);
    setActiveLoader('suggest');
    setError(null);
    setSuggestedEdits(null);
    try {
      const results = await suggestEdits({ imageDataUri: dataUri });
      setSuggestedEdits(results);
    } catch (e) {
      handleApiError(e, 'suggest');
    } finally {
      setIsLoading(false);
      setActiveLoader(null);
    }
  }, [toast]);


  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Invalid file type. Please upload an image.');
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: "Please select a valid image file (e.g., PNG, JPG).",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        // Use the original, full-quality data URI for display and AI processing
        setImageUrl(dataUri);
        setUndoStack([]);
        await updateImageHistory(dataUri); // Only creates a thumbnail for history
        setEditPrompt('');
        setError(null);
        setPrompt('');
        setRefinedPrompts(null);
        setIsUploadedImage(true);
        toast({
          title: "Image Uploaded",
          description: "Analyzing your image for creative suggestions...",
        });
        // Send the original, full-quality data URI for analysis
        await handleSuggestEdits(dataUri);
      };
      reader.onerror = () => {
        setError('Failed to read the uploaded file.');
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: "There was an error reading your image file.",
        });
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const safePrompt = prompt || editPrompt || (isUploadedImage ? 'uploaded_image' : 'visionary_image');
    const filename = safePrompt.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 50);
    const extension = imageUrl.substring(imageUrl.indexOf('/') + 1, imageUrl.indexOf(';base64'));
    link.download = `${filename || 'visionary_image'}.${extension || 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setPrompt('');
    setEditPrompt('');
    setImageUrl(null);
    setUndoStack([]);
    setError(null);
    setRefinedPrompts(null);
    setIsUploadedImage(false);
    setSuggestedEdits(null);
  };

  const handleHistoryImageClick = async (histImageUrl: string) => {
    setImageUrl(histImageUrl);
    setUndoStack([]);
    setEditPrompt('');
    setError(null);
    setPrompt('');
    setRefinedPrompts(null);
    setIsUploadedImage(true);
    setIsHistorySheetOpen(false); 
    toast({
        title: "Image Loaded",
        description: "Analyzing your image for creative suggestions...",
    });
    await handleSuggestEdits(histImageUrl);
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
        const [lastImage, ...rest] = undoStack;
        setImageUrl(lastImage);
        setUndoStack(rest);
        // We are intentionally not clearing suggestions or prompts here
        toast({
            title: "Undo Successful",
            description: "Reverted to the previous image state.",
        });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Prompt copied to clipboard.",
    });
  };

  const PromptSuggestionSection = ({ title, prompts, onAction, actionLabel, actionIcon }: { title: string, prompts: {title: string, description: string}[], onAction: (prompt: string) => void, actionLabel: string, actionIcon: React.ReactNode }) => (
    <AccordionItem value={title.toLowerCase().replace(/\s/g, '-')}>
      <AccordionTrigger className="text-lg font-semibold">{title}</AccordionTrigger>
      <AccordionContent className="space-y-4">
        {prompts.map((p, index) => (
          <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border/50">
            <h4 className="font-semibold text-primary mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" /> {p.title}</h4>
            <p className="text-muted-foreground whitespace-pre-wrap text-sm mb-4">{p.description}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onAction(p.description)} disabled={isLoading}>
                {actionIcon}
                {actionLabel}
              </Button>
               <Button size="sm" variant="outline" onClick={() => copyToClipboard(p.description)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        ))}
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <div className="min-h-screen flex flex-col items-center bg-background text-foreground py-8 sm:py-12 px-4">
      <header className="flex flex-col items-center text-center gap-3 mb-10">
        <VisionaryLogo />
        <h1 className="text-4xl sm:text-5xl font-extrabold text-primary tracking-tight">
          Visionary
        </h1>
        <p className="text-md sm:text-lg text-muted-foreground max-w-2xl">
          From a simple idea to a masterpiece. Describe your vision or upload an image and let our AI create.
        </p>
      </header>

      <div className="w-full max-w-xl md:max-w-3xl space-y-8">
        <Card className="shadow-2xl rounded-xl bg-card border-border/50">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="prompt" className="text-lg font-semibold mb-2 block">Enter an idea or upload an image</Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  id="prompt"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A dragon in a desert..."
                  disabled={isLoading || isRefining}
                  className="flex-grow text-base p-3 rounded-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerateImage(prompt);
                    }
                  }}
                />
                 <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  onClick={() => handleGenerateImage(prompt)}
                  disabled={isLoading || isRefining || !prompt.trim()}
                  className="w-full sm:w-auto text-base px-6 py-3 rounded-lg font-semibold"
                  size="lg"
                  aria-label="Generate Image"
                >
                  <ArrowRight className="h-5 w-5" />
                  <span className="sm:hidden ml-2">Generate Image</span>
                </Button>
                <Button
                  onClick={handleUploadButtonClick}
                  disabled={isLoading || isRefining}
                  variant="outline"
                  className="w-full sm:w-auto text-base px-4 py-3 rounded-lg font-semibold"
                  size="lg"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  Upload
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        
        {(isLoading || imageUrl || error) && (
          <Card className="shadow-2xl rounded-xl bg-card border-border/50">
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div
                className="aspect-video w-full bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden border border-border/30 shadow-inner relative"
              >
                {isLoading && activeLoader === 'generate' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card/80 backdrop-blur-sm">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-lg text-muted-foreground">Conjuring your vision...</p>
                  </div>
                )}
                 {isLoading && activeLoader !== 'generate' && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card/80 backdrop-blur-sm">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                     <p className="mt-4 text-lg text-muted-foreground">
                       {activeLoader === 'edit' ? 'Refining your vision...' : activeLoader === 'suggest' ? 'Analyzing your image...' : 'Working...'}
                     </p>
                   </div>
                 )}


                {!isLoading && imageUrl && (
                  <NextImage
                    key={imageUrl} 
                    src={imageUrl}
                    alt={isUploadedImage ? "Uploaded image" : (prompt || editPrompt || "Generated image")}
                    layout="fill"
                    objectFit="contain"
                    className="transition-opacity duration-500 ease-in-out"
                    onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                    style={{ opacity: 0 }} 
                    data-ai-hint={isUploadedImage ? "uploaded image" : (prompt ? "generated art" : "edited art")}
                    unoptimized={imageUrl.startsWith('data:')}
                  />
                )}
                 {!isLoading && !imageUrl && error && ( 
                  <div className="text-center text-muted-foreground p-6">
                    <ImageIcon size={60} className="mx-auto mb-4 opacity-30" />
                     <p className="text-lg">Image processing failed.</p>
                  </div>
                )}
              </div>

              {error && !isLoading && (
                <Alert variant="destructive" className="mt-4 border-destructive/70 bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <AlertTitle className="font-semibold">Oops! Something went wrong.</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {imageUrl && !isLoading && (
                 <div className="space-y-6 border-t border-border/50 pt-6 mt-6">
                    {isRefining && (
                      <div className="flex items-center justify-center gap-3 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-lg">Generating suggestions...</p>
                      </div>
                    )}
                    
                    {refinedPrompts && !isRefining && (
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Suggestions to Improve</h3>
                             <Button
                                onClick={() => handleGenerateImage(prompt)}
                                disabled={isRefining || isLoading}
                                variant="outline"
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Regenerate
                              </Button>
                          </div>
                          <Accordion type="single" collapsible className="w-full" defaultValue="basic">
                             {refinedPrompts.basic?.length > 0 && <PromptSuggestionSection title="Basic Refinements" prompts={refinedPrompts.basic} onAction={handleGenerateImage} actionLabel="Generate" actionIcon={<ChevronRight className="mr-2 h-4 w-4" />} />}
                             {refinedPrompts.intermediate?.length > 0 && <PromptSuggestionSection title="Intermediate Refinements" prompts={refinedPrompts.intermediate} onAction={handleGenerateImage} actionLabel="Generate" actionIcon={<ChevronRight className="mr-2 h-4 w-4" />} />}
                             {refinedPrompts.advanced?.length > 0 && <PromptSuggestionSection title="Advanced Refinements" prompts={refinedPrompts.advanced} onAction={handleGenerateImage} actionLabel="Generate" actionIcon={<ChevronRight className="mr-2 h-4 w-4" />} />}
                          </Accordion>
                        </div>
                    )}

                  {suggestedEdits && (
                      <div>
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="text-xl font-bold">Suggested Edits</h3>
                              <Button
                                  onClick={() => imageUrl && handleSuggestEdits(imageUrl)}
                                  disabled={!imageUrl || isLoading}
                                  variant="outline"
                              >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Regenerate
                              </Button>
                          </div>
                          <Accordion type="single" collapsible className="w-full" defaultValue="creative-enhancements">
                              {suggestedEdits.creative?.length > 0 && <PromptSuggestionSection title="Creative Enhancements" prompts={suggestedEdits.creative} onAction={handleEditImage} actionLabel="Apply Edit" actionIcon={<Sparkles className="mr-2 h-4 w-4" />} />}
                              {suggestedEdits.style?.length > 0 && <PromptSuggestionSection title="Style Changes" prompts={suggestedEdits.style} onAction={handleEditImage} actionLabel="Apply Edit" actionIcon={<Sparkles className="mr-2 h-4 w-4" />} />}
                              {suggestedEdits.improvements?.length > 0 && <PromptSuggestionSection title="Technical Improvements" prompts={suggestedEdits.improvements} onAction={handleEditImage} actionLabel="Apply Edit" actionIcon={<Sparkles className="mr-2 h-4 w-4" />} />}
                          </Accordion>
                      </div>
                  )}

                   <div className="space-y-4">
                     <div>
                       <Label htmlFor="editPrompt" className="text-lg font-semibold mb-2 block">Refine with your own prompt</Label>
                       <div className="flex flex-col sm:flex-row gap-3">
                         <Input
                           id="editPrompt"
                           type="text"
                           value={editPrompt}
                           onChange={(e) => setEditPrompt(e.target.value)}
                           placeholder="e.g., Make the sky a vibrant sunset"
                           disabled={isLoading}
                           className="flex-grow text-base p-3 rounded-lg"
                         />
                         <Button
                           onClick={() => handleEditImage()}
                           disabled={isLoading || !editPrompt.trim()}
                           variant="outline"
                           className="w-full sm:w-auto text-base px-6 py-3 rounded-lg font-semibold border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                           size="lg"
                         >
                           {isLoading && activeLoader === 'edit' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                           Apply AI Edit
                         </Button>
                       </div>
                     </div>
                   </div>

                  <div className="flex flex-wrap gap-3 justify-center pt-4 border-t border-border/50">
                    <Button variant="outline" onClick={handleDownloadImage} className="rounded-lg text-base">
                      <Download className="mr-2 h-4 w-4" /> Download
                    </Button>
                    <Button
                      onClick={handleUndo}
                      disabled={isLoading || undoStack.length === 0}
                      variant="outline"
                      className="text-base rounded-lg font-semibold"
                    >
                      <Undo className="mr-2 h-5 w-5" />
                      Undo
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="rounded-lg text-base hover:border-destructive/50 hover:text-destructive">
                      <RotateCcw className="mr-2 h-4 w-4" /> Reset
                    </Button>
                    {imageHistory.length > 0 && (
                       <Button onClick={() => setIsHistorySheetOpen(true)} variant="outline" size="lg" className="font-semibold rounded-lg text-base">
                          <HistoryIcon className="mr-2 h-5 w-5" />
                          History
                       </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Image History</SheetTitle>
            <SheetDescription>
              Previously generated or edited images. Click an image to load it. Limited to the last {MAX_HISTORY_LENGTH} images due to browser storage.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-grow overflow-y-auto p-6">
            {imageHistory.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {imageHistory.map((histImg, index) => (
                  <button
                    key={`${histImg.substring(0,100)}-${index}`} 
                    onClick={() => handleHistoryImageClick(histImg)}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary focus:outline-none shadow-md hover:shadow-lg transition-all duration-200 relative group"
                    aria-label={`Load image from history`}
                  >
                    <NextImage
                      src={histImg}
                      alt={`History image`}
                      layout="fill"
                      objectFit="cover"
                      className="transition-transform duration-200 group-hover:scale-105"
                      data-ai-hint="past image"
                      unoptimized={histImg.startsWith('data:')}
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <RotateCcw size={24} className="text-white" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground mt-10">Your image history is currently empty.</p>
            )}
          </div>
           <SheetFooter className="p-4 border-t mt-auto bg-card">
             <SheetClose asChild>
                <Button variant="outline">Close</Button>
             </SheetClose>
           </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
