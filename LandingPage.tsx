/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { usePlans } from './payment/hooks/usePlans';

interface LandingPageProps {
  onGetStarted: () => void;
}

interface PublicComic {
  id: string;
  hero_name: string;
  genre: string;
  cover_url?: string;
  comic_data?: {
    comicFaces?: Array<{ type: string; imageUrl?: string }>;
  };
  created_at: string;
}

interface Testimonial {
  id: string;
  name: string;
  childName?: string;
  childAge?: number;
  city: string;
  rating: number;
  comment: string;
  avatar_url?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [publicComics, setPublicComics] = useState<PublicComic[]>([]);
  const [loadingComics, setLoadingComics] = useState(true);
  const [testimonials] = useState<Testimonial[]>([
    {
      id: '1',
      name: 'Ana Paula',
      childName: 'Sofia',
      childAge: 7,
      city: 'São Paulo',
      rating: 5,
      comment: 'Minha filha de 7 anos ficou empolgadíssima! Ela sempre sonhou em ser uma super-heroína, e ver isso virar realidade no gibi dela foi emocionante. Ela mostra pra todos com tanto orgulho!'
    },
    {
      id: '2',
      name: 'Roberto',
      childName: 'Lucas',
      childAge: 9,
      city: 'Rio de Janeiro',
      rating: 5,
      comment: 'O Lucas tinha dificuldade com leitura, mas depois de criar seus próprios gibis, ele passou a ler muito mais! A motivação veio quando viu que podia criar histórias também. Valeu cada centavo!'
    },
    {
      id: '3',
      name: 'Mariana',
      childName: 'Julia',
      childAge: 6,
      city: 'Belo Horizonte',
      rating: 5,
      comment: 'Criamos gibis de toda a família! Minha filha, meu marido e eu. Foi um momento tão especial ver nossos personagens juntos numa história. Recomendo de coração!'
    }
  ]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const { plans, loading: loadingPlans } = usePlans();

  useEffect(() => {
    loadPublicComics();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const loadPublicComics = async () => {
    try {
      setLoadingComics(true);
      const { data, error } = await supabase
        .from('comics')
        .select('id, hero_name, genre, cover_url, comic_data, created_at')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setPublicComics(data || []);
    } catch (error) {
      console.error('Erro ao carregar gibis públicos:', error);
    } finally {
      setLoadingComics(false);
    }
  };

  const getCoverImage = (comic: PublicComic) => {
    if (comic.cover_url) return comic.cover_url;
    return comic.comic_data?.comicFaces?.find(f => f.type === 'cover')?.imageUrl;
  };

  const formatPlanName = (name: string) => {
    const planMap: Record<string, string> = {
      'free': 'TESTE GRÁTIS',
      'basic': 'FAMÍLIA BASIC',
      'pro': 'CRIATIVO PRO',
      'experiencia': 'EXPERIÊNCIA',
      'familia': 'FAMÍLIA',
      'aventureiro': 'AVENTUREIRO',
      'presente': 'PRESENTE'
    };
    return planMap[name.toLowerCase()] || name.toUpperCase();
  };

  const getPlanEmotionalInfo = (plan: any) => {
    const name = plan.name.toLowerCase();
    const credits = plan.credits;
    
    // Informações emocionais por plano
    if (name.includes('free') || name.includes('teste')) {
      return {
        tagline: 'Perfeito para começar!',
        description: 'Experimente sem compromisso',
        whatYouCanDo: `Crie ${credits} gibis únicos`,
        icon: '🎁',
        savings: null
      };
    }
    
    if (name.includes('experiencia') || name.includes('basic') || credits <= 5) {
      const pricePerCredit = plan.price / credits;
      const basePrice = 19.90; // Preço base por crédito
      const savings = pricePerCredit < basePrice ? Math.round((1 - (pricePerCredit / basePrice)) * 100) : null;
      return {
        tagline: 'Perfeito para testar!',
        description: 'Crie suas primeiras memórias',
        whatYouCanDo: `Crie ${credits} gibis únicos ou 1 série de ${Math.min(credits, 4)} partes`,
        icon: '✨',
        savings: savings && savings > 0 ? savings : null
      };
    }
    
    if (name.includes('familia') || (credits > 5 && credits <= 15)) {
      const pricePerCredit = plan.price / credits;
      const basePrice = 19.90; // Preço base por crédito
      const savings = Math.round((1 - (pricePerCredit / basePrice)) * 100);
      return {
        tagline: '⭐ Mais Popular!',
        description: 'Melhor custo-benefício',
        whatYouCanDo: `Crie ${credits} memórias incríveis ou ${Math.floor(credits / 4)} séries completas`,
        icon: '💝',
        savings: savings > 0 ? savings : null
      };
    }
    
    if (name.includes('aventureiro') || (credits > 15 && credits <= 30)) {
      const pricePerCredit = plan.price / credits;
      const basePrice = 19.90;
      const savings = Math.round((1 - (pricePerCredit / basePrice)) * 100);
      return {
        tagline: 'Para famílias criativas!',
        description: 'Crie séries completas',
        whatYouCanDo: `Crie ${credits} aventuras ou ${Math.floor(credits / 4)} séries completas`,
        icon: '🌟',
        savings: savings > 0 ? savings : null
      };
    }
    
    if (name.includes('presente') || credits > 30) {
      const pricePerCredit = plan.price / credits;
      const basePrice = 19.90;
      const savings = Math.round((1 - (pricePerCredit / basePrice)) * 100);
      return {
        tagline: 'Presenteie uma família!',
        description: 'Ideal para aniversários e datas especiais',
        whatYouCanDo: `Crie uma biblioteca completa com ${credits} gibis`,
        icon: '🎁',
        savings: savings > 0 ? savings : null
      };
    }
    
    return {
      tagline: 'Crie memórias únicas!',
      description: 'Créditos que nunca expiram',
      whatYouCanDo: `Crie ${credits} gibis incríveis`,
      icon: '📚',
      savings: null
    };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-[#222] font-comic relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(#333 15%, transparent 16%), radial-gradient(#333 15%, transparent 16%)',
        backgroundSize: '60px 60px',
        backgroundPosition: '0 0, 30px 30px'
      }} />

      {/* SEÇÃO 1: HERO EMOCIONAL */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12 md:py-20">
        <div className="text-center mb-8 md:mb-12 animate-in fade-in zoom-in duration-1000">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-9xl text-red-600 leading-none tracking-wide inline-block mr-2 md:mr-4" style={{textShadow: '4px 4px 0px black'}}>
            SUPER
          </h1>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-9xl text-yellow-400 leading-none tracking-wide inline-block" style={{textShadow: '4px 4px 0px black'}}>
            KIDS
          </h1>
          <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white mt-6 md:mt-8 font-comic max-w-4xl mx-auto leading-tight px-4" style={{textShadow: '2px 2px 0px black'}}>
            Veja seu filho se transformar no herói da própria história!
          </p>
          <p className="text-lg sm:text-xl md:text-2xl text-white mt-4 md:mt-6 font-comic max-w-3xl mx-auto px-4" style={{textShadow: '2px 2px 0px black'}}>
            Crie gibis únicos e desenvolva a imaginação da sua criança de forma divertida e educativa.
          </p>
        </div>

        <button
          onClick={onGetStarted}
          className="comic-btn bg-red-600 text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl px-6 sm:px-8 md:px-12 py-4 md:py-6 hover:bg-red-500 transition-all shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] mb-4"
        >
          COMEÇAR GRÁTIS AGORA!
        </button>
        <p className="text-white text-base sm:text-lg md:text-xl mb-8 px-4 text-center">✨ 1 gibi grátis para experimentar</p>

        <div className="mt-8 md:mt-16 animate-bounce">
          <p className="text-white text-base sm:text-lg mb-2">⬇️ Descubra como funciona</p>
        </div>
      </section>

  {/* SEÇÃO 2: COMO FUNCIONA */}
      <section className="relative z-10 py-12 md:py-20 px-4 bg-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white text-center mb-4 md:mb-6 font-comic px-4" style={{textShadow: '3px 3px 0px black'}}>
            É mais simples do que você imagina:
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-yellow-400 text-center mb-8 md:mb-12 font-comic px-4">
            🎯 4 passos simples para criar memórias incríveis
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12 relative">
            {[
              { 
                step: '1', 
                icon: '📸', 
                title: 'Crie o Personagem', 
                desc: 'Faça upload de fotos do seu filho',
                details: 'Nossa IA transforma as fotos em um personagem de gibi único',
                time: '~30 segundos'
              },
              { 
                step: '2', 
                icon: '🎨', 
                title: 'Personalize o Gibi', 
                desc: 'Escolha estilo, tema e aventura',
                details: 'Super-herói, aventura, fantasia e muito mais!',
                time: '~1 minuto'
              },
              { 
                step: '3', 
                icon: '✨', 
                title: 'IA Cria a História', 
                desc: 'Nossa inteligência artificial gera tudo automaticamente',
                details: 'História única, diálogos e cenas personalizadas',
                time: '~2 minutos'
              },
              { 
                step: '4', 
                icon: '📚', 
                title: 'Receba o Gibi', 
                desc: 'Baixe em PDF de alta qualidade',
                details: 'Pronto para imprimir ou ler no tablet',
                time: 'Instantâneo'
              }
            ].map((step, idx) => (
              <div key={idx} className="text-center relative">
                <div className="bg-white border-[4px] md:border-[6px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_rgba(0,0,0,1)] p-4 md:p-6 mb-4 h-full flex flex-col transition-all hover:shadow-[10px_10px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px]">
                  <div className="text-4xl md:text-6xl mb-3 md:mb-4">{step.icon}</div>
                  <div className="text-3xl md:text-4xl font-bold text-black mb-2">{step.step}</div>
                  <h3 className="font-comic text-lg md:text-xl text-black font-bold mb-2">{step.title}</h3>
                  <p className="text-gray-700 text-sm md:text-base mb-2 font-semibold">{step.desc}</p>
                  <p className="text-gray-600 text-xs md:text-sm mb-3 flex-grow">{step.details}</p>
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded px-2 py-1 inline-block">
                    <p className="text-xs md:text-sm text-gray-700 font-bold">⏱️ {step.time}</p>
                  </div>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-20">
                    <span className="text-3xl md:text-4xl text-yellow-400 animate-pulse">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={onGetStarted}
              className="comic-btn bg-red-600 text-white text-lg sm:text-xl md:text-2xl px-6 sm:px-8 md:px-12 py-3 md:py-4 hover:bg-red-500 transition-all shadow-[6px_6px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] font-comic font-bold"
            >
              EXPERIMENTE AGORA GRÁTIS!
            </button>
            <p className="text-white text-sm md:text-base mt-3 font-comic">
              ✨ 1 gibi grátis para testar - Sem cartão de crédito
            </p>
          </div>
        </div>
      </section>
      {/* SEÇÃO 2: PROBLEMA/OPORTUNIDADE */}
      {/* <section className="relative z-10 py-12 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-yellow-400 to-red-600 border-[6px] md:border-[8px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_rgba(0,0,0,1)] p-6 md:p-8 lg:p-12">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
              <div className="text-center md:text-right">
                <div className="text-4xl md:text-6xl mb-3 md:mb-4">💭</div>
                <p className="text-xl sm:text-2xl md:text-3xl font-comic text-black font-bold leading-relaxed">
                  Seu filho tem uma imaginação incrível, mas você não sabe como canalizar isso de forma criativa e educativa?
                </p>
              </div>
              <div className="text-center md:text-left border-t-4 md:border-t-0 md:border-l-4 border-black pt-6 md:pt-0 md:pl-8 mt-6 md:mt-0">
                <div className="text-4xl md:text-6xl mb-3 md:mb-4">✨</div>
                <p className="text-xl sm:text-2xl md:text-3xl font-comic text-black font-bold leading-relaxed">
                  Transforme a criatividade do seu filho em gibis profissionais que vão enriquecer a infância dele para sempre!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* SEÇÃO 3: BENEFÍCIOS PARA SEU FILHO */}
      <section className="relative z-10 py-12 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white text-center mb-8 md:mb-12 font-comic px-4" style={{textShadow: '3px 3px 0px black'}}>
            O que seu filho vai desenvolver:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { icon: '🎨', title: 'Criatividade', desc: 'Desenvolve imaginação e expressão artística' },
              { icon: '💪', title: 'Autoestima', desc: 'Se sente protagonista da própria história' },
              { icon: '📚', title: 'Aprendizado', desc: 'Melhora leitura e escrita de forma divertida' },
              { icon: '🎯', title: 'Foco', desc: 'Aprende a terminar projetos e ver resultados' },
              { icon: '❤️', title: 'Lembranças', desc: 'Cria memórias únicas para guardar para sempre' },
              { icon: '🌟', title: 'Orgulho', desc: 'Você vê orgulho e confiança no olhar do seu filho' }
            ].map((benefit, idx) => (
              <div
                key={idx}
                className="bg-white border-[4px] md:border-[6px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_rgba(0,0,0,1)] p-4 md:p-6 text-center rotate-[-1deg] hover:rotate-0 transition-all hover:shadow-[10px_10px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px]"
                style={{ rotate: `${(idx % 2 === 0 ? -1 : 1) * (idx % 3 === 0 ? 2 : 1)}deg` }}
              >
                <div className="text-4xl md:text-6xl mb-3 md:mb-4">{benefit.icon}</div>
                <h3 className="font-comic text-xl md:text-2xl text-black mb-2 md:mb-3 font-bold">{benefit.title}</h3>
                <p className="text-gray-700 text-base md:text-lg">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO 4: GIBIS DE OUTRAS CRIANÇAS */}
      <section className="relative z-10 py-12 md:py-20 px-4 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white text-center mb-4 font-comic px-4" style={{textShadow: '3px 3px 0px black'}}>
            Veja o que outras famílias já criaram:
          </h2>
          <p className="text-xl sm:text-2xl text-yellow-400 text-center mb-8 md:mb-12 font-comic px-4">
            💝 Momentos únicos transformados em gibis incríveis
          </p>

          {loadingComics ? (
            <div className="text-center text-white py-20">
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <p className="text-xl">Carregando gibis...</p>
            </div>
          ) : publicComics.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
                {publicComics.map((comic) => {
                  const coverImage = getCoverImage(comic);
                  return (
                    <div
                      key={comic.id}
                      className="bg-white border-[4px] md:border-[6px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_rgba(0,0,0,1)] cursor-pointer hover:shadow-[10px_10px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all group"
                    >
                      {coverImage ? (
                        <div className="aspect-[2/3] overflow-hidden bg-gray-200">
                          <img
                            src={coverImage}
                            alt={`Capa de ${comic.hero_name}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[2/3] bg-gray-200 flex items-center justify-center">
                          <span className="text-4xl">📚</span>
                        </div>
                      )}
                      <div className="p-2 md:p-3">
                        <h3 className="font-comic text-xs md:text-sm text-black mb-1 uppercase truncate font-bold">
                          {comic.hero_name}
                        </h3>
                        <p className="text-xs text-gray-600 truncate">{comic.genre}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-center">
                <button
                  onClick={onGetStarted}
                  className="comic-btn bg-yellow-400 text-black text-xl px-8 py-4 hover:bg-yellow-300 transition-all shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_rgba(0,0,0,1)] font-comic font-bold"
                >
                  Ver Mais Histórias Incríveis →
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-white py-20">
              <p className="text-xl">Ainda não há gibis públicos. Seja o primeiro!</p>
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO 5: DEPOIMENTOS DE PAIS */}
      <section className="relative z-10 py-12 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white text-center mb-4 font-comic px-4" style={{textShadow: '3px 3px 0px black'}}>
            Pais que confiaram no Super Kids:
          </h2>
          <p className="text-xl sm:text-2xl text-yellow-400 text-center mb-8 md:mb-12 font-comic px-4">
            ❤️ Histórias reais de famílias que transformaram a criatividade dos filhos em gibis incríveis
          </p>

          <div className="relative">
            {testimonials.map((testimonial, idx) => (
              <div
                key={testimonial.id}
                className={`transition-all duration-500 ${
                  idx === currentTestimonial ? 'opacity-100 block' : 'opacity-0 hidden'
                }`}
              >
                <div className="bg-white border-[6px] md:border-[8px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_rgba(0,0,0,1)] p-6 md:p-8 lg:p-12">
                  <div className="flex justify-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-2xl md:text-3xl text-yellow-400">⭐</span>
                    ))}
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl text-black mb-4 md:mb-6 font-comic text-center leading-relaxed px-2">
                    "{testimonial.comment}"
                  </p>
                  <div className="text-center">
                    <p className="text-base sm:text-lg md:text-xl font-comic text-black font-bold">
                      {testimonial.name}
                      {testimonial.childName && `, ${testimonial.childAge ? `pai/mãe da ${testimonial.childName} (${testimonial.childAge} anos)` : `pai/mãe da ${testimonial.childName}`}`}
                    </p>
                    <p className="text-sm md:text-md text-gray-600 mt-2">📍 {testimonial.city}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentTestimonial(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    idx === currentTestimonial ? 'bg-yellow-400 w-8' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

    

      {/* SEÇÃO 7: PLANOS */}
      <section className="relative z-10 py-12 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white text-center mb-4 font-comic px-4" style={{textShadow: '3px 3px 0px black'}}>
            Investimento no futuro criativo do seu filho:
          </h2>
          <p className="text-xl sm:text-2xl text-yellow-400 text-center mb-4 font-comic px-4">
            💝 Créditos que nunca expiram - use quando quiser!
          </p>
          <p className="text-base sm:text-lg text-white text-center mb-8 md:mb-12 font-comic max-w-3xl mx-auto px-4">
            Cada crédito = 1 gibi único ou parte de uma série. Compre agora e crie memórias quando seu filho quiser!
          </p>

          {loadingPlans ? (
            <div className="text-center text-white py-20">
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <p className="text-xl">Carregando planos...</p>
            </div>
          ) : plans.length > 0 ? (
            <>
              <div className="flex justify-center mb-6 md:mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl w-full">
                  {plans
                    .filter(plan => plan.price > 0) // Filtrar plano grátis da lista de compra
                    .map((plan, idx) => {
                    const emotionalInfo = getPlanEmotionalInfo(plan);
                    const isPopular = idx === Math.floor(plans.filter(p => p.price > 0).length / 2) || 
                                     plan.credits >= 10 && plan.credits <= 15;
                    const pricePerCredit = plan.price / plan.credits;
                    
                    return (
                      <div key={plan.id} className="relative">
                        {isPopular && (
                          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-4 py-2 border-4 border-black font-comic font-bold text-sm md:text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] z-10 whitespace-nowrap">
                            ⭐ MAIS POPULAR
                          </div>
                        )}
                        <div className={`bg-white border-[4px] md:border-[6px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_rgba(0,0,0,1)] p-4 md:p-6 h-full flex flex-col transition-all hover:shadow-[10px_10px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] ${
                          isPopular ? 'ring-2 md:ring-4 ring-yellow-400' : ''
                        }`}>
                          {/* Ícone e Tagline */}
                          <div className="text-center mb-3 md:mb-4">
                            <div className="text-4xl md:text-5xl mb-2">{emotionalInfo.icon}</div>
                            <p className="font-comic text-xs md:text-sm text-yellow-600 font-bold mb-1 uppercase">
                              {emotionalInfo.tagline}
                            </p>
                            <h3 className="font-comic text-xl md:text-2xl lg:text-3xl text-black mb-2 uppercase font-bold">
                              {formatPlanName(plan.name)}
                            </h3>
                          </div>

                          {/* Preço */}
                          <div className="text-center mb-3 md:mb-4">
                            <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-1">
                              {formatPrice(plan.price)}
                            </div>
                            {emotionalInfo.savings && emotionalInfo.savings > 0 && (
                              <div className="bg-green-500 text-white px-2 md:px-3 py-1 inline-block border-2 border-black font-comic text-xs md:text-sm font-bold mb-2">
                                💰 Economia de {emotionalInfo.savings}%
                              </div>
                            )}
                            <div className="text-base md:text-lg text-gray-600 mb-1">
                              <span className="font-bold text-black">{plan.credits}</span> créditos
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">
                              {formatPrice(pricePerCredit)} por gibi
                            </div>
                          </div>

                          {/* O que você pode fazer */}
                          <div className="bg-yellow-50 border-2 border-yellow-300 p-2 md:p-3 mb-3 md:mb-4 flex-1">
                            <p className="font-comic text-xs text-gray-700 text-center leading-tight">
                              <span className="font-bold text-black">✨ {emotionalInfo.whatYouCanDo}</span>
                            </p>
                          </div>

                          {/* Features */}
                          <div className="space-y-1 md:space-y-2 mb-4 md:mb-6 flex-grow">
                            {plan.features && plan.features.length > 0 ? (
                              plan.features.slice(0, 4).map((feature, fidx) => (
                                <div key={fidx} className="flex items-start text-black">
                                  <span className="text-xl mr-2 text-green-600">✓</span>
                                  <span className="font-comic text-xs capitalize leading-tight">{feature}</span>
                                </div>
                              ))
                            ) : (
                              <>
                                <div className="flex items-start text-black">
                                  <span className="text-xl mr-2 text-green-600">✓</span>
                                  <span className="font-comic text-xs leading-tight">Créditos nunca expiram</span>
                                </div>
                                <div className="flex items-start text-black">
                                  <span className="text-xl mr-2 text-green-600">✓</span>
                                  <span className="font-comic text-xs leading-tight">Use quando quiser</span>
                                </div>
                                <div className="flex items-start text-black">
                                  <span className="text-xl mr-2 text-green-600">✓</span>
                                  <span className="font-comic text-xs leading-tight">Crie gibis ou séries</span>
                                </div>
                                <div className="flex items-start text-black">
                                  <span className="text-xl mr-2 text-green-600">✓</span>
                                  <span className="font-comic text-xs leading-tight">Download em PDF</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Botão */}
                          <button
                            onClick={onGetStarted}
                            className={`w-full py-2 md:py-3 border-3 md:border-4 border-black font-comic text-base md:text-lg lg:text-xl uppercase transition-all ${
                              isPopular
                                ? 'bg-yellow-400 text-black shadow-[0px_3px_0px_#000] md:shadow-[0px_4px_0px_#000] hover:bg-yellow-300 active:translate-y-1 active:shadow-none'
                                : 'bg-blue-500 text-white hover:bg-blue-400 shadow-[0px_3px_0px_#000] md:shadow-[0px_4px_0px_#000] active:translate-y-1 active:shadow-none'
                            }`}
                          >
                            ESCOLHER ESTE
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informações adicionais */}
              <div className="bg-gradient-to-r from-yellow-400 to-red-600 border-[4px] md:border-[6px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_rgba(0,0,0,1)] p-4 md:p-6 lg:p-8 mb-6 md:mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 text-center">
                  <div>
                    <div className="text-3xl md:text-4xl mb-2">💝</div>
                    <h4 className="font-comic text-base md:text-lg font-bold text-black mb-1">Cada gibi é uma memória</h4>
                    <p className="font-comic text-xs md:text-sm text-black">Seu filho vai guardar para sempre</p>
                  </div>
                  <div>
                    <div className="text-3xl md:text-4xl mb-2">⏰</div>
                    <h4 className="font-comic text-base md:text-lg font-bold text-black mb-1">Créditos nunca expiram</h4>
                    <p className="font-comic text-xs md:text-sm text-black">Use quando quiser, sem pressa</p>
                  </div>
                  <div>
                    <div className="text-3xl md:text-4xl mb-2">🎁</div>
                    <h4 className="font-comic text-base md:text-lg font-bold text-black mb-1">Presente perfeito</h4>
                    <p className="font-comic text-xs md:text-sm text-black">Ideal para aniversários e datas especiais</p>
                  </div>
                </div>
              </div>

              {/* CTA adicional */}
              <div className="text-center space-y-2 md:space-y-3 px-4">
                <p className="text-lg sm:text-xl md:text-2xl text-white font-comic">
                  💡 Não sabe qual escolher?
                </p>
                <p className="text-base sm:text-lg text-yellow-400 font-comic max-w-2xl mx-auto">
                  Comece com o pacote <strong>Família</strong> - é o mais popular e oferece o melhor custo-benefício para criar várias memórias incríveis!
                </p>
                <p className="text-sm md:text-base text-gray-400 font-comic">
                  💰 Dica: Quanto mais créditos, maior a economia por gibi!
                </p>
              </div>
            </>
          ) : (
            <div className="text-center text-white py-20">
              <p className="text-xl">Nenhum plano disponível no momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO 8: GARANTIA DE SEGURANÇA */}
      <section className="relative z-10 py-12 md:py-20 px-4 bg-[#1a1a1a]">
        <div className="max-w-4xl mx-auto">
          <div className="bg-green-500 border-[6px] md:border-[8px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_rgba(0,0,0,1)] p-6 md:p-8 lg:p-12">
            <div className="text-center mb-4 md:mb-6">
              <div className="text-4xl md:text-6xl mb-3 md:mb-4">🔒</div>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-comic text-black font-bold mb-4 md:mb-6 px-2">
                Seus dados e os do seu filho estão totalmente seguros
              </h3>
            </div>
            <div className="space-y-3 md:space-y-4 text-center">
              <p className="text-lg sm:text-xl md:text-2xl font-comic text-black">
                ✅ Sem compartilhamento de informações
              </p>
              <p className="text-lg sm:text-xl md:text-2xl font-comic text-black">
                ✅ Ambiente seguro e controlado
              </p>
              <p className="text-lg sm:text-xl md:text-2xl font-comic text-black">
                ✅ Você decide o que é público ou privado
              </p>
              <p className="text-lg sm:text-xl md:text-2xl font-comic text-black font-bold mt-4 md:mt-6">
                🛡️ Proteção de dados conforme LGPD
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 9: CTA FINAL */}
      <section className="relative z-10 py-12 md:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-red-600 to-yellow-400 border-[6px] md:border-[8px] lg:border-[10px] border-black shadow-[10px_10px_0px_rgba(0,0,0,1)] md:shadow-[15px_15px_0px_rgba(0,0,0,1)] p-8 md:p-12 lg:p-16 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl text-black font-comic font-bold mb-4 md:mb-6 leading-tight px-2">
              Dê ao seu filho a oportunidade de ver seus sonhos transformados em realidade!
            </h2>
            <p className="text-xl sm:text-2xl md:text-3xl text-black font-comic mb-6 md:mb-8 px-2">
              💝 Comece grátis hoje e veja o sorriso no rosto do seu filho
            </p>
            <button
              onClick={onGetStarted}
              className="comic-btn bg-white text-black text-xl sm:text-2xl md:text-3xl lg:text-4xl px-6 sm:px-8 md:px-12 py-4 md:py-6 hover:bg-gray-100 transition-all shadow-[8px_8px_0px_rgba(0,0,0,1)] md:shadow-[10px_10px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] md:hover:shadow-[14px_14px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] font-comic font-bold mb-4 md:mb-6"
            >
              CRIAR PRIMEIRO GIBI!
            </button>
            <div className="space-y-2">
              <p className="text-lg sm:text-xl md:text-2xl text-black font-comic">
                ✨ 1 gibi grátis para experimentar
              </p>
              <p className="text-base sm:text-lg md:text-xl text-black font-comic">
                ⏱️ Sem cartão de crédito. Sem riscos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 py-8 md:py-12 px-4 bg-black border-t-4 border-yellow-400">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-4 md:mb-6 flex flex-wrap justify-center gap-2 md:gap-4 text-white text-sm md:text-base">
            <a href="#" className="hover:text-yellow-400 transition-colors">Como Funciona</a>
            <span className="hidden sm:inline">•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Sobre Nós</a>
            <span className="hidden sm:inline">•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Suporte</a>
            <span className="hidden sm:inline">•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Termos</a>
            <span className="hidden sm:inline">•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Privacidade</a>
            <span className="hidden sm:inline">•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">LGPD</a>
          </div>
          <div className="text-gray-400 mb-3 md:mb-4 text-sm md:text-base">
            <p className="break-words">📧 contato@superkids.com.br | 📱 (11) 9999-9999</p>
          </div>
          <p className="text-gray-500 text-xs md:text-sm">© 2024 Super Kids - Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
};
