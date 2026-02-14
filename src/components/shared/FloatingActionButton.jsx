import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, X, Briefcase, Users, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function FloatingActionButton() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-50 lg:hidden">
      {/* Action Buttons */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 flex flex-col gap-3 mb-2">
          <Button
            onClick={() => {
              setIsOpen(false);
              navigate(createPageUrl('QuoteForm'));
            }}
            className="rounded-full h-12 w-12 shadow-lg bg-white hover:bg-slate-50 text-slate-700"
          >
            <FileText className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false);
              navigate(createPageUrl('JobForm'));
            }}
            className="rounded-full h-12 w-12 shadow-lg bg-white hover:bg-slate-50 text-slate-700"
          >
            <Briefcase className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false);
              navigate(createPageUrl('ClientForm'));
            }}
            className="rounded-full h-12 w-12 shadow-lg bg-white hover:bg-slate-50 text-slate-700"
          >
            <Users className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full h-14 w-14 shadow-xl hover:shadow-2xl transition-all text-white"
        style={{ backgroundColor: '#00214d' }}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}