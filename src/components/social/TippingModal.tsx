"use client";

import React, { useState } from 'react';
import { X, DollarSign, CreditCard, Heart } from 'lucide-react';

interface TippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTip: (amount: number) => Promise<void>;
  recipientName?: string;
}

export function TippingModal({ isOpen, onClose, onTip, recipientName = 'Creator' }: TippingModalProps) {
  const [amount, setAmount] = useState<string>('5.00');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleTip = async () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : parseFloat(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) return;

    setLoading(true);
    try {
      await onTip(finalAmount);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const presets = ['1.00', '5.00', '10.00', '20.00'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h2 className="text-2xl font-bold">Send a Tip</h2>
          <p className="text-white/90">Support {recipientName}'s work</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Presets */}
          <div className="grid grid-cols-4 gap-3">
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => { setAmount(preset); setCustomAmount(''); }}
                className={`py-2 rounded-lg font-medium transition-all ${
                  amount === preset && !customAmount
                    ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-500'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setAmount(''); }}
              placeholder="Enter custom amount"
              className="block w-full pl-10 pr-12 py-3 border-slate-200 rounded-xl focus:ring-pink-500 focus:border-pink-500 text-lg"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-slate-500 sm:text-sm">USD</span>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleTip}
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-pink-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Send ${customAmount || amount}
              </>
            )}
          </button>
          
          <p className="text-xs text-center text-slate-400">
            Secure transaction powered by Athena Wallet.
          </p>
        </div>
      </div>
    </div>
  );
}
