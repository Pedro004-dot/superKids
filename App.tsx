
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import jsPDF from 'jspdf';
import { MAX_STORY_PAGES, BACK_COVER_PAGE, TOTAL_PAGES, INITIAL_PAGES, BATCH_SIZE, GENRES, TONES, ComicFace, Beat, Persona, TokenStats, GATE_PAGE } from './types';
import { Setup } from './Setup';
import { Book } from './Book';
import { useApiKey } from './useApiKey';
import { ApiKeyDialog } from './ApiKeyDialog';
import { AdminPage } from './AdminPage';

// --- Constants ---
const MODEL_V3 = "gemini-3-pro-image-preview";
const MODEL_IMAGE_GEN_NAME = MODEL_V3;
const MODEL_TEXT_NAME = MODEL_V3;

// --- Components ---

const LogoText = ({ size = "text-2xl" }: { size?: string }) => (
  <div className="relative flex items-center leading-none group mr-4">
     <span className={`font-comic ${size} text-red-600 tracking-wide`} style={{ textShadow: '1px 1px 0px black' }}>SUPER</span>
     <span className={`font-comic ${size} text-yellow-400 tracking-wide ml-1`} style={{ textShadow: '1px 1px 0px black' }}>KIDS</span>
  </div>
);

const Navbar = ({ activeTab, onTabChange, credits, isGenerating }: { activeTab: string, onTabChange: (t: string) => void, credits: number, isGenerating: boolean }) => {
  const generatedCount = 4 - credits;
  const progressPercent = (generatedCount / 4) * 100;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavClick = (tab: string) => {
    onTabChange(tab);
    setIsMenuOpen(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-black text-white flex items-center justify-between px-4 z-[1000] border-b-4 border-yellow-400 shadow-lg font-comic">
      <div className="flex items-center gap-4 cursor-pointer pt-1" onClick={() => handleNavClick('create')}>
        <LogoText />
      </div>
      
      {/* Mobile Hamburger Button */}
      <button 
        className="md:hidden text-yellow-400 p-2 focus:outline-none"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {/* Navigation Links (Desktop: Row, Mobile: Dropdown) */}
      <div className={`${isMenuOpen ? 'flex flex-col absolute top-16 left-0 right-0 bg-black border-b-4 border-yellow-400 p-6 gap-6 shadow-xl' : 'hidden'} md:flex md:flex-row md:static md:bg-transparent md:border-none md:p-0 md:gap-6 md:shadow-none transition-all z-50`}>
        <button onClick={() => handleNavClick('create')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'create' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'}`}>Criar</button>
        <button onClick={() => handleNavClick('read')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'read' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'} flex items-center gap-2`}>
          Ler
          {isGenerating && <span className="animate-spin text-yellow-400 text-xs">★</span>}
        </button>
        <button onClick={() => handleNavClick('gallery')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'gallery' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'}`}>Galeria</button>
        <button onClick={() => handleNavClick('profile')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'profile' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'}`}>Perfil</button>
      </div>

      {/* Progress Bar (Always visible on desktop, hidden on very small mobile if needed, but usually fits) */}
      <div className="flex flex-col items-end w-24 md:w-48 hidden sm:flex">
         <div className="text-[10px] md:text-xs uppercase text-gray-400 mb-1">{generatedCount}/4 LIVRINHOS CRIADOS</div>
         <div className="w-full h-4 bg-gray-800 border border-gray-600 rounded-full overflow-hidden relative">
            <div 
              className="absolute left-0 top-0 bottom-0 bg-yellow-400 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
         </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- API Key Hook ---
  const { validateApiKey, setShowApiKeyDialog, showApiKeyDialog, handleApiKeyDialogContinue } = useApiKey();

  // --- Global State ---
  const [activeTab, setActiveTab] = useState('create');
  const [credits, setCredits] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Story State ---
  const [hero, setHeroState] = useState<Persona | null>(null);
  const [heroName, setHeroName] = useState("");
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [customPremise, setCustomPremise] = useState("");
  const [storyTone, setStoryTone] = useState(TONES[0]);
  
  // --- Token Tracking State ---
  const [tokenStats, setTokenStats] = useState<TokenStats>({ input: 0, output: 0, totalRequests: 0, model: MODEL_V3 });
  const [showAdmin, setShowAdmin] = useState(false);

  const heroRef = useRef<Persona | null>(null);
  const friendRef = useRef<Persona | null>(null);

  const setHero = (p: Persona | null) => { setHeroState(p); heroRef.current = p; };
  
  const [comicFaces, setComicFaces] = useState<ComicFace[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  
  const generatingPages = useRef(new Set<number>());
  const historyRef = useRef<ComicFace[]>([]);

  // --- AI Helpers ---
  const getAI = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  };

  const trackUsage = (usageMetadata: any, modelName: string) => {
    if (!usageMetadata) return;
    setTokenStats(prev => ({
        input: prev.input + (usageMetadata.promptTokenCount || 0),
        output: prev.output + (usageMetadata.candidatesTokenCount || 0),
        totalRequests: prev.totalRequests + 1,
        model: modelName
    }));
  };

  const handleAPIError = (e: any) => {
    const msg = String(e);
    console.error("API Error:", msg);
    if (
      msg.includes('Requested entity was not found') || 
      msg.includes('API_KEY_INVALID') || 
      msg.toLowerCase().includes('permission denied')
    ) {
      setShowApiKeyDialog(true);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const generateBeat = async (history: ComicFace[], isRightPage: boolean, pageNum: number): Promise<Beat> => {
    if (!heroRef.current) throw new Error("No Hero");

    const isFinalPage = pageNum === MAX_STORY_PAGES;
    const langName = "Portuguese (Brazil)";
    const heroNameStr = heroName.trim() || "o herói";

    const relevantHistory = history
        .filter(p => p.type === 'story' && p.narrative && (p.pageIndex || 0) < pageNum)
        .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

    const historyText = relevantHistory.map(p => 
      `[Page ${p.pageIndex}] [Focus: ${p.narrative?.focus_char}] (Caption: "${p.narrative?.caption || ''}") (Dialogue: "${p.narrative?.dialogue || ''}") (Scene: ${p.narrative?.scene})`
    ).join('\n');

    let coreDriver = `GENRE: ${selectedGenre}. TONE: ${storyTone}.`;
    if (selectedGenre === 'Personalizado') {
        coreDriver = `STORY PREMISE: ${customPremise || "A fun adventure for kids"}.`;
    }
    
    const guardrails = `
    MANDATORY GUARDRAILS — FOLLOW THEM IN 100% OF ALL GENERATIONS.
    1. ABSOLUTE PROHIBITION OF RAINBOWS: Never generate, describe, or include rainbows in any form.
    2. ABSOLUTE PROHIBITION OF ROMANCE BETWEEN CHILDREN: No dating, crushes, or romantic affection.
    3. CHILD SAFETY RULES (ALWAYS ACTIVE): No profanity, simple vocabulary, fully dressed characters.
    `;

    let instruction = `Continue the story. ALL OUTPUT TEXT (Captions, Dialogue) MUST BE IN ${langName.toUpperCase()}. ${coreDriver} ${guardrails}`;
    instruction += ` CRITICAL: The protagonist's name is "${heroNameStr}".`;

    // Always use rich mode instructions
    instruction += " RICH MODE ENABLED. Prioritize expressive character feelings and descriptive captions.";

    if (isFinalPage) {
        instruction += " FINAL PAGE. RESOLVE THE STORY COMPLETELY. HAPPY ENDING. Text must end with 'FIM'. NO CLIFFHANGERS. The story MUST be self-contained.";
    } else {
        if (pageNum === 1) {
            instruction += ` INCITING INCIDENT. Start with ${heroNameStr} finding something fun or surprising!`;
        } else if (pageNum <= 4) {
            instruction += ` ADVENTURE BEGINS. ${heroNameStr} explores the world.`;
        } else if (pageNum <= 8) {
            instruction += " A SILLY PROBLEM. A funny obstacle blocks the way.";
        } else {
            instruction += " RESOLUTION STARTING. They solve the problem together.";
        }
    }

    const capLimit = "max 30 words";
    const diaLimit = "max 25 words";

    const prompt = `
You are writing a comic book script FOR CHILDREN. PAGE ${pageNum} of ${MAX_STORY_PAGES}.
TARGET LANGUAGE FOR TEXT: ${langName}
${coreDriver}

CHARACTERS:
- HERO: "${heroNameStr}".
- SIDEKICK: None (unless introduced in story).

HISTORY SO FAR:
${historyText}

INSTRUCTIONS:
${instruction}

OUTPUT JSON ONLY:
{
  "caption": "Narrative text (${capLimit}).",
  "dialogue": "Character speech (${diaLimit}).",
  "scene": "Visual description of the panel scene.",
  "focus_char": "hero" or "friend" or "other"
}
`;

    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_TEXT_NAME,
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      }
    });

    trackUsage(result.usageMetadata, MODEL_TEXT_NAME);
    
    const text = result.text;
    if (!text) throw new Error("No text generated");

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error", text);
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
             try { return JSON.parse(jsonMatch[1]); } catch(e2) {}
        }
        return { caption: "", dialogue: "", scene: "A fun adventure scene.", focus_char: "hero" };
    }
  };

  const generateImage = async (beat: Beat, pageNum: number): Promise<string> => {
    if (!heroRef.current) throw new Error("No Hero");
    const ai = getAI();
    
    const visualGuardrails = "CRITICAL EXCLUSIONS: NO RAINBOWS, NO MULTICOLOR ARCS, NO ROMANTIC GESTURES, NO KISSING, NO HEARTS. Photorealistic, cinematic lighting, 8k resolution, comic book style.";

    let prompt = `Comic book panel, ${selectedGenre} style. ${visualGuardrails} Scene: ${beat.scene}.`;
    
    if (beat.focus_char === 'hero' || beat.focus_char === 'other') {
       prompt += ` The main character is a child named ${heroName}.`;
    }
    
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: heroRef.current.base64 } }
    ];

    const result = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN_NAME,
      contents: [{ role: 'user', parts }],
      config: {
          temperature: 0.4
      }
    });

    trackUsage(result.usageMetadata, MODEL_IMAGE_GEN_NAME);

    for (const part of result.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated");
  };

  // --- Main Orchestration ---
  const launchStory = async () => {
      const isValid = await validateApiKey();
      if (!isValid) return;

      if (!heroRef.current || credits <= 0) return;

      setCredits(c => c - 1);
      setIsGenerating(true);
      setActiveTab('read');
      setCurrentSheetIndex(0);

      const initialFaces: ComicFace[] = [];
      initialFaces.push({ id: 'cover', type: 'cover', isLoading: true, pageIndex: 0 });
      for (let i = 1; i <= MAX_STORY_PAGES; i++) {
          initialFaces.push({ id: `page-${i}`, type: 'story', isLoading: true, pageIndex: i });
      }
      initialFaces.push({ id: 'back', type: 'back_cover', isLoading: true, pageIndex: BACK_COVER_PAGE });
      
      setComicFaces(initialFaces);
      historyRef.current = [];

      (async () => {
          try {
            const coverPrompt = { scene: `Epic comic book cover for a ${selectedGenre} story starring ${heroName}. Action pose, title text 'SUPER ${heroName}' at top.`, focus_char: 'hero' } as Beat;
            const coverImg = await generateImage(coverPrompt, 0);
            
            setComicFaces(prev => prev.map(f => f.type === 'cover' ? { ...f, isLoading: false, imageUrl: coverImg } : f));

            for (let i = 1; i <= MAX_STORY_PAGES; i++) {
                const beat = await generateBeat(historyRef.current, i % 2 === 0, i);
                setComicFaces(prev => prev.map(f => f.pageIndex === i ? { ...f, narrative: beat } : f));

                const img = await generateImage(beat, i);
                const finishedFace: ComicFace = {
                    id: `page-${i}`,
                    type: 'story',
                    isLoading: false,
                    pageIndex: i,
                    imageUrl: img,
                    narrative: beat
                };
                historyRef.current.push(finishedFace);
                setComicFaces(prev => prev.map(f => f.pageIndex === i ? finishedFace : f));
            }

            const backPrompt = { scene: `The end of the adventure. ${heroName} waving goodbye. Text 'FIM' in the sky. Warm colors.`, focus_char: 'hero' } as Beat;
            const backImg = await generateImage(backPrompt, 11);
            setComicFaces(prev => prev.map(f => f.type === 'back_cover' ? { ...f, isLoading: false, imageUrl: backImg } : f));

          } catch (e) {
              console.error("Generation Error", e);
              handleAPIError(e);
          } finally {
              setIsGenerating(false);
          }
      })();
  };

  const handleDownload = () => {
    const doc = new jsPDF();
    let x = 10, y = 10;
    doc.setFontSize(20);
    doc.text(`Aventuras de ${heroName}`, 10, 10);
    y += 20;

    comicFaces.filter(f => f.imageUrl).forEach((f, i) => {
        if (i > 0 && i % 2 === 0) {
            doc.addPage();
            y = 10;
        }
        if (f.imageUrl) {
            doc.addImage(f.imageUrl, 'JPEG', x, y, 80, 80);
            if (f.narrative) {
                doc.setFontSize(10);
                const caption = doc.splitTextToSize(f.narrative.caption || "", 80);
                doc.text(caption, x, y + 85);
            }
            x += 90;
            if (x > 100) { x = 10; y += 110; }
        }
    });
    doc.save("SuperKids_Comic.pdf");
  };

  // --- Render ---

  // Sheet Navigation
  const prevPage = () => {
     if (currentSheetIndex > 0) setCurrentSheetIndex(p => p - 1);
  };
  const nextPage = () => {
     if (currentSheetIndex < Math.ceil(TOTAL_PAGES / 2)) setCurrentSheetIndex(p => p + 1);
  };

  // Status computation for display
  const generatedPagesCount = comicFaces.filter(f => f.type === 'story' && f.imageUrl).length;
  
  return (
    <div className="min-h-screen bg-[#222] font-comic relative">
      <Navbar 
         activeTab={activeTab} 
         onTabChange={setActiveTab} 
         credits={credits} 
         isGenerating={isGenerating} 
      />
      
      <div className="pt-20 pb-10 container mx-auto px-4 min-h-[calc(100vh-80px)]">
        
        {/* CREATE TAB */}
        {activeTab === 'create' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Setup 
                  hero={hero}
                  heroName={heroName}
                  selectedGenre={selectedGenre}
                  customPremise={customPremise}
                  onHeroUpload={(f) => {
                     fileToBase64(f).then(b64 => setHero({ base64: b64, desc: "Hero" }));
                  }}
                  onHeroNameChange={setHeroName}
                  onGenreChange={setSelectedGenre}
                  onPremiseChange={setCustomPremise}
                  onLaunch={launchStory}
                  isGenerating={isGenerating}
                />
             </div>
        )}

        {/* READ TAB - The Result View */}
        {activeTab === 'read' && (
            <div className="flex flex-col lg:flex-row items-center justify-start lg:justify-center lg:gap-24 gap-4 w-full h-full min-h-0 lg:min-h-[80vh] animate-in zoom-in duration-300 pt-4 lg:pt-0">
                {comicFaces.length === 0 ? (
                    <div className="text-white text-center opacity-50 mt-20">
                        <p className="text-4xl mb-4">Nenhum livrinho criado ainda...</p>
                        <button onClick={() => setActiveTab('create')} className="comic-btn bg-yellow-400 px-6 py-2 text-xl">CRIAR AGORA</button>
                    </div>
                ) : (
                    <>
                        {/* Wrapper for Book and Arrows */}
                        <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-6 relative w-full lg:w-auto">
                            {/* LEFT ARROW (Desktop only) */}
                            <button 
                                onClick={prevPage}
                                disabled={currentSheetIndex === 0}
                                className="hidden lg:flex w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] items-center justify-center hover:translate-y-1 hover:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed z-20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            {/* The Book Container */}
                            <div className="comic-scene">
                                <Book 
                                    comicFaces={comicFaces}
                                    currentSheetIndex={currentSheetIndex}
                                    isStarted={true}
                                    isSetupVisible={false}
                                    onSheetClick={() => {}} // Disable click on pages
                                    onChoice={() => {}}
                                    onOpenBook={() => {}}
                                    onDownload={handleDownload}
                                    onReset={() => {}}
                                />
                            </div>

                            {/* RIGHT ARROW (Desktop only) */}
                            <button 
                                onClick={nextPage}
                                disabled={currentSheetIndex >= Math.ceil(TOTAL_PAGES / 2)}
                                className="hidden lg:flex w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] items-center justify-center hover:translate-y-1 hover:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed z-20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            {/* MOBILE ARROWS ROW (Mobile only) */}
                            <div className="flex lg:hidden items-center justify-center gap-6 mt-4 mb-2">
                                <button 
                                    onClick={prevPage}
                                    disabled={currentSheetIndex === 0}
                                    className="w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={nextPage}
                                    disabled={currentSheetIndex >= Math.ceil(TOTAL_PAGES / 2)}
                                    className="w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Options Panel (Right Side Card on Desktop, Bottom on Mobile) */}
                        <div className="w-[95%] max-w-[340px] lg:w-[340px] bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-6 rotate-0 lg:rotate-1 flex flex-col items-center text-center mb-8 lg:mb-0">
                            <h3 className="font-comic text-3xl text-black border-b-4 border-black w-full pb-2 mb-4">OPÇÕES</h3>
                            
                            <div className="flex flex-col items-center mb-6 w-full min-h-[100px] justify-center">
                                {isGenerating ? (
                                    <>
                                        <div className="text-4xl mb-2 animate-bounce">⏳</div>
                                        <p className="font-comic text-sm text-gray-600 leading-tight uppercase">
                                            SEU GIBI ESTÁ SENDO GERADO.<br/>
                                            AGUARDE ATÉ QUE TODAS AS PÁGINAS ESTEJAM PRONTAS.
                                        </p>
                                    </>
                                ) : (
                                    <div className="py-4">
                                        <p className="font-comic text-xl text-green-600 animate-pulse">✓ EDIÇÃO COMPLETA!</p>
                                    </div>
                                )}
                            </div>

                            <div className="w-full flex flex-col gap-4">
                                {/* Progress Button */}
                                <div 
                                    className="w-full py-3 border-4 border-black font-comic text-xl uppercase shadow-[0px_4px_0px_#000] flex items-center justify-center transition-colors duration-500"
                                    style={{
                                        backgroundColor: `hsl(${45 - (generatedPagesCount / MAX_STORY_PAGES) * 45}, 100%, 50%)`,
                                        color: 'white',
                                        textShadow: '2px 2px 0px black'
                                    }}
                                >
                                    {generatedPagesCount} / {MAX_STORY_PAGES} PÁGINAS
                                </div>

                                <button 
                                    onClick={handleDownload}
                                    disabled={isGenerating}
                                    className={`w-full py-3 border-4 font-comic text-xl uppercase transition-all ${
                                        isGenerating 
                                        ? 'bg-[#cdcdcd] border-[#999] text-gray-500 shadow-[0px_4px_0px_#999] cursor-not-allowed'
                                        : 'bg-blue-500 border-black text-white hover:bg-blue-400 shadow-[0px_4px_0px_#000] active:translate-y-1 active:shadow-none'
                                    }`}
                                >
                                    BAIXAR PDF
                                </button>

                                <button 
                                    onClick={() => {
                                        setComicFaces([]);
                                        setHero(null);
                                        setActiveTab('create');
                                    }}
                                    disabled={isGenerating}
                                    className={`w-full py-3 border-4 font-comic text-xl uppercase transition-all ${
                                        isGenerating 
                                        ? 'bg-[#cdcdcd] border-[#999] text-gray-500 shadow-[0px_4px_0px_#999] cursor-not-allowed'
                                        : 'bg-yellow-400 border-black text-black hover:bg-yellow-300 shadow-[0px_4px_0px_#000] active:translate-y-1 active:shadow-none'
                                    }`}
                                >
                                    CRIAR NOVA EDIÇÃO
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
            <div className="text-center text-white pt-20">
                <h2 className="text-4xl mb-4">Galeria de Heróis</h2>
                <p>Seus livrinhos aparecerão aqui em breve.</p>
                {comicFaces.length > 0 && (
                    <button onClick={() => setActiveTab('read')} className="mt-8 comic-btn bg-white text-black px-6 py-3">Ver Livro Atual</button>
                )}
            </div>
        )}
        
         {/* PROFILE TAB */}
         {activeTab === 'profile' && (
            <div className="text-center text-white pt-20">
                <h2 className="text-4xl mb-4">Perfil do Super Autor</h2>
                <p className="text-2xl text-yellow-400">{credits}/4 Créditos Restantes</p>
            </div>
        )}

      </div>

      {/* Footer Admin Toggle */}
      <div className="fixed bottom-2 left-2 z-[2000] opacity-50 hover:opacity-100 transition-opacity">
          <button onClick={() => setShowAdmin(true)} className="text-[10px] text-gray-600 bg-white/20 px-2 rounded">Admin</button>
      </div>

      {/* Dialogs */}
      {showApiKeyDialog && <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />}
      {showAdmin && <AdminPage stats={tokenStats} onClose={() => setShowAdmin(false)} onReset={() => setTokenStats({input:0, output:0, totalRequests:0, model: MODEL_V3})} />}
    
    </div>
  );
};

export default App;
