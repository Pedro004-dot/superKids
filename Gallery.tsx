/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { ComicFace } from './types';
import { supabase } from './supabase';

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
}

export const Gallery: React.FC<GalleryProps> = ({ onSelectComic, onDeleteComic }) => {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');

  useEffect(() => {
    loadComics();
  }, []);

  const loadComics = async () => {
    try {
      const { data, error } = await supabase
        .from('comics')
        .select('*, comic_series(title, total_parts, current_part, status)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComics(data || []);
    } catch (error) {
      console.error('Erro ao carregar gibis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja deletar este gibi?')) return;

    try {
      const { error } = await supabase
        .from('comics')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setComics(prev => prev.filter(c => c.id !== id));
      onDeleteComic(id);
    } catch (error) {
      console.error('Erro ao deletar gibi:', error);
      alert('Erro ao deletar gibi. Tente novamente.');
    }
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
            const coverImage = comic.comic_data?.comicFaces?.find(f => f.type === 'cover')?.imageUrl;
            const heroName = comic.hero_name;
            const genre = comic.genre;
            const createdAt = new Date(comic.created_at).toLocaleDateString('pt-BR');
            const isSeriesPart = comic.is_series_part && comic.part_number;
            const seriesInfo = comic.series_id && (comic as any).comic_series;

            return (
              <div
                key={comic.id}
                onClick={() => onSelectComic(comic)}
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
                  onClick={(e) => handleDelete(comic.id, e)}
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
    </div>
  );
};

