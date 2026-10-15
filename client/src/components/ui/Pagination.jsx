import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({ meta, onPageChange }) => {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-700 mt-2">
      <p className="text-xs text-slate-500">
        {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(meta.page - 1)} disabled={!meta.hasPrevPage}
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs text-slate-400">Page {meta.page} / {meta.totalPages}</span>
        <button onClick={() => onPageChange(meta.page + 1)} disabled={!meta.hasNextPage}
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};
