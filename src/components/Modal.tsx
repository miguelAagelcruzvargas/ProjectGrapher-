import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-8 xl:p-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 40 }}
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-brand-bg shadow-2xl md:rounded-[32px]"
          >
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-4 sm:px-5 md:px-6">
              <h3 className="pr-4 text-base font-bold uppercase tracking-wide text-white font-display sm:text-lg md:text-xl">{title}</h3>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5 md:p-8 xl:p-10">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
