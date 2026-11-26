import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1600);
  };

  return (
    <div className="study-prose text-[#1E2024] dark:text-[#EAE7DF] dark:tracking-[0.005em] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            let codeText = '';
            if (React.isValidElement(children)) {
              const childProps = children.props as { children?: React.ReactNode };
              if (typeof childProps?.children === 'string') {
                codeText = childProps.children;
              }
            }
            return (
              <div className="relative group my-3">
                {codeText && (
                  <button
                    type="button"
                    onClick={() => handleCopy(codeText)}
                    className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-[#FFFDF8] dark:bg-[#242730] text-[#5D616B] dark:text-[#A8A49B] border border-[#E5DFD2] dark:border-[#323642] hover:text-[#1E2024] dark:hover:text-[#EAE7DF] transition-colors"
                    title="코드 복사"
                  >
                    {copiedCode === codeText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                )}
                <pre>{children}</pre>
              </div>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 text-blue-700 dark:text-blue-400 hover:opacity-80"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
