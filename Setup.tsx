
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { GENRES, Persona } from './types';

interface SetupProps {
    hero: Persona | null;
    heroName: string;
    selectedGenre: string;
    customPremise: string;
    onHeroUpload: (file: File) => void;
    onHeroNameChange: (name: string) => void;
    onGenreChange: (val: string) => void;
    onPremiseChange: (val: string) => void;
    onLaunch: () => void;
    isGenerating: boolean;
}

export const Setup: React.FC<SetupProps> = (props) => {
    return (
        <div className="w-full flex justify-center p-4">
            <div className="max-w-[900px] w-full bg-white p-4 md:p-8 border-[6px] border-black shadow-[12px_12px_0_rgba(0,0,0,1)] text-center relative rotate-1">
                
                <div className="relative inline-block mb-6 group">
                    <h1 className="font-comic text-5xl md:text-6xl text-red-600 leading-none tracking-wide inline-block mr-3" style={{textShadow: '2px 2px 0px black'}}>SUPER</h1>
                    <h1 className="font-comic text-5xl md:text-6xl text-yellow-400 leading-none tracking-wide inline-block" style={{textShadow: '2px 2px 0px black'}}>KIDS</h1>
                    
                    {/* Christmas Tag on Main Logo */}
                    <div className="absolute -bottom-6 -right-8 rotate-[-12deg] z-10 animate-pulse">
                         <div className="bg-green-600 text-white font-comic text-sm md:text-base px-2 py-1 border-2 border-white shadow-[2px_2px_0px_rgba(0,0,0,0.5)] rounded whitespace-nowrap flex items-center gap-1">
                            <span className="text-yellow-300">🎄</span> Especial de Natal
                         </div>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-6 mb-6 text-left">
                    
                    {/* Left Column: Protagonist */}
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="font-comic text-2xl text-black border-b-4 border-black mb-1">1. O PROTAGONISTA</div>
                        
                        {/* HERO UPLOAD */}
                        <div className={`p-4 border-4 border-dashed ${props.hero ? 'border-green-500 bg-green-50' : 'border-blue-300 bg-blue-50'} transition-colors relative group`}>
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-comic text-lg uppercase font-bold text-blue-900">FOTO DO HERÓI</p>
                                {props.hero && <span className="text-green-600 font-bold font-comic text-sm animate-pulse">✓ PRONTO</span>}
                            </div>
                            
                            {props.hero ? (
                                <div className="flex gap-3 items-center mt-1">
                                     <img src={`data:image/jpeg;base64,${props.hero.base64}`} alt="Hero Preview" className="w-24 h-24 object-cover border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.2)] bg-white rotate-[-2deg]" />
                                     <label className="cursor-pointer comic-btn bg-yellow-400 text-black text-sm px-4 py-2 hover:bg-yellow-300 transition-transform active:scale-95 uppercase">
                                         TROCAR
                                         <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && props.onHeroUpload(e.target.files[0])} />
                                     </label>
                                </div>
                            ) : (
                                <label className="comic-btn bg-blue-500 text-white text-xl px-3 py-6 block w-full hover:bg-blue-400 cursor-pointer text-center">
                                    ENVIAR FOTO 
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && props.onHeroUpload(e.target.files[0])} />
                                </label>
                            )}
                        </div>

                        {/* HERO NAME INPUT */}
                        <div className="p-4 border-4 border-dashed border-purple-300 bg-purple-50">
                             <p className="font-comic text-lg mb-1 font-bold text-purple-900">NOME DO HERÓI</p>
                             <input 
                                type="text" 
                                value={props.heroName} 
                                onChange={(e) => props.onHeroNameChange(e.target.value)} 
                                placeholder="Ex: João, Maria" 
                                className="w-full p-3 border-2 border-black font-comic text-xl uppercase shadow-[3px_3px_0px_rgba(0,0,0,0.1)] focus:outline-none bg-white text-black placeholder:text-black placeholder:opacity-50" 
                                maxLength={20}
                             />
                        </div>
                        
                        {/* Privacy Policy Text */}
                        <p className="text-[10px] text-gray-500 leading-tight mt-1 px-1">
                            Segurança em primeiro lugar! Não envie fotos de outras pessoas sem permissão.
                        </p>
                    </div>

                    {/* Right Column: Settings */}
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="font-comic text-2xl text-black border-b-4 border-black mb-1">2. A HISTÓRIA</div>
                        
                        <div className="bg-yellow-50 p-4 border-4 border-black h-full flex flex-col justify-between">
                            <div>
                                <div className="mb-4">
                                    <p className="font-comic text-lg mb-1 font-bold text-gray-800">TEMA DA AVENTURA</p>
                                    <select value={props.selectedGenre} onChange={(e) => props.onGenreChange(e.target.value)} className="w-full font-comic text-xl p-2 border-2 border-black uppercase bg-white text-black cursor-pointer shadow-[3px_3px_0px_rgba(0,0,0,0.1)] focus:outline-none transition-all">
                                        {GENRES.map(g => <option key={g} value={g} className="text-black">{g}</option>)}
                                    </select>
                                </div>

                                {props.selectedGenre === 'Personalizado' && (
                                    <div className="mb-4">
                                        <p className="font-comic text-lg mb-1 font-bold text-gray-800">SUA IDEIA</p>
                                        <textarea value={props.customPremise} onChange={(e) => props.onPremiseChange(e.target.value)} placeholder="Digite sua ideia de aventura..." className="w-full p-2 border-2 border-black font-comic text-lg h-24 resize-none shadow-[3px_3px_0px_rgba(0,0,0,0.1)] bg-white text-black" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={props.onLaunch} 
                    disabled={!props.hero || !props.heroName.trim() || props.isGenerating} 
                    className="comic-btn bg-red-600 text-white text-3xl px-8 py-4 w-full hover:bg-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed uppercase tracking-wider shadow-[6px_6px_0px_rgba(0,0,0,1)]"
                >
                    {props.isGenerating ? 'CRIANDO QUADRINHO...' : 'COMEÇAR AVENTURA!'}
                </button>
            </div>
        </div>
    );
}
