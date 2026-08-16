import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Phone, MessageSquare, AlertCircle, ClipboardPaste, 
  Link as LinkIcon, QrCode, X, Download, Plus, History, Trash2, Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeCanvas } from 'qrcode.react';
import { getTimezone } from 'countries-and-timezones';
import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SNIPPETS = ["Is this available?", "Here is my location.", "Following up."];

interface RecentItem {
  countryCode: string;
  phone: string;
  timestamp: number;
}

export default function WaDirectForm() {
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const [snippets, setSnippets] = useState<string[]>([]);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  
  const [isCopied, setIsCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [newSnippetText, setNewSnippetText] = useState('');

  // Initialize on mount
  useEffect(() => {
    // 1. Load Country by Timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const timezoneData = getTimezone(tz);
      if (timezoneData && timezoneData.countries && timezoneData.countries.length > 0) {
        const countryId = timezoneData.countries[0] as CountryCode;
        const callingCode = getCountryCallingCode(countryId);
        if (callingCode) {
          setCountryCode('+' + callingCode);
        }
      }
    } catch (e) {
      console.warn("Could not auto-detect country code", e);
    }

    // 2. Load Snippets
    try {
      const savedSnippets = localStorage.getItem('wa_snippets');
      if (savedSnippets) {
        setSnippets(JSON.parse(savedSnippets));
      } else {
        setSnippets(DEFAULT_SNIPPETS);
        localStorage.setItem('wa_snippets', JSON.stringify(DEFAULT_SNIPPETS));
      }
    } catch (e) {
      setSnippets(DEFAULT_SNIPPETS);
    }

    // 3. Load Recents
    try {
      const savedRecents = localStorage.getItem('wa_recents');
      if (savedRecents) {
        setRecents(JSON.parse(savedRecents));
      }
    } catch (e) {}
  }, []);

  // Handlers for Phone Input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[\s\-\(\)\[\]]/g, '');
    const numericOnly = cleaned.replace(/[^0-9]/g, '');
    setPhoneNumber(numericOnly);
    if (error && numericOnly.length > 0) setError('');
  };

  const handleCountryCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^\+0-9]/g, '');
    setCountryCode(cleaned);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const numericOnly = text.replace(/[\s\-\(\)\[\]]/g, '').replace(/[^0-9]/g, '');
        if (numericOnly) {
          setPhoneNumber(numericOnly);
          if (error) setError('');
        }
      }
    } catch (err) {
      console.warn("Clipboard access denied or failed", err);
      alert("Clipboard access was denied. Please paste manually.");
    }
  };

  // URL Generation and Action Tracking
  const getUrl = () => {
    const cleanCountryCode = countryCode.replace(/[^0-9]/g, '');
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    let url = `https://wa.me/${cleanCountryCode}${cleanPhone}`;
    if (message.trim()) {
      url += `?text=${encodeURIComponent(message.trim())}`;
    }
    return url;
  };

  const saveToRecents = () => {
    const cleanCountryCode = '+' + countryCode.replace(/[^0-9]/g, '');
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanPhone) return;

    const newItem: RecentItem = { countryCode: cleanCountryCode, phone: cleanPhone, timestamp: Date.now() };
    
    setRecents(prev => {
      // Remove exact duplicate if exists, then prepend
      const filtered = prev.filter(r => !(r.countryCode === newItem.countryCode && r.phone === newItem.phone));
      const updated = [newItem, ...filtered].slice(0, 5); // Max 5
      localStorage.setItem('wa_recents', JSON.stringify(updated));
      return updated;
    });
  };

  const validateAndExecute = (action: () => void) => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    saveToRecents();
    action();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndExecute(() => {
      window.open(getUrl(), '_blank', 'noopener,noreferrer');
    });
  };

  const handleCopyLink = () => {
    validateAndExecute(async () => {
      try {
        await navigator.clipboard.writeText(getUrl());
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy link', err);
      }
    });
  };

  const handleShowQr = () => {
    validateAndExecute(() => {
      setShowQr(true);
    });
  };

  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `wa-direct-${phoneNumber}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  // Snippets Handlers
  const addCustomSnippet = () => {
    setShowSnippetModal(true);
  };

  const handleSaveSnippet = () => {
    if (newSnippetText && newSnippetText.trim() !== '') {
      const updated = [...snippets, newSnippetText.trim()];
      setSnippets(updated);
      localStorage.setItem('wa_snippets', JSON.stringify(updated));
      setNewSnippetText('');
      setShowSnippetModal(false);
    }
  };

  const handleDeleteSnippet = (snippetToDelete: string) => {
    const updated = snippets.filter(s => s !== snippetToDelete);
    setSnippets(updated);
    localStorage.setItem('wa_snippets', JSON.stringify(updated));
  };

  const clearRecents = () => {
    if (window.confirm("Are you sure you want to clear your private history?")) {
      setRecents([]);
      localStorage.removeItem('wa_recents');
    }
  };

  const maskPhone = (phone: string) => {
    if (phone.length <= 4) return phone;
    const firstTwo = phone.slice(0, 2);
    const lastTwo = phone.slice(-2);
    const maskedLength = phone.length - 4;
    return `${firstTwo}${ '*'.repeat(maskedLength) }${lastTwo}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Main Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 hover:shadow-md transition-shadow duration-300 relative z-20">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Phone Input Group */}
          <div className="space-y-2">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700">
              WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <div 
              className={cn(
                "flex group relative rounded-lg transition-all duration-200 overflow-hidden",
                "border bg-white",
                isFocused ? "border-green-500 ring-2 ring-green-500/20" : 
                error ? "border-red-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20" : 
                "border-slate-300 hover:border-slate-400"
              )}
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className={cn("h-5 w-5", isFocused ? "text-green-500" : error ? "text-red-400" : "text-slate-400")} />
              </div>
              
              <input
                type="text"
                name="countryCode"
                value={countryCode}
                onChange={handleCountryCodeChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-20 pl-10 py-3 bg-transparent border-none text-slate-900 focus:ring-0 sm:text-sm font-medium placeholder-slate-400 focus:outline-none"
                placeholder="+1"
                aria-label="Country Code"
              />
              
              <div className="w-px bg-slate-200 my-2"></div>
              
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={phoneNumber}
                onChange={handlePhoneChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="flex-1 px-3 py-3 bg-transparent border-none text-slate-900 focus:ring-0 sm:text-sm font-medium placeholder-slate-400 focus:outline-none"
                placeholder="Enter phone number"
              />

              <button 
                type="button" 
                onClick={handlePaste}
                title="Paste Number"
                aria-label="Paste phone number from clipboard"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-green-600 transition-colors"
              >
                <ClipboardPaste className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-red-600 mt-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>

          {/* Message Input Group */}
          <div className="space-y-2">
            <label htmlFor="message" className="block text-sm font-medium text-slate-700 flex justify-between">
              <span>Message <span className="text-slate-400 font-normal">(Optional)</span></span>
              <span className={cn("text-xs", message.length > 0 ? "text-slate-500" : "text-slate-300")}>
                {message.length > 0 ? `${message.length} chars` : ''}
              </span>
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <MessageSquare className="h-5 w-5 text-slate-400" />
              </div>
              <textarea
                id="message"
                name="message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:outline-none sm:text-sm placeholder-slate-400 transition-all duration-200 resize-none"
                placeholder="Type your message here..."
              />
            </div>
            
            {/* Snippets / Templates */}
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
              {snippets.map((snip, idx) => {
                const isCustom = !DEFAULT_SNIPPETS.includes(snip);
                return (
                  <div key={idx} className="shrink-0 inline-flex items-center bg-slate-100 rounded-full border border-slate-200 transition-colors focus-within:ring-2 focus-within:ring-green-500/20">
                    <button
                      type="button"
                      onClick={() => setMessage(prev => prev ? `${prev} ${snip}` : snip)}
                      className={cn(
                        "py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium focus:outline-none transition-colors",
                        isCustom ? "pl-3 pr-1.5 rounded-l-full hover:bg-slate-200" : "px-3 rounded-full hover:bg-slate-200"
                      )}
                    >
                      {snip}
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSnippet(snip)}
                        title="Delete snippet"
                        aria-label={`Delete snippet: ${snip}`}
                        className="p-1.5 pr-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-r-full focus:outline-none transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addCustomSnippet}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-500 text-xs font-medium transition-colors"
              >
                <Plus className="h-3 w-3" /> Custom
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 active:scale-[0.98]"
            >
              <Send className="h-5 w-5" />
              Open in WhatsApp
            </button>
            
            <div className="flex gap-3 sm:w-auto">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3.5 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200"
              >
                {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <LinkIcon className="h-5 w-5" />}
                {isCopied ? <span className="text-green-600">Copied!</span> : 'Copy Link'}
              </button>
              <button
                type="button"
                onClick={handleShowQr}
                title="Generate QR Code"
                aria-label="Generate QR Code"
                className="flex items-center justify-center px-4 py-3.5 border border-slate-300 rounded-lg shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200"
              >
                <QrCode className="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Recent Numbers Tray */}
      {recents.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <History className="h-4 w-4 text-slate-500" />
              Recent Numbers (Private)
            </div>
            <button 
              onClick={clearRecents}
              className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Clear All
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recents.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCountryCode(item.countryCode);
                  setPhoneNumber(item.phone);
                  if (error) setError('');
                }}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left group focus:outline-none focus:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded">
                    {item.countryCode}
                  </span>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-green-600 transition-colors">
                    {maskPhone(item.phone)}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Modal/Popover */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-green-500" />
                Chat QR Code
              </h3>
              <button 
                onClick={() => setShowQr(false)}
                aria-label="Close QR Code Modal"
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center justify-center bg-slate-50" ref={qrRef}>
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <QRCodeCanvas 
                  value={getUrl()} 
                  size={200}
                  bgColor={"#ffffff"}
                  fgColor={"#0f172a"}
                  level={"Q"}
                  marginSize={1}
                />
              </div>
              <p className="mt-4 text-sm text-center text-slate-500 font-medium">
                Scan to open chat<br/>
                <span className="text-slate-400 text-xs font-normal">
                  {countryCode} {maskPhone(phoneNumber)}
                </span>
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white">
              <button
                onClick={handleDownloadQr}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:text-green-600 hover:border-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200"
              >
                <Download className="h-4 w-4" />
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Snippet Modal */}
      {showSnippetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-500" />
                Add Quick Snippet
              </h3>
              <button 
                onClick={() => { setShowSnippetModal(false); setNewSnippetText(''); }}
                aria-label="Close Snippet Modal"
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 bg-slate-50">
              <label htmlFor="newSnippet" className="block text-sm font-medium text-slate-700 mb-2">
                Snippet Text
              </label>
              <input
                type="text"
                id="newSnippet"
                autoFocus
                value={newSnippetText}
                onChange={(e) => setNewSnippetText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSnippet();
                  if (e.key === 'Escape') { setShowSnippetModal(false); setNewSnippetText(''); }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:outline-none sm:text-sm placeholder-slate-400 transition-all duration-200"
                placeholder="e.g., I'm interested in..."
              />
            </div>
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => { setShowSnippetModal(false); setNewSnippetText(''); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSnippet}
                disabled={!newSnippetText.trim()}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Add Snippet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
