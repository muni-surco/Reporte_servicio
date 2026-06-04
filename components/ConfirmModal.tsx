import React from 'react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#0b63a7] px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">window</span>
            </div>
            <h3 className="text-[16px] font-bold tracking-wide truncate">Modal Estándar</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="px-6 py-6">
          <p className="text-[13px] text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg text-[12px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg text-[12px] font-semibold uppercase tracking-wider text-white bg-[#0b63a7] hover:bg-[#09578f] transition-colors shadow-sm"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
