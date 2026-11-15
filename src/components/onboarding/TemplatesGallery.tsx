import React, { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, Layers, Eye, Play, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import { Button } from '../ui/Button';
import type { StarterTemplate } from '../../types';

interface TemplatesGalleryProps {
  compact?: boolean;
  onApplied?: () => void;
}

export const TemplatesGallery: React.FC<TemplatesGalleryProps> = ({
  compact = false,
  onApplied,
}) => {
  const { token, user, refreshOnboarding } = useAuth();
  const [templates, setTemplates] = useState<StarterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [error, setError] = useState<string>('');

  const loadTemplates = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await dashboardService.getStarterTemplates(token);
      setTemplates(res.templates || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load starter templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.experienceTier]);

  const handleApply = async (id: string) => {
    if (!token) return;
    setApplyingId(id);
    setFeedback('');
    setError('');
    try {
      const res = await dashboardService.applyStarterTemplate(id, token);
      setFeedback(res.message);
      await loadTemplates();
      await refreshOnboarding();
      onApplied?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to apply template.');
    } finally {
      setApplyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {templates.map((tpl) => {
          const isPreviewOpen = previewId === tpl.id;
          return (
            <div
              key={tpl.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {tpl.tier === 'advanced' ? (
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                    ) : (
                      <Layers className="h-3 w-3 text-emerald-500" />
                    )}
                    {tpl.tier === 'advanced' ? 'Advanced · Free' : 'Basic · Free'}
                  </span>
                  {tpl.alreadyApplied && (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Applied
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{tpl.name}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">{tpl.summary}</p>
                {!compact && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-500">{tpl.whyUseful}</p>
                )}

                {isPreviewOpen && (
                  <div className="mt-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 p-2.5 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Included Items
                    </p>
                    {tpl.previewItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                        <span className="font-medium text-gray-700 dark:text-gray-200 truncate">
                          {item.title}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 shrink-0">
                          {item.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPreviewId(isPreviewOpen ? null : tpl.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {isPreviewOpen ? 'Hide' : 'Preview'}
                </button>
                <Button
                  size="sm"
                  disabled={tpl.alreadyApplied || applyingId === tpl.id}
                  onClick={() => handleApply(tpl.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1"
                >
                  {applyingId === tpl.id ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Applying...
                    </>
                  ) : tpl.alreadyApplied ? (
                    'Already Applied'
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      Apply Template
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
