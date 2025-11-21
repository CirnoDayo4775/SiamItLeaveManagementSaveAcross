import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

export type PaginationBarProps = {
  page: number;
  totalPages: number;
  totalResults?: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
  compact?: boolean; // แสดงแบบกะทัดรัด ใช้ในตาราง/การ์ดแคบๆ
  showInfo?: boolean; // แสดงข้อความ page info และผลลัพธ์
};

export const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  totalPages,
  totalResults,
  pageSize,
  pageSizeOptions = [5, 10, 20, 50],
  onPageChange,
  onPageSizeChange,
  className,
  compact = false,
  showInfo = true,
}) => {
  const { t } = useTranslation();

  const renderPageButtons = () => {
    const elements: React.ReactNode[] = [];
    const maxButtons = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      elements.push(
        <Button
          key={1}
          variant={page === 1 ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(1)}
          className={`rounded-lg px-3 py-2 ${page === 1 ? "bg-blue-600 text-white" : "border-blue-200 text-blue-700 hover:bg-blue-50"}`}
        >
          1
        </Button>
      );
      if (start > 2) elements.push(<span key="start-ellipsis" className="px-2 text-gray-400">...</span>);
    }

    for (let i = start; i <= end; i++) {
      elements.push(
        <Button
          key={i}
          variant={page === i ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(i)}
          className={`rounded-lg px-3 py-2 ${page === i ? "bg-blue-600 text-white" : "border-blue-200 text-blue-700 hover:bg-blue-50"}`}
        >
          {i}
        </Button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) elements.push(<span key="end-ellipsis" className="px-2 text-gray-400">...</span>);
      elements.push(
        <Button
          key={totalPages}
          variant={page === totalPages ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(totalPages)}
          className={`rounded-lg px-3 py-2 ${page === totalPages ? "bg-blue-600 text-white" : "border-blue-200 text-blue-700 hover:bg-blue-50"}`}
        >
          {totalPages}
        </Button>
      );
    }

    return elements;
  };

  if (!totalPages && !totalResults) return null;

  const containerBase = compact
    ? "flex flex-col sm:flex-row justify-center items-center mt-4 gap-2 px-3 py-3 bg-white/70 backdrop-blur rounded-xl border border-blue-100"
    : "flex flex-col sm:flex-row justify-center items-center mt-8 gap-4 p-6 glass shadow-xl border-0";

  return (
    <div className={`${containerBase} ${className || ""}`}>
      {/* Page info */}
      {showInfo && (
        <div className={`flex items-center ${compact ? "gap-2 text-xs" : "gap-4 text-sm"} text-gray-600`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>{t('history.pageInfo', { page: page || 1, totalPages: totalPages || 1 })}</span>
          </div>
          <div className="w-px h-4 bg-gray-300"></div>
          {typeof totalResults === 'number' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{totalResults} {t('history.results')}</span>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className={`border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 ${compact ? "rounded-md px-2.5 py-1.5" : "rounded-lg px-3 py-2"}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-1">
            {renderPageButtons()}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className={`border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 ${compact ? "rounded-md px-2.5 py-1.5" : "rounded-lg px-3 py-2"}`}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Page size */}
      {onPageSizeChange && (
        <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              const n = Number(v);
              if (!Number.isNaN(n)) {
                onPageSizeChange(n);
                onPageChange(1);
              }
            }}
          >
            <SelectTrigger className={`w-20 bg-white/90 backdrop-blur border-blue-200 ${compact ? "h-8 rounded-md" : "h-9 rounded-lg"}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-0 shadow-xl rounded-xl">
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)} className="rounded-lg">{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className={`${compact ? "text-xs" : "text-sm"} text-gray-600`}>{t('admin.itemsPerPage')}</span>
        </div>
      )}
    </div>
  );
};

export default PaginationBar;


