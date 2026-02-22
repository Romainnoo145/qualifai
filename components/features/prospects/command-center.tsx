'use client';

import {
  Beaker,
  Target,
  FileText,
  CheckCircle2,
  Globe,
  MapPin,
  Users,
  DollarSign,
  Calendar,
  Linkedin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CommandCenter({
  prospect,
  researchRuns,
  hypothesisData,
  latestLossMap,
  latestCallPrep: _latestCallPrep,
  onStartResearch,
  onMatchProof: _onMatchProof,
  onGenerateLossMap,
  onQueueOutreach: _onQueueOutreach,
  isResearching,
  isMatchingProof: _isMatchingProof,
  isGeneratingLossMap,
  isQueueing: _isQueueing,
}: any) {
  const p = prospect;
  const runs = researchRuns || [];
  const latestRun = runs[0];
  const hypotheses = hypothesisData?.hypotheses || [];
  const pendingCount = hypotheses.filter(
    (h: any) => h.status === 'ACCEPTED' || h.status === 'PENDING',
  ).length;

  return (
    <div className="space-y-8">
      {/* Company info */}
      <div className="glass-card p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {p.industry && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p.industry}
                {p.subIndustry ? ` / ${p.subIndustry}` : ''}
              </span>
            </div>
          )}
          {(p.city ?? p.country) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {[p.city, p.state, p.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {(p.employeeRange || p.employeeCount) && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p.employeeCount
                  ? `${p.employeeCount.toLocaleString()} employees`
                  : `${p.employeeRange} employees`}
              </span>
            </div>
          )}
          {(p.revenueRange || p.revenueEstimate) && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p.revenueEstimate ?? p.revenueRange}
              </span>
            </div>
          )}
          {p.foundedYear && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Founded {p.foundedYear}</span>
            </div>
          )}
          {p.linkedinUrl && (
            <div className="flex items-center gap-2 text-sm">
              <Linkedin className="w-4 h-4 text-slate-400" />
              <a
                href={p.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                LinkedIn
              </a>
            </div>
          )}
        </div>
        {p.technologies?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5">
              {p.technologies.map((tech: string) => (
                <span
                  key={tech}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pipeline status */}
      <div className="glass-card p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">
              {runs.length > 0 ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {runs.length} research run{runs.length > 1 ? 's' : ''}
                </span>
              ) : (
                'No research yet'
              )}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">
              {pendingCount > 0 ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {pendingCount} hypotheses pending validation
                </span>
              ) : hypotheses.length > 0 ? (
                `${hypotheses.length} hypotheses`
              ) : (
                'No hypotheses'
              )}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">
              {latestLossMap ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Workflow Report ready
                </span>
              ) : (
                'No Workflow Report'
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
          <Button
            onClick={onStartResearch}
            isLoading={isResearching}
            size="sm"
            variant="outline"
            leftIcon={<Beaker className="w-3.5 h-3.5" />}
          >
            {runs.length > 0 ? 'Re-run Research' : 'Run Research'}
          </Button>
          {latestRun && (
            <Button
              onClick={onGenerateLossMap}
              isLoading={isGeneratingLossMap}
              size="sm"
              variant="outline"
              leftIcon={<FileText className="w-3.5 h-3.5" />}
            >
              {latestLossMap ? 'Regenerate Report' : 'Generate Report'}
            </Button>
          )}
        </div>
      </div>

      {/* Hypotheses quick view */}
      {hypotheses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Hypotheses ({hypotheses.length})
          </h3>
          {hypotheses.slice(0, 6).map((h: any) => (
            <div
              key={h.id}
              className="glass-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest',
                      h.status === 'ACCEPTED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : h.status === 'REJECTED'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {h.status}
                  </span>
                  <span className="text-sm font-bold text-[#040026] truncate">
                    {h.title}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {h.problemStatement}
                </p>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                {h.status === 'DECLINED' ? 'Declined' : 'Pending validation'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
