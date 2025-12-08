
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import jsPDF from 'jspdf';
import { MAX_STORY_PAGES, BACK_COVER_PAGE, TOTAL_PAGES, INITIAL_PAGES, BATCH_SIZE, GENRES, TONES, ComicFace, Beat, Persona, TokenStats, GATE_PAGE, VisualStyleBase, CompleteStory } from './types';
import { Setup } from './Setup';
import { Book } from './Book';
import { useApiKey } from './useApiKey';
import { ApiKeyDialog } from './ApiKeyDialog';
import { AdminPage } from './AdminPage';
import { AuthPage } from './AuthPage';
import { LandingPage } from './LandingPage';
import { Gallery } from './Gallery';
import { ProfileTab } from './ProfileTab';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

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

const Navbar = ({ activeTab, onTabChange, credits, isGenerating, user, onLogout }: { activeTab: string, onTabChange: (t: string) => void, credits: number, isGenerating: boolean, user: any, onLogout: () => void }) => {
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
        <button onClick={onLogout} className="text-xl md:text-xl uppercase hover:text-red-400 transition-colors text-left md:text-center text-gray-300">Sair</button>
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Story State ---
  const [hero, setHeroState] = useState<Persona | null>(null);
  const [heroName, setHeroName] = useState("");
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [customPremise, setCustomPremise] = useState("");
  const [storyTone, setStoryTone] = useState(TONES[0]);
  
  // --- Series State ---
  const [comicType, setComicType] = useState<'single' | 'series'>('single');
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesParts, setSeriesParts] = useState(4);
  const [currentSeriesId, setCurrentSeriesId] = useState<string | null>(null);
  
  // --- Token Tracking State ---
  const [tokenStats, setTokenStats] = useState<TokenStats>({ input: 0, output: 0, totalRequests: 0, model: MODEL_V3 });
  const [showAdmin, setShowAdmin] = useState(false);

  // --- Authentication State ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  const heroRef = useRef<Persona | null>(null);
  const friendRef = useRef<Persona | null>(null);
  const coverRef = useRef<ComicFace | null>(null);

  const setHero = (p: Persona | null) => { setHeroState(p); heroRef.current = p; };
  
  const [comicFaces, setComicFaces] = useState<ComicFace[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  
  const generatingPages = useRef(new Set<number>());
  const historyRef = useRef<ComicFace[]>([]);

  // --- Profile Stats ---
  const [totalComics, setTotalComics] = useState(0);

  useEffect(() => {
    if (user) {
      // Carregar estatísticas do perfil
      supabase
        .from('comics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => {
          setTotalComics(count || 0);
        });
    }
  }, [user]);

  // --- Authentication Effects ---
  useEffect(() => {
    let isMounted = true;
    
    // Timeout de segurança para garantir que authLoading seja desativado
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Timeout na verificação de autenticação - desativando loading');
        console.warn('[Auth] Isso pode indicar problema de conexão com Supabase ou credenciais inválidas');
        setAuthLoading(false);
        if (!user) {
          setShowLanding(true);
          setShowLogin(false);
        }
      }
    }, 10000); // Aumentado para 10 segundos para dar mais tempo

    // Verificar sessão atual
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!isMounted) return;
        
        if (error) {
          console.error('Erro ao verificar sessão:', error);
          setAuthLoading(false);
          setUser(null);
          setShowLanding(true);
          setShowLogin(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          setShowLanding(false);
          setShowLogin(false);
          // Carregar créditos do perfil
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('credits')
              .eq('id', session.user.id)
              .single();
            if (profile && !profileError) {
              setCredits(profile.credits);
            }
          } catch (err) {
            console.error('Erro ao carregar perfil:', err);
            // Continuar mesmo se falhar ao carregar créditos
          }
        } else {
          setUser(null);
          setShowLanding(true);
          setShowLogin(false);
        }
        setAuthLoading(false);
        clearTimeout(timeoutId);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Erro ao verificar sessão:', err);
        setAuthLoading(false);
        setUser(null);
        setShowLanding(true);
        setShowLogin(false);
        clearTimeout(timeoutId);
      });

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      if (session?.user) {
        setUser(session.user);
        setShowLanding(false);
        setShowLogin(false);
        setAuthLoading(false);
        // Carregar créditos do perfil
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', session.user.id)
            .single();
          if (profile) {
            setCredits(profile.credits);
          }
        } catch (err) {
          console.error('Erro ao carregar perfil:', err);
        }
      } else {
        setUser(null);
        setShowLanding(true);
        setShowLogin(false);
        setCredits(4); // Reset créditos quando deslogar
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActiveTab('create');
    setComicFaces([]);
    setHero(null);
    setShowLanding(true);
    setShowLogin(false);
  };

  const handleGetStarted = () => {
    setShowLanding(false);
    setShowLogin(true);
  };

  const handleAuthSuccess = () => {
    setShowLogin(false);
    setShowLanding(false);
    // O useEffect vai atualizar o user automaticamente
  };

  // --- AI Helpers ---
  const getAI = () => {
    // Tentar obter API key de diferentes fontes
    const apiKey = (process.env as any)?.API_KEY || 
                   (process.env as any)?.GEMINI_API_KEY ||
                   (import.meta as any).env?.GEMINI_API_KEY ||
                   (window as any).__GEMINI_API_KEY__;
    
    if (!apiKey) {
      throw new Error('API Key não encontrada. Por favor, configure a chave da API do Gemini.');
    }
    
    return new GoogleGenAI({ apiKey });
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
    
    // Erro 429 - Quota excedida
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('Quota exceeded')) {
      const errorObj = e?.error || (typeof e === 'object' && e?.error ? e.error : null);
      let retryDelay = '';
      let retrySeconds = 60;
      
      try {
        if (errorObj?.details && Array.isArray(errorObj.details)) {
          const retryInfo = errorObj.details.find((d: any) => d['@type']?.includes('RetryInfo'));
          if (retryInfo?.retryDelay) {
            retrySeconds = Math.ceil(parseInt(retryInfo.retryDelay) || 60);
            retryDelay = ` Por favor, tente novamente em ${retrySeconds} segundos.`;
          }
        }
      } catch (parseErr) {
        // Ignorar erros de parsing
      }
      
      setErrorMessage(
        `⚠️ COTA DA API EXCEDIDA!\n\n` +
        `O modelo Gemini 3 Pro Image requer um plano pago com faturamento ativado no Google Cloud.${retryDelay}\n\n` +
        `SOLUÇÕES:\n` +
        `1. Ative o faturamento: https://console.cloud.google.com/billing\n` +
        `2. Aguarde ${retrySeconds} segundos e tente novamente\n` +
        `3. Verifique seu uso: https://ai.dev/usage`
      );
      setIsGenerating(false);
      return;
    }
    
    // Erros de autenticação/chave API
    if (
      msg.includes('Requested entity was not found') || 
      msg.includes('API_KEY_INVALID') || 
      msg.toLowerCase().includes('permission denied')
    ) {
      setShowApiKeyDialog(true);
      setIsGenerating(false);
      return;
    }
    
    // Outros erros
    const errorPreview = msg.length > 200 ? msg.substring(0, 200) + '...' : msg;
    setErrorMessage(`Erro ao gerar gibi:\n${errorPreview}`);
    setIsGenerating(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- Style Base System ---
  const styleBaseRef = useRef<VisualStyleBase | null>(null);

  const createStyleDefinition = (
    genre: string,
    tone: string
  ): VisualStyleBase => {
    const styleMap: Record<string, VisualStyleBase> = {
      'Aventura de Super-herói': {
        art_style: 'Classic American comic book style (Marvel/DC inspired) - bold, dynamic, action-oriented. NOT Disney style, NOT cartoon style.',
        color_palette: 'Vibrant primary colors (red, blue, yellow) with high contrast. No pastels, no soft colors.',
        line_style: 'Bold black outlines, thick lines, strong definition',
        lighting_style: 'Cinematic lighting, dramatic shadows, clear light sources',
        character_rendering: 'Semi-realistic proportions, expressive poses, dynamic action lines',
      },
      'Reino Mágico': {
        art_style: 'Fantasy illustration style - whimsical but NOT Disney-like, more like European comic books (Tintin style)',
        color_palette: 'Rich jewel tones (emerald, sapphire, ruby), warm magical glows, NO rainbows',
        line_style: 'Elegant flowing lines, medium weight, graceful curves',
        lighting_style: 'Soft gradients with magical light sources, ethereal glow effects',
        character_rendering: 'Stylized but consistent, expressive faces, magical elements',
      },
      'Mistério na Escola': {
        art_style: 'Realistic comic book style - clean lines, detailed backgrounds, mystery comic aesthetic (like Tintin or classic detective comics)',
        color_palette: 'Muted but clear colors, good contrast for readability, school-appropriate palette',
        line_style: 'Clean, precise lines, medium weight, clear definition',
        lighting_style: 'Natural lighting with some dramatic shadows for mystery atmosphere',
        character_rendering: 'Realistic proportions, expressive faces, attention to detail',
      },
      'Viagem Espacial': {
        art_style: 'Sci-fi comic book style - futuristic but accessible, bold and dynamic, space adventure aesthetic',
        color_palette: 'Deep space colors (blues, purples, blacks) with bright accent colors (yellows, greens) for technology',
        line_style: 'Bold lines with some technical details, strong definition',
        lighting_style: 'Dramatic space lighting, bright stars, glowing technology',
        character_rendering: 'Semi-realistic with sci-fi elements, expressive poses',
      },
      'Amigos Animais': {
        art_style: 'Friendly comic book style - warm and approachable, NOT Disney-like, more like classic children\'s book illustrations',
        color_palette: 'Warm, friendly colors (oranges, greens, browns), natural tones, NO rainbows',
        line_style: 'Soft but clear lines, medium weight, friendly appearance',
        lighting_style: 'Bright, cheerful lighting, natural outdoor feel',
        character_rendering: 'Friendly, expressive characters, warm interactions',
      },
      'Esportes Radicais': {
        art_style: 'Dynamic action comic style - high energy, movement-focused, sports comic aesthetic',
        color_palette: 'Energetic colors (bright reds, blues, greens), high contrast for action',
        line_style: 'Bold, dynamic lines, action lines, strong definition',
        lighting_style: 'Bright outdoor lighting, action-focused compositions',
        character_rendering: 'Dynamic poses, action-oriented, expressive movement',
      },
      'Conto de Fadas Moderno': {
        art_style: 'Modern fairy tale illustration style - classic but contemporary, NOT Disney-like, more like European storybook art',
        color_palette: 'Rich, storybook colors (deep blues, purples, golds), warm tones, NO rainbows',
        line_style: 'Elegant lines, medium weight, storybook aesthetic',
        lighting_style: 'Magical but natural lighting, warm and inviting',
        character_rendering: 'Stylized but consistent, expressive, storybook characters',
      },
      'Comédia Maluca': {
        art_style: 'Cartoon comic style - exaggerated but NOT Disney-like, more like classic newspaper comics or modern webcomics',
        color_palette: 'Bright, fun colors, high contrast, playful palette',
        line_style: 'Bold, expressive lines, exaggerated features, clear definition',
        lighting_style: 'Bright, cheerful lighting, comedic compositions',
        character_rendering: 'Exaggerated expressions, comedic poses, fun interactions',
      },
    };
    
    return styleMap[genre] || styleMap['Aventura de Super-herói'];
  };

  // --- Content Guardrails ---
  const CONTENT_GUARDRAILS = `
MANDATORY CONTENT SAFETY RULES (AGES 5-12):
1. ABSOLUTE PROHIBITIONS:
   - NO profanity, swear words, or inappropriate language
   - NO sexual content, references, or innuendos
   - NO romantic relationships between children
   - NO LGBT themes, references, or content
   - NO violence beyond cartoon-style action
   - NO rainbows or multicolor arcs
   - NO kissing, hearts, or romantic gestures

2. LANGUAGE REQUIREMENTS:
   - Simple vocabulary appropriate for ages 5-12
   - Positive, educational, and age-appropriate
   - Focus on friendship, adventure, and learning
   - Encouraging and uplifting messages

3. CHARACTER INTERACTIONS:
   - Only friendship-based relationships
   - No romantic or dating content
   - Positive role models
   - Respectful and kind interactions
`;

  const VISUAL_GUARDRAILS = `
## VISUAL CONTENT GUARDRAILS (AGES 5-12):

### ABSOLUTE PROHIBITIONS:
1. NO RAINBOWS: Never generate rainbows, rainbow colors, or rainbow-like effects
2. NO ROMANTIC GESTURES: No kissing, hugging in romantic context, hearts, or love symbols
3. NO INAPPROPRIATE CONTENT: No suggestive poses, revealing clothing, or adult themes
4. NO VIOLENCE: No weapons, fighting, or aggressive imagery
5. NO SCARY IMAGES: No monsters, horror elements, or frightening visuals

### REQUIRED VISUAL STANDARDS:
1. AGE-APPROPRIATE APPEARANCE: All characters must look like children (5-12 years)
2. APPROPRIATE CLOTHING: Fully dressed, school-appropriate attire
3. POSITIVE EXPRESSIONS: Happy, excited, determined - never sad, angry, or scared
4. SAFE ENVIRONMENTS: Bright, safe-looking settings
5. FRIENDLY CHARACTERS: All characters must appear friendly and approachable
`;

  // Função para otimizar histórico (reduz tokens mantendo contexto)
  const getOptimizedHistory = (history: ComicFace[], currentPage: number, heroNameStr: string): string => {
    if (history.length === 0) {
      return 'This is the first page of the story.';
    }

    if (currentPage <= 3) {
      // Primeiras páginas: histórico completo mas conciso
      return history.map(p => {
        const panels = p.narrative?.panels || [];
        if (panels.length > 0) {
          return `Página ${p.pageIndex}: ${panels.map(panel => panel.scene).join(' → ')}`;
        }
        return `Página ${p.pageIndex}: ${p.narrative?.scene || 'Aventura continua'}`;
      }).join('\n');
    } else {
      // Páginas posteriores: resumo + contexto recente
      const firstPage = history[0];
      const recentPages = history.slice(-2);
      
      const firstScene = firstPage?.narrative?.panels?.[0]?.scene || firstPage?.narrative?.scene || 'iniciou uma aventura';
      const summary = `A história começou quando ${heroNameStr} ${firstScene}.`;
      
      const recent = recentPages.map(p => {
        const panels = p.narrative?.panels || [];
        if (panels.length > 0) {
          return `Página ${p.pageIndex}: ${panels.map(panel => panel.scene).join(' → ')}`;
        }
        return `Página ${p.pageIndex}: ${p.narrative?.scene || 'Aventura continua'}`;
      }).join('\n');
      
      return `${summary}\n\nContexto recente:\n${recent}`;
    }
  };

  // Função auxiliar para tentar reparar JSON incompleto
  const tryRepairJSON = (incompleteJson: string): string => {
    console.log('[tryRepairJSON] Tentando reparar JSON...');
    
    // Contar chaves e colchetes abertos vs fechados
    let openBraces = 0;
    let openBrackets = 0;
    
    for (const char of incompleteJson) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
    
    // Tentar fechar estruturas abertas
    let repaired = incompleteJson.trim();
    
    // Fechar colchetes abertos primeiro
    while (openBrackets > 0) {
      repaired += '\n]';
      openBrackets--;
    }
    
    // Fechar chaves abertas
    while (openBraces > 0) {
      repaired += '\n}';
      openBraces--;
    }
    
    console.log('[tryRepairJSON] JSON reparado, tentando validar...');
    return repaired;
  };

  // --- Generate Complete Story (New Architecture) ---
  const generateCompleteStory = async (
    heroName: string,
    selectedGenre: string,
    storyTone: string,
    customPremise?: string,
    partNumber?: number,
    totalParts?: number,
    previousPartsData?: ComicFace[][],
    seriesTitle?: string
  ): Promise<CompleteStory> => {
    console.log('[generateCompleteStory] Iniciando geração de história completa...');
    
    if (!heroRef.current) {
      console.error('[generateCompleteStory] Erro: Nenhuma imagem de herói disponível');
      throw new Error("No Hero");
    }
    
    try {
      const testAI = getAI();
      console.log('[generateCompleteStory] API key verificada, continuando...');
    } catch (apiKeyError) {
      console.error('[generateCompleteStory] Erro ao obter API key:', apiKeyError);
      throw new Error(`API Key não configurada: ${apiKeyError instanceof Error ? apiKeyError.message : String(apiKeyError)}`);
    }

    const langName = "Portuguese (Brazil)";
    const heroNameStr = heroName.trim() || "o herói";
    const styleBase = styleBaseRef.current || createStyleDefinition(selectedGenre, storyTone);

    // Adicionar contexto de séries se aplicável
    let seriesContext = '';
    if (partNumber && partNumber > 1 && previousPartsData && previousPartsData.length > 0) {
      seriesContext = `\n\nCONTEXT FROM PREVIOUS PARTS OF THE SERIES "${seriesTitle || 'Aventura'}":\n`;
      previousPartsData.forEach((partData, idx) => {
        const lastPage = partData[partData.length - 1];
        const lastScene = lastPage?.narrative?.panels?.[0]?.scene || lastPage?.narrative?.scene || 'Aventura continuou';
        seriesContext += `Part ${idx + 1} ended with: ${lastScene}\n`;
      });
      seriesContext += `\nThis is PART ${partNumber} of ${totalParts}. Continue the story from where Part ${partNumber - 1} ended, but ensure this part has its own beginning, middle, and partial ending.`;
    }

    let coreDriver = `GENRE: ${selectedGenre}. TONE: ${storyTone}.`;
    if (selectedGenre === 'Personalizado') {
      coreDriver = `STORY PREMISE: ${customPremise || "A fun adventure for kids"}.`;
    }

    let basePrompt = `
You are writing a complete comic book story FOR CHILDREN (ages 5-12). Generate the ENTIRE story structure for all ${MAX_STORY_PAGES} pages in a single response.

TARGET LANGUAGE FOR TEXT: ${langName}
${coreDriver}
${seriesContext}

CHARACTERS:
- HERO: "${heroNameStr}" (the main protagonist, a child).

${CONTENT_GUARDRAILS}

STORY STRUCTURE:
- Page 1: INCITING INCIDENT - Start with ${heroNameStr} finding something fun or surprising!
- Pages 2-4: ADVENTURE BEGINS - ${heroNameStr} explores the world
- Pages 5-8: A SILLY PROBLEM - A funny obstacle blocks the way
- Pages 9-10: RESOLUTION - They solve the problem together with a HAPPY ENDING

VISUAL STYLE BASE (to be used consistently in all image generations):
- Art Style: ${styleBase.art_style}
- Color Palette: ${styleBase.color_palette}
- Line Style: ${styleBase.line_style}
- Lighting: ${styleBase.lighting_style}
- Character Rendering: ${styleBase.character_rendering}

OUTPUT FORMAT - JSON ONLY:
{
  "story_metadata": {
    "title": "Title of the story",
    "hero_name": "${heroNameStr}",
    "genre": "${selectedGenre}",
    "tone": "${storyTone}",
    "total_pages": ${MAX_STORY_PAGES},
    "visual_style_base": "${styleBase.art_style}"
  },
  "pages": [
    {
      "page_number": 1,
      "panels": [
        {
          "panel_number": 1,
          "scene_description": "Detailed visual description of panel 1 scene",
          "environment": "Description of the environment/setting",
          "characters": [
            {
              "name": "${heroNameStr}",
              "role": "hero",
              "appearance_notes": "What the character looks like in this panel",
              "dialogue": "Character speech (max 20 words, in ${langName})"
            }
          ],
          "caption": "Narrative text for panel 1 (max 25 words, in ${langName})",
          "dialogue": "Character speech if different from character dialogue",
          "focus_character": "hero",
          "visual_notes": "Specific visual requirements for this panel"
        },
        {
          "panel_number": 2,
          "scene_description": "Detailed visual description of panel 2 scene",
          "environment": "Description of the environment/setting",
          "characters": [
            {
              "name": "${heroNameStr}",
              "role": "hero",
              "appearance_notes": "What the character looks like in this panel",
              "dialogue": "Character speech (max 20 words, in ${langName})"
            }
          ],
          "caption": "Narrative text for panel 2 (max 25 words, in ${langName})",
          "focus_character": "hero",
          "visual_notes": "Specific visual requirements for this panel"
        }
      ]
    },
    ... (repeat for all ${MAX_STORY_PAGES} pages)
  ]
}

CRITICAL REQUIREMENTS:
- Each page must have exactly 2 panels
- All text (captions, dialogue) MUST be in ${langName}
- Page ${MAX_STORY_PAGES} must have a HAPPY ENDING and end with "FIM"
- Maintain narrative continuity across all pages
- Each page should advance the story naturally
- Follow the story structure outlined above
- Ensure all content is age-appropriate (5-12 years)

CRITICAL JSON FORMAT REQUIREMENTS:
- Return ONLY valid JSON, no markdown, no explanations, no code blocks
- The JSON MUST be complete with all ${MAX_STORY_PAGES} pages
- Ensure all brackets [ ] and braces { } are properly closed
- Each page must have complete panel data
- Do NOT truncate the response - include all pages even if it's long
- The JSON must be parseable and valid
`;

    let jsonText = '';
    const MAX_RETRIES = 2;
    let attempt = 0;
    
    while (attempt <= MAX_RETRIES) {
      try {
        // Adicionar instruções extras em tentativas subsequentes
        let currentPrompt = basePrompt;
        if (attempt > 0) {
          currentPrompt += `\n\nCRITICAL: You MUST return a COMPLETE, VALID JSON. The JSON must include all ${MAX_STORY_PAGES} pages with complete panel data. Do not truncate the response. Return ONLY valid JSON, no markdown, no explanations, just the JSON object. Ensure all brackets and braces are properly closed.`;
        }
        
        const ai = getAI();
        console.log(`[generateCompleteStory] Tentativa ${attempt + 1}/${MAX_RETRIES + 1} - Chamando API do Gemini...`);
        
        const result = await ai.models.generateContent({
          model: MODEL_TEXT_NAME,
          contents: [{ role: 'user', parts: [{ text: currentPrompt }] }],
          config: {
            temperature: 0.7,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192 // Aumentar limite de tokens de saída
          }
        });

        console.log('[generateCompleteStory] Resposta recebida da API');
        trackUsage(result.usageMetadata, MODEL_TEXT_NAME);

        // Verificar se a resposta foi truncada
        const finishReason = result.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS' || finishReason === 'OTHER') {
          console.warn(`[generateCompleteStory] Resposta pode estar truncada. Finish reason: ${finishReason}`);
        }

        const candidates = result.candidates?.[0]?.content?.parts || [];
        jsonText = '';
        
        for (const part of candidates) {
          if (part.text) {
            jsonText += part.text;
          }
        }

        if (!jsonText) {
          throw new Error("No JSON response from AI");
        }

        console.log(`[generateCompleteStory] JSON recebido, tamanho: ${jsonText.length} caracteres`);

        // Limpar JSON (remover markdown code blocks se houver)
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Verificar se JSON parece completo (tem chaves de fechamento)
        const openBraces = (jsonText.match(/\{/g) || []).length;
        const closeBraces = (jsonText.match(/\}/g) || []).length;
        const openBrackets = (jsonText.match(/\[/g) || []).length;
        const closeBrackets = (jsonText.match(/\]/g) || []).length;

        if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
          console.warn(`[generateCompleteStory] JSON parece incompleto. Braces: ${openBraces}/${closeBraces}, Brackets: ${openBrackets}/${closeBrackets}`);
          if (attempt < MAX_RETRIES) {
            console.log('[generateCompleteStory] Tentando novamente com prompt mais específico...');
            attempt++;
            continue;
          } else {
            // Tentar reparar JSON incompleto
            console.log('[generateCompleteStory] Tentando reparar JSON incompleto...');
            jsonText = tryRepairJSON(jsonText);
          }
        }

        console.log('[generateCompleteStory] Parsing JSON...');
        const completeStory: CompleteStory = JSON.parse(jsonText);

        // Validar estrutura
        if (!completeStory.pages || completeStory.pages.length !== MAX_STORY_PAGES) {
          throw new Error(`Invalid story structure: expected ${MAX_STORY_PAGES} pages, got ${completeStory.pages?.length || 0}`);
        }

        // Validar que cada página tem painéis
        for (const page of completeStory.pages) {
          if (!page.panels || page.panels.length === 0) {
            throw new Error(`Page ${page.page_number} has no panels`);
          }
        }

        console.log('[generateCompleteStory] História completa gerada com sucesso!');
        return completeStory;

      } catch (error) {
        console.error(`[generateCompleteStory] Erro na tentativa ${attempt + 1}:`, error);
        
        if (error instanceof SyntaxError) {
          console.error('[generateCompleteStory] JSON inválido. Primeiros 1000 caracteres:', jsonText?.substring(0, 1000));
          console.error('[generateCompleteStory] Últimos 500 caracteres:', jsonText?.substring(Math.max(0, jsonText.length - 500)));
          
          if (attempt < MAX_RETRIES) {
            console.log('[generateCompleteStory] Tentando novamente...');
            attempt++;
            continue;
          }
        }
        
        // Se esgotou tentativas ou erro não é de sintaxe, lançar erro
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Failed to generate complete story after ${MAX_RETRIES + 1} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        attempt++;
      }
    }
    
        throw new Error("Failed to generate complete story");
  };

  const generateBeat = async (
    history: ComicFace[], 
    isRightPage: boolean, 
    pageNum: number,
    partNumber?: number,
    totalParts?: number,
    previousPartsData?: ComicFace[][],
    seriesTitle?: string
  ): Promise<Beat> => {
    if (!heroRef.current) {
      console.error('[generateBeat] Erro: Nenhuma imagem de herói disponível');
      throw new Error("No Hero");
    }
    
    console.log(`[generateBeat] Iniciando geração da página ${pageNum}`);
    
    // Verificar se API key está disponível antes de tentar usar
    try {
      const testAI = getAI();
      console.log('[generateBeat] API key verificada, continuando...');
    } catch (apiKeyError) {
      console.error('[generateBeat] Erro ao obter API key:', apiKeyError);
      throw new Error(`API Key não configurada: ${apiKeyError instanceof Error ? apiKeyError.message : String(apiKeyError)}`);
    }

    const isFinalPage = pageNum === MAX_STORY_PAGES;
    const langName = "Portuguese (Brazil)";
    const heroNameStr = heroName.trim() || "o herói";

    const relevantHistory = history
        .filter(p => p.type === 'story' && p.narrative && (p.pageIndex || 0) < pageNum)
        .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

    // Adicionar contexto de séries se aplicável
    let seriesContext = '';
    if (partNumber && partNumber > 1 && previousPartsData && previousPartsData.length > 0) {
      seriesContext = `\n\nCONTEXT FROM PREVIOUS PARTS OF THE SERIES "${seriesTitle || 'Aventura'}":\n`;
      previousPartsData.forEach((partData, idx) => {
        const lastPage = partData[partData.length - 1];
        const lastScene = lastPage?.narrative?.panels?.[0]?.scene || lastPage?.narrative?.scene || 'Aventura continuou';
        seriesContext += `Part ${idx + 1} ended with: ${lastScene}\n`;
      });
      seriesContext += `\nThis is PART ${partNumber} of ${totalParts}. Continue the story from where Part ${partNumber - 1} ended, but ensure this part has its own beginning, middle, and partial ending.`;
    }

    // Criar histórico otimizado
    const historyText = getOptimizedHistory(relevantHistory, pageNum, heroNameStr);

    // Criar resumo narrativo da história até agora
    const storySummary = relevantHistory.length > 0 
      ? `RESUMO DA HISTÓRIA ATÉ AGORA:\n` +
        (() => {
          const firstPage = relevantHistory[0];
          const firstScene = firstPage?.narrative?.panels?.[0]?.scene || firstPage?.narrative?.scene || 'encontrou algo interessante';
          return `A aventura começou quando ${heroNameStr} ${firstScene}.\n` +
            (relevantHistory.length > 1 
              ? `Nas páginas seguintes, ${heroNameStr} ${relevantHistory.slice(1).map(p => {
                  const scene = p.narrative?.panels?.[0]?.scene || p.narrative?.scene;
                  return scene;
                }).filter(Boolean).join(', depois ')}.\n`
              : '') +
            `Agora estamos na página ${pageNum}, continuando esta emocionante jornada.`;
        })()
      : `Esta é o início da aventura de ${heroNameStr}.`;

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

    let instruction = `Continue the story naturally from where it left off. ALL OUTPUT TEXT (Captions, Dialogue) MUST BE IN ${langName.toUpperCase()}. ${coreDriver} ${guardrails}`;
    instruction += ` CRITICAL: The protagonist's name is "${heroNameStr}".`;
    instruction += ` Maintain narrative continuity with previous pages. Reference events, characters, or objects mentioned earlier when relevant.`;

    // Always use rich mode instructions
    instruction += " RICH MODE ENABLED. Prioritize expressive character feelings and descriptive captions.";
    instruction += " Ensure smooth story flow - each page should feel like a natural continuation of the previous one.";

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

    const capLimit = "max 25 words";
    const diaLimit = "max 20 words";

    const prompt = `
You are writing a comic book script FOR CHILDREN. PAGE ${pageNum} of ${MAX_STORY_PAGES}.
TARGET LANGUAGE FOR TEXT: ${langName}
${coreDriver}
${seriesContext}

CHARACTERS:
- HERO: "${heroNameStr}" (the main protagonist, a child).
- OTHER CHARACTERS: Only include if they were introduced in previous pages.

${storySummary}

DETAILED HISTORY OF PREVIOUS PAGES:
${historyText || 'This is the first page of the story.'}

INSTRUCTIONS:
${instruction}
This page will have 2 comic panels arranged vertically (one on top, one on bottom). Create 2 distinct panels that tell a cohesive story progression across the page.
Each panel should be larger and more detailed than a 4-panel layout, with more space for dialogue and action.
Each panel should advance the narrative significantly, creating a clear sense of story progression.

OUTPUT JSON ONLY:
{
  "panels": [
    {
      "caption": "Narrative text for panel 1 (${capLimit}).",
      "dialogue": "Character speech for panel 1 (${diaLimit}).",
      "scene": "Visual description of panel 1 scene.",
      "focus_char": "hero" or "friend" or "other"
    },
    {
      "caption": "Narrative text for panel 2 (${capLimit}).",
      "dialogue": "Character speech for panel 2 (${diaLimit}).",
      "scene": "Visual description of panel 2 scene.",
  "focus_char": "hero" or "friend" or "other"
    }
  ]
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
        const parsed = JSON.parse(text);
        // Garantir que temos panels
        if (!parsed.panels || !Array.isArray(parsed.panels)) {
          // Fallback: criar 2 painéis a partir de dados legados se existirem
          const defaultPanel = {
            caption: parsed.caption || "",
            dialogue: parsed.dialogue || "",
            scene: parsed.scene || "A fun adventure scene.",
            focus_char: (parsed.focus_char || "hero") as 'hero' | 'friend' | 'other'
          };
          const beat: Beat = {
            panels: [defaultPanel, defaultPanel],
            scene: parsed.scene || "A fun adventure scene.",
            focus_char: (parsed.focus_char || "hero") as 'hero' | 'friend' | 'other'
          };
          return beat;
        }
        // Garantir que temos exatamente 2 painéis
        if (parsed.panels.length !== 2) {
          // Se tiver mais ou menos, ajustar para 2
          if (parsed.panels.length > 2) {
            parsed.panels = parsed.panels.slice(0, 2);
          } else if (parsed.panels.length === 1) {
            parsed.panels.push({ ...parsed.panels[0] });
          } else {
            // Se estiver vazio, criar 2 painéis padrão
            const defaultPanel = {
              caption: "",
              dialogue: "",
              scene: "A fun adventure scene.",
              focus_char: "hero" as const
            };
            parsed.panels = [defaultPanel, defaultPanel];
          }
        }
        // Garantir que retorna um Beat válido
        const beat: Beat = {
          panels: parsed.panels,
          scene: parsed.panels[0]?.scene || "A fun adventure scene.",
          focus_char: parsed.panels[0]?.focus_char || "hero"
        };
        return beat;
    } catch (e) {
        console.error(`[generateBeat] JSON Parse Error para página ${pageNum}`, e);
        console.error("Texto recebido:", text);
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
             try { 
               const parsed = JSON.parse(jsonMatch[1]);
               if (parsed.panels && Array.isArray(parsed.panels)) return parsed;
             } catch(e2) {}
        }
        // Fallback: retornar 2 painéis padrão
        const defaultPanel = {
          caption: "",
          dialogue: "",
          scene: "A fun adventure scene.",
          focus_char: "hero" as const
        };
        const beat: Beat = {
          panels: [defaultPanel, defaultPanel],
          scene: "A fun adventure scene.",
          focus_char: "hero"
        };
        return beat;
    }
  };

  // --- Convert CompleteStory to Beats ---
  const convertCompleteStoryToBeats = (completeStory: CompleteStory): Beat[] => {
    return completeStory.pages.map(page => {
      const panels = page.panels.map(panel => ({
        caption: panel.caption,
        dialogue: panel.dialogue || panel.characters.find(c => c.dialogue)?.dialogue,
        scene: panel.scene_description,
        focus_char: panel.focus_character
      }));
      
      return {
        panels,
        scene: page.panels[0]?.scene_description || '',
        focus_char: page.panels[0]?.focus_character || 'hero'
      } as Beat;
    });
  };

  // --- Build Image Prompt (Hierarchical Structure) ---
  const buildImagePrompt = (
    pageData: CompleteStory['pages'][0],
    pageNum: number,
    visualStyleBase: VisualStyleBase,
    previousImages: string[],
    heroNameStr: string
  ): string => {
    let prompt = `# COMIC BOOK PAGE GENERATION - PAGE ${pageNum} of ${MAX_STORY_PAGES}

## SECTION 1: MANDATORY STYLE DEFINITION
### Art Style: ${visualStyleBase.art_style}
### Color Palette: ${visualStyleBase.color_palette}
### Line Style: ${visualStyleBase.line_style}
### Lighting: ${visualStyleBase.lighting_style}
### Character Rendering: ${visualStyleBase.character_rendering}

CRITICAL: This style definition MUST be applied consistently to EVERY page.
DO NOT deviate from this style. DO NOT mix styles (e.g., do not combine comic book style with Disney style).
Maintain this exact visual aesthetic throughout the entire comic.

## SECTION 2: VISUAL CONTEXT FROM PREVIOUS PAGES
${previousImages.length > 0 ? `
The following images show the visual style and continuity from previous pages.
You MUST maintain the same art style, color palette, and visual consistency.
` : 'This is the first story page.'}

## SECTION 3: CONTENT GUARDRAILS
${VISUAL_GUARDRAILS}

## SECTION 4: CHARACTER CONSISTENCY
The main character "${heroNameStr}" MUST:
1. Use the provided reference image for facial features EXACTLY
2. Match: eye color, hair color, hair style, face shape, skin tone
3. Maintain same appearance across ALL panels and pages
4. Reference image is the DEFINITIVE source - do NOT create variations
5. If character appears in multiple panels, they must look IDENTICAL

## SECTION 5: CURRENT PAGE LAYOUT
LAYOUT: Create a vertical layout with 2 large comic panels. Arrange them as:
  [Panel 1 - Top Half]
  [Panel 2 - Bottom Half]

Each panel should take up approximately 50% of the page height.
Panels should be clearly separated with a visible border/gutter between them.
Each panel is LARGE - use the full space available for clear, readable text and detailed artwork.

PANEL DESCRIPTIONS:
`;

    pageData.panels.forEach((panel, idx) => {
      prompt += `\nPANEL ${idx + 1} (${idx === 0 ? 'Top' : 'Bottom'} Half):\n`;
      prompt += `  Scene: ${panel.scene_description}\n`;
      prompt += `  Environment: ${panel.environment}\n`;
      if (panel.caption) {
        prompt += `  Caption: "${panel.caption}" (display in yellow/cream caption box at top or bottom of panel, large and readable)\n`;
      }
      if (panel.dialogue) {
        prompt += `  Dialogue: "${panel.dialogue}" (display in white speech bubble with black border, large and clear, positioned within the panel without overlapping other elements)\n`;
      }
      panel.characters.forEach(char => {
        if (char.dialogue && char.dialogue !== panel.dialogue) {
          prompt += `  ${char.name} says: "${char.dialogue}" (display in white speech bubble)\n`;
        }
        if (char.role === 'hero' || char.role === 'other') {
          prompt += `  Main character: ${char.name} (use provided reference image - CRITICAL: match the face exactly)\n`;
          if (char.appearance_notes) {
            prompt += `  Appearance notes: ${char.appearance_notes}\n`;
          }
        }
      });
      if (panel.visual_notes) {
        prompt += `  Visual notes: ${panel.visual_notes}\n`;
      }
    });

    prompt += `\n## SECTION 6: FINAL REQUIREMENTS
- Fill entire frame edge-to-edge, no white borders
- High contrast, vibrant colors suitable for children
- Clear visual storytelling with expressive character poses
- Professional comic book aesthetic
- Speech bubbles: white background, black border, bold readable text
- Caption boxes: yellow/cream background, black border, classic comic style
- Each panel is large (50% of page) - use the space wisely
- Speech bubbles and captions must fit WITHIN each panel's boundaries
- Do NOT let text or bubbles overflow outside panel borders
- Text should be large and easily readable
- Leave adequate space between dialogue and captions
`;

    return prompt;
  };

  // --- Generate Image with Style Context (Refactored) ---
  const generateImageWithStyleContext = async (
    pageData: CompleteStory['pages'][0],
    pageNum: number,
    visualStyleBase: VisualStyleBase,
    previousImages: string[],
    heroReference: string
  ): Promise<string> => {
    console.log(`[generateImageWithStyleContext] Iniciando para página ${pageNum}`);
    
    if (!heroReference) {
      console.error('[generateImageWithStyleContext] ERRO: heroReference não disponível');
      throw new Error("No Hero Reference");
    }
    
    console.log('[generateImageWithStyleContext] Obtendo AI instance...');
    let ai;
    try {
      ai = getAI();
      console.log('[generateImageWithStyleContext] AI obtido com sucesso');
    } catch (aiError) {
      console.error('[generateImageWithStyleContext] ERRO ao obter AI:', aiError);
      throw aiError;
    }
    
    const prompt = buildImagePrompt(pageData, pageNum, visualStyleBase, previousImages, heroName);
    
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: heroReference } }
    ];

    // Adicionar imagem de referência de estilo (capa)
    if (visualStyleBase.reference_image && pageNum > 1) {
      const styleRefBase64 = visualStyleBase.reference_image.split(',')[1] || visualStyleBase.reference_image;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: styleRefBase64
        }
      });
      console.log('[generateImageWithStyleContext] Imagem de referência de estilo adicionada');
    }

    // Adicionar imagens das páginas anteriores (últimas 2-3)
    previousImages.forEach((imgBase64, idx) => {
      const base64 = imgBase64.split(',')[1] || imgBase64;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64
        }
      });
      console.log(`[generateImageWithStyleContext] Imagem anterior ${idx + 1} adicionada como contexto`);
    });

    console.log(`[generateImageWithStyleContext] Chamando API do Gemini para gerar imagem...`);
    console.log(`[generateImageWithStyleContext] Model: ${MODEL_IMAGE_GEN_NAME}`);
    console.log(`[generateImageWithStyleContext] Parts count: ${parts.length}`);

    const result = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN_NAME,
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.4
      }
    });

    console.log(`[generateImageWithStyleContext] Resposta recebida da API`);
    trackUsage(result.usageMetadata, MODEL_IMAGE_GEN_NAME);

    console.log(`[generateImageWithStyleContext] Processando candidatos...`);
    const candidates = result.candidates?.[0]?.content?.parts || [];
    console.log(`[generateImageWithStyleContext] Candidatos encontrados: ${candidates.length}`);
    
    for (const part of candidates) {
      if (part.inlineData) {
        console.log(`[generateImageWithStyleContext] Imagem encontrada no candidato`);
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    console.error(`[generateImageWithStyleContext] ERRO: Nenhuma imagem gerada`);
    throw new Error("No image generated");
  };

  // --- Legacy function for compatibility ---
  const generateImageWithVisualContext = async (
    beat: Beat,
    pageNum: number,
    previousBeats: Beat[]
  ): Promise<string> => {
    console.log(`[generateImageWithVisualContext] Iniciando para página ${pageNum}`);
    if (!heroRef.current) {
      console.error('[generateImageWithVisualContext] ERRO: heroRef.current não disponível');
      throw new Error("No Hero");
    }
    console.log('[generateImageWithVisualContext] Obtendo AI instance...');
    let ai;
    try {
      ai = getAI();
      console.log('[generateImageWithVisualContext] AI obtido com sucesso');
    } catch (aiError) {
      console.error('[generateImageWithVisualContext] ERRO ao obter AI:', aiError);
      throw aiError;
    }
    
    const visualGuardrails = "CRITICAL EXCLUSIONS: NO RAINBOWS, NO MULTICOLOR ARCS, NO ROMANTIC GESTURES, NO KISSING, NO HEARTS. Photorealistic, cinematic lighting, 8k resolution, comic book style.";

    // Verificar se temos múltiplos painéis ou formato legado
    const panels = beat.panels || (beat.scene ? [{
      caption: beat.caption,
      dialogue: beat.dialogue,
      scene: beat.scene,
      focus_char: beat.focus_char
    }] : []);
    
    let prompt = `Create a professional comic book page in ${selectedGenre} style. ${visualGuardrails}\n\n`;

    // Adicionar contexto visual das páginas anteriores
    if (previousBeats.length > 0) {
      prompt += `VISUAL CONTINUITY & CONTEXT:\n`;
      prompt += `This is PAGE ${pageNum} of ${MAX_STORY_PAGES}.\n\n`;
      
      // Resumo visual das últimas 2-3 páginas
      const recentBeats = previousBeats.slice(-3);
      prompt += `Previous pages visually established:\n`;
      recentBeats.forEach((prevBeat, idx) => {
        const prevPageNum = pageNum - recentBeats.length + idx;
        const prevPanels = prevBeat.panels || [];
        prevPanels.forEach((panel, panelIdx) => {
          prompt += `- Page ${prevPageNum}, Panel ${panelIdx + 1}: ${panel.scene}\n`;
        });
      });
      
      prompt += `\nIMPORTANT VISUAL REQUIREMENTS:\n`;
      prompt += `- Show clear visual progression from previous pages\n`;
      prompt += `- Maintain consistent character appearance (same clothes, style)\n`;
      prompt += `- Use similar color palette and artistic style\n`;
      prompt += `- If locations/objects were shown before, reference them visually\n`;
      prompt += `- Each page should feel like a natural visual continuation\n`;
      prompt += `- Avoid repeating exact same scenes, show story progression\n`;
      prompt += `- Add visual variety: different camera angles, poses, compositions\n\n`;
    }
    
    if (panels.length === 2) {
      // Layout vertical com 2 quadrinhos
      prompt += `LAYOUT: Create a vertical layout with 2 large comic panels. Arrange them as:\n`;
      prompt += `  [Panel 1 - Top Half]\n`;
      prompt += `  [Panel 2 - Bottom Half]\n\n`;
      prompt += `Each panel should take up approximately 50% of the page height.\n`;
      prompt += `Panels should be clearly separated with a visible border/gutter between them.\n`;
      prompt += `Each panel is LARGE - use the full space available for clear, readable text and detailed artwork.\n\n`;
      
      prompt += `PANEL DESCRIPTIONS:\n`;
      panels.forEach((panel, idx) => {
        prompt += `\nPANEL ${idx + 1} (${idx === 0 ? 'Top' : 'Bottom'} Half):\n`;
        prompt += `  Scene: ${panel.scene}\n`;
        if (panel.caption) {
          prompt += `  Caption: "${panel.caption}" (display in yellow/cream caption box at top or bottom of panel, large and readable)\n`;
        }
        if (panel.dialogue) {
          prompt += `  Dialogue: "${panel.dialogue}" (display in white speech bubble with black border, large and clear, positioned within the panel without overlapping other elements)\n`;
        }
        if (panel.focus_char === 'hero' || panel.focus_char === 'other') {
          prompt += `  Main character: ${heroName} (use provided reference image - CRITICAL: match the face exactly)\n`;
        }
      });
      
      prompt += `\nIMPORTANT LAYOUT RULES:\n`;
      prompt += `- Each panel is large (50% of page) - use the space wisely\n`;
      prompt += `- Speech bubbles and captions must fit WITHIN each panel's boundaries\n`;
      prompt += `- Do NOT let text or bubbles overflow outside panel borders\n`;
      prompt += `- Text should be large and easily readable\n`;
      prompt += `- Leave adequate space between dialogue and captions\n`;
    } else if (panels.length === 4) {
      // Layout legado 2x2 (compatibilidade)
      prompt += `LAYOUT: Create a 2x2 grid of comic panels. Arrange them as:\n`;
      prompt += `  [Panel 1 - Top Left]  [Panel 2 - Top Right]\n`;
      prompt += `  [Panel 3 - Bottom Left]  [Panel 4 - Bottom Right]\n\n`;
      prompt += `Each panel should be clearly separated with visible borders/gutters between them.\n\n`;
      
      prompt += `PANEL DESCRIPTIONS:\n`;
      panels.forEach((panel, idx) => {
        prompt += `\nPANEL ${idx + 1} (${idx < 2 ? 'Top' : 'Bottom'} ${idx % 2 === 0 ? 'Left' : 'Right'}):\n`;
        prompt += `  Scene: ${panel.scene}\n`;
        if (panel.caption) {
          prompt += `  Caption: "${panel.caption}" (display in yellow/cream caption box)\n`;
        }
        if (panel.dialogue) {
          prompt += `  Dialogue: "${panel.dialogue}" (display in white speech bubble with black border)\n`;
        }
        if (panel.focus_char === 'hero' || panel.focus_char === 'other') {
          prompt += `  Main character: ${heroName} (use provided reference image - CRITICAL: match the face exactly)\n`;
        }
      });
    } else {
      // Formato legado - painel único
      const panel = panels[0];
      prompt += `SCENE DESCRIPTION: ${panel.scene}\n\n`;
      
      if (panel.focus_char === 'hero' || panel.focus_char === 'other') {
         prompt += `MAIN CHARACTER: A child named ${heroName} (use the provided reference image for their appearance).\n\n`;
      }
      
      if (panel.dialogue) {
        prompt += `- Include a speech bubble with the dialogue: "${panel.dialogue}"\n`;
        prompt += `- Speech bubble should be clearly visible, white background with black border, text in bold readable font\n`;
        prompt += `- Position the speech bubble near the speaking character's mouth\n`;
      }
      
      if (panel.caption) {
        prompt += `- Include a caption box (usually at top or bottom) with the text: "${panel.caption}"\n`;
        prompt += `- Caption box should have yellow/cream background with black border, classic comic book style\n`;
      }
    }
    
    // Instruções gerais sobre balões de fala e texto
    prompt += `\nVISUAL REQUIREMENTS:\n`;
    prompt += `- High contrast, vibrant colors suitable for children\n`;
    prompt += `- Clear visual storytelling with expressive character poses\n`;
    prompt += `- Fill the entire frame edge-to-edge, no white borders or empty spaces\n`;
    prompt += `- Ensure all text in speech bubbles and captions is large, clear, and easily readable\n`;
    prompt += `- Maintain authentic comic book aesthetic with bold lines and expressive artwork\n`;
    prompt += `- Speech bubbles: white background, black border, bold readable text\n`;
    prompt += `- Caption boxes: yellow/cream background, black border, classic comic style\n`;
    
    // CRITICAL: Consistência facial
    prompt += `\nCRITICAL FACIAL CONSISTENCY REQUIREMENTS:\n`;
    prompt += `- The main character "${heroName}" MUST use the provided reference image for their face in EVERY panel\n`;
    prompt += `- The character's facial features, hair color, hair style, and general appearance MUST match the reference image EXACTLY\n`;
    prompt += `- Do NOT create variations of the character's face - use the reference image as the definitive source\n`;
    prompt += `- If the character appears in multiple panels, they must look identical in all of them\n`;
    prompt += `- Pay special attention to: eye color, hair color, hair style, face shape, skin tone\n`;
    prompt += `- The reference image shows the EXACT appearance that must be maintained throughout the entire comic\n`;
    
    // Garantir que sempre envia a imagem de referência
    if (!heroRef.current || !heroRef.current.base64) {
      throw new Error("Hero reference image is required but not available");
    }
    
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: heroRef.current.base64 } }
    ];

    console.log(`[generateImageWithVisualContext] Chamando API do Gemini para gerar imagem...`);
    console.log(`[generateImageWithVisualContext] Model: ${MODEL_IMAGE_GEN_NAME}`);
    console.log(`[generateImageWithVisualContext] Parts count: ${parts.length}`);

    const result = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN_NAME,
      contents: [{ role: 'user', parts }],
      config: {
          temperature: 0.4
      }
    });

    console.log(`[generateImageWithVisualContext] Resposta recebida da API`);
    trackUsage(result.usageMetadata, MODEL_IMAGE_GEN_NAME);

    console.log(`[generateImageWithVisualContext] Processando candidatos...`);
    const candidates = result.candidates?.[0]?.content?.parts || [];
    console.log(`[generateImageWithVisualContext] Candidatos encontrados: ${candidates.length}`);
    
    for (const part of candidates) {
        if (part.inlineData) {
          console.log(`[generateImageWithVisualContext] Imagem encontrada no candidato`);
          return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    console.error(`[generateImageWithVisualContext] ERRO: Nenhuma imagem gerada`);
    throw new Error("No image generated");
  };

  // Função legada para compatibilidade
  const generateImage = async (beat: Beat, pageNum: number): Promise<string> => {
    return generateImageWithVisualContext(beat, pageNum, []);
  };

  // --- Main Orchestration ---
  const launchStory = async () => {
      console.log('[launchStory] Iniciando geração de história...');
      
      try {
      const isValid = await validateApiKey();
        console.log('[launchStory] Validação de API key:', isValid);
        if (!isValid) {
          console.warn('[launchStory] API key inválida ou não encontrada');
          setErrorMessage('Por favor, configure a chave da API do Gemini antes de gerar.');
          return;
        }
      } catch (apiKeyError) {
        console.error('[launchStory] Erro ao validar API key:', apiKeyError);
        setErrorMessage('Erro ao validar chave da API. Verifique a configuração.');
        console.error('[launchStory] RETORNANDO devido a erro na validação de API key');
        return;
      }
      
      console.log('[launchStory] Após validação de API key, continuando...');

      if (!heroRef.current) {
        console.warn('[launchStory] Nenhuma imagem de herói carregada');
        setErrorMessage('Por favor, faça upload da imagem do herói antes de gerar.');
        return;
      }

      if (credits <= 0) {
        console.warn('[launchStory] Sem créditos disponíveis');
        setErrorMessage('Você não tem créditos suficientes para gerar um gibi.');
        return;
      }
      
      console.log('[launchStory] Validações passadas. Iniciando geração...');

      // Validar créditos para séries
      const requiredCredits = comicType === 'series' ? (seriesParts || 4) : 1;
      console.log(`[launchStory] Créditos necessários: ${requiredCredits}, disponíveis: ${credits}`);
      if (credits < requiredCredits) {
        setErrorMessage(`Você precisa de ${requiredCredits} créditos para criar ${comicType === 'series' ? 'esta série' : 'este gibi'}. Você tem ${credits} créditos.`);
        return;
      }

      const newCredits = credits - requiredCredits;
      console.log(`[launchStory] Atualizando créditos: ${credits} -> ${newCredits}`);
      setCredits(newCredits);
      
      // Atualizar créditos no banco de dados (sem bloquear a geração)
      if (user) {
        console.log('[launchStory] Usuário autenticado, atualizando créditos no banco...');
        // Executar em background para não bloquear a geração
        (async () => {
          try {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ credits: newCredits })
              .eq('id', user.id);
            if (updateError) {
              console.error('[launchStory] Erro ao atualizar créditos:', updateError);
            } else {
              console.log('[launchStory] Créditos atualizados no banco com sucesso');
            }
          } catch (err) {
            console.error('[launchStory] Exceção ao atualizar créditos:', err);
          }
        })();
        console.log('[launchStory] Atualização de créditos iniciada em background');
      } else {
        console.warn('[launchStory] Usuário não autenticado, pulando atualização de créditos no banco');
      }
      
      console.log('[launchStory] Configurando estado de geração...');
      setIsGenerating(true);
      setActiveTab('read');
      setCurrentSheetIndex(0);
      console.log('[launchStory] Estado configurado');

      // Lógica de séries
      console.log(`[launchStory] Tipo de gibi: ${comicType}`);
      let seriesId: string | null = null;
      let partNumber = 1;
      let previousPartsData: ComicFace[][] = [];

      if (comicType === 'series') {
        console.log('[launchStory] Processando série...');
        if (currentSeriesId) {
          // Continuar série existente
          seriesId = currentSeriesId;
          const { data: series } = await supabase
            .from('comic_series')
            .select('*')
            .eq('id', currentSeriesId)
            .single();
          
          if (series) {
            partNumber = series.current_part + 1;
            
            // Carregar partes anteriores
            const { data: previousComics } = await supabase
              .from('comics')
              .select('comic_data')
              .eq('series_id', seriesId)
              .order('part_number', { ascending: true });
            
            previousPartsData = (previousComics || []).map(comic => 
              comic.comic_data?.comicFaces || []
            );
          }
        } else {
          // Criar nova série
          const { data: newSeries, error: seriesError } = await supabase
            .from('comic_series')
            .insert({
              user_id: user?.id,
              title: seriesTitle || `Aventuras de ${heroName}`,
              hero_name: heroName,
              genre: selectedGenre,
              story_tone: storyTone,
              total_parts: seriesParts || 4,
              current_part: 1,
              status: 'in_progress'
            })
            .select()
            .single();
          
          if (newSeries && !seriesError) {
            seriesId = newSeries.id;
            setCurrentSeriesId(newSeries.id);
          }
        }
      }

      console.log('[launchStory] Criando estrutura inicial de faces...');
      const initialFaces: ComicFace[] = [];
      initialFaces.push({ id: 'cover', type: 'cover', isLoading: true, pageIndex: 0 });
      for (let i = 1; i <= MAX_STORY_PAGES; i++) {
          initialFaces.push({ 
            id: `page-${i}`, 
            type: 'story', 
            isLoading: true, 
            pageIndex: i,
            seriesId: seriesId || undefined,
            partNumber: comicType === 'series' ? partNumber : undefined,
            isSeriesPart: comicType === 'series'
          });
      }
      initialFaces.push({ id: 'back', type: 'back_cover', isLoading: true, pageIndex: BACK_COVER_PAGE });
      
      console.log('[launchStory] Faces iniciais criadas:', initialFaces.length);
      setComicFaces(initialFaces);
      historyRef.current = [];
      console.log('[launchStory] Estado atualizado, iniciando IIFE assíncrona...');
      console.log('[launchStory] IIFE será executada agora...');

      (async () => {
          try {
            console.log('[launchStory] IIFE iniciada, dentro do try block');
            
            // FASE 0: Definir estilo base
            console.log('[launchStory] FASE 0: Definindo estilo base...');
            const styleBase = createStyleDefinition(selectedGenre, storyTone);
            styleBaseRef.current = styleBase;
            console.log('[launchStory] Estilo base definido:', styleBase.art_style);
            
            // FASE 1: Gerar capa (com imagem de referência)
            console.log('[launchStory] FASE 1: Gerando capa...');
            console.log('[launchStory] Verificando heroRef:', !!heroRef.current, !!heroRef.current?.base64);
            if (!heroRef.current || !heroRef.current.base64) {
              console.error('[launchStory] ERRO: Hero reference image não encontrada');
              throw new Error("Hero reference image is required");
            }
            const coverTitle = comicType === 'series' && seriesTitle 
              ? `${seriesTitle} - Parte ${partNumber}`
              : `SUPER ${heroName}`;
            console.log('[launchStory] Título da capa:', coverTitle);
            const coverPrompt = { 
              scene: `Epic comic book cover for a ${selectedGenre} story starring ${heroName}. Action pose, title text '${coverTitle}' at top. CRITICAL: Use the provided reference image for ${heroName}'s face - match it exactly.`, 
              focus_char: 'hero' 
            } as Beat;
            console.log('[launchStory] Chamando generateImage para capa...');
            const coverImg = await generateImage(coverPrompt, 0);
            console.log('[launchStory] Capa gerada com sucesso, tamanho da imagem:', coverImg?.length || 0);
            
            // Armazenar capa como referência de estilo
            styleBaseRef.current = {
              ...styleBaseRef.current,
              reference_image: coverImg
            };
            
            // Criar face da capa completa e atualizar imediatamente
            const coverFaceForState: ComicFace = {
              id: 'cover',
              type: 'cover',
              isLoading: false,
              imageUrl: coverImg,
              pageIndex: 0
            };
            
            setComicFaces(prev => prev.map(f => f.type === 'cover' ? coverFaceForState : f));
            console.log('[launchStory] Capa atualizada no estado com imagem');
            
            // Salvar referência da capa para uso no salvamento (CRÍTICO)
            coverRef.current = coverFaceForState;
            console.log('[launchStory] Capa salva no coverRef.current');
            
            // Armazenar capa em variável local para uso no salvamento
            const savedCoverFace = coverFaceForState;

            // FASE 2: Gerar história completa (1 requisição)
            console.log('[launchStory] FASE 2: Gerando história completa...');
            const completeStory = await generateCompleteStory(
              heroName,
              selectedGenre,
              storyTone,
              customPremise,
              comicType === 'series' ? partNumber : undefined,
              comicType === 'series' ? (seriesParts || 4) : undefined,
              previousPartsData,
              seriesTitle || undefined
            );
            console.log('[launchStory] História completa gerada com sucesso!');
            
            // Converter CompleteStory para Beats (para compatibilidade)
            const allBeats = convertCompleteStoryToBeats(completeStory);
            
            // Atualizar UI com narrativas
            allBeats.forEach((beat, idx) => {
              const pageNum = idx + 1;
              setComicFaces(prev => prev.map(f => 
                f.pageIndex === pageNum ? { ...f, narrative: beat } : f
              ));
            });

            // FASE 3: Gerar imagens das páginas (1 por vez, com contexto)
            console.log('[launchStory] FASE 3: Gerando imagens das páginas...');
            const previousImages: string[] = [coverImg]; // Começar com capa
            
            for (const pageData of completeStory.pages) {
              const pageNum = pageData.page_number;
              console.log(`[launchStory] Gerando imagem para página ${pageNum}/${MAX_STORY_PAGES}`);
              
              try {
                const recentImages = previousImages.slice(-2); // Últimas 2 imagens
                const img = await generateImageWithStyleContext(
                  pageData,
                  pageNum,
                  styleBaseRef.current!,
                  recentImages,
                  heroRef.current!.base64
                );
                
                if (!img) {
                  throw new Error(`Imagem não foi gerada para página ${pageNum}`);
                }
                
                // Atualizar UI imediatamente
                const finishedFace: ComicFace = {
                  id: `page-${pageNum}`,
                    type: 'story',
                    isLoading: false,
                  pageIndex: pageNum,
                    imageUrl: img,
                  narrative: allBeats[pageNum - 1],
                  seriesId: seriesId || undefined,
                  partNumber: comicType === 'series' ? partNumber : undefined,
                  isSeriesPart: comicType === 'series'
                };
                
                // Atualizar ref
                const existingIndex = historyRef.current.findIndex(f => f.pageIndex === pageNum);
                if (existingIndex >= 0) {
                  historyRef.current[existingIndex] = finishedFace;
                } else {
                historyRef.current.push(finishedFace);
                }
                
                // Atualizar estado
                setComicFaces(prev => {
                  const updated = prev.map(f => 
                    f.pageIndex === pageNum ? finishedFace : f
                  );
                  console.log(`[launchStory] UI atualizada para página ${pageNum}`);
                  return updated;
                });
                
                // Adicionar à lista de imagens anteriores
                previousImages.push(img);
                
              } catch (pageError) {
                console.error(`[launchStory] ERRO ao gerar página ${pageNum}:`, pageError);
                
                // Criar face de erro para manter a estrutura
                const errorFace: ComicFace = {
                  id: `page-${pageNum}`,
                  type: 'story',
                  isLoading: false,
                  pageIndex: pageNum,
                  imageUrl: '', // Sem imagem
                  narrative: allBeats[pageNum - 1],
                  seriesId: seriesId || undefined,
                  partNumber: comicType === 'series' ? partNumber : undefined,
                  isSeriesPart: comicType === 'series'
                };
                
                // Adicionar ao ref mesmo com erro
                const existingIndex = historyRef.current.findIndex(f => f.pageIndex === pageNum);
                if (existingIndex >= 0) {
                  historyRef.current[existingIndex] = errorFace;
                } else {
                  historyRef.current.push(errorFace);
                }
                
                // Atualizar estado com face de erro
                setComicFaces(prev => {
                  const updated = prev.map(f => 
                    f.pageIndex === pageNum ? errorFace : f
                  );
                  console.log(`[launchStory] Página ${pageNum} marcada como erro`);
                  return updated;
                });
                
                // Tentar novamente até 2 vezes
                let retryCount = 0;
                while (retryCount < 2) {
                  retryCount++;
                  console.log(`[launchStory] Tentativa ${retryCount}/2 para página ${pageNum}...`);
                  
                  try {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
                    
                    const retryImg = await generateImageWithStyleContext(
                      pageData,
                      pageNum,
                      styleBaseRef.current!,
                      previousImages.slice(-2),
                      heroRef.current!.base64
                    );
                    
                    if (retryImg) {
                      console.log(`[launchStory] ✅ Página ${pageNum} gerada na tentativa ${retryCount}`);
                      
                      // Atualizar com imagem bem-sucedida
                      const successFace: ComicFace = {
                        ...errorFace,
                        imageUrl: retryImg
                      };
                      
                      // Atualizar ref
                      const retryIndex = historyRef.current.findIndex(f => f.pageIndex === pageNum);
                      if (retryIndex >= 0) {
                        historyRef.current[retryIndex] = successFace;
                      }
                      
                      // Atualizar estado
                      setComicFaces(prev => prev.map(f => 
                        f.pageIndex === pageNum ? successFace : f
                      ));
                      
                      previousImages.push(retryImg);
                      break; // Sair do loop de retry
                    }
                  } catch (retryError) {
                    console.error(`[launchStory] Tentativa ${retryCount} falhou para página ${pageNum}:`, retryError);
                  }
                }
                
                // Se todas as tentativas falharam, continuar sem a imagem
                if (retryCount >= 2) {
                  console.warn(`[launchStory] ⚠️ Página ${pageNum} será pulada após ${retryCount} tentativas`);
                  // Adicionar imagem vazia para manter contexto
                  previousImages.push('');
                }
              }
              
              // Pequeno delay para garantir que o React processe a atualização
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // FASE 4: Gerar contracapa (com imagem de referência)
            if (!heroRef.current || !heroRef.current.base64) {
              throw new Error("Hero reference image is required");
            }
            const backText = comicType === 'series' && partNumber < (seriesParts || 4)
              ? `Fim da Parte ${partNumber}`
              : 'FIM';
            const backPrompt = { 
              scene: `The end of the adventure. ${heroName} waving goodbye. Text '${backText}' in the sky. Warm colors. CRITICAL: Use the provided reference image for ${heroName}'s face - match it exactly.`, 
              focus_char: 'hero' 
            } as Beat;
            const backImg = await generateImage(backPrompt, 11);
            const backCoverFaceForState: ComicFace = {
              id: 'back',
              type: 'back_cover',
              isLoading: false,
              imageUrl: backImg,
              pageIndex: BACK_COVER_PAGE
            };
            setComicFaces(prev => prev.map(f => f.type === 'back_cover' ? backCoverFaceForState : f));
            console.log('[launchStory] Contracapa atualizada no estado com imagem');

            // Salvar gibi no banco de dados após geração completa
            if (user) {
              console.log('[launchStory] Iniciando salvamento no banco de dados...');
              console.log('[launchStory] Usuário autenticado:', user.id);
              
              // Usar as faces já geradas diretamente (mais confiável)
              let coverFace: ComicFace | undefined = savedCoverFace || coverRef.current;
              const backCoverFace: ComicFace = backCoverFaceForState;
              
              // Se ainda não temos a capa, tentar buscar do estado
              if (!coverFace || !coverFace.imageUrl) {
                console.log('[launchStory] Tentando buscar capa do estado...');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const coverFromState = comicFaces.find(f => f.type === 'cover' && f.imageUrl);
                if (coverFromState) {
                  coverFace = coverFromState;
                  console.log('[launchStory] Capa encontrada no estado');
                } else if (coverRef.current && coverRef.current.imageUrl) {
                  coverFace = coverRef.current;
                  console.log('[launchStory] Capa encontrada no ref após busca no estado');
                } else {
                  console.error('[launchStory] ERRO CRÍTICO: Capa não encontrada!');
                  console.error('[launchStory] savedCoverFace:', savedCoverFace);
                  console.error('[launchStory] coverRef.current:', coverRef.current);
                  console.error('[launchStory] Estado comicFaces:', comicFaces.map(f => ({ type: f.type, hasImage: !!f.imageUrl, pageIndex: f.pageIndex })));
                }
              }
              
              const storyFaces = historyRef.current.filter(f => f.imageUrl && f.type === 'story'); // Filtrar apenas story faces com imagem
              
              // Se ainda não temos a capa, não podemos salvar
              if (!coverFace || !coverFace.imageUrl) {
                console.error('[launchStory] ERRO CRÍTICO: Não é possível salvar sem capa!');
                console.error('[launchStory] Estado comicFaces:', JSON.stringify(comicFaces.map(f => ({ 
                  type: f.type, 
                  hasImage: !!f.imageUrl, 
                  pageIndex: f.pageIndex,
                  id: f.id
                })), null, 2));
                setErrorMessage('Gibi gerado com sucesso, mas houve um erro ao salvar (capa não encontrada). Você ainda pode visualizá-lo e fazer download.');
                return; // Não continuar com o salvamento
              }
              
              if (storyFaces.length === 0) {
                console.error('[launchStory] ERRO: Nenhuma página de história encontrada');
                setErrorMessage('Gibi gerado com sucesso, mas houve um erro ao salvar (páginas não encontradas). Você ainda pode visualizá-lo e fazer download.');
                return;
              }
              
              if (!backCoverFace || !backCoverFace.imageUrl) {
                console.error('[launchStory] ERRO: Contracapa não encontrada ou sem imagem');
                // Contracapa não é crítica, podemos continuar
              }
              
              const allFaces: ComicFace[] = [
                coverFace, // Sempre incluir capa (já validada)
                ...storyFaces,
                backCoverFace
              ];
              
              console.log('[launchStory] Dados coletados para salvamento:', {
                user_id: user.id,
                faces_count: allFaces.length,
                has_cover: !!coverFace,
                cover_has_image: !!coverFace?.imageUrl,
                story_faces_count: storyFaces.length,
                has_back: !!backCoverFace,
                back_has_image: !!backCoverFace?.imageUrl,
                series_id: seriesId,
                part_number: comicType === 'series' ? partNumber : null
              });
              
              // FASE 5: Salvar dados básicos primeiro (SEMPRE funciona)
              console.log('[launchStory] FASE 5: Salvando dados básicos no banco...');
              
              // Coletar todas as faces geradas
              const allGeneratedFaces: ComicFace[] = [
                savedCoverFace, // Capa
                ...historyRef.current, // Páginas da história
                backCoverFaceForState // Contracapa
              ];
              
              console.log('[launchStory] Faces coletadas:', allGeneratedFaces.length);
              
              // Validar se todas as faces críticas foram geradas
              const facesWithImages = allGeneratedFaces.filter(f => f.imageUrl && f.imageUrl.length > 0);
              const facesWithoutImages = allGeneratedFaces.filter(f => !f.imageUrl || f.imageUrl.length === 0);
              
              console.log('[launchStory] Faces com imagem:', facesWithImages.length);
              console.log('[launchStory] Faces sem imagem:', facesWithoutImages.length);
              
              if (facesWithoutImages.length > 0) {
                console.warn('[launchStory] ⚠️ Algumas páginas não foram geradas:');
                facesWithoutImages.forEach(face => {
                  console.warn(`  - ${face.type} (página ${face.pageIndex})`);
                });
              }
              
              // Se menos de 50% das páginas foram geradas, considerar falha crítica
              if (facesWithImages.length < allGeneratedFaces.length * 0.5) {
                console.error('[launchStory] ERRO CRÍTICO: Muitas páginas falharam na geração');
                setErrorMessage('Erro na geração: Muitas páginas falharam. Tente novamente.');
                return;
              }
              
              // Dados básicos (SEM imagens, payload pequeno)
              const basicComicData = {
                heroName,
                selectedGenre,
                storyTone,
                customPremise: selectedGenre === 'Personalizado' ? customPremise : null,
                createdAt: new Date().toISOString(),
                totalPages: allGeneratedFaces.length
              };

              // PASSO 1: Salvar dados básicos (SEMPRE funciona)
              console.log('[launchStory] PASSO 1: Salvando dados básicos...');
              
              const basicInsertPayload = {
                user_id: user.id,
                hero_name: heroName,
                genre: selectedGenre,
                story_tone: storyTone,
                total_pages: basicComicData.totalPages,
                comic_data: basicComicData, // Só dados básicos, sem imagens
                series_id: seriesId || null,
                part_number: comicType === 'series' ? partNumber : null,
                is_series_part: comicType === 'series'
              };
              
              console.log('[launchStory] Payload básico:', JSON.stringify(basicInsertPayload).length, 'bytes');
              console.log('[launchStory] Dados do payload:', {
                user_id: basicInsertPayload.user_id,
                hero_name: basicInsertPayload.hero_name,
                genre: basicInsertPayload.genre,
                total_pages: basicInsertPayload.total_pages,
                series_id: basicInsertPayload.series_id,
                part_number: basicInsertPayload.part_number,
                is_series_part: basicInsertPayload.is_series_part
              });
              
              // Verificar autenticação do Supabase
              const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
              console.log('[launchStory] Verificação de auth:', {
                supabaseUser: supabaseUser?.id,
                authError: authError?.message,
                userIdMatch: supabaseUser?.id === user.id
              });
              
              // Teste simples de insert para debug
              console.log('[launchStory] Testando insert simples...');
              try {
                const testPayload = {
                  user_id: user.id,
                  hero_name: 'Teste',
                  genre: 'Teste',
                  story_tone: 'Teste',
                  total_pages: 1,
                  comic_data: { test: true }
                };
                
                const { data: testData, error: testError } = await supabase
                  .from('comics')
                  .insert(testPayload)
                  .select()
                  .single();
                
                console.log('[launchStory] Teste insert resultado:', { testData, testError });
                
                // Se o teste funcionou, deletar o registro de teste
                if (testData && !testError) {
                  await supabase.from('comics').delete().eq('id', testData.id);
                  console.log('[launchStory] Registro de teste deletado');
                }
              } catch (testException) {
                console.error('[launchStory] Exceção no teste:', testException);
              }
              
              let savedComic;
              try {
                console.log('[launchStory] Iniciando INSERT no Supabase...');
                
                // Adicionar timeout para evitar travamento
                const insertPromise = supabase
                  .from('comics')
                  .insert(basicInsertPayload)
                  .select()
                  .single();
                
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout ao salvar no banco (30s)')), 30000)
                );
                
                console.log('[launchStory] Aguardando resposta do Supabase...');
                const { data, error: saveError } = await Promise.race([
                  insertPromise,
                  timeoutPromise
                ]) as any;
                
                console.log('[launchStory] Resposta recebida do Supabase');
                console.log('[launchStory] Data:', data);
                console.log('[launchStory] Error:', saveError);
                
                if (saveError) {
                  console.error('[launchStory] ERRO ao salvar dados básicos:', saveError);
                  console.error('[launchStory] Detalhes do erro:', {
                    code: saveError.code,
                    message: saveError.message,
                    details: saveError.details,
                    hint: saveError.hint
                  });
                  setErrorMessage(`Erro ao salvar gibi: ${saveError.message}. Você ainda pode visualizá-lo e fazer download.`);
                  return;
                }
                
                if (!data) {
                  console.error('[launchStory] ERRO: Nenhum dado retornado do insert');
                  setErrorMessage('Erro ao salvar gibi: Nenhum dado retornado. Você ainda pode visualizá-lo e fazer download.');
                  return;
                }
                
                savedComic = data;
                console.log('[launchStory] ✅ Dados básicos salvos! ID:', savedComic.id);
              } catch (insertError) {
                console.error('[launchStory] EXCEÇÃO ao salvar dados básicos:', insertError);
                console.error('[launchStory] Tipo do erro:', typeof insertError);
                console.error('[launchStory] Stack trace:', insertError instanceof Error ? insertError.stack : 'N/A');
                
                if (insertError instanceof Error && insertError.message.includes('Timeout')) {
                  setErrorMessage('Timeout ao salvar gibi. Verifique sua conexão e tente novamente.');
                } else {
                  setErrorMessage(`Erro ao salvar gibi: ${insertError instanceof Error ? insertError.message : String(insertError)}. Você ainda pode visualizá-lo e fazer download.`);
                }
                return;
              }
              
              // PASSO 2: Upload de imagens individuais (em background)
              console.log('[launchStory] PASSO 2: Fazendo upload das imagens...');
              console.log('[launchStory] Faces que serão processadas:', facesWithImages.length);
              
              // Usar setTimeout para não bloquear a UI
              setTimeout(() => {
                uploadImagesInBackground(savedComic.id, allGeneratedFaces);
              }, 100);
              
              // Atualizar contador de gibis
              setTotalComics(prev => prev + 1);
              
              // Se há páginas faltantes, oferecer regeneração
              if (facesWithoutImages.length > 0 && facesWithoutImages.length < allGeneratedFaces.length * 0.5) {
                console.log('[launchStory] Oferecendo regeneração de páginas faltantes...');
                const missingPages = facesWithoutImages
                  .filter(f => f.type === 'story')
                  .map(f => f.pageIndex)
                  .sort()
                  .join(', ');
                
                if (missingPages) {
                  setErrorMessage(`Gibi salvo com sucesso! Algumas páginas falharam (${missingPages}). Você pode tentar gerar novamente ou fazer download do que foi gerado.`);
                }
              }
              
              // Se é série, atualizar status da série
              if (comicType === 'series' && seriesId) {
                const isLastPart = partNumber >= (seriesParts || 4);
                await supabase
                  .from('comic_series')
                  .update({
                    current_part: partNumber,
                    status: isLastPart ? 'completed' : 'in_progress',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', seriesId);
                
                if (isLastPart) {
                  setCurrentSeriesId(null); // Reset para próxima série
                }
              }
            }
            
            // O useEffect vai verificar automaticamente quando todas as páginas estiverem prontas
            // Mas vamos garantir que o estado está atualizado
            setTimeout(() => {
              if (isGenerationComplete()) {
                setIsGenerating(false);
              }
            }, 500);

          } catch (e) {
              console.error("Generation Error", e);
              handleAPIError(e);
              // handleAPIError já define setIsGenerating(false) para erros 429
              // Para outros erros, também precisamos parar a geração
              const errorStr = String(e);
              if (!errorStr.includes('429') && !errorStr.includes('RESOURCE_EXHAUSTED')) {
              setIsGenerating(false);
              }
          }
      })();
  };

  // Função para redimensionar imagem base64 para reduzir tamanho
  const resizeBase64Image = (base64: string, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Calcular novo tamanho mantendo proporção
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Desenhar imagem redimensionada
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Converter para base64 com qualidade reduzida
        const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(resizedBase64);
      };
      img.src = base64;
    });
  };

  // Função para gerar PDF e fazer upload para storage
  const generateAndUploadPDFWithFaces = async (faces: ComicFace[]): Promise<string | null> => {
    try {
      console.log('[generateAndUploadPDFWithFaces] Iniciando geração de PDF...');
      console.log('[generateAndUploadPDFWithFaces] Faces recebidas:', faces.length);
      
      // Filtrar e ordenar as páginas corretamente
      const sortedFaces = faces
        .filter(f => f.imageUrl)
        .sort((a, b) => {
          // Ordenar: capa (0), story pages (1-10), contracapa (11)
          const aIndex = a.pageIndex ?? (a.type === 'cover' ? 0 : a.type === 'back_cover' ? 11 : 999);
          const bIndex = b.pageIndex ?? (b.type === 'cover' ? 0 : b.type === 'back_cover' ? 11 : 999);
          return aIndex - bIndex;
        });

      console.log('[generateAndUploadPDFWithFaces] Faces com imagem:', sortedFaces.length);
      
      if (sortedFaces.length === 0) {
        console.error('[generateAndUploadPDFWithFaces] Nenhuma página disponível para gerar PDF');
        return null;
      }

      console.log(`[generateAndUploadPDFWithFaces] Gerando PDF com ${sortedFaces.length} páginas...`);

      // Criar PDF em formato A4 (210mm x 297mm) com compressão
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true // Ativar compressão
      });

      // Dimensões da página A4 em mm
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Margens
      const margin = 5;
      const imageWidth = pageWidth - (margin * 2);
      const imageHeight = pageHeight - (margin * 2);

      sortedFaces.forEach((face, index) => {
        // Adicionar nova página para cada face (exceto a primeira)
        if (index > 0) {
            doc.addPage();
        }

        if (face.imageUrl) {
          // Calcular posição para centralizar a imagem
          const x = margin;
          const y = margin;
          
          // Adicionar imagem ocupando quase toda a página
          try {
            doc.addImage(
              face.imageUrl, 
              'JPEG', 
              x, 
              y, 
              imageWidth, 
              imageHeight,
              undefined,
              'MEDIUM' // Qualidade média para reduzir tamanho
            );
          } catch (error) {
            console.error(`Erro ao adicionar imagem da página ${face.pageIndex || face.type}:`, error);
            // Se falhar, tentar com tamanho menor e qualidade menor
            doc.addImage(
              face.imageUrl, 
              'JPEG', 
              x, 
              y, 
              imageWidth * 0.8, 
              imageHeight * 0.8,
              undefined,
              'FAST'
            );
          }
        }
      });

      console.log('[generateAndUploadPDFWithFaces] PDF gerado, convertendo para blob...');

      // Converter PDF para blob
      const pdfBlob = doc.output('blob');
      console.log(`[generateAndUploadPDFWithFaces] PDF blob criado, tamanho: ${pdfBlob.size} bytes`);

      // Verificar se usuário está autenticado
      if (!user) {
        console.error('[generateAndUploadPDFWithFaces] Usuário não autenticado');
        return null;
      }

      // Gerar nome do arquivo
      const isSeries = sortedFaces.some(f => f.isSeriesPart);
      const seriesPartNum = sortedFaces.find(f => f.partNumber)?.partNumber;
      
      const fileName = isSeries && seriesTitle && seriesPartNum
        ? `SuperKids_${seriesTitle}_Parte${seriesPartNum}.pdf`
        : `SuperKids_${heroName || 'Comic'}.pdf`;

      // Fazer upload para storage
      const filePath = `${user.id}/pdfs/${crypto.randomUUID()}_${fileName}`;
      console.log(`[generateAndUploadPDFWithFaces] Fazendo upload para: ${filePath}`);
      console.log(`[generateAndUploadPDFWithFaces] Tamanho do arquivo: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);

      // Adicionar logs de progresso
      const progressInterval = setInterval(() => {
        console.log('[generateAndUploadPDFWithFaces] Upload em progresso... (aguarde até 90s)');
      }, 10000); // Log a cada 10 segundos

      const uploadPromise = supabase.storage
        .from('comics-images')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => {
          clearInterval(progressInterval);
          reject(new Error('Timeout no upload do PDF (90s)'));
        }, 90000)
      );

      const { data: uploadData, error: uploadError } = await Promise.race([
        uploadPromise,
        timeoutPromise
      ]) as any;

      clearInterval(progressInterval); // Limpar interval quando terminar

      if (uploadError) {
        console.error('[generateAndUploadPDFWithFaces] Erro ao fazer upload do PDF:', uploadError);
        return null;
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('comics-images')
        .getPublicUrl(filePath);

      console.log('[generateAndUploadPDFWithFaces] PDF enviado para storage:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('[generateAndUploadPDFWithFaces] Erro ao gerar/fazer upload do PDF:', error);
      return null;
    }
  };

  // Função para gerar PDF e fazer upload para storage (usando comicFaces do estado)
  const generateAndUploadPDF = async (): Promise<string | null> => {
    return generateAndUploadPDFWithFaces(comicFaces);
  };

  // Função para fazer upload das imagens individuais em background
  const uploadImagesInBackground = async (comicId: string, faces: ComicFace[]) => {
    console.log('[uploadImagesInBackground] Iniciando upload de', faces.length, 'imagens...');
    
    try {
      const imageUpdates: Record<string, string> = {};
      let successCount = 0;
      let failCount = 0;
      
      for (const face of faces) {
        if (!face.imageUrl || !face.imageUrl.startsWith('data:')) {
          console.log(`[uploadImagesInBackground] Pulando ${face.type} (página ${face.pageIndex}) - sem imagem válida`);
          continue; // Pular se não é base64
        }
        
        try {
          // Redimensionar imagem para reduzir tamanho
          const resizedImage = await resizeBase64Image(face.imageUrl, 800, 0.8);
          
          // Determinar nome da coluna no banco
          let columnName = '';
          if (face.type === 'cover') {
            columnName = 'cover_url';
          } else if (face.type === 'back_cover') {
            columnName = 'back_cover_url';
          } else if (face.pageIndex && face.pageIndex >= 1 && face.pageIndex <= 10) {
            columnName = `page_${face.pageIndex}_url`;
          } else {
            console.warn('[uploadImagesInBackground] Face sem tipo válido:', face);
            continue;
          }
          
          // Fazer upload para storage
          const fileName = `${comicId}/${face.type}-${face.pageIndex || face.id}.jpg`;
          const filePath = `${user!.id}/comics/${fileName}`;
          
          console.log(`[uploadImagesInBackground] Uploading ${columnName}...`);
          
          // Converter base64 para blob
          const base64Data = resizedImage.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });
          
          // Upload com timeout menor (individual)
          const uploadPromise = supabase.storage
            .from('comics-images')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: true
            });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 30000)
          );
          
          const { data: uploadData, error: uploadError } = await Promise.race([
            uploadPromise,
            timeoutPromise
          ]) as any;
          
          if (uploadError) {
            console.error(`[uploadImagesInBackground] Erro no upload de ${columnName}:`, uploadError);
            failCount++;
            continue;
          }
          
          // Obter URL pública
          const { data: urlData } = supabase.storage
            .from('comics-images')
            .getPublicUrl(filePath);
          
          imageUpdates[columnName] = urlData.publicUrl;
          successCount++;
          console.log(`[uploadImagesInBackground] ✅ ${columnName} uploaded`);
          
        } catch (error) {
          console.error(`[uploadImagesInBackground] Erro ao processar imagem:`, error);
          failCount++;
        }
      }
      
      // Atualizar banco com URLs das imagens
      if (Object.keys(imageUpdates).length > 0) {
        console.log('[uploadImagesInBackground] Atualizando banco com URLs...');
        const { error: updateError } = await supabase
          .from('comics')
          .update(imageUpdates)
          .eq('id', comicId);
        
        if (updateError) {
          console.error('[uploadImagesInBackground] Erro ao atualizar URLs:', updateError);
        } else {
          console.log(`[uploadImagesInBackground] ✅ ${Object.keys(imageUpdates).length} URLs atualizadas no banco`);
        }
      }
      
      console.log(`[uploadImagesInBackground] Concluído: ${successCount} sucessos, ${failCount} falhas`);
      
      // PASSO 3: Tentar gerar PDF (opcional)
      if (successCount > 0) {
        console.log('[uploadImagesInBackground] PASSO 3: Tentando gerar PDF...');
        await generatePDFInBackground(comicId, faces);
      }
      
    } catch (error) {
      console.error('[uploadImagesInBackground] Erro geral:', error);
    }
  };

  // Função para gerar PDF em background (opcional)
  const generatePDFInBackground = async (comicId: string, faces: ComicFace[]) => {
    try {
      console.log('[generatePDFInBackground] Gerando PDF...');
      const pdfUrl = await generateAndUploadPDFWithFaces(faces);
      
      if (pdfUrl) {
        // Atualizar banco com URL do PDF
        const { error: updateError } = await supabase
          .from('comics')
          .update({ pdf_url: pdfUrl })
          .eq('id', comicId);
        
        if (updateError) {
          console.error('[generatePDFInBackground] Erro ao salvar PDF URL:', updateError);
        } else {
          console.log('[generatePDFInBackground] ✅ PDF salvo:', pdfUrl);
        }
      } else {
        console.warn('[generatePDFInBackground] PDF não foi gerado, mas gibi já está salvo');
      }
    } catch (error) {
      console.error('[generatePDFInBackground] Erro ao gerar PDF:', error);
    }
  };

  const handleDownload = async () => {
    try {
      console.log('[handleDownload] Iniciando download...');
      
      // Filtrar e ordenar as páginas corretamente
      const sortedFaces = comicFaces
        .filter(f => f.imageUrl)
        .sort((a, b) => {
          // Ordenar: capa (0), story pages (1-10), contracapa (11)
          const aIndex = a.pageIndex ?? (a.type === 'cover' ? 0 : a.type === 'back_cover' ? 11 : 999);
          const bIndex = b.pageIndex ?? (b.type === 'cover' ? 0 : b.type === 'back_cover' ? 11 : 999);
          return aIndex - bIndex;
        });

      if (sortedFaces.length === 0) {
        setErrorMessage('Nenhuma página disponível para download.');
        return;
      }

      // Criar PDF em formato A4 (210mm x 297mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Dimensões da página A4 em mm
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Margens
      const margin = 5;
      const imageWidth = pageWidth - (margin * 2);
      const imageHeight = pageHeight - (margin * 2);

      // Processar cada face
      for (let index = 0; index < sortedFaces.length; index++) {
        const face = sortedFaces[index];
        
        // Adicionar nova página para cada face (exceto a primeira)
        if (index > 0) {
          doc.addPage();
        }

        if (face.imageUrl) {
          console.log(`[generateAndUploadPDFWithFaces] Processando página ${index + 1}/${sortedFaces.length}`);
          
          // Redimensionar imagem se for base64 para reduzir tamanho
          let processedImageUrl = face.imageUrl;
          if (face.imageUrl.startsWith('data:')) {
            try {
              processedImageUrl = await resizeBase64Image(face.imageUrl, 1200, 0.85);
              console.log(`[generateAndUploadPDFWithFaces] Imagem ${index + 1} redimensionada`);
            } catch (error) {
              console.warn(`[generateAndUploadPDFWithFaces] Falha ao redimensionar imagem ${index + 1}, usando original`);
            }
          }
          
          // Calcular posição para centralizar a imagem
          const x = margin;
          const y = margin;
          
          // Adicionar imagem ocupando quase toda a página
          try {
            doc.addImage(
              processedImageUrl, 
              'JPEG', 
              x, 
              y, 
              imageWidth, 
              imageHeight,
              undefined,
              'MEDIUM' // Qualidade média para reduzir tamanho
            );
          } catch (error) {
            console.error(`Erro ao adicionar imagem da página ${face.pageIndex || face.type}:`, error);
            // Se falhar, tentar com tamanho menor e qualidade menor
            try {
              doc.addImage(
                processedImageUrl, 
                'JPEG', 
                x, 
                y, 
                imageWidth * 0.8, 
                imageHeight * 0.8,
                undefined,
                'FAST'
              );
            } catch (fallbackError) {
              console.error(`Erro crítico ao adicionar imagem ${index + 1}:`, fallbackError);
            }
          }
        }
      }

      // Salvar PDF localmente
      const isSeries = sortedFaces.some(f => f.isSeriesPart);
      const seriesPartNum = sortedFaces.find(f => f.partNumber)?.partNumber;
      
      const fileName = isSeries && seriesTitle && seriesPartNum
        ? `SuperKids_${seriesTitle}_Parte${seriesPartNum}.pdf`
        : `SuperKids_${heroName || 'Comic'}.pdf`;
      
      doc.save(fileName);
      console.log(`[handleDownload] PDF baixado com ${sortedFaces.length} páginas`);
    } catch (error) {
      console.error('[handleDownload] Erro ao gerar PDF:', error);
      setErrorMessage('Erro ao gerar PDF para download.');
    }
  };

  // --- Render ---

  // Sheet Navigation
  const prevPage = () => {
     if (currentSheetIndex > 0) setCurrentSheetIndex(p => p - 1);
  };
  const nextPage = () => {
     if (currentSheetIndex < Math.ceil(TOTAL_PAGES / 2)) setCurrentSheetIndex(p => p + 1);
  };

  // Função para verificar se geração está completa
  const isGenerationComplete = () => {
    const hasCover = comicFaces.some(f => f.type === 'cover' && f.imageUrl);
    const storyPages = comicFaces.filter(f => f.type === 'story');
    const hasAllStoryPages = storyPages.length === MAX_STORY_PAGES && storyPages.every(f => f.imageUrl);
    const hasBackCover = comicFaces.some(f => f.type === 'back_cover' && f.imageUrl);
    return hasCover && hasAllStoryPages && hasBackCover;
  };

  // useEffect para verificar quando geração está completa
  useEffect(() => {
    if (isGenerating && isGenerationComplete()) {
      setIsGenerating(false);
    }
  }, [comicFaces, isGenerating]);

  // Status computation for display
  const generatedPagesCount = comicFaces.filter(f => f.type === 'story' && f.imageUrl).length;
  const isActuallyGenerating = isGenerating && !isGenerationComplete();
  
  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#222] flex items-center justify-center">
        <div className="text-white text-4xl font-comic animate-pulse">CARREGANDO...</div>
      </div>
    );
  }

  // Mostrar landing page se não estiver autenticado e não estiver na tela de login
  if (!user && showLanding && !showLogin) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // Mostrar página de login
  if (!user && showLogin) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Se não estiver autenticado mas não está em landing nem login, mostrar landing
  if (!user) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }
  
  return (
    <div className="min-h-screen bg-[#222] font-comic relative">
      <Navbar 
         activeTab={activeTab} 
         onTabChange={setActiveTab} 
         credits={credits} 
         isGenerating={isGenerating} 
         user={user}
         onLogout={handleLogout}
      />
      
      <div className="pt-20 pb-10 container mx-auto px-4 min-h-[calc(100vh-80px)]">
        
        {/* Error Message Toast */}
        {errorMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] max-w-2xl w-full mx-4 animate-in slide-in-from-top duration-300">
            <div className="bg-red-100 border-[6px] border-red-600 shadow-[12px_12px_0px_rgba(0,0,0,1)] p-6 relative">
              <button
                onClick={() => setErrorMessage(null)}
                className="absolute top-2 right-2 text-red-600 hover:text-red-800 font-bold text-2xl"
              >
                ×
              </button>
              <h3 className="font-comic text-2xl text-red-800 mb-3 uppercase">Erro na Geração</h3>
              <div className="font-comic text-lg text-red-700 whitespace-pre-line">
                {errorMessage}
              </div>
              <div className="mt-4 flex gap-3">
                <a
                  href="https://ai.google.dev/gemini-api/docs/billing"
                  target="_blank"
                  rel="noreferrer"
                  className="comic-btn bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-500"
                >
                  Ver Documentação
                </a>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="comic-btn bg-gray-600 text-white px-4 py-2 text-sm hover:bg-gray-500"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* CREATE TAB */}
        {activeTab === 'create' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Setup 
                  hero={hero}
                  heroName={heroName}
                  selectedGenre={selectedGenre}
                  customPremise={customPremise}
                  comicType={comicType}
                  seriesTitle={seriesTitle}
                  seriesParts={seriesParts}
                  credits={credits}
                  onHeroUpload={(f) => {
                     fileToBase64(f).then(b64 => setHero({ base64: b64, desc: "Hero" }));
                  }}
                  onHeroNameChange={setHeroName}
                  onGenreChange={setSelectedGenre}
                  onPremiseChange={setCustomPremise}
                  onComicTypeChange={setComicType}
                  onSeriesTitleChange={setSeriesTitle}
                  onSeriesPartsChange={setSeriesParts}
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
                                {isActuallyGenerating ? (
                                    <>
                                        <div className="text-4xl mb-2 animate-bounce">⏳</div>
                                        <p className="font-comic text-sm text-gray-600 leading-tight uppercase">
                                            SEU GIBI ESTÁ SENDO GERADO.<br/>
                                            AGUARDE ATÉ QUE TODAS AS PÁGINAS ESTEJAM PRONTAS.
                                        </p>
                                    </>
                                ) : isGenerationComplete() ? (
                                    <div className="py-4">
                                        <p className="font-comic text-xl text-green-600 animate-pulse">✓ EDIÇÃO COMPLETA!</p>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <p className="font-comic text-sm text-gray-600">Aguardando início da geração...</p>
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
                                    disabled={isActuallyGenerating || !isGenerationComplete()}
                                    className={`w-full py-3 border-4 font-comic text-xl uppercase transition-all ${
                                        isActuallyGenerating || !isGenerationComplete()
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
            <Gallery
              onSelectComic={(comic) => {
                // Se tem PDF, abrir diretamente
                if (comic.pdf_url) {
                  window.open(comic.pdf_url, '_blank');
                } else if (comic.comic_data?.comicFaces) {
                  // Fallback para gibis antigos com imagens
                  setComicFaces(comic.comic_data.comicFaces);
                  setHeroName(comic.hero_name);
                  setSelectedGenre(comic.genre);
                  setStoryTone(comic.story_tone);
                  setCurrentSheetIndex(0);
                  setActiveTab('read');
                }
              }}
              onDeleteComic={(id) => {
                // Atualizar contador de gibis
                setTotalComics(prev => Math.max(0, prev - 1));
                // Se o gibi deletado é o que está sendo visualizado, limpar
                if (comicFaces.length > 0) {
                  setComicFaces([]);
                  setHeroName('');
                  if (activeTab === 'read') {
                    setActiveTab('gallery');
                  }
                }
              }}
            />
        )}
        
         {/* PROFILE TAB */}
         {activeTab === 'profile' && (
            <ProfileTab 
              user={user}
              credits={credits}
              totalComics={totalComics}
              onLogout={handleLogout}
              onCreditsUpdate={async () => {
                // Recarregar créditos do perfil
                if (user) {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits')
                    .eq('id', user.id)
                    .single();
                  if (profile) {
                    setCredits(profile.credits);
                  }
                }
              }}
            />
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
