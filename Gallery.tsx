/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { ComicFace } from './types';
import { supabase } from './supabase';

// Constantes para fallback REST
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://nxorwtmtgxvpqmrwhvdx.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3J3dG10Z3h2cHFtcndodmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg2MjAsImV4cCI6MjA4MDQ1NDYyMH0.L4ddiW6F38HrOwdwTlFKALAHvVPXTJkyE0IyNb4W1P8';

interface Comic {
  id: string;
  hero_name: string;
  genre: string;
  story_tone: string;
  series_id?: string;
  part_number?: number;
  is_series_part?: boolean;
  pdf_url?: string;
  total_pages?: number;
  // URLs das imagens individuais
  cover_url?: string;
  page_1_url?: string;
  page_2_url?: string;
  page_3_url?: string;
  page_4_url?: string;
  page_5_url?: string;
  page_6_url?: string;
  page_7_url?: string;
  page_8_url?: string;
  page_9_url?: string;
  page_10_url?: string;
  back_cover_url?: string;
  comic_data: {
    comicFaces?: ComicFace[];
    heroName: string;
    selectedGenre: string;
    storyTone: string;
    createdAt: string;
    pdfUrl?: string;
    totalPages?: number;
  };
  created_at: string;
}

interface GalleryProps {
  onSelectComic: (comic: Comic) => void;
  onDeleteComic: (id: string) => void;
  userId?: string | null;
}

export const Gallery: React.FC<GalleryProps> = ({ onSelectComic, onDeleteComic, userId }) => {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  
  // Estados para modais
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);

  useEffect(() => {
    console.log('[Gallery useEffect] Iniciando...');
    
    // Timeout de EMERGÊNCIA - forçar loading=false após 5s
    const emergencyTimeout = setTimeout(() => {
      console.error('[Gallery] ⚠️ TIMEOUT DE EMERGÊNCIA (5s) - Forçando loading=false');
      setLoading(false);
      setComics([]);
    }, 5000);
    
    loadComics().finally(() => {
      clearTimeout(emergencyTimeout);
    });
    
    return () => {
      clearTimeout(emergencyTimeout);
    };
  }, [userId]);

  const loadComics = async () => {
    console.log('[Gallery.loadComics] ===== FUNÇÃO CHAMADA =====');
    const startTime = Date.now();
    
    try {
      console.log('[Gallery] ===== CARREGANDO GIBIS =====');
      console.log('[Gallery] Timestamp:', new Date().toISOString());
      console.log('[Gallery] Loading atual:', loading);
      console.log('[Gallery] User ID recebido:', userId);
      console.log('[Gallery] User ID tipo:', typeof userId);
      console.log('[Gallery] User ID válido?', !!userId);
      console.log('[Gallery] Supabase client disponível:', !!supabase);
      
      // Obter user do Supabase com TIMEOUT
      let currentUserId = userId;
      
      if (!currentUserId) {
        console.log('[Gallery] User ID não fornecido, tentando obter do Supabase (timeout 1s)...');
        try {
          const userPromise = supabase.auth.getUser();
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => {
            console.warn('[Gallery] ⏱️ TIMEOUT (1s) ao obter usuário');
            resolve(null);
          }, 1000));
          
          const result = await Promise.race([userPromise, timeoutPromise]);
          
          if (result && result.data?.user) {
            currentUserId = result.data.user.id;
            console.log('[Gallery] ✓ User ID obtido do Supabase:', currentUserId);
          } else {
            console.warn('[Gallery] ⚠️ Não foi possível obter user ID, carregando TODOS os gibis');
          }
        } catch (err) {
          console.warn('[Gallery] ⚠️ Erro ao obter user (não-crítico):', err);
        }
      }
      
      console.log('[Gallery] User ID final para filtro:', currentUserId);
      
      let query = supabase
        .from('comics')
        .select('*');
      
      // Filtrar por usuário apenas se tivermos o ID
      if (currentUserId) {
        console.log('[Gallery] Filtrando por user_id:', currentUserId);
        query = query.eq('user_id', currentUserId);
      } else {
        console.log('[Gallery] ⚠️ SEM FILTRO - Carregando TODOS os gibis (auth travou)');
      }
      
      console.log('[Gallery] Executando query...');
      
      // Timeout de 3s na query
      const queryPromise = query.order('created_at', { ascending: false });
      const timeoutPromise = new Promise<{ data: null, error: any }>((resolve) => {
        setTimeout(() => {
          console.error('[Gallery] ⏱️ TIMEOUT (3s) na query!');
          resolve({ data: null, error: { message: 'Query timeout' } });
        }, 3000);
      });
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      console.log('[Gallery] ⏱️ Query levou:', Date.now() - startTime, 'ms');
      console.log('[Gallery] Resposta:', { 
        dataLength: data?.length, 
        error: error?.message,
        data: data?.map(c => ({ id: c.id, hero_name: c.hero_name, user_id: c.user_id }))
      });
      
      if (error) {
        console.error('[Gallery] ❌ Erro na query:', error);
        
        // Se deu timeout, tentar sem query builder (usar REST direto)
        if (error?.message === 'Query timeout') {
          console.warn('[Gallery] Tentando método alternativo (REST API direto)...');
          
          try {
            const restUrl = `${(window as any).__supabaseUrl || 'https://nxorwtmtgxvpqmrwhvdx.supabase.co'}/rest/v1/comics`;
            const restResponse = await fetch(`${restUrl}?order=created_at.desc`, {
              headers: {
                'apikey': (window as any).__supabaseAnonKey || SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${(window as any).__supabaseAnonKey || SUPABASE_ANON_KEY}`
              },
              signal: AbortSignal.timeout(3000)
            });
            
            if (restResponse.ok) {
              const restData = await restResponse.json();
              console.log('[Gallery] ✅ Dados via REST:', restData.length);
              setComics(restData || []);
              setLoading(false);
              return;
            }
          } catch (restErr) {
            console.error('[Gallery] ❌ REST também falhou:', restErr);
          }
        }
        
        // Se tudo falhar, mostrar array vazio
        console.warn('[Gallery] Mostrando galeria vazia');
        setComics([]);
        setLoading(false);
        return;
      }
      
      console.log('[Gallery] ✅ Gibis carregados:', data?.length || 0);
      console.log('[Gallery] ===== CARREGAMENTO COMPLETO =====');
      setComics(data || []);
    } catch (error) {
      console.error('[Gallery] ❌ EXCEÇÃO ao carregar gibis:', error);
      console.log('[Gallery] ⏱️ Tempo até exceção:', Date.now() - startTime, 'ms');
      
      // Garantir que loading seja desativado
      setComics([]);
      setLoading(false);
    } finally {
      console.log('[Gallery] Finally block - setLoading(false)');
      setLoading(false);
    }
  };

  const handleDeleteClick = (comic: Comic, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedComic(comic);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedComic) return;

    try {
      const { error } = await supabase
        .from('comics')
        .delete()
        .eq('id', selectedComic.id);

      if (error) throw error;

      setComics(prev => prev.filter(comic => comic.id !== selectedComic.id));
      onDeleteComic(selectedComic.id);
      setShowDeleteModal(false);
      setSelectedComic(null);
    } catch (error) {
      console.error('Erro ao deletar gibi:', error);
      alert('Erro ao deletar o gibi. Tente novamente.');
    }
  };

  const handleComicClick = (comic: Comic) => {
    setSelectedComic(comic);
    setShowViewModal(true);
  };

  const handleViewComic = () => {
    if (!selectedComic) return;
    setShowViewModal(false);
    onSelectComic(selectedComic);
  };

  const handleDownloadPDF = () => {
    if (!selectedComic?.pdf_url) return;
    window.open(selectedComic.pdf_url, '_blank');
    setShowViewModal(false);
  };

  const filteredComics = comics.filter(comic => {
    const matchesSearch = comic.hero_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comic.genre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = filterGenre === 'all' || comic.genre === filterGenre;
    return matchesSearch && matchesGenre;
  });

  const sortedComics = [...filteredComics].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'name':
        return a.hero_name.localeCompare(b.hero_name);
      case 'newest':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const genres = Array.from(new Set(comics.map(c => c.genre)));

  if (loading) {
    return (
      <div className="text-center text-white pt-20">
        <div className="text-4xl mb-4 animate-pulse">⏳</div>
        <p className="text-xl">Carregando sua galeria...</p>
      </div>
    );
  }

  if (comics.length === 0) {
    return (
      <div className="text-center text-white pt-20">
        <h2 className="text-4xl mb-4">Galeria de Heróis</h2>
        <div className="bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-8 max-w-md mx-auto text-black">
          <p className="font-comic text-xl mb-4">Nenhum gibi criado ainda!</p>
          <p className="text-gray-600 mb-6">Crie seu primeiro gibi na aba "Criar"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-10 container mx-auto px-4">
      <h2 className="text-4xl md:text-5xl text-white text-center mb-8 font-comic" style={{textShadow: '2px 2px 0px black'}}>
        Galeria de Heróis
      </h2>

      {/* Filtros e Busca */}
      <div className="bg-white border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-6 mb-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div>
            <label className="block font-comic text-lg mb-2 text-black">BUSCAR</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome do herói..."
              className="w-full p-2 border-2 border-black font-comic text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.1)] focus:outline-none bg-white text-black"
            />
          </div>

          {/* Filtro por Gênero */}
          <div>
            <label className="block font-comic text-lg mb-2 text-black">GÊNERO</label>
            <select
              value={filterGenre}
              onChange={(e) => setFilterGenre(e.target.value)}
              className="w-full p-2 border-2 border-black font-comic text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.1)] focus:outline-none bg-white text-black cursor-pointer"
            >
              <option value="all">Todos</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>

          {/* Ordenação */}
          <div>
            <label className="block font-comic text-lg mb-2 text-black">ORDENAR</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full p-2 border-2 border-black font-comic text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.1)] focus:outline-none bg-white text-black cursor-pointer"
            >
              <option value="newest">Mais Recente</option>
              <option value="oldest">Mais Antigo</option>
              <option value="name">A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Gibis */}
      {sortedComics.length === 0 ? (
        <div className="text-center text-white">
          <p className="text-2xl">Nenhum gibi encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {sortedComics.map((comic) => {
            const coverImage = comic.cover_url || comic.comic_data?.comicFaces?.find(f => f.type === 'cover')?.imageUrl;
            const heroName = comic.hero_name;
            const genre = comic.genre;
            const createdAt = new Date(comic.created_at).toLocaleDateString('pt-BR');
            const isSeriesPart = comic.is_series_part && comic.part_number;
            const seriesInfo = comic.series_id && (comic as any).comic_series;

            return (
              <div
                key={comic.id}
                onClick={() => handleComicClick(comic)}
                className="bg-white border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] cursor-pointer hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all group relative"
              >
                {/* Badge de Série */}
                {isSeriesPart && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 border-2 border-black font-comic text-sm font-bold z-20 shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">
                    Parte {comic.part_number}
                    {seriesInfo && `/${seriesInfo.total_parts}`}
                  </div>
                )}

                {/* Imagem da Capa */}
                {coverImage ? (
                  <div className="aspect-[2/3] overflow-hidden bg-gray-200">
                    <img
                      src={coverImage}
                      alt={`Capa de ${heroName}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-[2/3] bg-gray-200 flex items-center justify-center">
                    <span className="text-4xl">📚</span>
                  </div>
                )}

                {/* Informações */}
                <div className="p-4">
                  <h3 className="font-comic text-xl text-black mb-2 uppercase truncate">
                    {seriesInfo?.title || heroName}
                  </h3>
                  {isSeriesPart && seriesInfo && (
                    <p className="text-xs text-blue-600 mb-1 font-bold">
                      {seriesInfo.title} - Parte {comic.part_number}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mb-1">{genre}</p>
                  <p className="text-xs text-gray-500">{createdAt}</p>
                </div>

                {/* Botão Deletar */}
                <button
                  onClick={(e) => handleDeleteClick(comic, e)}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 border-2 border-black"
                  title="Deletar gibi"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Overlay no Hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="font-comic text-2xl text-white uppercase">CLIQUE PARA VER</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contador */}
      <div className="text-center text-white mt-8">
        <p className="font-comic text-xl">
          {sortedComics.length} {sortedComics.length === 1 ? 'gibi' : 'gibis'} {searchTerm || filterGenre !== 'all' ? 'encontrado(s)' : 'na galeria'}
        </p>
      </div>

      {/* Modal de Confirmação de Delete */}
      {showDeleteModal && selectedComic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] max-w-md w-full p-6">
            <h3 className="font-comic text-2xl text-black mb-4 text-center">DELETAR GIBI</h3>
            <p className="text-center text-black mb-6">
              Tem certeza que deseja deletar o gibi <strong>"{selectedComic.hero_name}"</strong>?
            </p>
            <p className="text-center text-red-600 text-sm mb-6">
              Esta ação não pode ser desfeita!
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedComic(null);
                }}
                className="flex-1 bg-gray-500 text-white p-3 border-2 border-black font-comic text-lg hover:bg-gray-600 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white p-3 border-2 border-black font-comic text-lg hover:bg-red-700 transition-colors"
              >
                DELETAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {showViewModal && selectedComic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] max-w-md w-full p-6">
            <h3 className="font-comic text-2xl text-black mb-4 text-center">VISUALIZAR GIBI</h3>
            
            {/* Capa do Gibi */}
            <div className="mb-6 flex justify-center">
              <div className="w-32 h-48 border-2 border-black overflow-hidden">
                {(selectedComic.cover_url || selectedComic.comic_data?.comicFaces?.find(f => f.type === 'cover')?.imageUrl) ? (
                  <img
                    src={selectedComic.cover_url || selectedComic.comic_data?.comicFaces?.find(f => f.type === 'cover')?.imageUrl}
                    alt={`Capa de ${selectedComic.hero_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-2xl">📚</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center mb-6">
              <h4 className="font-comic text-xl text-black mb-2">{selectedComic.hero_name}</h4>
              <p className="text-gray-600 mb-1">{selectedComic.genre}</p>
              <p className="text-gray-500 text-sm">
                {selectedComic.total_pages || 1} páginas • {new Date(selectedComic.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="space-y-3">
              {/* Botão Visualizar */}
              <button
                onClick={handleViewComic}
                className="w-full bg-blue-600 text-white p-3 border-2 border-black font-comic text-lg hover:bg-blue-700 transition-colors"
              >
                📖 VISUALIZAR NO APP
              </button>

              {/* Botão Download PDF (se disponível) */}
              {selectedComic.pdf_url && (
                <button
                  onClick={handleDownloadPDF}
                  className="w-full bg-green-600 text-white p-3 border-2 border-black font-comic text-lg hover:bg-green-700 transition-colors"
                >
                  📄 ABRIR PDF EM NOVA ABA
                </button>
              )}

              {/* Botão Cancelar */}
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedComic(null);
                }}
                className="w-full bg-gray-500 text-white p-3 border-2 border-black font-comic text-lg hover:bg-gray-600 transition-colors"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

