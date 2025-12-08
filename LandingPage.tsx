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
      'pro': 'CRIATIVO PRO'
    };
    return planMap[name.toLowerCase()] || name.toUpperCase();
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
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20">
        <div className="text-center mb-12 animate-in fade-in zoom-in duration-1000">
          <h1 className="text-7xl md:text-9xl text-red-600 leading-none tracking-wide inline-block mr-4" style={{textShadow: '4px 4px 0px black'}}>
            SUPER
          </h1>
          <h1 className="text-7xl md:text-9xl text-yellow-400 leading-none tracking-wide inline-block" style={{textShadow: '4px 4px 0px black'}}>
            KIDS
          </h1>
          <p className="text-3xl md:text-5xl text-white mt-8 font-comic max-w-4xl mx-auto leading-tight" style={{textShadow: '2px 2px 0px black'}}>
            Veja seu filho se transformar no herói da própria história!
          </p>
          <p className="text-xl md:text-2xl text-white mt-6 font-comic max-w-3xl mx-auto" style={{textShadow: '2px 2px 0px black'}}>
            Crie gibis únicos e desenvolva a imaginação da sua criança de forma divertida e educativa.
          </p>
        </div>

        <button
          onClick={onGetStarted}
          className="comic-btn bg-red-600 text-white text-3xl md:text-4xl px-12 py-6 hover:bg-red-500 transition-all shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] mb-4"
        >
          COMEÇAR GRÁTIS AGORA!
        </button>
        <p className="text-white text-lg md:text-xl mb-8">✨ 4 créditos grátis para experimentar</p>

        <div className="mt-16 animate-bounce">
          <p className="text-white text-lg mb-2">⬇️ Descubra como funciona</p>
        </div>
      </section>

      {/* SEÇÃO 2: PROBLEMA/OPORTUNIDADE */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-yellow-400 to-red-600 border-[8px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="text-center md:text-right">
                <div className="text-6xl mb-4">💭</div>
                <p className="text-2xl md:text-3xl font-comic text-black font-bold leading-relaxed">
                  Seu filho tem uma imaginação incrível, mas você não sabe como canalizar isso de forma criativa e educativa?
                </p>
              </div>
              <div className="text-center md:text-left border-l-0 md:border-l-4 border-black pl-0 md:pl-8">
                <div className="text-6xl mb-4">✨</div>
                <p className="text-2xl md:text-3xl font-comic text-black font-bold leading-relaxed">
                  Transforme a criatividade do seu filho em gibis profissionais que vão enriquecer a infância dele para sempre!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 3: BENEFÍCIOS PARA SEU FILHO */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl text-white text-center mb-12 font-comic" style={{textShadow: '3px 3px 0px black'}}>
            O que seu filho vai desenvolver:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                className="bg-white border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-6 text-center rotate-[-1deg] hover:rotate-0 transition-all hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px]"
                style={{ rotate: `${(idx % 2 === 0 ? -1 : 1) * (idx % 3 === 0 ? 2 : 1)}deg` }}
              >
                <div className="text-6xl mb-4">{benefit.icon}</div>
                <h3 className="font-comic text-2xl text-black mb-3 font-bold">{benefit.title}</h3>
                <p className="text-gray-700 text-lg">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO 4: GIBIS DE OUTRAS CRIANÇAS */}
      <section className="relative z-10 py-20 px-4 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl text-white text-center mb-4 font-comic" style={{textShadow: '3px 3px 0px black'}}>
            Veja o que outras famílias já criaram:
          </h2>
          <p className="text-2xl text-yellow-400 text-center mb-12 font-comic">
            💝 Momentos únicos transformados em gibis incríveis
          </p>

          {loadingComics ? (
            <div className="text-center text-white py-20">
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <p className="text-xl">Carregando gibis...</p>
            </div>
          ) : publicComics.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {publicComics.map((comic) => {
                  const coverImage = getCoverImage(comic);
                  return (
                    <div
                      key={comic.id}
                      className="bg-white border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] cursor-pointer hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all group"
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
                      <div className="p-3">
                        <h3 className="font-comic text-sm text-black mb-1 uppercase truncate font-bold">
                          {comic.hero_name}
                        </h3>
                        <p className="text-xs text-gray-600">{comic.genre}</p>
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
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-6xl text-white text-center mb-4 font-comic" style={{textShadow: '3px 3px 0px black'}}>
            Pais que confiaram no Super Kids:
          </h2>
          <p className="text-2xl text-yellow-400 text-center mb-12 font-comic">
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
                <div className="bg-white border-[8px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-8 md:p-12">
                  <div className="flex justify-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-3xl text-yellow-400">⭐</span>
                    ))}
                  </div>
                  <p className="text-xl md:text-2xl text-black mb-6 font-comic text-center leading-relaxed">
                    "{testimonial.comment}"
                  </p>
                  <div className="text-center">
                    <p className="text-lg md:text-xl font-comic text-black font-bold">
                      {testimonial.name}
                      {testimonial.childName && `, ${testimonial.childAge ? `pai/mãe da ${testimonial.childName} (${testimonial.childAge} anos)` : `pai/mãe da ${testimonial.childName}`}`}
                    </p>
                    <p className="text-md text-gray-600 mt-2">📍 {testimonial.city}</p>
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

      {/* SEÇÃO 6: COMO FUNCIONA */}
      <section className="relative z-10 py-20 px-4 bg-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-6xl text-white text-center mb-12 font-comic" style={{textShadow: '3px 3px 0px black'}}>
            É mais simples do que você imagina:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 relative">
            {[
              { step: '1', icon: '📝', title: 'Crie o personagem', desc: 'do seu filho' },
              { step: '2', icon: '🎨', title: 'Escolha', desc: 'estilo e tema' },
              { step: '3', icon: '✨', title: 'IA gera', desc: 'a história automaticamente' },
              { step: '4', icon: '📚', title: 'Receba', desc: 'o gibi pronto em PDF' }
            ].map((step, idx) => (
              <div key={idx} className="text-center relative">
                <div className="bg-white border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-6 mb-4">
                  <div className="text-6xl mb-4">{step.icon}</div>
                  <div className="text-4xl font-bold text-black mb-2">{step.step}</div>
                  <h3 className="font-comic text-xl text-black font-bold mb-2">{step.title}</h3>
                  <p className="text-gray-700">{step.desc}</p>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-20">
                    <span className="text-4xl text-yellow-400">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center space-y-4">
            <p className="text-xl md:text-2xl text-white font-comic">
              ⏱️ Todo o processo leva menos de 5 minutos!
            </p>
            <p className="text-lg md:text-xl text-yellow-400 font-comic">
              🔒 Seus dados estão 100% seguros
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO 7: PLANOS */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl text-white text-center mb-4 font-comic" style={{textShadow: '3px 3px 0px black'}}>
            Investimento no futuro criativo do seu filho:
          </h2>
          <p className="text-2xl text-yellow-400 text-center mb-12 font-comic">
            💝 Créditos que nunca expiram - use quando quiser!
          </p>

          {loadingPlans ? (
            <div className="text-center text-white py-20">
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <p className="text-xl">Carregando planos...</p>
            </div>
          ) : plans.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {plans.map((plan, idx) => (
                  <div key={plan.id} className="relative">
                    {idx === plans.length - 1 && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-4 py-2 border-4 border-black font-comic font-bold text-lg shadow-[4px_4px_0px_rgba(0,0,0,1)] z-10">
                        ⭐ MAIS POPULAR
                      </div>
                    )}
                    <div className="bg-white border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-6">
                      <div className="text-center mb-4">
                        <h3 className="font-comic text-3xl text-black mb-2 uppercase font-bold">
                          {formatPlanName(plan.name)}
                        </h3>
                        <div className="text-4xl font-bold text-black mb-2">
                          {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
                        </div>
                        <div className="text-xl text-gray-600 mb-4">{plan.credits} gibis</div>
                      </div>

                      <div className="space-y-2 mb-6">
                        {plan.features.slice(0, 3).map((feature, fidx) => (
                          <div key={fidx} className="flex items-center text-black">
                            <span className="text-2xl mr-2">✓</span>
                            <span className="font-comic text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={onGetStarted}
                        className={`w-full py-3 border-4 border-black font-comic text-xl uppercase transition-all ${
                          idx === plans.length - 1
                            ? 'bg-yellow-400 text-black shadow-[0px_4px_0px_#000] hover:bg-yellow-300'
                            : 'bg-blue-500 text-white hover:bg-blue-400 shadow-[0px_4px_0px_#000]'
                        } active:translate-y-1 active:shadow-none`}
                      >
                        {plan.price === 0 ? 'COMEÇAR' : 'ESCOLHER'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl text-white font-comic">
                  💡 Cada gibi é uma memória para sempre!
                </p>
                <p className="text-lg text-yellow-400 font-comic">
                  🎁 Dica: Dê como presente de aniversário ou Natal!
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
      <section className="relative z-10 py-20 px-4 bg-[#1a1a1a]">
        <div className="max-w-4xl mx-auto">
          <div className="bg-green-500 border-[8px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-8 md:p-12">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-3xl md:text-4xl font-comic text-black font-bold mb-6">
                Seus dados e os do seu filho estão totalmente seguros
              </h3>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-xl md:text-2xl font-comic text-black">
                ✅ Sem compartilhamento de informações
              </p>
              <p className="text-xl md:text-2xl font-comic text-black">
                ✅ Ambiente seguro e controlado
              </p>
              <p className="text-xl md:text-2xl font-comic text-black">
                ✅ Você decide o que é público ou privado
              </p>
              <p className="text-xl md:text-2xl font-comic text-black font-bold mt-6">
                🛡️ Proteção de dados conforme LGPD
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 9: CTA FINAL */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-red-600 to-yellow-400 border-[10px] border-black shadow-[15px_15px_0px_rgba(0,0,0,1)] p-12 md:p-16 text-center">
            <h2 className="text-4xl md:text-6xl text-black font-comic font-bold mb-6 leading-tight">
              Dê ao seu filho a oportunidade de ver seus sonhos transformados em realidade!
            </h2>
            <p className="text-2xl md:text-3xl text-black font-comic mb-8">
              💝 Comece grátis hoje e veja o sorriso no rosto do seu filho
            </p>
            <button
              onClick={onGetStarted}
              className="comic-btn bg-white text-black text-3xl md:text-4xl px-12 py-6 hover:bg-gray-100 transition-all shadow-[10px_10px_0px_rgba(0,0,0,1)] hover:shadow-[14px_14px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] font-comic font-bold mb-6"
            >
              CRIAR PRIMEIRO GIBI!
            </button>
            <div className="space-y-2">
              <p className="text-xl md:text-2xl text-black font-comic">
                ✨ 4 gibis grátis para experimentar
              </p>
              <p className="text-lg md:text-xl text-black font-comic">
                ⏱️ Sem cartão de crédito. Sem riscos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 py-12 px-4 bg-black border-t-4 border-yellow-400">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-6 flex flex-wrap justify-center gap-4 text-white">
            <a href="#" className="hover:text-yellow-400 transition-colors">Como Funciona</a>
            <span>•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Sobre Nós</a>
            <span>•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Suporte</a>
            <span>•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Termos</a>
            <span>•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">Privacidade</a>
            <span>•</span>
            <a href="#" className="hover:text-yellow-400 transition-colors">LGPD</a>
          </div>
          <div className="text-gray-400 mb-4">
            <p>📧 contato@superkids.com.br | 📱 (11) 9999-9999</p>
          </div>
          <p className="text-gray-500 text-sm">© 2024 Super Kids - Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
};
