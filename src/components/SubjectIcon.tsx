import React from 'react';
import {
  Atom,
  BookOpen,
  Calculator,
  Compass,
  Cpu,
  FileOutput,
  FileText,
  Globe2,
  Image as ImageIcon,
  Languages,
  Landmark,
  MessageCircle,
  Presentation,
  Scale,
} from 'lucide-react';
import type { WorkspaceId } from '../types/study';

interface SubjectIconProps {
  id: WorkspaceId;
  className?: string;
}

export const SubjectIcon: React.FC<SubjectIconProps> = ({ id, className = 'w-4 h-4' }) => {
  switch (id) {
    case 'korean':
      return <BookOpen className={className} />;
    case 'math':
      return <Calculator className={className} />;
    case 'english':
      return <Languages className={className} />;
    case 'science':
      return <Atom className={className} />;
    case 'social':
      return <Scale className={className} />;
    case 'history':
      return <Landmark className={className} />;
    case 'foreign':
      return <Globe2 className={className} />;
    case 'informatics':
      return <Cpu className={className} />;
    case 'free-chat':
      return <MessageCircle className={className} />;
    case 'doc-summary':
      return <FileText className={className} />;
    case 'photo-analysis':
      return <ImageIcon className={className} />;
    case 'resource-search':
      return <Compass className={className} />;
    case 'doc-maker':
      return <FileOutput className={className} />;
    case 'ppt-maker':
      return <Presentation className={className} />;
  }
};
