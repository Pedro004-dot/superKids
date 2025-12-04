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
}

export interface Beat {
  caption?: string;
  dialogue?: string;
  scene: string;
  focus_char: 'hero' | 'friend' | 'other';
}

export interface Persona {
  base64: string;
  desc: string;
}