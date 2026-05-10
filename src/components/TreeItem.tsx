import React, { useState } from 'react';
import { ChevronDown, Folder } from 'lucide-react';
import { TreeNode, ProjectFile } from '../types';
import { getExtension } from '../utils/analysis';
import { FileIcon } from './FileIcon';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TreeItem = ({ node, level, onFileSelect, selectedId }: { 
  node: TreeNode, 
  level: number, 
  onFileSelect: (f: ProjectFile) => void,
  selectedId: string | null 
}) => {
  const [isOpen, setIsOpen] = useState(level < 2);

  return (
    <div>
      <button
        onClick={() => node.isFile ? (node.fileData && onFileSelect(node.fileData)) : setIsOpen(!isOpen)}
        className={cn(
          "w-full text-left p-1.5 rounded-lg hover:bg-white/5 transition-all group flex items-center gap-2",
          node.isFile && selectedId === node.path && "bg-brand-primary/10 border-brand-primary/20"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {node.isFile ? (
          <FileIcon ext={getExtension(node.name)} className="w-4 h-4 text-gray-500 group-hover:text-brand-primary shrink-0" />
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
             <ChevronDown className={cn("w-3 h-3 text-gray-600 transition-transform", !isOpen && "-rotate-90")} />
             <Folder className="w-4 h-4 text-brand-primary/60 fill-brand-primary/10" />
          </div>
        )}
        <span className={cn(
          "text-xs truncate transition-colors",
          node.isFile ? "text-gray-400 group-hover:text-gray-200" : "text-gray-200 font-medium",
          node.isFile && selectedId === node.path && "text-brand-primary"
        )}>
          {node.name}
        </span>
      </button>
      {!node.isFile && isOpen && node.children.map((child, i) => (
        <TreeItem 
          key={i} 
          node={child} 
          level={level + 1} 
          onFileSelect={onFileSelect}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
};
