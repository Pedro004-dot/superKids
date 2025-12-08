/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const MAX_STORY_PAGES = 10;
export const BACK_COVER_PAGE = 11;
export const TOTAL_PAGES = 11;
export const INITIAL_PAGES = 2;
export const GATE_PAGE = 2;
export const BATCH_SIZE = 6;

export const GENRES = [
    "Aventura de Super-herói", 
    "Reino Mágico", 
    "Mistério na Escola", 
    "Viagem Espacial", 
    "Amigos Animais", 
    "Esportes Radicais", 
    "Conto de Fadas Moderno", 
    "Comédia Maluca", 
    "Personalizado"
];

export const TONES = [
    "EMPOLGANTE (Muita ação e energia!)",
    "DIVERTIDO (Muitas risadas e brincadeiras.)",
    "MISTERIOSO (Segredos e pistas para descobrir.)",
    "AMIGÁVEL (Foco na amizade e bondade.)",
    "CORAJOSO (Enfrentando medos juntos.)"
];

export interface TokenStats {
    input: number;
    output: number;
    totalRequests: number;
    model: string;
}

export interface ComicFace {
  id: string;
  type: 'cover' | 'story' | 'back_cover';
  imageUrl?: string;
  narrative?: Beat;
  isLoading: boolean;
  pageIndex?: number;
  seriesId?: string;
  partNumber?: number;
  isSeriesPart?: boolean;
}

export interface Panel {
  caption?: string;
  dialogue?: string;
  scene: string;
  focus_char: 'hero' | 'friend' | 'other';
}

export interface Beat {
  // Nova estrutura: array de 4 painéis
  panels?: Panel[];
  // Campos legados para compatibilidade (usados quando panels não existe)
  caption?: string;
  dialogue?: string;
  scene: string;
  focus_char: 'hero' | 'friend' | 'other';
}

export interface Persona {
  base64: string;
  desc: string;
}

export type ComicType = 'single' | 'series';
export type ColorMode = 'color' | 'bw';

export interface ComicSeries {
  id: string;
  title: string;
  heroName: string;
  genre: string;
  storyTone: string;
  totalParts: number;
  currentPart: number;
  status: 'in_progress' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
  isActive: boolean;
}

export interface Purchase {
  id: string;
  userId: string;
  planId: string;
  creditsAdded: number;
  pricePaid: number;
  paymentProvider: 'stripe' | 'mercadopago' | 'pix';
  paymentMethod?: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  externalPaymentId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface VisualStyleBase {
  art_style: string;
  color_palette: string;
  line_style: string;
  lighting_style: string;
  character_rendering: string;
  reference_image?: string;
}

export interface StoryPagePanel {
  panel_number: number;
  scene_description: string;
  environment: string;
  characters: Array<{
    name: string;
    role: 'hero' | 'friend' | 'other';
    appearance_notes: string;
    dialogue?: string;
  }>;
  caption?: string;
  dialogue?: string;
  focus_character: 'hero' | 'friend' | 'other';
  visual_notes: string;
}

export interface StoryPage {
  page_number: number;
  panels: StoryPagePanel[];
}

export interface CompleteStory {
  story_metadata: {
    title: string;
    hero_name: string;
    genre: string;
    tone: string;
    total_pages: number;
    visual_style_base: string;
  };
  pages: StoryPage[];
}