"use client"

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function GuidePage() {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    fetch('/USER_GUIDE.md')
      .then(response => response.text())
      .then(text => setMarkdown(text));
  }, []);

  return (
    <div className="prose lg:prose-xl max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
