import React, { useState } from 'react';
import { X, BookOpen, Search, ShieldCheck, Tag } from 'lucide-react';
import { NETWORK_GLOSSARY } from '../data/glossary';

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = ['all', 'FTTH & Optik', 'Networking & IP', 'Alat Kerja Teknisi'];

  const filteredItems = NETWORK_GLOSSARY.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.definition.toLowerCase().includes(search.toLowerCase()) ||
      item.fieldTips.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Kamus Edukasi FTTH & Jaringan Komputer
              </h2>
              <p className="text-xs text-slate-500">
                Panduan referensi istilah perangkat, standar redaman dBm, dan trik lapangan untuk teknisi pemula
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="border-b border-slate-100 bg-white p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari istilah: OLT, Splitter, OPM, NAT, Redaman, VFL..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-slate-50/50">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Tidak ada istilah yang cocok dengan pencarian Anda.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-emerald-200 transition-all"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{item.term}</h3>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                    {item.category}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.definition}
                </p>

                {item.standardValue && (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700 font-mono border border-slate-100">
                    <Tag className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <span><strong>Standar Teknis:</strong> {item.standardValue}</span>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-amber-50/70 p-2.5 text-[11px] text-amber-950 border border-amber-200/70">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Tips Lapangan: </span>
                    <span>{item.fieldTips}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-white px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs"
          >
            Tutup Kamus
          </button>
        </div>
      </div>
    </div>
  );
};
