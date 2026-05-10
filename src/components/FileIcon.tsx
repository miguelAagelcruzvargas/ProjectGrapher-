import React from 'react';
import { Code2, Database, Share2, FileText } from 'lucide-react';

export const FileIcon = ({ ext, className }: { ext: string, className?: string }) => {
  if (['.js', '.ts', '.tsx', '.jsx'].includes(ext)) return <Code2 className={className} />;
  if (ext === '.json') return <Database className={className} />;
  if (['.css', '.scss', '.less'].includes(ext)) return <Share2 className={className} />;
  return <FileText className={className} />;
};
