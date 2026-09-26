import React from 'react';
import { X, FolderOpen, ArrowRight } from 'lucide-react';
import type { TopologyTemplate } from '../data/templates';
import { TOPOLOGY_TEMPLATES } from '../data/templates';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TopologyTemplate) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-auto max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 shadow-2xs">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Pilih Topologi Jaringan Siap Pakai
              </h2>
              <p className="text-xs text-slate-500">
                Pilih skenario arsitektur nyata untuk langsung dipelajari dan disimulasikan
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

        {/* Templates list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
          {TOPOLOGY_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-sky-300 hover:shadow-xs group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                  {tmpl.badge}
                </span>
                <span className="text-xs text-slate-400">
                  {tmpl.nodes.length} Perangkat · {tmpl.cables.length} Kabel
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                {tmpl.name}
              </h3>

              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {tmpl.description}
              </p>

              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    onSelectTemplate(tmpl);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors shadow-2xs"
                >
                  <span>Muat Topologi Ini</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
